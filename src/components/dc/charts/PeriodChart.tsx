import type { Totals } from "@/lib/dc/types";

const HEIGHT = 210;
const PLOT_TOP = 12;
const PLOT_HEIGHT = HEIGHT - PLOT_TOP - 30;

const count = new Intl.NumberFormat("th-TH");

/** The smallest of 1, 2 or 5 × 10ⁿ at or above v, so the axis reads in round numbers */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((k) => k * step).find((m) => m >= v) ?? 10 * step;
}

/**
 * กราฟ C (SPEC §9.4): เป้าหมาย beside ผลงาน for each ไตรมาส or month of the
 * year shown, after R6's monthly epi chart.
 */
export default function PeriodChart({ title, points }: { title: string; points: { label: string; totals: Totals | null }[] }) {
  const top = niceMax(Math.max(0, ...points.flatMap((p) => (p.totals ? [p.totals.target, p.totals.result] : []))));
  const ticks = Number.isInteger(top / 2) ? [0, top / 2, top] : [0, top];
  // The plot as a share of the width, right of the count axis, which is wider
  // for longer counts so "1,000" still fits at 360 px
  const plotX = 4 + 2.5 * Math.max(...ticks.map((t) => count.format(t).length));
  const plotWidth = 98 - plotX;
  const slot = 100 / points.length;
  const y = (v: number) => (1 - v / top) * 100;
  const label =
    `${title}: ` +
    points
      .map((p) => (p.totals ? `${p.label} เป้าหมาย ${count.format(p.totals.target)} ผลงาน ${count.format(p.totals.result)}` : `${p.label} —`))
      .join(", ");
  return (
    <svg role="img" aria-label={label} width="100%" height={HEIGHT} className="block text-xs">
      {ticks.map((t) => (
        <text key={t} x={`${plotX - 2}%`} y={PLOT_TOP + (y(t) / 100) * PLOT_HEIGHT} dominantBaseline="middle" textAnchor="end" className="fill-dc-muted tabular-nums">
          {count.format(t)}
        </text>
      ))}
      {/* 12 months stagger on two lines, so their names never touch at 360 px */}
      {points.map((p, i) => (
        <text
          key={p.label}
          x={`${plotX + (plotWidth * (i + 0.5) * slot) / 100}%`}
          y={HEIGHT - (points.length > 6 && i % 2 === 1 ? 4 : 17)}
          textAnchor="middle"
          className="fill-dc-ink text-[11px]"
        >
          {p.label}
        </text>
      ))}
      <svg x={`${plotX}%`} y={PLOT_TOP} width={`${plotWidth}%`} height={PLOT_HEIGHT}>
        {ticks.map((t) => (
          <line key={t} x1="0" x2="100%" y1={`${y(t)}%`} y2={`${y(t)}%`} className="stroke-dc-border" />
        ))}
        {points.map(
          (p, i) =>
            p.totals && (
              <g key={p.label}>
                <rect x={`${(i + 0.14) * slot}%`} y={`${y(p.totals.target)}%`} width={`${0.34 * slot}%`} height={`${100 - y(p.totals.target)}%`} className="fill-dc-navy" />
                <rect x={`${(i + 0.52) * slot}%`} y={`${y(p.totals.result)}%`} width={`${0.34 * slot}%`} height={`${100 - y(p.totals.result)}%`} className="fill-dc-teal" />
              </g>
            ),
        )}
      </svg>
    </svg>
  );
}
