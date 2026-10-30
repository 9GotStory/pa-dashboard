import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { loadGas } from "./gas-harness.js";
import { HOSPITALS, KPI_EPI, TAMBON_MASTER } from "./fixtures/master-sheets-20261030.js";

// FEATURES F06 / SCHEMA §3.2.

const SETTINGS = [
  ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
  [4, 2569, 54, 5406, ""],
];

// Real catalog API responses from the catalog export of 30 Oct 2569 (SCHEMA
// §5.5): การสร้างเสริมภูมิคุ้มกันโรค from the fixture, and of สุขภาพช่องปาก only
// the report the phase 1 seed enables (SCHEMA §6), copied from the export.
const EXPORT = JSON.parse(fs.readFileSync(new URL("./fixtures/hdc-catalog-20261030-subset.json", import.meta.url)));
const EPI = "4df360514655f79f13901ef1181ca1c7";
const DENTAL = "db30e434e30565c12fbac44958e338d5";
const CATALOG = {
  [EPI]: EXPORT.reports[EPI],
  [DENTAL]: [{
    id: 970,
    report_id: 948,
    report_name: "ร้อยละของเด็กอายุ0-5 ปี ฟันดีไม่มีผุ (Cavity Free) (คน)",
    cat_id: DENTAL,
    source_table: "s_dental_0_5_cavity_free",
    main_report_id: "02e752187c7282ebc9315123aa1cabbe",
    category_name: "ข้อมูลเพื่อตอบสนอง Service Plan สาขาสุขภาพช่องปาก",
    main_report_name: "ข้อมูลตอบสนอง Service Plan",
    opendata_id: "abt2t2k4z4xeqzytwbave",
    view_count: 964,
    last_synced_at: "2026-10-29T19:00:24.000Z",
    created_at: "2026-06-11T03:33:11.000Z",
    updated_at: "2026-10-29T19:00:24.000Z",
  }],
};

const EPI1 = "c88658f4d09acb8c76e6c06ffb58ebaf"; // s_epi1
const EPI2 = "71e49e4b61aafee17761601c506d5f85"; // s_epi2
const IPV = "d8976d09a8e90349cf356e1135b36c2e"; // s_ipv, not in the seed
// s_epi_complete holds the 4 fully immunized reports.
const COMPLETE_1Y = "28dd2c7955ce926456240b2ff0100bde";
const COMPLETE_2Y = "35f4a8d465e6e1edc05f3d8ab658c551";
const COMPLETE_3Y = "d1fe173d08e959397adf34b1d77e88d7";
const COMPLETE_5Y = "f033ab37c30201f73f142449d037028d";
const CAVITY_FREE = "abt2t2k4z4xeqzytwbave"; // s_dental_0_5_cavity_free

const MONTHS = ["10", "11", "12", "01", "02", "03", "04", "05", "06", "07", "08", "09"];
// Headers of the PA-Data sheets, read 30 Oct 2569.
const EPI2_HEADER = [
  "id", "hospcode", "areacode", "flag_sent", "date_com", "b_year", ...MONTHS.map((m) => "target" + m),
  ...MONTHS.flatMap((m) => ["dtp4_" + m, "opv4_" + m, "je2_" + m]), ...MONTHS.map((m) => "mmr1_" + m), "ip",
  ...MONTHS.map((m) => "mmr2_" + m), ...MONTHS.map((m) => "pcv4_" + m),
];
const COMPLETE_HEADER = [
  "id", "hospcode", "areacode", "flag_sent", "date_com", "b_year", "target", "result",
  ...MONTHS.flatMap((m) => ["target" + m, "result" + m]), "ip",
];

function getReport(h, id) {
  return JSON.parse(h.gas.doGet({ parameter: { action: "report", id } }).getContent());
}

function getCatalog(h) {
  return JSON.parse(h.gas.doGet({ parameter: { action: "catalog" } }).getContent());
}

function post(h, body) {
  return JSON.parse(h.gas.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}

// The admin typing value into (row, column by header name) of a sheet.
function setCell(h, sheetName, row, column, value) {
  const col = h.sheet(sheetName)[0].indexOf(column) + 1;
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getRange(row, col).setValues([[value]]);
}

// The admin ticking `enabled` on a report in hdc_reports.
function enable(h, opendataId) {
  const values = h.sheet("hdc_reports");
  const row = values.findIndex((r) => r[values[0].indexOf("opendata_id")] === opendataId) + 1;
  setCell(h, "hdc_reports", row, "enabled", true);
}

// The admin's steps (SPEC §13) on the real master sheets: setup=datacenter,
// type each [cat_id, order] into hdc_topics, refresh those topics from
// CATALOG, tick the given reports. All at 08:00, so a test that sets a later
// time sees the 60 s caches run out.
function loadWithCatalog(topics, enabledIds) {
  const h = loadGas({ sheets: { settings: SETTINGS, tambon_master: TAMBON_MASTER, hospitals: HOSPITALS, kpi_epi: KPI_EPI } });
  h.clock.now = Date.parse("2026-10-30T08:00:00+07:00");
  h.gas.doGet({ parameter: { action: "diag", pin: vm.runInContext("CONFIG.DIAG_PIN", h.gas), setup: "datacenter" } });
  topics.forEach(([catId, order], i) => {
    setCell(h, "hdc_topics", i + 2, "cat_id", catId);
    setCell(h, "hdc_topics", i + 2, "order", order);
  });
  topics.forEach(([catId]) => {
    const saved = post(h, { action: "save_catalog", cat_id: catId, reports: CATALOG[catId] });
    assert.equal(saved.status, "success", saved.message);
  });
  enabledIds.forEach((id) => enable(h, id));
  return h;
}

function save(h, tableName, year, data) {
  const res = post(h, { action: "save_kpi_data", tableName, year, data });
  assert.equal(res.status, "success", res.message);
}

// A MOPH row with the keys of header in order, blank but for values.
function mophRow(header, values) {
  return Object.assign(Object.fromEntries(header.map((key) => [key, ""])), values);
}

// MOPH rows of s_epi_complete for one year: for each fully immunized report,
// 3 rows in อำเภอ 5406 and 1 in 5401, which is not saved.
function completeRows(year, dateCom) {
  const places = [["14436", "54010104"], ["06413", "54060101"], ["06415", "54060201"], ["06419", "54060401"]];
  return [COMPLETE_1Y, COMPLETE_2Y, COMPLETE_3Y, COMPLETE_5Y].flatMap((id) => places.map(([hospcode, areacode]) =>
    mophRow(COMPLETE_HEADER, { id, hospcode, areacode, date_com: dateCom, b_year: year, target: 10, result: 9 })));
}

// A block's rows as objects keyed by its headers.
function records(block) {
  return block.rows.map((row) => Object.fromEntries(block.headers.map((key, i) => [key, row[i]])));
}

test("fully immunized 1 ปี → every row of every block has its id and an areacode of อำเภอ 5406; years oldest first", () => {
  const h = loadWithCatalog([[EPI, 20]], [COMPLETE_1Y, COMPLETE_2Y, COMPLETE_3Y, COMPLETE_5Y]);
  save(h, "s_epi_complete", "2569", completeRows("2569", "202610290051"));
  save(h, "s_epi_complete", "2565", completeRows("2565", "202209301200"));
  save(h, "s_epi_complete", "2567", completeRows("2567", "202409301200"));
  // A row of อำเภอ 5401 left in the ชีตปีปัจจุบัน, e.g. typed in by hand
  // (SCHEMA §3.2 step 3.1).
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName("s_epi_complete").appendRow(Object.values(mophRow(
    COMPLETE_HEADER,
    { id: COMPLETE_1Y, hospcode: "14436", areacode: "54010104", date_com: "202610290051", b_year: "2569", target: 10, result: 9 },
  )));

  const res = getReport(h, COMPLETE_1Y);

  assert.deepEqual(res.years.map((block) => block.b_year), ["2565", "2567", "2569"]);
  for (const block of res.years) {
    assert.deepEqual(records(block).map((r) => [r.id, r.areacode]),
      [[COMPLETE_1Y, "54060101"], [COMPLETE_1Y, "54060201"], [COMPLETE_1Y, "54060401"]], block.b_year);
    assert.equal(block.sheet_rows, 12, block.b_year);
    assert.equal(block.expected_rows, 12, block.b_year);
  }
});

test("s_epi2 → only rows whose id is the opendata_id exactly, though no other report uses the table", () => {
  const h = loadWithCatalog([[EPI, 20]], [EPI2]);
  const row = (id, hospcode, areacode) =>
    mophRow(EPI2_HEADER, { id, hospcode, areacode, date_com: "202610290051", b_year: "2569", target10: 2, dtp4_10: 2 });
  save(h, "s_epi2", "2569", [
    row(EPI2, "14436", "54010111"), // อำเภอ 5401: not saved
    row(EPI2, "06413", "54060101"),
    row(EPI2.toUpperCase(), "06415", "54060201"), // saved, but differs from the opendata_id in case
    row(EPI2, "06416", "54060301"),
    row(EPI2, "06419", "54060401"),
  ]);

  const [block] = getReport(h, EPI2).years;

  assert.deepEqual(records(block).map((r) => [r.id, r.hospcode, r.dtp4_10]),
    [[EPI2, "06413", 2], [EPI2, "06416", 2], [EPI2, "06419", 2]]);
  assert.deepEqual(block.headers, EPI2_HEADER);
  // sheet_rows counts the district's rows before the id filter.
  assert.equal(block.sheet_rows, 4);
  assert.equal(block.expected_rows, 4);
});

test("s_dental_0_5_cavity_free has no id column → the block holds every row of the district", () => {
  const h = loadWithCatalog([[EPI, 20], [DENTAL, 60]], [CAVITY_FREE]);
  // Rows in the shape of the PA-Data sheet (header read 30 Oct 2569): no id.
  save(h, "s_dental_0_5_cavity_free", "2569", [
    { hospcode: "14436", b_year: "2569", areacode: "54010104", date_com: "202610300838", c: 10, b: 7, a: 4 },
    { hospcode: "06413", b_year: "2569", areacode: "54060101", date_com: "202610300838", c: 15, b: 12, a: 11 },
    { hospcode: "06415", b_year: "2569", areacode: "54060201", date_com: "202610300838", c: 12, b: 9, a: 9 },
    { hospcode: "06419", b_year: "2569", areacode: "54060401", date_com: "202610300838", c: 8, b: 8, a: 6 },
  ]);

  const res = getReport(h, CAVITY_FREE);

  assert.deepEqual(res.years, [{
    b_year: "2569",
    headers: ["hospcode", "b_year", "areacode", "date_com", "c", "b", "a"],
    rows: [
      ["06413", "2569", "54060101", "202610300838", 15, 12, 11],
      ["06415", "2569", "54060201", "202610300838", 12, 9, 9],
      ["06419", "2569", "54060401", "202610300838", 8, 8, 6],
    ],
    max_date_com: "202610300838",
    sheet_rows: 3,
    expected_rows: 3,
  }]);
});

test("an id that is not enabled, not in hdc_reports, differs from the stored one only in case, or fails the pattern → error Unknown report", () => {
  const h = loadWithCatalog([[EPI, 20]], [EPI2]);

  for (const id of [IPV, "0123456789abcdef0123456789abcdef", EPI2.toUpperCase(), "../settings", "", undefined]) {
    assert.deepEqual(getReport(h, id), { status: "error", message: "Unknown report" }, String(id));
  }
});

test("an active report whose table has no data yet → { report, years: [] }, report being the catalog's DcReport", () => {
  const h = loadWithCatalog([[EPI, 20]], [EPI1, EPI2]);

  const res = getReport(h, EPI1);

  assert.deepEqual(res.years, []);
  assert.equal(res.report.opendata_id, EPI1);
  assert.equal(res.report.measure_goals.mmr, 95);
  assert.deepEqual(res.report.years, []);
  assert.deepEqual(res.report, getCatalog(h).reports.find((r) => r.opendata_id === EPI1));
  assert.deepEqual(Object.keys(res).sort(), ["report", "years"]);
});

test("2569 in s_epi2 and 2568 in s_epi2_y2568 → 2 blocks, each with its own sheet's header, sheet_rows = expected_rows in both", () => {
  const h = loadWithCatalog([[EPI, 20]], [EPI2]);
  // 2568 as if synced before HDC added the pcv4 columns.
  const header2568 = EPI2_HEADER.filter((key) => !key.startsWith("pcv4_"));
  save(h, "s_epi2", "2569", [["06413", "54060101"], ["06415", "54060201"], ["06419", "54060401"]].map(
    ([hospcode, areacode]) => mophRow(EPI2_HEADER,
      { id: EPI2, hospcode, areacode, date_com: "202610290051", b_year: "2569", target10: 2, pcv4_10: 1 })));
  save(h, "s_epi2", "2568", [["06413", "54060101"], ["06416", "54060301"]].map(
    ([hospcode, areacode]) => mophRow(header2568,
      { id: EPI2, hospcode, areacode, date_com: "202509300900", b_year: "2568", target10: 3, mmr2_10: 3 })));

  const [y2568, y2569] = getReport(h, EPI2).years;

  assert.deepEqual(h.sheetNames().filter((name) => name.startsWith("s_epi2")).sort(), ["s_epi2", "s_epi2_y2568"]);
  assert.equal(y2568.b_year, "2568");
  assert.deepEqual(y2568.headers, header2568);
  assert.ok(y2568.rows.every((row) => row.length === header2568.length));
  assert.deepEqual(records(y2568).map((r) => [r.hospcode, r.target10, r.mmr2_10, "pcv4_10" in r]),
    [["06413", 3, 3, false], ["06416", 3, 3, false]]);
  assert.deepEqual([y2568.sheet_rows, y2568.expected_rows], [2, 2]);
  assert.equal(y2569.b_year, "2569");
  assert.deepEqual(y2569.headers, EPI2_HEADER);
  assert.ok(y2569.rows.every((row) => row.length === EPI2_HEADER.length));
  assert.deepEqual(records(y2569).map((r) => [r.hospcode, r.target10, r.pcv4_10]),
    [["06413", 2, 1], ["06415", 2, 1], ["06419", 2, 1]]);
  assert.deepEqual([y2569.sheet_rows, y2569.expected_rows], [3, 3]);
});

// s_epi2 enabled, with one row of 2569 saved.
function loadWithEpi2() {
  const h = loadWithCatalog([[EPI, 20]], [EPI2]);
  save(h, "s_epi2", "2569", [mophRow(EPI2_HEADER,
    { id: EPI2, hospcode: "06413", areacode: "54060101", date_com: "202610290051", b_year: "2569", target10: 2 })]);
  return h;
}

// The sheets a report reads, which must only be read under the script lock.
const REPORT_SHEETS = ["hdc_topics", "hdc_reports", "sync_status", "kpi_epi", "s_epi2"];

test("while another execution holds the script lock past the 30 s wait → error Busy, and no sheet of the report is read", () => {
  const h = loadWithEpi2();
  h.otherHolder.held = true;
  const before = REPORT_SHEETS.map((name) => h.reads(name));

  const res = getReport(h, EPI2);

  assert.deepEqual(res, { status: "error", message: "Busy" });
  assert.deepEqual(REPORT_SHEETS.map((name) => h.reads(name)), before);
});

test("a table without an id column that two active reports share → error Shared table without id column", () => {
  const h = loadWithCatalog([[EPI, 20]], [COMPLETE_1Y, COMPLETE_2Y]);
  // s_epi_complete as if HDC dropped its id column: the reports' rows can
  // no longer be told apart.
  const rows = completeRows("2569", "202610290051");
  rows.forEach((row) => delete row.id);
  save(h, "s_epi_complete", "2569", rows);

  assert.deepEqual(getReport(h, COMPLETE_1Y), { status: "error", message: "Shared table without id column" });
});

test("a year whose sheet is gone is left out with a WARNING in system_logs; the other years still answer", () => {
  const h = loadWithCatalog([[EPI, 20]], [EPI2]);
  const rows = (year, dateCom) => [["06413", "54060101"], ["06415", "54060201"]].map(([hospcode, areacode]) =>
    mophRow(EPI2_HEADER, { id: EPI2, hospcode, areacode, date_com: dateCom, b_year: year, target10: 2 }));
  save(h, "s_epi2", "2569", rows("2569", "202610290051"));
  save(h, "s_epi2", "2568", rows("2568", "202509300900"));
  // The admin deletes the ชีตปีย้อนหลัง by hand.
  const ss = h.gas.SpreadsheetApp.getActiveSpreadsheet();
  ss.deleteSheet(ss.getSheetByName("s_epi2_y2568"));

  const res = getReport(h, EPI2);

  assert.deepEqual(res.years.map((block) => block.b_year), ["2569"]);
  // report.years is the catalog's, from sync_status: it still lists 2568.
  assert.deepEqual(res.report.years.map((y) => y.b_year), ["2568", "2569"]);
  const warnings = h.sheet("system_logs").filter((row) => row[1] === "WARNING");
  assert.ok(warnings.some((row) => row.join(" ").includes("s_epi2_y2568")), JSON.stringify(warnings));
});

test("a block's max_date_com is the latest date_com of its own rows (\"\" with none); report.years keeps the table's", () => {
  const h = loadWithCatalog([[EPI, 20]], [COMPLETE_1Y, COMPLETE_5Y]);
  // HDC computed the 1 ปี rows before the 2 ปี rows, and sent no 5 ปี rows.
  const row = (id, hospcode, areacode, dateCom) =>
    mophRow(COMPLETE_HEADER, { id, hospcode, areacode, date_com: dateCom, b_year: "2569", target: 10, result: 9 });
  save(h, "s_epi_complete", "2569", [
    row(COMPLETE_1Y, "06413", "54060101", "202610290049"),
    row(COMPLETE_1Y, "06415", "54060201", "202610290051"),
    row(COMPLETE_2Y, "06413", "54060101", "202610300838"),
  ]);

  const oneYear = getReport(h, COMPLETE_1Y);
  const fiveYears = getReport(h, COMPLETE_5Y);

  assert.equal(oneYear.years[0].max_date_com, "202610290051");
  assert.equal(oneYear.report.years[0].max_date_com, "202610300838");
  assert.deepEqual([fiveYears.years[0].rows, fiveYears.years[0].max_date_com], [[], ""]);
});

test("report takes the script lock once and releases it", () => {
  const h = loadWithEpi2();
  // readSettings (PA code) locks by itself on a cache miss: warm it first so
  // only doGet's lock is counted.
  h.gas.readSettings();
  h.lock.tryLock = 0;
  h.lock.releaseLock = 0;

  const res = getReport(h, EPI2);

  assert.equal(res.years[0].rows.length, 1);
  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

// SCHEMA §3: readSettings and readKpiMasterConfig take and release the lock
// themselves on a cache miss, which would drop doGet's lock if called while
// doGet holds it.
test("report with cold settings and kpi_master caches never calls tryLock while it holds the lock", () => {
  const h = loadWithEpi2();
  h.clock.now = Date.parse("2026-10-30T09:00:00+07:00"); // the caches filled at 08:00 have run out

  const res = getReport(h, EPI2);

  assert.equal(res.years[0].rows.length, 1);
  assert.equal(h.lock.nested, 0);
  assert.equal(h.lock.releaseLock, h.lock.tryLock);
});
