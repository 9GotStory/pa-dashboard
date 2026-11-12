"use client";

import { useState } from "react";
import type { DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import { dataYears, measureLabel, periods, reportQuery, shownMeasures, yearBlock } from "@/lib/dc/values";
import { PERIOD_LABELS, UNIT_LABELS } from "./labels";

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
      <label htmlFor={`filter-${props.name}`} className="text-xs font-bold text-dc-brand-deep">
        {props.label}
      </label>
      <select
        id={`filter-${props.name}`}
        name={props.name}
        value={props.value}
        onChange={(e) => props.onPick(props.name, e.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-dc-border-subtle bg-white px-2 text-[13px] text-dc-brand-deep"
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
 * The form of SPEC §9.4, with the fields a page asks for (all by default; a
 * table of one row per หน่วยบริการ has no พื้นที่, for one). Its choices are
 * worked into a query the same way as the URL's, so ช่วงเวลา and รายการวัคซีน
 * follow the year picked; แสดงผล applies them. Key it on the URL's query so
 * it shows what the results show.
 */
export default function ReportFilters(props: {
  data: DcReportData;
  names: Pick<DcCatalog, "areas" | "hospitals">;
  query: ReportQuery;
  onApply: (q: ReportQuery) => void;
  fields?: (keyof ReportQuery)[];
}) {
  const { data, names, query, onApply, fields = ["year", "area", "period", "measure", "by"] } = props;
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
    <section aria-labelledby="filters-title" className="border-b border-dc-border-subtle bg-dc-highlight-soft/50 px-4 py-5 sm:px-6 print:hidden">
      <h2 id="filters-title" className="font-prompt text-[15px] font-semibold text-dc-brand-deep">
        ตัวกรองรายงาน
      </h2>
      <p className="text-xs text-dc-text-secondary">เลือกเงื่อนไขแล้วกดแสดงผล</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
        }}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {fields.includes("year") && <Select name="year" label="ปีงบประมาณ" value={draft.year} options={years.map((y) => [y, y])} onPick={pick} />}
          {fields.includes("area") && (
            <Select
              name="area"
              label="พื้นที่"
              value={draft.area}
              options={[["all", "ทั้งอำเภอ"], ...names.areas.map((a): [string, string] => [a.id, `ตำบล${a.name_th}`])]}
              onPick={pick}
            />
          )}
          {fields.includes("period") && (
            <Select
              name="period"
              label="ช่วงเวลา"
              value={draft.period}
              options={(periodOptions.length > 0 ? periodOptions : ["year" as const]).map((p) => [p, PERIOD_LABELS[p].name])}
              onPick={pick}
            />
          )}
          {fields.includes("measure") && measureOptions.length > 0 && (
            <Select
              name="measure"
              label="รายการวัคซีน"
              value={draft.measure ?? ""}
              options={measureOptions.map((m) => [m, measureLabel(m)])}
              onPick={pick}
            />
          )}
          {/* One ตำบล is compared by หน่วยบริการ only (SPEC §9.4) */}
          {fields.includes("by") && (
            <Select
              name="by"
              label="เปรียบเทียบตาม"
              value={draft.by}
              options={(["area", "hosp"] as const).map((by): [string, string] => [by, UNIT_LABELS[by]])}
              disabled={draft.area === "all" ? [] : ["area"]}
              onPick={pick}
            />
          )}
        </div>
        <button type="submit" className="h-10 rounded-md bg-dc-brand-primary px-5 font-semibold text-white hover:bg-dc-brand-deep">
          แสดงผล
        </button>
      </form>
    </section>
  );
}
