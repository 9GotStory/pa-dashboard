// The source tables that have a page of their own (SPEC §9.5, ADR-0015), and
// the page of each: tables of the same shape share a page. No React and no
// import but of types, so dc-check.mjs reads it as well.

import type { DcCatalog } from "../types";

export const TABLE_PAGES = {
  s_kpi_anc12: "anc",
  s_anc5: "anc",
  s_kpi_childdev4: "childdev",
  s_kpi_childdev2: "childdev",
  s_epi1: "epi",
  s_epi2: "epi",
  s_epi3: "epi",
  s_epi5: "epi",
  s_aged9: "aged9",
  s_epi_complete: "complete",
  s_dm_screen: "screen",
  s_ht_screen: "screen",
  s_ncd_screen_repleate1: "follow",
  s_ht_screen_follow: "follow",
  s_kpi_food: "annual",
  s_kpi_dental28: "annual",
  s_kpi_dental33: "annual",
  s_dental_0_5_cavity_free: "cavity",
} as const;

/** The page of a source table, null for a table without one: its reports are รายงานที่รอวิเคราะห์ */
export function tablePage(sourceTable: string) {
  return Object.hasOwn(TABLE_PAGES, sourceTable) ? TABLE_PAGES[sourceTable as keyof typeof TABLE_PAGES] : null;
}

/**
 * catalog.json as the site shows it: without the รายงานที่รอวิเคราะห์ (SPEC
 * §5.2), nor a กลุ่ม, หัวข้อ or หมวด left with no report
 */
export function shownCatalog(catalog: DcCatalog): DcCatalog {
  const mains = catalog.mains.map((main) => ({
    ...main,
    topics: main.topics
      .map((topic) => ({
        ...topic,
        groups: topic.groups
          .map((group) => ({ ...group, reports: group.reports.filter((r) => tablePage(r.source_table) !== null) }))
          .filter((group) => group.reports.length > 0),
      }))
      .filter((topic) => topic.groups.length > 0),
  }));
  return { ...catalog, mains: mains.filter((main) => main.topics.length > 0) };
}

/** The reports of a catalog, in its order */
export function catalogReports(catalog: DcCatalog) {
  return catalog.mains.flatMap((main) =>
    main.topics.flatMap((topic) => topic.groups.flatMap((group) => group.reports)),
  );
}

/** One warning per รายงานที่รอวิเคราะห์ of catalog.json, naming the report and its source table (SPEC §5.2) */
export function awaitingWarnings(catalog: DcCatalog): string[] {
  return catalogReports(catalog)
    .filter((r) => tablePage(r.source_table) === null)
    .map(
      (r) =>
        `รายงานที่รอวิเคราะห์ not on the site: ${r.report_name} (${r.opendata_id}), source table ${r.source_table} has no page (SPEC §5.2)`,
    );
}
