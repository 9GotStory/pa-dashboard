'use client';

import { useState, useEffect } from 'react';
import { KPISummary, KPIMaster, KPIReportType } from './types';
import { calculateKPIValue } from './kpi-utils';

const API_URL = 'https://script.google.com/macros/s/AKfycbwLnUji6n_z0KANgGMqZchGaqk38CCm7d8nDUggLDHEbsuoXe1e1uPt42ivkEKR0B5H/exec';
const TARGET_AREA_PREFIX = '5406';

interface HospitalDetail {
  name: string;
  tambon_id: string;
}

export interface UseKPIDataResult {
  data: KPISummary[];
  kpiMasterList: KPIMaster[];
  hospitalMap: Record<string, HospitalDetail>;
  tambonMap: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Retries failed');
}

function processReportData(allData: any[], tableName: string, title: string): KPISummary {
  if (!Array.isArray(allData)) {
    return { title, tableName: tableName as KPIReportType, totalTarget: 0, totalResult: 0, percentage: 0, data: [], breakdown: {}, targetValue: 0 };
  }

  const filteredData = allData.filter(item =>
    item.areacode && String(item.areacode).startsWith(TARGET_AREA_PREFIX)
  );

  const totalTarget = filteredData.reduce((sum, item) => sum + calculateKPIValue(item, tableName).t, 0);
  const totalResult = filteredData.reduce((sum, item) => sum + calculateKPIValue(item, tableName).r, 0);
  const percentage = totalTarget > 0 ? (totalResult / totalTarget) * 100 : 0;

  const breakdown: Record<string, { target: number; result: number; percentage: number }> = {};
  filteredData.forEach(item => {
    const key = item.hospcode || item.areacode;
    const { t, r } = calculateKPIValue(item, tableName);
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
    percentage: parseFloat(percentage.toFixed(2)),
    data: filteredData,
    breakdown,
    targetValue: 0
  };
}

const CACHE_KEY = 'PA_DASHBOARD_CACHE_V1';

export function useKPIData(): UseKPIDataResult {
  const [data, setData] = useState<KPISummary[]>([]);
  const [kpiMasterList, setKpiMasterList] = useState<KPIMaster[]>([]);
  const [hospitalMap, setHospitalMap] = useState<Record<string, HospitalDetail>>({});
  const [tambonMap, setTambonMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    // 1. Try to load from LocalStorage (Instant Load)
    const loadFromCache = () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Valid cache check (optional: check timestamp expiry)
          if (parsed.data && Array.isArray(parsed.data)) {
            console.log('Using cached data');
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
        // Parallel fetch all data
        const [kpiMasterRes, hospitalsRes, tambonRes, batchRes] = await Promise.all([
          fetchWithRetry(`${API_URL}?sheet=kpi_master`),
          fetchWithRetry(`${API_URL}?sheet=hospitals`),
          fetchWithRetry(`${API_URL}?sheet=tambon_master`),
          fetchWithRetry(`${API_URL}?sheet=BATCH_ALL`)
        ]);

        const kpiMasterData = await kpiMasterRes.json();
        const hospitalsData = await hospitalsRes.json();
        const tambonData = await tambonRes.json();
        const batchJson = await batchRes.json();

        // Process KPI Master
        const configs: KPIMaster[] = (Array.isArray(kpiMasterData) ? kpiMasterData : [])
          .map((row: any) => ({
            table_name: row.table_name || '',
            title: row.title || 'Unknown KPI',
            target: Number(row.target || 0),
            order: Number(row.order || 999),
            link: row.link || undefined
          }))
          .filter((k: KPIMaster) => k.table_name)
          .sort((a: KPIMaster, b: KPIMaster) => a.order - b.order);

        // Process Hospital Map
        const hMap: Record<string, HospitalDetail> = {};
        if (Array.isArray(hospitalsData)) {
          hospitalsData.forEach((row: any) => {
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
          tambonData.forEach((item: any) => {
            if (item.id && item.name_th) {
              tMap[String(item.id)] = item.name_th;
            }
          });
        }
        setTambonMap(tMap);

        // Process Batch Data
        let batchData: Record<string, any[]> = {};
        let currentQuarter = 0;
        const quarterlyKPIs = new Set<string>();

        if (batchJson.data && batchJson.meta) {
          batchData = batchJson.data;
          currentQuarter = batchJson.meta.current_quarter || 0;
          if (Array.isArray(batchJson.meta.kpi_config)) {
            batchJson.meta.kpi_config.forEach((k: any) => {
              if (k.isQuarterly) quarterlyKPIs.add(k.table);
            });
          }
        } else {
          batchData = batchJson;
        }

        const quarterLabel = currentQuarter > 0 ? `สะสม ${currentQuarter * 3} เดือน (Q${currentQuarter})` : "รายไตรมาส";
        const annualLabel = "รายปี";

        // Map configs to reports
        const reports = configs.map(config => {
          const rows = batchData[config.table_name] || [];
          const report = processReportData(rows, config.table_name, config.title);
          report.targetValue = config.target;
          report.link = config.link;
          report.period = quarterlyKPIs.has(config.table_name) ? quarterLabel : annualLabel;
          return report;
        });

        setData(reports);

        // Calculate last updated date
        let maxDateStr = '';
        reports.forEach(r => {
          if (r.data && r.data.length > 0) {
            r.data.forEach((d: any) => {
              if (d.date_com && d.date_com > maxDateStr) maxDateStr = d.date_com;
            });
          }
        });

        let formattedLastUpdated = '';
        if (/^\d{12}$/.test(String(maxDateStr))) {
          const str = String(maxDateStr);
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
          setLastUpdated(formattedLastUpdated);
        }

        // Cache the fresh data
        localStorage.setItem(CACHE_KEY, JSON.stringify({
           data: reports,
           hospitalMap: hMap,
           tambonMap: tMap,
           lastUpdated: formattedLastUpdated,
           timestamp: Date.now()
        }));

      } catch (err) {
        console.error('Error fetching KPI data:', err);
        // Only set error if we don't have cached data
        if (data.length === 0) {
           setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllData();
  }, []);

  return {
    data,
    kpiMasterList,
    hospitalMap,
    tambonMap,
    isLoading,
    error,
    lastUpdated,
  };
}
