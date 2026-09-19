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
          '{}'::JSONB,
          $5,
          $6,
          $7::JSONB
        )
        RETURNING id
      `,
      [
        options.status,
        expected,
        completed,
        failed,
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
