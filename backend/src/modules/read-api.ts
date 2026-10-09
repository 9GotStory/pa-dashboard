import type {
  FastifyInstance,
} from "fastify";

export interface ReadApiQueryResult {
  readonly rows: readonly unknown[];
}

export interface ReadApiDatabase {
  query(
    text: string,
  ): Promise<ReadApiQueryResult>;
}

const SERVICE_UNAVAILABLE = {
  error: "service_unavailable",
} as const;

const KPI_CATALOG_QUERY = `
  WITH active_state AS (
    SELECT
      state.active_sync_run_id,
      run.config_snapshot
    FROM app_state AS state
    LEFT JOIN sync_runs AS run
      ON run.id = state.active_sync_run_id
    WHERE state.singleton_id = 1
  )
  SELECT
    state.active_sync_run_id::TEXT
      AS active_sync_run_id,
    snapshot.definition IS NOT NULL
      AS snapshot_definition_present,
    CASE
      WHEN state.active_sync_run_id IS NOT NULL
        AND snapshot.definition ? 'kpiKey'
        THEN snapshot.definition ->> 'kpiKey'
      ELSE definition.kpi_key
    END AS kpi_key,
    definition.title,
    CASE
      WHEN state.active_sync_run_id IS NOT NULL
        AND snapshot.definition ? 'targetValue'
        THEN
          (snapshot.definition ->> 'targetValue')::NUMERIC
      ELSE definition.target_value
    END AS target_value,
    definition.sort_order,
    definition.link,
    category.code AS category_code,
    category.name AS category_name,
    category.sort_order AS category_order,
    definition.subgroup,
    CASE
      WHEN state.active_sync_run_id IS NOT NULL
        AND snapshot.definition ? 'isQuarterly'
        THEN
          (snapshot.definition ->> 'isQuarterly')::BOOLEAN
      ELSE definition.is_quarterly
    END AS is_quarterly,
    CASE
      WHEN state.active_sync_run_id IS NOT NULL
        AND snapshot.definition ? 'targetMonths'
        THEN
          (snapshot.definition ->> 'targetMonths')::SMALLINT
      ELSE definition.target_months
    END AS target_months,
    CASE
      WHEN state.active_sync_run_id IS NOT NULL
        AND snapshot.definition ? 'effectiveQuarter'
        THEN
          (snapshot.definition ->> 'effectiveQuarter')::SMALLINT
      ELSE definition.effective_quarter
    END AS effective_quarter
  FROM kpi_definitions AS definition
  INNER JOIN kpi_categories AS category
    ON category.id = definition.category_id
  CROSS JOIN active_state AS state
  LEFT JOIN LATERAL (
    SELECT item AS definition
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(
          state.config_snapshot -> 'definitions'
        ) = 'array'
          THEN state.config_snapshot -> 'definitions'
        ELSE '[]'::JSONB
      END
    ) AS item
    WHERE item ->> 'id'
      = definition.id::TEXT
    LIMIT 1
  ) AS snapshot
    ON state.active_sync_run_id IS NOT NULL
  WHERE (
      state.active_sync_run_id IS NULL
      AND definition.is_active = TRUE
      AND NOT (
        definition.metadata
          @> '{"source_only": true}'::JSONB
      )
    )
    OR (
      state.active_sync_run_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM kpi_results AS active_result
        WHERE active_result.sync_run_id
            = state.active_sync_run_id
          AND active_result.kpi_definition_id
            = definition.id
      )
    )
  ORDER BY
    category.sort_order ASC,
    definition.sort_order ASC,
    definition.kpi_key ASC
`;

const SYNC_STATUS_QUERY = `
  SELECT
    state.active_sync_run_id::TEXT
      AS active_sync_run_id,
    latest.id::TEXT AS latest_id,
    latest.status AS latest_status,
    latest.fiscal_year AS latest_fiscal_year,
    latest.current_quarter
      AS latest_current_quarter,
    latest.expected_source_count
      AS latest_expected_source_count,
    latest.completed_source_count
      AS latest_completed_source_count,
    latest.failed_source_count
      AS latest_failed_source_count,
    latest.started_at AS latest_started_at,
    latest.finished_at AS latest_finished_at,
    latest.activated_at AS latest_activated_at
  FROM app_state AS state
  LEFT JOIN LATERAL (
    SELECT
      id,
      status,
      fiscal_year,
      current_quarter,
      expected_source_count,
      completed_source_count,
      failed_source_count,
      started_at,
      finished_at,
      activated_at
    FROM sync_runs
    ORDER BY
      started_at DESC,
      id DESC
    LIMIT 1
  ) AS latest
    ON TRUE
  WHERE state.singleton_id = 1
`;

const FACILITIES_QUERY = `
  SELECT
    hospcode,
    hospname,
    tambon_id
  FROM facilities
  ORDER BY hospcode ASC
`;

const TAMBONS_QUERY = `
  SELECT
    id,
    name_th
  FROM tambons
  ORDER BY id ASC
`;

const DASHBOARD_QUERY = `
  SELECT
    state.active_sync_run_id::TEXT
      AS active_sync_run_id,
    run.id::TEXT AS run_id,
    run.status AS run_status,
    run.fiscal_year AS fiscal_year,
    run.current_quarter AS current_quarter,
    run.expected_source_count
      AS expected_source_count,
    run.completed_source_count
      AS completed_source_count,
    run.failed_source_count
      AS failed_source_count,
    run.finished_at AS finished_at,
    run.activated_at AS activated_at,
    fresh.source_last_updated
      AS source_last_updated,
    snapshot.definition IS NOT NULL
      AS snapshot_definition_present,
    CASE
      WHEN snapshot.definition ? 'kpiKey'
        THEN snapshot.definition ->> 'kpiKey'
      ELSE definition.kpi_key
    END AS kpi_key,
    kpi.period_code AS period_code,
    kpi.areacode AS areacode,
    kpi.hospcode AS hospcode,
    kpi.target AS target,
    kpi.result AS result
  FROM app_state AS state
  LEFT JOIN LATERAL (
    SELECT
      id,
      status,
      fiscal_year,
      current_quarter,
      expected_source_count,
      completed_source_count,
      failed_source_count,
      finished_at,
      activated_at,
      config_snapshot
    FROM sync_runs
    WHERE id = state.active_sync_run_id
  ) AS run ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      MAX(source.date_com)
        AS source_last_updated
    FROM source_records AS source
    WHERE source.sync_run_id
        = state.active_sync_run_id
      AND (
        source.date_com ~ '^[0-9]{12}$'
        OR source.date_com ~ '^[0-9]{14}$'
      )
  ) AS fresh ON TRUE
  LEFT JOIN kpi_results AS kpi
    ON kpi.sync_run_id
      = state.active_sync_run_id
  LEFT JOIN kpi_definitions AS definition
    ON definition.id = kpi.kpi_definition_id
  LEFT JOIN LATERAL (
    SELECT item AS definition
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(
          run.config_snapshot -> 'definitions'
        ) = 'array'
          THEN run.config_snapshot -> 'definitions'
        ELSE '[]'::JSONB
      END
    ) AS item
    WHERE item ->> 'id'
      = definition.id::TEXT
    LIMIT 1
  ) AS snapshot
    ON state.active_sync_run_id IS NOT NULL
  WHERE state.singleton_id = 1
  ORDER BY
    definition.sort_order ASC,
    definition.kpi_key ASC,
    kpi.period_code ASC,
    kpi.areacode ASC,
    kpi.hospcode ASC NULLS FIRST
`;

const SYNC_RUN_STATUSES = [
  "running",
  "succeeded",
  "failed",
] as const;

type SyncRunStatus =
  (typeof SYNC_RUN_STATUSES)[number];

const DASHBOARD_PERIOD_CODES = [
  "annual",
  "q1",
  "q2",
  "q3",
  "q4",
] as const;

function asRowObject(
  row: unknown,
): Record<string, unknown> {
  if (
    typeof row !== "object" ||
    row === null ||
    Array.isArray(row)
  ) {
    throw new Error(
      "Database row is not an object",
    );
  }

  return row as Record<string, unknown>;
}

function requireString(
  row: Record<string, unknown>,
  field: string,
): string {
  const value = row[field];

  if (typeof value !== "string") {
    throw new Error(
      `Field ${field} is not a string`,
    );
  }

  return value;
}

function requireDigitCode(
  row: Record<string, unknown>,
  field: string,
  length: number,
): string {
  const value = row[field];

  if (
    typeof value !== "string" ||
    value.length !== length ||
    !/^\d+$/.test(value)
  ) {
    throw new Error(
      `Field ${field} is not a ${length}-digit code`,
    );
  }

  return value;
}

function requireNonblankString(
  row: Record<string, unknown>,
  field: string,
): string {
  const value = row[field];

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `Field ${field} is not a nonblank string`,
    );
  }

  return value;
}

function optionalString(
  row: Record<string, unknown>,
  field: string,
): string | null {
  const value = row[field];

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      `Field ${field} is not a string`,
    );
  }

  return value;
}

function requireInteger(
  row: Record<string, unknown>,
  field: string,
): number {
  const value = row[field];

  if (
    typeof value !== "number" ||
    !Number.isInteger(value)
  ) {
    throw new Error(
      `Field ${field} is not an integer`,
    );
  }

  return value;
}

function optionalInteger(
  row: Record<string, unknown>,
  field: string,
): number | null {
  const value = row[field];

  if (value === null) {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value)
  ) {
    throw new Error(
      `Field ${field} is not an integer`,
    );
  }

  return value;
}

function requireBoolean(
  row: Record<string, unknown>,
  field: string,
): boolean {
  const value = row[field];

  if (typeof value !== "boolean") {
    throw new Error(
      `Field ${field} is not a boolean`,
    );
  }

  return value;
}

function normalizeTarget(
  row: Record<string, unknown>,
  field: string,
): number | null {
  const value = row[field];

  if (value === null) {
    return null;
  }

  const target =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(target)) {
    throw new Error(
      `Field ${field} is not a finite number`,
    );
  }

  return target;
}

function requirePeriodCode(
  row: Record<string, unknown>,
  field: string,
): string {
  const value = row[field];

  if (
    typeof value === "string" &&
    (DASHBOARD_PERIOD_CODES as readonly string[])
      .includes(value)
  ) {
    return value;
  }

  throw new Error(
    `Field ${field} is not a period code`,
  );
}

function requireDecimalIdentity(
  row: Record<string, unknown>,
  field: string,
): string {
  const value = row[field];

  if (
    typeof value === "string" &&
    value.length > 0 &&
    /^[0-9]+$/.test(value)
  ) {
    return value;
  }

  throw new Error(
    `Field ${field} is not a decimal identity`,
  );
}

function optionalNonblankString(
  row: Record<string, unknown>,
  field: string,
): string | null {
  const value = row[field];

  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" &&
    value.trim().length > 0
  ) {
    return value;
  }

  throw new Error(
    `Field ${field} is not a nonblank string`,
  );
}

function requireFiniteNumber(
  row: Record<string, unknown>,
  field: string,
): number {
  const value = row[field];

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value;
    }

    throw new Error(
      `Field ${field} is not a finite number`,
    );
  }

  if (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }

  throw new Error(
    `Field ${field} is not a finite number`,
  );
}

function requireSourceLastUpdated(
  row: Record<string, unknown>,
): string | null {
  const value = row.source_last_updated;

  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" &&
    (/^[0-9]{12}$/.test(value) ||
      /^[0-9]{14}$/.test(value))
  ) {
    return value;
  }

  throw new Error(
    "Field source_last_updated is not a valid source marker",
  );
}

function normalizeId(
  row: Record<string, unknown>,
  field: string,
): string | null {
  const value = row[field];

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    if (value.length === 0) {
      throw new Error(
        `Field ${field} is an empty id`,
      );
    }

    return value;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return String(value);
  }

  throw new Error(
    `Field ${field} is not a valid id`,
  );
}

function normalizeTimestamp(
  row: Record<string, unknown>,
  field: string,
): string {
  const value = row[field];

  if (value === null) {
    throw new Error(
      `Field ${field} is unexpectedly null`,
    );
  }

  if (!(value instanceof Date)) {
    throw new Error(
      `Field ${field} is not a timestamp`,
    );
  }

  const time = value.getTime();

  if (!Number.isFinite(time)) {
    throw new Error(
      `Field ${field} is not a valid timestamp`,
    );
  }

  return value.toISOString();
}

function normalizeOptionalTimestamp(
  row: Record<string, unknown>,
  field: string,
): string | null {
  if (row[field] === null) {
    return null;
  }

  return normalizeTimestamp(
    row,
    field,
  );
}

interface PublicKpi {
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

interface PublicSyncRun {
  readonly id: string;
  readonly status: SyncRunStatus;
  readonly fiscalYear: number;
  readonly currentQuarter: number;
  readonly expectedSourceCount: number;
  readonly completedSourceCount: number;
  readonly failedSourceCount: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly activatedAt: string | null;
}

interface PublicSyncStatus {
  readonly activeSyncRunId: string | null;
  readonly latestRun:
    | PublicSyncRun
    | null;
}

interface PublicFacility {
  readonly hospcode: string;
  readonly hospname: string;
  readonly tambonId: string;
}

interface PublicTambon {
  readonly id: string;
  readonly nameTh: string;
}

interface PublicDashboardDataset {
  readonly syncRunId: string;
  readonly fiscalYear: number;
  readonly currentQuarter: number;
  readonly activatedAt: string;
  readonly sourceLastUpdated: string | null;
}

interface PublicDashboardResult {
  readonly kpiKey: string;
  readonly periodCode: string;
  readonly areacode: string;
  readonly hospcode: string | null;
  readonly target: number;
  readonly result: number;
}

interface PublicDashboard {
  readonly dataset: PublicDashboardDataset | null;
  readonly results: readonly PublicDashboardResult[];
}

function normalizeKpi(
  row: unknown,
): PublicKpi {
  const source = asRowObject(row);

  const activeSyncRunId =
    normalizeId(
      source,
      "active_sync_run_id",
    );

  if (
    activeSyncRunId !== null &&
    source.snapshot_definition_present !== true
  ) {
    throw new Error(
      "Active KPI catalog member has no matching snapshot definition",
    );
  }

  return {
    key: requireString(
      source,
      "kpi_key",
    ),
    title: requireString(
      source,
      "title",
    ),
    target: normalizeTarget(
      source,
      "target_value",
    ),
    order: requireInteger(
      source,
      "sort_order",
    ),
    link: optionalString(
      source,
      "link",
    ),
    categoryCode: requireString(
      source,
      "category_code",
    ),
    category: requireString(
      source,
      "category_name",
    ),
    categoryOrder: requireInteger(
      source,
      "category_order",
    ),
    subgroup: optionalString(
      source,
      "subgroup",
    ),
    isQuarterly: requireBoolean(
      source,
      "is_quarterly",
    ),
    targetMonths: optionalInteger(
      source,
      "target_months",
    ),
    effectiveQuarter: optionalInteger(
      source,
      "effective_quarter",
    ),
  };
}

function normalizeFacility(
  row: unknown,
): PublicFacility {
  const source = asRowObject(row);

  return {
    hospcode: requireDigitCode(
      source,
      "hospcode",
      5,
    ),
    hospname: requireNonblankString(
      source,
      "hospname",
    ),
    tambonId: requireDigitCode(
      source,
      "tambon_id",
      6,
    ),
  };
}

function normalizeTambon(
  row: unknown,
): PublicTambon {
  const source = asRowObject(row);

  return {
    id: requireDigitCode(
      source,
      "id",
      6,
    ),
    nameTh: requireNonblankString(
      source,
      "name_th",
    ),
  };
}

function normalizeSyncRunStatus(
  row: Record<string, unknown>,
  field: string,
): SyncRunStatus {
  const value = row[field];

  if (
    typeof value === "string" &&
    (SYNC_RUN_STATUSES as readonly string[])
      .includes(value)
  ) {
    return value as SyncRunStatus;
  }

  throw new Error(
    `Field ${field} is not a sync run status`,
  );
}

function buildSyncStatus(
  row: unknown,
): PublicSyncStatus {
  const source = asRowObject(row);

  const latestId = normalizeId(
    source,
    "latest_id",
  );

  return {
    activeSyncRunId: normalizeId(
      source,
      "active_sync_run_id",
    ),

    latestRun:
      latestId === null
        ? null
        : {
            id: latestId,
            status: normalizeSyncRunStatus(
              source,
              "latest_status",
            ),
            fiscalYear: requireInteger(
              source,
              "latest_fiscal_year",
            ),
            currentQuarter: requireInteger(
              source,
              "latest_current_quarter",
            ),
            expectedSourceCount:
              requireInteger(
                source,
                "latest_expected_source_count",
              ),
            completedSourceCount:
              requireInteger(
                source,
                "latest_completed_source_count",
              ),
            failedSourceCount:
              requireInteger(
                source,
                "latest_failed_source_count",
              ),
            startedAt: normalizeTimestamp(
              source,
              "latest_started_at",
            ),
            finishedAt: normalizeOptionalTimestamp(
              source,
              "latest_finished_at",
            ),
            activatedAt: normalizeOptionalTimestamp(
              source,
              "latest_activated_at",
            ),
          },
  };
}

function normalizeDashboardResult(
  row: unknown,
): PublicDashboardResult {
  const source = asRowObject(row);

  if (
    source.snapshot_definition_present !== true
  ) {
    throw new Error(
      "Active dashboard result has no matching snapshot definition",
    );
  }

  return {
    kpiKey: requireNonblankString(
      source,
      "kpi_key",
    ),
    periodCode: requirePeriodCode(
      source,
      "period_code",
    ),
    areacode: requireNonblankString(
      source,
      "areacode",
    ),
    hospcode: optionalNonblankString(
      source,
      "hospcode",
    ),
    target: requireFiniteNumber(
      source,
      "target",
    ),
    result: requireFiniteNumber(
      source,
      "result",
    ),
  };
}

function validateDashboardRun(
  source: Record<string, unknown>,
): Omit<
  PublicDashboardDataset,
  "sourceLastUpdated"
> {
  const syncRunId = requireDecimalIdentity(
    source,
    "run_id",
  );

  if (source.run_status !== "succeeded") {
    throw new Error(
      "Active sync run is not succeeded",
    );
  }

  const fiscalYear = requireInteger(
    source,
    "fiscal_year",
  );

  const currentQuarter = requireInteger(
    source,
    "current_quarter",
  );

  if (
    currentQuarter < 1 ||
    currentQuarter > 4
  ) {
    throw new Error(
      "Active sync run quarter is out of range",
    );
  }

  const expectedSourceCount = requireInteger(
    source,
    "expected_source_count",
  );

  if (expectedSourceCount <= 0) {
    throw new Error(
      "Active sync run expects no sources",
    );
  }

  const completedSourceCount = requireInteger(
    source,
    "completed_source_count",
  );

  if (completedSourceCount !== expectedSourceCount) {
    throw new Error(
      "Active sync run is incomplete",
    );
  }

  if (
    requireInteger(
      source,
      "failed_source_count",
    ) !== 0
  ) {
    throw new Error(
      "Active sync run has failed sources",
    );
  }

  normalizeTimestamp(
    source,
    "finished_at",
  );

  return {
    syncRunId,
    fiscalYear,
    currentQuarter,
    activatedAt: normalizeTimestamp(
      source,
      "activated_at",
    ),
  };
}

function buildDashboard(
  rows: readonly unknown[],
): PublicDashboard {
  const first = rows[0];

  if (first === undefined) {
    throw new Error(
      "app_state singleton row is missing",
    );
  }

  const source = asRowObject(first);

  if (
    optionalString(
      source,
      "active_sync_run_id",
    ) === null
  ) {
    if (rows.length !== 1) {
      throw new Error(
        "Unexpected dashboard rows without an active dataset",
      );
    }

    return {
      dataset: null,
      results: [],
    };
  }

  const dataset = validateDashboardRun(source);

  if (source.kpi_key === null) {
    throw new Error(
      "Active dataset has no KPI results",
    );
  }

  return {
    dataset: {
      ...dataset,
      sourceLastUpdated:
        requireSourceLastUpdated(source),
    },
    results: rows.map((row) =>
      normalizeDashboardResult(row),
    ),
  };
}

export function registerReadApiRoutes(
  app: FastifyInstance,
  db: ReadApiDatabase,
): void {
  app.get(
    "/api/v1/kpis",

    async (request, reply) => {
      try {
        const result =
          await db.query(
            KPI_CATALOG_QUERY,
          );

        const kpis = result.rows.map(
          (row) => normalizeKpi(row),
        );

        return { kpis };
      } catch (error) {
        request.log.error(
          error,
          "KPI catalog read failed",
        );

        reply.code(503);

        return SERVICE_UNAVAILABLE;
      }
    },
  );

  app.get(
    "/api/v1/facilities",

    async (request, reply) => {
      try {
        const result =
          await db.query(
            FACILITIES_QUERY,
          );

        const facilities =
          result.rows.map(
            (row) =>
              normalizeFacility(
                row,
              ),
          );

        return { facilities };
      } catch (error) {
        request.log.error(
          error,
          "Facility reference read failed",
        );

        reply.code(503);

        return SERVICE_UNAVAILABLE;
      }
    },
  );

  app.get(
    "/api/v1/tambons",

    async (request, reply) => {
      try {
        const result =
          await db.query(
            TAMBONS_QUERY,
          );

        const tambons =
          result.rows.map(
            (row) =>
              normalizeTambon(
                row,
              ),
          );

        return { tambons };
      } catch (error) {
        request.log.error(
          error,
          "Tambon reference read failed",
        );

        reply.code(503);

        return SERVICE_UNAVAILABLE;
      }
    },
  );

  app.get(
    "/api/v1/sync-status",

    async (request, reply) => {
      let row: unknown;

      try {
        const result =
          await db.query(
            SYNC_STATUS_QUERY,
          );

        row = result.rows[0];
      } catch (error) {
        request.log.error(
          error,
          "Sync status database query failed",
        );

        reply.code(503);

        return SERVICE_UNAVAILABLE;
      }

      if (row === undefined) {
        request.log.warn(
          "app_state singleton row is missing",
        );

        reply.code(503);

        return SERVICE_UNAVAILABLE;
      }

      try {
        return buildSyncStatus(row);
      } catch (error) {
        request.log.error(
          error,
          "Sync status row normalization failed",
        );

        reply.code(503);

        return SERVICE_UNAVAILABLE;
      }
    },
  );

  app.get(
    "/api/v1/dashboard",

    async (request, reply) => {
      let rows: readonly unknown[];

      try {
        const result =
          await db.query(
            DASHBOARD_QUERY,
          );

        rows = result.rows;
      } catch (error) {
        request.log.error(
          error,
          "Dashboard database query failed",
        );

        reply.code(503);

        return SERVICE_UNAVAILABLE;
      }

      try {
        return buildDashboard(rows);
      } catch (error) {
        request.log.error(
          error,
          "Dashboard read failed",
        );

        reply.code(503);

        return SERVICE_UNAVAILABLE;
      }
    },
  );
}
