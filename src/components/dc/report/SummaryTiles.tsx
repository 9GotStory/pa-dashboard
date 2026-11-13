import type { Totals } from "@/lib/dc/types";
import { passes } from "@/lib/dc/values";
import { countText, goalText, passText, pctText } from "./labels";

/**
 * ตัวเลขสรุป (SPEC §9.4): เป้าหมาย, ผลงาน, ร้อยละ and เกณฑ์ with ผ่าน or
 * ไม่ผ่าน; total null when there is no ผลงาน to show ("—"), goal null when
 * the รายการ has no เกณฑ์.
 */
export default function SummaryTiles({ total, goal }: { total: Totals | null; goal: number | null }) {
  const passed = passes(total?.pct ?? null, goal);
  const tiles: [string, string][] = [
    ["เป้าหมาย", countText(total?.target ?? null)],
    ["ผลงาน", countText(total?.result ?? null)],
    ["ร้อยละ", pctText(total?.pct ?? null)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-lg border border-dc-border-subtle bg-dc-canvas/40 px-4 py-3">
          <dt className="text-xs text-dc-text-secondary">{label}</dt>
          <dd className="font-prompt text-2xl font-semibold text-dc-brand-deep tabular-nums">{value}</dd>
        </div>
      ))}
      <div className="min-w-0 rounded-lg border border-dc-border-subtle bg-dc-canvas/40 px-4 py-3">
        <dt className="text-xs text-dc-text-secondary">เกณฑ์ (ร้อยละ)</dt>
        {/* No เกณฑ์ (PCV is not in kpi_epi): no ผ่าน or ไม่ผ่าน either (SPEC §9.4) */}
        {goal === null ? (
          <dd className="font-prompt text-base font-semibold text-dc-brand-deep">{goalText(goal)}</dd>
        ) : (
          <dd className="font-prompt text-2xl font-semibold text-dc-brand-deep tabular-nums">{goalText(goal)}</dd>
        )}
        {passed !== null && (
          <dd
            className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-bold text-dc-brand-deep ${passed ? "bg-dc-brand-accent/20" : "bg-dc-gold/30"}`}
          >
            {passText(passed)}
          </dd>
        )}
      </div>
    </dl>
  );
}
