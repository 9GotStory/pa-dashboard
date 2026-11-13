import { formatValue, trendScale } from "./TrendChart";

/**
 * กราฟ B on a phone (SPEC §9.4, V0.4.2): a row per year with its year, a bar
 * from 0 to the top of TrendChart's scale with the เกณฑ์ marked, and its
 * value, which reads without hover. A year without a value is "—" and has
 * no bar.
 */
export default function TrendList({
  title,
  points,
  goal,
  unit,
}: {
  title: string;
  points: { year: string; value: number | null }[];
  goal: number | null;
  unit: "pct" | "count";
}) {
  const top = trendScale(
    unit,
    points.flatMap((p) => (p.value === null ? [] : [p.value])),
  ).high;
  return (
    <ol aria-label={title} className="space-y-2">
      {points.map(({ year, value }) => (
        <li key={year} className="grid grid-cols-[3rem_minmax(0,1fr)_4.5rem] items-center gap-2">
          <span className="text-xs text-dc-text-secondary tabular-nums">{year}</span>
          <span aria-hidden="true" className="relative h-2.5 overflow-hidden rounded-full bg-dc-surface-muted">
            {value !== null && (
              <span
                className="block h-full rounded-full bg-dc-brand-accent"
                style={{ width: `${Math.min(value / top, 1) * 100}%` }}
              />
            )}
            {goal !== null && (
              <span
                className="absolute inset-y-0 border-l-2 border-dashed border-dc-gold"
                style={{ left: `${(goal / top) * 100}%` }}
              />
            )}
          </span>
          <strong className="text-right text-xs font-semibold text-dc-brand-deep tabular-nums">
            {value === null ? "—" : formatValue(unit, value)}
          </strong>
        </li>
      ))}
    </ol>
  );
}
