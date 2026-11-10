import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { HOSPITALS, TAMBON_MASTER } from "./fixtures/master-sheets-20261030.js";
import { AGE_ROWS_6812, ROWS_6712, ROWS_6812 } from "./fixtures/registry-population-20261106.js";

// FEATURES F14 and F26: build-snapshot.mjs run as a child process, the way npm
// runs prebuild, against a local stub of the GAS web app that answers
// ?action=catalog, ?action=report and ?action=registry_population
// (CODING_STANDARDS §5).

const SCRIPT = path.resolve(import.meta.dirname, "../build-snapshot.mjs");

// Names, tables and hierarchy ids of the seed reports, from the catalog
// export of 30 Oct 2569 (SCHEMA §5.5).
const EXPORTED = ["subset", "seed"].flatMap((name) => {
  const file = new URL(`./fixtures/hdc-catalog-20261030-${name}.json`, import.meta.url);
  return Object.values(JSON.parse(fs.readFileSync(file, "utf8")).reports).flat();
});

const MCH = "1ed90bc32310b503b7ca9b32af425ae5";
const EPI = "4df360514655f79f13901ef1181ca1c7";
const SURVEILLANCE = "bebf866fceaef84c4078965eaf619565";
const SCREENING = "6966b0664b89805a484d7ac96c6edc48";
const NCD = "b2b59e64c4e6c92d4b1ec16a599d882b";
const DENTAL = "db30e434e30565c12fbac44958e338d5";

// SCHEMA §6: the 6 seed topics with their order, each with its seed reports
// as [opendata_id, subgroup, order].
const SEED = [
  [MCH, 10, [
    ["1c1b8e24aff59258a806f122e264031e", "", 10],
    ["bd63b8d99f7054560fcf9c3b96f39c13", "", 20],
    ["1b60d68b1cb5b003fcba38a4a0e4027b", "", 30],
    ["684e99dc7538c8b1a97f19f91a100f08", "", 40],
  ]],
  [EPI, 20, [
    ["c88658f4d09acb8c76e6c06ffb58ebaf", "กลุ่มอายุ 1 ปี", 10],
    ["28dd2c7955ce926456240b2ff0100bde", "กลุ่มอายุ 1 ปี", 11],
    ["71e49e4b61aafee17761601c506d5f85", "กลุ่มอายุ 2 ปี", 20],
    ["35f4a8d465e6e1edc05f3d8ab658c551", "กลุ่มอายุ 2 ปี", 21],
    ["267ce09f2a704eb7783997e25d1f18ba", "กลุ่มอายุ 3 ปี", 30],
    ["d1fe173d08e959397adf34b1d77e88d7", "กลุ่มอายุ 3 ปี", 31],
    ["c47283d3c2c1e6528ddcf88c254f21b3", "กลุ่มอายุ 5 ปี", 50],
    ["f033ab37c30201f73f142449d037028d", "กลุ่มอายุ 5 ปี", 51],
  ]],
  [SURVEILLANCE, 30, [["4164a7c49fcb2b8c3ccca67dcdf28bd0", "", 10]]],
  [SCREENING, 40, [["aa86b13e8cb60cae6c3216b7e3e5f151", "", 10]]],
  [NCD, 50, [
    ["626c89f6b8d9f7ed90c72c719775eb07", "", 10],
    ["9702fa28cd2ec73ecc6af89d14f46874", "", 20],
    ["e9e461e793e8258f47d46d6956f12832", "", 30],
    ["b57439ff27302ade8c38d1dd189644a4", "", 40],
  ]],
  [DENTAL, 60, [
    ["abt2t2k4z4xeqzytwbave", "", 10],
    ["e07a6ff3cd63d34a759be4bff5c1a4c6", "", 20],
    ["1fb6b46f1d1fd42362f97072f4b3b653", "", 30],
  ]],
];
const SEED_IDS = SEED.flatMap(([, , reports]) => reports.map(([id]) => id));

const WINDOW = ["2565", "2566", "2567", "2568", "2569"];

// A DcYearStatus (SCHEMA §9) of 2 rows.
function yearStatus(b_year, max_date_com) {
  return { b_year, row_count: 2, max_date_com, synced_at: "2026-11-02T08:00:00.000Z" };
}

// A DcTopic as ?action=catalog lists it (SCHEMA §3.1).
function topic(catId, order) {
  const exported = EXPORTED.find((r) => r.cat_id === catId);
  return {
    cat_id: catId,
    category_name: exported.category_name,
    main_report_id: exported.main_report_id,
    main_report_name: exported.main_report_name,
    order,
  };
}

// A DcReport as ?action=catalog lists it (SCHEMA §3.1), with data for 2568
// and 2569.
function report(catId, [id, subgroup, order]) {
  const exported = EXPORTED.find((r) => r.cat_id === catId && r.opendata_id === id);
  return {
    opendata_id: id,
    report_name: exported.report_name,
    source_table: exported.source_table,
    cat_id: catId,
    main_report_id: exported.main_report_id,
    subgroup,
    order,
    report_type: "coverage",
    goal: 90,
    col_target: null,
    col_result: null,
    measure_goals: {},
    catalog_status: "active",
    years: [yearStatus("2568", "202609301200"), yearStatus("2569", "202610290900")],
  };
}

// ?action=catalog after F12: the seed in reverse, since GAS lists topics and
// reports in sheet order, unsorted (SCHEMA §3.1).
function seedCatalog() {
  return {
    meta: { current_year: "2569", years: WINDOW, district_code: "5406", generated_at: "2026-11-03T08:00:00.000Z" },
    areas: TAMBON_MASTER.slice(1).map(([id, name_th]) => ({ id, name_th })),
    hospitals: HOSPITALS.slice(1).map(([hospcode, hospname, tambon_id]) => ({ hospcode, hospname, tambon_id })),
    topics: SEED.map(([catId, order]) => topic(catId, order)).reverse(),
    reports: SEED.flatMap(([catId, , reports]) => reports.map((r) => report(catId, r))).reverse(),
  };
}

const HEADERS = ["id", "hospcode", "areacode", "date_com", "b_year", "target", "result"];

// ?action=report's answer for a report of the catalog (SCHEMA §3.2): a
// complete block ปี for each of its years, every row the report's own.
function reportAnswer(report) {
  return {
    report,
    years: report.years.map((y) => ({
      b_year: y.b_year,
      headers: HEADERS,
      rows: Array.from({ length: y.row_count }, (_, i) => [
        report.opendata_id, "06413", `5406010${i + 1}`, y.max_date_com, y.b_year, 10, 8,
      ]),
      max_date_com: y.max_date_com,
      sheet_rows: y.row_count,
      expected_rows: y.row_count,
    })),
  };
}

// GAS answering ?action=catalog with catalog, ?action=report with
// answer(report) for each report of it, and each ?action=registry_population
// with registry(), by default the answer before any upload (SCHEMA §3.9).
function gasOf(catalog, answer = (r) => ({ body: reportAnswer(r) }), registry = () => ({ body: { years: [] } })) {
  return (params) => {
    if (params.action === "catalog") return { body: catalog };
    if (params.action === "registry_population") return registry();
    const r = catalog.reports.find((x) => x.opendata_id === params.id);
    return r ? answer(r) : { body: { status: "error", message: "Unknown report" } };
  };
}

// The stub GAS web app on a local port, closed when test t ends. answer(params)
// is the reply to one GET with those query params: { status = 200, body },
// body JSON-encoded unless it is a string, or "drop" to close the connection
// without a reply. requests: the params of every GET, with the time it came
// in (at), in order.
async function startStub(t, answer) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const params = Object.fromEntries(new URL(req.url, "http://localhost").searchParams);
    requests.push({ ...params, at: Date.now() });
    const reply = answer(params);
    if (reply === "drop") return req.socket.destroy();
    const { status = 200, body } = reply;
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}/exec`, requests };
}

// Every run's working directory, removed at the end.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "build-snapshot-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

// Run build-snapshot.mjs in cwd (a new directory by default), where it writes
// public/data/, with only the given env: none of the caller's own, so no test
// can reach the real GAS. SNAPSHOT_WAIT_SCALE=0 skips the retry waits unless
// a test sets it.
function run(env, cwd = fs.mkdtempSync(path.join(TMP, "run-"))) {
  return new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT], { cwd, env: { SNAPSHOT_WAIT_SCALE: "0", ...env } }, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, stdout, stderr, cwd });
    });
  });
}

// The files a run wrote under cwd/public/data/, sorted, or null if it has no
// such folder; read(file) parses one.
function snapshot(cwd) {
  const dir = path.join(cwd, "public", "data");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir, { recursive: true })
    .filter((f) => fs.statSync(path.join(dir, f)).isFile())
    .sort();
  return { files, read: (file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) };
}

test("catalog and every report answered → meta.json, catalog.json, population.json and one reports/{id}.json per active report; the vaccine topic runs กลุ่มอายุ 1 → 2 → 3 → 5 ปี with s_epi1 before fully immunized", async (t) => {
  const gas = await startStub(t, gasOf(seedCatalog()));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  const snap = snapshot(res.cwd);
  assert.deepEqual(snap.files, ["catalog.json", "meta.json", "population.json", ...SEED_IDS.map((id) => `reports/${id}.json`).sort()]);
  const vaccine = snap.read("catalog.json").mains.flatMap((m) => m.topics).find((tp) => tp.cat_id === EPI);
  assert.deepEqual(
    vaccine.groups.map((g) => [g.subgroup, g.reports.map((r) => `${r.source_table} ${r.opendata_id}`)]),
    [
      ["กลุ่มอายุ 1 ปี", ["s_epi1 c88658f4d09acb8c76e6c06ffb58ebaf", "s_epi_complete 28dd2c7955ce926456240b2ff0100bde"]],
      ["กลุ่มอายุ 2 ปี", ["s_epi2 71e49e4b61aafee17761601c506d5f85", "s_epi_complete 35f4a8d465e6e1edc05f3d8ab658c551"]],
      ["กลุ่มอายุ 3 ปี", ["s_epi3 267ce09f2a704eb7783997e25d1f18ba", "s_epi_complete d1fe173d08e959397adf34b1d77e88d7"]],
      ["กลุ่มอายุ 5 ปี", ["s_epi5 c47283d3c2c1e6528ddcf88c254f21b3", "s_epi_complete f033ab37c30201f73f142449d037028d"]],
    ],
  );
});

test("the seed listed in reverse → catalog.json has its หมวด, หัวข้อ, กลุ่ม and รายงาน in the order of SCHEMA §6", async (t) => {
  const gas = await startStub(t, gasOf(seedCatalog()));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  const outline = snapshot(res.cwd).read("catalog.json").mains.map((m) => [
    m.main_report_name,
    m.topics.map((tp) => [tp.cat_id, tp.groups.map((g) => [g.subgroup, g.reports.map((r) => r.source_table)])]),
  ]);
  assert.deepEqual(outline, [
    ["ส่งเสริมป้องกัน", [
      [MCH, [["", ["s_kpi_anc12", "s_anc5", "s_kpi_childdev4", "s_kpi_childdev2"]]]],
      [EPI, [
        ["กลุ่มอายุ 1 ปี", ["s_epi1", "s_epi_complete"]],
        ["กลุ่มอายุ 2 ปี", ["s_epi2", "s_epi_complete"]],
        ["กลุ่มอายุ 3 ปี", ["s_epi3", "s_epi_complete"]],
        ["กลุ่มอายุ 5 ปี", ["s_epi5", "s_epi_complete"]],
      ]],
      [SURVEILLANCE, [["", ["s_kpi_food"]]]],
      [SCREENING, [["", ["s_aged9"]]]],
    ]],
    ["ข้อมูลตอบสนอง Service Plan", [
      [NCD, [["", ["s_dm_screen", "s_ht_screen", "s_ncd_screen_repleate1", "s_ht_screen_follow"]]]],
      [DENTAL, [["", ["s_dental_0_5_cavity_free", "s_kpi_dental28", "s_kpi_dental33"]]]],
    ]],
  ]);
});

test("meta.json counts the reports and has the latest date_com of any block; reports/{id}.json is GAS's answer; catalog.json keeps GAS's meta, areas, hospitals, topics and reports", async (t) => {
  const catalog = seedCatalog();
  const epi1 = catalog.reports.find((r) => r.source_table === "s_epi1");
  // s_epi1's date_com has seconds (SCHEMA §2.5).
  epi1.years[1].max_date_com = "20261031021530";
  const gas = await startStub(t, gasOf(catalog));

  const before = Date.now();
  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  const snap = snapshot(res.cwd);
  const { built_at, ...meta } = snap.read("meta.json");
  assert.deepEqual(meta, { current_year: "2569", years: WINDOW, report_count: 21, latest_date_com: "20261031021530" });
  assert.match(built_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.ok(Date.parse(built_at) >= before && Date.parse(built_at) <= Date.now(), built_at);
  assert.deepEqual(snap.read(`reports/${epi1.opendata_id}.json`), reportAnswer(epi1));
  const { mains, ...rest } = snap.read("catalog.json");
  assert.deepEqual(rest, { meta: catalog.meta, areas: catalog.areas, hospitals: catalog.hospitals });
  const { groups, ...vaccine } = mains.flatMap((m) => m.topics).find((tp) => tp.cat_id === EPI);
  assert.deepEqual(vaccine, topic(EPI, 20));
  assert.deepEqual(groups[0].reports[0], epi1);
});

test("no NEXT_PUBLIC_GAS_SCRIPT_URL → exit 1 at once, saying to set it, and nothing written", async () => {
  const res = await run({});

  assert.equal(res.code, 1);
  assert.match(res.stderr, /^build-snapshot: set NEXT_PUBLIC_GAS_SCRIPT_URL/);
  assert.equal(snapshot(res.cwd), null);
});

// A directory with the snapshot of an earlier run: meta.json only.
function withOldSnapshot() {
  const cwd = fs.mkdtempSync(path.join(TMP, "run-"));
  fs.mkdirSync(path.join(cwd, "public", "data"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "public", "data", "meta.json"), '{"built_at":"earlier"}');
  return cwd;
}

// The snapshot of withOldSnapshot, untouched.
function assertOldSnapshot(cwd) {
  const snap = snapshot(cwd);
  assert.deepEqual(snap.files, ["meta.json"]);
  assert.deepEqual(snap.read("meta.json"), { built_at: "earlier" });
}

test("a URL that answers every request with an error → exit 1 naming the catalog and the error; an earlier snapshot is left as it was", async (t) => {
  const gas = await startStub(t, () => ({ body: { status: "error", message: "Sheet not allowed" } }));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

  assert.equal(res.code, 1);
  assert.match(res.stderr, /^build-snapshot: cannot get the catalog \(\?action=catalog\): GAS answered: Sheet not allowed/);
  assertOldSnapshot(res.cwd);
});

test("a URL whose answer is JSON but no catalog (another web app) → exit 1 saying to check the URL; nothing written", async (t) => {
  const gas = await startStub(t, () => ({ body: { data: {}, meta: {} } }));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 1);
  assert.match(res.stderr, /^build-snapshot: \?action=catalog answered without meta, topics and reports; check that NEXT_PUBLIC_GAS_SCRIPT_URL/);
  assert.equal(snapshot(res.cwd), null);
});

test("a report answer without report and years → exit 1 saying to check the URL; nothing written", async (t) => {
  const catalog = seedCatalog();
  const odd = catalog.reports.find((r) => r.source_table === "s_aged9");
  const gas = await startStub(t, gasOf(catalog, (r) => ({ body: r === odd ? { status: "success" } : reportAnswer(r) })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 1);
  assert.match(
    res.stderr,
    /^build-snapshot: \?action=report&id=aa86b13e8cb60cae6c3216b7e3e5f151 answered without report and years; check that NEXT_PUBLIC_GAS_SCRIPT_URL/,
  );
  assert.equal(snapshot(res.cwd), null);
});

test("a report whose opendata_id is not an HDC id (../escape) → exit 1 naming it, and no file written for it anywhere", async (t) => {
  const catalog = seedCatalog();
  catalog.reports[0].opendata_id = "../../escape";
  const gas = await startStub(t, gasOf(catalog));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 1);
  assert.match(res.stderr, /^build-snapshot: report "\.\.\/\.\.\/escape" \(s_kpi_dental33\) has an opendata_id/);
  assert.equal(snapshot(res.cwd), null);
  assert.deepEqual(fs.readdirSync(res.cwd), []);
});

test("one report that GAS keeps failing → asked 4 times (3 retries), then exit 1 naming it; an earlier snapshot is left as it was", async (t) => {
  const catalog = seedCatalog();
  const broken = catalog.reports.find((r) => r.source_table === "s_aged9");
  const gas = await startStub(t, gasOf(catalog, (r) => (r === broken ? { status: 500, body: "<html>Error</html>" } : { body: reportAnswer(r) })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

  assert.equal(res.code, 1);
  assert.match(
    res.stderr,
    /^build-snapshot: cannot get report aa86b13e8cb60cae6c3216b7e3e5f151 \(s_aged9\): GAS answered HTTP 500 \(after 3 retries\)/,
  );
  assert.equal(gas.requests.filter((q) => q.id === broken.opendata_id).length, 4);
  assertOldSnapshot(res.cwd);
});

test("a report whose first 3 answers fail (connection dropped, HTTP 500, not JSON) → asked again each time and written, exit 0", async (t) => {
  const catalog = seedCatalog();
  const flaky = catalog.reports.find((r) => r.source_table === "s_aged9");
  const failures = ["drop", { status: 500, body: "<html>Error</html>" }, { body: "<html>Sorry, unable to open the file</html>" }];
  const gas = await startStub(t, gasOf(catalog, (r) => (r === flaky && failures.length > 0 ? failures.shift() : { body: reportAnswer(r) })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  assert.equal(gas.requests.filter((q) => q.id === flaky.opendata_id).length, 4);
  assert.deepEqual(snapshot(res.cwd).read(`reports/${flaky.opendata_id}.json`), reportAnswer(flaky));
});

// GAS answering the seed, the ?action=report answer of the report on table
// first passed to change(answer) to edit.
function seedGasWith(table, change) {
  const catalog = seedCatalog();
  const changed = catalog.reports.find((r) => r.source_table === table);
  return gasOf(catalog, (r) => {
    const answer = reportAnswer(r);
    if (r === changed) change(answer);
    return { body: answer };
  });
}

test("a block ปี whose sheet_rows ≠ expected_rows → exit 1 naming the report, the year and both counts; an earlier snapshot is left as it was", async (t) => {
  const gas = await startStub(t, seedGasWith("s_kpi_dental28", (answer) => {
    answer.years[0].sheet_rows = 1;
  }));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

  assert.equal(res.code, 1);
  assert.match(res.stderr, /\n {2}e07a6ff3cd63d34a759be4bff5c1a4c6 \(s_kpi_dental28\) 2568: sheet_rows 1 ≠ expected_rows 2/);
  assertOldSnapshot(res.cwd);
});

test("a year of report.years without a block ปี in years (its sheet deleted, SCHEMA §3.2) → exit 1 naming the report and the year; an earlier snapshot is left as it was", async (t) => {
  const gas = await startStub(t, seedGasWith("s_ht_screen_follow", (answer) => {
    answer.years = answer.years.filter((block) => block.b_year !== "2568");
  }));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

  assert.equal(res.code, 1);
  assert.match(
    res.stderr,
    /\n {2}b57439ff27302ade8c38d1dd189644a4 \(s_ht_screen_follow\) 2568: sync_status has this year but \?action=report has no block for it/,
  );
  assertOldSnapshot(res.cwd);
});

test("a report with 0 rows in the current year's block ปี (no row has its id) → exit 1 naming it; an earlier snapshot is left as it was", async (t) => {
  const gas = await startStub(t, seedGasWith("s_kpi_food", (answer) => {
    answer.years[1].rows = [];
  }));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

  assert.equal(res.code, 1);
  assert.match(res.stderr, /\n {2}4164a7c49fcb2b8c3ccca67dcdf28bd0 \(s_kpi_food\) 2569: no row of this report in the current year/);
  assertOldSnapshot(res.cwd);
});

test("a report with no years yet, and one with 0 rows in a past year only → both written, exit 0 (only the current year must have rows)", async (t) => {
  const catalog = seedCatalog();
  const unsynced = catalog.reports.find((r) => r.source_table === "s_anc5");
  unsynced.years = [];
  const pastEmpty = catalog.reports.find((r) => r.source_table === "s_kpi_childdev2");
  const gas = await startStub(t, gasOf(catalog, (r) => {
    const answer = reportAnswer(r);
    if (r === pastEmpty) answer.years[0].rows = [];
    return { body: answer };
  }));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  const snap = snapshot(res.cwd);
  assert.deepEqual(snap.read(`reports/${unsynced.opendata_id}.json`), { report: unsynced, years: [] });
  assert.deepEqual(snap.read(`reports/${pastEmpty.opendata_id}.json`).years[0].rows, []);
});

test("no active report with rows in the current year (every report has 2568 only, 2569 not synced yet) → exit 1 saying to sync 2569 first; an earlier snapshot is left as it was", async (t) => {
  const catalog = seedCatalog();
  for (const r of catalog.reports) r.years = r.years.filter((y) => y.b_year !== "2569");
  const gas = await startStub(t, gasOf(catalog));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

  assert.equal(res.code, 1);
  assert.match(res.stderr, /\n {2}no active report has rows in the current year 2569: sync 2569 first/);
  assertOldSnapshot(res.cwd);
});

test("no active report in the catalog → exit 1 saying to tick enabled in hdc_reports; nothing written", async (t) => {
  const gas = await startStub(t, gasOf({ ...seedCatalog(), reports: [] }));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 1);
  assert.match(res.stderr, /^build-snapshot: \?action=catalog lists no active report/);
  assert.equal(snapshot(res.cwd), null);
});

// The waits scaled to 1/200: Busy is asked again after 100 ms, for up to
// 1.5 s, and another failure after 10, 20 and 40 ms.
const SCALED = { SNAPSHOT_WAIT_SCALE: "0.005" };
const BUSY = { body: { status: "error", message: "Busy" } };

test("GAS answers Busy twice for a report, then the report → asked again 100 ms (20 s scaled) after each Busy and written, exit 0", async (t) => {
  const catalog = seedCatalog();
  const locked = catalog.reports.find((r) => r.source_table === "s_dm_screen");
  let busyLeft = 2;
  const gas = await startStub(t, gasOf(catalog, (r) => (r === locked && busyLeft-- > 0 ? BUSY : { body: reportAnswer(r) })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url, ...SCALED });

  assert.equal(res.code, 0, res.stderr);
  const asked = gas.requests.filter((q) => q.id === locked.opendata_id).map((q) => q.at);
  assert.equal(asked.length, 3);
  // At least the wait apart, less a few ms for the timer's clock.
  const gaps = asked.slice(1).map((at, i) => at - asked[i]);
  assert.ok(gaps.every((ms) => ms >= 95), `asked ${gaps.join(", ")} ms apart`);
  assert.deepEqual(snapshot(res.cwd).read(`reports/${locked.opendata_id}.json`), reportAnswer(locked));
});

test("GAS answers Busy to everything → asked again for 1.5 s (5 min scaled), then exit 1 saying another run holds the script lock; nothing written", async (t) => {
  const gas = await startStub(t, () => BUSY);

  const started = Date.now();
  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url, ...SCALED });
  const ran = Date.now() - started;

  assert.equal(res.code, 1);
  assert.match(
    res.stderr,
    /^build-snapshot: cannot get the catalog \(\?action=catalog\): GAS still answers Busy after 1\.5 s: another run holds the script lock/,
  );
  // It stops asking once less than one wait (100 ms) is left before the limit,
  // so the run takes at least 1.4 s by its own clock; load only makes it
  // longer. 3 retries of another failure would be over within 70 ms.
  assert.ok(gas.requests.length > 1, `asked ${gas.requests.length} time(s)`);
  assert.ok(ran >= 1400, `ran for ${ran} ms`);
  assert.equal(snapshot(res.cwd), null);
});

// A DcReport of the MCH topic with data for 2569 only, fields overriding
// any of that.
function fakeReport(fields) {
  return {
    ...report(MCH, ["1c1b8e24aff59258a806f122e264031e", "", 10]),
    years: [yearStatus("2569", "202610290900")],
    ...fields,
  };
}

// A DcTopic of หมวด main ([main_report_id, main_report_name]).
function fakeTopic(catId, [mainId, mainName], name, order) {
  return { cat_id: catId, category_name: name, main_report_id: mainId, main_report_name: mainName, order };
}

test("หัวข้อ by order then Thai name, an empty order last; หมวด by their smallest topic order then name; topics and หมวด without an active report left out", async (t) => {
  const plan = ["main-plan", "ข้อมูลตอบสนอง Service Plan"];
  const thai = ["main-thai", "การแพทย์แผนไทย"];
  const prevention = ["main-prevention", "ส่งเสริมป้องกัน"];
  const other = ["main-other", "ข้อมูลอื่น"];
  const unused = ["main-unused", "ก่อนทุกหมวด"];
  const topics = [
    fakeTopic("topic-care", plan, "ความครอบคลุม", 10),
    fakeTopic("topic-zone", plan, "เขตสุขภาพ", 10),
    fakeTopic("topic-screen", plan, "การคัดกรอง", null),
    fakeTopic("topic-mother", prevention, "แม่และเด็ก", 20),
    fakeTopic("topic-dental", prevention, "ทันตกรรม", 5),
    fakeTopic("topic-herbs", thai, "สมุนไพร", 20),
    fakeTopic("topic-misc", other, "อื่น ๆ", null),
    fakeTopic("topic-food", unused, "โภชนาการ", 1),
  ];
  // One report in each topic but topic-dental and topic-food.
  const reports = ["topic-care", "topic-zone", "topic-screen", "topic-mother", "topic-herbs", "topic-misc"].map((catId) =>
    fakeReport({ opendata_id: `report-${catId}`, cat_id: catId }),
  );
  const gas = await startStub(t, gasOf({ ...seedCatalog(), topics, reports }));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  const outline = snapshot(res.cwd).read("catalog.json").mains.map((m) => [m.main_report_id, m.topics.map((tp) => tp.cat_id)]);
  assert.deepEqual(outline, [
    ["main-plan", ["topic-zone", "topic-care", "topic-screen"]],
    ["main-thai", ["topic-herbs"]],
    ["main-prevention", ["topic-mother"]],
    ["main-other", ["topic-misc"]],
  ]);
});

test("กลุ่ม by the smallest order of their reports then name, the reports without a group last; รายงาน by order then Thai name, an empty order last", async (t) => {
  const reports = [
    ["report-a", "กลุ่ม ก", 30, "ก"],
    ["report-b", "กลุ่ม ข", 25, "ก"],
    ["report-c", "กลุ่ม ข", 20, "ความครอบคลุม"],
    ["report-d", "กลุ่ม ข", 20, "เขตสุขภาพ"],
    ["report-e", "กลุ่ม ข", null, "การคัดกรอง"],
    ["report-f", "", 1, "ก"],
    ["report-g", "กลุ่ม ค", null, "ก"],
    ["report-h", "กลุ่ม ง", 20, "ก"],
  ].map(([id, subgroup, order, name]) => fakeReport({ opendata_id: id, subgroup, order, report_name: name }));
  const gas = await startStub(t, gasOf({ ...seedCatalog(), reports }));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  const [{ topics: [mch] }] = snapshot(res.cwd).read("catalog.json").mains;
  assert.deepEqual(mch.groups.map((g) => [g.subgroup, g.reports.map((r) => r.opendata_id)]), [
    ["กลุ่ม ข", ["report-d", "report-c", "report-b", "report-e"]],
    ["กลุ่ม ง", ["report-h"]],
    ["กลุ่ม ก", ["report-a"]],
    ["กลุ่ม ค", ["report-g"]],
    ["", ["report-f"]],
  ]);
});

// The seed, with a cell of bytes ASCII characters in s_aged9's 2569 block,
// so its reports/{id}.json is just over that size.
function seedGasWithBulkyAged9(bytes) {
  return seedGasWith("s_aged9", (answer) => {
    answer.years[1].rows[0][1] = "x".repeat(bytes);
  });
}
const AGED9_FILE = "reports/aa86b13e8cb60cae6c3216b7e3e5f151.json";

test("a reports/{id}.json over its 500 KB limit (SPEC §6.1) → exit 1 naming the file and its size; an earlier snapshot is left as it was", async (t) => {
  const gas = await startStub(t, seedGasWithBulkyAged9(520 * 1024));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

  assert.equal(res.code, 1);
  assert.match(res.stderr, /\n {2}reports\/aa86b13e8cb60cae6c3216b7e3e5f151\.json is 521\.\d KB, over its 500 KB limit/);
  assertOldSnapshot(res.cwd);
});

test("a reports/{id}.json at 88% of its limit → written with one warning naming it, exit 0; the last line names it as the largest file", async (t) => {
  const gas = await startStub(t, seedGasWithBulkyAged9(440 * 1024));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  assert.ok(snapshot(res.cwd).files.includes(AGED9_FILE));
  const warnings = res.stderr.split("\n").filter((line) => line.includes("warning"));
  assert.equal(warnings.length, 1, res.stderr);
  assert.match(
    warnings[0],
    /^build-snapshot: warning: reports\/aa86b13e8cb60cae6c3216b7e3e5f151\.json is 441\.\d KB, 88% of its 500 KB limit \(SPEC §6\.1\)$/,
  );
  assert.match(
    res.stdout.trimEnd().split("\n").at(-1),
    /^build-snapshot: wrote 21 reports to public\/data in \d+\.\d s; the largest file is reports\/aa86b13e8cb60cae6c3216b7e3e5f151\.json, 441\.\d KB$/,
  );
});

test("an earlier snapshot with the file of a report no longer active → replaced as a whole, that file gone", async (t) => {
  const cwd = withOldSnapshot();
  fs.mkdirSync(path.join(cwd, "public", "data", "reports"));
  fs.writeFileSync(path.join(cwd, "public", "data", "reports", "0123456789abcdef0123456789abcdef.json"), "{}");
  const gas = await startStub(t, gasOf(seedCatalog()));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, cwd);

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(snapshot(cwd).files, ["catalog.json", "meta.json", "population.json", ...SEED_IDS.map((id) => `reports/${id}.json`).sort()]);
});

// The counts of a registry_population_age row (SCHEMA §2.7): m0, f0 … m101,
// f101, then each group the age file does not count by age, as _m, _f, _t.
const AGE_COUNTS = [
  ...Array.from({ length: 102 }, (_, age) => [`m${age}`, `f${age}`]).flat(),
  ...["lunar", "central", "nonthai", "moving", "total"].flatMap((group) => [`${group}_m`, `${group}_f`, `${group}_t`]),
];

// The registry_population_age row of a ตำบล's population row, with every
// column as GAS answers it (SCHEMA §3.9): all its people aged 40.
function ageRow(row) {
  return {
    yymm: row.yymm,
    rcode: row.rcode,
    tt: row.tt,
    tt_name: row.tt_name,
    ...Object.fromEntries(AGE_COUNTS.map((column) => [column, 0])),
    m40: row.male,
    f40: row.female,
    total_m: row.male,
    total_f: row.female,
    total_t: row.total,
  };
}

// GAS answering the seed, and each ?action=registry_population with registry().
const seedGasWithRegistry = (registry) => gasOf(seedCatalog(), undefined, registry);

test("registry_population of 2567 and 2568, both with age rows → population.json has both years' population rows as GAS sent them, and the age rows of 2568 only (SCHEMA §7)", async (t) => {
  const answer = {
    years: [
      { yymm: "6712", population: ROWS_6712, age: ROWS_6712.map(ageRow) },
      { yymm: "6812", population: ROWS_6812, age: ROWS_6812.map(ageRow) },
    ],
  };
  const gas = await startStub(t, seedGasWithRegistry(() => ({ body: answer })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(snapshot(res.cwd).read("population.json"), {
    years: [
      { yymm: "6712", population: ROWS_6712, age: [] },
      { yymm: "6812", population: ROWS_6812, age: ROWS_6812.map(ageRow) },
    ],
  });
});

test("2568 with population rows but no age rows yet, 2567 with both → age [] in both years: the age rows are the latest year's or none", async (t) => {
  const answer = {
    years: [
      { yymm: "6712", population: ROWS_6712, age: ROWS_6712.map(ageRow) },
      { yymm: "6812", population: ROWS_6812, age: [] },
    ],
  };
  const gas = await startStub(t, seedGasWithRegistry(() => ({ body: answer })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(snapshot(res.cwd).read("population.json"), {
    years: [
      { yymm: "6712", population: ROWS_6712, age: [] },
      { yymm: "6812", population: ROWS_6812, age: [] },
    ],
  });
});

test("6812's population rows deleted by hand, its age rows left → 6812 is no year of population.json, and 2567, now the latest year with population rows, keeps its age rows", async (t) => {
  const answer = {
    years: [
      { yymm: "6712", population: ROWS_6712, age: ROWS_6712.map(ageRow) },
      { yymm: "6812", population: [], age: ROWS_6812.map(ageRow) },
    ],
  };
  const gas = await startStub(t, seedGasWithRegistry(() => ({ body: answer })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(snapshot(res.cwd).read("population.json"), {
    years: [{ yymm: "6712", population: ROWS_6712, age: ROWS_6712.map(ageRow) }],
  });
});

test("no registry sheet yet (years: []) → population.json is { years: [] } and the build goes on, exit 0", async (t) => {
  const gas = await startStub(t, seedGasWithRegistry(() => ({ body: { years: [] } })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(snapshot(res.cwd).read("population.json"), { years: [] });
  assert.match(res.stdout, /\nbuild-snapshot: \?action=registry_population has no population rows yet/);
});

test("GAS answers Busy twice to registry_population, then its rows → asked again after each Busy and written, exit 0", async (t) => {
  let busyLeft = 2;
  const answer = { years: [{ yymm: "6812", population: ROWS_6812, age: [] }] };
  const gas = await startStub(t, seedGasWithRegistry(() => (busyLeft-- > 0 ? BUSY : { body: answer })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url, ...SCALED });

  assert.equal(res.code, 0, res.stderr);
  assert.equal(gas.requests.filter((q) => q.action === "registry_population").length, 3);
  assert.deepEqual(snapshot(res.cwd).read("population.json"), answer);
});

test("registry_population answered with an error every time → asked 4 times (3 retries), then exit 1 naming it; an earlier snapshot is left as it was", async (t) => {
  const gas = await startStub(t, seedGasWithRegistry(() => ({ body: { status: "error", message: "Exception: Service Spreadsheets timed out" } })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

  assert.equal(res.code, 1);
  assert.match(
    res.stderr,
    /^build-snapshot: cannot get the registry population \(\?action=registry_population\): GAS answered: Exception: Service Spreadsheets timed out \(after 3 retries\)/,
  );
  assert.equal(gas.requests.filter((q) => q.action === "registry_population").length, 4);
  assertOldSnapshot(res.cwd);
});

test("a population.json over its 100 KB limit (SPEC §6.1) → exit 1 naming it and its size; an earlier snapshot is left as it was", async (t) => {
  // One cell of 110 KB: rows are copied as GAS sends them.
  const bulky = [{ ...ROWS_6812[0], cc_name: "x".repeat(110 * 1024) }, ...ROWS_6812.slice(1)];
  const gas = await startStub(t, seedGasWithRegistry(() => ({ body: { years: [{ yymm: "6812", population: bulky, age: [] }] } })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

  assert.equal(res.code, 1);
  assert.match(res.stderr, /\n {2}population\.json is 112\.\d KB, over its 100 KB limit/);
  assertOldSnapshot(res.cwd);
});

test("a registry_population answer of the wrong shape (SCHEMA §7) → exit 1 naming what is wrong; an earlier snapshot is left as it was", async (t) => {
  const year = (fields) => ({ yymm: "6812", population: ROWS_6812, age: ROWS_6812.map(ageRow), ...fields });
  // A row without one column: GAS leaves out a column the sheet lacks and a
  // count that is blank or no number (SCHEMA §3.9).
  const without = (row, column) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== column));
  const cases = [
    ["no years (another web app)", { status: "success" }, /^build-snapshot: \?action=registry_population answered without years; check that NEXT_PUBLIC_GAS_SCRIPT_URL/],
    ["a yymm not of December", { years: [year({ yymm: "6811" })] }, /^build-snapshot: \?action=registry_population answered a year with yymm "6811"/],
    [
      "a year with a blank yymm, from a row whose yymm cell was cleared (SCHEMA §3.9)",
      { years: [year({ yymm: "", population: ROWS_6812.slice(0, 1), age: [] }), year()] },
      /^build-snapshot: \?action=registry_population answered a year with yymm "", not the figures at 31 Dec \(YY12\); fix the yymm column of registry_population and registry_population_age in PA-Data/,
    ],
    ["the same yymm twice", { years: [year(), year()] }, /^build-snapshot: \?action=registry_population answered yymm 6812 twice/],
    ["age rows that are not a list", { years: [year({ age: {} })] }, /^build-snapshot: \?action=registry_population answered 6812 without a list of age rows/],
    [
      "a population row without house",
      { years: [year({ population: ROWS_6812.map((row, i) => (i === 3 ? without(row, "house") : row)) })] },
      /^build-snapshot: \?action=registry_population answered row 4 of 6812 in registry_population without house/,
    ],
    [
      "an age row without f101",
      { years: [year({ age: ROWS_6812.map((row, i) => (i === 0 ? without(ageRow(row), "f101") : ageRow(row))) })] },
      /^build-snapshot: \?action=registry_population answered row 1 of 6812 in registry_population_age without f101/,
    ],
  ];
  for (const [name, answer, message] of cases) {
    await t.test(name, async (t) => {
      const gas = await startStub(t, seedGasWithRegistry(() => ({ body: answer })));

      const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

      assert.equal(res.code, 1);
      assert.match(res.stderr, message);
      assertOldSnapshot(res.cwd);
    });
  }
});

test("age rows of the year the home page shows that do not match its population rows (SCHEMA §7) → exit 1 naming the year, the sheet and the row; an earlier snapshot is left as it was", async (t) => {
  // The real age rows with the row of 54060400 changed.
  const withAgeRow3 = (fields) => AGE_ROWS_6812.map((row, i) => (i === 3 ? { ...row, ...fields } : row));
  const cases = [
    ["a ตำบล without its age row", { age: AGE_ROWS_6812.slice(1) }, /\n {2}registry_population_age has no row for rcode 5406 tt 54060100, which registry_population has/],
    [
      "an age row of a ตำบล without population rows",
      // ตำบลห้วยหม้าย is in สำนักทะเบียน 5406 only.
      { age: [...AGE_ROWS_6812, { ...AGE_ROWS_6812[2], rcode: "5489" }] },
      /\n {2}registry_population_age has a row for rcode 5489 tt 54060300, which registry_population does not have/,
    ],
    [
      "the same (rcode, tt) twice in the population rows, its age row once",
      { population: [...ROWS_6812, ROWS_6812[9]] },
      /\n {2}registry_population has 2 rows for rcode 5489 tt 54060200/,
    ],
    [
      "the same (rcode, tt) twice in the age rows, its population row once",
      { age: [...AGE_ROWS_6812, AGE_ROWS_6812[9]] },
      /\n {2}registry_population_age has 2 rows for rcode 5489 tt 54060200/,
    ],
    [
      "total_t 7993 against total 7992",
      { age: withAgeRow3({ total_t: 7993 }) },
      /\n {2}registry_population_age has total_t 7993 for rcode 5406 tt 54060400, but registry_population has total 7992/,
    ],
    [
      "total_m 3904 against male 3903",
      { age: withAgeRow3({ total_m: 3904 }) },
      /\n {2}registry_population_age has total_m 3904 for rcode 5406 tt 54060400, but registry_population has male 3903/,
    ],
    [
      "total_f 4090 against female 4089",
      { age: withAgeRow3({ total_f: 4090 }) },
      /\n {2}registry_population_age has total_f 4090 for rcode 5406 tt 54060400, but registry_population has female 4089/,
    ],
  ];
  for (const [name, fields, line] of cases) {
    await t.test(name, async (t) => {
      const answer = { years: [{ yymm: "6812", population: ROWS_6812, age: AGE_ROWS_6812, ...fields }] };
      const gas = await startStub(t, seedGasWithRegistry(() => ({ body: answer })));

      const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url }, withOldSnapshot());

      assert.equal(res.code, 1);
      assert.match(res.stderr, /^build-snapshot: the age rows of 6812, the year the home page shows, do not match its population rows/m);
      assert.match(res.stderr, line);
      assert.match(res.stderr, /\nFix those rows in PA-Data, or delete the 6812 rows of registry_population_age and upload both of that year's files again on \/sync \(SCHEMA §3\.8\)/);
      assertOldSnapshot(res.cwd);
    });
  }
});

test("the real rows of 6812: 10 population rows and 10 age rows, 54060100 and 54060200 under both สำนักทะเบียน → they match, written as GAS sent them, exit 0", async (t) => {
  const answer = { years: [{ yymm: "6812", population: ROWS_6812, age: AGE_ROWS_6812 }] };
  const gas = await startStub(t, seedGasWithRegistry(() => ({ body: answer })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(snapshot(res.cwd).read("population.json"), answer);
});

test("age rows that do not match in a year before the one the home page shows → not checked, its age [] as ever, exit 0", async (t) => {
  const answer = {
    years: [
      { yymm: "6712", population: ROWS_6712, age: ROWS_6712.slice(1).map(ageRow) },
      { yymm: "6812", population: ROWS_6812, age: AGE_ROWS_6812 },
    ],
  };
  const gas = await startStub(t, seedGasWithRegistry(() => ({ body: answer })));

  const res = await run({ NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(snapshot(res.cwd).read("population.json"), {
    years: [
      { yymm: "6712", population: ROWS_6712, age: [] },
      { yymm: "6812", population: ROWS_6812, age: AGE_ROWS_6812 },
    ],
  });
});
