import { formatCount, formatPct } from "@/lib/dc/format";

/** One year (or ไตรมาส) of a แนวโน้ม: its label and value, null = no value, shown "—" */
type Point = { year: string; value: number | null };
/** What the values are: ร้อยละ (HDC reports, SPEC §9.4) or a count (รายงานประชากร, §9.4.1) */
type Unit = "pct" | "count";

const HEIGHT = 220;
const PLOT_TOP = 22;
const PLOT_HEIGHT = HEIGHT - PLOT_TOP - 34;
// The plot as a share of the width, right of the axis; a count's axis needs
// room for "48,000"
const PLOT = { pct: { x: 12, width: 86 }, count: { x: 17, width: 80 } };

export const formatValue = (unit: Unit, v: number) => (unit === "pct" ? formatPct(v) : formatCount(v));

/** The top of the ร้อยละ scale: 100, or the next 25 above the highest ร้อยละ when one passes 100 */
function trendTop(pcts: number[]): number {
  return Math.max(100, Math.ceil(Math.max(0, ...pcts) / 25) * 25);
}

/**
 * The axis of a แนวโน้ม. ร้อยละ: 0–trendTop in steps of 25. A count: round
 * steps from just below the smallest value to just above the largest, not
 * from 0, so a change of 1% a year shows; a line, unlike a bar, needs no 0.
 */
export function trendScale(unit: Unit, values: number[]): { low: number; high: number; ticks: number[] } {
  if (unit === "pct") {
    const top = trendTop(values);
    return { low: 0, high: top, ticks: Array.from({ length: top / 25 + 1 }, (_, k) => k * 25) };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rough = Math.max(max - min, max * 0.02, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * magnitude).find((s) => s >= rough)!;
  const low = Math.floor(min / step) * step;
  const high = Math.max(Math.ceil(max / step) * step, low + step);
  return { low, high, ticks: Array.from({ length: Math.round((high - low) / step) + 1 }, (_, k) => low + k * step) };
}

/**
 * กราฟ B (SPEC §9.4): a value per year as a line, after R6's ncd view, with
 * the เกณฑ์ as a dashed line when there is one; every point has its value
 * above it, so it reads without hover. A year without a value is "—" and
 * breaks the line (SCHEMA §4.2). The scale is trendScale's.
 */
export default function TrendChart({
  title,
  points,
  goal,
  unit,
}: {
  title: string;
  points: Point[];
  goal: number | null;
  unit: Unit;
}) {
  const values = points.map((p) => p.value);
  const { low, high, ticks } = trendScale(
    unit,
    values.filter((v) => v !== null),
  );
  const { x: plotX, width: plotWidth } = PLOT[unit];
  const x = (i: number) => ((i + 0.5) / points.length) * 100;
  const y = (v: number) => (1 - (v - low) / (high - low)) * 100;
  const label =
    `${title}: ` +
    points.map((p) => `${p.year} ${p.value === null ? "—" : formatValue(unit, p.value)}`).join(", ") +
    (goal === null ? "" : ` · เกณฑ์ ${goal}`);
  return (
    <svg role="img" aria-label={label} width="100%" height={HEIGHT} className="block text-xs">
      {ticks.map((t) => (
        <text
          key={t}
          x={`${plotX - 2}%`}
          y={PLOT_TOP + (y(t) / 100) * PLOT_HEIGHT}
          dominantBaseline="middle"
          textAnchor="end"
          className="fill-dc-text-secondary tabular-nums"
        >
          {unit === "pct" ? t : formatCount(t)}
        </text>
      ))}
      {points.map((p, i) => (
        <text
          key={p.year}
          x={`${plotX + (plotWidth * x(i)) / 100}%`}
          y={HEIGHT - 10}
          textAnchor="middle"
          className="fill-dc-brand-deep"
        >
          {p.year}
        </text>
      ))}
      <svg x={`${plotX}%`} y={PLOT_TOP} width={`${plotWidth}%`} height={PLOT_HEIGHT} overflow="visible">
        {ticks.map((t) => (
          <line key={t} x1="0" x2="100%" y1={`${y(t)}%`} y2={`${y(t)}%`} className="stroke-dc-border-subtle" />
        ))}
        {goal !== null && (
          <line
            x1="0"
            x2="100%"
            y1={`${y(goal)}%`}
            y2={`${y(goal)}%`}
            strokeWidth="2"
            strokeDasharray="7 6"
            className="stroke-dc-gold"
          />
        )}
        {values.slice(1).map((v, k) => {
          const prev = values[k];
          return (
            prev !== null &&
            v !== null && (
              <line
                key={k}
                x1={`${x(k)}%`}
                y1={`${y(prev)}%`}
                x2={`${x(k + 1)}%`}
                y2={`${y(v)}%`}
                strokeWidth="3"
                strokeLinecap="round"
                className="stroke-dc-brand-primary"
              />
            )
          );
        })}
        {values.map((v, i) =>
          v === null ? (
            <text key={i} x={`${x(i)}%`} y="100%" dy="-6" textAnchor="middle" className="fill-dc-text-secondary">
              —
            </text>
          ) : (
            <g key={i}>
              <circle
                cx={`${x(i)}%`}
                cy={`${y(v)}%`}
                r="5"
                strokeWidth="3"
                className="fill-white stroke-dc-brand-primary"
              />
              {/* A white edge keeps the value legible where it crosses the line or the เกณฑ์ */}
              <text
                x={`${x(i)}%`}
                y={`${y(v)}%`}
                dy="-11"
                textAnchor="middle"
                strokeWidth="4"
                strokeLinejoin="round"
                className="fill-dc-brand-deep stroke-white font-semibold tabular-nums [paint-order:stroke]"
              >
                {formatValue(unit, v)}
              </text>
            </g>
          ),
        )}
      </svg>
    </svg>
  );
}
