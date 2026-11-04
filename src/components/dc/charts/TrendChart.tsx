import { formatPct } from "@/lib/dc/format";
import type { TrendPoint } from "@/lib/dc/types";

const HEIGHT = 220;
const PLOT_TOP = 22;
const PLOT_HEIGHT = HEIGHT - PLOT_TOP - 34;
// The plot as a share of the width, right of the ร้อยละ axis
const PLOT_X = 12;
const PLOT_WIDTH = 86;

/**
 * กราฟ B (SPEC §9.4): ร้อยละ per ปีงบประมาณ with the เกณฑ์ as a dashed line,
 * after R6's ncd view. A year without a value is "—" and breaks the line
 * (SCHEMA §4.2). The scale is 0–100, or up to the next 25 above the highest
 * ร้อยละ when one passes 100.
 */
export default function TrendChart({ title, points, goal }: { title: string; points: TrendPoint[]; goal: number | null }) {
  const pcts = points.map((p) => p.totals?.pct ?? null);
  const top = Math.max(100, Math.ceil(Math.max(0, ...pcts.map((v) => v ?? 0)) / 25) * 25);
  const ticks = Array.from({ length: top / 25 + 1 }, (_, k) => k * 25);
  const x = (i: number) => ((i + 0.5) / points.length) * 100;
  const y = (v: number) => (1 - v / top) * 100;
  const label =
    `${title}: ` +
    points.map((p, i) => `${p.b_year} ${pcts[i] === null ? "—" : formatPct(pcts[i])}`).join(", ") +
    (goal === null ? "" : ` · เกณฑ์ ${goal}`);
  return (
    <svg role="img" aria-label={label} width="100%" height={HEIGHT} className="block text-xs">
      {ticks.map((t) => (
        <text key={t} x={`${PLOT_X - 2}%`} y={PLOT_TOP + (y(t) / 100) * PLOT_HEIGHT} dominantBaseline="middle" textAnchor="end" className="fill-dc-muted tabular-nums">
          {t}
        </text>
      ))}
      {points.map((p, i) => (
        <text key={p.b_year} x={`${PLOT_X + (PLOT_WIDTH * x(i)) / 100}%`} y={HEIGHT - 10} textAnchor="middle" className="fill-dc-ink">
          {p.b_year}
        </text>
      ))}
      <svg x={`${PLOT_X}%`} y={PLOT_TOP} width={`${PLOT_WIDTH}%`} height={PLOT_HEIGHT} overflow="visible">
        {ticks.map((t) => (
          <line key={t} x1="0" x2="100%" y1={`${y(t)}%`} y2={`${y(t)}%`} className="stroke-dc-border" />
        ))}
        {goal !== null && (
          <line x1="0" x2="100%" y1={`${y(goal)}%`} y2={`${y(goal)}%`} strokeWidth="2" strokeDasharray="7 6" className="stroke-dc-gold" />
        )}
        {pcts.slice(1).map((v, k) => {
          const prev = pcts[k];
          return (
            prev !== null &&
            v !== null && (
              <line key={k} x1={`${x(k)}%`} y1={`${y(prev)}%`} x2={`${x(k + 1)}%`} y2={`${y(v)}%`} strokeWidth="3" strokeLinecap="round" className="stroke-dc-blue" />
            )
          );
        })}
        {pcts.map((v, i) =>
          v === null ? (
            <text key={i} x={`${x(i)}%`} y="100%" dy="-6" textAnchor="middle" className="fill-dc-muted">
              —
            </text>
          ) : (
            <g key={i}>
              <circle cx={`${x(i)}%`} cy={`${y(v)}%`} r="5" strokeWidth="3" className="fill-white stroke-dc-blue" />
              {/* A white edge keeps the value legible where it crosses the line or the เกณฑ์ */}
              <text
                x={`${x(i)}%`}
                y={`${y(v)}%`}
                dy="-11"
                textAnchor="middle"
                strokeWidth="4"
                strokeLinejoin="round"
                className="fill-dc-ink stroke-white font-semibold tabular-nums [paint-order:stroke]"
              >
                {formatPct(v)}
              </text>
            </g>
          ),
        )}
      </svg>
    </svg>
  );
}
