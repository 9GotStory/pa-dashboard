import assert from "node:assert/strict";

import test from "node:test";

import {
  buildApp,
} from "../src/app.js";

import type {
  AppStateQueryResult,
  AppStateRow,
  HealthDatabase,
} from "../src/observability/health.js";

import type {
  ReadApiDatabase,
} from "../src/modules/read-api.js";

interface FakeDatabase
  extends HealthDatabase,
    ReadApiDatabase {
  query(
    text: string,
  ): Promise<AppStateQueryResult>;

  getQueries():
    readonly string[];
}

function createFakeDatabase(
  behavior: {
    readonly kpiRows?: readonly unknown[];
    readonly syncRows?: readonly unknown[];
    readonly error?: Error;
  },
): FakeDatabase {
  const queries: string[] = [];

  return {
    query: async (text: string) => {
      queries.push(text);

      if (
        behavior.error !== undefined
      ) {
        throw behavior.error;
      }

      const rows = text.includes(
        "kpi_definitions",
      )
        ? behavior.kpiRows
        : behavior.syncRows;

      return {
        rows: (rows ??
          []) as readonly AppStateRow[],
      };
    },

    getQueries: () => queries,
  };
}

test(
  "buildApp registers the KPI catalog and sync status routes",

  async () => {
    const db =
      createFakeDatabase({});

    const app = buildApp({
      db,
    });

    try {
      const kpis =
        await app.inject({
          method: "GET",
          url: "/api/v1/kpis",
        });

      assert.equal(
        kpis.statusCode,
        200,
      );

      const syncStatus =
        await app.inject({
          method: "GET",
          url: "/api/v1/sync-status",
        });

      assert.notEqual(
        syncStatus.statusCode,
        404,
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "KPI catalog returns public fields in database order",

  async () => {
    const db =
      createFakeDatabase({
        kpiRows: [
          {
            kpi_key: "s_kpi_anc12",
            title: "ANC 12 weeks",
            target_value: "75",
            sort_order: 1,
            link:
              "https://hdc.moph.go.th/anc12",
            category_code:
              "kpi_master",
            category_name:
              "ตัวชี้วัดพื้นฐาน",
            category_order: 1,
            subgroup: null,
            is_quarterly: false,
            target_months: null,
            effective_quarter: null,
          },
          {
            kpi_key:
              "s_epi1__pcv1",
            title: "PCV1",
            target_value: "87.5",
            sort_order: 15,
            link: null,
            category_code: "kpi_epi",
            category_name:
              "สร้างเสริมภูมิคุ้มกันโรค",
            category_order: 2,
            subgroup:
              "กลุ่มอายุ 1 ปี",
            is_quarterly: true,
            target_months: 9,
            effective_quarter: 3,
          },
          {
            kpi_key:
              "s_kpi_no_target",
            title: "No target",
            target_value: null,
            sort_order: 16,
            link: null,
            category_code: "kpi_epi",
            category_name:
              "สร้างเสริมภูมิคุ้มกันโรค",
            category_order: 2,
            subgroup: null,
            is_quarterly: false,
            target_months: null,
            effective_quarter: null,
          },
        ],
      });

    const app = buildApp({
      db,
    });

    try {
      const response =
        await app.inject({
          method: "GET",
          url: "/api/v1/kpis",
        });

      assert.equal(
        response.statusCode,
        200,
      );

      assert.deepEqual(
        response.json(),
        {
          kpis: [
            {
              key: "s_kpi_anc12",
              title:
                "ANC 12 weeks",
              target: 75,
              order: 1,
              link:
                "https://hdc.moph.go.th/anc12",
              categoryCode:
                "kpi_master",
              category:
                "ตัวชี้วัดพื้นฐาน",
              categoryOrder: 1,
              subgroup: null,
              isQuarterly: false,
              targetMonths: null,
              effectiveQuarter:
                null,
            },
            {
              key: "s_epi1__pcv1",
              title: "PCV1",
              target: 87.5,
              order: 15,
              link: null,
              categoryCode:
                "kpi_epi",
              category:
                "สร้างเสริมภูมิคุ้มกันโรค",
              categoryOrder: 2,
              subgroup:
                "กลุ่มอายุ 1 ปี",
              isQuarterly: true,
              targetMonths: 9,
              effectiveQuarter: 3,
            },
            {
              key: "s_kpi_no_target",
              title: "No target",
              target: null,
              order: 16,
              link: null,
              categoryCode:
                "kpi_epi",
              category:
                "สร้างเสริมภูมิคุ้มกันโรค",
              categoryOrder: 2,
              subgroup: null,
              isQuarterly: false,
              targetMonths: null,
              effectiveQuarter:
                null,
            },
          ],
        },
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "KPI catalog query targets the authoritative registry tables",

  async () => {
    const db =
      createFakeDatabase({
        kpiRows: [],
      });

    const app = buildApp({
      db,
    });

    try {
      await app.inject({
        method: "GET",
        url: "/api/v1/kpis",
      });

      const queries =
        db.getQueries();

      assert.equal(
        queries.length,
        1,
      );

      const sql = (queries[0] ??
        "").replace(/\s+/g, " ");

      assert.ok(
        sql.includes(
          "kpi_definitions",
        ),
      );

      assert.ok(
        sql.includes(
          "kpi_categories",
        ),
      );

      assert.ok(
        sql.includes(
          "is_active = TRUE",
        ),
      );

      assert.ok(
        sql.includes(
          "source_only",
        ),
      );

      assert.ok(
        sql.includes("@>"),
      );

      assert.ok(
        sql.includes(
          "ORDER BY",
        ),
      );

      assert.ok(
        sql.includes(
          "category.sort_order",
        ),
      );

      assert.ok(
        sql.includes(
          "definition.sort_order",
        ),
      );

      assert.ok(
        sql.includes(
          "definition.kpi_key",
        ),
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "KPI catalog fails closed without leaking database errors",

  async () => {
    const internalMessage =
      "password authentication failed for user pa_admin at postgres://pa_admin:hunter2@10.0.0.8:5432/pa_prod";

    const db =
      createFakeDatabase({
        error: new Error(
          internalMessage,
        ),
      });

    const app = buildApp({
      db,
    });

    try {
      const response =
        await app.inject({
          method: "GET",
          url: "/api/v1/kpis",
        });

      assert.equal(
        response.statusCode,
        503,
      );

      assert.equal(
        response.body,
        '{"error":"service_unavailable"}',
      );

      assert.equal(
        response.body.includes(
          internalMessage,
        ),
        false,
      );

      assert.equal(
        response.body.includes(
          "hunter2",
        ),
        false,
      );

      assert.equal(
        response.body.includes(
          "pa_admin",
        ),
        false,
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "KPI catalog fails closed when a target cannot become a finite number",

  async () => {
    const db =
      createFakeDatabase({
        kpiRows: [
          {
            kpi_key:
              "s_kpi_broken_target",
            title:
              "Broken target",
            target_value:
              "not-a-number",
            sort_order: 1,
            link: null,
            category_code:
              "kpi_master",
            category_name:
              "ตัวชี้วัดพื้นฐาน",
            category_order: 1,
            subgroup: null,
            is_quarterly: false,
            target_months: null,
            effective_quarter: null,
          },
        ],
      });

    const app = buildApp({
      db,
    });

    try {
      const response =
        await app.inject({
          method: "GET",
          url: "/api/v1/kpis",
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
      await app.close();
    }
  },
);

test(
  "sync status reports no history when the singleton has no runs",

  async () => {
    const db =
      createFakeDatabase({
        syncRows: [
          {
            active_sync_run_id:
              null,
            latest_id: null,
            latest_status: null,
            latest_fiscal_year:
              null,
            latest_current_quarter:
              null,
            latest_expected_source_count:
              null,
            latest_completed_source_count:
              null,
            latest_failed_source_count:
              null,
            latest_started_at:
              null,
            latest_finished_at:
              null,
            latest_activated_at:
              null,
          },
        ],
      });

    const app = buildApp({
      db,
    });

    try {
      const response =
        await app.inject({
          method: "GET",
          url: "/api/v1/sync-status",
        });

      assert.equal(
        response.statusCode,
        200,
      );

      assert.equal(
        response.body,
        '{"activeSyncRunId":null,"latestRun":null}',
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "sync status keeps the active dataset distinct from a newer failed run",

  async () => {
    const startedAt = new Date(
      "2026-09-18T02:00:00.000Z",
    );

    const finishedAt = new Date(
      "2026-09-18T02:05:00.000Z",
    );

    const db =
      createFakeDatabase({
        syncRows: [
          {
            active_sync_run_id:
              "42",
            latest_id: "43",
            latest_status: "failed",
            latest_fiscal_year:
              2569,
            latest_current_quarter:
              4,
            latest_expected_source_count:
              2,
            latest_completed_source_count:
              0,
            latest_failed_source_count:
              2,
            latest_started_at:
              startedAt,
            latest_finished_at:
              finishedAt,
            latest_activated_at:
              null,
          },
        ],
      });

    const app = buildApp({
      db,
    });

    try {
      const response =
        await app.inject({
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
            "42",
          latestRun: {
            id: "43",
            status: "failed",
            fiscalYear: 2569,
            currentQuarter: 4,
            expectedSourceCount:
              2,
            completedSourceCount:
              0,
            failedSourceCount:
              2,
            startedAt:
              startedAt.toISOString(),
            finishedAt:
              finishedAt.toISOString(),
            activatedAt: null,
          },
        },
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "sync status preserves BIGINT identifiers as exact strings",

  async () => {
    const db =
      createFakeDatabase({
        syncRows: [
          {
            active_sync_run_id:
              42,
            latest_id:
              "9007199254740993",
            latest_status:
              "succeeded",
            latest_fiscal_year:
              2569,
            latest_current_quarter:
              4,
            latest_expected_source_count:
              1,
            latest_completed_source_count:
              1,
            latest_failed_source_count:
              0,
            latest_started_at:
              new Date(
                "2026-09-18T01:00:00.000Z",
              ),
            latest_finished_at:
              new Date(
                "2026-09-18T01:05:00.000Z",
              ),
            latest_activated_at:
              new Date(
                "2026-09-18T01:06:00.000Z",
              ),
          },
        ],
      });

    const app = buildApp({
      db,
    });

    try {
      const response =
        await app.inject({
          method: "GET",
          url: "/api/v1/sync-status",
        });

      assert.equal(
        response.statusCode,
        200,
      );

      const body =
        response.json() as {
          readonly activeSyncRunId:
            string | null;
          readonly latestRun: {
            readonly id: string;
            readonly activatedAt:
              string | null;
          } | null;
        };

      assert.equal(
        body.activeSyncRunId,
        "42",
      );

      assert.equal(
        body.latestRun?.id,
        "9007199254740993",
      );

      assert.equal(
        typeof body.latestRun
          ?.id,
        "string",
      );

      assert.equal(
        body.latestRun
          ?.activatedAt,
        "2026-09-18T01:06:00.000Z",
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "sync status fails closed without leaking database errors",

  async () => {
    const internalMessage =
      "password authentication failed for user pa_admin at postgres://pa_admin:hunter2@10.0.0.8:5432/pa_prod";

    const db =
      createFakeDatabase({
        error: new Error(
          internalMessage,
        ),
      });

    const app = buildApp({
      db,
    });

    try {
      const response =
        await app.inject({
          method: "GET",
          url: "/api/v1/sync-status",
        });

      assert.equal(
        response.statusCode,
        503,
      );

      assert.equal(
        response.body,
        '{"error":"service_unavailable"}',
      );

      assert.equal(
        response.body.includes(
          internalMessage,
        ),
        false,
      );

      assert.equal(
        response.body.includes(
          "hunter2",
        ),
        false,
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "sync status fails closed when the app_state singleton is missing",

  async () => {
    const db =
      createFakeDatabase({
        syncRows: [],
      });

    const app = buildApp({
      db,
    });

    try {
      const response =
        await app.inject({
          method: "GET",
          url: "/api/v1/sync-status",
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
      await app.close();
    }
  },
);

test(
  "sync status fails closed on malformed runtime rows",

  async (t) => {
    const baseRow = {
      active_sync_run_id:
        "42",
      latest_id: "43",
      latest_fiscal_year:
        2569,
      latest_current_quarter:
        4,
      latest_expected_source_count:
        1,
      latest_completed_source_count:
        1,
      latest_failed_source_count:
        0,
      latest_started_at:
        new Date(
          "2026-09-18T01:00:00.000Z",
        ),
      latest_finished_at:
        new Date(
          "2026-09-18T01:05:00.000Z",
        ),
      latest_activated_at:
        null,
    };

    const malformedRows = [
      {
        reason:
          "invalid status",
        row: {
          ...baseRow,
          latest_status:
            "exploded",
        },
      },
      {
        reason:
          "string timestamp",
        row: {
          ...baseRow,
          latest_status:
            "succeeded",
          latest_started_at:
            "2026-09-18T01:00:00.000Z",
        },
      },
      {
        reason:
          "invalid timestamp",
        row: {
          ...baseRow,
          latest_status:
            "succeeded",
          latest_started_at:
            new Date(
              "not-a-timestamp",
            ),
        },
      },
    ];

    for (
      const malformed
      of malformedRows
    ) {
      await t.test(
        malformed.reason,

        async () => {
          const db =
            createFakeDatabase({
              syncRows: [
                malformed.row,
              ],
            });

          const app = buildApp({
            db,
          });

          try {
            const response =
              await app.inject({
                method: "GET",
                url: "/api/v1/sync-status",
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
            await app.close();
          }
        },
      );
    }
  },
);

test(
  "liveness remains available through buildApp without database access",

  async () => {
    const db =
      createFakeDatabase({});

    const app = buildApp({
      db,
    });

    try {
      const response =
        await app.inject({
          method: "GET",
          url: "/api/v1/health/live",
        });

      assert.equal(
        response.statusCode,
        200,
      );

      assert.equal(
        response.body,
        '{"status":"ok"}',
      );

      assert.equal(
        db.getQueries().length,
        0,
      );
    } finally {
      await app.close();
    }
  },
);
