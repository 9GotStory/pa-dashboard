import { formatCount } from "@/lib/dc/format";
import type { UnitCount } from "./resultsText";

/**
 * จำนวนรายการ of each ตำบล or หน่วยบริการ (unitLabel) with the total row
 * (totalLabel), as UnitTable lays out เป้าหมาย/ผลงาน/ร้อยละ: the count of a
 * ด้าน of AGED9 (SPEC §9.4)
 */
export default function CountTable(props: {
  unitLabel: string;
  units: UnitCount[];
  total: number;
  totalLabel: string;
}) {
  const { unitLabel, units, total, totalLabel } = props;
  return (
    <section className="min-w-0">
      <div
        role="region"
        tabIndex={0}
        aria-label={`ตารางจำนวนราย${unitLabel} (เลื่อนดูแนวนอนได้)`}
        className="overflow-x-auto rounded-[9px] border border-dc-border-subtle"
      >
        <table className="w-full border-collapse text-xs tabular-nums">
          <caption className="bg-white px-4 pt-4 pb-3 text-left font-prompt text-sm font-semibold text-dc-brand-deep">
            จำนวนรายการราย{unitLabel}
          </caption>
          <thead className="bg-dc-highlight-soft text-dc-brand-deep">
            <tr>
              <th scope="col" className="px-2 py-2 text-left whitespace-nowrap sm:px-3">
                {unitLabel}
              </th>
              <th scope="col" className="px-2 py-2 text-right whitespace-nowrap sm:px-3">
                จำนวนรายการ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {units.map((u) => (
              <tr key={u.key} className="border-t border-dc-border-subtle">
                <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap sm:px-3">
                  {u.name}
                </th>
                <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{formatCount(u.count)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-dc-canvas font-bold">
            <tr className="border-t-2 border-dc-border-subtle">
              <th scope="row" className="px-2 py-2 text-left whitespace-nowrap sm:px-3">
                {totalLabel}
              </th>
              <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{formatCount(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
