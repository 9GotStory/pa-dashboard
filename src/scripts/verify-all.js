// Run with: node --experimental-vm-modules src/scripts/verify-all.js
// or just: node src/scripts/verify-all.js (Node 20+ supports .js ESM via package "type": "module",
// but this repo uses CommonJS package.json, so we use dynamic import for `fs` not needed here).

// Config — TABLE_NAMES must mirror รหัส.js CONFIG.KPIS + kpi_master
// source_sheet values (source of truth). See memory:
// project_table_name_source_of_truth.md.
const PROVINCE = '54';
const DISTRICT_PREFIX = '5406'; // Song
const TABLE_NAMES = [
  's_kpi_anc12',
  's_anc5',
  's_kpi_food',
  's_kpi_childdev4',
  's_kpi_childdev2',
  's_aged9',
  's_dm_screen',
  's_ht_screen',
  's_ncd_screen_repleate1',
  's_ht_screen_follow',
  's_dental_0_5_cavity_free',
  's_kpi_dental28',
  's_kpi_dental33',
];

// EPI virtual KPIs (mirrors bootstrapEpiRows in รหัส.js / kpi_master rows).
// limit: s_epi_complete is truncated at 1000 rows unless requested larger.
const EPI_KPIS = [
  ...['bcg','dtp1','dtp2','dtp_hb3','hbv','hbv2','hbv3','hbv4','hib1','hib2','hib3','ipv','ipv1','mmr','opv3','pcv1','pcv2','pcv3','rota','rota1']
    .map((p) => ({ key: `s_epi1__${p}`, source: 's_epi1', prefix: p })),
  ...['dtp4','opv4','mmr1','mmr2','je2','pcv4']
    .map((p) => ({ key: `s_epi2__${p}`, source: 's_epi2', prefix: p })),
  ...['je3','mmr2']
    .map((p) => ({ key: `s_epi3__${p}`, source: 's_epi3', prefix: p })),
  ...['dtp5','opv5']
    .map((p) => ({ key: `s_epi5__${p}`, source: 's_epi5', prefix: p })),
  { key: 's_epi_complete__1y', source: 's_epi_complete', guid: '28dd2c7955ce926456240b2ff0100bde' },
  { key: 's_epi_complete__2y', source: 's_epi_complete', guid: '35f4a8d465e6e1edc05f3d8ab658c551' },
  { key: 's_epi_complete__3y', source: 's_epi_complete', guid: 'd1fe173d08e959397adf34b1d77e88d7' },
  { key: 's_epi_complete__5y', source: 's_epi_complete', guid: 'f033ab37c30201f73f142449d037028d' },
];
const EPI_SOURCES = ['s_epi1', 's_epi2', 's_epi3', 's_epi5', 's_epi_complete'];
const EPI_LIMITS = { s_epi_complete: 5000 };

async function fetchData(tableName) {
  const url = 'https://opendata.moph.go.th/api/report_data';
  const payload = {
    tableName: tableName,
    year: '2569',
    province: PROVINCE,
    type: 'json'
  };
  if (EPI_LIMITS[tableName]) payload.limit = EPI_LIMITS[tableName];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(response.statusText);
    const json = await response.json();
    // MOPH wraps rows in {"data": [...]} (previously a bare array) — accept both.
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.data)) return json.data;
    throw new Error('Unexpected response shape (not an array or {data: [...]})');
  } catch (e) {
    console.error(`Failed to fetch ${tableName}:`, e.message);
    return [];
  }
}

async function verifyAll() {
  console.log('Starting Verification of 13 KPIs for District', DISTRICT_PREFIX, '...');
  console.log('-------------------------------------------------------------------------------');
  console.log('| Table Name                  | Target Col | Result Col |   Target |   Result |      % |');
  console.log('-------------------------------------------------------------------------------');

  for (const tableName of TABLE_NAMES) {
    const rawData = await fetchData(tableName);
    // Filter
    const data = rawData.filter(d => d.areacode && String(d.areacode).startsWith(DISTRICT_PREFIX));

    // Logic mirroring calculateKPIOnServer in src/scripts/รหัส.js.
    // (src/lib/moph-api.ts has been removed; รหัส.js is the source of truth.)
    // 1. Dental 0-5 Swap
    let targetCols = ['target'];
    let resultCols = ['result'];
    
    // Explicit Dental 0-5 Logic
    if (tableName === 's_dental_0_5_cavity_free') {
       targetCols = ['b'];
       resultCols = ['a'];
    } 
    // Dental 33 and others - default target/result.
    // Note: s_kpi_dental33 has no target, so it will be 0.
    
    // 2. Exception: s_aged9 (No sum quarters)
    const isNoQuarterSum = ['s_aged9'].includes(tableName);

    let totalTarget = 0;
    let totalResult = 0;

    const calculateValue = (item, cols) => {
      // Dental specific A/B logic
      if (['a', 'b', 'c'].includes(cols[0])) {
         let val = 0;
         cols.forEach(c => val += Number(item[c] || 0));
         return val;
      }

      // Standard Target/Result logic
      const mainField = cols[0];
      const mainVal = Number(item[mainField] || 0);

      if (isNoQuarterSum) return mainVal;

      let qSum = 0;
      for (let i = 1; i <= 4; i++) {
         const suffix = String(i);
         // Try target1, targetq1, result1, result1q1
         const qVal = Number(item[`${mainField}${suffix}`] || item[`${mainField}q${suffix}`] || item[`${mainField}1q${suffix}`] || 0);
         qSum += qVal;
      }
      
      return mainVal > 0 ? mainVal : qSum;
    };

    data.forEach(item => {
       totalTarget += calculateValue(item, targetCols);
       totalResult += calculateValue(item, resultCols);
    });

    const pct = totalTarget > 0 ? ((totalResult / totalTarget) * 100).toFixed(2) : '0.00';
    
    console.log(
      `| ${tableName.padEnd(27)} | ${targetCols[0].padEnd(10)} | ${resultCols[0].padEnd(10)} | ` +
      `${String(totalTarget).padStart(8)} | ${String(totalResult).padStart(8)} | ${pct.padStart(6)}% |`
    );
  }
  console.log('-------------------------------------------------------------------------------');

  // --- EPI virtual KPIs: mirror getAnnualSum / GUID-filter math in รหัส.js ---
  console.log('\nEPI KPIs (district ' + DISTRICT_PREFIX + ', birth-month sums / GUID filter):');
  console.log('-------------------------------------------------------------------------------');

  const epiCache = {};
  for (const src of EPI_SOURCES) epiCache[src] = null; // lazy fetch below

  const getRows = async (src) => {
    if (epiCache[src] === null) {
      epiCache[src] = (await fetchData(src))
        .filter((d) => d.areacode && String(d.areacode).startsWith(DISTRICT_PREFIX));
      await new Promise((r) => setTimeout(r, 2000));
    }
    return epiCache[src];
  };

  const annualSum = (item, prefix) => {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      sum += Number(item[prefix + mm] || item[prefix + '_' + mm] || 0);
    }
    return sum;
  };

  for (const kpi of EPI_KPIS) {
    const rows = await getRows(kpi.source);
    let totalTarget = 0;
    let totalResult = 0;

    if (kpi.prefix) {
      // Per-vaccine: t = Σ targetMM, r = Σ <prefix>_MM (both column styles)
      rows.forEach((item) => {
        totalTarget += annualSum(item, 'target');
        totalResult += annualSum(item, kpi.prefix);
      });
    } else {
      // Fully immunized: GUID-filtered rows carry aggregate target/result
      rows
        .filter((item) => String(item.id || '').toLowerCase() === kpi.guid)
        .forEach((item) => {
          totalTarget += Number(item.target || 0);
          totalResult += Number(item.result || 0);
        });
    }

    const pct = totalTarget > 0 ? ((totalResult / totalTarget) * 100).toFixed(2) : '0.00';
    console.log(
      `| ${kpi.key.padEnd(24)} | ${String(rows.length).padStart(3)} rows | ` +
      `${String(totalTarget).padStart(6)} | ${String(totalResult).padStart(6)} | ${pct.padStart(6)}% |`
    );
  }
  console.log('-------------------------------------------------------------------------------');
}

verifyAll();
