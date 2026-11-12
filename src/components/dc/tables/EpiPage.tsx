"use client";

import { ChevronRight, Search } from "lucide-react";
import { useState, type RefObject } from "react";
import { formatCount } from "@/lib/dc/format";
import { epiValues, findMeasures } from "@/lib/dc/tables/epi";
import type { DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import Detail, { useDetail } from "../report/Detail";
import { PERIOD_LABELS, describe, goalText, passText, pctText } from "../report/labels";
import { PeriodPanel, TrendPanel, UnitPanel } from "../report/panels";
import ReportActions from "../report/ReportActions";
import ReportFilters from "../report/ReportFilters";
import ReportLoader from "../report/ReportLoader";
import { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import { measuresCsv, resultsText } from "../report/resultsText";
import SummaryTiles from "../report/SummaryTiles";
import UnitTable from "../report/UnitTable";
import { useReportQuery } from "../report/useReportQuery";

type Names = Pick<DcCatalog, "areas" | "hospitals">;
type Values = ReturnType<typeof epiValues>;

/** The filters of a page of รายการวัคซีน (SPEC §9.4): no เปรียบเทียบตาม, and a รายการ opens from ภาพรวม */
const FIELDS: (keyof ReportQuery)[] = ["year", "area", "period"];

/**
 * ผลรายงาน of s_epi1 after EPI1 V0.4.2 (SPEC §9.4): ภาพรวมการได้รับวัคซีน,
 * one row per รายการ with a search, and the รายละเอียด of the รายการ opened
 * from it, laid out from the values of epiValues. data-table-page names the
 * page in its chunk, which dc-check looks for in the scripts other reports
 * load.
 */
export default function EpiPage({ id, names, years }: { id: string; names: Names; years: string[] }) {
  return (
    <div data-table-page="epi">
      <ReportLoader id={id}>{(data) => <Epi data={data} names={names} years={years} />}</ReportLoader>
    </div>
  );
}

function Epi({ data, names, years }: { data: DcReportData; names: Names; years: string[] }) {
  const { query: asked, search, apply, push, heading } = useReportQuery(data, names);
  const { query, block, rows, detail } = epiValues(data, asked, names, years);
  const { overview, heading: detailHeading, button, close } = useDetail(query.measure, (measure) => push({ ...query, measure }));
  const { summary, unitLabel, totalLabel, csv } = resultsText(
    data.report,
    query,
    names,
    block && detail?.total && detail.units ? { dateCom: block.max_date_com, units: detail.units, total: detail.total } : null,
    { fields: FIELDS, part: detail?.measure },
  );

  return (
    <>
      {/* Remounted when the query changes (แสดงผล, back, forward), so the form shows what the results show */}
      <ReportFilters key={search} data={data} names={names} query={query} onApply={apply} fields={FIELDS} />
      <ResultsHeader heading={heading} summary={summary} dateCom={block ? block.max_date_com : null}>
        {/* The CSV of what is shown: the รายการ of ภาพรวม, or the unit table of the รายการ open */}
        <ReportActions csv={!block ? null : detail ? csv : measuresCsv(data.report, query, summary, block.max_date_com, rows)} />
      </ResultsHeader>
      {block ? (
        <div className="px-4 pb-6 sm:px-6">
          <Overview rows={rows} open={query.measure} headingRef={overview} button={button} />
          <Detail
            headingRef={detailHeading}
            onClose={close}
            title={detail && `วัคซีน ${detail.label}`}
            eyebrow="รายละเอียดเฉพาะวัคซีนที่เลือก"
            context={describe({ ...query, measure: null }, names, FIELDS)}
          >
            {detail && <MeasureFigures detail={detail} year={query.year} unitLabel={unitLabel} totalLabel={totalLabel} />}
          </Detail>
        </div>
      ) : (
        <NoYear year={query.year} />
      )}
    </>
  );
}

/**
 * ภาพรวมการได้รับวัคซีน: the รายการ found by the search, as a table from md
 * and a list of buttons below it; headingRef and button are useDetail's
 */
function Overview(props: {
  rows: Values["rows"];
  open: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  button: ReturnType<typeof useDetail>["button"];
}) {
  const { rows, open, headingRef, button } = props;
  const [search, setSearch] = useState("");
  const found = findMeasures(rows, search);
  return (
    <section aria-labelledby="overview-title" className="overflow-hidden rounded-[9px] border border-dc-border-subtle bg-white">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3
            id="overview-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-prompt text-base font-semibold text-dc-brand-deep focus:outline-none"
          >
            ภาพรวมการได้รับวัคซีน <span className="font-normal text-dc-text-secondary">({rows.length} รายการ)</span>
          </h3>
          <p aria-live="polite" className="text-xs text-dc-text-secondary">
            {search.trim() ? `พบ ${found.length} จาก ${rows.length} รายการ` : "เลือกวัคซีนเพื่อดูรายละเอียดรายพื้นที่และแนวโน้ม"}
          </p>
        </div>
        <div className="relative w-full sm:w-56 print:hidden">
          <label htmlFor="measure-search" className="sr-only">
            ค้นหาชื่อวัคซีน
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dc-text-secondary" />
          <input
            id="measure-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาวัคซีน เช่น MMR"
            autoComplete="off"
            className="h-10 w-full rounded-md border border-dc-border-subtle bg-dc-canvas pr-3 pl-9 text-[13px] text-dc-brand-deep placeholder:text-dc-text-secondary"
          />
        </div>
      </div>
      {found.length === 0 ? (
        <p className="border-t border-dc-border-subtle px-4 py-6 text-center text-dc-text-secondary">ไม่พบวัคซีนที่ค้นหา</p>
      ) : (
        <>
          <ul className="md:hidden">
            {found.map((r) => (
              <li key={r.measure} className="border-t border-dc-border-subtle">
                <button
                  {...button(r.measure)}
                  className={`block w-full px-4 py-3.5 text-left hover:bg-dc-surface-muted ${r.measure === open ? "bg-dc-highlight-soft" : "bg-white"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-dc-brand-deep">{r.label}</strong>
                    <Verdict passed={r.passed} />
                  </span>
                  <span className="mt-2 flex items-center gap-3">
                    <PctBar pct={r.total?.pct ?? null} passed={r.passed} />
                    <strong className="text-[15px] text-dc-brand-deep tabular-nums">{pctText(r.total?.pct ?? null)}</strong>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-[11px] text-dc-text-secondary">
                    <span>
                      ผลงาน {r.total ? formatCount(r.total.result) : "—"} / เป้าหมาย {r.total ? formatCount(r.total.target) : "—"} · เกณฑ์{" "}
                      {goalText(r.goal)}
                    </span>
                    <span className="inline-flex items-center font-semibold text-dc-brand-primary">
                      ดูรายละเอียด
                      <ChevronRight aria-hidden="true" className="size-3.5" />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div role="region" tabIndex={0} aria-label="ตารางภาพรวมการได้รับวัคซีน (เลื่อนดูแนวนอนได้)" className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-xs tabular-nums">
              <caption className="sr-only">เป้าหมาย ผลงาน ร้อยละ เกณฑ์ และผลประเมินรายวัคซีน</caption>
              <thead className="bg-dc-highlight-soft text-dc-brand-deep">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left whitespace-nowrap">
                    วัคซีน
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right whitespace-nowrap">
                    เป้าหมาย
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right whitespace-nowrap">
                    ผลงาน
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left whitespace-nowrap">
                    ร้อยละ
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right whitespace-nowrap">
                    เกณฑ์
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left whitespace-nowrap">
                    ผลประเมิน
                  </th>
                </tr>
              </thead>
              <tbody>
                {found.map((r) => (
                  <tr key={r.measure} className={`border-t border-dc-border-subtle ${r.measure === open ? "bg-dc-highlight-soft" : "bg-white"}`}>
                    <th scope="row" className="px-4 py-2.5 text-left">
                      <button
                        {...button(r.measure)}
                        aria-label={`ดูรายละเอียดวัคซีน ${r.label}`}
                        className="rounded-sm text-[13px] font-semibold text-dc-brand-deep underline-offset-4 hover:underline"
                      >
                        {r.label}
                      </button>
                    </th>
                    <td className="px-3 py-2.5 text-right">{r.total ? formatCount(r.total.target) : "—"}</td>
                    <td className="px-3 py-2.5 text-right">{r.total ? formatCount(r.total.result) : "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex min-w-36 items-center gap-2">
                        <PctBar pct={r.total?.pct ?? null} passed={r.passed} />
                        <strong className="w-14 shrink-0 text-right font-semibold text-dc-brand-deep">{pctText(r.total?.pct ?? null)}</strong>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{goalText(r.goal)}</td>
                    <td className="px-4 py-2.5">
                      <Verdict passed={r.passed} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** ร้อยละ as a bar of 0–100: green when ผ่าน, gold when ไม่ผ่าน, grey without a เกณฑ์; none without a ร้อยละ */
function PctBar({ pct, passed }: { pct: number | null; passed: boolean | null }) {
  const fill = passed === null ? "bg-dc-text-secondary/50" : passed ? "bg-dc-brand-accent" : "bg-dc-gold";
  return (
    <span aria-hidden="true" className="block h-2 w-full flex-1 overflow-hidden rounded-full bg-dc-surface-muted">
      {pct !== null && <span className={`block h-full rounded-full ${fill}`} style={{ width: `${Math.min(pct, 100)}%` }} />}
    </span>
  );
}

/** ผลประเมิน with its dot; "—" without a ร้อยละ or a เกณฑ์ */
function Verdict({ passed }: { passed: boolean | null }) {
  if (passed === null) return <span className="text-dc-text-secondary">{passText(passed)}</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-dc-brand-deep">
      <i aria-hidden="true" className={`inline-block size-2 rounded-full ${passed ? "bg-dc-brand-accent" : "bg-dc-gold"}`} />
      {passText(passed)}
    </span>
  );
}

/**
 * The รายละเอียด of a รายการ (SPEC §9.4): ตัวเลขสรุป, ร้อยละรายตำบลหรือราย
 * หน่วยบริการ beside its table, แนวโน้ม and เป้าหมาย/ผลงาน by เดือน or by
 * ไตรมาส; "—" and the trend alone when the district has no ผลงาน of it that year
 */
function MeasureFigures(props: { detail: NonNullable<Values["detail"]>; year: string; unitLabel: string; totalLabel: string }) {
  const { detail, year, unitLabel, totalLabel } = props;
  const { label, total, goal, units, trend, steps } = detail;
  return (
    <>
      <SummaryTiles total={total} goal={goal} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {total && units ? (
          <>
            <UnitPanel unitLabel={unitLabel} units={units} goal={goal} />
            <UnitTable unitLabel={unitLabel} units={units} total={total} totalLabel={totalLabel} />
          </>
        ) : (
          <p className="text-sm text-dc-text-secondary lg:col-span-2">
            ไม่มีข้อมูลรายการ {label} ในปีงบประมาณ {year}: ผลงานรวมทั้งอำเภอว่างทั้งปี
          </p>
        )}
        <TrendPanel points={trend} goal={goal} />
        {total && steps.length > 0 && (
          <PeriodPanel
            year={year}
            stepName={steps[0].period.startsWith("q") ? "ไตรมาส" : "เดือน"}
            points={steps.map((s) => ({ label: PERIOD_LABELS[s.period].short, totals: s.totals }))}
          />
        )}
      </div>
    </>
  );
}
