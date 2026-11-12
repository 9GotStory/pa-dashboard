import type { DcCatalog, DcReportData, DcYearBlock, ReportQuery } from "../types";
import { DOMAIN_LABELS, count, countsBy, goalFor, passes, totals, totalsBy, trend, yearBlock } from "../values";

// The data layer of the AGED9 page (SPEC §9.4, ADR-0015) for s_aged9: one row
// per หมู่บ้าน, ทั้งปี only, with the 9 ด้าน result1–9 (SCHEMA §4.6.7).
// Worked out with values.ts, no formula of its own: no React, no DOM. Its
// result has no type in types.ts (SPEC §2.7): the view takes it as
// ReturnType<typeof aged9Values>.

/**
 * Every value the AGED9 page shows for a query: ความครอบคลุม of the area
 * with เปรียบเทียบตาม, the 9 ด้าน, and the รายละเอียด of query.domain when
 * one is open (period and measure are not used: the table has ทั้งปี only)
 */
export function aged9Values(data: DcReportData, query: ReportQuery, names: Pick<DcCatalog, "areas" | "hospitals">, years: string[]) {
  const block = yearBlock(data, query.year);
  const total = block && totals(block, data.report, query);
  const goal = goalFor(data.report, null);
  // A year of the window without a block ปี is "—", not left out of the axis (SCHEMA §4.2)
  const byYear = new Map(trend(data, query).map((point) => [point.b_year, point]));
  return {
    /** The block ปี of query.year, null when the report has none: "ไม่มีข้อมูลปี … ในระบบ" */
    block,
    /** ความครอบคลุม of the area; null when the whole district has no ผลงาน that year ("—", ปี 2565) */
    total,
    goal,
    /** ร้อยละ ≥ เกณฑ์; null without a ร้อยละ or a เกณฑ์ */
    passed: passes(total?.pct ?? null, goal),
    /** The ตำบล or หน่วยบริการ of query.by in the area; null with total */
    units: block && totalsBy(block, data.report, query, names),
    /** Each year of years with the area; a year without a block ปี or without data has totals null */
    trend: years.map((year) => byYear.get(year) ?? { b_year: year, totals: null }),
    /** ผลการคัดกรองทั้ง 9 ด้าน in the area: count null when the district has no ผลงาน of the ด้าน that year ("—") */
    domains: block
      ? DOMAIN_LABELS.map((label, i) => ({ domain: i + 1, label, count: count(block, `result${i + 1}`, query.area) }))
      : [],
    /** รายละเอียด of query.domain, null for ภาพรวม */
    detail: block && query.domain !== null ? domainDetail(block, { ...query, domain: query.domain }, names) : null,
  };
}

/** The รายละเอียด of the open ด้าน (query.domain) in the block ปี of query.year: its count in the area, and per ตำบล or หน่วยบริการ (query.by) */
function domainDetail(block: DcYearBlock, query: ReportQuery & { domain: number }, names: Pick<DcCatalog, "areas" | "hospitals">) {
  const column = `result${query.domain}`;
  return {
    domain: query.domain,
    label: DOMAIN_LABELS[query.domain - 1],
    /** The ด้าน in the area; null when the district has no ผลงาน of it that year ("—") */
    count: count(block, column, query.area),
    /** Each ตำบล or หน่วยบริการ; null with count */
    units: countsBy(block, column, query, names),
  };
}
