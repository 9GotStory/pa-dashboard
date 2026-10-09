import assert from "node:assert/strict";

import test from "node:test";

import {
  Pool,
} from "pg";

import {
  runMigrations,
} from "../src/db/migrate.js";

import {
  buildApp,
} from "../src/app.js";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL?.trim();

const skipReason =
  testDatabaseUrl === undefined ||
  testDatabaseUrl.length === 0
    ? "TEST_DATABASE_URL not set; runtime proof deferred to authorized local PostgreSQL 18"
    : false;

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

async function insertSyncRun(
  pool: Pool,
  options: {
    readonly status:
      | "succeeded"
      | "failed";
    readonly startedAt: Date;
    readonly finishedAt: Date;
    readonly errorSummary:
      | string
      | null;
    readonly configSnapshot?:
      Readonly<Record<string, unknown>>;
  },
): Promise<string> {
  const expected = 1;
  const completed =
    options.status === "succeeded"
      ? 1
      : 0;
  const failed =
    options.status === "succeeded"
      ? 0
      : 1;

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
          finished_at,
          error_summary
        )
        VALUES (
          $1,
          '54',
          2569,
          4,
          $2,
          $3,
          $4,
          $5::JSONB,
          $6,
          $7,
          $8::JSONB
        )
        RETURNING id
      `,
      [
        options.status,
        expected,
        completed,
        failed,
        JSON.stringify(
          options.configSnapshot ?? {},
        ),
        options.startedAt,
        options.finishedAt,
        options.errorSummary,
      ],
    );

  const id = result.rows[0]?.id;

  assert.ok(id);

  return id;
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

async function insertReferenceDataset(
  pool: Pool,
): Promise<void> {
  await pool.query(`
    INSERT INTO tambons (
      id,
      district_id,
      name_th,
      zip_code,
      metadata,
      updated_at
    )
    VALUES
      (
        '540602',
        '5406',
        'บ้านกลาง',
        '53110',
        '{"source":"tambon_master"}'::JSONB,
        NOW()
      ),
      (
        '540601',
        '5406',
        'บ้านหนุน',
        '53110',
        '{"source":"tambon_master"}'::JSONB,
        NOW()
      )
  `);

  await pool.query(`
    INSERT INTO facilities (
      hospcode,
      hospname,
      tambon_id,
      metadata,
      updated_at
    )
    VALUES
      (
        '10702',
        'โรงพยาบาลท่าวังทอง',
        '540602',
        '{"source":"hospital_master"}'::JSONB,
        NOW()
      ),
      (
        '06413',
        'บ้านหนุน',
        '540601',
        '{"source":"hospital_master"}'::JSONB,
        NOW()
      )
  `);
}

async function insertSourceRecord(
  pool: Pool,
  options: {
    readonly syncRunId: string;
    readonly sourceSequence: number;
    readonly dateCom: string | null;
  },
): Promise<void> {
  await pool.query(
    `
      INSERT INTO source_records (
        sync_run_id,
        source_name,
        source_sequence,
        hospcode,
        areacode,
        date_com,
        b_year,
        target,
        result,
        raw_payload
      )
      VALUES (
        $1,
        'ci_source',
        $2,
        NULL,
        '54060101',
        $3,
        2569,
        NULL,
        NULL,
        '{}'::JSONB
      )
    `,
    [
      options.syncRunId,
      options.sourceSequence,
      options.dateCom,
    ],
  );
}

async function insertKpiResult(
  pool: Pool,
  options: {
    readonly syncRunId: string;
    readonly kpiKey: string;
    readonly periodCode: string;
    readonly areacode: string | null;
    readonly hospcode: string | null;
    readonly target: string;
    readonly result: string;
  },
): Promise<string> {
  const definition =
    await pool.query<{
      readonly id: string;
    }>(
      `
        SELECT id
        FROM kpi_definitions
        WHERE kpi_key = $1
      `,
      [
        options.kpiKey,
      ],
    );

  const definitionId =
    definition.rows[0]?.id;

  assert.ok(definitionId);

  const inserted =
    await pool.query<{
      readonly id: string;
    }>(
      `
        INSERT INTO kpi_results (
          sync_run_id,
          kpi_definition_id,
          fiscal_year,
          period_code,
          areacode,
          hospcode,
          target,
          result,
          details,
          calculated_at
        )
        VALUES (
          $1,
          $2,
          2569,
          $3,
          $4,
          $5,
          $6,
          $7,
          '{}'::JSONB,
          NOW()
        )
        RETURNING id
      `,
      [
        options.syncRunId,
        definitionId,
        options.periodCode,
        options.areacode,
        options.hospcode,
        options.target,
        options.result,
      ],
    );

  const id = inserted.rows[0]?.id;

  assert.ok(id);

  return id;
}

interface PublicKpiItem {
  readonly key: string;
  readonly title: string;
  readonly target: number | null;
  readonly order: number;
  readonly link: string | null;
  readonly categoryCode: string;
  readonly category: string;
  readonly categoryOrder: number;
  readonly subgroup: string | null;
  readonly isQuarterly: boolean;
  readonly targetMonths: number | null;
  readonly effectiveQuarter: number | null;
}

const PUBLIC_KPI_KEYS = [
  "category",
  "categoryCode",
  "categoryOrder",
  "effectiveQuarter",
  "isQuarterly",
  "key",
  "link",
  "order",
  "subgroup",
  "target",
  "targetMonths",
  "title",
] as const;

test(
  "PostgreSQL 18 read API contract",
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

    let app:
      | ReturnType<
        typeof buildApp
      >
      | undefined;

    let destructiveSchemaMutationStarted =
      false;

    try {
      const versionResult =
        await pool.query<{
          readonly server_version_num:
            string;
        }>(
          `
            SHOW server_version_num
          `,
        );

      const version =
        versionResult.rows[0]
          ?.server_version_num;

      assert.ok(version);

      assert.match(
        version,
        /^18\d{4}$/,
        "PostgreSQL 18 is required before destructive test setup",
      );

      await t.test(
        "runtime is PostgreSQL major 18",
        async () => {
          assert.match(
            version,
            /^18\d{4}$/,
          );
        },
      );

      destructiveSchemaMutationStarted =
        true;

      await resetPublicSchema(pool);

      const fastify =
        buildApp({
          db: pool,
        });

      app = fastify;

      await t.test(
        "canonical migrations apply cleanly",
        async () => {
          const summary =
            await runMigrations(
              pool,
            );

          assert.deepEqual(
            summary.applied,
            [
              "0001",
              "0002",
              "0003",
              "0004",
              "0005",
            ],
          );

          assert.deepEqual(
            summary.skipped,
            [],
          );
        },
      );

      await t.test(
        "sync status reports no history after clean migrations",
        async () => {
          const response =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/sync-status",
            });

          assert.equal(
            response.statusCode,
            200,
          );

          assert.deepEqual(
            response.json(),
            {
              activeSyncRunId:
                null,
              latestRun: null,
            },
          );
        },
      );

      await t.test(
        "dashboard returns the normal empty state before dataset activation",

        async () => {
          const response =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/dashboard",
            });

          assert.equal(
            response.statusCode,
            200,
          );

          assert.deepEqual(
            response.json(),
            {
              dataset: null,
              results: [],
            },
          );
        },
      );

      await t.test(
        "reference read API returns empty catalogs before population",

        async () => {
          const facilitiesResponse =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/facilities",
            });

          assert.equal(
            facilitiesResponse
              .statusCode,
            200,
          );

          assert.deepEqual(
            facilitiesResponse.json(),
            {
              facilities: [],
            },
          );

          const tambonsResponse =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/tambons",
            });

          assert.equal(
            tambonsResponse
              .statusCode,
            200,
          );

          assert.deepEqual(
            tambonsResponse.json(),
            {
              tambons: [],
            },
          );
        },
      );

      await insertReferenceDataset(
        pool,
      );

      await t.test(
        "reference read API exposes only public reference fields in deterministic order",

        async () => {
          const tambonsResponse =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/tambons",
            });

          assert.equal(
            tambonsResponse
              .statusCode,
            200,
          );

          assert.deepEqual(
            tambonsResponse.json(),
            {
              tambons: [
                {
                  id: "540601",
                  nameTh:
                    "บ้านหนุน",
                },
                {
                  id: "540602",
                  nameTh:
                    "บ้านกลาง",
                },
              ],
            },
          );

          for (
            const privateFragment
            of [
              "name_th",
              "district_id",
              "districtId",
              "zip_code",
              "zipCode",
              "metadata",
              "updated_at",
              "updatedAt",
            ]
          ) {
            assert.equal(
              tambonsResponse.body.includes(
                privateFragment,
              ),
              false,
              `Tambon payload must not expose: ${privateFragment}`,
            );
          }

          const facilitiesResponse =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/facilities",
            });

          assert.equal(
            facilitiesResponse
              .statusCode,
            200,
          );

          assert.deepEqual(
            facilitiesResponse.json(),
            {
              facilities: [
                {
                  hospcode:
                    "06413",
                  hospname:
                    "บ้านหนุน",
                  tambonId:
                    "540601",
                },
                {
                  hospcode:
                    "10702",
                  hospname:
                    "โรงพยาบาลท่าวังทอง",
                  tambonId:
                    "540602",
                },
              ],
            },
          );

          for (
            const privateFragment
            of [
              "tambon_id",
              "metadata",
              "updated_at",
              "updatedAt",
            ]
          ) {
            assert.equal(
              facilitiesResponse.body.includes(
                privateFragment,
              ),
              false,
              `Facility payload must not expose: ${privateFragment}`,
            );
          }
        },
      );

      await t.test(
        "reference read API fails closed on a facility row without tambon linkage",

        async () => {
          await pool.query(`
            INSERT INTO facilities (
              hospcode,
              hospname,
              tambon_id,
              metadata,
              updated_at
            )
            VALUES (
              '99999',
              'แถวข้อมูลทดสอบไร้ตำบล',
              NULL,
              '{}'::JSONB,
              NOW()
            )
          `);

          try {
            const response =
              await fastify.inject({
                method: "GET",
                url: "/api/v1/facilities",
              });

            assert.equal(
              response.statusCode,
              503,
            );

            assert.equal(
              response.body,
              '{"error":"service_unavailable"}',
            );
          } finally {
            await pool.query(`
              DELETE FROM facilities
              WHERE hospcode = '99999'
            `);
          }

          const recovered =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/facilities",
            });

          assert.equal(
            recovered.statusCode,
            200,
          );

          assert.deepEqual(
            recovered.json(),
            {
              facilities: [
                {
                  hospcode:
                    "06413",
                  hospname:
                    "บ้านหนุน",
                  tambonId:
                    "540601",
                },
                {
                  hospcode:
                    "10702",
                  hospname:
                    "โรงพยาบาลท่าวังทอง",
                  tambonId:
                    "540602",
                },
              ],
            },
          );
        },
      );

      await t.test(
        "KPI catalog exposes exactly the public registry",

        async () => {
          const response =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/kpis",
            });

          assert.equal(
            response.statusCode,
            200,
          );

          const body =
            response.json() as {
              readonly kpis:
                readonly PublicKpiItem[];
            };

          const kpis = body.kpis;

          assert.equal(
            kpis.length,
            47,
          );

          const keys =
            new Set(
              kpis.map(
                (kpi) => kpi.key,
              ),
            );

          for (
            const sourceOnlyKey
            of [
              "s_epi1",
              "s_epi2",
              "s_epi3",
              "s_epi5",
              "s_epi_complete",
            ]
          ) {
            assert.equal(
              keys.has(
                sourceOnlyKey,
              ),
              false,
              `Source-only key must stay private: ${sourceOnlyKey}`,
            );
          }

          assert.equal(
            keys.has(
              "s_kpi_anc12",
            ),
            true,
          );

          assert.equal(
            keys.has(
              "s_epi1__bcg",
            ),
            true,
          );

          assert.equal(
            keys.has(
              "s_epi_complete__5y",
            ),
            true,
          );

          for (
            const pcvKey
            of [
              "s_epi1__pcv1",
              "s_epi1__pcv2",
              "s_epi1__pcv3",
              "s_epi2__pcv4",
            ]
          ) {
            const pcv =
              kpis.find(
                (kpi) =>
                  kpi.key ===
                  pcvKey,
              );

            assert.ok(
              pcv,
              `Missing PCV KPI: ${pcvKey}`,
            );

            assert.equal(
              pcv.target,
              95,
            );

            assert.equal(
              typeof pcv.target,
              "number",
            );
          }

          const childdev4 =
            kpis.find(
              (kpi) =>
                kpi.key ===
                "s_kpi_childdev4",
            );

          assert.ok(
            childdev4,
          );

          assert.equal(
            childdev4.targetMonths,
            9,
          );

          assert.equal(
            childdev4.effectiveQuarter,
            3,
          );

          for (
            const kpi
            of kpis
          ) {
            assert.deepEqual(
              Object.keys(
                kpi,
              ).sort(),
              [...PUBLIC_KPI_KEYS],
            );
          }

          assert.equal(
            kpis[0]?.key,
            "s_kpi_anc12",
          );

          assert.equal(
            kpis[46]?.key,
            "s_epi_complete__5y",
          );
        },
      );

      await t.test(
        "live registry catalog rejects invalid percentage targets before activation",

        async () => {
          const original = await pool.query<{
            readonly target_value: string | null;
          }>(`
            SELECT target_value::TEXT AS target_value
            FROM kpi_definitions
            WHERE kpi_key = 's_kpi_anc12'
          `);
          assert.equal(original.rows.length, 1);

          try {
            for (const scenario of [
              { value: null, expected: null },
              { value: "0", expected: 0 },
              { value: "100", expected: 100 },
              { value: "-5", expected: undefined },
              { value: "150", expected: undefined },
            ]) {
              await pool.query(
                `
                  UPDATE kpi_definitions
                  SET target_value = $1::NUMERIC
                  WHERE kpi_key = 's_kpi_anc12'
                `,
                [scenario.value],
              );

              const response = await fastify.inject({
                method: "GET",
                url: "/api/v1/kpis",
              });

              if (scenario.expected === undefined) {
                assert.equal(response.statusCode, 503);
                assert.equal(
                  response.body,
                  '{"error":"service_unavailable"}',
                );
              } else {
                assert.equal(response.statusCode, 200);
                const catalog = response.json() as {
                  readonly kpis: readonly PublicKpiItem[];
                };
                const entry = catalog.kpis.find(
                  (item) => item.key === "s_kpi_anc12",
                );
                assert.ok(entry);
                assert.equal(entry.target, scenario.expected);
              }
            }
          } finally {
            await pool.query(
              `
                UPDATE kpi_definitions
                SET target_value = $1::NUMERIC
                WHERE kpi_key = 's_kpi_anc12'
              `,
              [original.rows[0]?.target_value],
            );
          }
        },
      );

      await t.test(
        "pre-activation KPI catalog preserves valid month and quarter metadata",

        async () => {
          const baseline = await pool.query<{
            readonly target_months: number | null;
            readonly effective_quarter: number | null;
          }>(`
            SELECT target_months, effective_quarter
            FROM kpi_definitions
            WHERE kpi_key = 's_kpi_anc12'
          `);
          assert.equal(baseline.rows.length, 1);
          try {
            await pool.query(`
              UPDATE kpi_definitions
              SET target_months = 8,
                  effective_quarter = 4
              WHERE kpi_key = 's_kpi_anc12'
            `);
            const response = await fastify.inject({
              method: "GET",
              url: "/api/v1/kpis",
            });
            assert.equal(response.statusCode, 200);
            const body = response.json() as {
              readonly kpis: readonly PublicKpiItem[];
            };
            const kpi = body.kpis.find(
              (item) => item.key === "s_kpi_anc12",
            );
            assert.ok(kpi);
            assert.equal(kpi.targetMonths, 8);
            assert.equal(kpi.effectiveQuarter, 4);
          } finally {
            await pool.query(
              `
                UPDATE kpi_definitions
                SET target_months = $1,
                    effective_quarter = $2
                WHERE kpi_key = 's_kpi_anc12'
              `,
              [
                baseline.rows[0]?.target_months,
                baseline.rows[0]?.effective_quarter,
              ],
            );
          }
        },
      );

      await t.test(
        "sync status keeps the active dataset distinct from a newer failed run",

        async () => {
          const succeededRunId =
            await insertSyncRun(
              pool,
              {
                status:
                  "succeeded",
                startedAt:
                  new Date(
                    "2026-09-01T00:00:00.000Z",
                  ),
                finishedAt:
                  new Date(
                    "2026-09-01T00:05:00.000Z",
                  ),
                errorSummary:
                  null,
              },
            );

          await activateRun(
            pool,
            succeededRunId,
          );

          const internalSecret =
            "hunter2-moph-internal-token";

          const failedRunId =
            await insertSyncRun(
              pool,
              {
                status: "failed",
                startedAt:
                  new Date(
                    "2026-09-02T00:00:00.000Z",
                  ),
                finishedAt:
                  new Date(
                    "2026-09-02T00:05:00.000Z",
                  ),
                errorSummary:
                  JSON.stringify(
                    {
                      internal_secret:
                        internalSecret,
                    },
                  ),
              },
            );

          const response =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/sync-status",
            });

          assert.equal(
            response.statusCode,
            200,
          );

          assert.deepEqual(
            response.json(),
            {
              activeSyncRunId:
                succeededRunId,
              latestRun: {
                id: failedRunId,
                status: "failed",
                fiscalYear:
                  2569,
                currentQuarter:
                  4,
                expectedSourceCount:
                  1,
                completedSourceCount:
                  0,
                failedSourceCount:
                  1,
                startedAt:
                  "2026-09-02T00:00:00.000Z",
                finishedAt:
                  "2026-09-02T00:05:00.000Z",
                activatedAt:
                  null,
              },
            },
          );

          assert.equal(
            response.body.includes(
              "error_summary",
            ),
            false,
          );

          assert.equal(
            response.body.includes(
              internalSecret,
            ),
            false,
          );
        },
      );

      const activeSemanticRows =
        await pool.query<{
          readonly id: string;
          readonly kpi_key: string;
          readonly target_value:
            string | null;
          readonly is_quarterly:
            boolean;
          readonly target_months:
            number | null;
          readonly effective_quarter:
            number | null;
        }>(
          `
            SELECT
              id::TEXT AS id,
              kpi_key,
              target_value::TEXT
                AS target_value,
              is_quarterly,
              target_months,
              effective_quarter
            FROM kpi_definitions
            WHERE kpi_key = ANY(
              $1::TEXT[]
            )
            ORDER BY kpi_key
          `,
          [[
            "s_anc5",
            "s_kpi_anc12",
            "s_kpi_food",
          ]],
        );

      assert.equal(
        activeSemanticRows
          .rows.length,
        3,
      );

      const activeRunConfigSnapshot = {
        definitions:
          activeSemanticRows.rows.map(
            (row) => ({
              id: row.id,
              kpiKey:
                row.kpi_key,
              targetValue:
                row.target_value === null
                  ? null
                  : Number(
                      row.target_value,
                    ),
              isQuarterly:
                row.is_quarterly,
              targetMonths:
                row.target_months,
              effectiveQuarter:
                row.effective_quarter,
            }),
          ),
      };

      const activeRunId =
        await insertSyncRun(
          pool,
          {
            status: "succeeded",
            startedAt:
              new Date(
                "2026-09-20T00:00:00.000Z",
              ),
            finishedAt:
              new Date(
                "2026-09-20T00:05:00.000Z",
              ),
            errorSummary: null,
            configSnapshot:
              activeRunConfigSnapshot,
          },
        );

      await activateRun(
        pool,
        activeRunId,
      );

      const activatedAtResult =
        await pool.query<{
          readonly activated_at: Date;
        }>(
          `
            SELECT activated_at
            FROM sync_runs
            WHERE id = $1
          `,
          [
            activeRunId,
          ],
        );

      const activatedAt =
        activatedAtResult.rows[0]
          ?.activated_at;

      assert.ok(activatedAt);

      await t.test(
        "dashboard fails closed while the active dataset has zero KPI results",

        async () => {
          const response =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/dashboard",
            });

          assert.equal(
            response.statusCode,
            503,
          );

          assert.equal(
            response.body,
            '{"error":"service_unavailable"}',
          );
        },
      );

      // KPI results for the active run, inserted in reverse of
      // the deterministic public order.
      await insertKpiResult(pool, {
        syncRunId: activeRunId,
        kpiKey: "s_kpi_food",
        periodCode: "q2",
        areacode: "54060101",
        hospcode: "06413",
        target: "50",
        result: "25",
      });

      await insertKpiResult(pool, {
        syncRunId: activeRunId,
        kpiKey: "s_anc5",
        periodCode: "q1",
        areacode: "54060101",
        hospcode: null,
        target: "75",
        result: "60.5",
      });

      await insertKpiResult(pool, {
        syncRunId: activeRunId,
        kpiKey: "s_kpi_anc12",
        periodCode: "q2",
        areacode: "54060102",
        hospcode: "10702",
        target: "100",
        result: "82",
      });

      await insertKpiResult(pool, {
        syncRunId: activeRunId,
        kpiKey: "s_kpi_anc12",
        periodCode: "q2",
        areacode: "54060101",
        hospcode: "06413",
        target: "100",
        result: "81",
      });

      await insertKpiResult(pool, {
        syncRunId: activeRunId,
        kpiKey: "s_kpi_anc12",
        periodCode: "q2",
        areacode: "54060101",
        hospcode: null,
        target: "100",
        result: "80",
      });

      await insertKpiResult(pool, {
        syncRunId: activeRunId,
        kpiKey: "s_kpi_anc12",
        periodCode: "annual",
        areacode: "54060101",
        hospcode: null,
        target: "100",
        result: "80",
      });

      const expectedDashboardDataset = {
        syncRunId: activeRunId,
        fiscalYear: 2569,
        currentQuarter: 4,
        activatedAt:
          activatedAt.toISOString(),
      };

      const expectedDashboardResults = [
        {
          kpiKey: "s_kpi_anc12",
          periodCode: "annual",
          areacode: "54060101",
          hospcode: null,
          target: 100,
          result: 80,
        },
        {
          kpiKey: "s_kpi_anc12",
          periodCode: "q2",
          areacode: "54060101",
          hospcode: null,
          target: 100,
          result: 80,
        },
        {
          kpiKey: "s_kpi_anc12",
          periodCode: "q2",
          areacode: "54060101",
          hospcode: "06413",
          target: 100,
          result: 81,
        },
        {
          kpiKey: "s_kpi_anc12",
          periodCode: "q2",
          areacode: "54060102",
          hospcode: "10702",
          target: 100,
          result: 82,
        },
        {
          kpiKey: "s_anc5",
          periodCode: "q1",
          areacode: "54060101",
          hospcode: null,
          target: 75,
          result: 60.5,
        },
        {
          kpiKey: "s_kpi_food",
          periodCode: "q2",
          areacode: "54060101",
          hospcode: "06413",
          target: 50,
          result: 25,
        },
      ];

      await t.test(
        "dashboard exposes the active dataset with null freshness before source records exist",

        async () => {
          const response =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/dashboard",
            });

          assert.equal(
            response.statusCode,
            200,
          );

          assert.deepEqual(
            response.json(),
            {
              dataset: {
                ...expectedDashboardDataset,
                sourceLastUpdated:
                  null,
              },
              results:
                expectedDashboardResults,
            },
          );
        },
      );

      const newerSucceededRunId =
        await insertSyncRun(
          pool,
          {
            status: "succeeded",
            startedAt:
              new Date(
                "2026-09-21T00:00:00.000Z",
              ),
            finishedAt:
              new Date(
                "2026-09-21T00:05:00.000Z",
              ),
            errorSummary: null,
          },
        );

      const dashboardInternalSecret =
        "hunter2-dashboard-internal-token";

      const newerFailedRunId =
        await insertSyncRun(
          pool,
          {
            status: "failed",
            startedAt:
              new Date(
                "2026-09-22T00:00:00.000Z",
              ),
            finishedAt:
              new Date(
                "2026-09-22T00:05:00.000Z",
              ),
            errorSummary:
              JSON.stringify({
                internal_secret:
                  dashboardInternalSecret,
              }),
          },
        );

      await insertKpiResult(pool, {
        syncRunId:
          newerSucceededRunId,
        kpiKey: "s_kpi_anc12",
        periodCode: "q2",
        areacode: "54060101",
        hospcode: null,
        target: "999",
        result: "999",
      });

      await insertKpiResult(pool, {
        syncRunId: newerFailedRunId,
        kpiKey: "s_kpi_anc12",
        periodCode: "q2",
        areacode: "54060101",
        hospcode: null,
        target: "888",
        result: "888",
      });

      // Only some active-run markers match the accepted
      // freshness formats; the rest must be ignored.
      await insertSourceRecord(pool, {
        syncRunId: activeRunId,
        sourceSequence: 1,
        dateCom: "20260925120000",
      });

      await insertSourceRecord(pool, {
        syncRunId: activeRunId,
        sourceSequence: 2,
        dateCom: "20260926",
      });

      await insertSourceRecord(pool, {
        syncRunId: activeRunId,
        sourceSequence: 3,
        dateCom: "202609261230",
      });

      await insertSourceRecord(pool, {
        syncRunId: activeRunId,
        sourceSequence: 4,
        dateCom: "2026092612304",
      });

      await insertSourceRecord(pool, {
        syncRunId: activeRunId,
        sourceSequence: 5,
        dateCom: "20260926123045",
      });

      await insertSourceRecord(pool, {
        syncRunId: activeRunId,
        sourceSequence: 6,
        dateCom: null,
      });

      await insertSourceRecord(pool, {
        syncRunId: activeRunId,
        sourceSequence: 7,
        dateCom: "2026092612ab",
      });

      // Non-active runs carry markers that would win if
      // freshness were not restricted to the active run.
      await insertSourceRecord(pool, {
        syncRunId: newerSucceededRunId,
        sourceSequence: 1,
        dateCom: "20260927999999",
      });

      await insertSourceRecord(pool, {
        syncRunId: newerFailedRunId,
        sourceSequence: 1,
        dateCom: "99999999999999",
      });

      await t.test(
        "dashboard derives freshness and results only from the active run",

        async () => {
          const response =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/dashboard",
            });

          assert.equal(
            response.statusCode,
            200,
          );

          assert.deepEqual(
            response.json(),
            {
              dataset: {
                ...expectedDashboardDataset,
                sourceLastUpdated:
                  "20260926123045",
              },
              results:
                expectedDashboardResults,
            },
          );

          assert.equal(
            response.body.includes(
              "999",
            ),
            false,
          );

          assert.equal(
            response.body.includes(
              "888",
            ),
            false,
          );

          assert.equal(
            response.body.includes(
              dashboardInternalSecret,
            ),
            false,
          );
        },
      );

      await t.test(
        "KPI catalog membership follows the active dataset despite registry visibility drift",

        async () => {
          const readKeys =
            async (): Promise<string[]> => {
              const response =
                await fastify.inject({
                  method: "GET",
                  url: "/api/v1/kpis",
                });

              assert.equal(
                response.statusCode,
                200,
              );

              return (
                response.json() as {
                  readonly kpis:
                    readonly PublicKpiItem[];
                }
              ).kpis.map(
                (kpi) => kpi.key,
              );
            };

          const expectedKeys = [
            "s_kpi_anc12",
            "s_anc5",
            "s_kpi_food",
          ];

          assert.deepEqual(
            await readKeys(),
            expectedKeys,
          );

          try {
            await pool.query(
              `
                UPDATE kpi_definitions
                SET is_active = FALSE
                WHERE kpi_key = 's_anc5'
              `,
            );

            await pool.query(
              `
                UPDATE kpi_definitions
                SET metadata =
                  metadata
                    || '{"source_only":true}'::JSONB
                WHERE kpi_key = 's_kpi_food'
              `,
            );

            assert.deepEqual(
              await readKeys(),
              expectedKeys,
            );

            const dashboardResponse =
              await fastify.inject({
                method: "GET",
                url: "/api/v1/dashboard",
              });

            assert.equal(
              dashboardResponse.statusCode,
              200,
            );

            const dashboardKeys =
              new Set(
                (
                  dashboardResponse.json() as {
                    readonly results:
                      readonly {
                        readonly kpiKey:
                          string;
                      }[];
                  }
                ).results.map(
                  (row) =>
                    row.kpiKey,
                ),
              );

            assert.deepEqual(
              [...dashboardKeys],
              expectedKeys,
            );
          } finally {
            await pool.query(
              `
                UPDATE kpi_definitions
                SET is_active = TRUE
                WHERE kpi_key = 's_anc5'
              `,
            );

            await pool.query(
              `
                UPDATE kpi_definitions
                SET metadata =
                  metadata - 'source_only'
                WHERE kpi_key = 's_kpi_food'
              `,
            );
          }
        },
      );

      await t.test(
        "KPI catalog preserves active-run semantics while descriptive metadata stays live",

        async () => {
          const readAnc12 =
            async (): Promise<PublicKpiItem> => {
              const response =
                await fastify.inject({
                  method: "GET",
                  url: "/api/v1/kpis",
                });

              assert.equal(
                response.statusCode,
                200,
              );

              const kpi =
                (
                  response.json() as {
                    readonly kpis:
                      readonly PublicKpiItem[];
                  }
                ).kpis.find(
                  (item) =>
                    item.key ===
                    "s_kpi_anc12",
                );

              assert.ok(kpi);

              return kpi;
            };

          const baseline =
            await readAnc12();

          const editedTitle =
            `${baseline.title} (live metadata edit)`;

          const editedTarget =
            baseline.target === 42
              ? 43
              : 42;

          const editedTargetMonths =
            baseline.targetMonths === 2
              ? 3
              : 2;

          const editedEffectiveQuarter =
            baseline.effectiveQuarter === 1
              ? 2
              : 1;

          try {
            await pool.query(
              `
                UPDATE kpi_definitions
                SET
                  title = $2,
                  target_value = $3,
                  is_quarterly = $4,
                  target_months = $5,
                  effective_quarter = $6
                WHERE kpi_key = $1
              `,
              [
                "s_kpi_anc12",
                editedTitle,
                editedTarget,
                !baseline.isQuarterly,
                editedTargetMonths,
                editedEffectiveQuarter,
              ],
            );

            const afterDrift =
              await readAnc12();

            assert.equal(
              afterDrift.title,
              editedTitle,
            );

            assert.equal(
              afterDrift.target,
              baseline.target,
            );

            assert.equal(
              afterDrift.isQuarterly,
              baseline.isQuarterly,
            );

            assert.equal(
              afterDrift.targetMonths,
              baseline.targetMonths,
            );

            assert.equal(
              afterDrift.effectiveQuarter,
              baseline.effectiveQuarter,
            );
          } finally {
            await pool.query(
              `
                UPDATE kpi_definitions
                SET
                  title = $2,
                  target_value = $3,
                  is_quarterly = $4,
                  target_months = $5,
                  effective_quarter = $6
                WHERE kpi_key = $1
              `,
              [
                "s_kpi_anc12",
                baseline.title,
                baseline.target,
                baseline.isQuarterly,
                baseline.targetMonths,
                baseline.effectiveQuarter,
              ],
            );
          }
        },
      );

      await t.test(
        "active dataset preserves KPI key identity after registry rename",

        async () => {
          const originalKey =
            "s_kpi_anc12";
          const renamedKey =
            "s_kpi_anc12__renamed_after_activation";

          const readCatalogKeys =
            async (): Promise<string[]> => {
              const response =
                await fastify.inject({
                  method: "GET",
                  url: "/api/v1/kpis",
                });

              assert.equal(
                response.statusCode,
                200,
              );

              return (
                response.json() as {
                  readonly kpis:
                    readonly PublicKpiItem[];
                }
              ).kpis.map(
                (kpi) => kpi.key,
              );
            };

          const readDashboardKeys =
            async (): Promise<string[]> => {
              const response =
                await fastify.inject({
                  method: "GET",
                  url: "/api/v1/dashboard",
                });

              assert.equal(
                response.statusCode,
                200,
              );

              return [
                ...new Set(
                  (
                    response.json() as {
                      readonly results:
                        readonly {
                          readonly kpiKey:
                            string;
                        }[];
                    }
                  ).results.map(
                    (row) =>
                      row.kpiKey,
                  ),
                ),
              ];
            };

          const expectedKeys = [
            originalKey,
            "s_anc5",
            "s_kpi_food",
          ];

          assert.deepEqual(
            await readCatalogKeys(),
            expectedKeys,
          );

          assert.deepEqual(
            await readDashboardKeys(),
            expectedKeys,
          );

          try {
            await pool.query(
              `
                UPDATE kpi_definitions
                SET kpi_key = $2
                WHERE kpi_key = $1
              `,
              [
                originalKey,
                renamedKey,
              ],
            );

            const liveRegistry =
              await pool.query<{
                readonly kpi_key: string;
              }>(
                `
                  SELECT kpi_key
                  FROM kpi_definitions
                  WHERE kpi_key = $1
                `,
                [
                  renamedKey,
                ],
              );

            assert.equal(
              liveRegistry.rows[0]
                ?.kpi_key,
              renamedKey,
            );

            assert.deepEqual(
              await readCatalogKeys(),
              expectedKeys,
            );

            assert.deepEqual(
              await readDashboardKeys(),
              expectedKeys,
            );
          } finally {
            await pool.query(
              `
                UPDATE kpi_definitions
                SET kpi_key = $2
                WHERE kpi_key = $1
              `,
              [
                renamedKey,
                originalKey,
              ],
            );
          }
        },
      );

      // Snapshots are immutable after creation (migration 0002).
      // Exercise corrupted historical evidence via a distinct, newly
      // inserted succeeded run rather than mutating an active run.
      async function withActiveSnapshot(
        configSnapshot: Readonly<Record<string, unknown>>,
        inspect: () => Promise<void>,
      ): Promise<void> {
        const fixtureRunId = await insertSyncRun(
          pool,
          {
            status: "succeeded",
            startedAt: new Date("2026-09-20T00:10:00.000Z"),
            finishedAt: new Date("2026-09-20T00:15:00.000Z"),
            errorSummary: null,
            configSnapshot,
          },
        );

        try {
          await pool.query(
            `
              INSERT INTO kpi_results (
                sync_run_id,
                kpi_definition_id,
                fiscal_year,
                period_code,
                areacode,
                hospcode,
                target,
                result,
                details,
                calculated_at
              )
              SELECT
                $2::BIGINT,
                kpi_definition_id,
                fiscal_year,
                period_code,
                areacode,
                hospcode,
                target,
                result,
                details,
                calculated_at
              FROM kpi_results
              WHERE sync_run_id = $1::BIGINT
            `,
            [activeRunId, fixtureRunId],
          );

          await activateRun(pool, fixtureRunId);

          await inspect();
        } finally {
          // Restore the originally activated dataset before deleting
          // the temporary run. This does not modify either snapshot.
          await pool.query(
            `
              UPDATE app_state
              SET active_sync_run_id = $1,
                  updated_at = NOW()
              WHERE singleton_id = 1
            `,
            [activeRunId],
          );
          await pool.query(
            "DELETE FROM sync_runs WHERE id = $1",
            [fixtureRunId],
          );
        }
      }

      async function assertActiveSnapshotUnavailable(
        configSnapshot: Readonly<Record<string, unknown>>,
      ): Promise<void> {
        await withActiveSnapshot(configSnapshot, async () => {
          for (const url of [
            "/api/v1/kpis",
            "/api/v1/dashboard",
          ]) {
            const response = await fastify.inject({
              method: "GET",
              url,
            });

            assert.equal(
              response.statusCode,
              503,
              `Expected fail-closed response from ${url}`,
            );
            assert.equal(
              response.body,
              '{"error":"service_unavailable"}',
            );
          }
        });
      }

      await t.test(
        "active dataset fails closed when a KPI snapshot definition is missing",
        async () => {
          await assertActiveSnapshotUnavailable({
            definitions: activeRunConfigSnapshot.definitions.filter(
              (definition) =>
                definition.kpiKey !== "s_kpi_anc12",
            ),
          });
        },
      );

      await t.test(
        "active dataset fails closed when a KPI snapshot definition is duplicated",
        async () => {
          const originalDefinition =
            activeRunConfigSnapshot.definitions.find(
              (definition) =>
                definition.kpiKey === "s_kpi_anc12",
            );

          assert.ok(originalDefinition);

          await assertActiveSnapshotUnavailable({
            definitions: [
              ...activeRunConfigSnapshot.definitions,
              {
                ...originalDefinition,
                kpiKey: "s_kpi_anc12__conflicting_duplicate",
              },
            ],
          });
        },
      );

      for (const scenario of [
        {
          name: "two different snapshotted IDs share one machine key",
          definitions: activeRunConfigSnapshot.definitions.map(
            (definition) =>
              definition.kpiKey === "s_anc5"
                ? {
                    ...definition,
                    kpiKey: "s_kpi_anc12",
                  }
                : definition,
          ),
        },
        {
          name: "snapshotted key collides with legacy live-key fallback",
          definitions: activeRunConfigSnapshot.definitions.map(
            (definition) =>
              definition.kpiKey === "s_anc5"
                ? {
                    ...definition,
                    kpiKey: undefined,
                  }
                : definition.kpiKey === "s_kpi_anc12"
                  ? {
                      ...definition,
                      kpiKey: "s_anc5",
                    }
                  : definition,
          ),
        },
      ]) {
        await t.test(
          `active dataset rejects machine-key collision: ${scenario.name}`,
          async () => {
            await assertActiveSnapshotUnavailable({
              definitions: scenario.definitions,
            });
          },
        );
      }

      await t.test(
        "frozen valid target survives invalid live registry drift",

        async () => {
          const original = await pool.query<{
            readonly target_value: string | null;
          }>(`
            SELECT target_value::TEXT AS target_value
            FROM kpi_definitions
            WHERE kpi_key = 's_kpi_anc12'
          `);
          assert.equal(original.rows.length, 1);

          const validSnapshot = {
            definitions: activeRunConfigSnapshot.definitions.map(
              (definition) =>
                definition.kpiKey === "s_kpi_anc12"
                  ? { ...definition, targetValue: 0 }
                  : definition,
            ),
          };

          await withActiveSnapshot(validSnapshot, async () => {
            try {
              await pool.query(
                `
                  UPDATE kpi_definitions
                  SET target_value = 150
                  WHERE kpi_key = 's_kpi_anc12'
                `,
              );

              const response = await fastify.inject({
                method: "GET",
                url: "/api/v1/kpis",
              });
              assert.equal(response.statusCode, 200);
              const catalog = response.json() as {
                readonly kpis: readonly PublicKpiItem[];
              };
              const entry = catalog.kpis.find(
                (item) => item.key === "s_kpi_anc12",
              );
              assert.ok(entry);
              assert.equal(entry.target, 0);

              const dashboard = await fastify.inject({
                method: "GET",
                url: "/api/v1/dashboard",
              });
              assert.equal(dashboard.statusCode, 200);
            } finally {
              await pool.query(
                `
                  UPDATE kpi_definitions
                  SET target_value = $1::NUMERIC
                  WHERE kpi_key = 's_kpi_anc12'
                `,
                [original.rows[0]?.target_value],
              );
            }
          });
        },
      );

      for (const scenario of [
        { label: "negative", targetValue: -5 },
        { label: "above 100", targetValue: 150 },
      ]) {
        await t.test(
          `invalid frozen snapshot target: ${scenario.label}`,
          async () => {
            await withActiveSnapshot({
              definitions: activeRunConfigSnapshot.definitions.map(
                (definition) =>
                  definition.kpiKey === "s_kpi_anc12"
                    ? { ...definition, targetValue: scenario.targetValue }
                    : definition,
              ),
            }, async () => {
              const catalog = await fastify.inject({
                method: "GET",
                url: "/api/v1/kpis",
              });
              assert.equal(catalog.statusCode, 503);
              assert.equal(
                catalog.body,
                '{"error":"service_unavailable"}',
              );

              const dashboard = await fastify.inject({
                method: "GET",
                url: "/api/v1/dashboard",
              });
              assert.equal(
                dashboard.statusCode,
                200,
                "Dashboard raw-count endpoint is independent of percentage threshold",
              );
            });
          },
        );
      }

      await t.test(
        "legacy missing targetValue falls back to valid live target but rejects invalid live target",

        async () => {
          const original = await pool.query<{
            readonly target_value: string | null;
          }>(`
            SELECT target_value::TEXT AS target_value
            FROM kpi_definitions
            WHERE kpi_key = 's_kpi_anc12'
          `);
          assert.equal(original.rows.length, 1);

          const legacySnapshot = {
            definitions: activeRunConfigSnapshot.definitions.map(
              (definition) =>
                definition.kpiKey === "s_kpi_anc12"
                  ? { ...definition, targetValue: undefined }
                  : definition,
            ),
          };

          await withActiveSnapshot(legacySnapshot, async () => {
            try {
              for (const scenario of [
                { target: "85", expected: 85 },
                { target: "150", expected: undefined },
              ]) {
                await pool.query(
                  `
                    UPDATE kpi_definitions
                    SET target_value = $1::NUMERIC
                    WHERE kpi_key = 's_kpi_anc12'
                  `,
                  [scenario.target],
                );
                const response = await fastify.inject({
                  method: "GET",
                  url: "/api/v1/kpis",
                });
                if (scenario.expected === undefined) {
                  assert.equal(response.statusCode, 503);
                  assert.equal(
                    response.body,
                    '{"error":"service_unavailable"}',
                  );
                } else {
                  assert.equal(response.statusCode, 200);
                  const body = response.json() as {
                    readonly kpis: readonly PublicKpiItem[];
                  };
                  const entry = body.kpis.find(
                    (item) => item.key === "s_kpi_anc12",
                  );
                  assert.ok(entry);
                  assert.equal(entry.target, scenario.expected);
                }
              }
            } finally {
              await pool.query(
                `
                  UPDATE kpi_definitions
                  SET target_value = $1::NUMERIC
                  WHERE kpi_key = 's_kpi_anc12'
                `,
                [original.rows[0]?.target_value],
              );
            }
          });
        },
      );

      await t.test(
        "explicit null frozen target does not fall back to invalid live target",
        async () => {
          const original = await pool.query<{
            readonly target_value: string | null;
          }>(`
            SELECT target_value::TEXT AS target_value
            FROM kpi_definitions
            WHERE kpi_key = 's_kpi_anc12'
          `);
          assert.equal(original.rows.length, 1);

          await withActiveSnapshot({
            definitions: activeRunConfigSnapshot.definitions.map(
              (definition) =>
                definition.kpiKey === "s_kpi_anc12"
                  ? { ...definition, targetValue: null }
                  : definition,
            ),
          }, async () => {
            try {
              await pool.query(
                `
                  UPDATE kpi_definitions
                  SET target_value = -5
                  WHERE kpi_key = 's_kpi_anc12'
                `,
              );
              const response = await fastify.inject({
                method: "GET",
                url: "/api/v1/kpis",
              });
              assert.equal(response.statusCode, 200);
              const body = response.json() as {
                readonly kpis: readonly PublicKpiItem[];
              };
              const entry = body.kpis.find(
                (item) => item.key === "s_kpi_anc12",
              );
              assert.ok(entry);
              assert.equal(entry.target, null);
            } finally {
              await pool.query(
                `
                  UPDATE kpi_definitions
                  SET target_value = $1::NUMERIC
                  WHERE kpi_key = 's_kpi_anc12'
                `,
                [original.rows[0]?.target_value],
              );
            }
          });
        },
      );

      function snapshotWithPeriodFields(
        patch: {
          readonly targetMonths?: number | null | undefined;
          readonly effectiveQuarter?: number | null | undefined;
        },
      ): Readonly<Record<string, unknown>> {
        return {
          definitions: activeRunConfigSnapshot.definitions.map(
            (definition) =>
              definition.kpiKey === "s_kpi_anc12"
                ? { ...definition, ...patch }
                : definition,
          ),
        };
      }

      async function inspectActiveKpiPeriod(
        expected: {
          readonly targetMonths: number | null;
          readonly effectiveQuarter: number | null;
        },
      ): Promise<void> {
        const response = await fastify.inject({
          method: "GET",
          url: "/api/v1/kpis",
        });
        assert.equal(response.statusCode, 200);
        const catalog = response.json() as {
          readonly kpis: readonly PublicKpiItem[];
        };
        const entry = catalog.kpis.find(
          (item) => item.key === "s_kpi_anc12",
        );
        assert.ok(entry);
        assert.equal(entry.targetMonths, expected.targetMonths);
        assert.equal(entry.effectiveQuarter, expected.effectiveQuarter);
      }

      for (const scenario of [
        { name: "months zero", patch: { targetMonths: 0 } },
        { name: "months negative", patch: { targetMonths: -3 } },
        { name: "months thirteen", patch: { targetMonths: 13 } },
        { name: "quarter zero", patch: { effectiveQuarter: 0 } },
        { name: "quarter negative", patch: { effectiveQuarter: -1 } },
        { name: "quarter five", patch: { effectiveQuarter: 5 } },
      ]) {
        await t.test(
          `active frozen period metadata rejects ${scenario.name}`,
          async () => {
            await withActiveSnapshot(
              snapshotWithPeriodFields(scenario.patch),
              async () => {
                const catalog = await fastify.inject({
                  method: "GET",
                  url: "/api/v1/kpis",
                });
                assert.equal(catalog.statusCode, 503);
                assert.equal(
                  catalog.body,
                  '{"error":"service_unavailable"}',
                );

                const dashboard = await fastify.inject({
                  method: "GET",
                  url: "/api/v1/dashboard",
                });
                assert.equal(
                  dashboard.statusCode,
                  200,
                  "Dashboard results and periodCode are unchanged",
                );
              },
            );
          },
        );
      }

      for (const scenario of [
        { name: "both null", months: null, quarter: null },
        { name: "lower bounds", months: 1, quarter: 1 },
        { name: "month eight", months: 8, quarter: 2 },
        { name: "upper bounds", months: 12, quarter: 4 },
      ]) {
        await t.test(
          `active frozen period metadata accepts ${scenario.name}`,
          async () => {
            await withActiveSnapshot(
              snapshotWithPeriodFields({
                targetMonths: scenario.months,
                effectiveQuarter: scenario.quarter,
              }),
              async () => {
                await inspectActiveKpiPeriod({
                  targetMonths: scenario.months,
                  effectiveQuarter: scenario.quarter,
                });
              },
            );
          },
        );
      }

      await t.test(
        "active frozen valid period metadata overrides valid live registry drift",

        async () => {
          const baseline = await pool.query<{
            readonly target_months: number | null;
            readonly effective_quarter: number | null;
          }>(`
            SELECT target_months, effective_quarter
            FROM kpi_definitions
            WHERE kpi_key = 's_kpi_anc12'
          `);
          assert.equal(baseline.rows.length, 1);

          await withActiveSnapshot(
            snapshotWithPeriodFields({
              targetMonths: 8,
              effectiveQuarter: 2,
            }),
            async () => {
              try {
                await pool.query(`
                  UPDATE kpi_definitions
                  SET target_months = 12,
                      effective_quarter = 4
                  WHERE kpi_key = 's_kpi_anc12'
                `);
                await inspectActiveKpiPeriod({
                  targetMonths: 8,
                  effectiveQuarter: 2,
                });
              } finally {
                await pool.query(
                  `
                    UPDATE kpi_definitions
                    SET target_months = $1,
                        effective_quarter = $2
                    WHERE kpi_key = 's_kpi_anc12'
                  `,
                  [
                    baseline.rows[0]?.target_months,
                    baseline.rows[0]?.effective_quarter,
                  ],
                );
              }
            },
          );
        },
      );

      await t.test(
        "legacy omitted period fields fall back to constrained live registry",

        async () => {
          const baseline = await pool.query<{
            readonly target_months: number | null;
            readonly effective_quarter: number | null;
          }>(`
            SELECT target_months, effective_quarter
            FROM kpi_definitions
            WHERE kpi_key = 's_kpi_anc12'
          `);
          assert.equal(baseline.rows.length, 1);

          await withActiveSnapshot(
            snapshotWithPeriodFields({
              targetMonths: undefined,
              effectiveQuarter: undefined,
            }),
            async () => {
              try {
                await pool.query(`
                  UPDATE kpi_definitions
                  SET target_months = 8,
                      effective_quarter = 4
                  WHERE kpi_key = 's_kpi_anc12'
                `);
                await inspectActiveKpiPeriod({
                  targetMonths: 8,
                  effectiveQuarter: 4,
                });
              } finally {
                await pool.query(
                  `
                    UPDATE kpi_definitions
                    SET target_months = $1,
                        effective_quarter = $2
                    WHERE kpi_key = 's_kpi_anc12'
                  `,
                  [
                    baseline.rows[0]?.target_months,
                    baseline.rows[0]?.effective_quarter,
                  ],
                );
              }
            },
          );
        },
      );

      await t.test(
        "explicit frozen null period metadata never falls back to live registry",

        async () => {
          const baseline = await pool.query<{
            readonly target_months: number | null;
            readonly effective_quarter: number | null;
          }>(`
            SELECT target_months, effective_quarter
            FROM kpi_definitions
            WHERE kpi_key = 's_kpi_anc12'
          `);
          assert.equal(baseline.rows.length, 1);

          await withActiveSnapshot(
            snapshotWithPeriodFields({
              targetMonths: null,
              effectiveQuarter: null,
            }),
            async () => {
              try {
                await pool.query(`
                  UPDATE kpi_definitions
                  SET target_months = 8,
                      effective_quarter = 4
                  WHERE kpi_key = 's_kpi_anc12'
                `);
                await inspectActiveKpiPeriod({
                  targetMonths: null,
                  effectiveQuarter: null,
                });
              } finally {
                await pool.query(
                  `
                    UPDATE kpi_definitions
                    SET target_months = $1,
                        effective_quarter = $2
                    WHERE kpi_key = 's_kpi_anc12'
                  `,
                  [
                    baseline.rows[0]?.target_months,
                    baseline.rows[0]?.effective_quarter,
                  ],
                );
              }
            },
          );
        },
      );

      await t.test(
        "dashboard live response exposes only public fields",

        async () => {
          const response =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/dashboard",
            });

          assert.equal(
            response.statusCode,
            200,
          );

          const body =
            response.json() as {
              readonly dataset:
                Record<string, unknown>;
              readonly results:
                readonly Record<
                  string,
                  unknown
                >[];
            };

          assert.deepEqual(
            Object.keys(
              body.dataset,
            ).sort(),
            [
              "activatedAt",
              "currentQuarter",
              "fiscalYear",
              "sourceLastUpdated",
              "syncRunId",
            ],
          );

          assert.deepEqual(
            Object.keys(
              body.results[0] ?? {},
            ).sort(),
            [
              "areacode",
              "hospcode",
              "kpiKey",
              "periodCode",
              "result",
              "target",
            ],
          );

          for (
            const privateFragment
            of [
              "active_sync_run_id",
              "run_status",
              "status",
              "expected_source_count",
              "completed_source_count",
              "failed_source_count",
              "finished_at",
              "started_at",
              "config_snapshot",
              "error_summary",
              "kpi_definition_id",
              "definition_id",
              "sort_order",
              "details",
              "raw_payload",
              "date_com",
              "source_last_updated",
              "calculated_at",
              "fiscal_year",
              "current_quarter",
              "period_code",
              "kpi_key",
            ]
          ) {
            assert.equal(
              response.body.includes(
                privateFragment,
              ),
              false,
              `Dashboard payload must not expose: ${privateFragment}`,
            );
          }
        },
      );

      const malformedResultId =
        await insertKpiResult(pool, {
          syncRunId: activeRunId,
          kpiKey: "s_dm_screen",
          periodCode: "q2",
          areacode: null,
          hospcode: null,
          target: "10",
          result: "5",
        });

      await t.test(
        "dashboard fails closed on a malformed live result row without partial output",

        async () => {
          try {
            const response =
              await fastify.inject({
                method: "GET",
                url: "/api/v1/dashboard",
              });

            assert.equal(
              response.statusCode,
              503,
            );

            assert.equal(
              response.body,
              '{"error":"service_unavailable"}',
            );
          } finally {
            await pool.query(
              `
                DELETE FROM kpi_results
                WHERE id = $1
              `,
              [
                malformedResultId,
              ],
            );
          }

          const recovered =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/dashboard",
            });

          assert.equal(
            recovered.statusCode,
            200,
          );

          assert.deepEqual(
            recovered.json(),
            {
              dataset: {
                ...expectedDashboardDataset,
                sourceLastUpdated:
                  "20260926123045",
              },
              results:
                expectedDashboardResults,
            },
          );
        },
      );

      await t.test(
        "existing read API surfaces remain available after dashboard proofs",

        async () => {
          const kpisResponse =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/kpis",
            });

          assert.equal(
            kpisResponse.statusCode,
            200,
          );

          assert.equal(
            (kpisResponse.json() as {
              readonly kpis: readonly unknown[];
            }).kpis.length,
            3,
          );

          const facilitiesResponse =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/facilities",
            });

          assert.equal(
            facilitiesResponse.statusCode,
            200,
          );

          const tambonsResponse =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/tambons",
            });

          assert.equal(
            tambonsResponse.statusCode,
            200,
          );

          const syncStatusResponse =
            await fastify.inject({
              method: "GET",
              url: "/api/v1/sync-status",
            });

          assert.equal(
            syncStatusResponse.statusCode,
            200,
          );

          assert.equal(
            (syncStatusResponse.json() as {
              readonly activeSyncRunId:
                string | null;
            }).activeSyncRunId,
            activeRunId,
          );
        },
      );
    } finally {
      try {
        if (app !== undefined) {
          await app.close();
        }
      } finally {
        try {
          if (
            destructiveSchemaMutationStarted
          ) {
            await resetPublicSchema(
              pool,
            );
          }
        } finally {
          await pool.end();
        }
      }
    }
  },
);
