import type { ReactNode } from "react";
import type { Period, Totals, TrendPoint, UnitTotals } from "@/lib/dc/types";
import { PERIOD_LABELS } from "./labels";
import { PeriodPanel, TrendPanel, UnitPanel } from "./panels";
import SummaryTiles from "./SummaryTiles";
import UnitTable from "./UnitTable";

/**
 * ตัวเลขสรุป, ร้อยละรายตำบลหรือรายหน่วยบริการ beside its table, แนวโน้ม and
 * เป้าหมาย/ผลงาน รายไตรมาส of a year with a block ปี, as ANC V0.2 lays them
 * out; "—" and the trend alone when the district has no ผลงาน that year
 * (total and units null, SPEC §9.4). children follow in the grid: a page's
 * own panel of the year.
 */
export default function QuarterFigures(props: {
  year: string;
  total: Totals | null;
  goal: number | null;
  units: UnitTotals[] | null;
  trend: TrendPoint[];
  quarters: { period: Period; totals: Totals | null }[];
  unitLabel: string;
  totalLabel: string;
  children?: ReactNode;
}) {
  const { year, total, goal, units, trend, quarters, unitLabel, totalLabel, children } = props;
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
        {children}
      </div>
    </div>
  );
}
