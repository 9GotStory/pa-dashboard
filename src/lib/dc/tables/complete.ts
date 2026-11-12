import type { DcCatalog, DcReportData, ReportQuery } from "../types";
import { periods, totals } from "../values";
import { ancValues } from "./anc";

// The data layer of the ครบตามเกณฑ์ page (SPEC §9.4, ADR-0015) for
// s_epi_complete, one page for its 4 reports (อายุ 1, 2, 3 and 5 ปี): one row
// per หมู่บ้าน, ทั้งปี + M_A (SCHEMA §4.6.5). SPEC lays it out "แบบ ANC แต่
// เป้าหมาย/ผลงานรายเดือน", so it takes the ANC page's values with months in
// place of quarters. Its result has no type in types.ts (SPEC §2.7).

/**
 * Every value the ครบตามเกณฑ์ page shows for a query: the ANC page's, with
 * the 12 months of the year and area whatever ช่วงเวลา is picked
 */
export function completeValues(data: DcReportData, query: ReportQuery, names: Pick<DcCatalog, "areas" | "hospitals">, years: string[]) {
  // Not the ANC page's quarters: M_A has none (SCHEMA §4.1)
  const { block, total, goal, passed, units, trend } = ancValues(data, query, names, years);
  return {
    block,
    total,
    goal,
    passed,
    units,
    trend,
    /** เดือน ต.ค.–ก.ย. of the year and area; [] when the year has none */
    months: block
      ? periods(block, data.report)
          .filter((p) => p.startsWith("m"))
          .map((period) => ({ period, totals: totals(block, data.report, { ...query, period }) }))
      : [],
  };
}
