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
    
    if (!Array.isArray(allData)) {
       console.error(`API returned non-array for ${tableName}`, allData);
       // Return empty structure instead of throwing to prevent Promise.all failure
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

    // Filter for Song District
    const filteredData = allData.filter(item => 
      item.areacode && String(item.areacode).startsWith(TARGET_AREA_PREFIX)
    );

    // Filter out invalid rows (e.g., total rows with 'รวม' if any, or empty)
    // Sometimes API returns Province Total as separate row, we rely on areacode filtering to remove it.

    // Define Calculation Logic based on Table Type
    // Note: s_kpi_dental28 uses target/result, not a/b. Only s_dental_0_5_cavity_free seems to use a/b.
    // We should be specific.
    
    // Column Mapping
    let targetCols = ['target'];
    let resultCols = ['result'];
    
    // Check specific tables that use A/B
    const useABColumns = [
       's_dental_0_5_cavity_free', 
       // 's_kpi_dental33' uses result/result01... no explicitly named 'target' column in schema, just multiple results.
       // We'll stick to standard 'result' for s_kpi_dental33 for now, though target might be missing (0).
    ].includes(tableName);
    
    if (useABColumns) {
      // Dental 0-5 seems to imply: B = Examined (Target), A = Cavity Free (Result)
      // Because Sum(A)=360, Sum(B)=419. If Target=A, Result=B => 116% (Wrong)
      // So we swap: Target=B, Result=A => 85% (Plausible)
      targetCols = ['b'];
      resultCols = ['a'];
    }

    // Helper to get value from multiple potential columns (smart sum or priority?)
    // Strategy: 
    // For Standard: If 'target' exists and > 0, use it. Else sum 'target1'...'target4'.
    // For Dental: Just use 'a'.
    
    // EXCEPTION: s_aged9_w has result1...result9 which are aspects, NOT quarters. 
    // We must NOT sum them.
    const isNoQuarterSum = ['s_aged9_w'].includes(tableName);

    const calculateValue = (item: any, cols: string[]) => {
      let val = 0;
      // specific logic for standard columns (target/result)
      if (cols[0] === 'target' || cols[0] === 'result') {
         const mainField = cols[0];
         const mainVal = Number(item[mainField] || 0);
         
         if (isNoQuarterSum) {
            return mainVal;
         }
         
         // Try to find quarters: target1 vs targetq1
         // Check item keys for pattern
         let qSum = 0;
         for (let i = 1; i <= 4; i++) {
            // Try 'target1', 'targetq1', 'result1', 'result1q1'
            const suffix = String(i);
            const qVal = Number(item[`${mainField}${suffix}`] || item[`${mainField}q${suffix}`] || item[`${mainField}1q${suffix}`] || 0);
            qSum += qVal;
         }

         // If mainVal is significantly larger than qSum, it's likely the total.
         // If mainVal is 0, use qSum.
         // If mainVal roughly equals qSum, use mainVal.
         // Safest: Use mainVal if > 0, else qSum.
         return mainVal > 0 ? mainVal : qSum;
      }
      
      // Fallback for simple columns like 'a', 'b'
      cols.forEach(c => val += Number(item[c] || 0));
      return val;
    };

    // Aggregate results
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
      targetValue: 0 // Will be overwritten by master config
    };

  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error);
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
      next: { revalidate: 60 } // Cache shorter (1 min) for config changes
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    // Map raw data to KPIMaster objects
    // GAS/json might return field names as in sheet (lowercase)
    // We assume columns: table_name, title, target, order
    return data.map((row: any) => ({
       table_name: row.table_name || '',
       title: row.title || 'Unknown KPI',
       target: Number(row.target || 0),
       order: Number(row.order || 999)
    })).filter(k => k.table_name)
      .sort((a, b) => a.order - b.order);

  } catch (error) {
    console.error('Error fetching KPI master:', error);
    return [];
  }
}
