// Data Center types, as SCHEMA §9 gives them.

export type ReportType = "coverage" | "workload";

export type Month = "10" | "11" | "12" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09";
export type Period = "year" | "q1" | "q2" | "q3" | "q4" | `m${Month}`;

/** One row of sync_status */
export interface DcYearStatus {
  b_year: string;
  row_count: number;
  max_date_com: string;
  synced_at: string; // ISO
}

export interface DcReport {
  opendata_id: string; // its real letter case (SCHEMA §3)
  report_name: string;
  source_table: string;
  cat_id: string;
  main_report_id: string;
  subgroup: string; // "" = no group
  order: number | null;
  report_type: ReportType | null;
  goal: number | null;
  col_target: string | null;
  col_result: string | null;
  measure_goals: Record<string, number>;
  catalog_status: "active" | "removed";
  years: DcYearStatus[]; // empty = no data yet
}

export interface DcTopic {
  cat_id: string;
  category_name: string;
  main_report_id: string;
  main_report_name: string;
  order: number | null;
}

/** GAS's raw ?action=catalog answer (unsorted) */
export interface GasCatalog {
  meta: { current_year: string; years: string[]; district_code: string; generated_at: string };
  areas: { id: string; name_th: string }[];
  hospitals: { hospcode: string; hospname: string; tambon_id: string }[];
  topics: DcTopic[];
  reports: DcReport[];
}

/** catalog.json: sorted and nested by level */
export interface DcCatalog {
  meta: GasCatalog["meta"];
  areas: GasCatalog["areas"];
  hospitals: GasCatalog["hospitals"];
  mains: {
    main_report_id: string;
    main_report_name: string;
    topics: (DcTopic & {
      groups: { subgroup: string; reports: DcReport[] }[]; // subgroup "" last
    })[];
  }[];
}

/** meta.json */
export interface SnapshotMeta {
  built_at: string; // ISO
  current_year: string;
  years: string[];
  report_count: number;
  latest_date_com: string; // "" if there is no data yet
}

/** The properties of a ตำบล in public/geo/song-tambon.geojson that the home page map reads (§8) */
export interface AreaBoundary {
  ADMIN_ID3: string; // 6-digit ตำบล code = areas[].id
}

export type Cell = string | number;

/** GAS's ?action=report answer and the content of reports/{id}.json (same shape) */
export interface DcYearBlock {
  b_year: string;
  headers: string[];
  rows: Cell[][]; // in headers order (id already filtered)
  max_date_com: string;
  sheet_rows: number; // rows read from the sheet before the id filter
  expected_rows: number; // sync_status.row_count
}

export interface DcReportData {
  report: DcReport;
  years: DcYearBlock[]; // oldest year first
}
export type GasReport = DcReportData;

/** /reports/{id} query: accepted values and defaults */
export interface ReportQuery {
  year: string; // 4 digits · default = the latest year whose block has rows ("" if none) · a year without data is kept
  area: "all" | string; // "all" or a 6-digit tambon code · default "all"
  period: Period; // default "year"
  measure: string | null; // measure prefix (M_B tables only) · default the first measure
  by: "area" | "hosp"; // default "area" · forced to "hosp" when area ≠ "all"
}

/** /reports query: accepted values and defaults */
export interface LibraryQuery {
  main: string | null; // main_report_id of a หมวด in catalog.json · default null (every หมวด) · null when cat is set
  cat: string | null; // cat_id of a หัวข้อ in catalog.json · default null · wins over main
  q: string; // the search as typed · default ""
  page: number; // from 1 · default 1
  size: 10 | 20; // reports per page · default 10
}

/** One page of the report library */
export interface LibraryPage {
  groups: { topic: DcTopic; subgroup: string; reports: DcReport[] }[]; // the page's reports by หัวข้อ and กลุ่ม, in catalog.json order
  total: number; // the reports that match, on every page
  page: number; // the page shown: the last one when the query's page is past it
  pages: number; // at least 1
}

export interface Totals {
  target: number;
  result: number;
  pct: number | null;
}

/** Column family (SCHEMA §4.1) */
export type Family = "ANNUAL" | "Q_A" | "Q_B" | "Q_C" | "M_A" | "M_B" | "OVERRIDE";

/** Totals of one tambon or hospital (SCHEMA §4.4) */
export interface UnitTotals {
  key: string; // 6-digit tambon code or hospcode
  name: string;
  totals: Totals;
}

/** One year of a trend (SCHEMA §4.4) */
export interface TrendPoint {
  b_year: string;
  totals: Totals | null; // null = no usable columns that year, shown as "—"
}

/* ---------- ประชากรทะเบียนราษฎร (phase 2, SCHEMA §2.6–2.7, §3.8–3.9, §11) ---------- */

/** A registry_population row without uploaded_at: the rows of the POST, the GET and population.json */
export interface RegistryPopulationRow {
  yymm: string; // `^\d{2}12$`
  cc: string;
  cc_name: string;
  rcode: string; // 4-digit สำนักทะเบียน
  rcode_name: string;
  tt: string; // 8 digits · the first 6 = areas[].id
  tt_name: string;
  mm: string; // "0"
  mm_name: string; // ""
  male: number;
  female: number;
  total: number;
  house: number;
}

/** The kinds of ประชากรที่ไม่แยกอายุ, by the age file's last columns (SCHEMA §2.7) */
export type UnsplitGroup = "lunar" | "central" | "nonthai" | "moving";

/** A registry_population_age row without uploaded_at · m0 … m101 and f0 … f101 = men and women by year of age (101 = over 100) */
export type RegistryPopulationAgeRow = {
  yymm: string;
  rcode: string;
  tt: string;
  tt_name: string;
} & { [age: `m${number}` | `f${number}`]: number }
  & { [column in `${UnsplitGroup | "total"}_${"m" | "f" | "t"}`]: number };

export interface RegistryPopulationYear {
  yymm: string;
  population: RegistryPopulationRow[];
  age: RegistryPopulationAgeRow[];
}

/** population.json (SCHEMA §7) */
export interface PopulationSnapshot {
  years: RegistryPopulationYear[]; // years with population rows, oldest first · [] = no data yet · age only in the last year, [] in the others
}
/** GAS's ?action=registry_population answer (SCHEMA §3.9): the same shape, but every yymm of both sheets and the age rows of every year */
export type GasRegistryPopulation = PopulationSnapshot;

/** ชาย หญิง รวม and บ้าน of one area (SCHEMA §11.3) */
export interface PopulationTotals {
  male: number;
  female: number;
  total: number;
  house: number;
}
