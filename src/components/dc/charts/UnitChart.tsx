import { formatPct } from "@/lib/dc/format";
import type { UnitTotals } from "@/lib/dc/types";
import { BarRect } from "./Bar";
import UnitList from "./UnitList";

const ROW = 30;
// Columns of the chart as shares of its width: names, bars, ร้อยละ. No
// viewBox, so the text keeps its CSS size at any width.
const BARS_X = "34%";
const BARS_WIDTH = "50%";

/**
 * กราฟ A (SPEC §9.4): ร้อยละ of each ตำบล or หน่วยบริการ as horizontal bars on
 * a 0–100 scale with the เกณฑ์ as a dashed line, after R6's screening and
 * epi views. A ร้อยละ over 100 fills the bar and is printed as it is. On a
 * phone, UnitList shows the same bars.
 */
export default function UnitChart({ title, units, goal }: { title: string; units: UnitTotals[]; goal: number | null }) {
  const height = units.length * ROW;
  const label =
    `${title}: ` +
    units.map((u) => `${u.name} ${u.totals.pct === null ? "ไม่มีเป้าหมาย" : formatPct(u.totals.pct)}`).join(", ") +
    (goal === null ? "" : ` · เกณฑ์ ${goal}`);
  const rows = units.map((u) => ({
    key: u.key,
    name: u.name,
    share: u.totals.pct === null ? null : Math.min(u.totals.pct, 100),
    value: u.totals.pct === null ? "—" : formatPct(u.totals.pct),
  }));
  return (
    <>
      <UnitList title={title} rows={rows} goal={goal} />
      <svg
        data-unit-chart
        role="img"
        aria-label={label}
        width="100%"
        height={height}
        className="hidden text-xs sm:block"
      >
        {rows.map((r, i) => (
          <g key={r.key}>
            <text y={i * ROW + ROW / 2} dominantBaseline="middle" className="fill-dc-brand-deep">
              {r.name}
            </text>
            <svg x={BARS_X} y={i * ROW + 8} width={BARS_WIDTH} height={ROW - 16}>
              <rect width="100%" height="100%" rx="3" className="fill-dc-canvas" />
              {r.share !== null && (
                <BarRect width={`${r.share}%`} height="100%" rx="3" className="fill-dc-brand-primary" />
              )}
            </svg>
            <text
              x="100%"
              y={i * ROW + ROW / 2}
              dominantBaseline="middle"
              textAnchor="end"
              className="fill-dc-brand-deep font-semibold tabular-nums"
            >
              {r.value}
            </text>
          </g>
        ))}
        {goal !== null && (
          <svg x={BARS_X} width={BARS_WIDTH} height={height}>
            <line
              x1={`${goal}%`}
              x2={`${goal}%`}
              y1="0"
              y2="100%"
              strokeWidth="2"
              strokeDasharray="4 3"
              className="stroke-dc-gold"
            />
          </svg>
        )}
      </svg>
    </>
  );
}
