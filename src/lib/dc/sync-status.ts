// The data date under each table of the /sync list (SPEC §12.1, Track M):
// max_date_com of the (table, year picked) row of sync_status, which the page
// reads with ?action=sync_status (SCHEMA §3.10) at login and after a sync.
// Pure functions: the page does the fetch (CODING_STANDARDS §4).

import { dateComDate, formatThaiDate } from "./format";
import type { GasError, GasSyncStatus } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** GAS's answer to ?action=sync_status as is; throws the reason when it is an error (Busy, or Missing "sheet" parameter from a GAS without this action) */
export function readSyncStatus(answer: GasSyncStatus | GasError): GasSyncStatus {
  if ("status" in answer) throw new Error(answer.message);
  if (!Array.isArray(answer.rows)) throw new Error("คำตอบของ GAS ไม่มี rows");
  return answer;
}

/**
 * The data date of (table, year) and its tone, or null when sync_status has
 * no row of it. The tone is the date's age against now in the current year
 * (fresh ≤ 2 days, recent ≤ 7 days, old after that) and past in any other
 * year, whose data HDC no longer updates daily.
 */
export function syncStatusDate(
  status: GasSyncStatus,
  table: string,
  year: string,
  currentYear: string,
  now: Date,
): { text: string; tone: "fresh" | "recent" | "old" | "past" } | null {
  const row = status.rows.find((r) => r.table === table && r.b_year === year);
  if (!row) return null;
  const text = formatThaiDate(row.max_date_com);
  if (year !== currentYear) return { text, tone: "past" };
  const days = (now.getTime() - dateComDate(row.max_date_com).getTime()) / DAY_MS;
  return { text, tone: days <= 2 ? "fresh" : days <= 7 ? "recent" : "old" };
}
