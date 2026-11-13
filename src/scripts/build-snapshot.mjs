// prebuild (SPEC §6.2): the snapshot the Data Center pages read (SCHEMA §7),
// from GAS ?action=catalog, ?action=report and ?action=registry_population,
// one request at a time. When anything is missing it fails loudly (exit 1)
// and writes nothing, so the build stops and the site keeps its last
// deployment (ADR-0006).
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

const currentYear = catalog.meta.current_year;
const problems = fetched.flatMap((data) => gaps(data, currentYear));
// gaps lets through a report without the current year (not synced yet), but at
// least one must have rows in it, or the year is not synced at all (SPEC §6.2).
if (!fetched.some((data) => data.years.some((block) => block.b_year === currentYear && block.rows.length > 0))) {
  problems.push(
    `no active report has rows in the current year ${currentYear}: sync ${currentYear} first ` +
      "(the /sync page or the daily trigger, SPEC §7), or check current_year in the settings sheet",
  );
}
if (problems.length > 0) {
  fail(`the snapshot would be incomplete, so nothing is written (SPEC §6.2):\n  ${problems.join("\n  ")}`);
}

// The columns of each registry sheet that every row of
// ?action=registry_population has (SCHEMA §2.6–2.8, §3.9), uploaded_at left
// out. A village row has a population row's columns.
const POPULATION_COLUMNS = [
  "yymm",
  "cc",
  "cc_name",
  "rcode",
  "rcode_name",
  "tt",
  "tt_name",
  "mm",
  "mm_name",
  "male",
  "female",
  "total",
  "house",
];
const REGISTRY_COLUMNS = {
  population: POPULATION_COLUMNS,
  village: POPULATION_COLUMNS,
  age: [
    "yymm",
    "rcode",
    "tt",
    "tt_name",
    // m0, f0 … m101, f101 (101 = over 100 years)
    ...Array.from({ length: 102 }, (_, age) => [`m${age}`, `f${age}`]).flat(),
    ...["lunar", "central", "nonthai", "moving", "total"].flatMap((group) => [
      `${group}_m`,
      `${group}_f`,
      `${group}_t`,
    ]),
  ],
};
const REGISTRY_SHEETS = {
  population: "registry_population",
  village: "registry_population_village",
  age: "registry_population_age",
};

// Why GAS's ?action=registry_population answer has the wrong shape (SCHEMA
// §7), or "" when it is right.
function registryProblem(answer) {
  if (!Array.isArray(answer.years)) return `answered without years; ${CHECK_URL}`;
  const seen = new Set();
  for (const year of answer.years) {
    const yymm = year?.yymm;
    if (typeof yymm !== "string" || !/^\d{2}12$/.test(yymm)) {
      return (
        `answered a year with yymm ${JSON.stringify(yymm)}, not the figures at 31 Dec (YY12); ` +
        `fix the yymm column of ${REGISTRY_SHEETS.population}, ${REGISTRY_SHEETS.village} and ${REGISTRY_SHEETS.age} in PA-Data (SCHEMA §2.6)`
      );
    }
    if (seen.has(yymm)) return `answered yymm ${yymm} twice; ${CHECK_URL}`;
    seen.add(yymm);
    for (const [kind, columns] of Object.entries(REGISTRY_COLUMNS)) {
      if (!Array.isArray(year[kind])) {
        return `answered ${yymm} without a list of ${kind} rows (${REGISTRY_SHEETS[kind]}); ${CHECK_URL}`;
      }
      for (const [i, row] of year[kind].entries()) {
        const missing = columns.find((column) => !Object.hasOwn(Object(row), column));
        if (missing !== undefined) {
          return (
            `answered row ${i + 1} of ${yymm} in ${REGISTRY_SHEETS[kind]} without ${missing}: GAS leaves out a column ` +
            "the sheet lacks and a count that is blank or no number (SCHEMA §3.9), so check that sheet's header and " +
            "that row in PA-Data"
          );
        }
      }
    }
  }
  return "";
}

// Why the village rows of a year do not match its population rows (SCHEMA §7),
// one line per problem: rule 15 of SCHEMA §3.8, and no (rcode, mm) twice, since
// the home page adds the rows up as they are and would count it twice.
function villageMismatches({ population, village }) {
  const rowKey = (row) => `rcode ${row.rcode} tt ${row.tt}`;
  const populationRows = Map.groupBy(population, rowKey);
  const villageRows = Map.groupBy(village, rowKey);
  return [
    ...[...Map.groupBy(village, (row) => `rcode ${row.rcode} mm ${row.mm}`)]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]) => `${REGISTRY_SHEETS.village} has ${rows.length} rows for ${key}`),
    ...[...populationRows.keys()]
      .filter((key) => !villageRows.has(key))
      .map((key) => `${REGISTRY_SHEETS.village} has no row for ${key}, which ${REGISTRY_SHEETS.population} has`),
    ...[...villageRows.keys()]
      .filter((key) => !populationRows.has(key))
      .map(
        (key) => `${REGISTRY_SHEETS.village} has rows for ${key}, which ${REGISTRY_SHEETS.population} does not have`,
      ),
    ...[...villageRows].flatMap(([key, rows]) => {
      const pair = populationRows.get(key)?.[0];
      if (!pair) return [];
      return ["male", "female", "total", "house"]
        .map((column) => [column, rows.reduce((sum, row) => sum + row[column], 0)])
        .filter(([column, sum]) => sum !== pair[column])
        .map(
          ([column, sum]) =>
            `${REGISTRY_SHEETS.village} adds up to ${column} ${sum} for ${key}, ` +
            `but ${REGISTRY_SHEETS.population} has ${column} ${pair[column]}`,
        );
    }),
  ];
}

// Why the age rows of a year do not match its population rows (SCHEMA §7), one
// line per problem: rule 13 of SCHEMA §3.8, and no (rcode, tt) twice in either
// sheet, since the home page adds the rows up as they are and would count it
// twice.
function ageMismatches({ population, age }) {
  const rowKey = (row) => `rcode ${row.rcode} tt ${row.tt}`;
  const populationRows = Map.groupBy(population, rowKey);
  const ageRows = Map.groupBy(age, rowKey);
  const repeated = (sheet, byKey) =>
    [...byKey]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]) => `${sheet} has ${rows.length} rows for ${key}`);
  return [
    ...repeated(REGISTRY_SHEETS.population, populationRows),
    ...repeated(REGISTRY_SHEETS.age, ageRows),
    ...[...populationRows.keys()]
      .filter((key) => !ageRows.has(key))
      .map((key) => `${REGISTRY_SHEETS.age} has no row for ${key}, which ${REGISTRY_SHEETS.population} has`),
    ...[...ageRows.keys()]
      .filter((key) => !populationRows.has(key))
      .map((key) => `${REGISTRY_SHEETS.age} has a row for ${key}, which ${REGISTRY_SHEETS.population} does not have`),
    ...age.flatMap((row) => {
      const pair = populationRows.get(rowKey(row))?.[0];
      if (!pair) return [];
      return [
        ["total_m", "male"],
        ["total_f", "female"],
        ["total_t", "total"],
      ]
        .filter(([ageColumn, column]) => row[ageColumn] !== pair[column])
        .map(
          ([ageColumn, column]) =>
            `${REGISTRY_SHEETS.age} has ${ageColumn} ${row[ageColumn]} for ${rowKey(row)}, ` +
            `but ${REGISTRY_SHEETS.population} has ${column} ${pair[column]}`,
        );
    }),
  ];
}

let registry;
try {
  registry = await callGasWithRetry("action=registry_population");
} catch (err) {
  fail(`cannot get the registry population (?action=registry_population): ${err.message}`);
}
const wrongShape = registryProblem(registry);
if (wrongShape) fail(`?action=registry_population ${wrongShape}`);
// The years with population rows, oldest first (SCHEMA §7). reports/population.json
// (PopulationReportData) has every row of each of them, for รายงานประชากร;
// population.json (PopulationSnapshot) has the village and age rows of the
// latest of them only, so the file grows by a year's population rows alone.
const populationYears = registry.years
  .filter((year) => year.population.length > 0)
  .sort((a, b) => (a.yymm < b.yymm ? -1 : 1));
const populationReport = {
  years: populationYears.map((year) => ({
    yymm: year.yymm,
    population: year.population,
    village: year.village,
    age: year.age,
  })),
};
const population = {
  years: populationYears.map((year, i) => ({
    yymm: year.yymm,
    population: year.population,
    village: i === populationYears.length - 1 ? year.village : [],
    age: i === populationYears.length - 1 ? year.age : [],
  })),
};
const latest = population.years.at(-1);
console.log(
  latest
    ? `build-snapshot: ?action=registry_population has population rows for ${population.years.length} years, ` +
        `the latest ${latest.yymm} with ${latest.age.length} age rows and ${latest.village.length} village rows`
    : "build-snapshot: ?action=registry_population has no population rows yet, so the home page shows no population (SPEC §9.2)",
);
// Every year's age and village rows against its population rows, since
// reports/population.json has them all (SCHEMA §7). A year without age rows
// passes: the home page hides the pyramid and รายงานประชากร says so (SCHEMA
// §11.3, §11.5), also while an admin has deleted them to upload again (SCHEMA
// §3.8). So does a year without village rows; they can differ when an upload
// saved the population rows but not the village rows (SCHEMA §3.8).
const registryProblems = populationYears.flatMap((year) => {
  const ageProblems = year.age.length ? ageMismatches(year) : [];
  const villageProblems = year.village.length ? villageMismatches(year) : [];
  return [
    ...(ageProblems.length > 0
      ? [
          `the age rows of ${year.yymm} do not match its population rows:\n  ${ageProblems.join("\n  ")}\n` +
            `Fix those rows in PA-Data, or delete the ${year.yymm} rows of ${REGISTRY_SHEETS.age} and upload both of that year's files again on /sync (SCHEMA §3.8)`,
        ]
      : []),
    ...(villageProblems.length > 0
      ? [
          `the village rows of ${year.yymm} do not match its population rows:\n  ${villageProblems.join("\n  ")}\n` +
            `Upload stat_m${year.yymm.slice(0, 2)}.txt again on /sync, or fix those rows of ${REGISTRY_SHEETS.village} in PA-Data (SCHEMA §3.8)`,
        ]
      : []),
  ];
});
if (registryProblems.length > 0) {
  fail(`${registryProblems.join("\n")}\nSo nothing is written (SCHEMA §7).`);
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
  [
    "catalog.json",
    nest(
      catalog,
      fetched.map((data) => data.report),
    ),
    100 * KB,
  ],
  ...[...answers].map(([id, data]) => [`reports/${id}.json`, data, 500 * KB]),
  ["population.json", population, 100 * KB],
  ["reports/population.json", populationReport, 500 * KB],
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
