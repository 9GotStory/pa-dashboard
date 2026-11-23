"use client";

import { useState } from "react";
import { reportCsv } from "@/lib/dc/csv";
import { annualValues } from "@/lib/dc/tables/annual";
import type { Cell, DcCatalog, DcReportData, ReportQuery, ReportSort } from "@/lib/dc/types";
import { areaLabel, pctText } from "../report/labels";
import { AgeMonthsPanel, AskingPanel } from "../report/panels";
import QuarterFigures from "../report/QuarterFigures";
import ReportActions from "../report/ReportActions";
import ReportFilters from "../report/ReportFilters";
import ReportLoader from "../report/ReportLoader";
import ReportStatus, { NoYear } from "../report/ReportStatus";
import ResultsFade from "../report/ResultsFade";
import ResultsHeader from "../report/ResultsHeader";
import { resultsText, unitTable } from "../report/resultsText";
import { useReportQuery } from "../report/useReportQuery";

type Names = Pick<DcCatalog, "areas" | "hospitals">;
type Asking = ReturnType<typeof annualValues>["asking"];

/** The filters of the ตัวชี้วัดเดียวรายปี page (SPEC §9.4): no ช่วงเวลา, as the tables have ทั้งปี alone */
const FIELDS: (keyof ReportQuery)[] = ["year", "area", "by"];

/** The columns the CSV of s_kpi_food adds to the unit table (SPEC §9.4) */
const ASKING_COLUMNS = ["เด็กอายุครบ 6 เดือน", "ร้อยละสอบถาม"];

/** The cells of ASKING_COLUMNS in a row of the CSV; none for a table without ร้อยละสอบถาม (the dental tables) */
function askingCells(asking: Asking): Cell[] {
  return asking ? [asking.children, pctText(asking.pct)] : [];
}

/**
 * ผลรายงาน of s_kpi_food, s_kpi_dental28 and s_kpi_dental33 (SPEC §9.4):
 * ตัวเลขสรุป, ร้อยละรายตำบลหรือรายหน่วยบริการ beside its table and แนวโน้ม
 * as ANC lays them out without ไตรมาส, with the counts of each เดือนอายุ and
 * ร้อยละสอบถาม of s_kpi_food, laid out from the values of annualValues.
 * data-table-page names the page in its chunk, which dc-check looks for in
 * the scripts other reports load.
 */
export default function AnnualPage({ id, names, years }: { id: string; names: Names; years: string[] }) {
  return (
    <div data-table-page="annual">
      <ReportLoader id={id}>{(data) => <Annual data={data} names={names} years={years} />}</ReportLoader>
    </div>
  );
}

function Annual({ data, names, years }: { data: DcReportData; names: Names; years: string[] }) {
  const { query, search, apply, applyCount, heading } = useReportQuery(data, names);
  // The order of the เปรียบเทียบ section, kept here so it stays through แสดงผล (SPEC §9.4)
  const [sort, setSort] = useState<ReportSort>("code");
  const { block, total, change, goal, units, trend, ageMonths, asking } = annualValues(data, query, names, years);
  const { summary, unitLabel, totalLabel } = resultsText(data.report, query, names, null, { fields: FIELDS });
  const csv =
    block && total && units
      ? () => {
          // What s_kpi_food adds to each row of unitTable, in its order: the column names, each unit, then the total row
          const added = [asking ? ASKING_COLUMNS : [], ...units.map((u) => askingCells(u.asking)), askingCells(asking)];
          return reportCsv({
            report: data.report,
            year: query.year,
            filters: summary,
            dateCom: block.max_date_com,
            table: unitTable(unitLabel, units, total, totalLabel).map((row, i) => [...row, ...added[i]]),
          });
        }
      : null;

  return (
    <>
      {/* Remounted when the query changes (แสดงผล, back, forward), so the form shows what the results show */}
      <ReportFilters key={search} data={data} names={names} query={query} onApply={apply} fields={FIELDS} />
      <ResultsHeader heading={heading} summary={summary} dateCom={block ? block.max_date_com : null}>
        <ReportActions csv={csv} />
      </ResultsHeader>
      <ResultsFade applyCount={applyCount}>
        {!block ? (
          <NoYear year={query.year} />
        ) : units?.length === 0 ? (
          <ReportStatus>
            ไม่มีข้อมูลของ{areaLabel(query.area, names)}ในปี {query.year}
          </ReportStatus>
        ) : (
          <QuarterFigures
            {...{ total, change, goal, units, trend, unitLabel, totalLabel, sort }}
            onSort={setSort}
            steps={[]}
            year={query.year}
          >
            {total && (ageMonths || asking) && (
              // One cell of the grid, beside แนวโน้ม: the two panels of s_kpi_food
              <div className="grid min-w-0 content-start gap-4">
                {ageMonths && <AgeMonthsPanel year={query.year} result={total.result} ageMonths={ageMonths} />}
                {asking && <AskingPanel year={query.year} asking={asking} />}
              </div>
            )}
          </QuarterFigures>
        )}
      </ResultsFade>
    </>
  );
}
