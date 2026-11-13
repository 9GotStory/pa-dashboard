import { formatPct, formatThaiDate } from "./format";
import { POPULATION_REPORT, populationArea } from "./population-report";
import { yearAsOf } from "./population-totals";
import type { Cell, DcReport, PopulationReport, PopulationUnit } from "./types";

// The CSV download of the report pages (SPEC §9.4, §9.4.1), apart from
// format.ts, which the home page loads too.

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

const SITE = "Song Health Data Center · ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่";

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
    text: toCsv([
      [SITE],
      ["รายงาน", `${report.report_name} (${report.opendata_id})`],
      ["ตัวกรอง", filters],
      ["แหล่งข้อมูล", `HDC Open Data ตาราง ${report.source_table} · วันที่ข้อมูล ${formatThaiDate(dateCom)}`],
      [],
      ...table,
    ]),
  };
}

/**
 * The CSV download of รายงานประชากร (SPEC §9.4.1): the header lines (the
 * site, the report, the area, the ปีข้อมูล, the source) and a blank line
 * before the เปรียบเทียบ table in the order shown, units × every ปีข้อมูล
 * with the change from each unit's first year, "—" for a year without rows.
 * Named SHDC-population-{ปีข้อมูล}-{area code}.csv, the district_code for
 * the whole อำเภอ.
 */
export function populationCsv(
  report: PopulationReport,
  units: PopulationUnit[],
  districtCode: string,
): { name: string; text: string } {
  const { years, query, level } = report;
  const change = `เปลี่ยนแปลงจากปีแรกถึง ${query.year}`;
  return {
    name: `SHDC-population-${query.year}-${query.area === "all" ? districtCode : query.area}.csv`,
    text: toCsv([
      [SITE],
      ["รายงาน", POPULATION_REPORT.report_name],
      ["พื้นที่", populationArea(report)],
      ["ปีข้อมูล", yearAsOf(query.year)],
      ["แหล่งข้อมูล", "กรมการปกครอง stat.bora"],
      [],
      [level === "district" ? "ตำบล" : "หมู่บ้าน", ...years, `${change} (คน)`, `${change} (ร้อยละ)`],
      ...units.map((u) => [
        u.name,
        ...u.totals.map((t) => t ?? "—"),
        u.change?.count ?? "—",
        u.change?.pct == null ? "—" : formatPct(u.change.pct),
      ]),
    ]),
  };
}
