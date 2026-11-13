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
  measure: string | null; // measure prefix (M_B tables only) whose รายละเอียด is open · default null (ภาพรวม)
  by: "area" | "hosp"; // default "area" · forced to "hosp" when area ≠ "all"
  domain: number | null; // ด้าน 1–9 of s_aged9 whose รายละเอียด is open · default null (ภาพรวม) · any other value or table = null
}

/** /reports query: accepted values and defaults */
export interface LibraryQuery {
  main: string | null; // main_report_id of a หมวด in catalog.json, or "population" (SPEC §5.6) · default null (every หมวด) · null when cat is set
  cat: string | null; // cat_id of a หัวข้อ in catalog.json, or "population" · default null · wins over main
  q: string; // the search as typed · default ""
} // no page/size: the list is not paged, and an old link with them gets the same query as one without (ADR-0013)

/** A report as the รายงานสุขภาพ page and the home page list it (SPEC §9.2–9.3): one of catalog.json, or รายงานประชากร (SPEC §5.6) */
export interface LibraryReport {
  id: string; // opendata_id, or "population" · its page is /reports/{id}
  report_name: string;
  references: string[]; // searched but not shown (SPEC §9.3): source_table and opendata_id, or POPULATION_REPORT.keywords
  removed: boolean; // catalog_status "removed": HDC ไม่แสดงรายงานนี้แล้ว
  empty: boolean; // ยังไม่มีข้อมูล: years [], or reports/population.json without a year
}

/** หมวด → หัวข้อ → กลุ่ม → report of the รายงานสุขภาพ page and the home page: catalog.json's, with รายงานประชากร first (SPEC §5.6) */
export interface LibraryMain {
  main_report_id: string;
  main_report_name: string;
  topics: (DcTopic & { groups: { subgroup: string; reports: LibraryReport[] }[] })[];
}

/** Every report of the รายงานสุขภาพ page that matches a LibraryQuery */
export interface LibraryList {
  groups: { topic: DcTopic; subgroup: string; reports: LibraryReport[] }[]; // every matching report by หัวข้อ and กลุ่ม, in LibraryMain order
  total: number; // the reports in groups
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
  totals: Totals | null; // null = no usable columns or no data that year (SPEC §9.4), shown as "—"
}

/* ---------- ประชากรทะเบียนราษฎร (phase 2, SCHEMA §2.6–2.8, §3.8–3.9, §11) ---------- */

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

/**
 * A registry_population_village row without uploaded_at (SCHEMA §2.8): the columns and types of RegistryPopulationRow,
 * but mm is the 8-digit หมู่บ้าน code (its first 6 = the first 6 of tt · ending "00" = ไม่ระบุหมู่) and mm_name its name in the file
 */
export type RegistryPopulationVillageRow = RegistryPopulationRow;

/** The kinds of ประชากรที่ไม่แยกอายุ, by the age file's last columns (SCHEMA §2.7) */
export type UnsplitGroup = "lunar" | "central" | "nonthai" | "moving";

/** A registry_population_age row without uploaded_at · m0 … m101 and f0 … f101 = men and women by year of age (101 = over 100) */
export type RegistryPopulationAgeRow = {
  yymm: string;
  rcode: string;
  tt: string;
  tt_name: string;
} & { [age: `m${number}` | `f${number}`]: number } & {
  [column in `${UnsplitGroup | "total"}_${"m" | "f" | "t"}`]: number;
};

export interface RegistryPopulationYear {
  yymm: string;
  population: RegistryPopulationRow[];
  village: RegistryPopulationVillageRow[];
  age: RegistryPopulationAgeRow[];
}

/** population.json (SCHEMA §7) */
export interface PopulationSnapshot {
  years: RegistryPopulationYear[]; // years with population rows, oldest first · [] = no data yet · age and village only in the last year, [] in the others
}
/** GAS's ?action=registry_population answer (SCHEMA §3.9): the same shape, but every yymm of the three sheets and the age and village rows of every year */
export type GasRegistryPopulation = PopulationSnapshot;

/** GAS's answer to a request that failed (SCHEMA §3): message, the reason, is always there */
export interface GasError {
  status: "error";
  message: string;
}

/** GAS's POST answers, as far as the /sync upload reads them (SCHEMA §3.7, §3.8) */
export type GasUploadAnswer = { status: "success"; count?: number; remaining_today?: number } | GasError;

/** A file the admin picked in the /sync upload, read and checked (SCHEMA §11.2): the district's rows of its kind, which save_registry_population takes as is (SCHEMA §3.8), or why it is refused */
export type RegistryFileRead = { name: string } & (
  | {
      ok: true;
      kind: "population";
      yymm: string;
      rows: RegistryPopulationRow[];
      villages: RegistryPopulationVillageRow[];
    } // stat_m: rows = ตำบล rows (kind population) · villages = หมู่บ้าน rows (kind village)
  | { ok: true; kind: "age"; yymm: string; rows: RegistryPopulationAgeRow[] }
  | { ok: false; reason: string }
);

/** ชาย หญิง รวม and บ้าน of one area (SCHEMA §11.3) */
export interface PopulationTotals {
  male: number;
  female: number;
  total: number;
  house: number;
}

/** One ช่วงอายุ of the pyramid (SCHEMA §11.3) */
export interface AgeBand {
  label: string; // "0–4" … "75–79", "80+"
  male: number;
  female: number;
}

/** The age structure of one area (SCHEMA §11.3) */
export interface AgeProfile {
  bands: AgeBand[]; // 17, youngest first
  age_total: number; // the counts by year of age, ชาย and หญิง (m0…m101 + f0…f101)
  aged60: number; // aged 60 and over, ชาย and หญิง
  aged60_pct: number; // aged60 ÷ age_total × 100, not rounded
  unsplit: Record<UnsplitGroup, number>; // ประชากรที่ไม่แยกอายุ by kind, adding up to totals.total − age_total
}

/** One หมู่บ้าน in the ตำบล panel (SCHEMA §11.3): its village rows of one code added up across สำนักทะเบียน */
export interface VillagePopulation {
  code: string; // the 8-digit หมู่บ้าน code (mm)
  moo: number | null; // หมู่ที่ = the code's last 2 digits · null = ไม่ระบุหมู่ (a code ending "00")
  name: string; // mm_name as in the file · not shown when moo is null
  totals: PopulationTotals;
}

/** The หมู่บ้าน of one area (SCHEMA §11.3) */
export interface AreaVillages {
  count: number; // how many หมู่บ้าน, ไม่ระบุหมู่ not counted · the อำเภอ = the sum of its ตำบล
  list: VillagePopulation[]; // a ตำบล: by หมู่ที่, ไม่ระบุหมู่ last · the อำเภอ: [], as the panel shows only the count
}

/** The อำเภอ or one ตำบล in the population part of the home page */
export interface AreaPopulation {
  key: string; // "all" = the whole อำเภอ, or a 6-digit ตำบล code (= areas[].id)
  name: string;
  totals: PopulationTotals;
  age: AgeProfile | null; // null = the year shown has no age rows (the pyramid is hidden)
  villages: AreaVillages | null; // null = the year shown has no village rows (the list and count of หมู่บ้าน are hidden)
}

/** The population part of the home page that the server component hands the client (SPEC §9.2) · null = no population data */
export interface HomePopulation {
  yymm: string; // the year shown (SCHEMA §11.3)
  district: AreaPopulation; // key "all"
  areas: AreaPopulation[]; // the ตำบล, by code
}

/* ---------- รายงานประชากร (Track K, ADR-0016, SPEC §5.6, §9.4.1, SCHEMA §11.5) ---------- */

/** reports/population.json (SCHEMA §7): population.json's shape, but every year has its own age and village rows ([] when it has none) · years [] = no data yet */
export type PopulationReportData = PopulationSnapshot;

/** รายงานประชากร in the catalog (SPEC §5.6), fixed in code as POPULATION_REPORT of the data layer, not in catalog.json */
export interface PopulationReportEntry {
  id: "population"; // no 32-hex opendata_id, so it never clashes with one
  report_name: string;
  cat_id: "population";
  category_name: string;
  main_report_id: "population";
  main_report_name: string;
  keywords: string[]; // searched as the reference data of SPEC §9.3, like source_table: ["ผู้สูงอายุ"]
}

/** The query of /reports/population: accepted values and defaults (SPEC §9.4.1) */
export interface PopulationQuery {
  year: string; // ปีข้อมูล, 4 digits, e.g. "2568" (yymm "6812") · default = the latest ("" without any year) · a year not in the snapshot is kept, so the page says ไม่มีข้อมูลปี … ในระบบ
  area: "all" | string; // "all" or a 6-digit ตำบล code of areas · anything else gives "all"
}

/** The change of one value (SCHEMA §11.5) */
export interface PopulationChange {
  count: number; // new − old
  pct: number | null; // count ÷ old × 100, not rounded · null when old is 0 (shown "—")
}

/** An area's totals in one ปีข้อมูล */
export interface PopulationPoint {
  year: string; // ปีข้อมูล, 4 digits
  totals: PopulationTotals | null; // null = the area has no rows that year, shown "—", never 0
}

/** One unit of the เปรียบเทียบ section (SCHEMA §11.5) */
export interface PopulationUnit {
  key: string; // a 6-digit ตำบล code or an 8-digit หมู่บ้าน code
  name: string; // the ตำบล's name, or "หมู่ {หมู่ที่} {its name in the year picked}", or "ไม่ระบุหมู่"
  unspecified: boolean; // ไม่ระบุหมู่: last in every order, no bar, not pickable
  totals: (number | null)[]; // people, in the order of PopulationReport.years · null = no rows that year
  change: PopulationChange | null; // from the unit's first year with rows to the year picked · null when the year picked has no rows or is the unit's first
}

/** How the เปรียบเทียบ section orders its units (SCHEMA §11.5): by code, by people in the year picked, or by change.pct */
export type PopulationSort = "code" | "count" | "change";

/** Every value the รายงานประชากร page shows, from the one data-layer function (SPEC §9.5) */
export interface PopulationReport {
  years: string[]; // ปีข้อมูล, 4 digits, oldest first · [] = no data yet
  query: PopulationQuery; // with what is not accepted replaced
  level: "district" | "tambon";
  name: string; // "อำเภอสอง" or the ตำบล's name
  parent: { key: string; name: string } | null; // the larger area: the อำเภอ of a ตำบล · null for the อำเภอ
  shown: PopulationTotals | null; // the year picked · null = that year is not in the snapshot, or the area has no rows that year
  change: Record<keyof PopulationTotals, PopulationChange> | null; // from the year before (SCHEMA §11.5) · null when that year is not in the snapshot, or the year picked is not
  share: number | null; // ร้อยละ of parent's people in the year picked, not rounded · null for the อำเภอ
  trend: PopulationPoint[]; // every ปีข้อมูล
  units: PopulationUnit[]; // the เปรียบเทียบ section, by code (ไม่ระบุหมู่ last)
  partial: boolean; // a unit has no rows in some year (a note under the table)
}
