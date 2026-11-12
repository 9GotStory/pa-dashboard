import type { ReactNode } from "react";
import type { Totals, TrendPoint, UnitTotals } from "@/lib/dc/types";
import PeriodChart from "../charts/PeriodChart";
import TrendChart from "../charts/TrendChart";
import UnitChart from "../charts/UnitChart";

// กราฟ A–C of SPEC §9.4, each in its box with a title and a key.

function Surface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[9px] border border-dc-border-subtle bg-white p-4">
      <h3 className="mb-3 font-prompt text-sm font-semibold text-dc-brand-deep">{title}</h3>
      {children}
    </section>
  );
}

function Key({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i aria-hidden="true" className={`inline-block ${swatch}`} />
      {children}
    </span>
  );
}

/** The dashed เกณฑ์ line of กราฟ A and B; nothing when the รายการ has no เกณฑ์ */
function GoalKey({ goal }: { goal: number | null }) {
  return goal === null ? null : <Key swatch="w-4 border-t-2 border-dashed border-dc-gold">เกณฑ์ {goal}</Key>;
}

/** กราฟ A: ร้อยละ of each ตำบล or หน่วยบริการ (unitLabel), with the เกณฑ์ */
export function UnitPanel({ unitLabel, units, goal }: { unitLabel: string; units: UnitTotals[]; goal: number | null }) {
  return (
    <Surface title={`ร้อยละราย${unitLabel}`}>
      <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-text-secondary">
        <Key swatch="h-2 w-4 rounded-sm bg-dc-brand-primary">ร้อยละ</Key>
        <GoalKey goal={goal} />
      </p>
      <UnitChart title={`ร้อยละราย${unitLabel}`} units={units} goal={goal} />
    </Surface>
  );
}

/** กราฟ B: ร้อยละ per ปีงบประมาณ over the whole window, with the เกณฑ์ */
export function TrendPanel({ points, goal }: { points: TrendPoint[]; goal: number | null }) {
  return (
    <Surface title="แนวโน้มร้อยละรายปี">
      <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-text-secondary">
        <Key swatch="h-0.5 w-4 bg-dc-brand-primary">ร้อยละรายปี</Key>
        <GoalKey goal={goal} />
      </p>
      <TrendChart title="แนวโน้มร้อยละรายปี" points={points} goal={goal} />
    </Surface>
  );
}

/** กราฟ C: เป้าหมาย beside ผลงาน for each step (stepName: เดือน or ไตรมาส) of the year */
export function PeriodPanel(props: { year: string; stepName: string; points: { label: string; totals: Totals | null }[] }) {
  const { year, stepName, points } = props;
  return (
    <Surface title={`เป้าหมายและผลงานราย${stepName} ปีงบประมาณ ${year}`}>
      <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-text-secondary">
        <Key swatch="size-2.5 rounded-sm bg-dc-brand-deep">เป้าหมาย</Key>
        <Key swatch="size-2.5 rounded-sm bg-dc-brand-accent">ผลงาน</Key>
      </p>
      <PeriodChart title={`เป้าหมายและผลงานราย${stepName}`} points={points} />
    </Surface>
  );
}
