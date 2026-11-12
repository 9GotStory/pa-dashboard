import type { DcCatalog, DcReportData, ReportQuery } from "../types";
import { ancValues } from "./anc";

// The data layer of the พัฒนาการเด็ก page (SPEC §9.4, ADR-0015) for
// s_kpi_childdev4 and s_kpi_childdev2: one row per หน่วยบริการ, Q_A alone, so
// ทั้งปี is the 4 quarters added up (SCHEMA §4.3, §4.6.3). SPEC lays it out
// "แบบ ANC รายหน่วยบริการ", so it takes the ANC page's values for the whole
// district by หน่วยบริการ. Its result has no type in types.ts (SPEC §2.7).

/**
 * Every value the พัฒนาการเด็ก page shows for a query: its year and ช่วงเวลา,
 * always ทั้งอำเภอ by หน่วยบริการ, as areacode is where the หน่วยบริการ is
 * (SCHEMA §4.6.1); an old link's ?area= or ?by=area gets that too (SPEC §9.4)
 */
export function childdevValues(data: DcReportData, query: ReportQuery, names: Pick<DcCatalog, "areas" | "hospitals">, years: string[]) {
  const district: ReportQuery = { ...query, area: "all", by: "hosp" };
  return {
    /** The query shown: query with ทั้งอำเภอ by หน่วยบริการ */
    query: district,
    ...ancValues(data, district, names, years),
  };
}
