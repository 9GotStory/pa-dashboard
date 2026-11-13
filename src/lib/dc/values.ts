import { POPULATION_REPORT } from "./population-report";
import type {
  Cell,
  DcCatalog,
  DcReport,
  DcReportData,
  DcTopic,
  DcYearBlock,
  Family,
  LibraryList,
  LibraryMain,
  LibraryQuery,
  LibraryReport,
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

/**
 * The รายการ a page offers for a block ปี: its measures() that have a ผลงาน
 * in the whole district in some block ปี of the report, in column order. A
 * measure without one in any year is not a รายการ (SCHEMA §4.2); one without
 * it this year only is kept and shown as no data.
 */
export function shownMeasures(data: DcReportData, block: DcYearBlock): string[] {
  return measures(block).filter((m) =>
    data.years.some((b) => measures(b).includes(m) && collected(b, monthColumns(`${m}_`))),
  );
}

/** A measure as shown: upper case with "-" for "_" (dtp_hb3 → DTP-HB3) */
export function measureLabel(measure: string): string {
  return measure.toUpperCase().replace(/_/g, "-");
}

/** The names of the 9 ด้าน of s_aged9 in order: ด้าน k is result{k} (SCHEMA §4.6.7) */
export const DOMAIN_LABELS = [
  "การมองเห็น",
  "การกลั้นปัสสาวะ",
  "การได้ยิน",
  "การปฏิบัติกิจวัตรประจำวัน",
  "ความคิดความจำ",
  "ภาวะซึมเศร้า (2Q)",
  "การเคลื่อนไหว",
  "สุขภาพช่องปาก",
  "ภาวะขาดสารอาหาร",
] as const;

/**
 * The periods a block can show (SCHEMA §4.3): ทั้งปี when any rule finds it,
 * quarters with a quarter family or with M_B (the sum of 3 months), months
 * with M_A or M_B; none when no rule applies. Quarters and months only when
 * the whole district has a ผลงาน in them that year (SPEC §9.4 "ว่างทั้งปี").
 */
export function periods(block: DcYearBlock, report: DcReport): Period[] {
  const found = families(block, report);
  if (found.length === 0) return [];
  const out: Period[] = ["year"];
  const quarters = QUARTER_ORDER.find((f) => found.includes(f));
  const measured = measures(block).some((m) => collected(block, monthColumns(`${m}_`)));
  if (quarters ? collected(block, FIXED_COLUMNS[quarters]) : measured) out.push("q1", "q2", "q3", "q4");
  if (measured || (found.includes("M_A") && collected(block, FIXED_COLUMNS.M_A)))
    out.push(...MONTHS.map((m) => `m${m}` as const));
  return out;
}

/** n(v) of SCHEMA §4.3: the cell as a number when finite, otherwise 0 ("" too) */
function n(v: Cell | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/**
 * The columns of the level a period is part of: ทั้งปี, all 4 quarters or all
 * 12 months (SCHEMA §4.3), or null when no rule applies
 */
function level(block: DcYearBlock, report: DcReport, query: Pick<ReportQuery, "period" | "measure">): Columns | null {
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
    // M_B has no quarter family: a quarter is the sum of its 3 months (SCHEMA §4.3)
    return family ? FIXED_COLUMNS[family] : measure !== null ? measured : null;
  }
  return measure !== null ? measured : found.includes("M_A") ? FIXED_COLUMNS.M_A : null;
}

/**
 * The columns summed into a row's target and result for a period, out of its
 * level's (SCHEMA §4.3): a quarter is 1 column of 4, or 3 of the 12 months
 */
function columns(cols: Columns, period: Period): Columns {
  if (period === "year") return cols;
  if (period.startsWith("q")) {
    const size = cols.target.length / 4;
    return entries(cols, (Number(period.slice(1)) - 1) * size, size);
  }
  return entries(
    cols,
    MONTHS.findIndex((m) => `m${m}` === period),
    1,
  );
}

/** The columns of the quarters or months k to k + size − 1 */
function entries(cols: Columns, k: number, size: number): Columns {
  return { target: cols.target.slice(k, k + size), result: cols.result.slice(k, k + size) };
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

/** ร้อยละ = R / T × 100 when T > 0, else null: "—" (SCHEMA §4.4) */
export function pctOf(result: number, target: number): number | null {
  return target > 0 ? (result / target) * 100 : null;
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
  return { target, result, pct: pctOf(result, target) };
}

/**
 * Whether the rows of the whole district hold a ผลงาน in these columns. HDC
 * keeps 0 as "" (SCHEMA §4.6.1), so a district total of 0 was not collected:
 * no data, whatever area is shown (SPEC §9.4 "ว่างทั้งปี").
 */
function collected(block: DcYearBlock, cols: Columns): boolean {
  return sum(block, cols, block.rows).result > 0;
}

/**
 * The columns of a period when the whole district has a ผลงาน in its level
 * that year, else null: no rule applies, or the year has no data
 */
function collectedColumns(
  block: DcYearBlock,
  report: DcReport,
  query: Pick<ReportQuery, "period" | "measure">,
): Columns | null {
  const all = level(block, report, query);
  return all && collected(block, all) ? columns(all, query.period) : null;
}

/**
 * Target, result and ร้อยละ of the rows in an area (or "all"), summed before
 * dividing (SCHEMA §4.4); null when no rule finds the columns for the period,
 * or when the whole district has no ผลงาน in its level that year, so an area
 * with none in a year the district has data gets 0 (SPEC §9.4).
 * As in ReportQuery, measure is one of measures() of the year shown for an
 * M_B report and null otherwise; a block without that measure gives null.
 */
export function totals(
  block: DcYearBlock,
  report: DcReport,
  query: Pick<ReportQuery, "area" | "period" | "measure">,
): Totals | null {
  const cols = collectedColumns(block, report, query);
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
  const cols = collectedColumns(block, report, query);
  return (
    cols && unitRows(block, query, names).map(({ key, name, rows }) => ({ key, name, totals: sum(block, cols, rows) }))
  );
}

/** The rows in an area per tambon or per hospcode (query.by), in code order and named as totalsBy */
function unitRows(
  block: DcYearBlock,
  query: Pick<ReportQuery, "area" | "by">,
  names: Pick<DcCatalog, "areas" | "hospitals">,
) {
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
  return [...units].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, rows]) => ({ key, name: unit.nameOf(key), rows }));
}

/**
 * A column that is a count alone, without a เป้าหมาย: ด้าน k of s_aged9 is
 * result{k} (SCHEMA §4.6.7), and so is ผลงาน รายไตรมาส k of s_dm_screen and
 * s_ht_screen (SCHEMA §4.6.8)
 */
function countColumns(column: string): Columns {
  return { target: [], result: [column] };
}

/**
 * Σ of a count column over the rows of an area (or "all"), as n(v) reads
 * each cell; null when the whole district's Σ is 0 that year: not collected,
 * so an area with none in a year the district has data gets 0 (SPEC §9.4)
 */
export function count(block: DcYearBlock, column: string, area: string): number | null {
  const cols = countColumns(column);
  return collected(block, cols) ? sum(block, cols, rowsIn(block, area)).result : null;
}

/** count() per tambon or per hospcode (query.by) in the area, in code order and named as totalsBy; null as count */
export function countsBy(
  block: DcYearBlock,
  column: string,
  query: Pick<ReportQuery, "area" | "by">,
  names: Pick<DcCatalog, "areas" | "hospitals">,
): { key: string; name: string; count: number }[] | null {
  const cols = countColumns(column);
  if (!collected(block, cols)) return null;
  return unitRows(block, query, names).map(({ key, name, rows }) => ({
    key,
    name,
    count: sum(block, cols, rows).result,
  }));
}

/**
 * ร้อยละสะสม (SPEC §9.4) of ผลงาน columns in order that have no เป้าหมาย of
 * their own, as result1–4 of s_dm_screen and s_ht_screen (SCHEMA §4.6.8): for
 * each, its ผลงาน and the Σ of it and those before it over the rows of an
 * area, as n(v) reads each cell, ÷ the เป้าหมาย of the area × 100; pct null
 * when that is 0. An empty column adds 0, so the last is the ทั้งปี ร้อยละ
 * when the columns add up to result.
 */
export function cumulative(block: DcYearBlock, columns: readonly string[], area: string, target: number) {
  const rows = rowsIn(block, area);
  let sofar = 0;
  return columns.map((column) => {
    const result = sum(block, countColumns(column), rows).result;
    sofar += result;
    return { result, cumulative: sofar, pct: pctOf(sofar, target) };
  });
}

/** Totals of every block ปี with the same area, period and measure (SCHEMA §4.4), oldest year first */
export function trend(data: DcReportData, query: Pick<ReportQuery, "area" | "period" | "measure">): TrendPoint[] {
  return data.years.map((block) => ({ b_year: block.b_year, totals: totals(block, data.report, query) }));
}

/**
 * เกณฑ์: measure_goals[measure] alone for a รายการ, null when kpi_epi lacks it
 * (PCV), never the report's goal; the report's goal for a ตัวชี้วัด without
 * รายการ (SCHEMA §4.4, SPEC §9.4)
 */
export function goalFor(report: DcReport, measure: string | null): number | null {
  if (measure === null) return report.goal;
  return Object.hasOwn(report.measure_goals, measure) ? report.measure_goals[measure] : null;
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
  return data.years
    .filter((b) => b.rows.length > 0)
    .map((b) => b.b_year)
    .reverse();
}

/**
 * The query of /reports/{id} (?year=&area=&period=&measure=&by=&domain=) as a
 * ReportQuery for the report's data, with the defaults of SCHEMA §9. A
 * 4-digit year without data is kept, so the page says so instead of showing
 * another year, and year is "" for a report without any data. measure and
 * period are always ones the year's columns have, as totals() expects:
 * measure null is ภาพรวม, also for a measure the year lacks (SPEC §9.4).
 */
export function reportQuery(data: DcReportData, params: URLSearchParams, names: Pick<DcCatalog, "areas">): ReportQuery {
  const asked = params.get("year");
  const year = asked && /^\d{4}$/.test(asked) ? asked : (dataYears(data)[0] ?? "");
  const block = yearBlock(data, year);
  const found = block ? shownMeasures(data, block) : [];
  const measure = found.find((m) => m === params.get("measure")) ?? null;
  const period = (block ? periods(block, data.report) : []).find((p) => p === params.get("period")) ?? "year";
  const area = names.areas.find((a) => a.id === params.get("area"))?.id ?? "all";
  // One ตำบล is compared by หน่วยบริการ only (SPEC §9.4)
  const by = area !== "all" || params.get("by") === "hosp" ? "hosp" : "area";
  // The ด้าน 1–9 of s_aged9 alone: result{k} of another table is not a ด้าน (SCHEMA §4.6.7)
  const asks = params.get("domain");
  const domain = data.report.source_table === "s_aged9" && asks && /^[1-9]$/.test(asks) ? Number(asks) : null;
  return { year, area, period, measure, by, domain };
}

/** The URL query of a ReportQuery, which reportQuery reads back: ?year=&area=&period=&measure=&by=&domain= (SPEC §9.4) */
export function reportSearch(query: ReportQuery): string {
  const params = new URLSearchParams({ year: query.year, area: query.area, period: query.period });
  if (query.measure !== null) params.set("measure", query.measure);
  params.set("by", query.by);
  if (query.domain !== null) params.set("domain", String(query.domain));
  return `?${params}`;
}

/**
 * The หมวด, หัวข้อ, กลุ่ม and reports that /reports and the home page list
 * (SPEC §9.2–9.3): รายงานประชากร first, in its own หมวด and หัวข้อ (SPEC
 * §5.6), empty when reports/population.json has no year, then catalog.json's
 * in its order. An HDC report is searched by its source_table and
 * opendata_id too; รายงานประชากร, which has neither, by its keywords.
 */
export function libraryMains(mains: DcCatalog["mains"], hasPopulation: boolean): LibraryMain[] {
  const { id, report_name, keywords, ...topic } = POPULATION_REPORT;
  const population: LibraryMain = {
    main_report_id: topic.main_report_id,
    main_report_name: topic.main_report_name,
    topics: [
      {
        ...topic,
        order: null,
        groups: [
          { subgroup: "", reports: [{ id, report_name, references: keywords, removed: false, empty: !hasPopulation }] },
        ],
      },
    ],
  };
  const hdc = (r: DcReport): LibraryReport => ({
    id: r.opendata_id,
    report_name: r.report_name,
    references: [r.source_table, r.opendata_id],
    removed: r.catalog_status === "removed",
    empty: r.years.length === 0,
  });
  return [
    population,
    ...mains.map((m) => ({
      ...m,
      topics: m.topics.map((t) => ({ ...t, groups: t.groups.map((g) => ({ ...g, reports: g.reports.map(hdc) })) })),
    })),
  ];
}

/** The query of /reports (?main=&cat=&q=) as a LibraryQuery, with the defaults of SCHEMA §9; an old link's page and size are not read */
export function libraryQuery(mains: LibraryMain[], params: URLSearchParams): LibraryQuery {
  const cat = mains.flatMap((m) => m.topics).find((t) => t.cat_id === params.get("cat"))?.cat_id ?? null;
  // One หัวข้อ or one หมวด is picked at a time, and the หัวข้อ is the narrower
  const main =
    cat === null ? (mains.find((m) => m.main_report_id === params.get("main"))?.main_report_id ?? null) : null;
  return { main, cat, q: params.get("q") ?? "" };
}

/** A search as /reports compares it: no spaces around it, lower case */
function searchKey(q: string): string {
  return q.trim().toLocaleLowerCase("th");
}

/** Whether some text contains a search key, whatever its letter case */
function contains(texts: string[], key: string): boolean {
  return texts.some((text) => text.toLocaleLowerCase("th").includes(key));
}

/** The texts /reports shows of a report: its name, หัวข้อ, กลุ่ม and หมวด */
function shownTexts(report: LibraryReport, topic: DcTopic, subgroup: string): string[] {
  return [report.report_name, topic.category_name, subgroup, topic.main_report_name];
}

/**
 * Every report /reports lists for a query (SPEC §9.3), by หัวข้อ and กลุ่ม
 * in libraryMains order: those of the หมวด or หัวข้อ picked whose
 * report_name, หัวข้อ, กลุ่ม, หมวด or references contains the search,
 * whatever its letter case.
 */
export function libraryList(mains: LibraryMain[], query: LibraryQuery): LibraryList {
  const key = searchKey(query.q);
  const groups = mains
    .filter((m) => query.main === null || m.main_report_id === query.main)
    .flatMap((m) => m.topics.filter((t) => query.cat === null || t.cat_id === query.cat))
    .flatMap((topic) =>
      topic.groups.map((g) => ({
        topic,
        subgroup: g.subgroup,
        reports: g.reports.filter((report) =>
          contains([...shownTexts(report, topic, g.subgroup), ...report.references], key),
        ),
      })),
    )
    .filter((g) => g.reports.length > 0);
  return { groups, total: groups.reduce((n, g) => n + g.reports.length, 0) };
}

/**
 * Whether the list of a query holds a report that matches the search only by
 * its references, which /reports does not show: the note under the list's
 * heading (SPEC §9.3).
 */
export function libraryByReference(mains: LibraryMain[], query: LibraryQuery): boolean {
  const key = searchKey(query.q);
  return libraryList(mains, query).groups.some((g) =>
    g.reports.some((report) => !contains(shownTexts(report, g.topic, g.subgroup), key)),
  );
}

/** A piece of a report name, mark when it is the search */
type NamePart = { text: string; mark: boolean };

/**
 * A report name in parts, mark for each place that contains the search
 * whatever its letter case, as libraryList finds it: /reports wraps them in
 * <mark> (SPEC §9.3). The parts join back into the name.
 */
export function libraryNameParts(name: string, q: string): NamePart[] {
  const key = searchKey(q);
  const lower = name.toLocaleLowerCase("th");
  const parts: NamePart[] = [];
  let from = 0;
  for (let at = key ? lower.indexOf(key) : -1; at >= 0; at = lower.indexOf(key, from)) {
    if (at > from) parts.push({ text: name.slice(from, at), mark: false });
    parts.push({ text: name.slice(at, at + key.length), mark: true });
    from = at + key.length;
  }
  if (from < name.length) parts.push({ text: name.slice(from), mark: false });
  return parts;
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
