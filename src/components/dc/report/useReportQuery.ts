"use client";

import { useSearchParams } from "next/navigation";
import { startTransition, useOptimistic, useRef } from "react";
import type { DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import { reportQuery, reportSearch } from "@/lib/dc/values";

/**
 * The report page's query in the URL (SPEC §9.4). apply writes it with
 * history.pushState, which Next.js passes to useSearchParams, so back,
 * forward and a shared link show the same result, and moves focus to the
 * heading of the results. search is the URL's query: a form keyed on it is
 * drawn again when the query changes. A page calling this sits inside
 * ReportLoader, whose Suspense boundary useSearchParams needs.
 */
export function useReportQuery(data: DcReportData, names: Pick<DcCatalog, "areas" | "hospitals">) {
  const params = useSearchParams();
  // The query แสดงผล applies, shown at once. Next.js takes a new URL in a
  // transition that re-renders its router tree from the top: the first change
  // after a page load took 95 ms (111 at worst) at 4× CPU against the 100 ms
  // of FEATURES F20, and 60 ms (97 at worst) this way. React drops it in the
  // render that brings the URL's own query.
  const [search, setSearch] = useOptimistic(`?${params}`);
  const heading = useRef<HTMLHeadingElement>(null);
  const query = reportQuery(data, new URLSearchParams(search), names);
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
  return { query, search, apply, heading };
}
