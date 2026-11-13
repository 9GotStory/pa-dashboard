import { formatCount } from "@/lib/dc/format";

/** One ปีข้อมูล of a count's แนวโน้ม: null = no rows that year, shown "—" */
type Point = { year: string; value: number | null };

const HEIGHT = 220;
const PLOT_TOP = 24;
const PLOT_HEIGHT = HEIGHT - PLOT_TOP - 34;
// The plot as a share of the width, right of the count axis, which needs
// room for "48,000"
const PLOT_X = 17;
const PLOT_WIDTH = 80;

/**
 * The count axis of a line: round steps from just below the smallest value
 * to just above the largest, not from 0, so a change of 1% a year shows. A
 * line, unlike a bar, needs no 0.
 */
function countScale(values: number[]): { low: number; high: number; ticks: number[] } {
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
 * A count per ปีข้อมูล as a line (SPEC §9.4.1), like กราฟ B of the HDC
 * reports (TrendChart) but in counts: every point has its count above it, so
 * it reads without hover. A year without a value is "—" and breaks the line.
 */
export function CountTrendChart({ title, points }: { title: string; points: Point[] }) {
  const values = points.map((p) => p.value);
  const shown = values.filter((v) => v !== null);
  if (shown.length === 0) return null;
  const { low, high, ticks } = countScale(shown);
  const x = (i: number) => ((i + 0.5) / points.length) * 100;
  const y = (v: number) => (1 - (v - low) / (high - low)) * 100;
  const label =
    `${title}: ` + points.map((p) => `${p.year} ${p.value === null ? "—" : formatCount(p.value)}`).join(", ");
  return (
    <svg role="img" aria-label={label} width="100%" height={HEIGHT} className="block text-xs">
      {ticks.map((t) => (
        <text
          key={t}
          x={`${PLOT_X - 2}%`}
          y={PLOT_TOP + (y(t) / 100) * PLOT_HEIGHT}
          dominantBaseline="middle"
          textAnchor="end"
          className="fill-dc-text-secondary tabular-nums"
        >
          {formatCount(t)}
        </text>
      ))}
      {points.map((p, i) => (
        <text
          key={p.year}
          x={`${PLOT_X + (PLOT_WIDTH * x(i)) / 100}%`}
          y={HEIGHT - 10}
          textAnchor="middle"
          className="fill-dc-brand-deep"
        >
          {p.year}
        </text>
      ))}
      <svg x={`${PLOT_X}%`} y={PLOT_TOP} width={`${PLOT_WIDTH}%`} height={PLOT_HEIGHT} overflow="visible">
        {ticks.map((t) => (
          <line key={t} x1="0" x2="100%" y1={`${y(t)}%`} y2={`${y(t)}%`} className="stroke-dc-border-subtle" />
        ))}
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
                strokeWidth="2"
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
                r="4"
                strokeWidth="2"
                className="fill-white stroke-dc-brand-primary"
              />
              {/* A white edge keeps the count legible where it crosses the line */}
              <text
                x={`${x(i)}%`}
                y={`${y(v)}%`}
                dy="-11"
                textAnchor="middle"
                strokeWidth="4"
                strokeLinejoin="round"
                className="fill-dc-brand-deep stroke-white font-semibold tabular-nums [paint-order:stroke]"
              >
                {formatCount(v)}
              </text>
            </g>
          ),
        )}
      </svg>
    </svg>
  );
}

/**
 * CountTrendChart on a phone, like TrendList: a row per ปีข้อมูล with its
 * year, a bar from 0 to the largest count, and its count, which reads
 * without hover. A year without a value is "—" and has no bar.
 */
export function CountTrendList({ title, points }: { title: string; points: Point[] }) {
  const top = Math.max(0, ...points.map((p) => p.value ?? 0));
  return (
    <ol aria-label={title} className="space-y-2">
      {points.map((p) => (
        <li key={p.year} className="grid grid-cols-[3rem_minmax(0,1fr)_4.5rem] items-center gap-2">
          <span className="text-xs text-dc-text-secondary tabular-nums">{p.year}</span>
          <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-dc-surface-muted">
            {p.value !== null && top > 0 && (
              <span
                className="block h-full rounded-full bg-dc-brand-accent"
                style={{ width: `${(p.value / top) * 100}%` }}
              />
            )}
          </span>
          <strong className="text-right text-xs font-semibold text-dc-brand-deep tabular-nums">
            {p.value === null ? "—" : formatCount(p.value)}
          </strong>
        </li>
      ))}
    </ol>
  );
}
