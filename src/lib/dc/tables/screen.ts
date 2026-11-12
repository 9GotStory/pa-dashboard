import type { DcCatalog, DcReportData, ReportQuery } from "../types";
import { cumulative } from "../values";
import { ancValues } from "./anc";

// The data layer of the คัดกรองเบาหวานและความดัน page (SPEC §9.4, ADR-0015)
// for s_dm_screen and s_ht_screen: one row per หมู่บ้าน, ทั้งปี + ผลงาน
// รายไตรมาส result1–4 without a เป้าหมาย รายไตรมาส (SCHEMA §4.6.8). Its
// result has no type in types.ts (SPEC §2.7): the view takes it as
// ReturnType<typeof screenValues>.

/** ไตรมาส 1–4 and their ผลงาน columns (SCHEMA §4.6.8) */
const QUARTERS = ["q1", "q2", "q3", "q4"] as const;
const QUARTER_COLUMNS = ["result1", "result2", "result3", "result4"];

/**
 * Every value the คัดกรองเบาหวานและความดัน page shows for a query: the ANC
 * page's for ทั้งปี (reportQuery gives no other ช่วงเวลา, as the tables have
 * no quarter family), and ร้อยละสะสม รายไตรมาส of the area
 */
export function screenValues(data: DcReportData, query: ReportQuery, names: Pick<DcCatalog, "areas" | "hospitals">, years: string[]) {
  // Not the ANC page's quarters: result1–4 have no target1–4 (SCHEMA §4.1)
  const { block, total, goal, passed, units, trend } = ancValues(data, query, names, years);
  return {
    block,
    total,
    goal,
    passed,
    units,
    trend,
    /**
     * ไตรมาส 1–4 of the year and area: its ผลงาน, ผลงานสะสม to it, and
     * ร้อยละสะสม = ผลงานสะสม ÷ the ทั้งปี เป้าหมาย × 100 (SPEC §9.4); [] with total null
     */
    quarters: block && total ? cumulative(block, QUARTER_COLUMNS, query.area, total.target).map((q, i) => ({ period: QUARTERS[i], ...q })) : [],
  };
}
