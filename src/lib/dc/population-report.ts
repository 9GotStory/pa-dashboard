import { populationTotals, registryYear } from "./population-totals";
import type {
  PopulationChange,
  PopulationQuery,
  PopulationReport,
  PopulationReportData,
  PopulationReportEntry,
  PopulationTotals,
} from "./types";

// รายงานประชากร (ADR-0016): its fixed place in the catalog (SPEC §5.6) and
// its data layer (SCHEMA §11.5), which the page calls with
// reports/population.json and the URL's query. Pure functions: no React, no
// DOM, no fetch (CODING_STANDARDS §4); it adds up through population-totals.ts,
// as the home page does, not population.ts, which holds the /sync file reader.

/** รายงานประชากร's หมวด, หัวข้อ and report, fixed in code (SPEC §5.6) */
export const POPULATION_REPORT: PopulationReportEntry = {
  id: "population",
  report_name: "ประชากรและบ้าน รายตำบลและรายหมู่บ้าน",
  cat_id: "population",
  category_name: "ประชากรทะเบียนราษฎร",
  main_report_id: "population",
  main_report_name: "ข้อมูลประชากร",
  keywords: ["ผู้สูงอายุ"],
};

const VALUES: (keyof PopulationTotals)[] = ["male", "female", "total", "house"];

/** From old to new (SCHEMA §11.5): no ร้อยละ when old is 0 */
function changeOf(oldValue: number, newValue: number): PopulationChange {
  const count = newValue - oldValue;
  return { count, pct: oldValue === 0 ? null : (count / oldValue) * 100 };
}

/**
 * Every value of the รายงานประชากร page (SPEC §9.4.1) for a query: the whole
 * อำเภอ in the ปีข้อมูล picked, its change from the year before, and its
 * แนวโน้ม over every year (SCHEMA §11.5). A year that is not 4 digits gives
 * the latest; a 4-digit year not in the data is kept, without totals, so the
 * page says so instead of showing another year.
 */
export function populationReport(data: PopulationReportData, query: PopulationQuery): PopulationReport {
  const trend = data.years.map((y) => ({ year: registryYear(y.yymm), totals: populationTotals(y.population) }));
  const years = trend.map((p) => p.year);
  const year = /^\d{4}$/.test(query.year) ? query.year : (years.at(-1) ?? "");
  const shown = trend.find((p) => p.year === year)?.totals ?? null;
  // The year before is Y − 1 only, never an older one (SCHEMA §11.5)
  const before = trend.find((p) => p.year === String(Number(year) - 1))?.totals ?? null;
  const change =
    shown && before
      ? (Object.fromEntries(VALUES.map((v) => [v, changeOf(before[v], shown[v])])) as PopulationReport["change"])
      : null;
  return { years, query: { year }, shown, change, trend };
}

/** The URL query of a PopulationQuery, which the page reads back: ?year= (SPEC §9.4.1) */
export function populationSearch(query: PopulationQuery): string {
  return `?${new URLSearchParams({ year: query.year })}`;
}
