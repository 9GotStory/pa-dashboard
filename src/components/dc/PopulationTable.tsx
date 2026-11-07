import { formatCount } from "@/lib/dc/format";
import type { HomePopulation } from "@/lib/dc/types";

/**
 * The ประชากรรายตำบล table of the home page (SPEC §9.2): ชาย หญิง รวม and
 * บ้าน of each ตำบล, every สำนักทะเบียน added up, and the อำเภอ's total,
 * labelled with source as the summary is. Its ดูข้อมูล button picks a ตำบล
 * for the map and the area panel through onView, on the rows of the ตำบล
 * that are pickable: one that catalog.json's areas lacks has no map area or
 * button to pick. selected marks the ตำบล picked anywhere. A phone gets a
 * list of cards to open instead, as in R6, the card of the ตำบล picked
 * opened. DistrictExplorer renders it, holding the ตำบล picked.
 */
export default function PopulationTable({
  population,
  source,
  selected,
  pickable,
  onView,
}: {
  population: HomePopulation;
  source: string;
  selected: string | null;
  pickable: (id: string) => boolean;
  onView: (id: string) => void;
}) {
  const { district, areas } = population;

  return (
    <section aria-labelledby="population-title" className="overflow-hidden rounded-[10px] border border-dc-border bg-white">
      <div className="flex flex-col gap-2 border-b border-dc-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <h2 id="population-title" className="font-prompt text-lg font-semibold text-dc-navy">
            ประชากรรายตำบล
          </h2>
          <p className="text-xs text-dc-muted">ชาย หญิง และจำนวนบ้าน รวมส่วนที่อยู่ในเขตเทศบาลแล้ว</p>
        </div>
        <p className="self-start rounded border border-dc-border bg-dc-canvas px-2.5 py-1.5 text-[11px] font-bold text-dc-muted">
          {source}
        </p>
      </div>

      {/* A table from md; a phone gets cards to open, as R6 does, not a table restyled */}
      <table className="hidden w-full border-collapse text-[13px] tabular-nums md:table">
        <caption className="sr-only">ประชากรรายตำบล ชาย หญิง รวม และบ้าน · {source}</caption>
        <thead className="bg-dc-blue-light/60 text-xs text-dc-navy">
          <tr>
            <th scope="col" className="w-16 py-2.5 pr-3 pl-5 text-left">
              ลำดับ
            </th>
            <th scope="col" className="px-3 py-2.5 text-left">
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
            <th scope="col" className="px-3 py-2.5 text-right">
              บ้าน
            </th>
            <th scope="col" className="w-28 py-2.5 pr-5 pl-3 text-center">
              เลือกพื้นที่
            </th>
          </tr>
        </thead>
        <tbody>
          {areas.map((a, i) => (
            <tr key={a.key} className={`border-t border-dc-border ${a.key === selected ? "bg-dc-teal/10" : ""}`}>
              <td className="py-2 pr-3 pl-5 text-dc-muted">{i + 1}</td>
              <th scope="row" className="px-3 py-2 text-left font-semibold text-dc-blue-dark">
                {a.name}
              </th>
              <td className="px-3 py-2 text-right">{formatCount(a.totals.male)}</td>
              <td className="px-3 py-2 text-right">{formatCount(a.totals.female)}</td>
              <td className="px-3 py-2 text-right font-bold text-dc-blue-dark">{formatCount(a.totals.total)}</td>
              <td className="px-3 py-2 text-right">{formatCount(a.totals.house)}</td>
              <td className="py-1 pr-5 pl-3 text-center">
                {pickable(a.key) && (
                  <button
                    type="button"
                    onClick={() => onView(a.key)}
                    className="min-h-9 rounded px-2 text-xs font-semibold text-dc-blue underline underline-offset-2 hover:text-dc-blue-dark"
                  >
                    ดูข้อมูล<span className="sr-only"> ตำบล{a.name}</span>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-dc-canvas font-bold text-dc-navy">
          <tr className="border-t-2 border-dc-border">
            <td />
            <th scope="row" className="px-3 py-2.5 text-left">
              รวมทั้งอำเภอ
            </th>
            <td className="px-3 py-2.5 text-right">{formatCount(district.totals.male)}</td>
            <td className="px-3 py-2.5 text-right">{formatCount(district.totals.female)}</td>
            <td className="px-3 py-2.5 text-right">{formatCount(district.totals.total)}</td>
            <td className="px-3 py-2.5 text-right">{formatCount(district.totals.house)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <div className="px-3.5 py-3 md:hidden">
        <p className="mb-2 text-xs text-dc-muted">แตะชื่อตำบลเพื่อดูชาย หญิง และจำนวนบ้าน</p>
        {areas.map((a) => (
          <details
            key={a.key}
            open={a.key === selected}
            className={`group mb-2 overflow-hidden rounded-[7px] border ${
              a.key === selected ? "border-dc-teal bg-dc-teal/5" : "border-dc-border open:border-dc-blue/40"
            }`}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="font-semibold text-dc-blue-dark">
                <span aria-hidden="true" className="mr-2 inline-block w-3 font-black text-dc-teal group-open:hidden">
                  +
                </span>
                <span aria-hidden="true" className="mr-2 hidden w-3 font-black text-dc-teal group-open:inline-block">
                  −
                </span>
                {a.name}
              </span>
              <span className="whitespace-nowrap tabular-nums">{formatCount(a.totals.total)} คน</span>
            </summary>
            <div className="border-t border-dc-border bg-white px-3 pt-2 pb-3">
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs tabular-nums">
                <dt className="text-dc-muted">ประชากรชาย</dt>
                <dd className="text-right font-semibold text-dc-ink">{formatCount(a.totals.male)} คน</dd>
                <dt className="text-dc-muted">ประชากรหญิง</dt>
                <dd className="text-right font-semibold text-dc-ink">{formatCount(a.totals.female)} คน</dd>
                <dt className="text-dc-muted">ประชากรรวม</dt>
                <dd className="text-right font-semibold text-dc-ink">{formatCount(a.totals.total)} คน</dd>
                <dt className="text-dc-muted">บ้าน</dt>
                <dd className="text-right font-semibold text-dc-ink">{formatCount(a.totals.house)} บ้าน</dd>
              </dl>
              {pickable(a.key) && (
                <button
                  type="button"
                  onClick={() => onView(a.key)}
                  className="mt-2.5 min-h-10 w-full rounded-[5px] border border-dc-blue/40 bg-dc-blue-light/50 px-3 text-xs font-bold text-dc-blue hover:bg-dc-blue-light"
                >
                  ดูข้อมูล<span className="sr-only"> ตำบล{a.name}</span>
                </button>
              )}
            </div>
          </details>
        ))}
        <p className="flex justify-between gap-2 rounded-[5px] bg-dc-blue-light px-3 py-3 font-bold text-dc-navy tabular-nums">
          <span>รวมทั้งอำเภอ</span>
          <span>{formatCount(district.totals.total)} คน</span>
        </p>
      </div>
    </section>
  );
}
