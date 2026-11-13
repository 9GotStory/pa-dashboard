// The source tables that have a page of their own (SPEC §9.5, ADR-0015), and
// the page of each: tables of the same shape share a page. No React and no
// import, so dc-check.mjs reads it as well.

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
} as const;

/** The page of a source table, null for a table without one yet (CoverageReport until F62) */
export function tablePage(sourceTable: string) {
  return Object.hasOwn(TABLE_PAGES, sourceTable) ? TABLE_PAGES[sourceTable as keyof typeof TABLE_PAGES] : null;
}
