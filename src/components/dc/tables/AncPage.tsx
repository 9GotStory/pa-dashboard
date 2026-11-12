"use client";

import { reportCsv } from "@/lib/dc/csv";
import { ancValues } from "@/lib/dc/tables/anc";
import type { AncValues, DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import { PERIOD_LABELS, UNIT_LABELS, areaLabel, describe, pctText } from "../report/labels";
import { PeriodPanel, TrendPanel, UnitPanel } from "../report/panels";
import ReportActions from "../report/ReportActions";
import ReportFilters from "../report/ReportFilters";
import ReportLoader from "../report/ReportLoader";
import ReportStatus, { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import SummaryTiles from "../report/SummaryTiles";
import UnitTable from "../report/UnitTable";
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
  const anc = ancValues(data, query, names, years);
  const { report } = data;
  // No year at all: the report has no data yet, so there is no filter to name
  const summary = query.year ? describe(query, names) : "";
  const unitLabel = UNIT_LABELS[query.by];
  const totalLabel = `รวม${areaLabel(query.area, names)}`;
  const { block, total, units } = anc;
  const csv =
    block && total && units
      ? () =>
          reportCsv({
            report,
            year: query.year,
            filters: summary,
            dateCom: block.max_date_com,
            table: [
              [unitLabel, "เป้าหมาย", "ผลงาน", "ร้อยละ"],
              ...units.map((u) => [u.name, u.totals.target, u.totals.result, pctText(u.totals.pct)]),
              [totalLabel, total.target, total.result, pctText(total.pct)],
            ],
          })
      : null;

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
        <Figures anc={anc} year={query.year} unitLabel={unitLabel} totalLabel={totalLabel} />
      )}
    </>
  );
}

/** ตัวเลขสรุป, the charts and the table of a year with a block ปี; "—" and the trend alone when the district has no ผลงาน that year (SPEC §9.4) */
function Figures({ anc, year, unitLabel, totalLabel }: { anc: AncValues; year: string; unitLabel: string; totalLabel: string }) {
  const { total, units, goal, trend, quarters } = anc;
  return (
    <div className="px-4 pb-6 sm:px-6">
      <SummaryTiles total={total} goal={goal} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {total && units ? (
          <>
            <UnitPanel unitLabel={unitLabel} units={units} goal={goal} />
            <UnitTable unitLabel={unitLabel} units={units} total={total} totalLabel={totalLabel} />
          </>
        ) : (
          <p className="text-sm text-dc-text-secondary lg:col-span-2">ไม่มีข้อมูลในปีงบประมาณ {year}: ผลงานรวมทั้งอำเภอว่างทั้งปี</p>
        )}
        <TrendPanel points={trend} goal={goal} />
        {total && quarters.length > 0 && (
          <PeriodPanel year={year} stepName="ไตรมาส" points={quarters.map((q) => ({ label: PERIOD_LABELS[q.period].short, totals: q.totals }))} />
        )}
      </div>
    </div>
  );
}
