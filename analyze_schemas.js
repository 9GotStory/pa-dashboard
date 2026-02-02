const https = require('https');

const API_URL = 'https://script.google.com/macros/s/AKfycbwLnUji6n_z0KANgGMqZchGaqk38CCm7d8nDUggLDHEbsuoXe1e1uPt42ivkEKR0B5H/exec';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Follow redirects
      if (res.statusCode === 302 || res.statusCode === 301) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
            console.error("Error parsing JSON for URL:", url);
            resolve([]);
        }
      });
    }).on('error', reject);
  });
}

async function analyze() {
  console.log("Fetching KPI Master...");
  const kpiMaster = await fetchJson(`${API_URL}?sheet=kpi_master`);
  
  if (!Array.isArray(kpiMaster)) {
      console.error("Failed to fetch KPI Master");
      return;
  }

  const tables = kpiMaster.filter(r => r.table_name && r.table_name !== 'kpi_master').map(r => r.table_name);
  console.log(`Found ${tables.length} tables.`);

  const schemas = {};

  for (const table of tables) {
      console.log(`Fetching ${table}...`);
      const data = await fetchJson(`${API_URL}?sheet=${table}`);
      if (Array.isArray(data) && data.length > 0) {
          const row = data[0];
          // Filter out standard info columns to focus on KPI data
          const keys = Object.keys(row).filter(k => !['areacode', 'hospcode', 'province', 'district', 'amphoe', 'tambon', 'village', 'id', 'date_com', 'b_year', 'Last Updated'].includes(k));
          
          schemas[table] = {
              keys: keys.sort(),
              sample: row
          };
      } else {
          schemas[table] = "EMPTY or ERROR";
      }
  }

  console.log("\n--- SCHEMA ANALYSIS ---");
  for (const [table, info] of Object.entries(schemas)) {
      console.log(`\nTable: [${table}]`);
      if (typeof info === 'string') {
          console.log(`Status: ${info}`);
          continue;
      }
      
      const { keys, sample } = info;
      console.log(`Columns: ${keys.join(', ')}`);
      
      
      // Print Sample Values
      console.log("Samples:");
      if (sample['date_com']) console.log(`  - date_com: "${sample['date_com']}"`);
      keys.forEach(k => {
          const val = sample[k];
          const type = typeof val;
          console.log(`  - ${k}: ${val} (${type})`);
      });

      // Pattern Matching
      if (keys.includes('a') && keys.includes('b')) console.log(">> Pattern: A/B");
      else if (keys.includes('result1') || keys.includes('resultq1')) console.log(">> Pattern: Quarterly");
      else if (keys.includes('target') && keys.includes('result')) console.log(">> Pattern: Standard Target/Result");
      else console.log(">> Pattern: UNKNOWN / SPECIAL");
  }
}

analyze();
