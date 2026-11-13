import { populationTotals, registryYear } from "./population-totals";
import type {
  DcCatalog,
  PopulationChange,
  PopulationQuery,
  PopulationReport,
  PopulationReportData,
  PopulationReportEntry,
  PopulationSort,
  PopulationTotals,
  PopulationUnit,
  RegistryPopulationYear,
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

const DISTRICT = "อำเภอสอง";

const VALUES: (keyof PopulationTotals)[] = ["male", "female", "total", "house"];

/** From old to new (SCHEMA §11.5): no ร้อยละ when old is 0 */
function changeOf(oldValue: number, newValue: number): PopulationChange {
  const count = newValue - oldValue;
  return { count, pct: oldValue === 0 ? null : (count / oldValue) * 100 };
}

/**
 * Every value of the รายงานประชากร page (SPEC §9.4.1) for a query: the area
 * picked, the whole อำเภอ or a ตำบล of areas, in the ปีข้อมูล picked, its
 * change from the year before, its ร้อยละ of the อำเภอ, and its แนวโน้ม over
 * every year (SCHEMA §11.5). A ตำบล adds up its rows of every สำนักทะเบียน.
 * A year that is not 4 digits gives the latest; a 4-digit year not in the
 * data is kept, without totals, so the page says so instead of showing
 * another year. An area not in areas gives the whole อำเภอ.
 */
export function populationReport(
  data: PopulationReportData,
  query: PopulationQuery,
  areas: DcCatalog["areas"],
): PopulationReport {
  const years = data.years.map((y) => registryYear(y.yymm));
  const year = /^\d{4}$/.test(query.year) ? query.year : (years.at(-1) ?? "");
  const tambon = areas.find((a) => a.id === query.area);
  const trend = data.years.map((y) => ({
    year: registryYear(y.yymm),
    totals: tambon ? tambonTotals(y, tambon.id) : populationTotals(y.population),
  }));
  const totalsIn = (y: string) => trend.find((p) => p.year === y)?.totals ?? null;
  const shown = totalsIn(year);
  // The year before is Y − 1 only, never an older one (SCHEMA §11.5)
  const before = totalsIn(String(Number(year) - 1));
  const change =
    shown && before
      ? (Object.fromEntries(VALUES.map((v) => [v, changeOf(before[v], shown[v])])) as PopulationReport["change"])
      : null;
  const shownAt = years.indexOf(year);
  const share = tambon && shown ? (shown.total / populationTotals(data.years[shownAt].population).total) * 100 : null;
  const units = tambon
    ? villageUnits(data, tambon.id, shownAt)
    : areas.map(({ id, name_th }) =>
        unitOf(
          id,
          name_th,
          false,
          data.years.map((y) => tambonTotals(y, id)?.total ?? null),
          shownAt,
        ),
      );
  return {
    years,
    query: { year, area: tambon?.id ?? "all" },
    level: tambon ? "tambon" : "district",
    name: tambon?.name_th ?? DISTRICT,
    parent: tambon ? { key: "all", name: DISTRICT } : null,
    shown,
    change,
    share,
    trend,
    units,
    partial: units.some((u) => u.totals.includes(null)),
  };
}

/**
 * A ตำบล's totals in a year: its population rows, the first 6 digits of tt,
 * across every สำนักทะเบียน (SCHEMA §11.3) · null without rows that year
 */
function tambonTotals(year: RegistryPopulationYear, tambon: string): PopulationTotals | null {
  const rows = year.population.filter((r) => r.tt.slice(0, 6) === tambon);
  return rows.length > 0 ? populationTotals(rows) : null;
}

/**
 * The หมู่บ้าน of a ตำบล in the เปรียบเทียบ section (SCHEMA §11.5): each
 * 8-digit code with village rows in any year, every สำนักทะเบียน added up,
 * by หมู่ที่ (the code's last 2 digits), named as its first row in the year
 * picked or else in the latest year it has rows, then ไม่ระบุหมู่ (00) when
 * it has rows in any year
 */
function villageUnits(data: PopulationReportData, tambon: string, shownAt: number): PopulationUnit[] {
  const rows = data.years.map((y) =>
    Map.groupBy(
      y.village.filter((r) => r.mm.slice(0, 6) === tambon),
      (r) => r.mm,
    ),
  );
  const codes = [...new Set(rows.flatMap((byCode) => [...byCode.keys()]))].sort();
  const units = codes.map((code) => {
    const byYear = rows.map((byCode) => byCode.get(code) ?? null);
    const named = byYear[shownAt] ?? byYear.findLast((r) => r !== null)!;
    const moo = Number(code.slice(6));
    return unitOf(
      code,
      moo === 0 ? "ไม่ระบุหมู่" : `หมู่ ${moo} ${named[0].mm_name}`,
      moo === 0,
      byYear.map((r) => (r ? populationTotals(r).total : null)),
      shownAt,
    );
  });
  // A code's last 2 digits order the หมู่ที่; ไม่ระบุหมู่, 00, goes last
  return [...units.filter((u) => !u.unspecified), ...units.filter((u) => u.unspecified)];
}

/**
 * A unit of the เปรียบเทียบ section (SCHEMA §11.5) from its people in every
 * year, with its change from its first year with rows to the year picked
 * (shown, its index in the years; −1 when not in the data)
 */
function unitOf(
  key: string,
  name: string,
  unspecified: boolean,
  totals: (number | null)[],
  shown: number,
): PopulationUnit {
  const first = totals.findIndex((t) => t !== null);
  const now = totals[shown] ?? null;
  const change = now !== null && first < shown ? changeOf(totals[first]!, now) : null;
  return { key, name, unspecified, totals, change };
}

/**
 * The units of the เปรียบเทียบ section in an order (SCHEMA §11.5): by code as
 * report.units has them, by people in the year picked, or by change.pct,
 * the largest first and null last. Ties go by code, so the order is the same
 * every time, and ไม่ระบุหมู่ stays last.
 */
export function sortUnits(report: PopulationReport, sort: PopulationSort): PopulationUnit[] {
  const at = report.years.indexOf(report.query.year);
  const value = (u: PopulationUnit) => (sort === "count" ? (u.totals[at] ?? null) : (u.change?.pct ?? null));
  const rank = (u: PopulationUnit) => (u.unspecified ? 2 : value(u) === null ? 1 : 0);
  if (sort === "code") return report.units;
  return report.units.toSorted(
    (a, b) => rank(a) - rank(b) || (value(b) ?? 0) - (value(a) ?? 0) || a.key.localeCompare(b.key),
  );
}

/** The area of a report as the results and the CSV name it: "ทั้งอำเภอสอง" or "ตำบลบ้านหนุน" */
export function populationArea(report: PopulationReport): string {
  return report.level === "district" ? `ทั้ง${report.name}` : `ตำบล${report.name}`;
}

/** What the เปรียบเทียบ section compares: the ตำบล of the อำเภอ, or the หมู่บ้าน of a ตำบล */
export function populationUnitLabel(report: PopulationReport): string {
  return report.level === "district" ? "ตำบล" : "หมู่บ้าน";
}

/** The URL query of a PopulationQuery, which the page reads back: ?year=&area= (SPEC §9.4.1) */
export function populationSearch(query: PopulationQuery): string {
  return `?${new URLSearchParams({ year: query.year, area: query.area })}`;
}
