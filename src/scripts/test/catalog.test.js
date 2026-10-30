import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { loadGas } from "./gas-harness.js";

// FEATURES F03.

// The settings sheet as it is in production before F01 (read 30 Oct 2569).
const SETTINGS_BEFORE_F01 = [
  ["current_quarter", "current_year", "province_code"],
  [4, 2569, 54],
];

// Real catalog API responses from the catalog export of 30 Oct 2569 (SCHEMA
// §5.5), two topics: การสร้างเสริมภูมิคุ้มกันโรค (46 rows, 34 unique
// opendata_id, SCHEMA §5.2) and งานโภชนาการ (mixed-case ids).
const EXPORT = JSON.parse(fs.readFileSync(new URL("./fixtures/hdc-catalog-20261030-subset.json", import.meta.url)));
const EPI = "4df360514655f79f13901ef1181ca1c7";
const NUTRITION = "46522b5bd1e06d24a5bd81917257a93c";
const EPI_REPORTS = EXPORT.reports[EPI];
const NUTRITION_REPORTS = EXPORT.reports[NUTRITION];

function setupDatacenter(h) {
  const pin = vm.runInContext("CONFIG.DIAG_PIN", h.gas);
  const res = h.gas.doGet({ parameter: { action: "diag", pin, setup: "datacenter" } });
  return JSON.parse(res.getContent()).setupDatacenter;
}

// The admin's steps before a refresh (SPEC §13 step 3): setup=datacenter,
// then type the topics into hdc_topics.
function loadWithTopics(topics) {
  const h = loadGas({ sheets: { settings: SETTINGS_BEFORE_F01 } });
  setupDatacenter(h);
  topics.forEach(([catId, order], i) => {
    setCell(h, "hdc_topics", i + 2, "cat_id", catId);
    setCell(h, "hdc_topics", i + 2, "order", order);
  });
  return h;
}

// The admin typing value into (row, column by header name) of a sheet.
function setCell(h, sheetName, row, column, value) {
  const col = h.sheet(sheetName)[0].indexOf(column) + 1;
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getRange(row, col).setValues([[value]]);
}

function saveCatalog(h, body) {
  const res = h.gas.doPost({ postData: { contents: JSON.stringify({ action: "save_catalog", ...body }) } });
  return JSON.parse(res.getContent());
}

// A sheet's data rows as objects keyed by its header row.
function records(values) {
  const [header, ...rows] = values;
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

test("setup=datacenter twice: the first creates the 3 sheets and 2 settings columns, the second changes nothing", () => {
  const h = loadGas({ sheets: { settings: SETTINGS_BEFORE_F01 } });

  const first = setupDatacenter(h);

  assert.deepEqual(first, {
    created: ["hdc_topics", "hdc_reports", "sync_status"],
    settings_columns_added: ["district_code", "deploy_hook_url"],
  });
  assert.deepEqual(h.sheet("hdc_topics"), [
    ["cat_id", "order", "category_name", "main_report_id", "main_report_name", "report_count", "last_refreshed_at"],
  ]);
  assert.deepEqual(h.sheet("hdc_reports"), [
    [
      "opendata_id", "report_name", "source_table", "enabled", "subgroup", "order", "report_type", "goal",
      "col_target", "col_result", "cat_id", "category_name", "main_report_id", "main_report_name",
      "catalog_status", "last_seen_at",
    ],
  ]);
  assert.deepEqual(h.sheet("sync_status"), [["table", "b_year", "sheet", "row_count", "max_date_com", "synced_at"]]);
  assert.deepEqual(h.sheet("settings"), [
    ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
    [4, 2569, 54, "", ""],
  ]);

  // The admin fills in a topic and a setting between the two runs.
  const ss = h.gas.SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName("hdc_topics").getRange(2, 1, 1, 2).setValues([["4df360514655f79f13901ef1181ca1c7", 20]]);
  ss.getSheetByName("settings").getRange(2, 4).setValues([[5406]]);
  const before = Object.fromEntries(h.sheetNames().map((name) => [name, h.sheet(name)]));

  const second = setupDatacenter(h);

  assert.deepEqual(second, { created: [], settings_columns_added: [] });
  for (const name of ["settings", "hdc_topics", "hdc_reports", "sync_status"]) {
    assert.deepEqual(h.sheet(name), before[name], name);
  }
});

test("first save_catalog of the vaccine topic (46 rows) → added 34, every report enabled = FALSE, topic row filled", () => {
  const h = loadWithTopics([[EPI, 20]]);

  const res = saveCatalog(h, { cat_id: EPI, category_name: "การสร้างเสริมภูมิคุ้มกันโรค", reports: EPI_REPORTS });

  assert.deepEqual(res, { status: "success", added: 34, updated: 0, removed: 0, skipped: 0 });
  const reports = records(h.sheet("hdc_reports"));
  assert.equal(reports.length, 34);
  assert.ok(reports.every((r) => r.enabled === false), "every new report is enabled = FALSE (opt-in)");
  assert.ok(reports.every((r) => r.catalog_status === "active"));
  assert.ok(reports.every((r) => r.cat_id === EPI));
  // Admin columns stay blank on a new row (SCHEMA §2.3).
  for (const col of ["subgroup", "order", "report_type", "goal", "col_target", "col_result"]) {
    assert.ok(reports.every((r) => r[col] === ""), col);
  }
  const epi2 = reports.find((r) => r.opendata_id === "71e49e4b61aafee17761601c506d5f85");
  assert.equal(epi2.source_table, "s_epi2");
  assert.equal(epi2.main_report_id, "73daf277928bc32a1b3c8e772192543c");
  assert.equal(epi2.main_report_name, "ส่งเสริมป้องกัน");

  const [topic] = records(h.sheet("hdc_topics"));
  assert.equal(topic.cat_id, EPI);
  assert.equal(topic.order, 20);
  assert.equal(topic.category_name, "การสร้างเสริมภูมิคุ้มกันโรค");
  assert.equal(topic.main_report_id, "73daf277928bc32a1b3c8e772192543c");
  assert.equal(topic.main_report_name, "ส่งเสริมป้องกัน");
  assert.equal(topic.report_count, 34);
  assert.equal(Object.prototype.toString.call(topic.last_refreshed_at), "[object Date]");
});

test("re-send after ticking enabled and typing subgroup on one row → updated 34, the admin's values stay", () => {
  const h = loadWithTopics([[EPI, 20]]);
  saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });
  const row = records(h.sheet("hdc_reports")).findIndex((r) => r.opendata_id === "28dd2c7955ce926456240b2ff0100bde") + 2;
  setCell(h, "hdc_reports", row, "enabled", true);
  setCell(h, "hdc_reports", row, "subgroup", "กลุ่มอายุ 1 ปี");

  const res = saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });

  assert.deepEqual(res, { status: "success", added: 0, updated: 34, removed: 0, skipped: 0 });
  const reports = records(h.sheet("hdc_reports"));
  assert.equal(reports.length, 34);
  const ticked = reports.filter((r) => r.enabled === true);
  assert.equal(ticked.length, 1);
  assert.equal(ticked[0].opendata_id, "28dd2c7955ce926456240b2ff0100bde");
  assert.equal(ticked[0].subgroup, "กลุ่มอายุ 1 ปี");
  assert.equal(ticked[0].source_table, "s_epi_complete");
});

test("a report missing from the next list → catalog_status = removed, and its row stays", () => {
  const h = loadWithTopics([[EPI, 20]]);
  saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });
  const epi5 = "c47283d3c2c1e6528ddcf88c254f21b3";

  const res = saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS.filter((r) => r.opendata_id !== epi5) });

  assert.deepEqual(res, { status: "success", added: 0, updated: 33, removed: 1, skipped: 0 });
  const reports = records(h.sheet("hdc_reports"));
  assert.equal(reports.length, 34);
  assert.deepEqual(
    reports.filter((r) => r.catalog_status === "removed").map((r) => [r.opendata_id, r.source_table]),
    [[epi5, "s_epi5"]],
  );
  assert.equal(records(h.sheet("hdc_topics"))[0].report_count, 33);
});

test("a cat_id that is not in hdc_topics → error Topic not in hdc_topics, nothing written", () => {
  const h = loadWithTopics([[EPI, 20]]);

  const res = saveCatalog(h, { cat_id: NUTRITION, reports: NUTRITION_REPORTS });

  assert.deepEqual(res, { status: "error", message: "Topic not in hdc_topics" });
  assert.equal(records(h.sheet("hdc_reports")).length, 0);
});

test("reports: [] → error Empty report list, and no row is set to removed", () => {
  const h = loadWithTopics([[EPI, 20]]);
  saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });
  const before = h.sheet("hdc_reports");

  const res = saveCatalog(h, { cat_id: EPI, reports: [] });

  assert.deepEqual(res, { status: "error", message: "Empty report list" });
  assert.deepEqual(h.sheet("hdc_reports"), before);
  assert.ok(records(h.sheet("hdc_reports")).every((r) => r.catalog_status === "active"));
});

test("reports whose source_table does not start with s_, or is null, or of another cat_id → skipped, not added", () => {
  const h = loadWithTopics([[EPI, 20]]);
  const [base] = EPI_REPORTS;
  const bad = [
    { ...base, opendata_id: "aaaaaaaabbbbbbbbccccccccdddddddd", source_table: "epi_x" },
    // SCHEMA §5.2: one row in the schools topic has source_table null.
    { ...base, opendata_id: "aaaaaaaabbbbbbbbcccccccceeeeeeee", source_table: null },
    { ...base, opendata_id: "aaaaaaaabbbbbbbbccccccccffffffff", cat_id: NUTRITION },
  ];

  const res = saveCatalog(h, { cat_id: EPI, reports: [...EPI_REPORTS, ...bad] });

  assert.deepEqual(res, { status: "success", added: 34, updated: 0, removed: 0, skipped: 3 });
  const ids = records(h.sheet("hdc_reports")).map((r) => r.opendata_id);
  for (const r of bad) assert.ok(!ids.includes(r.opendata_id), r.opendata_id);
});

test("short ids with upper case and _ (T81yHkXJY8lk8nGZQqldk, iEds82J3Z67JHB8KLETD_) are added letter for letter", () => {
  const h = loadWithTopics([[NUTRITION, 10]]);

  const res = saveCatalog(h, { cat_id: NUTRITION, reports: NUTRITION_REPORTS });

  assert.equal(res.status, "success", res.message);
  assert.equal(res.skipped, 0);
  const reports = records(h.sheet("hdc_reports"));
  const byId = Object.fromEntries(reports.map((r) => [r.opendata_id, r]));
  assert.equal(byId.T81yHkXJY8lk8nGZQqldk?.source_table, "s_pregnant_anemia_coverage");
  assert.equal(byId.iEds82J3Z67JHB8KLETD_?.source_table, "s_labor_anemia");
  assert.ok(!reports.some((r) => r.opendata_id === "t81yhkxjy8lk8nggzqqldk" || r.opendata_id === "ieds82j3z67jhb8kletd_"));
});

test("names from HDC lose <font> tags, tabs and repeated spaces, in hdc_reports and hdc_topics; a bare < stays", () => {
  const h = loadWithTopics([[EPI, 20]]);
  const [base] = EPI_REPORTS;
  const dirty = {
    ...base,
    opendata_id: "aaaaaaaabbbbbbbbccccccccdddddddd",
    // A real report_name of the การคัดกรอง topic (SCHEMA §5.2), with a tab,
    // repeated spaces and a newline added.
    report_name:
      "  ผู้สูงอายุที่ผิดปกติได้รับการจัดทำ Care Plan\tและให้โปรแกรมส่งเสริมสุขภาพ<font color=red> (Intervension  STEP3 BigRock4)</font>\n",
    category_name: "การสร้างเสริมภูมิคุ้มกันโรค ",
    main_report_name: "ส่งเสริมป้องกัน  ",
  };
  // Real report names with < that is not a tag (SCHEMA §5.2 export).
  const ldl = { ...base, opendata_id: "aaaaaaaabbbbbbbbcccccccceeeeeeee",
    report_name: "อัตราผู้ป่วยเบาหวานที่ได้รับการตรวจไขมัน LDL และมีค่า LDL < 100 mg/dl" };
  const egfr = { ...base, opendata_id: "aaaaaaaabbbbbbbbccccccccffffffff",
    report_name: "ร้อยละของผู้ป่วย CKD ที่มีอัตราการลดลงของ eGFR<5 ml/min/1.73m2/yr" };

  const res = saveCatalog(h, { cat_id: EPI, reports: [dirty, ldl, egfr, ...EPI_REPORTS] });

  assert.equal(res.status, "success", res.message);
  const byId = Object.fromEntries(records(h.sheet("hdc_reports")).map((r) => [r.opendata_id, r]));
  const saved = byId[dirty.opendata_id];
  assert.equal(saved.report_name, "ผู้สูงอายุที่ผิดปกติได้รับการจัดทำ Care Plan และให้โปรแกรมส่งเสริมสุขภาพ (Intervension STEP3 BigRock4)");
  assert.equal(saved.category_name, "การสร้างเสริมภูมิคุ้มกันโรค");
  assert.equal(saved.main_report_name, "ส่งเสริมป้องกัน");
  assert.equal(byId[ldl.opendata_id].report_name, ldl.report_name);
  assert.equal(byId[egfr.opendata_id].report_name, egfr.report_name);
  // "ความครอบคลุมการได้รับวัคซีน dT ในเด็กนักเรียนชั้น ป.6 " in the real response has a trailing space.
  assert.equal(byId.c487348321b7c88e1c83f6e1bc8a578d.report_name, "ความครอบคลุมการได้รับวัคซีน dT ในเด็กนักเรียนชั้น ป.6");

  // No category_name in the body: the topic takes the first report's.
  const [topic] = records(h.sheet("hdc_topics"));
  assert.equal(topic.category_name, "การสร้างเสริมภูมิคุ้มกันโรค");
  assert.equal(topic.main_report_name, "ส่งเสริมป้องกัน");

  // A category_name in the body is cleaned too (สาเหตุการป่วย/ตาย has a trailing space, SCHEMA §5.2).
  saveCatalog(h, { cat_id: EPI, category_name: "การสร้างเสริม  ภูมิคุ้มกันโรค\t ", reports: EPI_REPORTS });
  assert.equal(records(h.sheet("hdc_topics"))[0].category_name, "การสร้างเสริม ภูมิคุ้มกันโรค");
});

test("a report already in another topic is left there (first topic wins) → skipped, with an INFO log", () => {
  // As abt2t2k4z4xeqzytwbave, listed by HDC under both สุขภาพช่องปาก and
  // แพทย์แผนไทย (SCHEMA §6): the second topic's response has the same
  // opendata_id with its own cat_id.
  const h = loadWithTopics([[EPI, 20], [NUTRITION, 10]]);
  saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });
  const shared = { ...EPI_REPORTS.find((r) => r.source_table === "s_epi2"), cat_id: NUTRITION, category_name: "งานโภชนาการ" };

  const res = saveCatalog(h, { cat_id: NUTRITION, reports: [...NUTRITION_REPORTS, shared] });

  assert.equal(res.status, "success", res.message);
  assert.equal(res.skipped, 1);
  const rows = records(h.sheet("hdc_reports")).filter((r) => r.opendata_id === shared.opendata_id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cat_id, EPI);
  assert.equal(rows[0].category_name, "การสร้างเสริมภูมิคุ้มกันโรค");
  const info = records(h.sheet("system_logs")).filter((r) => r.Type === "INFO");
  assert.equal(info.length, 1);
  assert.ok(String(info[0].Details).includes(shared.opendata_id), info[0].Details);
});

test("save_catalog runs under doPost's script lock, never takes it itself, and logs SUCCESS", () => {
  const h = loadWithTopics([[EPI, 20]]);
  // Fill the settings/kpi_master caches first, so only doPost's own lock is
  // counted (readSettings locks by itself on a cache miss).
  saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });
  const before = { ...h.lock };

  saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });

  assert.equal(h.lock.tryLock - before.tryLock, 1);
  assert.equal(h.lock.releaseLock - before.releaseLock, 1);
  assert.equal(h.lock.nested, 0);
  const success = records(h.sheet("system_logs")).filter((r) => r.Type === "SUCCESS");
  assert.equal(success.length, 2);
  assert.ok(String(success[1].Message).includes(EPI), success[1].Message);
});

test("hdc_reports keeps the admin's column order and extra columns; a missing column is appended", () => {
  const h = loadWithTopics([[EPI, 20]]);
  // The admin moved enabled first, added a note column, and deleted last_seen_at.
  const ss = h.gas.SpreadsheetApp.getActiveSpreadsheet();
  const header = [
    "enabled", "note", "opendata_id", "report_name", "source_table", "subgroup", "order", "report_type", "goal",
    "col_target", "col_result", "cat_id", "category_name", "main_report_id", "main_report_name", "catalog_status",
  ];
  const sheet = ss.getSheetByName("hdc_reports");
  sheet.clear();
  sheet.getRange(1, 1, 2, header.length).setValues([
    header,
    [true, "ตรวจแล้ว", "71e49e4b61aafee17761601c506d5f85", "", "", "", "", "", "", "", "", EPI, "", "", "", "active"],
  ]);

  const res = saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });

  assert.deepEqual(res, { status: "success", added: 33, updated: 1, removed: 0, skipped: 0 });
  assert.deepEqual(h.sheet("hdc_reports")[0], [...header, "last_seen_at"]);
  const [first] = records(h.sheet("hdc_reports"));
  assert.equal(first.enabled, true);
  assert.equal(first.note, "ตรวจแล้ว");
  assert.equal(first.source_table, "s_epi2");
});

test("a report that appears later is added below; the ticks on existing rows stay", () => {
  const h = loadWithTopics([[EPI, 20]]);
  const epi5 = "c47283d3c2c1e6528ddcf88c254f21b3";
  saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS.filter((r) => r.opendata_id !== epi5) });
  for (let row = 2; row <= 34; row++) setCell(h, "hdc_reports", row, "enabled", true);

  const res = saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });

  assert.deepEqual(res, { status: "success", added: 1, updated: 33, removed: 0, skipped: 0 });
  const reports = records(h.sheet("hdc_reports"));
  assert.equal(reports.length, 34);
  assert.equal(reports[33].opendata_id, epi5);
  assert.equal(reports[33].enabled, false);
  assert.equal(reports.filter((r) => r.enabled === true).length, 33);
});

test("a list where every report fails the patterns → all skipped, the topic's rows removed, report_count 0", () => {
  const h = loadWithTopics([[EPI, 20]]);
  saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS });

  const res = saveCatalog(h, { cat_id: EPI, reports: EPI_REPORTS.map((r) => ({ ...r, source_table: null })) });

  assert.deepEqual(res, { status: "success", added: 0, updated: 0, removed: 34, skipped: 46 });
  const [topic] = records(h.sheet("hdc_topics"));
  assert.equal(topic.report_count, 0);
  assert.equal(topic.category_name, "การสร้างเสริมภูมิคุ้มกันโรค");
  assert.equal(topic.main_report_id, "73daf277928bc32a1b3c8e772192543c");
});

test("opendata_id values that are Object.prototype names (constructor, __proto__) are added like any other", () => {
  const h = loadWithTopics([[EPI, 20]]);
  const [base] = EPI_REPORTS;
  const odd = ["constructor", "__proto__"].map((id) => ({ ...base, opendata_id: id }));

  const res = saveCatalog(h, { cat_id: EPI, reports: [...odd, ...EPI_REPORTS] });

  assert.deepEqual(res, { status: "success", added: 36, updated: 0, removed: 0, skipped: 0 });
  const ids = records(h.sheet("hdc_reports")).map((r) => r.opendata_id);
  assert.ok(ids.includes("constructor") && ids.includes("__proto__"), ids.slice(0, 3).join(", "));
});
