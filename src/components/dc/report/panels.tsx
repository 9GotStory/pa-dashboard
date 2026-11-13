import type { ReactNode } from "react";
import { formatCount } from "@/lib/dc/format";
import type { Period, Totals, TrendPoint, UnitTotals } from "@/lib/dc/types";
import CountChart from "../charts/CountChart";
import PeriodChart from "../charts/PeriodChart";
import TrendChart from "../charts/TrendChart";
import TrendList from "../charts/TrendList";
import UnitChart from "../charts/UnitChart";
import { PERIOD_LABELS, pctText } from "./labels";
import type { UnitCount } from "./resultsText";

// กราฟ A–C of SPEC §9.4 and the counts of a ด้าน, each in its box with a title
// and a key.

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

/** กราฟ A: ร้อยละ (named pctLabel) of each ตำบล or หน่วยบริการ (unitLabel), with the เกณฑ์ */
export function UnitPanel({
  unitLabel,
  units,
  goal,
  pctLabel = "ร้อยละ",
}: {
  unitLabel: string;
  units: UnitTotals[];
  goal: number | null;
  pctLabel?: string;
}) {
  const title = `${pctLabel}ราย${unitLabel}`;
  return (
    <Surface title={title}>
      <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-text-secondary">
        <Key swatch="h-2 w-4 rounded-sm bg-dc-brand-primary">{pctLabel}</Key>
        <GoalKey goal={goal} />
      </p>
      <UnitChart title={title} units={units} goal={goal} />
    </Surface>
  );
}

/**
 * กราฟ B: ร้อยละ per ปีงบประมาณ over the whole window, with the เกณฑ์: a line
 * from sm up, and on a phone a list of years whose ร้อยละ reads without hover
 */
export function TrendPanel({ points: trend, goal }: { points: TrendPoint[]; goal: number | null }) {
  const points = trend.map((p) => ({ year: p.b_year, value: p.totals?.pct ?? null }));
  return (
    <Surface title="แนวโน้มร้อยละรายปี">
      <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-text-secondary">
        {/* A bar like TrendList's on a phone, the line of TrendChart from sm up */}
        <Key swatch="h-2 w-4 rounded-full bg-dc-brand-accent sm:h-0.5 sm:rounded-none sm:bg-dc-brand-primary">
          ร้อยละรายปี
        </Key>
        <GoalKey goal={goal} />
      </p>
      <div className="sm:hidden">
        <TrendList title="แนวโน้มร้อยละรายปี" points={points} goal={goal} unit="pct" />
      </div>
      <div className="hidden sm:block">
        <TrendChart title="แนวโน้มร้อยละรายปี" points={points} goal={goal} unit="pct" />
      </div>
    </Surface>
  );
}

/** กราฟ C: เป้าหมาย beside ผลงาน for each step (stepName: เดือน or ไตรมาส) of the year */
export function PeriodPanel(props: {
  year: string;
  stepName: string;
  points: { label: string; totals: Totals | null }[];
}) {
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

/**
 * ร้อยละสะสมรายไตรมาส (SPEC §9.4) of a year with ผลงาน รายไตรมาส but no
 * เป้าหมาย รายไตรมาส: กราฟ B's line and phone list over ไตรมาส 1–4 in place
 * of years, each ผลงานสะสม against the ทั้งปี target, with the เกณฑ์; then
 * each ไตรมาส's ผลงาน, ผลงานสะสม and ร้อยละสะสม in a table
 */
export function CumulativePanel(props: {
  year: string;
  target: number;
  goal: number | null;
  quarters: { period: Period; result: number; cumulative: number; pct: number | null }[];
}) {
  const { year, target, goal, quarters } = props;
  const points = quarters.map((q) => ({ year: PERIOD_LABELS[q.period].short, value: q.pct }));
  return (
    <Surface title={`ร้อยละสะสมรายไตรมาส ปีงบประมาณ ${year}`}>
      <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-text-secondary">
        <Key swatch="h-2 w-4 rounded-full bg-dc-brand-accent sm:h-0.5 sm:rounded-none sm:bg-dc-brand-primary">
          ร้อยละสะสม
        </Key>
        <GoalKey goal={goal} />
      </p>
      <div className="sm:hidden">
        <TrendList title="ร้อยละสะสมรายไตรมาส" points={points} goal={goal} unit="pct" />
      </div>
      <div className="hidden sm:block">
        <TrendChart title="ร้อยละสะสมรายไตรมาส" points={points} goal={goal} unit="pct" />
      </div>
      <div role="region" tabIndex={0} aria-label="ตารางรายไตรมาส (เลื่อนดูแนวนอนได้)" className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-xs tabular-nums">
          <caption className="pb-2 text-left text-[11px] text-dc-text-secondary">
            ผลงานรายไตรมาสและร้อยละสะสม (ผลงานสะสม ÷ เป้าหมายทั้งปี {formatCount(target)})
          </caption>
          <thead className="bg-dc-highlight-soft text-dc-brand-deep">
            <tr>
              <th scope="col" className="px-2 py-2 text-left whitespace-nowrap">
                ไตรมาส
              </th>
              <th scope="col" className="px-2 py-2 text-right whitespace-nowrap">
                ผลงาน
              </th>
              <th scope="col" className="px-2 py-2 text-right whitespace-nowrap">
                ผลงานสะสม
              </th>
              <th scope="col" className="px-2 py-2 text-right whitespace-nowrap">
                ร้อยละสะสม
              </th>
            </tr>
          </thead>
          <tbody>
            {quarters.map((q) => (
              <tr key={q.period} className="border-t border-dc-border-subtle">
                <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap">
                  {PERIOD_LABELS[q.period].short}
                </th>
                <td className="px-2 py-2 text-right whitespace-nowrap">{formatCount(q.result)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap">{formatCount(q.cumulative)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap">{pctText(q.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

/** The count of a ด้าน (AGED9) for each ตำบล or หน่วยบริการ (unitLabel): จำนวนรายการ, not a ร้อยละ, so no เกณฑ์ */
export function CountPanel({ unitLabel, units }: { unitLabel: string; units: UnitCount[] }) {
  return (
    <Surface title={`จำนวนราย${unitLabel}`}>
      <CountChart title={`จำนวนรายการราย${unitLabel}`} units={units} />
    </Surface>
  );
}

/** Cards of counts in คน, not ร้อยละ, of a panel whose counts may add up to more than ผลงาน */
function CountCards({ grid, cards }: { grid: string; cards: { label: string; count: number }[] }) {
  return (
    <dl className={`grid gap-3 ${grid}`}>
      {cards.map((c) => (
        <div key={c.label} className="min-w-0 rounded-lg border border-dc-border-subtle bg-dc-canvas/40 px-4 py-3">
          <dt className="text-xs text-dc-text-secondary">{c.label}</dt>
          <dd className="font-prompt text-2xl font-semibold text-dc-brand-deep tabular-nums">
            {formatCount(c.count)} <span className="text-xs font-normal text-dc-text-secondary">คน</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The count of each วิธีวัด (s_ht_screen_follow's HBPM and OBPM) in the
 * ช่วงเวลา, not a ร้อยละ: one person may have both, so they may add up to
 * more than ผลงาน (result), which the note says
 */
export function BpMethodsPanel(props: {
  year: string;
  period: Period;
  result: number;
  bpMethods: { label: string; count: number }[];
}) {
  const { year, period, result, bpMethods } = props;
  return (
    <Surface title={`จำนวนตามวิธีวัดความดัน ${PERIOD_LABELS[period].short} ปีงบประมาณ ${year}`}>
      <CountCards grid="grid-cols-2" cards={bpMethods} />
      <p className="mt-3 text-[11px] text-dc-text-secondary">
        HBPM วัดความดันที่บ้าน · OBPM วัดที่สถานบริการ · คนหนึ่งวัดได้ทั้งสองวิธี ผลรวมสองวิธีจึงเกินผลงาน ({formatCount(result)} คน) ได้
      </p>
    </Surface>
  );
}

/**
 * The count of each เดือนอายุ 1–6 at which s_kpi_food's children were said to
 * have only breast milk, not a ร้อยละ: one child may count at several, so
 * they add up to more than ผลงาน (result), which the note says
 */
export function AgeMonthsPanel(props: { year: string; result: number; ageMonths: { month: number; count: number }[] }) {
  const { year, result, ageMonths } = props;
  return (
    <Surface title={`ตอบว่ากินนมแม่อย่างเดียวตามเดือนอายุ ปีงบประมาณ ${year}`}>
      <CountCards
        grid="grid-cols-2 sm:grid-cols-3"
        cards={ageMonths.map((m) => ({ label: `อายุ ${m.month} เดือน`, count: m.count }))}
      />
      <p className="mt-3 text-[11px] text-dc-text-secondary">
        นับเด็กที่ตอบว่ากินนมแม่อย่างเดียวในแต่ละช่วงอายุ เด็กคนหนึ่งนับได้หลายเดือนอายุ ผลรวมจึงเกินผลงาน ({formatCount(result)} คน) ได้
      </p>
    </Surface>
  );
}
