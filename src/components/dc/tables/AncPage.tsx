"use client";

import { ancValues } from "@/lib/dc/tables/anc";
import type { DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import { areaLabel } from "../report/labels";
import QuarterFigures from "../report/QuarterFigures";
import ReportActions from "../report/ReportActions";
import ReportFilters from "../report/ReportFilters";
import ReportLoader from "../report/ReportLoader";
import ReportStatus, { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import { resultsText } from "../report/resultsText";
import { useReportQuery } from "../report/useReportQuery";

type Names = Pick<DcCatalog, "areas" | "hospitals">;

/** The filters of the ANC page (SPEC §9.4): no รายการ */
const FIELDS: (keyof ReportQuery)[] = ["year", "area", "period", "by"];

/**
 * ผลรายงาน of s_kpi_anc12 and s_anc5 after ANC V0.2 (SPEC §9.4): ตัวเลขสรุป,
 * ร้อยละรายตำบลหรือรายหน่วยบริการ beside its table, แนวโน้ม and เป้าหมาย/ผลงาน
 * รายไตรมาส, laid out from the values of ancValues. data-table-page names the
 * page in its chunk, which dc-check looks for in the scripts other reports load.
 */
export default function AncPage({ id, names, years }: { id: string; names: Names; years: string[] }) {
  return (
    <div data-table-page="anc">
      <ReportLoader id={id}>{(data) => <Anc data={data} names={names} years={years} />}</ReportLoader>
    </div>
  );
}

function Anc({ data, names, years }: { data: DcReportData; names: Names; years: string[] }) {
  const { query, search, apply, heading } = useReportQuery(data, names);
  const { block, total, goal, units, trend, quarters } = ancValues(data, query, names, years);
  const { summary, unitLabel, totalLabel, csv } = resultsText(
    data.report,
    query,
    names,
    block && total && units ? { dateCom: block.max_date_com, units, total } : null,
  );

  return (
    <>
      {/* Remounted when the query changes (แสดงผล, back, forward), so the form shows what the results show */}
      <ReportFilters key={search} data={data} names={names} query={query} onApply={apply} fields={FIELDS} />
      <ResultsHeader heading={heading} summary={summary} dateCom={block ? block.max_date_com : null}>
        <ReportActions csv={csv} />
      </ResultsHeader>
      {!block ? (
        <NoYear year={query.year} />
      ) : units?.length === 0 ? (
        <ReportStatus>ไม่มีข้อมูลของ{areaLabel(query.area, names)}ในปี {query.year}</ReportStatus>
      ) : (
        <QuarterFigures {...{ total, goal, units, trend, quarters, unitLabel, totalLabel }} year={query.year} />
      )}
    </>
  );
}
