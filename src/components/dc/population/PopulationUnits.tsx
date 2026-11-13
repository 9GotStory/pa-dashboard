import { MoveHorizontal } from "lucide-react";
import { formatCount, formatPct } from "@/lib/dc/format";
import { populationArea } from "@/lib/dc/population-report";
import { yearAsOf } from "@/lib/dc/population-totals";
import type { PopulationChange, PopulationReport, PopulationSort, PopulationUnit } from "@/lib/dc/types";
import Segmented from "../Segmented";

/**
 * A change as shown (SPEC §9.4.1): signed + or −, never color alone, with
 * its unit when there is one, and "—" for a ร้อยละ from 0
 */
export function changeText({ count, pct }: PopulationChange, unit?: string): string {
  const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
  const pctPart = pct === null ? "—" : `${sign(pct)}${formatPct(Math.abs(pct))}%`;
  return `${sign(count)}${formatCount(Math.abs(count))}${unit ? ` ${unit}` : ""} (${pctPart})`;
}

/**
 * The เปรียบเทียบ section of รายงานประชากร (SPEC §9.4.1): the ตำบล of the
 * อำเภอ or the หมู่บ้าน of a ตำบล, in the order picked (units, from
 * sortUnits). Bars of people in the year picked, with the figure by each,
 * beside a table of every ปีข้อมูล with the change from each unit's first
 * year. ไม่ระบุหมู่ has a row in the table, last, but no bar.
 */
export default function PopulationUnits(props: {
  report: PopulationReport;
  units: PopulationUnit[];
  sort: PopulationSort;
  onSort: (sort: PopulationSort) => void;
}) {
  const { report, units, sort, onSort } = props;
  const { years, query } = report;
  const unitLabel = report.level === "district" ? "ตำบล" : "หมู่บ้าน";
  const at = years.indexOf(query.year);
  const bars = units.filter((u) => !u.unspecified);
  const caption = `ประชากรราย${unitLabel}รายปี (คน) · ${populationArea(report)} · ปีข้อมูลที่เลือก ${yearAsOf(query.year)}`;
  const top = Math.max(0, ...bars.map((u) => u.totals[at] ?? 0));
  const sorts: [PopulationSort, string][] = [
    ["code", report.level === "district" ? "รหัสตำบล" : "หมู่ที่"],
    ["count", "จำนวน"],
    ["change", "การเปลี่ยนแปลง"],
  ];

  return (
    <section aria-labelledby="population-units" className="min-w-0">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="population-units" className="font-prompt text-base font-semibold text-dc-brand-deep">
          เปรียบเทียบราย{unitLabel}
        </h2>
        <Segmented label={`เรียง${unitLabel}ตาม`} options={sorts} value={sort} onChange={onSort} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0 rounded-[9px] border border-dc-border-subtle bg-white p-4">
          <h3 id="population-bars" className="mb-3 font-prompt text-sm font-semibold text-dc-brand-deep">
            ประชากรราย{unitLabel} {yearAsOf(query.year)} (คน)
          </h3>
          <ul aria-labelledby="population-bars" className="grid gap-1">
            {bars.map((u) => {
              const value = u.totals[at] ?? null;
              return (
                <li
                  key={u.key}
                  className="grid min-h-8 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4rem] sm:text-[13px]"
                >
                  <span className="break-words text-dc-brand-deep">{u.name}</span>
                  <span aria-hidden="true" className="block h-3.5 overflow-hidden rounded-full bg-dc-surface-muted">
                    {value !== null && top > 0 && (
                      <span
                        className="block h-full rounded-full bg-dc-brand-accent"
                        style={{ width: `${(value / top) * 100}%` }}
                      />
                    )}
                  </span>
                  <span className="text-right font-semibold text-dc-brand-deep tabular-nums">
                    {value === null ? "—" : formatCount(value)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="min-w-0">
          <div className="overflow-hidden rounded-[9px] border border-dc-border-subtle bg-white">
            {/* The caption's text, shown outside the scrolling box so a phone sees all of it; the caption itself is for screen readers */}
            <p aria-hidden="true" className="px-4 pt-4 pb-3 font-prompt text-sm font-semibold text-dc-brand-deep">
              {caption}
            </p>
            {/* Wider than a phone: it scrolls inside this box, never the page (SPEC §9.1).
                Focusable, so a keyboard scrolls it. */}
            <div
              role="region"
              tabIndex={0}
              aria-label={`ตารางประชากรราย${unitLabel} (เลื่อนดูแนวนอนได้)`}
              className="overflow-x-auto"
            >
              <table className="w-full border-collapse text-xs tabular-nums">
                <caption className="sr-only">{caption}</caption>
                <thead className="bg-dc-highlight-soft text-dc-brand-deep">
                  <tr>
                    <th scope="col" className="px-2 py-2 text-left sm:px-3">
                      {unitLabel}
                    </th>
                    {years.map((y) => (
                      <th
                        key={y}
                        scope="col"
                        className={`px-2 py-2 text-right whitespace-nowrap sm:px-3 ${y === query.year ? "bg-dc-brand-primary text-white" : ""}`}
                      >
                        {y}
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-2 text-right whitespace-nowrap sm:px-3">
                      เปลี่ยนแปลงจากปีแรก
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {units.map((u) => (
                    <tr key={u.key} className="border-t border-dc-border-subtle">
                      <th scope="row" className="min-w-28 px-2 py-2 text-left font-normal break-words sm:px-3">
                        {u.name}
                      </th>
                      {u.totals.map((t, i) => (
                        <td
                          key={years[i]}
                          className={`px-2 py-2 text-right whitespace-nowrap sm:px-3 ${i === at ? "bg-dc-highlight-soft font-bold text-dc-brand-deep" : ""}`}
                        >
                          {t === null ? "—" : formatCount(t)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">
                        {u.change ? changeText(u.change) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-dc-text-secondary md:hidden">
            <MoveHorizontal aria-hidden="true" className="size-3.5 shrink-0" />
            ปัดตารางซ้ายหรือขวาเพื่อดูคอลัมน์อื่น
          </p>
          <p className="mt-2 text-xs text-dc-text-secondary">
            เปลี่ยนแปลงจากปีแรกที่{unitLabel}นั้นมีข้อมูลถึงปี {query.year}
            {report.partial && ` · "—" คือ${unitLabel}นั้นไม่มีข้อมูลในปีนั้น การเปลี่ยนแปลงจึงนับจากปีแรกที่มีข้อมูล`}
          </p>
        </div>
      </div>
    </section>
  );
}
