import type { TablePage } from "../types";

// The source tables that have a page of their own (SPEC §9.5, ADR-0015), and
// the page of each: tables of the same shape share a page. No React, and no
// import that node cannot run, so dc-check.mjs reads it as well.

export const TABLE_PAGES: Record<string, TablePage> = {
  s_kpi_anc12: "anc",
  s_anc5: "anc",
};

/** The page of a source table, null for a table without one yet (CoverageReport until F62) */
export function tablePage(sourceTable: string): TablePage | null {
  return Object.hasOwn(TABLE_PAGES, sourceTable) ? TABLE_PAGES[sourceTable] : null;
}
