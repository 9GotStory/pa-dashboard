// Data Center types, as SCHEMA §9 gives them: the part that the snapshot
// readers (snapshot.ts) return.

export type ReportType = "coverage" | "workload";

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
