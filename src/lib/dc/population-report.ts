import { ageProfile, BAND_LABELS, populationTotals, registryYear } from "./population-totals";
import type {
  AgeProfile,
  DcCatalog,
  PopulationAgeReport,
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
 * picked, the whole อำเภอ, a ตำบล of areas or one of its หมู่บ้าน, in the
 * ปีข้อมูล picked, its change from the year before, its ร้อยละ of the larger
 * area, and its แนวโน้ม over every year (SCHEMA §11.5). A ตำบล or หมู่บ้าน
 * adds up its rows of every สำนักทะเบียน. A year that is not 4 digits gives
 * the latest; a 4-digit year not in the data is kept, without totals, so the
 * page says so instead of showing another year. An 8-digit code that is not
 * a หมู่บ้าน, ไม่ระบุหมู่ among them, gives its ตำบล; an area of neither
 * gives the whole อำเภอ.
 */
export function populationReport(
  data: PopulationReportData,
  query: PopulationQuery,
  areas: DcCatalog["areas"],
): PopulationReport {
  const years = data.years.map((y) => registryYear(y.yymm));
  const year = /^\d{4}$/.test(query.year) ? query.year : (years.at(-1) ?? "");
  const shownAt = years.indexOf(year);
  const tambon = /^\d{6}(\d{2})?$/.test(query.area) ? areas.find((a) => a.id === query.area.slice(0, 6)) : undefined;
  const villages = tambon ? villagesOf(data, tambon.id, shownAt) : [];
  const village = villages.find((v) => v.key === query.area && !v.unspecified);
  const trend = data.years.map((y, i) => ({
    year: years[i],
    totals: village ? village.totals[i] : tambon ? tambonTotals(y, tambon.id) : populationTotals(y.population),
  }));
  const totalsIn = (y: string) => trend.find((p) => p.year === y)?.totals ?? null;
  const shown = totalsIn(year);
  // The year before is Y − 1 only, never an older one (SCHEMA §11.5)
  const before = totalsIn(String(Number(year) - 1));
  const change =
    shown && before
      ? (Object.fromEntries(VALUES.map((v) => [v, changeOf(before[v], shown[v])])) as PopulationReport["change"])
      : null;
  // A หมู่บ้าน's ร้อยละ is of its ตำบล, a ตำบล's of the อำเภอ, in people only
  const parentTotal =
    !shown || !tambon
      ? null
      : village
        ? (tambonTotals(data.years[shownAt], tambon.id)?.total ?? null)
        : populationTotals(data.years[shownAt].population).total;
  const units = village
    ? null
    : tambon
      ? villages.map((v) =>
          unitOf(
            v.key,
            v.name,
            v.unspecified,
            v.totals.map((t) => t?.total ?? null),
            shownAt,
          ),
        )
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
    query: { year, area: village?.key ?? tambon?.id ?? "all" },
    level: village ? "village" : tambon ? "tambon" : "district",
    name: village?.name ?? tambon?.name_th ?? DISTRICT,
    parent: village ? { key: tambon!.id, name: tambon!.name_th } : tambon ? { key: "all", name: DISTRICT } : null,
    villages: villages.filter((v) => !v.unspecified).map(({ key, name }) => ({ key, name })),
    shown,
    change,
    share: shown && parentTotal ? (shown.total / parentTotal) * 100 : null,
    trend,
    units,
    partial: units?.some((u) => u.totals.includes(null)) ?? false,
    // The age file is by ตำบล only (SCHEMA §11.1): no age for a หมู่บ้าน
    age: village
      ? null
      : ageReport(
          years,
          data.years.map((y) => areaAge(y, tambon?.id)),
          shownAt,
        ),
  };
}

/**
 * The age structure of the whole อำเภอ, or of a ตำบล, in a year: its age
 * rows across every สำนักทะเบียน (SCHEMA §11.3) · null without rows that year
 */
function areaAge(year: RegistryPopulationYear, tambon: string | undefined): AgeProfile | null {
  const rows = tambon ? year.age.filter((r) => r.tt.slice(0, 6) === tambon) : year.age;
  return rows.length > 0 ? ageProfile(rows) : null;
}

/**
 * The age section (SCHEMA §11.5) from an area's age structure in each of
 * the years (null = no age rows that year) and the year picked (shownAt,
 * its index; −1 when not in the data)
 */
function ageReport(years: string[], profiles: (AgeProfile | null)[], shownAt: number): PopulationAgeReport {
  const shown = profiles[shownAt] ?? null;
  const firstAt = profiles.findIndex((p) => p !== null);
  // Of those split by age, as every value of the section (SCHEMA §11.5)
  const sum = (key: "male" | "female") => shown?.bands.reduce((total, b) => total + b[key], 0) ?? 0;
  // A วัย's ร้อยละ from its ช่วงอายุ, 5 years each: 0–14 is the first 3, 15–59 the next 9
  const pctOf = (from: number, to: number) =>
    (shown!.bands.slice(from, to).reduce((total, b) => total + b.male + b.female, 0) / shown!.age_total) * 100;
  return {
    shown,
    first: firstAt === -1 || firstAt === shownAt ? null : { year: years[firstAt], bands: profiles[firstAt]!.bands },
    aged60: profiles.map((p, i) => ({ year: years[i], pct: p?.aged60_pct ?? null })),
    bands: BAND_LABELS.map((label, k) => ({
      label,
      totals: profiles.map((p) => (p ? p.bands[k].male + p.bands[k].female : null)),
    })),
    sex_ratio: shown ? (sum("male") / sum("female")) * 100 : null,
    stages: shown && { child: pctOf(0, 3), working: pctOf(3, 12), aged: shown.aged60_pct },
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

/** A หมู่บ้าน, or ไม่ระบุหมู่, of a ตำบล with its totals in every year (null = no rows that year) */
interface Village {
  key: string;
  name: string;
  unspecified: boolean;
  totals: (PopulationTotals | null)[];
}

/**
 * The หมู่บ้าน of a ตำบล (SCHEMA §11.5): each 8-digit code with village rows
 * in any year, every สำนักทะเบียน added up, by หมู่ที่ (the code's last 2
 * digits), named as its first row in the year picked (shownAt, −1 when not
 * in the data) or else in the latest year it has rows, then ไม่ระบุหมู่ (00)
 * when it has rows in any year
 */
function villagesOf(data: PopulationReportData, tambon: string, shownAt: number): Village[] {
  const rows = data.years.map((y) =>
    Map.groupBy(
      y.village.filter((r) => r.mm.slice(0, 6) === tambon),
      (r) => r.mm,
    ),
  );
  const codes = [...new Set(rows.flatMap((byCode) => [...byCode.keys()]))].sort();
  const villages = codes.map((code) => {
    const byYear = rows.map((byCode) => byCode.get(code) ?? null);
    const named = byYear[shownAt] ?? byYear.findLast((r) => r !== null)!;
    const moo = Number(code.slice(6));
    return {
      key: code,
      name: moo === 0 ? "ไม่ระบุหมู่" : `หมู่ ${moo} ${named[0].mm_name}`,
      unspecified: moo === 0,
      totals: byYear.map((r) => (r ? populationTotals(r) : null)),
    };
  });
  // A code's last 2 digits order the หมู่ที่; ไม่ระบุหมู่, 00, goes last
  return [...villages.filter((v) => !v.unspecified), ...villages.filter((v) => v.unspecified)];
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
 * every time, and ไม่ระบุหมู่ stays last. A หมู่บ้าน has none: null.
 */
export function sortUnits(report: PopulationReport, sort: PopulationSort): PopulationUnit[] | null {
  const at = report.years.indexOf(report.query.year);
  const value = (u: PopulationUnit) => (sort === "count" ? (u.totals[at] ?? null) : (u.change?.pct ?? null));
  const rank = (u: PopulationUnit) => (u.unspecified ? 2 : value(u) === null ? 1 : 0);
  if (!report.units || sort === "code") return report.units;
  return report.units.toSorted(
    (a, b) => rank(a) - rank(b) || (value(b) ?? 0) - (value(a) ?? 0) || a.key.localeCompare(b.key),
  );
}

/**
 * The area of a report as the results and the CSV name it: "ทั้งอำเภอสอง",
 * "ตำบลบ้านหนุน" or "หมู่ 4 ศรีมูลเรือง ตำบลบ้านหนุน"
 */
export function populationArea(report: PopulationReport): string {
  if (report.level === "village") return `${report.name} ตำบล${report.parent?.name}`;
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
