import type { DcCatalog, DcReportData, ReportQuery, Totals } from "../types";
import { count, countsBy, goalFor, passes, pctOf, totals, totalsBy, yearBlock } from "../values";

// The data layer of the กรวยปีเดียว page (SPEC §9.4, ADR-0015) for
// s_dental_0_5_cavity_free: one row per หมู่บ้าน, 2569 alone, c → b → a
// (SCHEMA §4.6.11). The report's ร้อยละ is a ÷ b through its col_target b and
// col_result a (SCHEMA §6), so totals() gives it. Its result has no type in
// types.ts (SPEC §2.7): the view takes it as ReturnType<typeof cavityValues>.

/**
 * Every value the กรวยปีเดียว page shows for a query: the area and
 * เปรียบเทียบตาม of the query, ทั้งปี alone, no trend (the table has one
 * year)
 */
export function cavityValues(data: DcReportData, query: ReportQuery, names: Pick<DcCatalog, "areas" | "hospitals">) {
  const block = yearBlock(data, query.year);
  const total = block && totals(block, data.report, query);
  const goal = goalFor(data.report, null);
  const children = block && total && count(block, "c", query.area);
  // c of each unit, keyed as totalsBy names them (both go by unitRows)
  const childrenOf = new Map((block && countsBy(block, "c", query, names))?.map((u) => [u.key, u.count]));
  const units = block && totalsBy(block, data.report, query, names);
  return {
    /** The block ปี of query.year, null when the report has none: "ไม่มีข้อมูลปี … ในระบบ" */
    block,
    /** ตรวจช่องปาก (b) as เป้าหมาย and ฟันดีไม่มีผุ (a) as ผลงาน of the area; null when the district has no a that year */
    total,
    goal,
    /** ร้อยละฟันดีไม่มีผุ ≥ เกณฑ์; null without a ร้อยละ or a เกณฑ์ */
    passed: passes(total?.pct ?? null, goal),
    /** The กรวย of the area; null with total */
    funnel: total && funnelOf(children ?? 0, total),
    /** The ตำบล or หน่วยบริการ of query.by in the area, each with its กรวย; null with total */
    units: units && units.map((u) => ({ ...u, funnel: funnelOf(childrenOf.get(u.key) ?? 0, u.totals) })),
  };
}

/**
 * A กรวย: เด็ก 0–5 ปี (c) → ตรวจช่องปาก (b) → ฟันดีไม่มีผุ (a), with
 * ร้อยละตรวจช่องปาก b ÷ c and ร้อยละฟันดีไม่มีผุ a ÷ b, the report's ร้อยละ
 * that totals gives
 */
function funnelOf(children: number, totals: Totals) {
  return {
    children,
    screened: totals.target,
    cavityFree: totals.result,
    screenedPct: pctOf(totals.target, children),
    cavityFreePct: totals.pct,
  };
}
