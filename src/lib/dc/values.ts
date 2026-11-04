import type {
  Cell,
  DcCatalog,
  DcReport,
  DcReportData,
  DcYearBlock,
  Family,
  Month,
  Period,
  ReportQuery,
  Totals,
  TrendPoint,
  UnitTotals,
} from "./types";

// The coverage rules of SCHEMA §4 as pure functions, worked out one block ปี
// at a time from that block's own headers: no React, no DOM, no fetch
// (CODING_STANDARDS §4).

/** Target and result columns side by side: entry k of each is one quarter or month */
type Columns = { target: string[]; result: string[] };

/** The months of a ปีงบประมาณ in order, ต.ค. … ก.ย. (SCHEMA §4.1) */
const MONTHS: Month[] = ["10", "11", "12", "01", "02", "03", "04", "05", "06", "07", "08", "09"];

/** target{MM} with {result}{MM} for the 12 months: "result" for M_A, "{measure}_" for M_B */
function monthColumns(result: string): Columns {
  return { target: MONTHS.map((m) => "target" + m), result: MONTHS.map((m) => result + m) };
}

/** {target}1–4 with {result}1–4 */
function quarterColumns(target: string, result: string): Columns {
  const quarters = [1, 2, 3, 4];
  return { target: quarters.map((k) => target + k), result: quarters.map((k) => result + k) };
}

/** The families whose column names are fixed (SCHEMA §4.1); a family's ทั้งปี sums all its columns */
const FIXED_COLUMNS: Record<Exclude<Family, "M_B" | "OVERRIDE">, Columns> = {
  ANNUAL: { target: ["target"], result: ["result"] },
  Q_A: quarterColumns("target", "result"),
  Q_B: quarterColumns("targetq", "resultq"),
  Q_C: quarterColumns("t_q", "r_q"),
  M_A: monthColumns("result"),
};
/** SCHEMA §4.1's order, which is also the order rules 3–5 of ทั้งปี try them (SCHEMA §4.3) */
const FIXED_ORDER = ["ANNUAL", "Q_A", "Q_B", "Q_C", "M_A"] as const;
/** The quarter families in the order they are tried (SCHEMA §4.2) */
const QUARTER_ORDER = ["Q_A", "Q_B", "Q_C"] as const;

/** hdc_reports.col_target and col_result, when both are set */
function overrideColumns(report: DcReport): Columns | null {
  return report.col_target && report.col_result ? { target: [report.col_target], result: [report.col_result] } : null;
}

/** A family is there only when the header has every one of its columns (SCHEMA §4.2) */
function hasColumns(block: DcYearBlock, cols: Columns): boolean {
  return [...cols.target, ...cols.result].every((c) => block.headers.includes(c));
}

/** The column families whose columns are all in the block's header (SCHEMA §4.1–4.2) */
export function families(block: DcYearBlock, report: DcReport): Family[] {
  const found: Family[] = FIXED_ORDER.filter((f) => hasColumns(block, FIXED_COLUMNS[f]));
  if (measures(block).length > 0) found.push("M_B");
  const override = overrideColumns(report);
  if (override && hasColumns(block, override)) found.push("OVERRIDE");
  return found;
}

/**
 * The measures of an M_B block in column order: each prefix (not target or
 * result) with all 12 {measure}_{MM} columns and target{MM} (SCHEMA §4.2)
 */
export function measures(block: DcYearBlock): string[] {
  const prefixes = new Set<string>();
  for (const h of block.headers) {
    const prefix = /^(.+)_(0[1-9]|1[0-2])$/.exec(h)?.[1];
    if (prefix && prefix !== "target" && prefix !== "result") prefixes.add(prefix);
  }
  return [...prefixes].filter((p) => hasColumns(block, monthColumns(`${p}_`)));
}

/** A measure as shown: upper case with "-" for "_" (dtp_hb3 → DTP-HB3) */
export function measureLabel(measure: string): string {
  return measure.toUpperCase().replace(/_/g, "-");
}

/**
 * The periods a block can show (SCHEMA §4.3): ทั้งปี when any rule finds it,
 * quarters with a quarter family, months with M_A or M_B; none when no rule
 * applies
 */
export function periods(block: DcYearBlock, report: DcReport): Period[] {
  const found = families(block, report);
  if (found.length === 0) return [];
  const out: Period[] = ["year"];
  if (QUARTER_ORDER.some((f) => found.includes(f))) out.push("q1", "q2", "q3", "q4");
  if (found.includes("M_A") || found.includes("M_B")) out.push(...MONTHS.map((m) => `m${m}` as const));
  return out;
}

/** n(v) of SCHEMA §4.3: the cell as a number when finite, otherwise 0 ("" too) */
function n(v: Cell | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** The columns summed into a row's target and result for a period (SCHEMA §4.3), or null when no rule applies */
function columns(block: DcYearBlock, report: DcReport, query: Pick<ReportQuery, "period" | "measure">): Columns | null {
  const { period, measure } = query;
  const found = families(block, report);
  // A selected measure that this year lacks is "—", not another family's value (SCHEMA §4.2)
  const measured = measure !== null && measures(block).includes(measure) ? monthColumns(`${measure}_`) : null;
  if (period === "year") {
    const override = overrideColumns(report);
    if (override && hasColumns(block, override)) return override;
    if (measure !== null) return measured;
    const family = FIXED_ORDER.find((f) => found.includes(f));
    return family ? FIXED_COLUMNS[family] : null;
  }
  if (period.startsWith("q")) {
    const family = QUARTER_ORDER.find((f) => found.includes(f));
    return family ? entry(FIXED_COLUMNS[family], Number(period.slice(1)) - 1) : null;
  }
  const cols = measure !== null ? measured : found.includes("M_A") ? FIXED_COLUMNS.M_A : null;
  return cols && entry(cols, MONTHS.findIndex((m) => `m${m}` === period));
}

/** The columns of quarter or month k alone */
function entry(cols: Columns, k: number): Columns {
  return { target: [cols.target[k]], result: [cols.result[k]] };
}

/** The tambon of an areacode: its first 6 digits (SPEC §10) */
function tambonOf(areacode: Cell | undefined): string {
  return String(areacode).slice(0, 6);
}

/** The rows of a tambon, or every row for "all" */
function rowsIn(block: DcYearBlock, area: string): Cell[][] {
  if (area === "all") return block.rows;
  const at = block.headers.indexOf("areacode");
  return block.rows.filter((row) => tambonOf(row[at]) === area);
}

/** Σ target and Σ result over the rows, then ร้อยละ = R / T × 100 when T > 0 (SCHEMA §4.4) */
function sum(block: DcYearBlock, cols: Columns, rows: Cell[][]): Totals {
  const at = (column: string) => block.headers.indexOf(column);
  const targetAt = cols.target.map(at);
  const resultAt = cols.result.map(at);
  let target = 0;
  let result = 0;
  for (const row of rows) {
    for (const i of targetAt) target += n(row[i]);
    for (const i of resultAt) result += n(row[i]);
  }
  return { target, result, pct: target > 0 ? (result / target) * 100 : null };
}

/**
 * Target, result and ร้อยละ of the rows in an area (or "all"), summed before
 * dividing (SCHEMA §4.4); null when no rule finds the columns for the period.
 * As in ReportQuery, measure is one of measures() of the year shown for an
 * M_B report and null otherwise; a block without that measure gives null.
 */
export function totals(
  block: DcYearBlock,
  report: DcReport,
  query: Pick<ReportQuery, "area" | "period" | "measure">,
): Totals | null {
  const cols = columns(block, report, query);
  return cols && sum(block, cols, rowsIn(block, query.area));
}

/**
 * Totals of the rows in an area per tambon or per hospcode, in code order and
 * named from catalog.json, else "รหัสพื้นที่ {code}" / "หน่วยบริการ {hospcode}"
 * (SCHEMA §4.4); null as totals
 */
export function totalsBy(
  block: DcYearBlock,
  report: DcReport,
  query: Pick<ReportQuery, "area" | "period" | "measure" | "by">,
  names: Pick<DcCatalog, "areas" | "hospitals">,
): UnitTotals[] | null {
  const cols = columns(block, report, query);
  if (!cols) return null;
  const unit =
    query.by === "area"
      ? {
          column: "areacode",
          keyOf: tambonOf,
          nameOf: (key: string) => names.areas.find((a) => a.id === key)?.name_th ?? `รหัสพื้นที่ ${key}`,
        }
      : {
          column: "hospcode",
          keyOf: (hospcode: Cell | undefined) => String(hospcode),
          nameOf: (key: string) => names.hospitals.find((h) => h.hospcode === key)?.hospname ?? `หน่วยบริการ ${key}`,
        };
  const at = block.headers.indexOf(unit.column);
  const units = new Map<string, Cell[][]>();
  for (const row of rowsIn(block, query.area)) {
    const key = unit.keyOf(row[at]);
    const rows = units.get(key);
    if (rows) rows.push(row);
    else units.set(key, [row]);
  }
  return [...units]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, rows]) => ({ key, name: unit.nameOf(key), totals: sum(block, cols, rows) }));
}

/** Totals of every block ปี with the same area, period and measure (SCHEMA §4.4), oldest year first */
export function trend(data: DcReportData, query: Pick<ReportQuery, "area" | "period" | "measure">): TrendPoint[] {
  return data.years.map((block) => ({ b_year: block.b_year, totals: totals(block, data.report, query) }));
}

/** เกณฑ์: measure_goals[measure] when kpi_epi has it, otherwise the report's goal (SCHEMA §4.4) */
export function goalFor(report: DcReport, measure: string | null): number | null {
  return measure !== null && Object.hasOwn(report.measure_goals, measure) ? report.measure_goals[measure] : report.goal;
}

/** pct ≥ goal before rounding, as PA does (SCHEMA §4.4); null when there is no ร้อยละ or no เกณฑ์ */
export function passes(pct: number | null, goal: number | null): boolean | null {
  return pct === null || goal === null ? null : pct >= goal;
}
