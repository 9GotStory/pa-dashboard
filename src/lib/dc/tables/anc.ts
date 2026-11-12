import type { AncValues, DcCatalog, DcReportData, ReportQuery } from "../types";
import { goalFor, passes, periods, totals, totalsBy, trend, yearBlock } from "../values";

// The data layer of the ANC page (SPEC §9.4, ADR-0015) for s_kpi_anc12 and
// s_anc5: one row per หมู่บ้าน, ทั้งปี + Q_A (SCHEMA §4.6.2). Worked out with
// values.ts, no formula of its own: no React, no DOM.

/**
 * Every value the ANC page shows for a query: the area, ช่วงเวลา and
 * เปรียบเทียบตาม of the query (measure is not used: the tables have none),
 * the trend over years (catalog.meta.years)
 */
export function ancValues(
  data: DcReportData,
  query: ReportQuery,
  names: Pick<DcCatalog, "areas" | "hospitals">,
  years: string[],
): AncValues {
  const block = yearBlock(data, query.year);
  const total = block && totals(block, data.report, query);
  const units = block && totalsBy(block, data.report, query, names);
  const goal = goalFor(data.report, null);
  const quarters = block
    ? periods(block, data.report)
        .filter((p) => p.startsWith("q"))
        .map((period) => ({ period, totals: totals(block, data.report, { ...query, period }) }))
    : [];
  // A year of the window without a block ปี is "—", not left out of the axis (SCHEMA §4.2)
  const byYear = new Map(trend(data, query).map((point) => [point.b_year, point]));
  const trendPoints = years.map((year) => byYear.get(year) ?? { b_year: year, totals: null });
  return { block, total, goal, passed: passes(total?.pct ?? null, goal), units, trend: trendPoints, quarters };
}
