import type { DcCatalog, DcReportData, ReportQuery } from "../types";
import { count } from "../values";
import { ancValues } from "./anc";

// The data layer of the ตัวชี้วัดเดียวรายปี page (SPEC §9.4, ADR-0015) for
// s_kpi_food, s_kpi_dental28 and s_kpi_dental33: one row per หมู่บ้าน, ทั้งปี
// alone (SCHEMA §4.6.6, §4.6.12). Its result has no type in types.ts (SPEC
// §2.7): the view takes it as ReturnType<typeof annualValues>.

/** The เดือนอายุ 1–6 of s_kpi_food, เดือนอายุ k being column r{k} (SCHEMA §4.6.6) */
const AGE_MONTHS = [1, 2, 3, 4, 5, 6] as const;

/**
 * Every value the ตัวชี้วัดเดียวรายปี page shows for a query: the ANC page's
 * for ทั้งปี (reportQuery gives no other ช่วงเวลา, as the quarter family of
 * s_kpi_food is empty every year), and the count of each เดือนอายุ of
 * s_kpi_food in the area
 */
export function annualValues(
  data: DcReportData,
  query: ReportQuery,
  names: Pick<DcCatalog, "areas" | "hospitals">,
  years: string[],
) {
  const { block, total, goal, passed, units, trend } = ancValues(data, query, names, years);
  return {
    block,
    total,
    goal,
    passed,
    units,
    trend,
    /**
     * ตอบว่ากินนมแม่อย่างเดียว at each เดือนอายุ 1–6 in the area, as counts:
     * one child may count at several, so they add up to more than ผลงาน
     * (SCHEMA §4.6.6). null for a table without them (the dental tables) and
     * with total null; with a total the district has data that year, so an
     * empty column is 0, not "—".
     */
    ageMonths:
      block && total && block.headers.includes("r1")
        ? AGE_MONTHS.map((month) => ({ month, count: count(block, `r${month}`, query.area) ?? 0 }))
        : null,
  };
}
