import { KPISummary, KPIReportType, MophReportData, KPIMaster } from './types';
import { calculateKPIValue } from './kpi-utils';

const API_URL = 'https://script.google.com/macros/s/AKfycbwLnUji6n_z0KANgGMqZchGaqk38CCm7d8nDUggLDHEbsuoXe1e1uPt42ivkEKR0B5H/exec';
const TARGET_AREA_PREFIX = '5406'; // Song District


// Helper for retry logic
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Retrying ${url} (${i + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, backoff * (i + 1)));
    }
  }
  throw new Error('Retries failed');
}

export async function fetchMophReport(tableName: KPIReportType, title: string): Promise<KPISummary> {
  const url = `${API_URL}?sheet=${tableName}`;

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      next: { revalidate: 3600 } 
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${response.statusText}`);
    }

    const allData: MophReportData[] = await response.json();
    return processReportData(allData, tableName, title);

  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return createEmptyReport(tableName, title);
  }
}

/**
 * NEW: Fetch ALL Reports in a Single Request (Turbo Mode)
 */
export async function fetchBatchReports(configs: KPIMaster[]): Promise<KPISummary[]> {
  const url = `${API_URL}?sheet=BATCH_ALL`;
  
  try {
     // For Static Export: Data is fetched at build time. Revalidate has no effect on client but good for ISR if switched later.
     // We set to 3600 to be safe for SSG.
     const response = await fetchWithRetry(url, { next: { revalidate: 3600 } });
     if (!response.ok) throw new Error("Batch fetch failed");
     
     const json = await response.json();
     
     // Handle both new {data, meta} and old direct object format
     let batchData: Record<string, MophReportData[]> = {};
     let currentQuarter = 0;
     let quarterlyKPIs = new Set<string>(); // Set of table names that are Quarterly

     if (json.data && json.meta) {
        batchData = json.data;
        currentQuarter = json.meta.current_quarter || 0;
        
        // Build Set of Quarterly KPIs from Meta Config
        if (Array.isArray(json.meta.kpi_config)) {
           json.meta.kpi_config.forEach((k: any) => {
              if (k.isQuarterly) quarterlyKPIs.add(k.table);
           });
        }
     } else {
        batchData = json;
     }

     const quarterLabel = currentQuarter > 0 ? `สะสม ${currentQuarter * 3} เดือน (Q${currentQuarter})` : "รายไตรมาส";
     const annualLabel = "รายปี";
     
     // Map config to reports
     return configs.map(config => {
        const rows = batchData[config.table_name] || [];
        const report = processReportData(rows, config.table_name as KPIReportType, config.title);
        report.targetValue = config.target;
        report.link = config.link;
        
        // Determine Badge
        // 1. If explicit config says Quarterly -> Use Quarter Label
        // 2. Else -> Use Annual Label
        if (quarterlyKPIs.has(config.table_name)) {
           report.period = quarterLabel;
        } else {
           report.period = annualLabel;
        }
        
        return report;
     });

  } catch (error) {
     console.error("Batch fetch error:", error);
     return [];
  }
}

/**
 * Shared Processor: Converts Raw Rows -> KPI Summary
 */
function processReportData(allData: MophReportData[], tableName: KPIReportType, title: string): KPISummary {
    if (!Array.isArray(allData)) return createEmptyReport(tableName, title);

    // Filter for Song District
    const filteredData = allData.filter(item => 
      item.areacode && String(item.areacode).startsWith(TARGET_AREA_PREFIX)
    );

    // Aggregate results using Server-Provided values (Trust the Server!)
    const totalTarget = filteredData.reduce((sum, item) => sum + calculateKPIValue(item, tableName).t, 0);
    const totalResult = filteredData.reduce((sum, item) => sum + calculateKPIValue(item, tableName).r, 0);
    
    const percentage = totalTarget > 0 ? (totalResult / totalTarget) * 100 : 0;

    // Calculate Breakdown
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

    // Finalize percentages for breakdown
    Object.keys(breakdown).forEach(key => {
      const b = breakdown[key];
      b.percentage = b.target > 0 ? (b.result / b.target) * 100 : 0;
    });

    return {
      title,
      tableName,
      totalTarget,
      totalResult,
      percentage: parseFloat(percentage.toFixed(2)),
      data: filteredData,
      breakdown,
      targetValue: 0 
    };
}

function createEmptyReport(tableName: KPIReportType, title: string): KPISummary {
   return {
      title,
      tableName,
      totalTarget: 0,
      totalResult: 0,
      percentage: 0,
      data: [],
      breakdown: {},
      targetValue: 0
    };
}

export interface TambonMaster {
  id: string;
  name_th: string;
  district_id: string;
  zip_code: string;
}

export async function fetchTambonMap(): Promise<Record<string, string>> {
   try {
     const url = `${API_URL}?sheet=tambon_master`;
     const response = await fetchWithRetry(url, { next: { revalidate: 3600 } });
     if (!response.ok) return {};
     
     const data: TambonMaster[] = await response.json();
     const map: Record<string, string> = {};
     
     data.forEach(item => {
        if (item.id && item.name_th) {
           map[String(item.id)] = item.name_th;
        }
     });
     
     return map;
   } catch (error) {
     console.error("Error fetching tambon map:", error);
     return {};
   }
}

export interface HospitalDetail {
  name: string;
  tambon_id: string;
}

export async function fetchHospitalMap(): Promise<Record<string, HospitalDetail>> {
  const url = `${API_URL}?sheet=hospitals`;
  
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      next: { revalidate: 3600 } 
    });

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    if (!Array.isArray(data)) return {};

    const map: Record<string, HospitalDetail> = {};
    data.forEach(row => {
      // Clean up keys - GAS might return 'col_0' if no header, or specific names
      // We assume: Col 1 = Code, Col 2 = Name, Col 3 = Tambon ID
      const keys = Object.keys(row);
      if (keys.length >= 2) {
        const code = String(row[keys[0]]).trim();
        const name = String(row[keys[1]]).trim();
        const tambon_id = keys.length >= 3 ? String(row[keys[2]]).trim() : '';
        
        if (code) {
           map[code] = { name, tambon_id };
        }
      }
    });
    
    return map;
  } catch (error) {
    console.error('Error fetching hospital map:', error);
    return {};
  }
}

export async function fetchKPIMaster(): Promise<KPIMaster[]> {
  const url = `${API_URL}?sheet=kpi_master`;

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      next: { revalidate: 3600 } 
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    // Map raw data to KPIMaster objects
    // GAS/json might return field names as in sheet (lowercase)
    // We assume columns: table_name, title, target, order, link
    return data.map((row: any) => ({
       table_name: row.table_name || '',
       title: row.title || 'Unknown KPI',
       target: Number(row.target || 0),
       order: Number(row.order || 999),
       link: row.link || undefined
    })).filter(k => k.table_name)
      .sort((a, b) => a.order - b.order);

  } catch (error) {
    console.error('Error fetching KPI master:', error);
    return [];
  }
}
