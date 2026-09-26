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
  SELECT
    definition.kpi_key,
    definition.title,
    definition.target_value,
    definition.sort_order,
    definition.link,
    category.code AS category_code,
    category.name AS category_name,
    category.sort_order AS category_order,
    definition.subgroup,
    definition.is_quarterly,
    definition.target_months,
    definition.effective_quarter
  FROM kpi_definitions AS definition
  INNER JOIN kpi_categories AS category
    ON category.id = definition.category_id
  WHERE definition.is_active = TRUE
    AND NOT (
      definition.metadata
        @> '{"source_only": true}'::JSONB
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

const SYNC_RUN_STATUSES = [
  "running",
  "succeeded",
  "failed",
] as const;

type SyncRunStatus =
  (typeof SYNC_RUN_STATUSES)[number];

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

function normalizeKpi(
  row: unknown,
): PublicKpi {
  const source = asRowObject(row);

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
}
