// Headless replacement for the /sync browser page: pulls each KPI from the
// MOPH API and pushes it into Google Sheets via the GAS doPost endpoint.
// Useful when the browser sync page is unavailable (daily trigger on GAS
// cannot fetch from MOPH reliably).
//
// Run with: node src/scripts/sync-moph-to-gas.js [--only <table> ...]
//
// Config mirrors the /sync page: KPI list + year/province come from BATCH_ALL
// meta at runtime (รหัส.js CONFIG.KPIS stays the single source of truth).
const MOPH_URL = 'https://opendata.moph.go.th/api/report_data';
const GAS_URL =
  process.env.NEXT_PUBLIC_GAS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwLnUji6n_z0KANgGMqZchGaqk38CCm7d8nDUggLDHEbsuoXe1e1uPt42ivkEKR0B5H/exec';

const onlyArgs = process.argv.filter((_, i, a) => a[i - 1] === '--only');
const onlySet = onlyArgs.length > 0 ? new Set(onlyArgs) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchMetadata() {
  const res = await fetch(`${GAS_URL}?sheet=BATCH_ALL`);
  if (!res.ok) throw new Error(`BATCH_ALL HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.meta) throw new Error('BATCH_ALL response is missing meta');
  return json.meta;
}

async function fetchMoph(tableName, year, province, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(MOPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName, year, province, type: 'json' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // MOPH wraps rows in {"data": [...]} (previously a bare array) — accept both.
      if (Array.isArray(json)) return json;
      if (json && Array.isArray(json.data)) return json.data;
      throw new Error('Unexpected response shape');
    } catch (e) {
      if (i === retries - 1) throw e;
      console.warn(`  MOPH fetch failed (${e.message}), retry ${i + 1}/${retries - 1}...`);
      await sleep(5000 * (i + 1));
    }
  }
}

async function pushToGas(tableName, rows) {
  // text/plain keeps it a CORS "simple request" — same reason as the sync page.
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'save_kpi_data', tableName, data: rows }),
  });
  if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'Unknown GAS error');
  return json.count;
}

async function main() {
  console.log('Loading config from BATCH_ALL...');
  const meta = await fetchMetadata();
  const kpis = (meta.kpi_config || []).filter((k) => k.table);
  const settings = {
    year: String(meta.current_year || '2569'),
    province: String(meta.province_code || '54'),
  };
  const targets = onlySet ? kpis.filter((k) => onlySet.has(k.table)) : kpis;
  if (targets.length === 0) throw new Error('No KPIs selected for sync');

  console.log(
    `Syncing ${targets.length}/${kpis.length} KPIs (year=${settings.year}, province=${settings.province})`,
  );

  let ok = 0;
  let fail = 0;
  for (const kpi of targets) {
    try {
      const rows = await fetchMoph(kpi.table, settings.year, settings.province);
      if (rows.length === 0) throw new Error('MOPH returned 0 rows');
      const count = await pushToGas(kpi.table, rows);
      console.log(`  ✓ ${kpi.table}: ${count} rows saved`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${kpi.table}: ${e.message}`);
      fail++;
    }
    // Random 4-7s pause between KPIs to avoid MOPH rate limiting (mirrors
    // the sync page's WAF-avoidance pacing).
    await sleep(4000 + Math.floor(Math.random() * 3000));
  }

  console.log(`Done. Success: ${ok}, Failed: ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Sync aborted:', e.message);
  process.exitCode = 1;
});
