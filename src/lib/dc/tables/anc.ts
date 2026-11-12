import type { DcCatalog, DcReportData, ReportQuery } from "../types";
import { goalFor, passes, periods, totals, totalsBy, trend, yearBlock } from "../values";

// The data layer of the ANC page (SPEC §9.4, ADR-0015) for s_kpi_anc12 and
// s_anc5: one row per หมู่บ้าน, ทั้งปี + Q_A (SCHEMA §4.6.2). Worked out with
// values.ts, no formula of its own: no React, no DOM. Its result has no type
// in types.ts, as SCHEMA §9 changes only ReportQuery in Track J (SPEC §2.7):
// the view takes it as ReturnType<typeof ancValues>.

/**
 * Every value the ANC page shows for a query: the area, ช่วงเวลา and
 * เปรียบเทียบตาม of the query (measure is not used: the tables have none),
 * the trend over years (catalog.meta.years)
 */
export function ancValues(data: DcReportData, query: ReportQuery, names: Pick<DcCatalog, "areas" | "hospitals">, years: string[]) {
  const block = yearBlock(data, query.year);
  const total = block && totals(block, data.report, query);
  const goal = goalFor(data.report, null);
  // A year of the window without a block ปี is "—", not left out of the axis (SCHEMA §4.2)
  const byYear = new Map(trend(data, query).map((point) => [point.b_year, point]));
  return {
    /** The block ปี of query.year, null when the report has none: "ไม่มีข้อมูลปี … ในระบบ" */
    block,
    /** ตัวเลขสรุป of the area and ช่วงเวลา; null when the whole district has no ผลงาน that year ("—") */
    total,
    goal,
    /** ร้อยละ ≥ เกณฑ์; null without a ร้อยละ or a เกณฑ์ */
    passed: passes(total?.pct ?? null, goal),
    /** The ตำบล or หน่วยบริการ of query.by in the area; null with total */
    units: block && totalsBy(block, data.report, query, names),
    /** Each year of years with the area and ช่วงเวลา; a year without a block ปี has totals null */
    trend: years.map((year) => byYear.get(year) ?? { b_year: year, totals: null }),
    /** ไตรมาส 1–4 of the year and area whatever ช่วงเวลา is picked; [] when the year has none */
    quarters: block
      ? periods(block, data.report)
          .filter((p) => p.startsWith("q"))
          .map((period) => ({ period, totals: totals(block, data.report, { ...query, period }) }))
      : [],
  };
}
