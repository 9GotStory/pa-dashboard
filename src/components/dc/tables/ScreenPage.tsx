"use client";

import { screenValues } from "@/lib/dc/tables/screen";
import type { DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import { areaLabel } from "../report/labels";
import { CumulativePanel } from "../report/panels";
import QuarterFigures from "../report/QuarterFigures";
import ReportActions from "../report/ReportActions";
import ReportFilters from "../report/ReportFilters";
import ReportLoader from "../report/ReportLoader";
import ReportStatus, { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import { resultsText } from "../report/resultsText";
import { useReportQuery } from "../report/useReportQuery";

type Names = Pick<DcCatalog, "areas" | "hospitals">;

/** The filters of the คัดกรองเบาหวานและความดัน page (SPEC §9.4): no ช่วงเวลา, as there is no เป้าหมาย รายไตรมาส */
const FIELDS: (keyof ReportQuery)[] = ["year", "area", "by"];

/**
 * ผลรายงาน of s_dm_screen and s_ht_screen (SPEC §9.4): ความครอบคลุม ทั้งปี as
 * ANC lays it out without ไตรมาส, and ร้อยละสะสมรายไตรมาส, laid out from the
 * values of screenValues. data-table-page names the page in its chunk, which
 * dc-check looks for in the scripts other reports load.
 */
export default function ScreenPage({ id, names, years }: { id: string; names: Names; years: string[] }) {
  return (
    <div data-table-page="screen">
      <ReportLoader id={id}>{(data) => <Screen data={data} names={names} years={years} />}</ReportLoader>
    </div>
  );
}

function Screen({ data, names, years }: { data: DcReportData; names: Names; years: string[] }) {
  const { query, search, apply, heading } = useReportQuery(data, names);
  const { block, total, goal, units, trend, quarters } = screenValues(data, query, names, years);
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
          {total && quarters.length > 0 && <CumulativePanel year={query.year} target={total.target} goal={goal} quarters={quarters} />}
        </QuarterFigures>
      )}
    </>
  );
}
