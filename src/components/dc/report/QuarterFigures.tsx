import type { ReactNode } from "react";
import type { Period, ReportChange, ReportSort, Totals, TrendPoint, UnitTotals } from "@/lib/dc/types";
import { sortedUnits } from "@/lib/dc/values";
import Comparison from "./Comparison";
import { PERIOD_LABELS } from "./labels";
import { PeriodPanel, TrendPanel, UnitPanel } from "./panels";
import SummaryTiles from "./SummaryTiles";
import UnitTable from "./UnitTable";

/**
 * ตัวเลขสรุป with its การเปลี่ยนแปลงจากปีก่อน (change, null for none),
 * ร้อยละรายตำบลหรือรายหน่วยบริการ beside its table in the order
 * of sort (the page keeps it, SPEC §9.4 "การเรียง"), แนวโน้ม and
 * เป้าหมาย/ผลงาน รายไตรมาส (or รายเดือน, stepName) of a year with a block ปี,
 * as ANC V0.2 lays them out; "—" and the trend alone when the district has no
 * ผลงาน that year (total and units null, SPEC §9.4). children follow in the
 * grid: a page's own panel of the year.
 */
export default function QuarterFigures(props: {
  year: string;
  total: Totals | null;
  change: ReportChange | null;
  goal: number | null;
  units: UnitTotals[] | null;
  trend: TrendPoint[];
  steps: { period: Period; totals: Totals | null }[];
  stepName?: "ไตรมาส" | "เดือน";
  unitLabel: string;
  totalLabel: string;
  sort: ReportSort;
  onSort: (sort: ReportSort) => void;
  children?: ReactNode;
}) {
  const { year, total, goal, units, trend, steps, stepName = "ไตรมาส", unitLabel, totalLabel, children } = props;
  const shown = units && sortedUnits(units, props.sort, (u) => u.totals.pct);
  return (
    <div className="px-4 pb-6 sm:px-6">
      <SummaryTiles total={total} change={props.change} goal={goal} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {total && shown ? (
          <Comparison unitLabel={unitLabel} valueLabel="ร้อยละ" sort={props.sort} onSort={props.onSort}>
            <UnitPanel unitLabel={unitLabel} units={shown} goal={goal} />
            <UnitTable unitLabel={unitLabel} units={shown} total={total} totalLabel={totalLabel} />
          </Comparison>
        ) : (
          <p className="text-sm text-dc-text-secondary lg:col-span-2">
            ไม่มีข้อมูลในปีงบประมาณ {year}: ผลงานรวมทั้งอำเภอว่างทั้งปี
          </p>
        )}
        <TrendPanel points={trend} goal={goal} />
        {total && steps.length > 0 && (
          <PeriodPanel
            year={year}
            stepName={stepName}
            points={steps.map((s) => ({ label: PERIOD_LABELS[s.period].short, totals: s.totals }))}
          />
        )}
        {children}
      </div>
    </div>
  );
}
