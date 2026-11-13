"use client";

import { completeValues } from "@/lib/dc/tables/complete";
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

/** The filters of the ครบตามเกณฑ์ page (SPEC §9.4): no รายการ; ช่วงเวลา is ทั้งปี or a เดือน, as the table has no quarter */
const FIELDS: (keyof ReportQuery)[] = ["year", "area", "period", "by"];

/**
 * ผลรายงาน of s_epi_complete's 4 reports (SPEC §9.4): the ANC page's layout
 * with เป้าหมาย/ผลงาน รายเดือน, laid out from the values of completeValues;
 * the frame around it names the report. data-table-page names the page in its
 * chunk, which dc-check looks for in the scripts other reports load.
 */
export default function CompletePage({ id, names, years }: { id: string; names: Names; years: string[] }) {
  return (
    <div data-table-page="complete">
      <ReportLoader id={id}>{(data) => <Complete data={data} names={names} years={years} />}</ReportLoader>
    </div>
  );
}

function Complete({ data, names, years }: { data: DcReportData; names: Names; years: string[] }) {
  const { query, search, apply, heading } = useReportQuery(data, names);
  const { block, total, goal, units, trend, months } = completeValues(data, query, names, years);
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
        <QuarterFigures {...{ total, goal, units, trend, unitLabel, totalLabel }} steps={months} stepName="เดือน" year={query.year} />
      )}
    </>
  );
}
