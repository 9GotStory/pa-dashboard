import { reportCsv } from "@/lib/dc/csv";
import type { DcCatalog, DcReport, ReportQuery, Totals, UnitTotals } from "@/lib/dc/types";
import { UNIT_LABELS, areaLabel, describe, pctText } from "./labels";

/**
 * The text of results compared by ตำบล or หน่วยบริการ (SPEC §9.4): the
 * filters in one line, the name of the units and of the total row, and the
 * CSV download of the unit table as shown; csv null when no table is shown
 */
export function resultsText(
  report: DcReport,
  query: ReportQuery,
  names: Pick<DcCatalog, "areas" | "hospitals">,
  shown: { dateCom: string; units: UnitTotals[]; total: Totals } | null,
) {
  // No year at all: the report has no data yet, so there is no filter to name
  const summary = query.year ? describe(query, names) : "";
  const unitLabel = UNIT_LABELS[query.by];
  const totalLabel = `รวม${areaLabel(query.area, names)}`;
  const csv = shown
    ? () =>
        reportCsv({
          report,
          year: query.year,
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
