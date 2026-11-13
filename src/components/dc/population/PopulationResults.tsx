"use client";

import { useSearchParams } from "next/navigation";
import { startTransition, useOptimistic, useRef, useState } from "react";
import { formatCount, formatPct } from "@/lib/dc/format";
import { populationReport, populationSearch } from "@/lib/dc/population-report";
import { yearAsOf } from "@/lib/dc/population-totals";
import type { PopulationChange, PopulationQuery, PopulationReport, PopulationReportData } from "@/lib/dc/types";
import ReportLoader from "../report/ReportLoader";
import { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import { CountTrendChart, CountTrendList } from "./CountTrend";

/**
 * ผลรายงาน of รายงานประชากร (SPEC §9.4.1): reports/population.json loaded
 * in the browser, the ปีข้อมูล form, then the whole อำเภอ's ตัวเลขสรุป and
 * แนวโน้มรายปี, all from populationReport (SCHEMA §11.5).
 */
export default function PopulationResults() {
  return <ReportLoader<PopulationReportData> id="population">{(data) => <Results data={data} />}</ReportLoader>;
}

function Results({ data }: { data: PopulationReportData }) {
  const params = useSearchParams();
  // As useReportQuery does for the HDC reports: the query แสดงผล applies is
  // shown at once while Next.js takes the new URL in a transition, and back,
  // forward and a shared link show the same result.
  const [search, setSearch] = useOptimistic(`?${params}`);
  const heading = useRef<HTMLHeadingElement>(null);
  const report = populationReport(data, { year: new URLSearchParams(search).get("year") ?? "" });
  const apply = (q: PopulationQuery) => {
    const next = populationSearch(q);
    if (next !== search) {
      startTransition(() => {
        setSearch(next);
        window.history.pushState(null, "", next);
      });
    }
    heading.current?.focus({ preventScroll: true });
  };
  const { query, shown, change } = report;

  return (
    <>
      {/* Remounted when the query changes (แสดงผล, back, forward), so the form shows what the results show */}
      <PopulationFilters key={search} report={report} onApply={apply} />
      <ResultsHeader heading={heading} summary={`ทั้งอำเภอสอง · ${yearAsOf(query.year)}`} dateCom={null} />
      {!shown ? (
        <NoYear year={query.year} />
      ) : (
        <div className="space-y-4 px-4 pb-6 sm:px-6">
          <Summary year={query.year} shown={shown} change={change} />
          <Trend report={report} />
        </div>
      )}
    </>
  );
}

/**
 * The form of SPEC §9.4.1: ปีข้อมูล, every year of the snapshot as ณ 31 ธ.ค.
 * {ปี}, and แสดงผล. A year not in the data (?year=2570) is not in the list:
 * the form offers the latest instead.
 */
function PopulationFilters({ report, onApply }: { report: PopulationReport; onApply: (q: PopulationQuery) => void }) {
  const latest = report.years.at(-1) ?? "";
  const [year, setYear] = useState(report.years.includes(report.query.year) ? report.query.year : latest);
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
          onApply({ year });
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

/** A change as shown (SPEC §9.4.1): signed + or −, never color alone, and "—" for a ร้อยละ from 0 */
function changeText({ count, pct }: PopulationChange, unit: string): string {
  const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
  return `${sign(count)}${formatCount(Math.abs(count))} ${unit} (${pct === null ? "—" : `${sign(pct)}${formatPct(Math.abs(pct))}%`})`;
}

/** ตัวเลขสรุป: ประชากร ชาย หญิง บ้าน of the year picked, each with its change from the year before when there is one */
function Summary(props: {
  year: string;
  shown: NonNullable<PopulationReport["shown"]>;
  change: PopulationReport["change"];
}) {
  const { year, shown, change } = props;
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
              <CountTrendList title={s.title} points={s.points} />
            </div>
            <div className="hidden sm:block">
              <CountTrendChart title={s.title} points={s.points} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
