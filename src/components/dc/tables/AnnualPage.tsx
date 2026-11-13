"use client";

import { annualValues } from "@/lib/dc/tables/annual";
import type { DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import { areaLabel } from "../report/labels";
import { AgeMonthsPanel } from "../report/panels";
import QuarterFigures from "../report/QuarterFigures";
import ReportActions from "../report/ReportActions";
import ReportFilters from "../report/ReportFilters";
import ReportLoader from "../report/ReportLoader";
import ReportStatus, { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import { resultsText } from "../report/resultsText";
import { useReportQuery } from "../report/useReportQuery";

type Names = Pick<DcCatalog, "areas" | "hospitals">;

/** The filters of the ตัวชี้วัดเดียวรายปี page (SPEC §9.4): no ช่วงเวลา, as the tables have ทั้งปี alone */
const FIELDS: (keyof ReportQuery)[] = ["year", "area", "by"];

/**
 * ผลรายงาน of s_kpi_food, s_kpi_dental28 and s_kpi_dental33 (SPEC §9.4):
 * ตัวเลขสรุป, ร้อยละรายตำบลหรือรายหน่วยบริการ beside its table and แนวโน้ม
 * as ANC lays them out without ไตรมาส, with the counts of each เดือนอายุ of
 * s_kpi_food, laid out from the values of annualValues. data-table-page names
 * the page in its chunk, which dc-check looks for in the scripts other
 * reports load.
 */
export default function AnnualPage({ id, names, years }: { id: string; names: Names; years: string[] }) {
  return (
    <div data-table-page="annual">
      <ReportLoader id={id}>{(data) => <Annual data={data} names={names} years={years} />}</ReportLoader>
    </div>
  );
}

function Annual({ data, names, years }: { data: DcReportData; names: Names; years: string[] }) {
  const { query, search, apply, heading } = useReportQuery(data, names);
  const { block, total, goal, units, trend, ageMonths } = annualValues(data, query, names, years);
  const { summary, unitLabel, totalLabel, csv } = resultsText(
    data.report,
    query,
    names,
    block && total && units ? { dateCom: block.max_date_com, units, total } : null,
    { fields: FIELDS },
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
        <QuarterFigures {...{ total, goal, units, trend, unitLabel, totalLabel }} steps={[]} year={query.year}>
          {total && ageMonths && <AgeMonthsPanel year={query.year} result={total.result} ageMonths={ageMonths} />}
        </QuarterFigures>
      )}
    </>
  );
}
