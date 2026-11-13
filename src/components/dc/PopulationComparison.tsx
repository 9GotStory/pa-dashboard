"use client";

import { ChartBar, MoveHorizontal, Table } from "lucide-react";
import { useState } from "react";
import { formatCount } from "@/lib/dc/format";
import type { AreaPopulation, HomePopulation } from "@/lib/dc/types";

type View = "chart" | "table";
type Sort = "code" | "population";

const VIEWS: [View, string, typeof ChartBar][] = [
  ["chart", "กราฟ", ChartBar],
  ["table", "ตาราง", Table],
];
const SORTS: [Sort, string][] = [
  ["code", "ตามรหัสตำบล"],
  ["population", "ตามจำนวนประชากร"],
];
// The ตำบล picked, the same in the chart and the table.
const PICKED = "bg-dc-highlight-soft font-bold";

/**
 * The เปรียบเทียบประชากรรายตำบล section of the home page (SPEC §9.2): ชาย
 * หญิง รวม and บ้าน of each ตำบล, every สำนักทะเบียน added up, labelled with
 * source as the summary is. A bar chart of รวม with the figure by each bar,
 * or a table with the อำเภอ's total, one at a time: both are on the page and
 * the one not shown is hidden. The ตำบล go by code, or by population with
 * ties by code. A bar or a row picks its ตำบล through onPick, for the ตำบล
 * that are pickable: one that catalog.json's areas lacks has no map area to
 * pick. selected marks the ตำบล picked anywhere. DistrictExplorer renders
 * it, holding the ตำบล picked.
 */
export default function PopulationComparison({
  population,
  source,
  selected,
  pickable,
  onPick,
}: {
  population: HomePopulation;
  source: string;
  selected: string | null;
  pickable: (id: string) => boolean;
  onPick: (id: string) => void;
}) {
  const [view, setView] = useState<View>("chart");
  const [sort, setSort] = useState<Sort>("code");
  const { district } = population;
  // population.areas is by code already.
  const areas: AreaPopulation[] =
    sort === "code"
      ? population.areas
      : population.areas.toSorted((a, b) => b.totals.total - a.totals.total || a.key.localeCompare(b.key));
  const top = Math.max(...areas.map((a) => a.totals.total));

  return (
    <section id="comparison" aria-labelledby="comparison-title" className="min-w-0">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="comparison-title" className="font-prompt text-lg font-semibold text-dc-brand-deep">
            เปรียบเทียบประชากรรายตำบล
          </h2>
          <p className="text-xs text-dc-text-secondary">รวมส่วนที่อยู่ในเขตเทศบาลแล้ว · {source}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented label="รูปแบบการแสดง" options={VIEWS} value={view} onChange={setView} />
          <Segmented label="เรียงตำบล" options={SORTS} value={sort} onChange={setSort} />
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-[10px] border border-dc-border-subtle bg-dc-surface">
        <div hidden={view !== "chart"} className="px-2 py-3 sm:px-4">
          <p className="px-2 pb-2 text-xs text-dc-text-secondary">ประชากรรวมของแต่ละตำบล (คน) · เลือกแท่งเพื่อดูตำบลนั้น</p>
          <div role="group" aria-label={`กราฟประชากรรายตำบล (คน) · ${source}`} className="grid gap-0.5">
            {areas.map((a) => {
              const picked = a.key === selected;
              return (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={picked}
                  aria-label={`ตำบล${a.name} ${formatCount(a.totals.total)} คน`}
                  disabled={!pickable(a.key)}
                  onClick={() => onPick(a.key)}
                  className={`grid min-h-11 grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 rounded-md px-2 text-left text-xs sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem] sm:text-[13px] ${
                    picked ? PICKED : "hover:bg-dc-canvas"
                  }`}
                >
                  <span className="truncate text-dc-brand-deep">{a.name}</span>
                  <span aria-hidden="true" className="block h-3.5 overflow-hidden rounded-full bg-dc-surface-muted">
                    <span
                      className={`block h-full rounded-full ${picked ? "bg-dc-brand-primary" : "bg-dc-brand-accent"}`}
                      style={{ width: `${(a.totals.total / top) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-semibold text-dc-brand-deep tabular-nums">
                    {formatCount(a.totals.total)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div hidden={view !== "table"}>
          {/* Wider than a phone: it scrolls inside this box, never the page (SPEC §9.1).
              Focusable, so a keyboard scrolls it to the columns past the buttons. */}
          <div role="region" aria-label="ตารางประชากรรายตำบล" tabIndex={0} className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-[13px] tabular-nums">
              <caption className="sr-only">ประชากรรายตำบล ชาย หญิง รวม และบ้าน · {source}</caption>
              <thead className="bg-dc-surface-muted text-xs text-dc-brand-deep">
                <tr>
                  <th scope="col" className="py-2.5 pr-3 pl-4 text-left sm:pl-5">
                    ตำบล
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right">
                    ชาย (คน)
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right">
                    หญิง (คน)
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right">
                    รวม (คน)
                  </th>
                  <th scope="col" className="py-2.5 pr-4 pl-3 text-right sm:pr-5">
                    บ้าน
                  </th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => {
                  const picked = a.key === selected;
                  const canPick = pickable(a.key);
                  return (
                    // A click anywhere on the row picks it; the ตำบล's button is the row for a keyboard.
                    <tr
                      key={a.key}
                      onClick={canPick ? () => onPick(a.key) : undefined}
                      className={`border-t border-dc-border-subtle ${picked ? PICKED : canPick ? "cursor-pointer hover:bg-dc-canvas" : ""}`}
                    >
                      <th scope="row" className="py-1 pr-3 pl-2 text-left font-semibold text-dc-brand-deep sm:pl-3">
                        {/* No onClick of its own: its click reaches the row's. */}
                        <button
                          type="button"
                          aria-pressed={picked}
                          disabled={!canPick}
                          className="min-h-10 rounded px-2 text-left"
                        >
                          {a.name}
                        </button>
                      </th>
                      <td className="px-3 py-1 text-right">{formatCount(a.totals.male)}</td>
                      <td className="px-3 py-1 text-right">{formatCount(a.totals.female)}</td>
                      <td className="px-3 py-1 text-right font-bold text-dc-brand-deep">
                        {formatCount(a.totals.total)}
                      </td>
                      <td className="py-1 pr-4 pl-3 text-right sm:pr-5">{formatCount(a.totals.house)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-dc-canvas font-bold text-dc-brand-deep">
                <tr className="border-t-2 border-dc-border-subtle">
                  <th scope="row" className="py-2.5 pr-3 pl-4 text-left sm:pl-5">
                    รวมทั้งอำเภอ
                  </th>
                  <td className="px-3 py-2.5 text-right">{formatCount(district.totals.male)}</td>
                  <td className="px-3 py-2.5 text-right">{formatCount(district.totals.female)}</td>
                  <td className="px-3 py-2.5 text-right">{formatCount(district.totals.total)}</td>
                  <td className="py-2.5 pr-4 pl-3 text-right sm:pr-5">{formatCount(district.totals.house)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="flex items-center gap-1.5 border-t border-dc-border-subtle px-4 py-2 text-[11px] text-dc-text-secondary sm:hidden">
            <MoveHorizontal aria-hidden="true" className="size-3.5 shrink-0" />
            ปัดตารางซ้ายหรือขวาเพื่อดูคอลัมน์อื่น
          </p>
        </div>
      </div>
    </section>
  );
}

// One compact segmented control (design.md §4): a button per option, the one on show pressed.
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [T, string, typeof ChartBar?][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md border border-dc-border-subtle bg-dc-surface p-0.5">
      {options.map(([option, text, Icon]) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded px-3 text-xs font-bold ${
            option === value ? "bg-dc-brand-primary text-white" : "text-dc-brand-deep hover:bg-dc-canvas"
          }`}
        >
          {Icon && <Icon aria-hidden="true" className="size-4" />}
          {text}
        </button>
      ))}
    </div>
  );
}
