'use client';

import { useState, useEffect } from 'react';
import type { KPISummary, KPIMaster, KPIReportType, MophReportData } from './types';
import { calculateKPIValue } from './kpi-utils';
import { sortKpisByGroup } from './kpi-grouping';

const API_URL = 'https://script.google.com/macros/s/AKfycbwLnUji6n_z0KANgGMqZchGaqk38CCm7d8nDUggLDHEbsuoXe1e1uPt42ivkEKR0B5H/exec';
const TARGET_AREA_PREFIX = '5406';

interface HospitalDetail {
  name: string;
  tambon_id: string;
}

export interface UseKPIDataResult {
  data: KPISummary[];
  hospitalMap: Record<string, HospitalDetail>;
  tambonMap: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  signal?: AbortSignal,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    // Bail out immediately if the caller already aborted — no point retrying.
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      // User-initiated cancel: surface right away, don't burn retries.
      if (isAbortError(err)) throw err;
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Retries failed');
}

type KpiConfigEntry = {
  isQuarterly: boolean;
  // Per-KPI display-period override from kpi_master ("สะสม N เดือน").
  // null/undefined → derive from isQuarterly + currentQuarter.
  targetMonths?: number | null;
};

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
  registry?: Array<{
    sheet: string;
    category: string;
    categoryOrder: number;
  }>;
};

// Fallback used when BATCH_ALL meta has no `registry` (pre-manifest GAS).
const DEFAULT_REGISTRY = [
  { sheet: 'kpi_master', category: 'ตัวชี้วัดพื้นฐาน', categoryOrder: 1 },
  { sheet: 'kpi_epi', category: 'สร้างเสริมภูมิคุ้มกันโรค', categoryOrder: 2 },
];

type HospitalRow = Record<string, unknown>;
type TambonRow = { id?: unknown; name_th?: unknown };
type KpiMasterRow = Record<string, unknown>;

function processReportData(
  allData: MophReportData[],
  tableName: string,
  title: string,
): KPISummary {
  if (!Array.isArray(allData)) {
    return { title, tableName: tableName as KPIReportType, totalTarget: 0, totalResult: 0, percentage: 0, data: [], breakdown: {}, targetValue: 0, targetMonths: 12 };
  }

  const filteredData = allData.filter(item =>
    item.areacode && String(item.areacode).startsWith(TARGET_AREA_PREFIX)
  );

  const totalTarget = filteredData.reduce((sum, item) => sum + calculateKPIValue(item).t, 0);
  const totalResult = filteredData.reduce((sum, item) => sum + calculateKPIValue(item).r, 0);
  const percentage = totalTarget > 0 ? (totalResult / totalTarget) * 100 : 0;

  const breakdown: Record<string, { target: number; result: number; percentage: number }> = {};
  filteredData.forEach(item => {
    const key = item.hospcode || item.areacode;
    const { t, r } = calculateKPIValue(item);
    if (key) {
      if (!breakdown[key]) breakdown[key] = { target: 0, result: 0, percentage: 0 };
      breakdown[key].target += t;
      breakdown[key].result += r;
    }
  });

  Object.keys(breakdown).forEach(key => {
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

// Bumped V3 → V4: registry tabs now come from meta.kpi_registry (manifest
// driven) instead of a hardcoded pair.
const CACHE_KEY = 'PA_DASHBOARD_CACHE_V4';

export function useKPIData(): UseKPIDataResult {
  const [data, setData] = useState<KPISummary[]>([]);
  const [hospitalMap, setHospitalMap] = useState<Record<string, HospitalDetail>>({});
  const [tambonMap, setTambonMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    // Track cache hits locally so the catch block knows whether the user is
    // already seeing cached data. Reading React state inside the async catch
    // would always see the initial empty array (closure captures mount-time
    // value), causing setError to fire even when cache is on screen.
    let hadCachedData = false;

    // 1. Try to load from LocalStorage (Instant Load)
    const loadFromCache = () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as {
            data?: KPISummary[];
            hospitalMap?: Record<string, HospitalDetail>;
            tambonMap?: Record<string, string>;
            lastUpdated?: string;
          };
          // Valid cache check (optional: check timestamp expiry)
          if (parsed.data && Array.isArray(parsed.data)) {
            console.log('Using cached data');
            hadCachedData = true;
            setData(parsed.data);
            setHospitalMap(parsed.hospitalMap || {});
            setTambonMap(parsed.tambonMap || {});
            setLastUpdated(parsed.lastUpdated || '');
            setIsLoading(false); // Show immediately
          }
        }
      } catch (e) {
        console.warn('Failed to load cache', e);
      }
    };

    loadFromCache();

    // 2. Fetch fresh data (Stale-While-Revalidate)
    async function fetchAllData() {
      // If we didn't have cache, show loading. If we did, keep showing cache while fetching.
      // We don't set isLoading(true) here if we already have data, to prevent flash.

      setError(null);

      try {
        // Parallel fetch all data. Each fetch honors the AbortController so
        // unmounting the component cancels in-flight requests immediately
        // rather than burning bandwidth in the background.
        // Two-phase fetch: BATCH_ALL first (its meta.registry names the KPI
        // registry tabs to pull), then those tabs in parallel. Registry tabs
        // = one per category, so a new category tab is fetched automatically.
        const [batchRes, hospitalsRes, tambonRes] = await Promise.all([
          fetchWithRetry(`${API_URL}?sheet=BATCH_ALL`, 3, signal),
          fetchWithRetry(`${API_URL}?sheet=hospitals`, 3, signal),
          fetchWithRetry(`${API_URL}?sheet=tambon_master`, 3, signal),
        ]);

        const batchJson = await batchRes.json();
        const hospitalsData: HospitalRow[] = await hospitalsRes.json();
        const tambonData: TambonRow[] = await tambonRes.json();

        const registry: Array<{ sheet: string; category: string; categoryOrder: number }> =
          Array.isArray(batchJson?.meta?.registry) && batchJson.meta.registry.length > 0
            ? batchJson.meta.registry
            : DEFAULT_REGISTRY;
        const registryRows = await Promise.all(
          registry.map((entry) => fetchWithRetry(`${API_URL}?sheet=${encodeURIComponent(entry.sheet)}`, 3, signal)),
        );
        const registryJson: KpiMasterRow[][] = await Promise.all(
          registryRows.map((res) => res.json() as Promise<KpiMasterRow[]>),
        );
        const registryData: Array<{ rows: KpiMasterRow[]; defCategory: string; defOrder: number }> =
          registry.map((entry, i) => ({
            rows: registryJson[i],
            defCategory: entry.category,
            defOrder: entry.categoryOrder,
          }));

        // Process KPI registries — one tab per category, defaults from the
        // manifest (registry). Explicit category columns (when present)
        // override, so a sheet can still host extra categories.
        const parsedOrder = (v: unknown): number => {
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? n : 999;
        };
        const parseSheet = (rows: KpiMasterRow[], defCategory: string, defOrder: number): KPIMaster[] =>
          (Array.isArray(rows) ? rows : [])
            .map((row: KpiMasterRow) => ({
              table_name: String(row.table_name ?? ''),
              title: String(row.title ?? 'Unknown KPI'),
              target: Number(row.target ?? 0),
              order: Number(row.order ?? 999),
              link: row.link ? String(row.link) : undefined,
              category: row.category ? String(row.category) : defCategory,
              subgroup: row.subgroup ? String(row.subgroup) : '',
              category_order: parsedOrder(row.category_order ?? defOrder),
            }))
            .filter((k: KPIMaster) => k.table_name)
            .sort((a: KPIMaster, b: KPIMaster) => a.order - b.order);

        const configs: KPIMaster[] = registryData.flatMap((entry) =>
          parseSheet(entry.rows, entry.defCategory, entry.defOrder),
        );

        // Process Hospital Map
        const hMap: Record<string, HospitalDetail> = {};
        if (Array.isArray(hospitalsData)) {
          hospitalsData.forEach((row: HospitalRow) => {
            const keys = Object.keys(row);
            if (keys.length >= 2) {
              const code = String(row[keys[0]]).trim();
              const name = String(row[keys[1]]).trim();
              const tambon_id = keys.length >= 3 ? String(row[keys[2]]).trim() : '';
              if (code) hMap[code] = { name, tambon_id };
            }
          });
        }
        setHospitalMap(hMap);

        // Process Tambon Map
        const tMap: Record<string, string> = {};
        if (Array.isArray(tambonData)) {
          tambonData.forEach((item: TambonRow) => {
            if (item.id && item.name_th) {
              tMap[String(item.id)] = String(item.name_th);
            }
          });
        }
        setTambonMap(tMap);

        // Process Batch Data
        let batchData: Record<string, MophReportData[]> = {};
        let currentQuarter = 0;
        // Single source of truth for per-KPI config from meta.kpi_config.
        // GAS parses the kpi_master sheet; here we just trust its clean output.
        const kpiCfgMap = new Map<string, KpiConfigEntry>();

        if (batchJson.data && batchJson.meta) {
          batchData = batchJson.data;
          const meta = batchJson.meta as BatchMeta;
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
          batchData = batchJson;
        }

        const quarterLabel = currentQuarter > 0 ? `สะสม ${currentQuarter * 3} เดือน (Q${currentQuarter})` : 'รายไตรมาส';
        const annualLabel = 'รายปี';

        // Map configs to reports
        const reports = configs.map(config => {
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

        // Calculate last updated date. MOPH emits date_com as YYYYMMDDHHmm
        // (12 digits) — except s_epi1, which adds seconds (14 digits).
        // Compare as strings (same-prefix longer string = newer) and accept
        // both lengths so one odd table can't blank the footer.
        let maxDateStr = '';
        reports.forEach(r => {
          if (r.data && r.data.length > 0) {
            r.data.forEach((d: MophReportData) => {
              const v = String(d.date_com ?? '');
              if (v > maxDateStr) maxDateStr = v;
            });
          }
        });

        let formattedLastUpdated = '';
        if (/^\d{12,14}$/.test(maxDateStr)) {
          const str = maxDateStr.substring(0, 12); // drop seconds when present
          const d = new Date(
            parseInt(str.substring(0, 4)),
            parseInt(str.substring(4, 6)) - 1,
            parseInt(str.substring(6, 8)),
            parseInt(str.substring(8, 10)),
            parseInt(str.substring(10, 12))
          );
          formattedLastUpdated = d.toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) + ' น.';
        }

        // Bail out if the component unmounted mid-fetch so we don't
        // write state onto an unmounted component. Aborted requests also
        // short-circuit earlier via the catch block below.
        if (signal.aborted) return;

        setData(orderedReports);
        setLastUpdated(formattedLastUpdated);

        // Cache the fresh data. Isolated try-catch so a quota error never
        // surfaces as a "fetch failed" message — the UI already has the data.
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: orderedReports,
            hospitalMap: hMap,
            tambonMap: tMap,
            lastUpdated: formattedLastUpdated,
            timestamp: Date.now(),
          }));
        } catch (e) {
          console.warn('Failed to save cache', e);
        }

      } catch (err) {
        // Expected when the component unmounts mid-fetch — no error UI.
        if (isAbortError(err)) return;
        console.error('Error fetching KPI data:', err);
        // Only surface the error to UI if the user has nothing to look at.
        // If cache was loaded synchronously above, keep showing it (SWR-style).
        if (!hadCachedData) {
           setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    }

    fetchAllData();

    return () => {
      controller.abort();
    };
  }, []);

  return {
    data,
    hospitalMap,
    tambonMap,
    isLoading,
    error,
    lastUpdated,
  };
}
