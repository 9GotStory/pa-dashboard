import type { KPISummary, KPIMaster, KPIReportType, MophReportData } from "../types";
import { calculateKPIValue } from "../kpi-utils";
import { sortKpisByGroup } from "../kpi-grouping";

// PA's processing (SPEC §4): one pure function over the snapshot of PA
// (SCHEMA §7), for pa.json at build time and for the live responses the hook
// puts in the same shape. Moved from useKPIData.ts as it was (F81).

const TARGET_AREA_PREFIX = "5406";

export interface HospitalDetail {
  name: string;
  tambon_id: string;
}

type Row = Record<string, unknown>;

type KpiConfigEntry = {
  isQuarterly: boolean;
  // Per-KPI display-period override from kpi_master ("สะสม N เดือน").
  // null/undefined → derive from isQuarterly + currentQuarter.
  targetMonths?: number | null;
};

export interface PaRegistryEntry {
  sheet: string;
  category: string;
  categoryOrder: number;
}

type BatchMeta = {
  current_quarter?: number;
  kpi_config?: Array<{
    table: string;
    sheet?: string;
    isQuarterly?: boolean;
    target_months?: number | null;
    effective_quarter?: number | null;
  }>;
  // Manifest of KPI registry tabs (one per category). Older GAS deployments
  // omit it — fall back to the built-in pair.
  registry?: PaRegistryEntry[];
};

// The five GAS responses PA reads, keyed by the sheet GET (SCHEMA §7).
export interface PaSnapshot {
  BATCH_ALL: { data?: Record<string, Row[]>; meta?: BatchMeta };
  hospitals: Row[];
  tambon_master: Row[];
  registry: Record<string, Row[]>;
}

export interface ProcessedPa {
  data: KPISummary[];
  hospitalMap: Record<string, HospitalDetail>;
  tambonMap: Record<string, string>;
  lastUpdated: string;
}

// Fallback used when BATCH_ALL meta has no `registry` (pre-manifest GAS).
const DEFAULT_REGISTRY: PaRegistryEntry[] = [
  { sheet: "kpi_master", category: "ตัวชี้วัดพื้นฐาน", categoryOrder: 1 },
  { sheet: "kpi_epi", category: "สร้างเสริมภูมิคุ้มกันโรค", categoryOrder: 2 },
];

// The KPI registry tabs BATCH_ALL names: the hook fetches these, and
// processPaSnapshot reads them from snapshot.registry by sheet.
export function paRegistry(batch: PaSnapshot["BATCH_ALL"] | undefined): PaRegistryEntry[] {
  const registry = batch?.meta?.registry;
  return Array.isArray(registry) && registry.length > 0 ? registry : DEFAULT_REGISTRY;
}

function processReportData(allData: MophReportData[], tableName: string, title: string): KPISummary {
  if (!Array.isArray(allData)) {
    return {
      title,
      tableName: tableName as KPIReportType,
      totalTarget: 0,
      totalResult: 0,
      percentage: 0,
      data: [],
      breakdown: {},
      targetValue: 0,
      targetMonths: 12,
    };
  }

  const filteredData = allData.filter((item) => item.areacode && String(item.areacode).startsWith(TARGET_AREA_PREFIX));

  const totalTarget = filteredData.reduce((sum, item) => sum + calculateKPIValue(item).t, 0);
  const totalResult = filteredData.reduce((sum, item) => sum + calculateKPIValue(item).r, 0);
  const percentage = totalTarget > 0 ? (totalResult / totalTarget) * 100 : 0;

  const breakdown: Record<string, { target: number; result: number; percentage: number }> = {};
  filteredData.forEach((item) => {
    const key = item.hospcode || item.areacode;
    const { t, r } = calculateKPIValue(item);
    if (key) {
      if (!breakdown[key]) breakdown[key] = { target: 0, result: 0, percentage: 0 };
      breakdown[key].target += t;
      breakdown[key].result += r;
    }
  });

  Object.keys(breakdown).forEach((key) => {
    const b = breakdown[key];
    b.percentage = b.target > 0 ? (b.result / b.target) * 100 : 0;
  });

  return {
    title,
    tableName: tableName as KPIReportType,
    totalTarget,
    totalResult,
    percentage,
    data: filteredData,
    breakdown,
    targetValue: 0,
    targetMonths: 12,
  };
}

export function processPaSnapshot(snapshot: PaSnapshot): ProcessedPa {
  const batchJson = snapshot.BATCH_ALL;
  const hospitalsData = snapshot.hospitals;
  const tambonData = snapshot.tambon_master;

  // Process KPI registries — one tab per category, defaults from the
  // manifest (registry). Explicit category columns (when present)
  // override, so a sheet can still host extra categories.
  const parsedOrder = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 999;
  };
  const parseSheet = (rows: Row[], defCategory: string, defOrder: number): KPIMaster[] =>
    (Array.isArray(rows) ? rows : [])
      .map((row: Row) => ({
        table_name: String(row.table_name ?? ""),
        title: String(row.title ?? "Unknown KPI"),
        target: Number(row.target ?? 0),
        order: Number(row.order ?? 999),
        link: row.link ? String(row.link) : undefined,
        category: row.category ? String(row.category) : defCategory,
        subgroup: row.subgroup ? String(row.subgroup) : "",
        category_order: parsedOrder(row.category_order ?? defOrder),
      }))
      .filter((k: KPIMaster) => k.table_name)
      .sort((a: KPIMaster, b: KPIMaster) => a.order - b.order);

  const configs: KPIMaster[] = paRegistry(batchJson).flatMap((entry) =>
    parseSheet(snapshot.registry[entry.sheet], entry.category, entry.categoryOrder),
  );

  // Process Hospital Map
  const hMap: Record<string, HospitalDetail> = {};
  if (Array.isArray(hospitalsData)) {
    hospitalsData.forEach((row: Row) => {
      const keys = Object.keys(row);
      if (keys.length >= 2) {
        const code = String(row[keys[0]]).trim();
        const name = String(row[keys[1]]).trim();
        const tambon_id = keys.length >= 3 ? String(row[keys[2]]).trim() : "";
        if (code) hMap[code] = { name, tambon_id };
      }
    });
  }

  // Process Tambon Map
  const tMap: Record<string, string> = {};
  if (Array.isArray(tambonData)) {
    tambonData.forEach((item: Row) => {
      if (item.id && item.name_th) {
        tMap[String(item.id)] = String(item.name_th);
      }
    });
  }

  // Process Batch Data. GAS rows are MOPH rows as sent (date_com and b_year
  // arrive as numbers); MophReportData is the type PA's views read them by.
  let batchData: Record<string, MophReportData[]> = {};
  let currentQuarter = 0;
  // Single source of truth for per-KPI config from meta.kpi_config.
  // GAS parses the kpi_master sheet; here we just trust its clean output.
  const kpiCfgMap = new Map<string, KpiConfigEntry>();

  if (batchJson.data && batchJson.meta) {
    batchData = batchJson.data as unknown as Record<string, MophReportData[]>;
    const meta = batchJson.meta;
    currentQuarter = meta.current_quarter ?? 0;
    if (Array.isArray(meta.kpi_config)) {
      meta.kpi_config.forEach((k) => {
        kpiCfgMap.set(k.table, {
          isQuarterly: !!k.isQuarterly,
          targetMonths: k.target_months ?? null,
        });
      });
    }
  } else {
    // Pre-meta GAS answered BATCH_ALL with the table map itself.
    batchData = batchJson as unknown as Record<string, MophReportData[]>;
  }

  const quarterLabel = currentQuarter > 0 ? `สะสม ${currentQuarter * 3} เดือน (Q${currentQuarter})` : "รายไตรมาส";
  const annualLabel = "รายปี";

  // Map configs to reports
  const reports = configs.map((config) => {
    const rows = batchData[config.table_name] || [];
    const report = processReportData(rows, config.table_name, config.title);
    const cfg = kpiCfgMap.get(config.table_name);
    const isQuarterly = !!cfg?.isQuarterly;
    // Resolve display period (months + label):
    //   1. kpi_master `target_months` override — used as-is for both the
    //      badge ("สะสม 8 เดือน") and Target column. This handles KPIs
    //      whose service window doesn't match quarter boundaries
    //      (e.g. s_kpi_childdev4: Oct–Jun = 9 months = q1..q3).
    //   2. Otherwise derive from isQuarterly + currentQuarter:
    //        Annual    → 12, "รายปี"
    //        Quarterly → currentQuarter × 3, "สะสม N เดือน (Qn)"
    // The badge and Target column share the same N so pass/fail coloring
    // stays meaningful.
    if (cfg?.targetMonths != null) {
      report.targetMonths = cfg.targetMonths;
      report.period = `สะสม ${cfg.targetMonths} เดือน`;
    } else {
      report.targetMonths = isQuarterly ? currentQuarter * 3 : 12;
      report.period = isQuarterly ? quarterLabel : annualLabel;
    }
    report.targetValue = config.target;
    report.link = config.link;
    report.order = config.order;
    report.category = config.category;
    report.subgroup = config.subgroup;
    report.categoryOrder = config.category_order;
    return report;
  });

  // Display order: category_order → subgroup (by its min order) → order.
  // Degenerates to the legacy flat order when no categories are set.
  const orderedReports = sortKpisByGroup(reports);

  // Calculate the วันที่ข้อมูล. MOPH emits date_com as YYYYMMDDHHmm
  // (12 digits) — except s_epi1, which adds seconds (14 digits).
  // Compare as strings (same-prefix longer string = newer) and accept
  // both lengths so one odd table can't blank the footer.
  let maxDateStr = "";
  reports.forEach((r) => {
    if (r.data && r.data.length > 0) {
      r.data.forEach((d: MophReportData) => {
        const v = String(d.date_com ?? "");
        if (v > maxDateStr) maxDateStr = v;
      });
    }
  });

  let formattedLastUpdated = "";
  if (/^\d{12,14}$/.test(maxDateStr)) {
    const str = maxDateStr.substring(0, 12); // drop seconds when present
    const d = new Date(
      parseInt(str.substring(0, 4)),
      parseInt(str.substring(4, 6)) - 1,
      parseInt(str.substring(6, 8)),
      parseInt(str.substring(8, 10)),
      parseInt(str.substring(10, 12)),
    );
    formattedLastUpdated =
      d.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " น.";
  }

  return {
    data: orderedReports,
    hospitalMap: hMap,
    tambonMap: tMap,
    lastUpdated: formattedLastUpdated,
  };
}
