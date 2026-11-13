"use client";

import { childdevValues } from "@/lib/dc/tables/childdev";
import type { DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import QuarterFigures from "../report/QuarterFigures";
import ReportActions from "../report/ReportActions";
import ReportFilters from "../report/ReportFilters";
import ReportLoader from "../report/ReportLoader";
import { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import { resultsText } from "../report/resultsText";
import { useReportQuery } from "../report/useReportQuery";

type Names = Pick<DcCatalog, "areas" | "hospitals">;

/** The filters of a table of one row per หน่วยบริการ (SPEC §9.4): no พื้นที่ and no เปรียบเทียบตาม */
const FIELDS: (keyof ReportQuery)[] = ["year", "period"];

/**
 * ผลรายงาน of s_kpi_childdev4 and s_kpi_childdev2 (SPEC §9.4): the ANC page's
 * layout by หน่วยบริการ for the whole district, laid out from the values of
 * childdevValues. data-table-page names the page in its chunk, which dc-check
 * looks for in the scripts other reports load.
 */
export default function ChilddevPage({ id, names, years }: { id: string; names: Names; years: string[] }) {
  return (
    <div data-table-page="childdev">
      <ReportLoader id={id}>{(data) => <Childdev data={data} names={names} years={years} />}</ReportLoader>
    </div>
  );
}

function Childdev({ data, names, years }: { data: DcReportData; names: Names; years: string[] }) {
  const { query: asked, search, apply, heading } = useReportQuery(data, names);
  const { query, block, total, goal, units, trend, quarters } = childdevValues(data, asked, names, years);
  const { summary, unitLabel, totalLabel, csv } = resultsText(
    data.report,
    query,
    names,
    block && total && units ? { dateCom: block.max_date_com, units, total } : null,
  );

  return (
    <>
      {/* Remounted when the query changes (แสดงผล, back, forward), so the form shows what the results show; an old ?area= is dropped on แสดงผล */}
      <ReportFilters key={search} data={data} names={names} query={query} onApply={apply} fields={FIELDS} />
      <ResultsHeader heading={heading} summary={summary} dateCom={block ? block.max_date_com : null}>
        <ReportActions csv={csv} />
      </ResultsHeader>
      {block ? <QuarterFigures {...{ total, goal, units, trend, unitLabel, totalLabel }} steps={quarters} year={query.year} /> : <NoYear year={query.year} />}
    </>
  );
}
