"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, startTransition, useEffect, useOptimistic, useRef, type ReactNode } from "react";
import type { DcCatalog, DcReport, LibraryQuery } from "@/lib/dc/types";
import { libraryPage, libraryQuery, librarySearch } from "@/lib/dc/values";

type Mains = DcCatalog["mains"];
type Topic = Mains[number]["topics"][number];
type Go = (next: LibraryQuery, how?: "push" | "replace") => void;

/** A page button, as a link or as the end of the pages */
const PAGE = "inline-flex min-h-10 items-center rounded-md border border-dc-border bg-white px-3 font-semibold text-dc-navy";

/** A หมวด or หัวข้อ in the menu: a chip on a phone, a row marked on its left from lg */
function menuItem(current: boolean, topic: boolean): string {
  return `flex min-h-11 max-w-64 shrink-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-[13px] lg:max-w-none lg:rounded-l-none lg:border-0 lg:border-l-[3px] ${
    topic ? "lg:pl-6" : "font-semibold"
  } ${current ? "border-dc-teal bg-dc-teal/10 font-bold text-dc-navy" : "border-dc-border text-dc-ink hover:bg-dc-blue-light lg:border-white lg:hover:border-dc-blue-light"}`;
}

/** The reports of some หัวข้อ */
function count(topics: Topic[]): number {
  return topics.reduce((n, t) => n + t.groups.reduce((m, g) => m + g.reports.length, 0), 0);
}

/** ข้อมูลล่าสุด: the latest ปีงบประมาณ in sync_status (SPEC §9.3) */
function latestData(report: DcReport): string {
  const year = report.years.reduce((max, y) => (y.b_year > max ? y.b_year : max), "");
  return year ? `ปีงบประมาณ ${year}` : "ยังไม่มีข้อมูล";
}

/**
 * The report library of /reports (SPEC §9.3). The หมวด or หัวข้อ, the search
 * and the page are the URL's query, written with history.pushState (or
 * replaceState while typing), which Next.js passes to useSearchParams: back
 * from a report page, forward and a shared link show the same list.
 */
export default function ReportLibrary({ mains }: { mains: Mains }) {
  return (
    <Suspense
      fallback={
        <p role="status" className="mt-5 rounded-[10px] border border-dc-border bg-white px-4 py-12 text-center text-dc-muted">
          กำลังโหลดรายการรายงาน…
        </p>
      }
    >
      <Library mains={mains} />
    </Suspense>
  );
}

function Library({ mains }: { mains: Mains }) {
  const params = useSearchParams();
  // The query a change writes, shown at once while Next.js takes the new URL
  // in a transition, as on the report page. The search box needs it: an input
  // must show each key as it is typed.
  const [search, setSearch] = useOptimistic(`?${params}`);
  const heading = useRef<HTMLHeadingElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const row = useRef<HTMLUListElement>(null);
  // As R6 does on a phone: a หมวด or หัวข้อ picked by the URL is brought into the row's sight
  useEffect(() => {
    const picked = row.current?.querySelector<HTMLElement>('[aria-current="true"]');
    if (row.current && picked) row.current.scrollLeft = picked.offsetLeft - (row.current.clientWidth - picked.offsetWidth) / 2;
  }, []);
  const query = libraryQuery(mains, new URLSearchParams(search));
  const { groups, total, page, pages } = libraryPage(mains, query);
  const go: Go = (next, how = "push") => {
    const url = `/reports${librarySearch(next)}`;
    startTransition(() => {
      setSearch(librarySearch(next));
      if (how === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    });
  };
  // As R6 turns a page: back to the top of the list, focus on its heading
  const toList = () => {
    heading.current?.scrollIntoView({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  };
  const all = !query.main && !query.cat;
  const topic = mains.flatMap((m) => m.topics).find((t) => t.cat_id === query.cat);
  const main = mains.find((m) => m.main_report_id === query.main);
  const title = topic?.category_name ?? main?.main_report_name ?? "รายงานทั้งหมด";
  // A กลุ่ม whose หัวข้อ the page has not shown above it yet
  const opensTopic = (i: number) => i === 0 || groups[i - 1].topic !== groups[i].topic;

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-5">
      <nav aria-labelledby="library-nav-title" className="min-w-0 overflow-hidden rounded-[10px] border border-dc-border bg-white">
        <h2 id="library-nav-title" className="bg-dc-blue-light px-4 py-2.5 font-prompt text-[13px] font-semibold text-dc-navy lg:py-3.5 lg:text-sm">
          หมวดและหัวข้อ
        </h2>
        {/* One row that scrolls sideways on a phone, as R6's catalog row does, its long HDC names wrapped;
            หัวข้อ under their หมวด from lg. relative: the sr-only counts are absolute, and would widen the page
            from outside the row. */}
        <ul ref={row} className="relative flex gap-1.5 overflow-x-auto overscroll-x-contain p-2 lg:block lg:space-y-0.5 lg:overflow-visible">
          <li className="shrink-0">
            <Pick to={{ ...query, main: null, cat: null, page: 1 }} go={go} current={all} className={menuItem(all, false)}>
              รายงานทั้งหมด <Count n={count(mains.flatMap((m) => m.topics))} current={all} />
            </Pick>
          </li>
          {mains.map((m) => (
            <li key={m.main_report_id} className="contents lg:block">
              <Pick
                to={{ ...query, main: m.main_report_id, cat: null, page: 1 }}
                go={go}
                current={query.main === m.main_report_id}
                className={menuItem(query.main === m.main_report_id, false)}
              >
                {m.main_report_name} <Count n={count(m.topics)} current={query.main === m.main_report_id} />
              </Pick>
              <ul className="contents lg:block lg:space-y-0.5">
                {m.topics.map((t) => (
                  <li key={t.cat_id} className="shrink-0">
                    <Pick
                      to={{ ...query, main: null, cat: t.cat_id, page: 1 }}
                      go={go}
                      current={query.cat === t.cat_id}
                      className={menuItem(query.cat === t.cat_id, true)}
                    >
                      {t.category_name} <Count n={count([t])} current={query.cat === t.cat_id} />
                    </Pick>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="library-title" className="min-w-0 overflow-hidden rounded-[10px] border border-dc-border bg-white">
        <div className="border-b border-dc-border px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="library-title" ref={heading} tabIndex={-1} className="scroll-mt-4 font-prompt text-lg font-semibold text-dc-navy">
              {title}
            </h2>
            {/* Read out as the list changes, as R6 does */}
            <p id="library-count" role="status" className="shrink-0 rounded-[5px] bg-dc-canvas px-2.5 py-0.5 text-xs font-semibold text-dc-ink">
              {total} รายงาน
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="library-q" className="text-xs font-bold text-dc-ink">
                ค้นหารายงาน
              </label>
              <input
                ref={searchBox}
                id="library-q"
                type="search"
                value={query.q}
                onChange={(e) => go({ ...query, q: e.target.value, page: 1 }, "replace")}
                placeholder="ชื่อรายงาน ตารางต้นทาง รหัส หัวข้อ หรือกลุ่ม"
                autoComplete="off"
                aria-describedby="library-count"
                className="h-10 w-full min-w-0 rounded-md border border-dc-border bg-white px-3 text-[13px] text-dc-ink"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="library-size" className="text-xs font-bold text-dc-ink">
                แสดงต่อหน้า
              </label>
              <select
                id="library-size"
                value={query.size}
                onChange={(e) => go({ ...query, size: e.target.value === "20" ? 20 : 10, page: 1 })}
                className="h-10 w-full min-w-0 rounded-md border border-dc-border bg-white px-2 text-[13px] text-dc-ink"
              >
                <option value="10">10 รายการ</option>
                <option value="20">20 รายการ</option>
              </select>
            </div>
          </div>
        </div>

        {total === 0 ? (
          <div className="px-4 py-12 text-center sm:px-6">
            <h3 className="font-prompt text-base font-semibold text-dc-navy">ไม่พบรายงานที่ตรงกับการค้นหา</h3>
            <p className="mt-1 text-dc-muted">ลองเปลี่ยนคำค้นหาหรือเลือกหมวดอื่น</p>
            <Pick
              to={{ main: null, cat: null, q: "", page: 1, size: query.size }}
              go={go}
              onPick={() => searchBox.current?.focus()}
              className="mt-4 inline-flex min-h-10 items-center rounded-md bg-dc-blue px-4 font-semibold text-white hover:bg-dc-blue-dark"
            >
              แสดงรายงานทั้งหมด
            </Pick>
          </div>
        ) : (
          <>
            {/* A table from md; a phone gets a list of its own, as R6 does, not a table restyled */}
            <table className="hidden w-full border-collapse text-left md:table">
              <caption className="sr-only">
                {title} หน้า {page} จาก {pages}
              </caption>
              <thead className="bg-dc-blue-light/60 text-xs text-dc-navy">
                <tr>
                  <th scope="col" className="py-2.5 pr-3 pl-6">
                    ชื่อรายงาน
                  </th>
                  <th scope="col" className="w-[26%] px-3 py-2.5">
                    หัวข้อ / กลุ่ม
                  </th>
                  <th scope="col" className="w-32 px-3 py-2.5">
                    ข้อมูลล่าสุด
                  </th>
                  <th scope="col" className="w-36 py-2.5 pr-6 pl-3">
                    <span className="sr-only">เปิดรายงาน</span>
                  </th>
                </tr>
              </thead>
              {groups.map((g, i) => (
                <tbody key={`${g.topic.cat_id}/${g.subgroup}`}>
                  {opensTopic(i) && (
                    <tr className="border-t border-dc-border bg-dc-canvas">
                      <th scope="rowgroup" colSpan={4} className="px-6 py-2 text-xs font-bold text-dc-navy">
                        {g.topic.category_name}
                      </th>
                    </tr>
                  )}
                  {g.subgroup && (
                    <tr className="border-t border-dc-border">
                      <th scope="rowgroup" colSpan={4} className="px-6 pt-2.5 pb-1 text-xs font-semibold text-dc-blue">
                        {g.subgroup}
                      </th>
                    </tr>
                  )}
                  {g.reports.map((r) => (
                    <tr key={r.opendata_id} className="border-t border-dc-border">
                      <td className="py-3.5 pr-3 pl-6">
                        <Badges report={r} />
                        <span className="block leading-snug font-semibold text-dc-ink">{r.report_name}</span>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-dc-muted">
                        {g.topic.category_name}
                        {g.subgroup && ` / ${g.subgroup}`}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-dc-ink">{latestData(r)}</td>
                      <td className="py-3.5 pr-6 pl-3 text-right">
                        <Open report={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
            <div className="md:hidden">
              {groups.map((g, i) => (
                <div key={`${g.topic.cat_id}/${g.subgroup}`}>
                  {opensTopic(i) && (
                    <h3 className={`border-b border-dc-border bg-dc-canvas px-4 py-2 font-prompt text-xs font-semibold text-dc-navy ${i > 0 ? "border-t" : ""}`}>
                      {g.topic.category_name}
                    </h3>
                  )}
                  {g.subgroup && <h4 className="px-4 pt-2.5 font-prompt text-xs font-semibold text-dc-blue">{g.subgroup}</h4>}
                  <ul>
                    {g.reports.map((r) => (
                      <li key={r.opendata_id} className="border-b border-dc-border px-4 py-3.5 last:border-b-0">
                        <Badges report={r} />
                        <span className="block leading-snug font-semibold text-dc-ink">{r.report_name}</span>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-dc-muted">ข้อมูลล่าสุด {latestData(r)}</span>
                          <Open report={r} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <nav aria-label="หน้าของรายการรายงาน" className="flex flex-wrap items-center justify-between gap-2 border-t border-dc-border px-4 py-3 text-xs text-dc-muted sm:px-6">
              <p>
                แสดง {(page - 1) * query.size + 1}–{Math.min(page * query.size, total)} จาก {total} รายงาน
              </p>
              <div className="flex items-center gap-1.5">
                {page > 1 ? (
                  <Pick to={{ ...query, page: page - 1 }} go={go} onPick={toList} className={PAGE}>
                    ก่อนหน้า
                  </Pick>
                ) : (
                  <span className={`${PAGE} opacity-50`}>ก่อนหน้า</span>
                )}
                <span className="px-2 font-semibold text-dc-ink">
                  หน้า {page} / {pages}
                </span>
                {page < pages ? (
                  <Pick to={{ ...query, page: page + 1 }} go={go} onPick={toList} className={PAGE}>
                    ถัดไป
                  </Pick>
                ) : (
                  <span className={`${PAGE} opacity-50`}>ถัดไป</span>
                )}
              </div>
            </nav>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * A link to another query of this page, which a plain click applies without
 * asking the network; a click with Ctrl or ⌘ opens it in a new tab as usual
 */
function Pick(props: { to: LibraryQuery; go: Go; current?: boolean; onPick?: () => void; className: string; children: ReactNode }) {
  return (
    <Link
      href={`/reports${librarySearch(props.to)}`}
      prefetch={false}
      aria-current={props.current ? "true" : undefined}
      onNavigate={(e) => {
        e.preventDefault();
        props.go(props.to);
        props.onPick?.();
      }}
      className={props.className}
    >
      {props.children}
    </Link>
  );
}

/** The number of reports beside a หมวด or หัวข้อ */
function Count({ n, current }: { n: number; current: boolean }) {
  return (
    <span className={`shrink-0 rounded px-1.5 text-[11px] font-semibold ${current ? "bg-dc-teal/20 text-dc-navy" : "bg-dc-canvas text-dc-muted"}`}>
      {n}
      <span className="sr-only"> รายงาน</span>
    </span>
  );
}

/** source_table, and HDC ไม่แสดงรายงานนี้แล้ว on a removed report (SPEC §9.3) */
function Badges({ report }: { report: DcReport }) {
  return (
    <span className="mb-1 flex flex-wrap gap-1.5">
      <span className="rounded-[5px] bg-dc-blue-light px-2 py-0.5 text-[11px] font-bold text-dc-blue-dark">{report.source_table}</span>
      {report.catalog_status === "removed" && (
        <span className="rounded-[5px] border border-dc-gold px-2 py-0.5 text-[11px] font-semibold text-dc-ink">HDC ไม่แสดงรายงานนี้แล้ว</span>
      )}
    </span>
  );
}

function Open({ report }: { report: DcReport }) {
  return (
    <Link
      href={`/reports/${report.opendata_id}`}
      aria-label={`เปิดรายงาน ${report.report_name}`}
      className="inline-flex min-h-10 items-center gap-1 rounded-md border border-dc-teal/50 bg-white px-3 text-xs font-semibold whitespace-nowrap text-dc-blue-dark hover:bg-dc-teal/10"
    >
      เปิดรายงาน <span aria-hidden="true">→</span>
    </Link>
  );
}
