import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { loadGas } from "./gas-harness.js";

// FEATURES F10: hdc-catalog.js run as a child process, the way the admin
// runs it. refresh talks to a local HTTP server that hands each request to
// the real GAS doGet/doPost in the harness (CODING_STANDARDS §5).

const SCRIPT = path.resolve(import.meta.dirname, "../hdc-catalog.js");

const SETTINGS = [
  ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
  [4, 2569, 54, 5406, ""],
];

// Real catalog API responses from the catalog export of 30 Oct 2569
// (SCHEMA §5.5), one file with 7 topics: the vaccine topic (46 rows, 34
// unique opendata_id) and งานโภชนาการ in full, and only the seed reports
// (SCHEMA §6) of the other 5 seed topics.
const SUBSET = JSON.parse(fs.readFileSync(new URL("./fixtures/hdc-catalog-20261030-subset.json", import.meta.url)));
const SEED = JSON.parse(fs.readFileSync(new URL("./fixtures/hdc-catalog-20261030-seed.json", import.meta.url)));
const EXPORT = {
  ...SUBSET,
  categories: [...SUBSET.categories, ...SEED.categories],
  reports: { ...SUBSET.reports, ...SEED.reports },
};

// The 6 seed topics and 21 seed reports of SCHEMA §6.
const MCH = "1ed90bc32310b503b7ca9b32af425ae5";
const EPI = "4df360514655f79f13901ef1181ca1c7";
const SURVEILLANCE = "bebf866fceaef84c4078965eaf619565";
const SCREENING = "6966b0664b89805a484d7ac96c6edc48";
const NCD = "b2b59e64c4e6c92d4b1ec16a599d882b";
const DENTAL = "db30e434e30565c12fbac44958e338d5";
const NUTRITION = "46522b5bd1e06d24a5bd81917257a93c"; // งานโภชนาการ, not a seed topic
const TOPIC_NAMES = {
  [MCH]: "อนามัยแม่และเด็ก",
  [EPI]: "การสร้างเสริมภูมิคุ้มกันโรค",
  [SURVEILLANCE]: "การเฝ้าระวังด้านส่งเสริมสุขภาพและอนามัยสิ่งแวดล้อม",
  [SCREENING]: "การคัดกรอง",
  [NCD]: "ข้อมูลเพื่อตอบสนอง Service Plan สาขาโรคไม่ติดต่อ (NCD DM,HT,CVD)",
  [DENTAL]: "ข้อมูลเพื่อตอบสนอง Service Plan สาขาสุขภาพช่องปาก",
};
// [source_table, cat_id, opendata_id]
const SEED_REPORTS = [
  ["s_kpi_anc12", MCH, "1c1b8e24aff59258a806f122e264031e"],
  ["s_anc5", MCH, "bd63b8d99f7054560fcf9c3b96f39c13"],
  ["s_kpi_childdev4", MCH, "1b60d68b1cb5b003fcba38a4a0e4027b"],
  ["s_kpi_childdev2", MCH, "684e99dc7538c8b1a97f19f91a100f08"],
  ["s_kpi_food", SURVEILLANCE, "4164a7c49fcb2b8c3ccca67dcdf28bd0"],
  ["s_aged9", SCREENING, "aa86b13e8cb60cae6c3216b7e3e5f151"],
  ["s_dm_screen", NCD, "626c89f6b8d9f7ed90c72c719775eb07"],
  ["s_ht_screen", NCD, "9702fa28cd2ec73ecc6af89d14f46874"],
  ["s_ncd_screen_repleate1", NCD, "e9e461e793e8258f47d46d6956f12832"],
  ["s_ht_screen_follow", NCD, "b57439ff27302ade8c38d1dd189644a4"],
  ["s_dental_0_5_cavity_free", DENTAL, "abt2t2k4z4xeqzytwbave"],
  ["s_kpi_dental28", DENTAL, "e07a6ff3cd63d34a759be4bff5c1a4c6"],
  ["s_kpi_dental33", DENTAL, "1fb6b46f1d1fd42362f97072f4b3b653"],
  ["s_epi1", EPI, "c88658f4d09acb8c76e6c06ffb58ebaf"],
  ["s_epi_complete", EPI, "28dd2c7955ce926456240b2ff0100bde"],
  ["s_epi2", EPI, "71e49e4b61aafee17761601c506d5f85"],
  ["s_epi_complete", EPI, "35f4a8d465e6e1edc05f3d8ab658c551"],
  ["s_epi3", EPI, "267ce09f2a704eb7783997e25d1f18ba"],
  ["s_epi_complete", EPI, "d1fe173d08e959397adf34b1d77e88d7"],
  ["s_epi5", EPI, "c47283d3c2c1e6528ddcf88c254f21b3"],
  ["s_epi_complete", EPI, "f033ab37c30201f73f142449d037028d"],
];

// EXPORT as if the snippet had failed to get one topic (SCHEMA §5.5).
function exportWithError(catId, status) {
  return {
    ...EXPORT,
    reports: Object.fromEntries(Object.entries(EXPORT.reports).filter(([key]) => key !== catId)),
    errors: [{ cat_id: catId, status }],
  };
}

// A catalog export file in a new temp directory.
function writeExport(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hdc-catalog-"));
  const file = path.join(dir, "hdc-catalog-20261030.json");
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
}

// Run hdc-catalog.js with only the given env (none of the caller's own,
// so NEXT_PUBLIC_GAS_SCRIPT_URL is unset unless a test sets it).
function run(args, env = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env }, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, stdout, stderr });
    });
  });
}

// find's output: a tab-separated table with a header row, as objects.
function findRows(stdout) {
  const [header, ...rows] = stdout.trimEnd().split("\n").map((line) => line.split("\t"));
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

// GAS with PA-Data as the admin leaves it before a refresh (SPEC §13 steps
// 2–3): setup=datacenter, then each [cat_id, order] typed into hdc_topics.
function gasWithTopics(topics) {
  const h = loadGas({ sheets: { settings: SETTINGS } });
  h.gas.doGet({ parameter: { action: "diag", pin: vm.runInContext("CONFIG.DIAG_PIN", h.gas), setup: "datacenter" } });
  const sheet = h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName("hdc_topics");
  topics.forEach((topic, i) => sheet.getRange(i + 2, 1, 1, 2).setValues([topic]));
  return h;
}

// The GAS web app on a local port, closed when the test ends. posts: the
// body of every POST, parsed, in order.
async function startGas(t, h) {
  const posts = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let out;
    if (req.method === "POST") {
      const contents = Buffer.concat(chunks).toString("utf8");
      posts.push(JSON.parse(contents));
      out = h.gas.doPost({ postData: { contents } });
    } else {
      const query = new URL(req.url, "http://localhost").searchParams;
      out = h.gas.doGet({ parameter: Object.fromEntries(query) });
    }
    res.setHeader("content-type", "application/json");
    res.end(out.getContent());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}/exec`, posts };
}

// A sheet's data rows as objects keyed by its header row.
function records(values) {
  const [header, ...rows] = values;
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

// refresh's summary lines, one per topic it saved.
function savedLines(stdout) {
  return stdout.split("\n").filter((line) => /added \d+, updated \d+, removed \d+, skipped \d+/.test(line));
}

test("find with the 18 seed tables, no env → each table's topic and report as in SCHEMA §6, with their names", async () => {
  const tables = [...new Set(SEED_REPORTS.map(([table]) => table))];

  const res = await run(["find", "--from", writeExport(EXPORT), ...tables]);

  assert.equal(res.code, 0, res.stderr);
  const rows = findRows(res.stdout);
  for (const [table, catId, opendataId] of SEED_REPORTS) {
    const row = rows.find((r) => r.source_table === table && r.opendata_id === opendataId);
    assert.ok(row, `${table} ${opendataId}`);
    assert.equal(row.cat_id, catId);
    assert.equal(row.category_name, TOPIC_NAMES[catId]);
    assert.notEqual(row.report_name, "");
  }
});

test("find on a table the vaccine topic lists twice (s_epi7) → one line for its one report", async () => {
  const res = await run(["find", "--from", writeExport(EXPORT), "s_epi7"]);

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(
    findRows(res.stdout).map((r) => [r.cat_id, r.opendata_id]),
    [[EPI, "30f72fc853a2cc02ef953dc97f36f596"]],
  );
});

test("find prints names as save_catalog writes them: no <font> tags, tabs, line breaks or repeated spaces; a bare < stays", async () => {
  const [base] = EXPORT.reports[EPI];
  // A real report_name of the การคัดกรอง topic (SCHEMA §5.2), with a tab,
  // repeated spaces and a newline added.
  const dirty = {
    ...base,
    source_table: "s_dirty_names",
    opendata_id: "aaaaaaaabbbbbbbbccccccccdddddddd",
    report_name:
      "  ผู้สูงอายุที่ผิดปกติได้รับการจัดทำ Care Plan\tและให้โปรแกรมส่งเสริมสุขภาพ<font color=red> (Intervension  STEP3 BigRock4)</font>\n",
    category_name: "การสร้างเสริมภูมิคุ้มกันโรค ",
  };
  // A real report name with a < that is not a tag (SCHEMA §5.2 export).
  const ldl = {
    ...base,
    source_table: "s_dirty_names",
    opendata_id: "aaaaaaaabbbbbbbbcccccccceeeeeeee",
    report_name: "อัตราผู้ป่วยเบาหวานที่ได้รับการตรวจไขมัน LDL และมีค่า LDL < 100 mg/dl",
  };
  const file = writeExport({ ...EXPORT, reports: { ...EXPORT.reports, [EPI]: [dirty, ldl, ...EXPORT.reports[EPI]] } });

  const res = await run(["find", "--from", file, "s_dirty_names"]);

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(
    findRows(res.stdout).map((r) => [r.category_name, r.report_name]),
    [
      [
        "การสร้างเสริมภูมิคุ้มกันโรค",
        "ผู้สูงอายุที่ผิดปกติได้รับการจัดทำ Care Plan และให้โปรแกรมส่งเสริมสุขภาพ (Intervension STEP3 BigRock4)",
      ],
      ["การสร้างเสริมภูมิคุ้มกันโรค", "อัตราผู้ป่วยเบาหวานที่ได้รับการตรวจไขมัน LDL และมีค่า LDL < 100 mg/dl"],
    ],
  );
});

test("find on a table in no topic → the tables found still print, then exit 1 naming the table and the topic the export failed to get", async () => {
  const file = writeExport(exportWithError(NUTRITION, 429));

  const res = await run(["find", "--from", file, "s_epi7", "s_no_such_table"]);

  assert.equal(res.code, 1);
  assert.deepEqual(findRows(res.stdout).map((r) => r.source_table), ["s_epi7"]);
  assert.match(res.stderr, /s_no_such_table/);
  assert.match(res.stderr, new RegExp(NUTRITION));
});

test("refresh without NEXT_PUBLIC_GAS_SCRIPT_URL → exit 1 with a message naming it", async () => {
  const res = await run(["refresh", "--from", writeExport(EXPORT)]);

  assert.equal(res.code, 1);
  assert.match(res.stderr, /NEXT_PUBLIC_GAS_SCRIPT_URL/);
});

test("refresh with the 6 seed topics in hdc_topics → save_catalog per topic, top row first, a summary per topic, report_count filled (vaccine topic 34)", async (t) => {
  // Rows in neither the export's order nor by `order`: refresh goes top to
  // bottom, as the first topic to save a report keeps it (SPEC §5.3).
  const topics = [[DENTAL, 60], [MCH, 10], [EPI, 20], [NCD, 50], [SURVEILLANCE, 30], [SCREENING, 40]];
  const h = gasWithTopics(topics);
  const gas = await startGas(t, h);

  const res = await run(["refresh", "--from", writeExport(EXPORT)], { NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(gas.posts.map((p) => p.cat_id), topics.map(([catId]) => catId));
  // The topic's rows as the export has them, duplicates included (SCHEMA §5.5).
  assert.deepEqual(gas.posts[2], {
    action: "save_catalog",
    cat_id: EPI,
    category_name: TOPIC_NAMES[EPI],
    reports: EXPORT.reports[EPI],
  });
  const lines = savedLines(res.stdout);
  assert.equal(lines.length, 6, res.stdout);
  assert.match(lines[2], new RegExp(`${EPI}.*added 34, updated 0, removed 0, skipped 0`));
  const saved = records(h.sheet("hdc_topics"));
  assert.ok(saved.every((topic) => topic.report_count > 0));
  // SCHEMA §6: 46 rows, 34 reports.
  assert.equal(saved.find((topic) => topic.cat_id === EPI).report_count, 34);
});

test("refresh: a topic the export failed to get, has no key for, or has an empty list for → not sent, with a message; the others are saved; exit 1", async (t) => {
  // A cat_id typed into hdc_topics that the export does not have.
  const UNKNOWN = "0123456789abcdef0123456789abcdef";
  const h = gasWithTopics([[EPI, 20], [NUTRITION, 70], [UNKNOWN, 80], [DENTAL, 60], [MCH, 10]]);
  const gas = await startGas(t, h);
  const exported = exportWithError(NUTRITION, 429);
  exported.reports[DENTAL] = [];

  const res = await run(["refresh", "--from", writeExport(exported)], { NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 1);
  assert.deepEqual(gas.posts.map((p) => p.cat_id), [EPI, MCH]);
  assert.equal(savedLines(res.stdout).length, 2, res.stdout);
  assert.match(res.stderr, new RegExp(`${NUTRITION}.*429`));
  assert.match(res.stderr, new RegExp(UNKNOWN));
  assert.match(res.stderr, new RegExp(DENTAL));
});

test("refresh from a file without exported_at, or not JSON → exit 1 saying it is not a catalog export, nothing sent", async (t) => {
  const h = gasWithTopics([[EPI, 20]]);
  const gas = await startGas(t, h);
  const env = { NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url };
  const noExportedAt = writeExport({ ...EXPORT, exported_at: undefined });
  const notJson = writeExport(EXPORT).replace(/\.json$/, ".txt");
  fs.writeFileSync(notJson, "hdc-catalog-20261030.json was here");

  for (const file of [noExportedAt, notJson]) {
    const res = await run(["refresh", "--from", file], env);

    assert.equal(res.code, 1, file);
    assert.match(res.stderr, /not a catalog export/, file);
  }
  assert.deepEqual(gas.posts, []);
});

test("refresh --cat <cat_id> → only that topic is saved; a cat_id not in hdc_topics → exit 1, nothing sent", async (t) => {
  const h = gasWithTopics([[MCH, 10], [EPI, 20], [DENTAL, 60]]);
  const gas = await startGas(t, h);
  const env = { NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url };
  const file = writeExport(EXPORT);

  const one = await run(["refresh", "--from", file, "--cat", EPI], env);

  assert.equal(one.code, 0, one.stderr);
  assert.deepEqual(gas.posts.map((p) => p.cat_id), [EPI]);

  const notInTopics = await run(["refresh", "--from", file, "--cat", NUTRITION], env);

  assert.equal(notInTopics.code, 1);
  assert.match(notInTopics.stderr, new RegExp(`${NUTRITION}.*hdc_topics`));
  assert.equal(gas.posts.length, 1);
});

test("refresh before any topic is typed into hdc_topics → exit 1 saying so, nothing sent", async (t) => {
  const gas = await startGas(t, gasWithTopics([]));

  const res = await run(["refresh", "--from", writeExport(EXPORT)], { NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 1);
  assert.match(res.stderr, /hdc_topics/);
  assert.deepEqual(gas.posts, []);
});

test("refresh when GAS gives no topic list (busy, unreachable, not JSON) → exit 1 with the reason and no stack trace, nothing sent", async (t) => {
  const h = gasWithTopics([[EPI, 20]]);
  const gas = await startGas(t, h);
  // Another execution keeps the script lock: ?action=catalog answers Busy.
  h.otherHolder.held = true;
  // A port nothing listens on any more.
  const closed = http.createServer();
  await new Promise((resolve) => closed.listen(0, "127.0.0.1", resolve));
  const closedUrl = `http://127.0.0.1:${closed.address().port}/exec`;
  await new Promise((resolve) => closed.close(resolve));
  // An HTML page where the web app should be, as for a wrong deployment URL.
  const html = http.createServer((req, res) => res.end("<!DOCTYPE html><title>Sign in</title>"));
  await new Promise((resolve) => html.listen(0, "127.0.0.1", resolve));
  t.after(() => html.close());
  const file = writeExport(EXPORT);

  for (const [url, reason] of [
    [gas.url, /Busy/],
    [closedUrl, /ECONNREFUSED/],
    [`http://127.0.0.1:${html.address().port}/exec`, /not JSON/],
  ]) {
    const res = await run(["refresh", "--from", file], { NEXT_PUBLIC_GAS_SCRIPT_URL: url });

    assert.equal(res.code, 1, url);
    assert.match(res.stderr, reason);
    assert.doesNotMatch(res.stderr, /^\s+at /m);
  }
  assert.deepEqual(gas.posts, []);
});

test("refresh: GAS refuses one topic's list → that topic is not refreshed, with GAS's message; the next topic is still saved; exit 1", async (t) => {
  const h = gasWithTopics([[DENTAL, 60], [EPI, 20]]);
  const gas = await startGas(t, h);
  // A list with no row passing the patterns (SCHEMA §3.4 step 3).
  const exported = { ...EXPORT, reports: { ...EXPORT.reports, [DENTAL]: [{ ...SEED.reports[DENTAL][0], source_table: "dental" }] } };

  const res = await run(["refresh", "--from", writeExport(exported)], { NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url });

  assert.equal(res.code, 1);
  assert.match(res.stderr, new RegExp(`${DENTAL}.*No valid reports`));
  assert.deepEqual(gas.posts.map((p) => p.cat_id), [DENTAL, EPI]);
  assert.match(savedLines(res.stdout).join("\n"), new RegExp(`${EPI}.*added 34`));
});
