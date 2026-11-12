import { formatPct } from "@/lib/dc/format";
import type { TrendPoint } from "@/lib/dc/types";
import { trendTop } from "./TrendChart";

/**
 * กราฟ B on a phone (SPEC §9.4, V0.4.2): a row per ปีงบประมาณ with its year,
 * a bar on TrendChart's scale with the เกณฑ์ marked, and its ร้อยละ, which
 * reads without hover. A year without a value is "—" and has no bar.
 */
export default function TrendList({ title, points, goal }: { title: string; points: TrendPoint[]; goal: number | null }) {
  const pcts = points.map((p) => p.totals?.pct ?? null);
  const top = trendTop(pcts);
  return (
    <ol aria-label={title} className="space-y-2">
      {points.map((p, i) => {
        const pct = pcts[i];
        return (
          <li key={p.b_year} className="grid grid-cols-[3rem_minmax(0,1fr)_4.5rem] items-center gap-2">
            <span className="text-xs text-dc-text-secondary tabular-nums">{p.b_year}</span>
            <span aria-hidden="true" className="relative h-2.5 overflow-hidden rounded-full bg-dc-surface-muted">
              {pct !== null && <span className="block h-full rounded-full bg-dc-brand-accent" style={{ width: `${Math.min(pct / top, 1) * 100}%` }} />}
              {goal !== null && <span className="absolute inset-y-0 border-l-2 border-dashed border-dc-gold" style={{ left: `${(goal / top) * 100}%` }} />}
            </span>
            <strong className="text-right text-xs font-semibold text-dc-brand-deep tabular-nums">{pct === null ? "—" : formatPct(pct)}</strong>
          </li>
        );
      })}
    </ol>
  );
}
