import type { Cell, DcReport } from "./types";

// What PA prints for a percentage and for date_com, written again here
// because Data Center code does not import PA files (CODING_STANDARDS §4),
// and the CSV download of the report page.

/**
 * A percentage with 2 decimals (a copy of PA's formatPct). toFixed rounds
 * the float as stored, so 89.585 → "89.58", the same as PA shows.
 */
export function formatPct(val: number): string {
  return val.toFixed(2);
}

/**
 * date_com (YYYYMMDDHHmm; s_epi1 adds seconds) as PA shows it, e.g.
 * "3 พฤศจิกายน 2569 เวลา 05:57 น."; "" for "" (a block ปี without rows) or
 * any value that is not 12–14 digits, as PA leaves it blank
 */
export function formatThaiDate(dateCom: string): string {
  if (!/^\d{12,14}$/.test(dateCom)) return "";
  const part = (from: number, to: number) => Number(dateCom.slice(from, to));
  const date = new Date(part(0, 4), part(4, 6) - 1, part(6, 8), part(8, 10), part(10, 12));
  return (
    date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " น."
  );
}

/**
 * Rows as the CSV text of the report page's download (SPEC §9.4): a UTF-8
 * BOM so Excel reads Thai, CRLF line ends, every cell quoted, and a ' before
 * a cell that a spreadsheet would run as a formula (R6's rule: = + - @ tab
 * or CR, after any spaces)
 */
export function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    const text = String(v);
    const safe = /^\s*[=+\-@\t\r]/.test(text) ? "'" + text : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

/** SHDC-{source_table}-{first 8 of opendata_id}-{year}.csv: one table can hold several reports (SPEC §9.4) */
export function csvFileName(report: Pick<DcReport, "source_table" | "opendata_id">, year: string): string {
  return `SHDC-${report.source_table}-${report.opendata_id.slice(0, 8)}-${year}.csv`;
}
