import { csvText } from "./csv";
import { bandName, formatPct } from "./format";
import { POPULATION_REPORT, populationArea, populationUnitLabel } from "./population-report";
import { yearAsOf } from "./population-totals";
import type { PopulationReport, PopulationUnit } from "./types";

// รายงานประชากร's CSV download, apart from population-report.ts, which
// values.ts loads on every page for POPULATION_REPORT, and from csv.ts, which
// every HDC report page loads: so neither carries the other's. Pure functions:
// no React, no DOM, no fetch (CODING_STANDARDS §4).

/**
 * The CSV download of รายงานประชากร (SPEC §9.4.1): its header lines (the
 * report, the area, the ปีข้อมูล, the source) before the table shown. The
 * อำเภอ or a ตำบล: the เปรียบเทียบ table in the order shown (units), units ×
 * every ปีข้อมูล with the change from each unit's first year, then, after a
 * blank line, the ช่วงอายุ × ปีข้อมูล of the age section. A หมู่บ้าน,
 * which has no units: a row a year of its ชาย หญิง รวม บ้าน. "—" for a year
 * without rows. Named SHDC-population-{ปีข้อมูล}-{area code}.csv, the
 * district_code for the whole อำเภอ.
 */
export function populationCsv(
  report: PopulationReport,
  units: PopulationUnit[] | null,
  districtCode: string,
): { name: string; text: string } {
  const { years, query } = report;
  const change = `เปลี่ยนแปลงจากปีแรกถึง ${query.year}`;
  return {
    name: `SHDC-population-${query.year}-${query.area === "all" ? districtCode : query.area}.csv`,
    text: csvText(
      [
        ["รายงาน", POPULATION_REPORT.report_name],
        ["พื้นที่", populationArea(report)],
        ["ปีข้อมูล", yearAsOf(query.year)],
        ["แหล่งข้อมูล", "กรมการปกครอง stat.bora"],
      ],
      units
        ? [
            [populationUnitLabel(report), ...years, `${change} (คน)`, `${change} (ร้อยละ)`],
            ...units.map((u) => [
              u.name,
              ...u.totals.map((t) => t ?? "—"),
              u.change?.count ?? "—",
              u.change?.pct == null ? "—" : formatPct(u.change.pct),
            ]),
            ...(report.age
              ? [
                  [],
                  ["ช่วงอายุ", ...years],
                  ...report.age.bands.map((b) => [bandName(b.label), ...b.totals.map((t) => t ?? "—")]),
                ]
              : []),
          ]
        : [
            ["ปีข้อมูล", "ชาย", "หญิง", "รวม", "บ้าน"],
            ...report.trend.map(({ year, totals }) => [
              year,
              ...(["male", "female", "total", "house"] as const).map((v) => totals?.[v] ?? "—"),
            ]),
          ],
    ),
  };
}
