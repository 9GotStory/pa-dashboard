import { formatPct } from "@/lib/dc/format";
import type { UnitTotals } from "@/lib/dc/types";

const ROW = 30;
// Columns of the chart as shares of its width: names, bars, ร้อยละ. No
// viewBox, so the text keeps its CSS size at any width.
const BARS_X = "34%";
const BARS_WIDTH = "50%";

/**
 * กราฟ A (SPEC §9.4): ร้อยละ of each ตำบล or หน่วยบริการ as horizontal bars on
 * a 0–100 scale with the เกณฑ์ as a dashed line, after R6's screening and
 * epi views. A ร้อยละ over 100 fills the bar and is printed as it is.
 */
export default function UnitChart({ title, units, goal }: { title: string; units: UnitTotals[]; goal: number | null }) {
  const height = units.length * ROW;
  const label =
    `${title}: ` +
    units.map((u) => `${u.name} ${u.totals.pct === null ? "ไม่มีเป้าหมาย" : formatPct(u.totals.pct)}`).join(", ") +
    (goal === null ? "" : ` · เกณฑ์ ${goal}`);
  return (
    <svg role="img" aria-label={label} width="100%" height={height} className="block text-xs">
      {units.map((u, i) => (
        <g key={u.key}>
          <text y={i * ROW + ROW / 2} dominantBaseline="middle" className="fill-dc-brand-deep">
            {u.name}
          </text>
          <svg x={BARS_X} y={i * ROW + 8} width={BARS_WIDTH} height={ROW - 16}>
            <rect width="100%" height="100%" rx="3" className="fill-dc-canvas" />
            {u.totals.pct !== null && (
              <rect width={`${Math.min(u.totals.pct, 100)}%`} height="100%" rx="3" className="fill-dc-brand-primary" />
            )}
          </svg>
          <text
            x="100%"
            y={i * ROW + ROW / 2}
            dominantBaseline="middle"
            textAnchor="end"
            className="fill-dc-brand-deep font-semibold tabular-nums"
          >
            {u.totals.pct === null ? "—" : formatPct(u.totals.pct)}
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
  );
}
