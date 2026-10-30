// Headless replacement for the /sync browser page: pulls each KPI from the
// MOPH API and pushes it into Google Sheets via the GAS doPost endpoint.
// Useful when the browser sync page is unavailable (daily trigger on GAS
// cannot fetch from MOPH reliably).
//
// Run with: node src/scripts/sync-moph-to-gas.js [--only <table> ...]
//             [--year <YYYY> ... | --backfill] [--force] [--no-rebuild]
//   --only <table>  just this table, repeatable (default: every sync unit)
//   --year <YYYY>   this year of the window, repeatable (default: current_year)
//   --backfill      every year of the window, oldest first (SPEC §12.2)
//   --force         save even when GAS has newer data (skips Stale data)
//   --no-rebuild    no POST rebuild at the end
//
// Config mirrors the /sync page: KPI list + year/province come from BATCH_ALL
// meta at runtime (รหัส.js CONFIG.KPIS stays the single source of truth).

// Not require(), which lint forbids, nor import, which makes node warn that
// this .js file is not a module (package.json has no "type").
const { parseArgs } = process.getBuiltinModule('node:util');

// MOPH_URL and SYNC_WAIT_SCALE are for the tests (src/scripts/test/): a
// local MOPH stub, and 0 to skip the pauses below. Empty counts as unset.
const MOPH_URL = process.env.MOPH_URL || 'https://opendata.moph.go.th/api/report_data';
const GAS_URL =
  process.env.NEXT_PUBLIC_GAS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwLnUji6n_z0KANgGMqZchGaqk38CCm7d8nDUggLDHEbsuoXe1e1uPt42ivkEKR0B5H/exec';
const WAIT_SCALE = Number(process.env.SYNC_WAIT_SCALE || 1);

const USAGE =
  'usage: node src/scripts/sync-moph-to-gas.js [--only <table> ...] [--year <YYYY> ... | --backfill] [--force] [--no-rebuild]';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms * WAIT_SCALE));

async function fetchMetadata() {
  const res = await fetch(`${GAS_URL}?sheet=BATCH_ALL`);
  if (!res.ok) throw new Error(`BATCH_ALL HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.meta) throw new Error('BATCH_ALL response is missing meta');
  // meta.years (the window) comes with the Data Center GAS (F04). An older
  // GAS ignores `year` and would save any year into the current-year sheet
  // (SPEC §13), so never sync through one.
  if (!Array.isArray(json.meta.years)) {
    throw new Error('BATCH_ALL meta has no years: deploy the Data Center GAS (F04) first');
  }
  return json.meta;
}

// Returns { rows, total }: total is the envelope's row count (a string from
// MOPH, made a number), undefined for a bare array.
async function fetchMoph(tableName, year, province, limit, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(MOPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName, year, province, type: 'json', limit }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // MOPH wraps rows in {"data": [...]} (previously a bare array) — accept both.
      if (Array.isArray(json)) return { rows: json, total: undefined };
      if (json && Array.isArray(json.data)) {
        return { rows: json.data, total: json.total == null ? undefined : Number(json.total) };
      }
      throw new Error('Unexpected response shape');
    } catch (e) {
      if (i === retries - 1) throw e;
      console.warn(`  MOPH fetch failed (${e.message}), retry ${i + 1}/${retries - 1}...`);
      await sleep(5000 * (i + 1));
    }
  }
}

// A POST action to GAS: its success response (SCHEMA §3.3, §3.7), or throws
// the error message GAS answered.
async function postToGas(body) {
  // text/plain keeps it a CORS "simple request" — same reason as the sync page.
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'Unknown GAS error');
  return json;
}

async function main() {
  // Strict: a mistyped flag (--no-rebiuld) stops the run instead of being
  // ignored.
  let args;
  try {
    ({ values: args } = parseArgs({
      options: {
        only: { type: 'string', multiple: true },
        year: { type: 'string', multiple: true },
        backfill: { type: 'boolean' },
        force: { type: 'boolean' },
        'no-rebuild': { type: 'boolean' },
      },
    }));
  } catch (e) {
    throw new Error(`${e.message}\n${USAGE}`);
  }
  if (args.backfill && args.year) throw new Error('--backfill already syncs every year of the window; drop --year');

  console.log('Loading config from BATCH_ALL...');
  const meta = await fetchMetadata();
  // MOPH silently truncates at its page size (1000 by default), so every
  // request asks for 5000 rows, or the unit's own limit if larger (SPEC §7.1).
  const units = (meta.kpi_config || []).filter((u) => u.table).map((u) => ({ ...u, limit: Math.max(5000, Number(u.limit) || 0) }));
  const settings = {
    year: String(meta.current_year || '2569'),
    province: String(meta.province_code || '54'),
  };
  const selected = args.only ? units.filter((u) => args.only.includes(u.table)) : units;
  if (selected.length === 0) throw new Error('No tables selected for sync');
  // --backfill: every year of the window, oldest first (meta.years, SCHEMA §3.5).
  const years = args.backfill ? meta.years : (args.year ?? [settings.year]);
  // GAS refuses any other year (Year outside window), so stop before asking MOPH.
  const outside = years.filter((y) => !meta.years.includes(y));
  if (outside.length > 0) {
    throw new Error(`year outside the window ${meta.years[0]}–${meta.years.at(-1)}: ${outside.join(', ')}`);
  }

  console.log(
    `Syncing ${selected.length}/${units.length} tables (years=${years.join(',')}, province=${settings.province})`,
  );

  let ok = 0;
  let fail = 0;
  // One year at a time, every table in it.
  const jobs = years.flatMap((year) => selected.map((unit) => ({ year, unit })));
  for (const { year, unit } of jobs) {
    try {
      const { rows, total } = await fetchMoph(unit.table, year, settings.province, unit.limit);
      if (rows.length === 0) throw new Error('MOPH returned 0 rows');
      // A response cut short at the page size: GAS would refuse it too
      // (Incomplete data, SPEC §7.1), so it is not sent.
      if (total !== undefined && rows.length < total) {
        throw new Error(
          `MOPH sent ${rows.length} of total ${total} rows (asked for limit ${unit.limit}), not saved; ` +
            'run it again, and if total is over the limit the table needs paging with offset (SPEC §7.1)',
        );
      }
      // --force: GAS skips its Stale data check (SCHEMA §3.3).
      const saved = await postToGas({
        action: 'save_kpi_data',
        tableName: unit.table,
        year,
        total,
        force: args.force === true,
        data: rows,
      });
      // Without a total there is nothing to check the row count against.
      const fetched = total === undefined ? `${rows.length} (MOPH sent no total)` : `${rows.length} of total ${total}`;
      console.log(
        `  ✓ ${unit.table} ${year} → ${saved.sheet}: fetched ${fetched}, received ${saved.received}, count ${saved.count}`,
      );
      ok++;
    } catch (e) {
      console.error(`  ✗ ${unit.table} ${year}: ${e.message}`);
      fail++;
    }
    // Random 4-7s pause between requests to avoid MOPH rate limiting (mirrors
    // the sync page's WAF-avoidance pacing).
    await sleep(4000 + Math.floor(Math.random() * 3000));
  }

  console.log(`Done. Success: ${ok}, Failed: ${fail}`);
  if (fail > 0) process.exitCode = 1;

  // Rebuild only when new data was saved (SPEC §6.3). Its result is the last
  // line (FEATURES F09) and does not change the exit code: the tables are
  // saved either way, and before a Deploy Hook is set every run would fail.
  if (ok > 0 && !args['no-rebuild']) {
    try {
      const rebuilt = await postToGas({ action: 'rebuild', reason: 'sync-moph-to-gas.js' });
      console.log(`Rebuild requested, ${rebuilt.remaining_today} left today`);
    } catch (e) {
      console.log(`Rebuild not requested: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error('Sync aborted:', e.message);
  process.exitCode = 1;
});
