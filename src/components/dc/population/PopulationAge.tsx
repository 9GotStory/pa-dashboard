import { MoveHorizontal } from "lucide-react";
import { bandName, formatCount, formatPct } from "@/lib/dc/format";
import { populationArea } from "@/lib/dc/population-report";
import { yearAsOf } from "@/lib/dc/population-totals";
import type { PopulationAgeReport, PopulationReport } from "@/lib/dc/types";
import TrendChart from "../charts/TrendChart";
import TrendList from "../charts/TrendList";
import { PyramidRows, UnsplitText } from "../PopulationPyramid";

const NO_AGE = "ไม่มีข้อมูลอายุของปีนี้";

/**
 * The โครงสร้างอายุ and ประชากรที่ไม่แยกอายุ sections of รายงานประชากร for the
 * อำเภอ or a ตำบล (SPEC §9.4.1), from report.age (SCHEMA §11.5): the pyramid
 * of the year picked over the outline of the first year with age rows, its
 * อัตราส่วนเพศ and วัย, the ร้อยละ aged 60 and over of every year, the table
 * of ช่วงอายุ × ปีข้อมูล, then the ประชากรที่ไม่แยกอายุ by kind. A year without
 * age rows says ไม่มีข้อมูลอายุของปีนี้, never 0, and is "—" in the trend and
 * the table. PopulationResults loads it with next/dynamic, so its JavaScript
 * comes after the page's (SPEC §9.6).
 */
export default function PopulationAge({ report, age }: { report: PopulationReport; age: PopulationAgeReport }) {
  const { shown, stages, sex_ratio } = age;
  const year = report.query.year;
  const area = populationArea(report);
  return (
    <>
      <section aria-labelledby="population-age" className="min-w-0 space-y-4">
        <div>
          <h2 id="population-age" className="font-prompt text-base font-semibold text-dc-brand-deep">
            โครงสร้างอายุ
          </h2>
          <p className="text-xs text-dc-text-secondary">
            ทุกค่าในส่วนนี้คิดจากผู้ที่แยกอายุได้
            {shown && ` ${formatCount(shown.age_total)} คนในปี ${year}`} ไม่รวมประชากรที่ไม่แยกอายุ
          </p>
        </div>
        {shown && stages && sex_ratio !== null ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(16rem,0.62fr)]">
            <div className="min-w-0 rounded-[9px] border border-dc-border-subtle bg-white px-2 py-4 sm:px-5">
              <h3 className="mb-2 px-2 font-prompt text-sm font-semibold text-dc-brand-deep sm:px-0">
                พีระมิดประชากร {yearAsOf(year)}
              </h3>
              <PyramidRows scope={area} age={shown} source={yearAsOf(year)} first={age.first} />
            </div>
            <Stages sexRatio={sex_ratio} stages={stages} aged60={shown.aged60} />
          </div>
        ) : (
          <p className="rounded-[9px] border border-dc-border-subtle px-4 py-6 text-center text-sm text-dc-text-secondary">
            {NO_AGE}
          </p>
        )}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Aged60Trend age={age} />
          <BandTable report={report} age={age} area={area} />
        </div>
      </section>

      <section aria-labelledby="population-unsplit">
        <h2 id="population-unsplit" className="mb-2 font-prompt text-base font-semibold text-dc-brand-deep">
          ประชากรที่ไม่แยกอายุ
        </h2>
        {shown ? (
          <div className="rounded-[9px] border border-dc-border-subtle bg-white px-4 py-3">
            <p className="text-sm text-dc-brand-deep tabular-nums">
              ปี {year} <UnsplitText unsplit={shown.unsplit} />
            </p>
            <p className="mt-1 text-xs text-dc-text-secondary">
              ไฟล์อายุของกรมการปกครองไม่ได้นับคนกลุ่มนี้ไว้ในจำนวนรายปีอายุ จึงไม่อยู่ในส่วนโครงสร้างอายุข้างบน
            </p>
          </div>
        ) : (
          <p className="text-sm text-dc-text-secondary">{NO_AGE}</p>
        )}
      </section>
    </>
  );
}

/**
 * อัตราส่วนเพศ and the ร้อยละ of each วัย of the year picked, each วัย with a
 * bar of its ร้อยละ, วัยสูงอายุ with its aged60 people too
 */
function Stages(props: { sexRatio: number; stages: NonNullable<PopulationAgeReport["stages"]>; aged60: number }) {
  const { sexRatio, stages, aged60 } = props;
  const rows = [
    { label: "วัยเด็ก (0–14 ปี)", pct: stages.child },
    { label: "วัยทำงาน (15–59 ปี)", pct: stages.working },
    { label: "วัยสูงอายุ (60 ปีขึ้นไป)", pct: stages.aged, count: aged60 },
  ];
  return (
    <div className="min-w-0 rounded-[9px] border border-dc-border-subtle bg-white px-4 py-4 sm:px-5">
      <dl>
        <dt className="text-xs font-semibold text-dc-text-secondary">อัตราส่วนเพศ</dt>
        <dd className="mt-1 font-prompt text-2xl font-bold text-dc-brand-deep tabular-nums">{formatPct(sexRatio)}</dd>
        <dd className="text-xs text-dc-text-secondary">ชายต่อหญิง 100 คน</dd>
      </dl>
      <dl className="mt-4 space-y-3 border-t border-dc-border-subtle pt-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-semibold text-dc-text-secondary">{r.label}</dt>
            <dd className="font-prompt text-lg font-bold text-dc-brand-deep tabular-nums">
              ร้อยละ {formatPct(r.pct)}
              {r.count !== undefined && (
                <span className="ml-1 text-xs font-normal text-dc-text-secondary">({formatCount(r.count)} คน)</span>
              )}
            </dd>
            <dd aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-dc-surface-muted">
              <span className="block h-full rounded-full bg-dc-brand-accent" style={{ width: `${r.pct}%` }} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The ร้อยละ aged 60 and over of every ปีข้อมูล: a line from sm up, a list on a phone */
function Aged60Trend({ age }: { age: PopulationAgeReport }) {
  const title = "ร้อยละอายุ 60 ปีขึ้นไปรายปี";
  const points = age.aged60.map((p) => ({ year: p.year, value: p.pct }));
  return (
    <div className="min-w-0 rounded-[9px] border border-dc-border-subtle bg-white p-4">
      <h3 className="mb-3 font-prompt text-sm font-semibold text-dc-brand-deep">{title}</h3>
      <div className="sm:hidden">
        <TrendList title={title} points={points} goal={null} unit="pct" />
      </div>
      <div className="hidden sm:block">
        <TrendChart title={title} points={points} goal={null} unit="pct" />
      </div>
      <p className="mt-2 text-xs text-dc-text-secondary">
        ของผู้ที่แยกอายุได้ในปีเดียวกัน
        {points.some((p) => p.value === null) && ` · "—" คือปีที่ไม่มีข้อมูลอายุ`}
      </p>
    </div>
  );
}

/** ช่วงอายุ × ปีข้อมูล, ชาย and หญิง together, the column of the year picked marked */
function BandTable({ report, age, area }: { report: PopulationReport; age: PopulationAgeReport; area: string }) {
  const { years, query } = report;
  const at = years.indexOf(query.year);
  const caption = `ประชากรรายช่วงอายุรายปี ชายและหญิง (คน) · ${area} · ปีข้อมูลที่เลือก ${yearAsOf(query.year)}`;
  return (
    <div className="min-w-0">
      <div className="overflow-hidden rounded-[9px] border border-dc-border-subtle bg-white">
        {/* The caption's text, shown outside the scrolling box so a phone sees all of it; the caption itself is for screen readers */}
        <p aria-hidden="true" className="px-4 pt-4 pb-3 font-prompt text-sm font-semibold text-dc-brand-deep">
          {caption}
        </p>
        {/* Wider than a phone: it scrolls inside this box, never the page (SPEC §9.1). Focusable, so a keyboard scrolls it. */}
        <div role="region" tabIndex={0} aria-label="ตารางประชากรรายช่วงอายุ (เลื่อนดูแนวนอนได้)" className="overflow-x-auto">
          <table className="w-full border-collapse text-xs tabular-nums">
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-dc-highlight-soft text-dc-brand-deep">
              <tr>
                <th scope="col" className="px-2 py-2 text-left sm:px-3">
                  ช่วงอายุ
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
              </tr>
            </thead>
            <tbody className="bg-white">
              {age.bands.map((b) => (
                <tr key={b.label} className="border-t border-dc-border-subtle">
                  <th scope="row" className="px-2 py-1.5 text-left font-normal whitespace-nowrap sm:px-3">
                    {bandName(b.label)}
                  </th>
                  {b.totals.map((t, i) => (
                    <td
                      key={years[i]}
                      className={`px-2 py-1.5 text-right whitespace-nowrap sm:px-3 ${i === at ? "bg-dc-highlight-soft font-bold text-dc-brand-deep" : ""}`}
                    >
                      {t === null ? "—" : formatCount(t)}
                    </td>
                  ))}
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
      {age.bands[0].totals.includes(null) && (
        <p className="mt-2 text-xs text-dc-text-secondary">&quot;—&quot; คือปีที่ไม่มีข้อมูลอายุ</p>
      )}
    </div>
  );
}
