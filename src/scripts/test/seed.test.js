import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { loadGas } from "./gas-harness.js";

// FEATURES F08 / SCHEMA §3.6, §6.

const SETTINGS = [
  ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
  [4, 2569, 54, 5406, ""],
];

// Real catalog API responses from the catalog export of 30 Oct 2569 (SCHEMA
// §5.5): การสร้างเสริมภูมิคุ้มกันโรค from the F03 fixture (34 reports, 8 in the
// seed), and of the other five seed topics only their 13 seed reports.
const SUBSET = JSON.parse(fs.readFileSync(new URL("./fixtures/hdc-catalog-20261030-subset.json", import.meta.url)));
const SEED_TOPICS = JSON.parse(fs.readFileSync(new URL("./fixtures/hdc-catalog-20261030-seed.json", import.meta.url)));
const EPI = "4df360514655f79f13901ef1181ca1c7";
const CATALOG = { [EPI]: SUBSET.reports[EPI], ...SEED_TOPICS.reports };

// SCHEMA §6, typed from the doc (the 13 goals match kpi_master's targets in
// PA-Data, read 30 Oct 2569). Every seed report is enabled = TRUE with
// report_type = coverage.
// opendata_id → [subgroup, order, goal, col_target, col_result]
const SEED = {
  // อนามัยแม่และเด็ก
  "1c1b8e24aff59258a806f122e264031e": ["", 10, 75, "", ""], // s_kpi_anc12
  "bd63b8d99f7054560fcf9c3b96f39c13": ["", 20, 75, "", ""], // s_anc5
  "1b60d68b1cb5b003fcba38a4a0e4027b": ["", 30, 87, "", ""], // s_kpi_childdev4
  "684e99dc7538c8b1a97f19f91a100f08": ["", 40, 20, "", ""], // s_kpi_childdev2
  // การเฝ้าระวังด้านส่งเสริมสุขภาพและอนามัยสิ่งแวดล้อม
  "4164a7c49fcb2b8c3ccca67dcdf28bd0": ["", 10, 50, "", ""], // s_kpi_food
  // การคัดกรอง
  "aa86b13e8cb60cae6c3216b7e3e5f151": ["", 10, 80, "", ""], // s_aged9
  // Service Plan สาขาโรคไม่ติดต่อ
  "626c89f6b8d9f7ed90c72c719775eb07": ["", 10, 90, "", ""], // s_dm_screen
  "9702fa28cd2ec73ecc6af89d14f46874": ["", 20, 90, "", ""], // s_ht_screen
  "e9e461e793e8258f47d46d6956f12832": ["", 30, 70, "", ""], // s_ncd_screen_repleate1
  "b57439ff27302ade8c38d1dd189644a4": ["", 40, 80, "", ""], // s_ht_screen_follow
  // Service Plan สาขาสุขภาพช่องปาก
  abt2t2k4z4xeqzytwbave: ["", 10, 80, "b", "a"], // s_dental_0_5_cavity_free
  "e07a6ff3cd63d34a759be4bff5c1a4c6": ["", 20, 25, "", ""], // s_kpi_dental28
  "1fb6b46f1d1fd42362f97072f4b3b653": ["", 30, 50, "", ""], // s_kpi_dental33
  // การสร้างเสริมภูมิคุ้มกันโรค
  "c88658f4d09acb8c76e6c06ffb58ebaf": ["กลุ่มอายุ 1 ปี", 10, 90, "", ""], // s_epi1
  "28dd2c7955ce926456240b2ff0100bde": ["กลุ่มอายุ 1 ปี", 11, 90, "", ""], // s_epi_complete
  "71e49e4b61aafee17761601c506d5f85": ["กลุ่มอายุ 2 ปี", 20, 90, "", ""], // s_epi2
  "35f4a8d465e6e1edc05f3d8ab658c551": ["กลุ่มอายุ 2 ปี", 21, 90, "", ""], // s_epi_complete
  "267ce09f2a704eb7783997e25d1f18ba": ["กลุ่มอายุ 3 ปี", 30, 90, "", ""], // s_epi3
  "d1fe173d08e959397adf34b1d77e88d7": ["กลุ่มอายุ 3 ปี", 31, 90, "", ""], // s_epi_complete
  "c47283d3c2c1e6528ddcf88c254f21b3": ["กลุ่มอายุ 5 ปี", 50, 90, "", ""], // s_epi5
  "f033ab37c30201f73f142449d037028d": ["กลุ่มอายุ 5 ปี", 51, 90, "", ""], // s_epi_complete
};

function diag(h, setup) {
  const pin = vm.runInContext("CONFIG.DIAG_PIN", h.gas);
  return JSON.parse(h.gas.doGet({ parameter: { action: "diag", pin, setup } }).getContent());
}

function seed(h) {
  return diag(h, "dc_seed").setupDcSeed;
}

// The admin typing value into (row, column by header name) of a sheet.
function setCell(h, sheetName, row, column, value) {
  const col = h.sheet(sheetName)[0].indexOf(column) + 1;
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getRange(row, col).setValues([[value]]);
}

// The admin's steps before the seed (SPEC §13 steps 2–4): setup=datacenter,
// type the six topics into hdc_topics, refresh each from the catalog export.
// All at 08:00, so last_seen_at is 08:00 and a test can seed later.
function loadRefreshed() {
  const h = loadGas({ sheets: { settings: SETTINGS } });
  h.clock.now = Date.parse("2026-10-30T08:00:00+07:00");
  diag(h, "datacenter");
  Object.keys(CATALOG).forEach((catId, i) => setCell(h, "hdc_topics", i + 2, "cat_id", catId));
  for (const [catId, reports] of Object.entries(CATALOG)) {
    const body = { action: "save_catalog", cat_id: catId, reports };
    const saved = JSON.parse(h.gas.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
    assert.equal(saved.status, "success", saved.message);
  }
  return h;
}

// A sheet's data rows as objects keyed by its header row.
function records(values) {
  const [header, ...rows] = values;
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

test("hdc_reports with the 21 seed reports → applied: 21, not_found: [], and they get SCHEMA §6's admin columns (cavity free: b / a)", () => {
  const h = loadRefreshed();

  const res = seed(h);

  assert.deepEqual(res, { applied: 21, not_found: [] });
  const enabled = records(h.sheet("hdc_reports")).filter((r) => r.enabled === true);
  assert.deepEqual(
    Object.fromEntries(enabled.map((r) => [r.opendata_id, [r.subgroup, r.order, r.goal, r.col_target, r.col_result]])),
    SEED,
  );
  assert.ok(enabled.every((r) => r.report_type === "coverage"));
});

test("a seed report whose row is cut from hdc_reports → applied: 20, not_found lists its id, and no row is added", () => {
  const h = loadRefreshed();
  const cavityFree = "abt2t2k4z4xeqzytwbave";
  const row = records(h.sheet("hdc_reports")).findIndex((r) => r.opendata_id === cavityFree) + 2;
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName("hdc_reports").deleteRows(row, 1);
  const before = records(h.sheet("hdc_reports")).map((r) => r.opendata_id);

  const res = seed(h);

  assert.deepEqual(res, { applied: 20, not_found: [cavityFree] });
  assert.deepEqual(records(h.sheet("hdc_reports")).map((r) => r.opendata_id), before);
});

test("dc_seed twice → the same answer and sheet; the API columns, the rows outside the seed and hdc_topics are not touched", () => {
  const h = loadRefreshed();
  // The admin ticked a report outside the seed (s_ipv), then seeds at 08:05.
  const ipv = "d8976d09a8e90349cf356e1135b36c2e";
  setCell(h, "hdc_reports", records(h.sheet("hdc_reports")).findIndex((r) => r.opendata_id === ipv) + 2, "enabled", true);
  h.clock.now = Date.parse("2026-10-30T08:05:00+07:00");
  const before = h.sheet("hdc_reports");
  const topics = h.sheet("hdc_topics");

  const first = seed(h);
  const once = h.sheet("hdc_reports");
  const second = seed(h);

  assert.deepEqual(second, first);
  assert.deepEqual(h.sheet("hdc_reports"), once);
  const api = [
    "opendata_id", "report_name", "source_table", "cat_id", "category_name", "main_report_id", "main_report_name",
    "catalog_status", "last_seen_at",
  ];
  const apiColumns = (values) => values.map((row) => api.map((name) => row[values[0].indexOf(name)]));
  assert.deepEqual(apiColumns(once), apiColumns(before));
  const outsideSeed = (values) => values.filter((row) => !Object.hasOwn(SEED, row[values[0].indexOf("opendata_id")]));
  assert.deepEqual(outsideSeed(once), outsideSeed(before));
  // dc_seed writes only hdc_reports (SCHEMA §6).
  assert.deepEqual(h.sheet("hdc_topics"), topics);
});
