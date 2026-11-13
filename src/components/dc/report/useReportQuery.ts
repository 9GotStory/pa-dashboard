"use client";

import type { DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import { reportQuery, reportSearch } from "@/lib/dc/values";
import { useUrlQuery } from "./useUrlQuery";

/** The query of an HDC report page (SPEC §9.4), as useUrlQuery keeps it */
export function useReportQuery(data: DcReportData, names: Pick<DcCatalog, "areas" | "hospitals">) {
  return useUrlQuery<ReportQuery>((search) => reportQuery(data, search, names), reportSearch);
}
