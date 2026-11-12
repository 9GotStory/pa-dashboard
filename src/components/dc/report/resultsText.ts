import { reportCsv } from "@/lib/dc/csv";
import type { DcCatalog, DcReport, ReportQuery, Totals, UnitTotals } from "@/lib/dc/types";
import { UNIT_LABELS, areaLabel, describe, goalText, passText, pctText } from "./labels";

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
          table: [
            [unitLabel, "เป้าหมาย", "ผลงาน", "ร้อยละ"],
            ...shown.units.map((u) => [u.name, u.totals.target, u.totals.result, pctText(u.totals.pct)]),
            [totalLabel, shown.total.target, shown.total.result, pctText(shown.total.pct)],
          ],
        })
    : null;
  return { summary, unitLabel, totalLabel, csv };
}

/**
 * The CSV download of ภาพรวม of a page of รายการ (SPEC §9.4): one row per
 * รายการ with เป้าหมาย, ผลงาน, ร้อยละ, เกณฑ์ and ผลประเมิน, "—" for a รายการ
 * without data that year
 */
export function measuresCsv(
  report: DcReport,
  query: ReportQuery,
  summary: string,
  dateCom: string,
  rows: { label: string; total: Totals | null; goal: number | null; passed: boolean | null }[],
) {
  return () =>
    reportCsv({
      report,
      year: query.year,
      filters: summary,
      dateCom,
      table: [
        ["รายการ", "เป้าหมาย", "ผลงาน", "ร้อยละ", "เกณฑ์", "ผลประเมิน"],
        ...rows.map((r) => [r.label, r.total?.target ?? "—", r.total?.result ?? "—", pctText(r.total?.pct ?? null), goalText(r.goal), passText(r.passed)]),
      ],
    });
}
