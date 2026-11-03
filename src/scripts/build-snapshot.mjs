// prebuild (SPEC §6.2): the snapshot the Data Center pages read (SCHEMA §7),
// from GAS ?action=catalog and ?action=report, one request at a time. When
// anything is missing it fails loudly (exit 1) and writes nothing, so the
// build stops and the site keeps its last deployment (ADR-0006).
//
//   npm run snapshot   (npm run build runs it first, as prebuild)
// Env: NEXT_PUBLIC_GAS_SCRIPT_URL, with no fallback.
import fs from "node:fs";
import path from "node:path";

const OUT = path.join("public", "data");
const KB = 1024;
// SNAPSHOT_WAIT_SCALE is for the tests (src/scripts/test/): it scales every
// wait below, and 0 skips them. Empty counts as unset.
const WAIT_SCALE = Number(process.env.SNAPSHOT_WAIT_SCALE || 1);
// The waits before each retry of a failed request (SPEC §6.2).
const RETRY_WAITS = [2000, 4000, 8000].map((ms) => ms * WAIT_SCALE);
// Busy: another run holds the script lock, e.g. syncAllData for 1–3 min. The
// request is asked again every 20 s, for up to 5 min (SPEC §6.2).
const BUSY_WAIT = 20000 * WAIT_SCALE;
const BUSY_LIMIT = 300000 * WAIT_SCALE;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error(`build-snapshot: ${message}`);
  process.exit(1);
}

// No fallback URL: a build that forgot the env fails instead of reading some
// other deployment (SPEC §6.2).
const url = process.env.NEXT_PUBLIC_GAS_SCRIPT_URL;
if (!url) {
  fail(
    "set NEXT_PUBLIC_GAS_SCRIPT_URL to the GAS web app's /exec URL: in .env.local on your machine, " +
      "in the build env on Cloudflare Pages and in GitHub secrets for CI (SCHEMA §10)",
  );
}

// One GET to GAS: its JSON body. Throws why not: GAS out of reach, an HTTP
// status other than 200 (GAS answers everything with 200, SCHEMA §3) or an
// answer that is not JSON.
async function fetchJson(query) {
  let res;
  try {
    res = await fetch(`${url}?${query}`);
  } catch (err) {
    throw new Error(`cannot reach GAS (${err.cause?.code || err.message})`);
  }
  const text = await res.text();
  if (res.status !== 200) throw new Error(`GAS answered HTTP ${res.status}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`GAS answered something other than JSON: ${text.slice(0, 200)}`);
  }
}

// GAS's answer to a GET with query (SPEC §6.2): Busy is asked again until
// BUSY_LIMIT, any other failure (an error answer included) retried 3 times.
// Throws the failure it gives up on.
async function callGasWithRetry(query) {
  const busyUntil = Date.now() + BUSY_LIMIT;
  let retries = 0;
  for (;;) {
    let body;
    let failure;
    try {
      body = await fetchJson(query);
      if (body.status === "error") failure = `GAS answered: ${body.message}`;
    } catch (err) {
      failure = err.message;
    }
    if (!failure) return body;
    if (body?.message === "Busy") {
      if (Date.now() + BUSY_WAIT > busyUntil) {
        throw new Error(
          `GAS still answers Busy after ${BUSY_LIMIT / 1000} s: another run holds the script lock ` +
            "(syncAllData takes 1–3 min); build again once it is done",
        );
      }
      console.log(`  GAS is Busy (another run holds the script lock): asking again in ${BUSY_WAIT / 1000} s`);
      await sleep(BUSY_WAIT);
    } else if (retries < RETRY_WAITS.length) {
      console.log(`  ${failure}: retry ${retries + 1}/${RETRY_WAITS.length} in ${RETRY_WAITS[retries] / 1000} s`);
      await sleep(RETRY_WAITS[retries++]);
    } else {
      throw new Error(`${failure} (after ${retries} retries)`);
    }
  }
}

// By order, an empty one last, then by the name field in Thai (SPEC §5.4).
function byOrderThen(name) {
  return (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a[name].localeCompare(b[name], "th");
}

// A topic's groups (SPEC §5.4): by the smallest order of their reports, the
// reports without a group last; each group's reports by order then name.
function groupsOf(reports) {
  const groups = new Map();
  for (const report of [...reports].sort(byOrderThen("report_name"))) {
    // Reports come sorted, so a group's first one has its smallest order.
    if (!groups.has(report.subgroup)) {
      groups.set(report.subgroup, { subgroup: report.subgroup, order: report.order, reports: [] });
    }
    groups.get(report.subgroup).reports.push(report);
  }
  return [...groups.values()]
    .sort((a, b) => (a.subgroup === "") - (b.subgroup === "") || byOrderThen("subgroup")(a, b))
    .map((g) => ({ subgroup: g.subgroup, reports: g.reports }));
}

// catalog.json (DcCatalog, SCHEMA §9): หมวด → หัวข้อ → กลุ่ม → รายงาน, sorted
// by SPEC §5.4.
function nest(catalog, reports) {
  const topics = catalog.topics
    .map((topic) => ({ ...topic, groups: groupsOf(reports.filter((r) => r.cat_id === topic.cat_id)) }))
    .filter((topic) => topic.groups.length > 0)
    .sort(byOrderThen("category_name"));
  const mains = new Map();
  for (const topic of topics) {
    // Topics come sorted, so a หมวด's first one has its smallest order.
    if (!mains.has(topic.main_report_id)) {
      mains.set(topic.main_report_id, {
        main_report_id: topic.main_report_id,
        main_report_name: topic.main_report_name,
        order: topic.order,
        topics: [],
      });
    }
    mains.get(topic.main_report_id).topics.push(topic);
  }
  return {
    meta: catalog.meta,
    areas: catalog.areas,
    hospitals: catalog.hospitals,
    mains: [...mains.values()]
      .sort(byOrderThen("main_report_name"))
      .map((m) => ({ main_report_id: m.main_report_id, main_report_name: m.main_report_name, topics: m.topics })),
  };
}

const CHECK_URL = "check that NEXT_PUBLIC_GAS_SCRIPT_URL is the /exec URL of this project's GAS web app";
const started = Date.now();
let catalog;
try {
  catalog = await callGasWithRetry("action=catalog");
} catch (err) {
  fail(`cannot get the catalog (?action=catalog): ${err.message}`);
}
if (!catalog.meta || !Array.isArray(catalog.topics) || !Array.isArray(catalog.reports)) {
  fail(`?action=catalog answered without meta, topics and reports; ${CHECK_URL}`);
}
if (catalog.reports.length === 0) {
  fail("?action=catalog lists no active report: tick enabled in hdc_reports for the reports to publish (SPEC §5.2)");
}
// An id names its file (reports/{id}.json), so it must be an HDC id, as
// sanitizeHdcId in GAS allows (SCHEMA §3).
for (const entry of catalog.reports) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(entry.opendata_id)) {
    fail(
      `report ${JSON.stringify(entry.opendata_id)} (${entry.source_table}) has an opendata_id that is not an ` +
        "HDC id (SCHEMA §3); check its row in hdc_reports",
    );
  }
}

console.log(`build-snapshot: ?action=catalog lists ${catalog.reports.length} active reports`);
// opendata_id → its ?action=report answer, in catalog order.
const answers = new Map();
for (const [i, entry] of catalog.reports.entries()) {
  console.log(`  [${i + 1}/${catalog.reports.length}] ${entry.opendata_id} ${entry.source_table}`);
  let data;
  try {
    data = await callGasWithRetry(`action=report&id=${encodeURIComponent(entry.opendata_id)}`);
  } catch (err) {
    fail(`cannot get report ${entry.opendata_id} (${entry.source_table}): ${err.message}`);
  }
  if (!data.report || !Array.isArray(data.years)) {
    fail(`?action=report&id=${entry.opendata_id} answered without report and years; ${CHECK_URL}`);
  }
  answers.set(entry.opendata_id, data);
}
const fetched = [...answers.values()];

// Why a report's answer is incomplete (SPEC §6.2, SCHEMA §7): one line per
// problem, none when it is complete.
function gaps({ report, years }, currentYear) {
  const label = `${report.opendata_id} (${report.source_table})`;
  const resync = (year) => `sync ${report.source_table} ${year} again`;
  return [
    // GAS leaves out a year whose sheet is missing (SCHEMA §3.2).
    ...report.years
      .filter((y) => !years.some((block) => block.b_year === y.b_year))
      .map(
        (y) =>
          `${label} ${y.b_year}: sync_status has this year but ?action=report has no block for it, ` +
          `so its sheet is missing (see the WARNING in system_logs); ${resync(y.b_year)}`,
      ),
    ...years
      .filter((block) => block.sheet_rows !== block.expected_rows)
      .map(
        (block) =>
          `${label} ${block.b_year}: sheet_rows ${block.sheet_rows} ≠ expected_rows ${block.expected_rows}, ` +
          `so the sheet does not hold what sync_status counted; ${resync(block.b_year)}`,
      ),
    ...years
      .filter((block) => block.b_year === currentYear && block.rows.length === 0)
      .map(
        (block) =>
          `${label} ${block.b_year}: no row of this report in the current year (${block.sheet_rows} district rows ` +
          `in the sheet, none with id ${report.opendata_id}); check that the id column of the raw data ` +
          "matches opendata_id (SCHEMA §3.2)",
      ),
  ];
}

const problems = fetched.flatMap((data) => gaps(data, catalog.meta.current_year));
if (problems.length > 0) {
  fail(`the snapshot would be incomplete, so nothing is written (SPEC §6.2):\n  ${problems.join("\n  ")}`);
}

// SnapshotMeta (SCHEMA §9). Every date_com starts YYYYMMDDHHmm, so the
// largest string is the latest, with or without seconds.
const meta = {
  built_at: new Date().toISOString(),
  current_year: catalog.meta.current_year,
  years: catalog.meta.years,
  report_count: fetched.length,
  latest_date_com: fetched
    .flatMap((data) => data.years.map((block) => block.max_date_com))
    .reduce((max, v) => (v > max ? v : max), ""),
};
// Each file as written, with its size limit (SPEC §6.1, before gzip).
const files = [
  ["meta.json", meta, 1 * KB],
  ["catalog.json", nest(catalog, fetched.map((data) => data.report)), 100 * KB],
  ...[...answers].map(([id, data]) => [`reports/${id}.json`, data, 500 * KB]),
].map(([file, content, maxBytes]) => {
  const json = JSON.stringify(content);
  return { file, json, bytes: Buffer.byteLength(json), maxBytes };
});
const formatKb = (bytes) => (bytes / KB).toFixed(1).replace(/\.0$/, "");
const over = files.filter((f) => f.bytes > f.maxBytes);
if (over.length > 0) {
  fail(
    "the snapshot would break the size limits of SPEC §6.1, so nothing is written:\n  " +
      over.map((f) => `${f.file} is ${formatKb(f.bytes)} KB, over its ${formatKb(f.maxBytes)} KB limit`).join("\n  "),
  );
}

for (const f of files.filter((f) => f.bytes >= 0.8 * f.maxBytes)) {
  const pct = Math.floor((f.bytes / f.maxBytes) * 100);
  console.warn(
    `build-snapshot: warning: ${f.file} is ${formatKb(f.bytes)} KB, ${pct}% of its ${formatKb(f.maxBytes)} KB limit (SPEC §6.1)`,
  );
}

// Every check has passed: only now is the earlier snapshot replaced, as a
// whole, so no file of a report no longer active is left behind.
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "reports"), { recursive: true });
for (const { file, json } of files) fs.writeFileSync(path.join(OUT, file), json);

const largest = files.reduce((a, b) => (b.bytes > a.bytes ? b : a));
console.log(
  `build-snapshot: wrote ${fetched.length} reports to ${OUT} in ${((Date.now() - started) / 1000).toFixed(1)} s; ` +
    `the largest file is ${largest.file}, ${formatKb(largest.bytes)} KB`,
);
