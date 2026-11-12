"use client";

import type { DcCatalog, DcReportData, DcYearBlock, ReportQuery, Totals, TrendPoint, UnitTotals } from "@/lib/dc/types";
import { goalFor, measureLabel, periods, shownMeasures, totals, totalsBy, trend, yearBlock } from "@/lib/dc/values";
import { PERIOD_LABELS, areaLabel } from "./report/labels";
import { PeriodPanel, TrendPanel, UnitPanel } from "./report/panels";
import ReportActions from "./report/ReportActions";
import ReportFilters from "./report/ReportFilters";
import ReportLoader from "./report/ReportLoader";
import ReportStatus, { NoYear } from "./report/ReportStatus";
import ResultsHeader from "./report/ResultsHeader";
import SummaryTiles from "./report/SummaryTiles";
import UnitTable from "./report/UnitTable";
import { resultsText } from "./report/resultsText";
import { useReportQuery } from "./report/useReportQuery";

type Names = Pick<DcCatalog, "areas" | "hospitals">;

/**
 * The filters and results of a coverage report (SPEC §9.4), for the tables
 * without a page of their own yet (ADR-0015). The report's JSON is loaded
 * once and the numbers are worked out in the browser; the query lives in the
 * URL.
 */
export default function CoverageReport({ id, names, years }: { id: string; names: Names; years: string[] }) {
  return <ReportLoader id={id}>{(data) => <Coverage data={data} names={names} years={years} />}</ReportLoader>;
}

function Coverage({ data, names, years }: { data: DcReportData; names: Names; years: string[] }) {
  const { query: asked, search, apply, heading } = useReportQuery(data, names);
  const { report } = data;
  const block = yearBlock(data, asked.year);
  // This page has no ภาพรวม: no measure is the year's first รายการ (SCHEMA §4.2, §9)
  const query = { ...asked, measure: asked.measure ?? (block && shownMeasures(data, block)[0]) ?? null };
  // Whether a rule of SCHEMA §4.3 finds the table's columns that year
  const recognised = block !== null && periods(block, report).length > 0;
  const units = block && totalsBy(block, report, query, names);
  const total = block && totals(block, report, query);
  // null: the whole district has no ผลงาน that year, shown as "—" (SPEC §9.4)
  const values = units && total ? { units, total } : null;
  const figures = block && recognised && (!values || values.units.length > 0) ? { block, values } : null;
  const { summary, unitLabel, totalLabel, csv } = resultsText(
    report,
    query,
    names,
    figures?.values ? { dateCom: figures.block.max_date_com, ...figures.values } : null,
  );

  return (
    <>
      {/* Remounted when the query changes (แสดงผล, back, forward), so the form shows what the results show */}
      <ReportFilters key={search} data={data} names={names} query={query} onApply={apply} />
      <ResultsHeader heading={heading} summary={summary} dateCom={block ? block.max_date_com : null}>
        <ReportActions csv={csv} />
      </ResultsHeader>
      {figures ? (
        <Figures data={data} query={query} years={years} {...figures} unitLabel={unitLabel} totalLabel={totalLabel} />
      ) : !block ? (
        <NoYear year={query.year} />
      ) : (
        <ReportStatus>
          {!recognised ? "ไม่รู้จักโครงสร้างตาราง ต้องกำหนด col_target/col_result" : `ไม่มีข้อมูลของ${areaLabel(query.area, names)}ในปี ${query.year}`}
        </ReportStatus>
      )}
    </>
  );
}

/**
 * ตัวเลขสรุป, กราฟ A–C and the table of a year with rows; values null when the
 * whole district has no ผลงาน that year: "—" and the trend alone (SPEC §9.4)
 */
function Figures(props: {
  data: DcReportData;
  query: ReportQuery;
  years: string[];
  block: DcYearBlock;
  values: { units: UnitTotals[]; total: Totals } | null;
  unitLabel: string;
  totalLabel: string;
}) {
  const { data, query, years, block, values, unitLabel, totalLabel } = props;
  const goal = goalFor(data.report, query.measure);
  // กราฟ C: months when the table has them, else quarters (SCHEMA §4.3)
  const available = periods(block, data.report);
  const months = available.filter((p) => p.startsWith("m"));
  const steps = months.length > 0 ? months : available.filter((p) => p.startsWith("q"));
  const stepName = months.length > 0 ? "เดือน" : "ไตรมาส";
  const stepPoints = steps.map((p) => ({ label: PERIOD_LABELS[p].short, totals: totals(block, data.report, { ...query, period: p }) }));
  // กราฟ B over the whole window: a year without a block ปี is "—", not left out of the axis (SCHEMA §4.2)
  const byYear = new Map(trend(data, query).map((point) => [point.b_year, point]));
  const trendPoints: TrendPoint[] = years.map((year) => byYear.get(year) ?? { b_year: year, totals: null });
  return (
    <div className="px-4 pb-6 sm:px-6">
      <SummaryTiles total={values?.total ?? null} goal={goal} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {values ? (
          <>
            <UnitPanel unitLabel={unitLabel} units={values.units} goal={goal} />
            <UnitTable unitLabel={unitLabel} units={values.units} total={values.total} totalLabel={totalLabel} />
          </>
        ) : (
          <p className="text-sm text-dc-text-secondary lg:col-span-2">
            ไม่มีข้อมูล{query.measure === null ? "" : `รายการ ${measureLabel(query.measure)} `}ในปีงบประมาณ {query.year}: ผลงานรวมทั้งอำเภอว่างทั้งปี
          </p>
        )}
        <TrendPanel points={trendPoints} goal={goal} />
        {values && stepPoints.length > 0 && <PeriodPanel year={query.year} stepName={stepName} points={stepPoints} />}
      </div>
    </div>
  );
}
