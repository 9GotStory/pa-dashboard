import { formatThaiDate } from "./format";
import type { Cell, DcReport } from "./types";

// The CSV download of the report pages (SPEC §9.4, §9.4.1), apart from
// format.ts, which the home page loads too. รายงานประชากร builds its own in
// population-report.ts on csvText, so the HDC pages do not load its data layer.

/**
 * Rows as CSV text: a UTF-8 BOM so Excel reads Thai, CRLF line ends, every
 * cell quoted, and a ' before a cell that a spreadsheet would run as a
 * formula (R6's rule: = + - @ tab or CR, after any spaces)
 */
function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    const text = String(v);
    const safe = /^\s*[=+\-@\t\r]/.test(text) ? "'" + text : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

/**
 * The text of a report's CSV download (SPEC §9.4, §9.4.1): the site's line,
 * the report's own header lines, a blank line, then the table shown
 */
export function csvText(header: Cell[][], table: Cell[][]): string {
  return toCsv([["Song Health Data Center · ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่"], ...header, [], ...table]);
}

/**
 * The CSV download of a report page (SPEC §9.4): the header lines (the site,
 * the report with its opendata_id, the filters, the source with its date)
 * and a blank line before the table shown. Named
 * SHDC-{source_table}-{first 8 of opendata_id}-{year}.csv, as one table can
 * hold several reports, with -{part} before .csv for an open รายละเอียด.
 */
export function reportCsv(csv: {
  report: Pick<DcReport, "report_name" | "source_table" | "opendata_id">;
  year: string;
  /** The รายละเอียด open: its measure or domain{1–9} */
  part?: string;
  /** The filters in one line, as the results show them */
  filters: string;
  /** max_date_com of the year shown */
  dateCom: string;
  table: Cell[][];
}): { name: string; text: string } {
  const { report, year, part, filters, dateCom, table } = csv;
  return {
    name: `SHDC-${report.source_table}-${report.opendata_id.slice(0, 8)}-${year}${part ? `-${part}` : ""}.csv`,
    text: csvText(
      [
        ["รายงาน", `${report.report_name} (${report.opendata_id})`],
        ["ตัวกรอง", filters],
        ["แหล่งข้อมูล", `HDC Open Data ตาราง ${report.source_table} · วันที่ข้อมูล ${formatThaiDate(dateCom)}`],
      ],
      table,
    ),
  };
}
