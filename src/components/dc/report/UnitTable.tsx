import { formatCount } from "@/lib/dc/format";
import type { Totals, UnitTotals } from "@/lib/dc/types";
import { pctText } from "./labels";

/**
 * เป้าหมาย, ผลงาน and ร้อยละ of each ตำบล or หน่วยบริการ (unitLabel) with
 * the total row (totalLabel), scrolling sideways in its own frame (SPEC §9.1)
 */
export default function UnitTable(props: {
  unitLabel: string;
  units: UnitTotals[];
  total: Totals;
  totalLabel: string;
}) {
  const { unitLabel, units, total, totalLabel } = props;
  return (
    <section className="min-w-0">
      <div
        role="region"
        tabIndex={0}
        aria-label={`ตารางราย${unitLabel} (เลื่อนดูแนวนอนได้)`}
        className="overflow-x-auto rounded-[9px] border border-dc-border-subtle"
      >
        <table className="w-full border-collapse text-xs tabular-nums">
          <caption className="bg-white px-4 pt-4 pb-3 text-left font-prompt text-sm font-semibold text-dc-brand-deep">
            เป้าหมาย ผลงาน และร้อยละราย{unitLabel}
          </caption>
          <thead className="bg-dc-highlight-soft text-dc-brand-deep">
            <tr>
              <th scope="col" className="px-2 py-2 text-left whitespace-nowrap sm:px-3">
                {unitLabel}
              </th>
              <th scope="col" className="px-2 py-2 text-right whitespace-nowrap sm:px-3">
                เป้าหมาย
              </th>
              <th scope="col" className="px-2 py-2 text-right whitespace-nowrap sm:px-3">
                ผลงาน
              </th>
              <th scope="col" className="px-2 py-2 text-right whitespace-nowrap sm:px-3">
                ร้อยละ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {units.map((u) => (
              <tr key={u.key} className="border-t border-dc-border-subtle">
                <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap sm:px-3">
                  {u.name}
                </th>
                <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{formatCount(u.totals.target)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{formatCount(u.totals.result)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{pctText(u.totals.pct)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-dc-canvas font-bold">
            <tr className="border-t-2 border-dc-border-subtle">
              <th scope="row" className="px-2 py-2 text-left whitespace-nowrap sm:px-3">
                {totalLabel}
              </th>
              <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{formatCount(total.target)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{formatCount(total.result)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{pctText(total.pct)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
