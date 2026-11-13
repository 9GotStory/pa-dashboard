import type { DcCatalog, DcReportData, ReportQuery } from "../types";
import { count } from "../values";
import { childdevValues } from "./childdev";

// The data layer of the ติดตามยืนยันวินิจฉัย page (SPEC §9.4, ADR-0015) for
// s_ncd_screen_repleate1 and s_ht_screen_follow: one row per หน่วยบริการ,
// ทั้งปี + Q_B or Q_C (SCHEMA §4.6.9–4.6.10). SPEC lays it out "แบบ
// s_kpi_childdev4", so it takes the พัฒนาการเด็ก page's values. Its result has
// no type in types.ts (SPEC §2.7): the view takes it as
// ReturnType<typeof followValues>.

/** The วิธีวัด of s_ht_screen_follow and their ทั้งปี columns, ไตรมาส k being {column}_q{k} (SCHEMA §4.6.10) */
const METHODS = [
  { label: "HBPM", column: "r1" },
  { label: "OBPM", column: "r2" },
] as const;

/**
 * Every value the ติดตามยืนยันวินิจฉัย page shows for a query: its year and
 * ช่วงเวลา, always ทั้งอำเภอ by หน่วยบริการ, as childdevValues gives them,
 * and the count of each วิธีวัด of s_ht_screen_follow
 */
export function followValues(data: DcReportData, query: ReportQuery, names: Pick<DcCatalog, "areas" | "hospitals">, years: string[]) {
  const values = childdevValues(data, query, names, years);
  const { block, total, query: shown } = values;
  const column = (name: string) => (shown.period === "year" ? name : `${name}_${shown.period}`);
  return {
    ...values,
    /**
     * HBPM and OBPM of the ช่วงเวลา in the district, as counts: one person
     * may have both, so they may add up to more than ผลงาน (SCHEMA §4.6.10).
     * null for a table without them (s_ncd_screen_repleate1) and with total
     * null; with a total the district has data that year, so an empty column
     * is 0, not "—".
     */
    methods:
      block && total && block.headers.includes("r1")
        ? METHODS.map(({ label, column: name }) => ({ label, count: count(block, column(name), "all") ?? 0 }))
        : null,
  };
}
