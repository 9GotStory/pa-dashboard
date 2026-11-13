"use client";

import { ArrowRight, ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, startTransition, useOptimistic, useRef, type ReactNode, type RefObject } from "react";
import type { LibraryMain, LibraryQuery, LibraryReport } from "@/lib/dc/types";
import { libraryByReference, libraryList, libraryNameParts, libraryQuery, librarySearch } from "@/lib/dc/values";

type Mains = LibraryMain[];
type Topic = Mains[number]["topics"][number];
type Go = (next: LibraryQuery, how?: "push" | "replace") => void;

/** The query of no หมวด, no หัวข้อ and no search: every report */
const ALL: LibraryQuery = { main: null, cat: null, q: "" };

/** A row of the left bar: รายงานทั้งหมด or a หัวข้อ, marked on its left when picked; a หมวด is a heading-like row of its own */
function barItem(current: boolean, main: boolean): string {
  const look = main
    ? `px-1 py-2 text-xs font-semibold ${current ? "text-dc-brand-primary" : "text-dc-brand-deep"}`
    : `border-l-[3px] px-3 py-2.5 text-[13px] ${
        current
          ? "border-dc-brand-primary bg-dc-highlight-soft font-medium text-dc-brand-primary"
          : "border-transparent text-dc-text-secondary hover:bg-dc-canvas hover:text-dc-brand-primary"
      }`;
  return `flex min-h-11 items-center justify-between gap-3 rounded-md leading-[1.65] ${look}`;
}

/** A button-like link of the empty list */
const EMPTY_LINK =
  "inline-flex min-h-11 items-center rounded-md px-1 text-[13px] font-medium text-dc-brand-primary underline underline-offset-4 hover:text-dc-brand-accent";

/** The reports of some หัวข้อ */
function count(topics: Topic[]): number {
  return topics.reduce((n, t) => n + t.groups.reduce((m, g) => m + g.reports.length, 0), 0);
}

/**
 * The report library of /reports (SPEC §9.3). The หมวด or หัวข้อ and the
 * search are the URL's query, written with history.pushState (or
 * replaceState while typing), which Next.js passes to useSearchParams: back
 * from a report page, forward and a shared link show the same list. The
 * static HTML cannot know the query, so it holds every report (the Suspense
 * fallback), and the browser filters it once loaded.
 */
export default function ReportLibrary({ mains }: { mains: Mains }) {
  return (
    <Suspense fallback={<Directory mains={mains} query={ALL} />}>
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
  const go: Go = (next, how = "push") => {
    const url = `/reports${librarySearch(next)}`;
    startTransition(() => {
      setSearch(librarySearch(next));
      if (how === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    });
  };
  // A หมวด or หัวข้อ picked: on to the top of the list, focus on its heading
  const pick = (next: LibraryQuery) => {
    go(next);
    heading.current?.scrollIntoView({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  };
  return (
    <Directory mains={mains} query={libraryQuery(mains, new URLSearchParams(search))} actions={{ go, pick, heading }} />
  );
}

/**
 * The search, the หมวด and หัวข้อ picker and the list of one query. Without
 * actions it is the static HTML: its links are plain links to the query.
 */
function Directory({
  mains,
  query,
  actions,
}: {
  mains: Mains;
  query: LibraryQuery;
  actions?: { go: Go; pick: (next: LibraryQuery) => void; heading: RefObject<HTMLHeadingElement | null> };
}) {
  const box = useRef<HTMLInputElement>(null);
  const { groups, total } = libraryList(mains, query);
  const all = !query.main && !query.cat;
  const searching = query.q.trim() !== "";
  // The search, in every หมวด and หัวข้อ
  const everywhere: LibraryQuery = { ...query, main: null, cat: null };
  const topics = mains.flatMap((m) => m.topics);
  const topic = topics.find((t) => t.cat_id === query.cat);
  const main = mains.find((m) => m.main_report_id === query.main);
  const title = searching ? "ผลการค้นหา" : (topic?.category_name ?? main?.main_report_name ?? "รายงานทั้งหมด");
  const picked = query.cat ? `cat:${query.cat}` : query.main ? `main:${query.main}` : "";
  // A กลุ่ม opens its หัวข้อ when the one before it is of another หัวข้อ
  const sections = groups.reduce<(typeof groups)[]>((out, g, i) => {
    if (i > 0 && groups[i - 1].topic === g.topic) out[out.length - 1].push(g);
    else out.push([g]);
    return out;
  }, []);

  return (
    <>
      <section aria-labelledby="library-find-title" className="mt-5 sm:mt-6">
        <h2 id="library-find-title" className="sr-only">
          ค้นหารายงาน
        </h2>
        <div className="flex min-h-14 items-center rounded-[17px] border border-dc-border-subtle bg-dc-surface focus-within:border-dc-brand-accent focus-within:ring-2 focus-within:ring-dc-brand-accent/20">
          <Search aria-hidden="true" className="ml-5 size-5 shrink-0 text-dc-brand-accent sm:ml-6" />
          <label htmlFor="library-q" className="sr-only">
            ค้นหาชื่อรายงานหรือหัวข้อ
          </label>
          <input
            id="library-q"
            ref={box}
            type="search"
            value={query.q}
            onChange={(e) => actions?.go({ ...query, q: e.target.value }, "replace")}
            placeholder="ค้นหาชื่อรายงานหรือหัวข้อที่สนใจ..."
            autoComplete="off"
            aria-describedby="library-help"
            className="w-full min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-dc-brand-deep placeholder:text-dc-text-secondary leading-[1.8] focus-visible:outline-none sm:px-4 sm:text-[15px] [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query.q && (
            <button
              type="button"
              aria-label="ล้างคำค้นหา"
              onClick={() => {
                actions?.go({ ...query, q: "" }, "replace");
                box.current?.focus();
              }}
              className="mr-3 flex size-11 shrink-0 items-center justify-center rounded-lg text-dc-text-secondary hover:bg-dc-surface-muted"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        <p id="library-help" className="mt-2 px-1 text-[11px] text-dc-text-secondary">
          ค้นหาในหัวข้อที่เลือก และแสดงผลทันที
        </p>
      </section>

      <div className="mt-6 grid min-w-0 gap-5 lg:mt-7 lg:grid-cols-[258px_minmax(0,1fr)] lg:items-start lg:gap-8 xl:gap-10">
        <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block">
          <div className="rounded-[19px] bg-dc-surface p-5 pb-6">
            <div className="flex items-center justify-between pb-3">
              <h2 id="library-nav-title" className="font-prompt text-[15px] font-semibold">
                หัวข้อรายงาน
              </h2>
              <span className="text-xs text-dc-text-secondary">{topics.length} หัวข้อ</span>
            </div>
            <nav aria-labelledby="library-nav-title" className="mt-2 border-t border-dc-border-subtle pt-2">
              <div className="pb-4">
                <Pick
                  to={{ ...query, main: null, cat: null }}
                  actions={actions}
                  current={all}
                  className={barItem(all, false)}
                >
                  <span className="min-w-0">รายงานทั้งหมด</span>
                  <Count n={count(topics)} />
                </Pick>
              </div>
              {mains.map((m) => (
                <div key={m.main_report_id} className="border-t border-dc-border-subtle pt-4 pb-2">
                  <Pick
                    to={{ ...query, main: m.main_report_id, cat: null }}
                    actions={actions}
                    current={query.main === m.main_report_id}
                    className={`mb-2 ${barItem(query.main === m.main_report_id || topic?.main_report_id === m.main_report_id, true)}`}
                  >
                    <span className="min-w-0">{m.main_report_name}</span>
                    {query.main === m.main_report_id && <Count n={count(m.topics)} />}
                  </Pick>
                  <div className="space-y-0.5 pl-2">
                    {m.topics.map((t) => (
                      <Pick
                        key={t.cat_id}
                        to={{ ...query, main: null, cat: t.cat_id }}
                        actions={actions}
                        current={query.cat === t.cat_id}
                        className={barItem(query.cat === t.cat_id, false)}
                      >
                        <span className="min-w-0">{t.category_name}</span>
                        {query.cat === t.cat_id && <Count n={count([t])} />}
                      </Pick>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 lg:hidden">
            <label htmlFor="library-pick" className="mb-2 block text-[13px] font-medium">
              เลือกหมวดหรือหัวข้อรายงาน
            </label>
            <div className="relative">
              <select
                id="library-pick"
                value={picked}
                onChange={(e) => {
                  const [kind, id] = e.target.value.split(":");
                  actions?.pick({ ...query, main: kind === "main" ? id : null, cat: kind === "cat" ? id : null });
                }}
                className="min-h-12 w-full appearance-none rounded-xl border border-dc-border-subtle bg-dc-surface py-3 pr-11 pl-4 text-[13px] text-dc-brand-deep"
              >
                <option value="">รายงานทั้งหมด ({count(topics)})</option>
                {mains.map((m) => (
                  <optgroup key={m.main_report_id} label={m.main_report_name}>
                    <option value={`main:${m.main_report_id}`}>ทั้งหมดในหมวด {m.main_report_name}</option>
                    {m.topics.map((t) => (
                      <option key={t.cat_id} value={`cat:${t.cat_id}`}>
                        {t.category_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-4 right-4 size-4 text-dc-brand-primary"
              />
            </div>
          </div>

          <section
            aria-labelledby="library-title"
            className="min-w-0 rounded-[22px] bg-dc-surface px-5 pt-5 pb-6 sm:px-8 sm:pt-7 sm:pb-9 xl:px-10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dc-border-subtle pb-5 sm:pb-6">
              <h2
                id="library-title"
                ref={actions?.heading}
                tabIndex={-1}
                className="font-prompt text-[21px] font-semibold sm:text-[23px]"
              >
                {title}
              </h2>
              {/* Read out as the list changes */}
              <p id="library-count" role="status" className="text-xs font-medium text-dc-text-secondary tabular-nums">
                {total} รายงาน
              </p>
            </div>
            {libraryByReference(mains, query) && (
              <p className="mt-4 rounded-md bg-dc-surface-muted px-3 py-2 text-xs leading-[1.7] text-dc-text-secondary">
                บางรายการตรงกับข้อมูลอ้างอิงภายในระบบ จึงอาจไม่พบคำค้นหาในชื่อรายงาน
              </p>
            )}

            {total === 0 ? (
              <div className="px-2 py-16 text-center">
                <Search aria-hidden="true" strokeWidth={1.5} className="mx-auto size-9 text-dc-text-secondary" />
                <h3 className="mt-4 font-prompt text-lg font-semibold">ไม่พบรายงานที่ตรงกับการค้นหา</h3>
                <p className="mt-1 text-[13px] text-dc-text-secondary">ลองเปลี่ยนคำค้นหา หรือค้นหาจากหัวข้ออื่น</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                  {/* Only when the search finds reports outside the หมวด or หัวข้อ picked */}
                  {!all && libraryList(mains, everywhere).total > 0 && (
                    <Pick to={everywhere} actions={actions} className={EMPTY_LINK}>
                      ค้นหาทุกหัวข้อ
                    </Pick>
                  )}
                  <Pick to={ALL} actions={actions} className={EMPTY_LINK}>
                    แสดงรายงานทั้งหมด
                  </Pick>
                </div>
              </div>
            ) : (
              // A <div> of its own, so the first หัวข้อ has no line above it
              <div>
                {sections.map((section) => {
                  const t = section[0].topic;
                  return (
                    <section
                      key={t.cat_id}
                      aria-labelledby={`topic-${t.cat_id}`}
                      className="min-w-0 border-t border-dc-border-subtle pt-7 first:border-t-0 first:pt-6 sm:pt-8"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 pb-2">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            aria-hidden="true"
                            className="mt-[11px] h-1 w-[17px] shrink-0 rounded-full bg-dc-brand-accent"
                          />
                          <h3
                            id={`topic-${t.cat_id}`}
                            className="max-w-[670px] font-prompt text-base leading-[1.65] font-semibold sm:text-lg"
                          >
                            {t.category_name}
                          </h3>
                        </div>
                        <span className="pt-1 text-[11px] text-dc-text-secondary tabular-nums">
                          {section.reduce((n, g) => n + g.reports.length, 0)} รายงาน
                        </span>
                      </div>
                      {section.map((g) => (
                        <div key={g.subgroup}>
                          {g.subgroup && (
                            <h4 className="pt-4 pb-1 font-prompt text-xs font-medium text-dc-text-secondary sm:pt-5">
                              {g.subgroup}
                            </h4>
                          )}
                          <ul>
                            {g.reports.map((r) => (
                              <li key={r.id}>
                                <Row report={r} q={query.q} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/**
 * A link to another query of this page. Once the page runs, a plain click
 * applies it without asking the network, and focus goes to the list's
 * heading; a click with Ctrl or ⌘ opens it in a new tab as usual.
 */
function Pick(props: {
  to: LibraryQuery;
  actions?: { pick: (next: LibraryQuery) => void };
  current?: boolean;
  className: string;
  children: ReactNode;
}) {
  const { actions, to } = props;
  return (
    <Link
      href={`/reports${librarySearch(to)}`}
      prefetch={false}
      aria-current={props.current ? "true" : undefined}
      onNavigate={
        actions &&
        ((e) => {
          e.preventDefault();
          actions.pick(to);
        })
      }
      className={props.className}
    >
      {props.children}
    </Link>
  );
}

/** The number of reports beside รายงานทั้งหมด and the หมวด or หัวข้อ picked */
function Count({ n }: { n: number }) {
  return (
    <span className="shrink-0 text-[11px] font-normal text-dc-text-secondary tabular-nums">
      {n}
      <span className="sr-only"> รายงาน</span>
    </span>
  );
}

/**
 * One report: its name, the search marked in it, and an arrow, with HDC
 * ไม่แสดงรายงานนี้แล้ว or ยังไม่มีข้อมูล under the name (SPEC §9.3). The
 * marks are React elements, so a search of HTML stays text.
 */
function Row({ report, q }: { report: LibraryReport; q: string }) {
  return (
    <Link
      href={`/reports/${report.id}`}
      className="group flex min-h-16 min-w-0 items-center justify-between gap-4 border-b border-dc-border-subtle py-4 hover:bg-dc-canvas focus-visible:rounded-md sm:gap-6 sm:px-2"
    >
      <span className="min-w-0 flex-1 text-sm leading-[1.8] group-hover:text-dc-brand-primary sm:text-[15px]">
        {libraryNameParts(report.report_name, q).map((part, i) =>
          part.mark ? (
            <mark key={i} className="rounded-[3px] bg-dc-highlight-soft px-px font-medium text-dc-brand-deep">
              {part.text}
            </mark>
          ) : (
            part.text
          ),
        )}
        {report.removed && (
          <span className="mt-1 block text-[11px] leading-[1.7] text-dc-text-secondary">HDC ไม่แสดงรายงานนี้แล้ว</span>
        )}
        {report.empty && <span className="mt-1 block text-[11px] leading-[1.7] text-dc-text-secondary">ยังไม่มีข้อมูล</span>}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-[17px] shrink-0 text-dc-text-secondary transition-transform duration-150 group-hover:translate-x-1 group-hover:text-dc-brand-accent motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
    </Link>
  );
}
