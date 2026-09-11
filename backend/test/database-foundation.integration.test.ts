import assert from "node:assert/strict";

import {
  appendFile,
  copyFile,
  mkdtemp,
  rm,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
  resolve,
} from "node:path";

import test from "node:test";

import {
  Pool,
  type PoolClient,
} from "pg";

import {
  MigrationChecksumError,
  runMigrations,
} from "../src/db/migrate.js";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL?.trim();

const skipReason =
  testDatabaseUrl === undefined ||
  testDatabaseUrl.length === 0
    ? "TEST_DATABASE_URL not set; runtime proof deferred to T005"
    : false;

function hasPgCode(
  error: unknown,
  expectedCode: string,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const pgError =
    error as Error & {
      readonly code?: string;
    };

  return pgError.code === expectedCode;
}

async function expectPgCode(
  action: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  await assert.rejects(
    action,
    (error: unknown) =>
      hasPgCode(
        error,
        expectedCode,
      ),
  );
}

async function resetPublicSchema(
  pool: Pool,
): Promise<void> {
  await pool.query(`
    DROP SCHEMA IF EXISTS public CASCADE
  `);

  await pool.query(`
    CREATE SCHEMA public
  `);
}

async function activateRun(
  pool: Pool,
  syncRunId: string,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        SELECT id
        FROM sync_runs
        WHERE id = $1
        FOR UPDATE
      `,
      [
        syncRunId,
      ],
    );

    await client.query(
      `
        SELECT singleton_id
        FROM app_state
        WHERE singleton_id = 1
        FOR UPDATE
      `,
    );

    await client.query(
      `
        UPDATE app_state
        SET
          active_sync_run_id = $1,
          updated_at = NOW()
        WHERE singleton_id = 1
      `,
      [
        syncRunId,
      ],
    );

    await client.query(
      `
        UPDATE sync_runs
        SET activated_at =
          COALESCE(
            activated_at,
            NOW()
          )
        WHERE id = $1
      `,
      [
        syncRunId,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function attemptRolledBackActivation(
  pool: Pool,
  syncRunId: string,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        SELECT id
        FROM sync_runs
        WHERE id = $1
        FOR UPDATE
      `,
      [
        syncRunId,
      ],
    );

    await client.query(
      `
        SELECT singleton_id
        FROM app_state
        WHERE singleton_id = 1
        FOR UPDATE
      `,
    );

    await client.query(
      `
        UPDATE app_state
        SET
          active_sync_run_id = $1,
          updated_at = NOW()
        WHERE singleton_id = 1
      `,
      [
        syncRunId,
      ],
    );

    await client.query(
      `
        UPDATE sync_runs
        SET activated_at = NOW()
        WHERE id = $1
      `,
      [
        syncRunId,
      ],
    );

    await client.query(`
      INSERT INTO app_state (
        singleton_id,
        active_sync_run_id,
        updated_at
      )
      VALUES (
        2,
        NULL,
        NOW()
      )
    `);

    throw new Error(
      "Expected singleton constraint failure",
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      hasPgCode(
        error,
        "23514",
      )
    ) {
      return;
    }

    throw error;
  } finally {
    client.release();
  }
}

async function createSyncRun(
  pool: Pool,
  options: {
    readonly status:
      | "running"
      | "succeeded"
      | "failed";
    readonly expected: number;
    readonly completed: number;
    readonly failed: number;
  },
): Promise<string> {
  const finishedAt =
    options.status === "running"
      ? null
      : new Date();

  const result =
    await pool.query<{
      readonly id: string;
    }>(
      `
        INSERT INTO sync_runs (
          status,
          province_code,
          fiscal_year,
          current_quarter,
          expected_source_count,
          completed_source_count,
          failed_source_count,
          config_snapshot,
          started_at,
          finished_at
        )
        VALUES (
          $1,
          '54',
          2569,
          1,
          $2,
          $3,
          $4,
          '{}'::JSONB,
          NOW(),
          $5
        )
        RETURNING id
      `,
      [
        options.status,
        options.expected,
        options.completed,
        options.failed,
        finishedAt,
      ],
    );

  const id = result.rows[0]?.id;

  assert.ok(id);

  return id;
}

test(
  "PostgreSQL 18 database foundation contract",
  {
    skip: skipReason,
  },
  async (t) => {
    if (!testDatabaseUrl) {
      throw new Error(
        "TEST_DATABASE_URL unexpectedly missing",
      );
    }

    assert.equal(
      process.env
        .PA_ALLOW_DESTRUCTIVE_DB_TESTS,
      "YES",
      "PA_ALLOW_DESTRUCTIVE_DB_TESTS=YES is required",
    );

    const parsed =
      new URL(testDatabaseUrl);

    assert.ok(
      parsed.protocol === "postgres:" ||
      parsed.protocol === "postgresql:",
      "TEST_DATABASE_URL must use PostgreSQL",
    );

    const databaseName =
      decodeURIComponent(
        parsed.pathname.replace(
          /^\/+/,
          "",
        ),
      );

    assert.match(
      databaseName,
      /_test$/,
      "Destructive tests require a database name ending in _test",
    );

    const pool = new Pool({
      connectionString:
        testDatabaseUrl,
      max: 2,
    });

    try {
      await t.test(
        "runtime is PostgreSQL major 18",
        async () => {
          const result =
            await pool.query<{
              readonly server_version_num:
                string;
            }>(
              `
                SHOW server_version_num
              `,
            );

          const version =
            result.rows[0]
              ?.server_version_num;

          assert.ok(version);

          assert.match(
            version,
            /^18\d{4}$/,
          );
        },
      );

      await resetPublicSchema(pool);

      await t.test(
        "clean migration applies and replay skips",
        async () => {
          const first =
            await runMigrations(pool);

          assert.deepEqual(
            first.applied,
            ["0001"],
          );

          assert.deepEqual(
            first.skipped,
            [],
          );

          const second =
            await runMigrations(pool);

          assert.deepEqual(
            second.applied,
            [],
          );

          assert.deepEqual(
            second.skipped,
            ["0001"],
          );
        },
      );

      await t.test(
        "changed applied migration checksum is rejected",
        async () => {
          const directory =
            await mkdtemp(
              join(
                tmpdir(),
                "pa-dashboard-checksum-test-",
              ),
            );

          try {
            const source = resolve(
              "migrations",
              "0001_database_foundation.sql",
            );

            const target = join(
              directory,
              "0001_database_foundation.sql",
            );

            await copyFile(
              source,
              target,
            );

            await appendFile(
              target,
              "\n-- checksum drift probe\n",
              "utf8",
            );

            await assert.rejects(
              () =>
                runMigrations(
                  pool,
                  directory,
                ),
              MigrationChecksumError,
            );
          } finally {
            await rm(
              directory,
              {
                recursive: true,
                force: true,
              },
            );
          }
        },
      );

      await t.test(
        "schema contains exact foundation tables",
        async () => {
          const result =
            await pool.query<{
              readonly table_name: string;
            }>(
              `
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name
              `,
            );

          const actual =
            result.rows.map(
              (row) => row.table_name,
            );

          const expected = [
            "app_settings",
            "app_state",
            "facilities",
            "kpi_categories",
            "kpi_definitions",
            "kpi_results",
            "schema_migrations",
            "source_records",
            "sync_runs",
            "tambons",
          ];

          assert.deepEqual(
            actual,
            expected,
          );
        },
      );

      await t.test(
        "critical named constraints exist",
        async () => {
          const result =
            await pool.query<{
              readonly conname: string;
            }>(
              `
                SELECT conname
                FROM pg_constraint
                WHERE connamespace =
                  'public'::regnamespace
              `,
            );

          const names =
            new Set(
              result.rows.map(
                (row) => row.conname,
              ),
            );

          const required = [
            "ck_app_state_singleton",
            "ck_kpi_definitions_effective_quarter",
            "ck_kpi_definitions_kind",
            "ck_kpi_definitions_target_months",
            "ck_kpi_results_period",
            "ck_source_records_raw_payload_object",
            "ck_source_records_sequence",
            "ck_sync_runs_counts_nonnegative",
            "ck_sync_runs_counts_within_expected",
            "ck_sync_runs_current_quarter",
            "ck_sync_runs_lifecycle",
            "ck_sync_runs_status",
            "fk_app_state_active_sync_run",
            "fk_facilities_tambon",
            "fk_kpi_definitions_category",
            "fk_kpi_results_definition",
            "fk_kpi_results_sync_run",
            "fk_source_records_sync_run",
            "uq_kpi_categories_code",
            "uq_kpi_definitions_key",
            "uq_kpi_results_logical",
            "uq_source_records_run_source_sequence",
          ];

          for (
            const name
            of required
          ) {
            assert.ok(
              names.has(name),
              `Missing constraint: ${name}`,
            );
          }
        },
      );

      await t.test(
        "minimal explicit index baseline exists",
        async () => {
          const result =
            await pool.query<{
              readonly indexname: string;
            }>(
              `
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
              `,
            );

          const names =
            new Set(
              result.rows.map(
                (row) => row.indexname,
              ),
            );

          const required = [
            "idx_facilities_tambon",
            "idx_kpi_definitions_category_sort",
            "idx_kpi_results_run_area",
            "idx_kpi_results_run_definition",
            "idx_kpi_results_run_facility",
            "idx_source_records_run_area",
            "idx_source_records_run_facility",
            "idx_source_records_run_source",
            "idx_sync_runs_status_started",
          ];

          for (
            const name
            of required
          ) {
            assert.ok(
              names.has(name),
              `Missing index: ${name}`,
            );
          }
        },
      );

      const categoryResult =
        await pool.query<{
          readonly id: string;
        }>(
          `
            INSERT INTO kpi_categories (
              code,
              name
            )
            VALUES (
              'foundation-test',
              'Foundation Test'
            )
            RETURNING id
          `,
        );

      const categoryId =
        categoryResult.rows[0]?.id;

      assert.ok(categoryId);

      const definitionResult =
        await pool.query<{
          readonly id: string;
        }>(
          `
            INSERT INTO kpi_definitions (
              kpi_key,
              title,
              category_id,
              kind,
              source_sheet,
              target_months,
              updated_at
            )
            VALUES (
              'foundation.physical',
              'Foundation Physical KPI',
              $1,
              'physical',
              's_foundation',
              ARRAY[1, 2, 3]::SMALLINT[],
              NOW()
            )
            RETURNING id
          `,
          [
            categoryId,
          ],
        );

      const definitionId =
        definitionResult.rows[0]?.id;

      assert.ok(definitionId);

      await t.test(
        "external codes preserve leading zeros",
        async () => {
          await pool.query(`
            INSERT INTO tambons (
              id,
              district_id,
              name_th,
              zip_code,
              updated_at
            )
            VALUES (
              '540601',
              '5406',
              'ทดสอบ',
              '54120',
              NOW()
            )
          `);

          await pool.query(`
            INSERT INTO facilities (
              hospcode,
              hospname,
              tambon_id,
              updated_at
            )
            VALUES (
              '06413',
              'Test Facility',
              '540601',
              NOW()
            )
          `);

          const result =
            await pool.query<{
              readonly hospcode: string;
              readonly tambon_id: string;
            }>(
              `
                SELECT
                  hospcode,
                  tambon_id
                FROM facilities
                WHERE hospcode = '06413'
              `,
            );

          assert.equal(
            result.rows[0]?.hospcode,
            "06413",
          );

          assert.equal(
            result.rows[0]?.tambon_id,
            "540601",
          );
        },
      );

      await t.test(
        "KPI definition constraints reject invalid values",
        async () => {
          await expectPgCode(
            () =>
              pool.query(
                `
                  INSERT INTO kpi_definitions (
                    kpi_key,
                    title,
                    category_id,
                    kind,
                    source_sheet,
                    updated_at
                  )
                  VALUES (
                    'invalid.kind',
                    'Invalid',
                    $1,
                    'unknown',
                    'probe',
                    NOW()
                  )
                `,
                [
                  categoryId,
                ],
              ),
            "23514",
          );

          await expectPgCode(
            () =>
              pool.query(
                `
                  INSERT INTO kpi_definitions (
                    kpi_key,
                    title,
                    category_id,
                    kind,
                    source_sheet,
                    effective_quarter,
                    updated_at
                  )
                  VALUES (
                    'invalid.quarter',
                    'Invalid',
                    $1,
                    'physical',
                    'probe',
                    5,
                    NOW()
                  )
                `,
                [
                  categoryId,
                ],
              ),
            "23514",
          );

          await expectPgCode(
            () =>
              pool.query(
                `
                  INSERT INTO kpi_definitions (
                    kpi_key,
                    title,
                    category_id,
                    kind,
                    source_sheet,
                    target_months,
                    updated_at
                  )
                  VALUES (
                    'invalid.month',
                    'Invalid',
                    $1,
                    'physical',
                    'probe',
                    ARRAY[13]::SMALLINT[],
                    NOW()
                  )
                `,
                [
                  categoryId,
                ],
              ),
            "23514",
          );
        },
      );

      await t.test(
        "sync run constraints reject invalid state",
        async () => {
          await expectPgCode(
            () =>
              pool.query(`
                INSERT INTO sync_runs (
                  status,
                  province_code,
                  fiscal_year,
                  current_quarter,
                  expected_source_count,
                  config_snapshot,
                  started_at
                )
                VALUES (
                  'running',
                  '54',
                  2569,
                  5,
                  1,
                  '{}'::JSONB,
                  NOW()
                )
              `),
            "23514",
          );

          await expectPgCode(
            () =>
              pool.query(`
                INSERT INTO sync_runs (
                  status,
                  province_code,
                  fiscal_year,
                  current_quarter,
                  expected_source_count,
                  completed_source_count,
                  config_snapshot,
                  started_at
                )
                VALUES (
                  'running',
                  '54',
                  2569,
                  1,
                  -1,
                  0,
                  '{}'::JSONB,
                  NOW()
                )
              `),
            "23514",
          );

          await expectPgCode(
            () =>
              pool.query(`
                INSERT INTO sync_runs (
                  status,
                  province_code,
                  fiscal_year,
                  current_quarter,
                  expected_source_count,
                  completed_source_count,
                  failed_source_count,
                  config_snapshot,
                  started_at
                )
                VALUES (
                  'running',
                  '54',
                  2569,
                  1,
                  1,
                  1,
                  1,
                  '{}'::JSONB,
                  NOW()
                )
              `),
            "23514",
          );

          await expectPgCode(
            () =>
              pool.query(`
                INSERT INTO sync_runs (
                  status,
                  province_code,
                  fiscal_year,
                  current_quarter,
                  expected_source_count,
                  completed_source_count,
                  failed_source_count,
                  config_snapshot,
                  started_at,
                  finished_at
                )
                VALUES (
                  'succeeded',
                  '54',
                  2569,
                  1,
                  2,
                  1,
                  0,
                  '{}'::JSONB,
                  NOW(),
                  NOW()
                )
              `),
            "23514",
          );
        },
      );

      const runningRunId =
        await createSyncRun(
          pool,
          {
            status: "running",
            expected: 2,
            completed: 0,
            failed: 0,
          },
        );

      await t.test(
        "source payload JSONB round-trips and row identity is sequence-based",
        async () => {
          const payload = {
            hospcode: "06413",
            areacode: "540601",
            target: 10,
            result: 7,
            extra_dynamic_field:
              "preserved",
          };

          await pool.query(
            `
              INSERT INTO source_records (
                sync_run_id,
                source_name,
                source_sequence,
                raw_payload
              )
              VALUES (
                $1,
                's_probe',
                1,
                $2::JSONB
              )
            `,
            [
              runningRunId,
              JSON.stringify(payload),
            ],
          );

          await pool.query(
            `
              INSERT INTO source_records (
                sync_run_id,
                source_name,
                source_sequence,
                raw_payload
              )
              VALUES (
                $1,
                's_probe',
                2,
                $2::JSONB
              )
            `,
            [
              runningRunId,
              JSON.stringify(payload),
            ],
          );

          const result =
            await pool.query<{
              readonly raw_payload:
                Record<string, unknown>;
            }>(
              `
                SELECT raw_payload
                FROM source_records
                WHERE sync_run_id = $1
                  AND source_name = 's_probe'
                  AND source_sequence = 1
              `,
              [
                runningRunId,
              ],
            );

          assert.deepEqual(
            result.rows[0]?.raw_payload,
            payload,
          );

          await expectPgCode(
            () =>
              pool.query(
                `
                  INSERT INTO source_records (
                    sync_run_id,
                    source_name,
                    source_sequence,
                    raw_payload
                  )
                  VALUES (
                    $1,
                    's_probe',
                    1,
                    '{}'::JSONB
                  )
                `,
                [
                  runningRunId,
                ],
              ),
            "23505",
          );

          await expectPgCode(
            () =>
              pool.query(
                `
                  INSERT INTO source_records (
                    sync_run_id,
                    source_name,
                    source_sequence,
                    raw_payload
                  )
                  VALUES (
                    $1,
                    's_bad_json',
                    1,
                    '[]'::JSONB
                  )
                `,
                [
                  runningRunId,
                ],
              ),
            "23514",
          );
        },
      );

      await t.test(
        "KPI result NULL logical identity is unique",
        async () => {
          await pool.query(
            `
              INSERT INTO kpi_results (
                sync_run_id,
                kpi_definition_id,
                fiscal_year,
                period_code,
                target,
                result,
                calculated_at
              )
              VALUES (
                $1,
                $2,
                2569,
                'annual',
                10,
                7,
                NOW()
              )
            `,
            [
              runningRunId,
              definitionId,
            ],
          );

          await expectPgCode(
            () =>
              pool.query(
                `
                  INSERT INTO kpi_results (
                    sync_run_id,
                    kpi_definition_id,
                    fiscal_year,
                    period_code,
                    target,
                    result,
                    calculated_at
                  )
                  VALUES (
                    $1,
                    $2,
                    2569,
                    'annual',
                    20,
                    8,
                    NOW()
                  )
                `,
                [
                  runningRunId,
                  definitionId,
                ],
              ),
            "23505",
          );
        },
      );

      await t.test(
        "app_state singleton starts inactive",
        async () => {
          const result =
            await pool.query<{
              readonly singleton_id: number;
              readonly active_sync_run_id:
                string | null;
            }>(
              `
                SELECT
                  singleton_id,
                  active_sync_run_id
                FROM app_state
              `,
            );

          assert.equal(
            result.rows.length,
            1,
          );

          assert.equal(
            result.rows[0]?.singleton_id,
            1,
          );

          assert.equal(
            result.rows[0]
              ?.active_sync_run_id,
            null,
          );

          await expectPgCode(
            () =>
              pool.query(`
                INSERT INTO app_state (
                  singleton_id,
                  active_sync_run_id,
                  updated_at
                )
                VALUES (
                  2,
                  NULL,
                  NOW()
                )
              `),
            "23514",
          );
        },
      );

      const failedRunId =
        await createSyncRun(
          pool,
          {
            status: "failed",
            expected: 1,
            completed: 0,
            failed: 1,
          },
        );

      const succeededRunA =
        await createSyncRun(
          pool,
          {
            status: "succeeded",
            expected: 1,
            completed: 1,
            failed: 0,
          },
        );

      const succeededRunB =
        await createSyncRun(
          pool,
          {
            status: "succeeded",
            expected: 1,
            completed: 1,
            failed: 0,
          },
        );

      await t.test(
        "activation guard rejects ineligible runs",
        async () => {
          await expectPgCode(
            () =>
              pool.query(
                `
                  UPDATE app_state
                  SET
                    active_sync_run_id = $1,
                    updated_at = NOW()
                  WHERE singleton_id = 1
                `,
                [
                  runningRunId,
                ],
              ),
            "23514",
          );

          await expectPgCode(
            () =>
              pool.query(
                `
                  UPDATE app_state
                  SET
                    active_sync_run_id = $1,
                    updated_at = NOW()
                  WHERE singleton_id = 1
                `,
                [
                  failedRunId,
                ],
              ),
            "23514",
          );

          await expectPgCode(
            () =>
              pool.query(`
                UPDATE app_state
                SET
                  active_sync_run_id = 999999999,
                  updated_at = NOW()
                WHERE singleton_id = 1
              `),
            "23503",
          );
        },
      );

      await t.test(
        "complete succeeded run activates",
        async () => {
          await activateRun(
            pool,
            succeededRunA,
          );

          const result =
            await pool.query<{
              readonly active_sync_run_id:
                string | null;
              readonly activated_at:
                Date | null;
            }>(
              `
                SELECT
                  s.active_sync_run_id,
                  r.activated_at
                FROM app_state AS s
                JOIN sync_runs AS r
                  ON r.id =
                    s.active_sync_run_id
                WHERE s.singleton_id = 1
              `,
            );

          assert.equal(
            result.rows[0]
              ?.active_sync_run_id,
            succeededRunA,
          );

          assert.ok(
            result.rows[0]
              ?.activated_at,
          );
        },
      );

      await t.test(
        "failed activation transaction preserves previous pointer",
        async () => {
          await attemptRolledBackActivation(
            pool,
            succeededRunB,
          );

          const state =
            await pool.query<{
              readonly active_sync_run_id:
                string | null;
            }>(
              `
                SELECT active_sync_run_id
                FROM app_state
                WHERE singleton_id = 1
              `,
            );

          assert.equal(
            state.rows[0]
              ?.active_sync_run_id,
            succeededRunA,
          );

          const run =
            await pool.query<{
              readonly activated_at:
                Date | null;
            }>(
              `
                SELECT activated_at
                FROM sync_runs
                WHERE id = $1
              `,
              [
                succeededRunB,
              ],
            );

          assert.equal(
            run.rows[0]?.activated_at,
            null,
          );
        },
      );

      await t.test(
        "pointer and activated_at commit together",
        async () => {
          await activateRun(
            pool,
            succeededRunB,
          );

          const result =
            await pool.query<{
              readonly active_sync_run_id:
                string | null;
              readonly activated_at:
                Date | null;
            }>(
              `
                SELECT
                  s.active_sync_run_id,
                  r.activated_at
                FROM app_state AS s
                JOIN sync_runs AS r
                  ON r.id =
                    s.active_sync_run_id
                WHERE s.singleton_id = 1
              `,
            );

          assert.equal(
            result.rows[0]
              ?.active_sync_run_id,
            succeededRunB,
          );

          assert.ok(
            result.rows[0]
              ?.activated_at,
          );
        },
      );
    } finally {
      try {
        await resetPublicSchema(pool);
      } finally {
        await pool.end();
      }
    }
  },
);
