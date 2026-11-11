import type {
  Cell,
  DcCatalog,
  DcReport,
  DcReportData,
  DcYearBlock,
  Family,
  LibraryList,
  LibraryQuery,
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

// Worked out once per block ปี, which never changes once loaded: a filter
// change asks for the same block's columns dozens of times, s_epi1 has 259
// columns and 20 measures, and the result must show within 100 ms (SPEC §9.6).
const headerSets = new WeakMap<DcYearBlock, Set<string>>();
const blockMeasures = new WeakMap<DcYearBlock, readonly string[]>();

/** A family is there only when the header has every one of its columns (SCHEMA §4.2) */
function hasColumns(block: DcYearBlock, cols: Columns): boolean {
  const headers = headerSets.get(block) ?? new Set(block.headers);
  headerSets.set(block, headers);
  return [...cols.target, ...cols.result].every((c) => headers.has(c));
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
 * result) with all 12 {measure}_{MM} columns and target{MM} (SCHEMA §4.2),
 * the same array for the same block each time
 */
export function measures(block: DcYearBlock): readonly string[] {
  const known = blockMeasures.get(block);
  if (known) return known;
  const prefixes = new Set<string>();
  for (const h of block.headers) {
    const prefix = /^(.+)_(0[1-9]|1[0-2])$/.exec(h)?.[1];
    if (prefix && prefix !== "target" && prefix !== "result") prefixes.add(prefix);
  }
  const found = [...prefixes].filter((p) => hasColumns(block, monthColumns(`${p}_`)));
  blockMeasures.set(block, found);
  return found;
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

/**
 * The block ปี of a year when it has rows, else null: a block that the id
 * filter left empty (SCHEMA §3.2) has no data to show, not zeros
 */
export function yearBlock(data: DcReportData, year: string): DcYearBlock | null {
  return data.years.find((b) => b.b_year === year && b.rows.length > 0) ?? null;
}

/** The years with data, latest first: the ปีงบประมาณ a report page offers (SPEC §9.4) */
export function dataYears(data: DcReportData): string[] {
  return data.years.filter((b) => b.rows.length > 0).map((b) => b.b_year).reverse();
}

/**
 * The query of /reports/{id} (?year=&area=&period=&measure=&by=) as a
 * ReportQuery for the report's data, with the defaults of SCHEMA §9. A
 * 4-digit year without data is kept, so the page says so instead of showing
 * another year, and year is "" for a report without any data. measure and
 * period are always ones the year's columns have, as totals() expects.
 */
export function reportQuery(
  data: DcReportData,
  params: URLSearchParams,
  names: Pick<DcCatalog, "areas">,
): ReportQuery {
  const asked = params.get("year");
  const year = asked && /^\d{4}$/.test(asked) ? asked : (dataYears(data)[0] ?? "");
  const block = yearBlock(data, year);
  const found = block ? measures(block) : [];
  const measure = found.find((m) => m === params.get("measure")) ?? found[0] ?? null;
  const period = (block ? periods(block, data.report) : []).find((p) => p === params.get("period")) ?? "year";
  const area = names.areas.find((a) => a.id === params.get("area"))?.id ?? "all";
  // One ตำบล is compared by หน่วยบริการ only (SPEC §9.4)
  const by = area !== "all" || params.get("by") === "hosp" ? "hosp" : "area";
  return { year, area, period, measure, by };
}

/** The URL query of a ReportQuery, which reportQuery reads back: ?year=&area=&period=&measure=&by= (SPEC §9.4) */
export function reportSearch(query: ReportQuery): string {
  const params = new URLSearchParams({ year: query.year, area: query.area, period: query.period });
  if (query.measure !== null) params.set("measure", query.measure);
  params.set("by", query.by);
  return `?${params}`;
}

/** The query of /reports (?main=&cat=&q=) as a LibraryQuery, with the defaults of SCHEMA §9; an old link's page and size are not read */
export function libraryQuery(mains: DcCatalog["mains"], params: URLSearchParams): LibraryQuery {
  const cat = mains.flatMap((m) => m.topics).find((t) => t.cat_id === params.get("cat"))?.cat_id ?? null;
  // One หัวข้อ or one หมวด is picked at a time, and the หัวข้อ is the narrower
  const main = cat === null ? (mains.find((m) => m.main_report_id === params.get("main"))?.main_report_id ?? null) : null;
  return { main, cat, q: params.get("q") ?? "" };
}

/**
 * Every report /reports lists for a query (SPEC §9.3), by หัวข้อ and กลุ่ม
 * in catalog.json order: those of the หมวด or หัวข้อ picked whose
 * report_name, source_table, opendata_id, หัวข้อ or กลุ่ม contains the
 * search, whatever its letter case.
 */
export function libraryList(mains: DcCatalog["mains"], query: LibraryQuery): LibraryList {
  const search = query.q.trim().toLocaleLowerCase("th");
  const groups = mains
    .filter((m) => query.main === null || m.main_report_id === query.main)
    .flatMap((m) => m.topics.filter((t) => query.cat === null || t.cat_id === query.cat))
    .flatMap((topic) =>
      topic.groups.map((g) => ({
        topic,
        subgroup: g.subgroup,
        reports: g.reports.filter((report) =>
          [report.report_name, report.source_table, report.opendata_id, topic.category_name, g.subgroup].some((text) =>
            text.toLocaleLowerCase("th").includes(search),
          ),
        ),
      })),
    )
    .filter((g) => g.reports.length > 0);
  return { groups, total: groups.reduce((n, g) => n + g.reports.length, 0) };
}

/** The URL query of a LibraryQuery without its defaults, which libraryQuery reads back: "" for the defaults alone (SPEC §9.3) */
export function librarySearch(query: LibraryQuery): string {
  const params = new URLSearchParams();
  if (query.main !== null) params.set("main", query.main);
  if (query.cat !== null) params.set("cat", query.cat);
  if (query.q) params.set("q", query.q);
  const search = params.toString();
  return search && `?${search}`;
}
