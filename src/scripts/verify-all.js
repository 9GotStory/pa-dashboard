
const fs = require('fs');

// Config
const PROVINCE = '54';
const DISTRICT_PREFIX = '5406'; // Song
const TABLE_NAMES = [
  's_kpi_anc12',
  's_anc5',
  's_kpi_food',
  's_kpi_child_specialpp',
  's_kpi_childdev2',
  's_aged9_w',
  's_dm_screen',
  's_ht_screen',
  's_ncd_screen_repleate1',
  's_ncd_screen_repleate2',
  's_dental_0_5_cavity_free',
  's_kpi_dental28',
  's_dental_65'
];

async function fetchData(tableName) {
  const url = 'https://opendata.moph.go.th/api/report_data';
  const payload = {
    tableName: tableName,
    year: '2569',
    province: PROVINCE,
    type: 'json'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(response.statusText);
    return await response.json();
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

    // Logic Mirroring moph-api.ts
    // 1. Dental 0-5 Swap
    let targetCols = ['target'];
    let resultCols = ['result'];
    
    // Explicit Dental 0-5 Logic
    if (tableName === 's_dental_0_5_cavity_free') {
       targetCols = ['b'];
       resultCols = ['a'];
    } 
    // Dental 65 and others - default target/result.
    // Note: s_dental_65 has no target, so it will be 0.
    
    // 2. Exception: s_aged9_w (No sum quarters)
    const isNoQuarterSum = ['s_aged9_w'].includes(tableName);

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
}

verifyAll();
