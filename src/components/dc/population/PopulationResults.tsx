"use client";

import { useState } from "react";
import { populationCsv } from "@/lib/dc/csv";
import { formatCount, formatPct } from "@/lib/dc/format";
import { populationArea, populationReport, populationSearch, sortUnits } from "@/lib/dc/population-report";
import { yearAsOf } from "@/lib/dc/population-totals";
import type {
  DcCatalog,
  PopulationQuery,
  PopulationReport,
  PopulationReportData,
  PopulationSort,
} from "@/lib/dc/types";
import TrendChart from "../charts/TrendChart";
import TrendList from "../charts/TrendList";
import ReportActions from "../report/ReportActions";
import ReportLoader from "../report/ReportLoader";
import ReportStatus, { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import { useUrlQuery } from "../report/useUrlQuery";
import PopulationUnits, { changeText } from "./PopulationUnits";

type Areas = DcCatalog["areas"];

/**
 * ผลรายงาน of รายงานประชากร (SPEC §9.4.1): reports/population.json loaded
 * in the browser, the ปีข้อมูล and พื้นที่ form, then the area's ตัวเลขสรุป,
 * แนวโน้มรายปี and เปรียบเทียบ of its ตำบล or หมู่บ้าน, all from
 * populationReport (SCHEMA §11.5), with the CSV of the เปรียบเทียบ table.
 */
export default function PopulationResults({ areas, districtCode }: { areas: Areas; districtCode: string }) {
  return (
    <ReportLoader<PopulationReportData> id="population">
      {(data) => <Results data={data} areas={areas} districtCode={districtCode} />}
    </ReportLoader>
  );
}

function Results({ data, areas, districtCode }: { data: PopulationReportData; areas: Areas; districtCode: string }) {
  const {
    query: asked,
    search,
    apply,
    heading,
  } = useUrlQuery<PopulationQuery>(
    (params) => ({ year: params.get("year") ?? "", area: params.get("area") ?? "all" }),
    populationSearch,
  );
  // Not in the URL, as the เปรียบเทียบ of the home page (SPEC §9.4.1)
  const [sort, setSort] = useState<PopulationSort>("code");
  const report = populationReport(data, asked, areas);
  const { query, shown, change, share } = report;
  const units = sortUnits(report, sort);
  const hasYear = report.years.includes(query.year);

  return (
    <>
      {/* Remounted when the query changes (แสดงผล, back, forward), so the form shows what the results show */}
      <PopulationFilters key={search} report={report} areas={areas} onApply={apply} />
      <ResultsHeader heading={heading} summary={`${populationArea(report)} · ${yearAsOf(query.year)}`} dateCom={null}>
        <ReportActions csv={shown ? () => populationCsv(report, units, districtCode) : null} />
      </ResultsHeader>
      {!hasYear ? (
        <NoYear year={query.year} />
      ) : !shown ? (
        <ReportStatus>
          ไม่มีข้อมูลของ{populationArea(report)}ในปี {query.year}
        </ReportStatus>
      ) : (
        <div className="space-y-4 px-4 pb-6 sm:px-6">
          <Summary year={query.year} shown={shown} change={change} share={share} />
          <Trend report={report} />
          <PopulationUnits report={report} units={units} sort={sort} onSort={setSort} />
        </div>
      )}
    </>
  );
}

/**
 * The form of SPEC §9.4.1: ปีข้อมูล, every year of the snapshot as ณ 31 ธ.ค.
 * {ปี}, พื้นที่, the whole อำเภอ or one of its ตำบล, and แสดงผล. A year not
 * in the data (?year=2570) is not in the list: the form offers the latest
 * instead.
 */
function PopulationFilters(props: { report: PopulationReport; areas: Areas; onApply: (q: PopulationQuery) => void }) {
  const { report, areas, onApply } = props;
  const latest = report.years.at(-1) ?? "";
  const [year, setYear] = useState(report.years.includes(report.query.year) ? report.query.year : latest);
  const [area, setArea] = useState(report.query.area);
  return (
    <section
      aria-labelledby="filters-title"
      className="border-b border-dc-border-subtle bg-dc-highlight-soft/50 px-4 py-5 sm:px-6 print:hidden"
    >
      <h2 id="filters-title" className="font-prompt text-[15px] font-semibold text-dc-brand-deep">
        ตัวกรองรายงาน
      </h2>
      <p className="text-xs text-dc-text-secondary">เลือกเงื่อนไขแล้วกดแสดงผล</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply({ year, area });
        }}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="flex min-w-0 flex-col gap-1 sm:w-44">
          <label htmlFor="filter-year" className="text-xs font-bold text-dc-brand-deep">
            ปีข้อมูล
          </label>
          <select
            id="filter-year"
            name="year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-11 w-full min-w-0 rounded-md border border-dc-border-subtle bg-white px-2 text-[13px] text-dc-brand-deep"
          >
            {[...report.years].reverse().map((y) => (
              <option key={y} value={y}>
                {yearAsOf(y)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1 sm:w-52">
          <label htmlFor="filter-area" className="text-xs font-bold text-dc-brand-deep">
            พื้นที่
          </label>
          <select
            id="filter-area"
            name="area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="h-11 w-full min-w-0 rounded-md border border-dc-border-subtle bg-white px-2 text-[13px] text-dc-brand-deep"
          >
            <option value="all">ทั้งอำเภอสอง</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                ตำบล{a.name_th}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-11 rounded-md bg-dc-brand-primary px-5 font-semibold text-white hover:bg-dc-brand-deep"
        >
          แสดงผล
        </button>
      </form>
    </section>
  );
}

/**
 * ตัวเลขสรุป: ประชากร ชาย หญิง บ้าน of the year picked, each with its change
 * from the year before when there is one, and a ตำบล's ร้อยละ of the อำเภอ
 */
function Summary(props: {
  year: string;
  shown: NonNullable<PopulationReport["shown"]>;
  change: PopulationReport["change"];
  share: number | null;
}) {
  const { year, shown, change, share } = props;
  const tiles = [
    { key: "total", label: "ประชากร", unit: "คน" },
    { key: "male", label: "ชาย", unit: "คน" },
    { key: "female", label: "หญิง", unit: "คน" },
    { key: "house", label: "บ้าน", unit: "บ้าน" },
  ] as const;
  return (
    <section aria-labelledby="population-summary">
      <h2 id="population-summary" className="mb-2 font-prompt text-base font-semibold text-dc-brand-deep">
        ตัวเลขสรุป
      </h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.key} className="min-w-0 rounded-lg border border-dc-border-subtle bg-dc-canvas/40 px-4 py-3">
            <dt className="text-xs text-dc-text-secondary">{t.label}</dt>
            <dd className="font-prompt text-2xl font-semibold text-dc-brand-deep tabular-nums">
              {formatCount(shown[t.key])} <span className="text-xs font-normal text-dc-text-secondary">{t.unit}</span>
            </dd>
            {change && (
              <dd className="mt-1 text-xs text-dc-text-secondary tabular-nums">
                {changeText(change[t.key], t.unit)} จากปี {Number(year) - 1}
              </dd>
            )}
            {t.key === "total" && share !== null && (
              <dd className="mt-1 text-xs text-dc-text-secondary tabular-nums">ร้อยละ {formatPct(share)} ของอำเภอ</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * แนวโน้มรายปี: ประชากร and บ้าน of every ปีข้อมูล, each on its own chart as
 * their scales differ; a line from sm up, a list on a phone
 */
function Trend({ report }: { report: PopulationReport }) {
  const series = [
    { title: "ประชากรรายปี", points: report.trend.map((p) => ({ year: p.year, value: p.totals?.total ?? null })) },
    { title: "บ้านรายปี", points: report.trend.map((p) => ({ year: p.year, value: p.totals?.house ?? null })) },
  ];
  return (
    <section aria-labelledby="population-trend">
      <h2 id="population-trend" className="mb-2 font-prompt text-base font-semibold text-dc-brand-deep">
        แนวโน้มรายปี
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {series.map((s) => (
          <div key={s.title} className="min-w-0 rounded-[9px] border border-dc-border-subtle bg-white p-4">
            <h3 className="mb-3 font-prompt text-sm font-semibold text-dc-brand-deep">{s.title}</h3>
            <div className="sm:hidden">
              <TrendList title={s.title} points={s.points} goal={null} unit="count" />
            </div>
            <div className="hidden sm:block">
              <TrendChart title={s.title} points={s.points} goal={null} unit="count" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
