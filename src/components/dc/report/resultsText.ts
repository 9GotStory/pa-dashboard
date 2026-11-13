import { reportCsv } from "@/lib/dc/csv";
import type { Cell, DcCatalog, DcReport, ReportQuery, Totals, UnitTotals } from "@/lib/dc/types";
import type { countsBy } from "@/lib/dc/values";
import { UNIT_LABELS, areaLabel, describe, goalText, passText, pctText } from "./labels";

/** The count of a ตำบล or หน่วยบริการ, as countsBy gives it */
export type UnitCount = NonNullable<ReturnType<typeof countsBy>>[number];

/**
 * The text of results compared by ตำบล or หน่วยบริการ (SPEC §9.4): the
 * filters in one line (of the page's form fields, all by default), the name
 * of the units and of the total row, and the CSV download of the unit table
 * as shown, named with the รายละเอียด open (part); csv null when no table is
 * shown
 */
export function resultsText(
  report: DcReport,
  query: ReportQuery,
  names: Pick<DcCatalog, "areas" | "hospitals">,
  shown: { dateCom: string; units: UnitTotals[]; total: Totals } | null,
  page: { fields?: (keyof ReportQuery)[]; part?: string } = {},
) {
  // No year at all: the report has no data yet, so there is no filter to name
  const summary = query.year ? describe(query, names, page.fields) : "";
  const unitLabel = UNIT_LABELS[query.by];
  const totalLabel = `รวม${areaLabel(query.area, names)}`;
  const csv = shown
    ? () =>
        reportCsv({
          report,
          year: query.year,
          part: page.part,
          filters: summary,
          dateCom: shown.dateCom,
          table: unitTable(unitLabel, shown.units, shown.total, totalLabel),
        })
    : null;
  return { summary, unitLabel, totalLabel, csv };
}

/** The unit table of results as CSV rows: เป้าหมาย, ผลงาน and ร้อยละ of each ตำบล or หน่วยบริการ, then the total row */
export function unitTable(unitLabel: string, units: UnitTotals[], total: Totals, totalLabel: string): Cell[][] {
  return [
    [unitLabel, "เป้าหมาย", "ผลงาน", "ร้อยละ"],
    ...units.map((u) => [u.name, u.totals.target, u.totals.result, pctText(u.totals.pct)]),
    [totalLabel, total.target, total.result, pctText(total.pct)],
  ];
}

/**
 * The CSV download of ภาพรวม of a page of รายการ (SPEC §9.4): one row per
 * รายการ with เป้าหมาย, ผลงาน, ร้อยละ, เกณฑ์ and ผลประเมิน, "—" for a รายการ
 * without data that year
 */
export function measuresCsv(
  report: DcReport,
  year: string,
  summary: string,
  dateCom: string,
  rows: { label: string; total: Totals | null; goal: number | null; passed: boolean | null }[],
) {
  return () =>
    reportCsv({
      report,
      year,
      filters: summary,
      dateCom,
      table: [
        ["รายการ", "เป้าหมาย", "ผลงาน", "ร้อยละ", "เกณฑ์", "ผลประเมิน"],
        ...rows.map((r) => [
          r.label,
          r.total?.target ?? "—",
          r.total?.result ?? "—",
          pctText(r.total?.pct ?? null),
          goalText(r.goal),
          passText(r.passed),
        ]),
      ],
    });
}

/**
 * The CSV download of ภาพรวม of AGED9 (SPEC §9.4): ความครอบคลุม of each
 * ตำบล or หน่วยบริการ (coverage, null for a year without data), then the
 * count of each ด้าน, "—" for one without data that year
 */
export function domainsCsv(
  report: DcReport,
  year: string,
  summary: string,
  dateCom: string,
  coverage: Cell[][] | null,
  domains: { domain: number; label: string; count: number | null }[],
) {
  return () =>
    reportCsv({
      report,
      year,
      filters: summary,
      dateCom,
      table: [
        ...(coverage ?? [["ความครอบคลุม", "ไม่มีข้อมูล: ผลงานรวมทั้งอำเภอว่างทั้งปี"]]),
        [],
        ["ด้าน", "จำนวนรายการ"],
        ...domains.map((d) => [`${d.domain}. ${d.label}`, d.count ?? "—"]),
      ],
    });
}

/** The CSV download of the รายละเอียด of a ด้าน (SPEC §9.4): its count per ตำบล or หน่วยบริการ and the total row, named -domain{n} */
export function countsCsv(
  report: DcReport,
  year: string,
  summary: string,
  dateCom: string,
  domain: number,
  table: { unitLabel: string; units: UnitCount[]; total: number; totalLabel: string },
) {
  return () =>
    reportCsv({
      report,
      year,
      part: `domain${domain}`,
      filters: summary,
      dateCom,
      table: [
        [table.unitLabel, "จำนวนรายการ"],
        ...table.units.map((u) => [u.name, u.count]),
        [table.totalLabel, table.total],
      ],
    });
}
