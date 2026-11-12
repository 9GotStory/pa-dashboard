import type { DcCatalog, DcReportData, DcYearBlock, ReportQuery } from "../types";
import { goalFor, measureLabel, passes, periods, shownMeasures, totals, totalsBy, trend, yearBlock } from "../values";

// The data layer of the EPI1 page (SPEC §9.4, ADR-0015) for s_epi1: one row
// per หมู่บ้าน, M_B with 20 รายการ (SCHEMA §4.6.4). Worked out with values.ts,
// no formula of its own: no React, no DOM. Its result has no type in types.ts
// (SPEC §2.7): the view takes it as ReturnType<typeof epiValues>.

/**
 * Every value the EPI1 page shows for a query: ภาพรวม, one row per รายการ in
 * column order, and the รายละเอียด of query.measure when one is open, for the
 * area and ช่วงเวลา of the query. There is no เปรียบเทียบตาม (SPEC §9.4):
 * ทั้งอำเภอ is by ตำบล and a ตำบล by หน่วยบริการ, whatever ?by= says.
 */
export function epiValues(data: DcReportData, query: ReportQuery, names: Pick<DcCatalog, "areas" | "hospitals">, years: string[]) {
  const shown: ReportQuery = { ...query, by: query.area === "all" ? "area" : "hosp" };
  const block = yearBlock(data, query.year);
  return {
    /** The query shown: query with its by from the area */
    query: shown,
    /** The block ปี of query.year, null when the report has none: "ไม่มีข้อมูลปี … ในระบบ" */
    block,
    /** ภาพรวม: each รายการ of the year in column order */
    rows: block ? shownMeasures(data, block).map((measure) => measureRow(data, block, { ...shown, measure })) : [],
    /** รายละเอียด of query.measure, null for ภาพรวม */
    detail: block && shown.measure !== null ? measureDetail(data, block, { ...shown, measure: shown.measure }, names, years) : null,
  };
}

/** A รายการ (query.measure) in the area and ช่วงเวลา of query: a row of ภาพรวม, and ตัวเลขสรุป of its รายละเอียด */
function measureRow(data: DcReportData, block: DcYearBlock, query: ReportQuery & { measure: string }) {
  const total = totals(block, data.report, query);
  const goal = goalFor(data.report, query.measure);
  return {
    measure: query.measure,
    label: measureLabel(query.measure),
    /** null when the district has no ผลงาน of the รายการ that year ("—") */
    total,
    /** null without a เกณฑ์ (PCV): "ไม่มีเกณฑ์" */
    goal,
    /** ร้อยละ ≥ เกณฑ์; null without a ร้อยละ or a เกณฑ์ */
    passed: passes(total?.pct ?? null, goal),
  };
}

/** The รายละเอียด of the open รายการ (query.measure) in the block ปี of query.year, with the trend over years (catalog.meta.years) */
function measureDetail(
  data: DcReportData,
  block: DcYearBlock,
  query: ReportQuery & { measure: string },
  names: Pick<DcCatalog, "areas" | "hospitals">,
  years: string[],
) {
  // A year of the window without a block ปี is "—", not left out of the axis (SCHEMA §4.2)
  const byYear = new Map(trend(data, query).map((point) => [point.b_year, point]));
  // รายไตรมาส when a ไตรมาส is picked, else รายเดือน (SPEC §9.4)
  const byQuarter = query.period.startsWith("q");
  return {
    ...measureRow(data, block, query),
    /** The ตำบล, or the หน่วยบริการ of a ตำบล; null with total */
    units: totalsBy(block, data.report, query, names),
    /** Each year of years with the area and ช่วงเวลา; a year without a block ปี or without data of the รายการ has totals null */
    trend: years.map((year) => byYear.get(year) ?? { b_year: year, totals: null }),
    /** Whether steps are by ไตรมาส (a ไตรมาส picked) or by เดือน */
    byQuarter,
    /** เป้าหมาย/ผลงาน of the year and area by ไตรมาส (the sum of its 3 months, SCHEMA §4.3) or by เดือน */
    steps: periods(block, data.report)
      .filter((p) => p.startsWith(byQuarter ? "q" : "m"))
      .map((period) => ({ period, totals: totals(block, data.report, { ...query, period }) })),
  };
}

/**
 * The rows of ภาพรวม whose name as shown contains a search, whatever its
 * letter case and the spaces around it: the ช่องค้นหา of s_epi1, which tells
 * "พบ N จาก M" (SPEC §9.4); every row for an empty search
 */
export function findMeasures<Row extends { label: string }>(rows: Row[], search: string): Row[] {
  const key = search.trim().toLowerCase();
  return rows.filter((r) => r.label.toLowerCase().includes(key));
}
