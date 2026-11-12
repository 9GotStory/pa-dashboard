// The source tables that have a page of their own (SPEC §9.5, ADR-0015), and
// the page of each: tables of the same shape share a page. No React and no
// import, so dc-check.mjs reads it as well.

export const TABLE_PAGES = {
  s_kpi_anc12: "anc",
  s_anc5: "anc",
  s_kpi_childdev4: "childdev",
  s_kpi_childdev2: "childdev",
} as const;

/** The page of a source table, null for a table without one yet (CoverageReport until F62) */
export function tablePage(sourceTable: string) {
  return Object.hasOwn(TABLE_PAGES, sourceTable) ? TABLE_PAGES[sourceTable as keyof typeof TABLE_PAGES] : null;
}
