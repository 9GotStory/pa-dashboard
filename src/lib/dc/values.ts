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

/** The months of a ปีงบประมาณ in order, ต.ค. … ก.ย. (SCHEMA §4.1) */
const MONTHS: Month[] = ["10", "11", "12", "01", "02", "03", "04", "05", "06", "07", "08", "09"];
const QUARTERS = [1, 2, 3, 4];

/** Quarter families in the order they are tried (SCHEMA §4.2), as prefixes of their target and result columns */
const QUARTER_FAMILIES = [
  { family: "Q_A", target: "target", result: "result" },
  { family: "Q_B", target: "targetq", result: "resultq" },
  { family: "Q_C", target: "t_q", result: "r_q" },
] as const;

/** The column families whose columns are all in the block's header (SCHEMA §4.1–4.2) */
export function families(block: DcYearBlock, report: Pick<DcReport, "col_target" | "col_result">): Family[] {
  const has = (columns: string[]) => columns.every((c) => block.headers.includes(c));
  const found: Family[] = [];
  if (has(["target", "result"])) found.push("ANNUAL");
  for (const q of QUARTER_FAMILIES) {
    if (has(QUARTERS.flatMap((n) => [q.target + n, q.result + n]))) found.push(q.family);
  }
  if (has(MONTHS.flatMap((m) => ["target" + m, "result" + m]))) found.push("M_A");
  if (measures(block).length > 0) found.push("M_B");
  if (report.col_target && report.col_result && has([report.col_target, report.col_result])) found.push("OVERRIDE");
  return found;
}

/**
 * The measures of an M_B block in column order: each prefix with all 12
 * {measure}_{MM} columns, when target{MM} has all 12 too (SCHEMA §4.2)
 */
export function measures(block: DcYearBlock): string[] {
  const has = (column: string) => block.headers.includes(column);
  if (!MONTHS.every((m) => has("target" + m))) return [];
  const prefixes: string[] = [];
  for (const h of block.headers) {
    const prefix = /^(.+)_(0[1-9]|1[0-2])$/.exec(h)?.[1];
    if (prefix && !prefixes.includes(prefix)) prefixes.push(prefix);
  }
  return prefixes.filter(
    (p) => p !== "target" && p !== "result" && MONTHS.every((m) => has(`${p}_${m}`)),
  );
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
export function periods(block: DcYearBlock, report: Pick<DcReport, "col_target" | "col_result">): Period[] {
  const found = families(block, report);
  if (found.length === 0) return [];
  const out: Period[] = ["year"];
  if (QUARTER_FAMILIES.some((q) => found.includes(q.family))) out.push("q1", "q2", "q3", "q4");
  if (found.includes("M_A") || found.includes("M_B")) out.push(...MONTHS.map((m) => `m${m}` as const));
  return out;
}

/** n(v) of SCHEMA §4.3: the cell as a number when finite, otherwise 0 ("" too) */
function n(v: Cell | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** The columns summed into a row's target and result for a period (SCHEMA §4.3), or null when no rule applies */
function columns(
  block: DcYearBlock,
  report: Pick<DcReport, "col_target" | "col_result">,
  period: Period,
  measure: string | null,
): { target: string[]; result: string[] } | null {
  const found = families(block, report);
  const quarter = QUARTER_FAMILIES.find((q) => found.includes(q.family));
  if (period === "year") {
    if (found.includes("OVERRIDE")) return { target: [report.col_target!], result: [report.col_result!] };
    // A measure missing from this year is "—", not another family's value (SCHEMA §4.2)
    if (measure !== null) {
      if (!measures(block).includes(measure)) return null;
      return { target: MONTHS.map((m) => "target" + m), result: MONTHS.map((m) => `${measure}_${m}`) };
    }
    if (found.includes("ANNUAL")) return { target: ["target"], result: ["result"] };
    if (quarter) return { target: QUARTERS.map((i) => quarter.target + i), result: QUARTERS.map((i) => quarter.result + i) };
    if (found.includes("M_A")) return { target: MONTHS.map((m) => "target" + m), result: MONTHS.map((m) => "result" + m) };
    return null;
  }
  const i = period.slice(1);
  if (period.startsWith("q")) return quarter ? { target: [quarter.target + i], result: [quarter.result + i] } : null;
  if (measure !== null) {
    return measures(block).includes(measure) ? { target: ["target" + i], result: [`${measure}_${i}`] } : null;
  }
  return found.includes("M_A") ? { target: ["target" + i], result: ["result" + i] } : null;
}

/** The rows of a tambon (the first 6 digits of areacode), or every row for "all" (SPEC §10) */
function rowsIn(block: DcYearBlock, area: string): Cell[][] {
  if (area === "all") return block.rows;
  const at = block.headers.indexOf("areacode");
  return block.rows.filter((row) => String(row[at]).slice(0, 6) === area);
}

/** Σ target and Σ result over the rows, then ร้อยละ = R / T × 100 when T > 0 (SCHEMA §4.4) */
function sum(block: DcYearBlock, cols: { target: string[]; result: string[] }, rows: Cell[][]): Totals {
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
 * dividing (SCHEMA §4.4); null when no rule finds the columns for the period
 */
export function totals(
  block: DcYearBlock,
  report: Pick<DcReport, "col_target" | "col_result">,
  q: Pick<ReportQuery, "area" | "period" | "measure">,
): Totals | null {
  const cols = columns(block, report, q.period, q.measure);
  return cols && sum(block, cols, rowsIn(block, q.area));
}

/**
 * Totals of the rows in an area per tambon (the first 6 digits of areacode)
 * or per hospcode, in code order and named from catalog.json, else
 * "รหัสพื้นที่ {code}" / "หน่วยบริการ {hospcode}" (SCHEMA §4.4); null as totals
 */
export function totalsBy(
  block: DcYearBlock,
  report: Pick<DcReport, "col_target" | "col_result">,
  q: Pick<ReportQuery, "area" | "period" | "measure" | "by">,
  names: Pick<DcCatalog, "areas" | "hospitals">,
): UnitTotals[] | null {
  const cols = columns(block, report, q.period, q.measure);
  if (!cols) return null;
  const at = block.headers.indexOf(q.by === "area" ? "areacode" : "hospcode");
  const units = new Map<string, Cell[][]>();
  for (const row of rowsIn(block, q.area)) {
    const key = q.by === "area" ? String(row[at]).slice(0, 6) : String(row[at]);
    const rows = units.get(key);
    if (rows) rows.push(row);
    else units.set(key, [row]);
  }
  return [...units]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, rows]) => ({
      key,
      name:
        q.by === "area"
          ? (names.areas.find((a) => a.id === key)?.name_th ?? `รหัสพื้นที่ ${key}`)
          : (names.hospitals.find((h) => h.hospcode === key)?.hospname ?? `หน่วยบริการ ${key}`),
      totals: sum(block, cols, rows),
    }));
}

/** Totals of every block ปี with the same area, period and measure (SCHEMA §4.4), oldest year first */
export function trend(data: DcReportData, q: Pick<ReportQuery, "area" | "period" | "measure">): TrendPoint[] {
  return data.years.map((block) => ({ b_year: block.b_year, totals: totals(block, data.report, q) }));
}

/** เกณฑ์: measure_goals[measure] when kpi_epi has it, otherwise the report's goal (SCHEMA §4.4) */
export function goalFor(report: Pick<DcReport, "goal" | "measure_goals">, measure: string | null): number | null {
  return (measure !== null ? report.measure_goals[measure] : undefined) ?? report.goal;
}

/** pct ≥ goal before rounding, as PA does (SCHEMA §4.4); null when there is no ร้อยละ or no เกณฑ์ */
export function passes(pct: number | null, goal: number | null): boolean | null {
  return pct === null || goal === null ? null : pct >= goal;
}
