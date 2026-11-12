"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, startTransition, useEffect, useOptimistic, useRef, useState, type ReactNode, type RefObject } from "react";
import { loadReport } from "@/lib/dc/client";
import { csvFileName, formatCount, formatPct, formatThaiDate, toCsv } from "@/lib/dc/format";
import type { Cell, DcCatalog, DcReportData, DcYearBlock, Period, ReportQuery, Totals, TrendPoint, UnitTotals } from "@/lib/dc/types";
import {
  dataYears,
  goalFor,
  measureLabel,
  passes,
  periods,
  reportQuery,
  reportSearch,
  shownMeasures,
  totals,
  totalsBy,
  trend,
  yearBlock,
} from "@/lib/dc/values";
import PeriodChart from "./charts/PeriodChart";
import TrendChart from "./charts/TrendChart";
import UnitChart from "./charts/UnitChart";

type Names = Pick<DcCatalog, "areas" | "hospitals">;

/** ช่วงเวลา as the form lists it (name) and as a chart axis shortens it (short) */
const PERIOD_LABELS: Record<Period, { name: string; short: string }> = {
  year: { name: "ทั้งปี", short: "ทั้งปี" },
  q1: { name: "ไตรมาส 1 (ต.ค.–ธ.ค.)", short: "ไตรมาส 1" },
  q2: { name: "ไตรมาส 2 (ม.ค.–มี.ค.)", short: "ไตรมาส 2" },
  q3: { name: "ไตรมาส 3 (เม.ย.–มิ.ย.)", short: "ไตรมาส 3" },
  q4: { name: "ไตรมาส 4 (ก.ค.–ก.ย.)", short: "ไตรมาส 4" },
  m10: { name: "ตุลาคม", short: "ต.ค." },
  m11: { name: "พฤศจิกายน", short: "พ.ย." },
  m12: { name: "ธันวาคม", short: "ธ.ค." },
  m01: { name: "มกราคม", short: "ม.ค." },
  m02: { name: "กุมภาพันธ์", short: "ก.พ." },
  m03: { name: "มีนาคม", short: "มี.ค." },
  m04: { name: "เมษายน", short: "เม.ย." },
  m05: { name: "พฤษภาคม", short: "พ.ค." },
  m06: { name: "มิถุนายน", short: "มิ.ย." },
  m07: { name: "กรกฎาคม", short: "ก.ค." },
  m08: { name: "สิงหาคม", short: "ส.ค." },
  m09: { name: "กันยายน", short: "ก.ย." },
};

/** What เปรียบเทียบตาม compares by */
const UNIT_LABELS: Record<ReportQuery["by"], string> = { area: "ตำบล", hosp: "หน่วยบริการ" };

/** ร้อยละ as shown, "—" when the เป้าหมาย is 0 (SPEC §9.4) */
function pctText(pct: number | null): string {
  return pct === null ? "—" : formatPct(pct);
}

function areaLabel(area: string, names: Names): string {
  return area === "all" ? "ทั้งอำเภอ" : `ตำบล${names.areas.find((a) => a.id === area)?.name_th}`;
}

/** The filters in one line, for the results, the CSV and screen readers */
function describe(q: ReportQuery, names: Names): string {
  return [
    `ปีงบประมาณ ${q.year}`,
    areaLabel(q.area, names),
    PERIOD_LABELS[q.period].name,
    ...(q.measure === null ? [] : [`รายการ ${measureLabel(q.measure)}`]),
    `เปรียบเทียบราย${UNIT_LABELS[q.by]}`,
  ].join(" · ");
}

function Status({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="px-4 py-12 text-center text-dc-muted sm:px-6">
      {children}
    </p>
  );
}

/**
 * The filters and results of a coverage report (SPEC §9.4). The report's
 * JSON is loaded once and the numbers are worked out in the browser; แสดงผล
 * writes the query to the URL with history.pushState, which Next.js passes to
 * useSearchParams, so back, forward and a shared link show the same result.
 */
export default function CoverageReport(props: { id: string; names: Names; years: string[] }) {
  return (
    <Suspense fallback={<Status>กำลังโหลดข้อมูลรายงาน…</Status>}>
      <Coverage {...props} />
    </Suspense>
  );
}

function Coverage({ id, names, years }: { id: string; names: Names; years: string[] }) {
  const params = useSearchParams();
  // The query แสดงผล applies, shown at once. Next.js takes a new URL in a
  // transition that re-renders its router tree from the top: the first change
  // after a page load took 95 ms (111 at worst) at 4× CPU against the 100 ms
  // of FEATURES F20, and 60 ms (97 at worst) this way. React drops it in the
  // render that brings the URL's own query.
  const [search, setSearch] = useOptimistic(`?${params}`);
  const heading = useRef<HTMLHeadingElement>(null);
  const [load, setLoad] = useState<{ data: DcReportData } | "loading" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    loadReport(id).then(
      (data) => {
        if (!ignore) setLoad({ data });
      },
      () => {
        if (!ignore) setLoad("failed");
      },
    );
    return () => {
      ignore = true;
    };
  }, [id, attempt]);

  if (load === "loading") return <Status>กำลังโหลดข้อมูลรายงาน…</Status>;
  if (load === "failed") {
    return (
      <Status>
        โหลดข้อมูลรายงานไม่สำเร็จ{" "}
        <button
          type="button"
          onClick={() => {
            setLoad("loading");
            setAttempt(attempt + 1);
          }}
          className="font-semibold text-dc-blue underline underline-offset-2"
        >
          ลองอีกครั้ง
        </button>
      </Status>
    );
  }
  const query = reportQuery(load.data, new URLSearchParams(search), names);
  const apply = (q: ReportQuery) => {
    const next = reportSearch(q);
    if (next !== search) {
      startTransition(() => {
        setSearch(next);
        window.history.pushState(null, "", next);
      });
    }
    // As R6 does: focus on the result, not on a form that is drawn again
    heading.current?.focus({ preventScroll: true });
  };
  return (
    <>
      {/* Remounted when the query changes (แสดงผล, back, forward), so the form shows what the results show */}
      <Filters key={search} data={load.data} names={names} query={query} onApply={apply} />
      <Results data={load.data} names={names} query={query} years={years} heading={heading} />
    </>
  );
}

function Select(props: {
  name: keyof ReportQuery;
  label: string;
  value: string;
  options: [value: string, text: string][];
  disabled?: string[];
  onPick: (name: keyof ReportQuery, value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:w-44">
      <label htmlFor={`filter-${props.name}`} className="text-xs font-bold text-dc-ink">
        {props.label}
      </label>
      <select
        id={`filter-${props.name}`}
        name={props.name}
        value={props.value}
        onChange={(e) => props.onPick(props.name, e.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-dc-border bg-white px-2 text-[13px] text-dc-ink"
      >
        {props.options.map(([value, text]) => (
          <option key={value} value={value} disabled={props.disabled?.includes(value)}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The form of SPEC §9.4. Its choices are worked into a query the same way as
 * the URL's, so ช่วงเวลา and รายการวัคซีน follow the year picked; แสดงผล
 * applies them.
 */
function Filters({ data, names, query, onApply }: { data: DcReportData; names: Names; query: ReportQuery; onApply: (q: ReportQuery) => void }) {
  const years = dataYears(data);
  // A year without data (?year=2560) is not in the list: the form offers the latest instead
  const [picked, setPicked] = useState<Record<keyof ReportQuery, string>>(() => ({
    year: years.includes(query.year) ? query.year : (years[0] ?? ""),
    area: query.area,
    period: query.period,
    measure: query.measure ?? "",
    by: query.by,
  }));
  if (years.length === 0) return null;
  const draft = reportQuery(data, new URLSearchParams(picked), names);
  const block = yearBlock(data, draft.year);
  const periodOptions = block ? periods(block, data.report) : [];
  const measureOptions = block ? shownMeasures(data, block) : [];
  const pick = (name: keyof ReportQuery, value: string) => setPicked({ ...picked, [name]: value });
  return (
    <section aria-labelledby="filters-title" className="border-b border-dc-border bg-dc-blue-light/50 px-4 py-5 sm:px-6 print:hidden">
      <h2 id="filters-title" className="font-prompt text-[15px] font-semibold text-dc-navy">
        ตัวกรองรายงาน
      </h2>
      <p className="text-xs text-dc-muted">เลือกเงื่อนไขแล้วกดแสดงผล</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
        }}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <Select name="year" label="ปีงบประมาณ" value={draft.year} options={years.map((y) => [y, y])} onPick={pick} />
          <Select
            name="area"
            label="พื้นที่"
            value={draft.area}
            options={[["all", "ทั้งอำเภอ"], ...names.areas.map((a): [string, string] => [a.id, `ตำบล${a.name_th}`])]}
            onPick={pick}
          />
          <Select
            name="period"
            label="ช่วงเวลา"
            value={draft.period}
            options={(periodOptions.length > 0 ? periodOptions : ["year" as const]).map((p) => [p, PERIOD_LABELS[p].name])}
            onPick={pick}
          />
          {measureOptions.length > 0 && (
            <Select
              name="measure"
              label="รายการวัคซีน"
              value={draft.measure ?? ""}
              options={measureOptions.map((m) => [m, measureLabel(m)])}
              onPick={pick}
            />
          )}
          {/* One ตำบล is compared by หน่วยบริการ only (SPEC §9.4) */}
          <Select
            name="by"
            label="เปรียบเทียบตาม"
            value={draft.by}
            options={(["area", "hosp"] as const).map((by): [string, string] => [by, UNIT_LABELS[by]])}
            disabled={draft.area === "all" ? [] : ["area"]}
            onPick={pick}
          />
        </div>
        <button type="submit" className="h-10 rounded-md bg-dc-blue px-5 font-semibold text-white hover:bg-dc-blue-dark">
          แสดงผล
        </button>
      </form>
    </section>
  );
}

function Surface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[9px] border border-dc-border bg-white p-4">
      <h3 className="mb-3 font-prompt text-sm font-semibold text-dc-navy">{title}</h3>
      {children}
    </section>
  );
}

function Key({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i aria-hidden="true" className={`inline-block ${swatch}`} />
      {children}
    </span>
  );
}

/** The result of the query (SPEC §9.4), or why there is nothing to show */
function Results(props: {
  data: DcReportData;
  names: Names;
  query: ReportQuery;
  years: string[];
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const { data, names, query, years, heading } = props;
  const { report } = data;
  const block = yearBlock(data, query.year);
  // Whether a rule of SCHEMA §4.3 finds the table's columns that year
  const recognised = block !== null && periods(block, report).length > 0;
  const units = block && totalsBy(block, report, query, names);
  const total = block && totals(block, report, query);
  // null: the whole district has no ผลงาน that year, shown as "—" (SPEC §9.4)
  const values = units && total ? { units, total } : null;
  const figures = block && recognised && (!values || values.units.length > 0) ? { block, values } : null;
  // Never zeros for what is not there (SPEC §9.4)
  const problem = !block
    ? query.year
      ? `ไม่มีข้อมูลปี ${query.year} ในระบบ`
      : "ยังไม่มีข้อมูลของรายงานนี้ในระบบ"
    : !recognised
      ? "ไม่รู้จักโครงสร้างตาราง ต้องกำหนด col_target/col_result"
      : `ไม่มีข้อมูลของ${areaLabel(query.area, names)}ในปี ${query.year}`;
  // No year at all: the report has no data yet, so there is no filter to name
  const summary = query.year ? describe(query, names) : "";
  const unitLabel = UNIT_LABELS[query.by];
  const totalLabel = `รวม${areaLabel(query.area, names)}`;

  const downloadCsv = () => {
    if (!figures?.values) return;
    const { block } = figures;
    const { units, total } = figures.values;
    const rows: Cell[][] = [
      ["Song Health Data Center · ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่"],
      ["รายงาน", `${report.report_name} (${report.opendata_id})`],
      ["ตัวกรอง", summary],
      ["แหล่งข้อมูล", `HDC Open Data ตาราง ${report.source_table} · วันที่ข้อมูล ${formatThaiDate(block.max_date_com)}`],
      [],
      [unitLabel, "เป้าหมาย", "ผลงาน", "ร้อยละ"],
      ...units.map((u) => [u.name, u.totals.target, u.totals.result, pctText(u.totals.pct)]),
      [totalLabel, total.target, total.result, pctText(total.pct)],
    ];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFileName(report, query.year);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div className="flex flex-col gap-3 px-4 pt-5 pb-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <h2 ref={heading} tabIndex={-1} className="font-prompt text-lg font-semibold text-dc-navy">
            ผลรายงาน
          </h2>
          {/* Read out after แสดงผล, as R6 announces the new result */}
          <p aria-live="polite" className="text-xs text-dc-ink">
            {summary}
          </p>
          {block && <p className="text-xs text-dc-muted">วันที่ข้อมูล {formatThaiDate(block.max_date_com)}</p>}
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!figures?.values}
            className="min-h-10 flex-1 rounded-md border border-dc-border bg-white px-3 text-xs font-semibold text-dc-navy hover:bg-dc-blue-light disabled:opacity-50 sm:flex-none"
          >
            ดาวน์โหลด CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-10 flex-1 rounded-md border border-dc-border bg-white px-3 text-xs font-semibold text-dc-navy hover:bg-dc-blue-light sm:flex-none"
          >
            พิมพ์รายงาน
          </button>
        </div>
      </div>
      {figures ? (
        <Figures data={data} query={query} years={years} {...figures} unitLabel={unitLabel} totalLabel={totalLabel} />
      ) : (
        <Status>{problem}</Status>
      )}
    </>
  );
}

/**
 * ตัวเลขสรุป, กราฟ A–C and the table of a year with rows; values null when the
 * whole district has no ผลงาน that year: "—" and the trend alone (SPEC §9.4)
 */
function Figures(props: {
  data: DcReportData;
  query: ReportQuery;
  years: string[];
  block: DcYearBlock;
  values: { units: UnitTotals[]; total: Totals } | null;
  unitLabel: string;
  totalLabel: string;
}) {
  const { data, query, years, block, values, unitLabel, totalLabel } = props;
  const total = values?.total ?? null;
  const goal = goalFor(data.report, query.measure);
  const passed = passes(total?.pct ?? null, goal);
  // กราฟ C: months when the table has them, else quarters (SCHEMA §4.3)
  const available = periods(block, data.report);
  const months = available.filter((p) => p.startsWith("m"));
  const steps = months.length > 0 ? months : available.filter((p) => p.startsWith("q"));
  const stepName = months.length > 0 ? "เดือน" : "ไตรมาส";
  const stepPoints = steps.map((p) => ({ label: PERIOD_LABELS[p].short, totals: totals(block, data.report, { ...query, period: p }) }));
  // กราฟ B over the whole window: a year without a block ปี is "—", not left out of the axis (SCHEMA §4.2)
  const byYear = new Map(trend(data, query).map((point) => [point.b_year, point]));
  const trendPoints: TrendPoint[] = years.map((year) => byYear.get(year) ?? { b_year: year, totals: null });
  const tiles: [string, string][] = [
    ["เป้าหมาย", total ? formatCount(total.target) : "—"],
    ["ผลงาน", total ? formatCount(total.result) : "—"],
    ["ร้อยละ", pctText(total?.pct ?? null)],
  ];
  return (
    <div className="px-4 pb-6 sm:px-6">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg border border-dc-border bg-dc-canvas/40 px-4 py-3">
            <dt className="text-xs text-dc-muted">{label}</dt>
            <dd className="font-prompt text-2xl font-semibold text-dc-blue-dark tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="min-w-0 rounded-lg border border-dc-border bg-dc-canvas/40 px-4 py-3">
          <dt className="text-xs text-dc-muted">เกณฑ์ (ร้อยละ)</dt>
          {/* No เกณฑ์ (PCV is not in kpi_epi): no ผ่าน or ไม่ผ่าน either (SPEC §9.4) */}
          {goal === null ? (
            <dd className="font-prompt text-base font-semibold text-dc-brand-deep">ไม่มีเกณฑ์</dd>
          ) : (
            <dd className="font-prompt text-2xl font-semibold text-dc-brand-deep tabular-nums">≥ {goal}</dd>
          )}
          {passed !== null && (
            <dd className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-bold text-dc-navy ${passed ? "bg-dc-teal/20" : "bg-dc-gold/30"}`}>
              {passed ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์"}
            </dd>
          )}
        </div>
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {values ? (
          <>
            <Surface title={`ร้อยละราย${unitLabel}`}>
              <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-text-secondary">
                <Key swatch="h-2 w-4 rounded-sm bg-dc-brand-primary">ร้อยละ</Key>
                {goal !== null && <Key swatch="w-4 border-t-2 border-dashed border-dc-gold">เกณฑ์ {goal}</Key>}
              </p>
              <UnitChart title={`ร้อยละราย${unitLabel}`} units={values.units} goal={goal} />
            </Surface>
            <section className="min-w-0">
              <div role="region" tabIndex={0} aria-label={`ตารางราย${unitLabel} (เลื่อนดูแนวนอนได้)`} className="overflow-x-auto rounded-[9px] border border-dc-border-subtle">
                <table className="w-full border-collapse text-xs tabular-nums">
                  <caption className="bg-white px-4 pt-4 pb-3 text-left font-prompt text-sm font-semibold text-dc-brand-deep">เป้าหมาย ผลงาน และร้อยละราย{unitLabel}</caption>
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
                    {values.units.map((u) => (
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
                      <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{formatCount(values.total.target)}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{formatCount(values.total.result)}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap sm:px-3">{pctText(values.total.pct)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-dc-text-secondary lg:col-span-2">
            ไม่มีข้อมูล{query.measure === null ? "" : `รายการ ${measureLabel(query.measure)} `}ในปีงบประมาณ {query.year}: ผลงานรวมทั้งอำเภอว่างทั้งปี
          </p>
        )}
        <Surface title="แนวโน้มร้อยละรายปี">
          <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-muted">
            <Key swatch="h-0.5 w-4 bg-dc-blue">ร้อยละรายปี</Key>
            {goal !== null && <Key swatch="w-4 border-t-2 border-dashed border-dc-gold">เกณฑ์ {goal}</Key>}
          </p>
          <TrendChart title="แนวโน้มร้อยละรายปี" points={trendPoints} goal={goal} />
        </Surface>
        {values && stepPoints.length > 0 && (
          <Surface title={`เป้าหมายและผลงานราย${stepName} ปีงบประมาณ ${query.year}`}>
            <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-muted">
              <Key swatch="size-2.5 rounded-sm bg-dc-navy">เป้าหมาย</Key>
              <Key swatch="size-2.5 rounded-sm bg-dc-teal">ผลงาน</Key>
            </p>
            <PeriodChart title={`เป้าหมายและผลงานราย${stepName}`} points={stepPoints} />
          </Surface>
        )}
      </div>
    </div>
  );
}
