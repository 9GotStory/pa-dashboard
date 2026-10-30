import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { loadGas } from "./gas-harness.js";
import { HOSPITALS, KPI_EPI, TAMBON_MASTER } from "./fixtures/master-sheets-20261030.js";

// FEATURES F05 / SCHEMA §3.1.

const SETTINGS = [
  ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
  [4, 2569, 54, 5406, ""],
];

// Real catalog API responses from the catalog export of 30 Oct 2569 (SCHEMA
// §5.5): การสร้างเสริมภูมิคุ้มกันโรค and งานโภชนาการ.
const EXPORT = JSON.parse(fs.readFileSync(new URL("./fixtures/hdc-catalog-20261030-subset.json", import.meta.url)));
const EPI = "4df360514655f79f13901ef1181ca1c7";
const NUTRITION = "46522b5bd1e06d24a5bd81917257a93c";

// The 8 vaccine reports of the phase 1 seed (SCHEMA §6).
const EPI1 = "c88658f4d09acb8c76e6c06ffb58ebaf"; // s_epi1
const EPI2 = "71e49e4b61aafee17761601c506d5f85"; // s_epi2
const EPI3 = "267ce09f2a704eb7783997e25d1f18ba"; // s_epi3
const EPI5 = "c47283d3c2c1e6528ddcf88c254f21b3"; // s_epi5
const COMPLETE = [
  "28dd2c7955ce926456240b2ff0100bde", // s_epi_complete, 1 ปี
  "35f4a8d465e6e1edc05f3d8ab658c551", // 2 ปี
  "d1fe173d08e959397adf34b1d77e88d7", // 3 ปี
  "f033ab37c30201f73f142449d037028d", // 5 ปี
];
const SEED_EPI = [EPI1, EPI2, EPI3, EPI5, ...COMPLETE];
// A nutrition report with a mixed-case short id (s_pregnant_anemia_coverage).
const ANEMIA = "T81yHkXJY8lk8nGZQqldk";

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

// The admin typing value into a report's column of hdc_reports.
function setReportCell(h, opendataId, column, value) {
  const values = h.sheet("hdc_reports");
  const row = values.findIndex((r) => r[values[0].indexOf("opendata_id")] === opendataId) + 1;
  setCell(h, "hdc_reports", row, column, value);
}

// The admin ticking `enabled` on a report in hdc_reports.
function enable(h, opendataId) {
  setReportCell(h, opendataId, "enabled", true);
}

// The admin's steps (SPEC §13) on the real master sheets: setup=datacenter,
// type each [cat_id, order] into hdc_topics, refresh those topics from the
// export, tick the given reports. All at 08:00, so a test that sets a later
// time sees the 60 s settings cache run out.
function loadWithCatalog(topics, enabledIds) {
  const h = loadGas({ sheets: { settings: SETTINGS, tambon_master: TAMBON_MASTER, hospitals: HOSPITALS, kpi_epi: KPI_EPI } });
  h.clock.now = Date.parse("2026-10-30T08:00:00+07:00");
  h.gas.doGet({ parameter: { action: "diag", pin: vm.runInContext("CONFIG.DIAG_PIN", h.gas), setup: "datacenter" } });
  topics.forEach(([catId, order], i) => {
    setCell(h, "hdc_topics", i + 2, "cat_id", catId);
    setCell(h, "hdc_topics", i + 2, "order", order);
  });
  topics.forEach(([catId]) => {
    const saved = post(h, { action: "save_catalog", cat_id: catId, reports: EXPORT.reports[catId] });
    assert.equal(saved.status, "success", saved.message);
  });
  enabledIds.forEach((id) => enable(h, id));
  return h;
}

function ids(reports) {
  return reports.map((r) => r.opendata_id).sort();
}

test("meta: current_year, the window oldest first and district_code from settings, generated_at = now (ISO)", () => {
  const h = loadGas({
    sheets: {
      settings: [
        ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
        [1, 2570, 54, 5401, ""],
      ],
    },
  });
  h.clock.now = Date.parse("2026-10-30T14:05:00+07:00");

  const catalog = getCatalog(h);

  assert.deepEqual(catalog.meta, {
    current_year: "2570",
    years: ["2566", "2567", "2568", "2569", "2570"],
    district_code: "5401",
    generated_at: "2026-10-30T07:05:00.000Z",
  });
});

test("areas are the tambon_master rows of district_code as { id, name_th }; hospitals are every hospitals row", () => {
  // ในเวียง of อำเภอเมืองแพร่ (5401) is not an area of 5406.
  const tambons = [TAMBON_MASTER[0], ["540101", "ในเวียง", "5401", "54000"], ...TAMBON_MASTER.slice(1)];
  const h = loadGas({ sheets: { settings: SETTINGS, tambon_master: tambons, hospitals: HOSPITALS } });

  const catalog = getCatalog(h);

  assert.deepEqual(catalog.areas, [
    { id: "540601", name_th: "บ้านหนุน" },
    { id: "540602", name_th: "บ้านกลาง" },
    { id: "540603", name_th: "ห้วยหม้าย" },
    { id: "540604", name_th: "เตาปูน" },
    { id: "540605", name_th: "หัวเมือง" },
    { id: "540606", name_th: "สะเอียบ" },
    { id: "540607", name_th: "แดนชุมพล" },
    { id: "540608", name_th: "ทุ่งน้าว" },
  ]);
  assert.equal(catalog.hospitals.length, 17);
  assert.deepEqual(catalog.hospitals.find((x) => x.hospcode === "06413"),
    { hospcode: "06413", hospname: "บ้านหนุน", tambon_id: "540601" });
  assert.deepEqual(catalog.hospitals.find((x) => x.hospcode === "11170"),
    { hospcode: "11170", hospname: "สอง", tambon_id: "540601" });
});

test("reports are only the active ones: enabled = TRUE and the topic in hdc_topics; topics are the hdc_topics rows", () => {
  const h = loadWithCatalog([[EPI, 20], [NUTRITION, 15]], [...SEED_EPI, ANEMIA]);

  const withNutrition = getCatalog(h);
  // The admin deletes the nutrition row from hdc_topics (SCHEMA §2.2).
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName("hdc_topics").deleteRows(3, 1);
  const catalog = getCatalog(h);

  assert.deepEqual(ids(withNutrition.reports), [...SEED_EPI, ANEMIA].sort());
  assert.deepEqual(ids(catalog.reports), [...SEED_EPI].sort());
  assert.deepEqual(catalog.topics, [{
    cat_id: EPI,
    category_name: "การสร้างเสริมภูมิคุ้มกันโรค",
    main_report_id: "73daf277928bc32a1b3c8e772192543c",
    main_report_name: "ส่งเสริมป้องกัน",
    order: 20,
  }]);
});

test("measure_goals: the kpi_epi rows of the report's source_table that have a value_prefix → { [value_prefix]: target }", () => {
  const h = loadWithCatalog([[EPI, 20]], SEED_EPI);
  // A pcv4 row added back with its target left blank: pcv4 is left out, so
  // the report's own goal applies to it (SCHEMA §6).
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName("kpi_epi")
    .appendRow(["s_epi2__pcv4", "เด็กครบ 2 ปี ได้รับวัคซีน PCV4", "", 126, "", "กลุ่มอายุ 2 ปี", "s_epi2", "pcv4", ""]);

  const byId = Object.fromEntries(getCatalog(h).reports.map((r) => [r.opendata_id, r]));

  assert.deepEqual(byId[EPI2].measure_goals, { dtp4: 90, opv4: 90, mmr1: 95, mmr2: 95, je2: 90 });
  // mmr2 is 95 for s_epi2 but 90 for s_epi3: goals belong to the source table.
  assert.deepEqual(byId[EPI3].measure_goals, { je3: 90, mmr2: 90 });
  assert.deepEqual(byId[EPI5].measure_goals, { dtp5: 90, opv5: 90 });
  assert.equal(Object.keys(byId[EPI1].measure_goals).length, 17);
  assert.equal(byId[EPI1].measure_goals.mmr, 95);
  assert.equal(byId[EPI1].measure_goals.bcg, 90);
  // The fully immunized rows of kpi_epi select by source_id, not value_prefix.
  for (const id of COMPLETE) assert.deepEqual(byId[id].measure_goals, {}, id);
});

// MOPH rows of s_epi2 for one year: n in อำเภอ 5406 and one of 5401, which is
// not saved.
function epi2Rows(year, dateCom, n) {
  const row = (hospcode, areacode) =>
    ({ id: EPI2, hospcode, areacode, date_com: dateCom, b_year: year, target: 5, result: 4 });
  return [row("10701", "54010101"), ...Array.from({ length: n }, (_, i) => row("06413", "5406010" + (i + 1)))];
}

function save(h, tableName, year, data) {
  const res = post(h, { action: "save_kpi_data", tableName, year, data });
  assert.equal(res.status, "success", res.message);
}

test("years: the report's source_table rows of sync_status inside the window, oldest first; none synced → []", () => {
  const h = loadWithCatalog([[EPI, 20]], SEED_EPI);
  h.clock.now = Date.parse("2026-10-30T09:00:00+07:00");
  save(h, "s_epi2", "2569", epi2Rows("2569", "202610290915", 3));
  // s_epi_complete holds the 4 fully immunized reports.
  save(h, "s_epi_complete", "2569", COMPLETE.map((id) =>
    ({ id, hospcode: "06413", areacode: "54060101", date_com: "202610290915", b_year: "2569", target: 10, result: 9 })));
  h.clock.now = Date.parse("2026-10-30T09:10:00+07:00");
  save(h, "s_epi2", "2565", epi2Rows("2565", "202209301200", 2));
  h.clock.now = Date.parse("2026-10-30T09:20:00+07:00");
  save(h, "s_epi2", "2567", epi2Rows("2567", "202409301200", 4));
  // The fiscal year changes: the window is 2566–2570 once the 60 s settings
  // cache runs out, and the 2565 row stays in sync_status until the next save.
  setCell(h, "settings", 2, "current_year", 2570);
  h.clock.now = Date.parse("2026-10-30T09:30:00+07:00");

  const byId = Object.fromEntries(getCatalog(h).reports.map((r) => [r.opendata_id, r]));

  assert.deepEqual(byId[EPI2].years, [
    { b_year: "2567", row_count: 4, max_date_com: "202409301200", synced_at: "2026-10-30T02:20:00.000Z" },
    { b_year: "2569", row_count: 3, max_date_com: "202610290915", synced_at: "2026-10-30T02:00:00.000Z" },
  ]);
  for (const id of COMPLETE) {
    assert.deepEqual(byId[id].years,
      [{ b_year: "2569", row_count: 4, max_date_com: "202610290915", synced_at: "2026-10-30T02:00:00.000Z" }], id);
  }
  assert.deepEqual(byId[EPI1].years, []);
});

// GasCatalog (SCHEMA §9) as data: a check per field, [shape] for an array of
// shape, and an object for exactly these keys.
const str = (v) => typeof v === "string";
const num = (v) => typeof v === "number" && Number.isFinite(v);
const orNull = (check) => (v) => v === null || check(v);
const oneOf = (...values) => (v) => values.includes(v);
const isoTime = (v) => str(v) && new Date(v).toISOString() === v;
const recordOf = (check) => (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) && Object.values(v).every(check);
const GAS_CATALOG = {
  meta: { current_year: str, years: [str], district_code: str, generated_at: isoTime },
  areas: [{ id: str, name_th: str }],
  hospitals: [{ hospcode: str, hospname: str, tambon_id: str }],
  topics: [{ cat_id: str, category_name: str, main_report_id: str, main_report_name: str, order: orNull(num) }],
  reports: [{
    opendata_id: str, report_name: str, source_table: str, cat_id: str, main_report_id: str, subgroup: str,
    order: orNull(num), report_type: oneOf("coverage", "workload", null), goal: orNull(num),
    col_target: orNull(str), col_result: orNull(str), measure_goals: recordOf(num),
    catalog_status: oneOf("active", "removed"),
    years: [{ b_year: str, row_count: num, max_date_com: str, synced_at: isoTime }],
  }],
};

// Acceptance 1's small check: walk the JSON against the shape.
function assertShape(value, shape, path) {
  if (typeof shape === "function") {
    assert.ok(shape(value), `${path} = ${JSON.stringify(value)}`);
  } else if (Array.isArray(shape)) {
    assert.ok(Array.isArray(value), `${path} is not an array`);
    value.forEach((item, i) => assertShape(item, shape[0], `${path}[${i}]`));
  } else {
    assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${path} is not an object`);
    assert.deepEqual(Object.keys(value).sort(), Object.keys(shape).sort(), `${path} keys`);
    for (const key of Object.keys(shape)) assertShape(value[key], shape[key], `${path}.${key}`);
  }
}

test("the response is a GasCatalog (SCHEMA §9): every field of the type, of its type, and no other", () => {
  const h = loadWithCatalog([[EPI, 20]], SEED_EPI);
  // The admin's columns of s_epi2 as in the seed (SCHEMA §6).
  setReportCell(h, EPI2, "subgroup", "กลุ่มอายุ 2 ปี");
  setReportCell(h, EPI2, "order", 20);
  setReportCell(h, EPI2, "report_type", "coverage");
  setReportCell(h, EPI2, "goal", 90);
  h.clock.now = Date.parse("2026-10-30T09:00:00+07:00");
  save(h, "s_epi2", "2569", epi2Rows("2569", "202610290915", 3));

  const catalog = getCatalog(h);

  assertShape(catalog, GAS_CATALOG, "catalog");
  assert.deepEqual(catalog.reports.find((r) => r.opendata_id === EPI2), {
    opendata_id: EPI2,
    report_name: "ความครอบคลุมของเด็กอายุครบ 2 ปีที่ได้รับวัคซีนแต่ละชนิด รายไตรมาส",
    source_table: "s_epi2",
    cat_id: EPI,
    main_report_id: "73daf277928bc32a1b3c8e772192543c",
    subgroup: "กลุ่มอายุ 2 ปี",
    order: 20,
    report_type: "coverage",
    goal: 90,
    col_target: null,
    col_result: null,
    measure_goals: { dtp4: 90, opv4: 90, mmr1: 95, mmr2: 95, je2: 90 },
    catalog_status: "active",
    years: [{ b_year: "2569", row_count: 3, max_date_com: "202610290915", synced_at: "2026-10-30T02:00:00.000Z" }],
  });
});

test("a report ticked after a call shows on the next call (no cache), while BATCH_ALL's 60 s DC units cache still lags", () => {
  const ipv = "d8976d09a8e90349cf356e1135b36c2e"; // s_ipv, not a PA unit
  const h = loadWithCatalog([[EPI, 20]], [EPI2]);
  h.clock.now = Date.parse("2026-10-30T09:00:00+07:00");
  const batchAll = () => JSON.parse(h.gas.doGet({ parameter: { sheet: "BATCH_ALL" } }).getContent());
  batchAll(); // PA's call fills dc_units_v1 (SCHEMA §3.5)
  const before = getCatalog(h);

  enable(h, ipv);
  const after = getCatalog(h);

  assert.deepEqual(ids(before.reports), [EPI2]);
  assert.deepEqual(ids(after.reports), [EPI2, ipv].sort());
  assert.ok(!batchAll().meta.kpi_config.some((u) => u.table === "s_ipv"), "BATCH_ALL still serves the cached DC units");
});

// The catalog sheets, which must only be read under the script lock.
const CATALOG_SHEETS = ["hdc_topics", "hdc_reports", "sync_status", "kpi_epi", "tambon_master", "hospitals"];

test("catalog takes the script lock once and releases it", () => {
  const h = loadWithCatalog([[EPI, 20]], SEED_EPI);
  // readSettings (PA code) locks by itself on a cache miss: warm it first so
  // only doGet's lock is counted.
  h.gas.readSettings();
  h.lock.tryLock = 0;
  h.lock.releaseLock = 0;

  const catalog = getCatalog(h);

  assert.equal(catalog.reports.length, 8);
  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

// SCHEMA §3: readSettings takes and releases the lock itself on a cache miss,
// which would drop doGet's lock if called while doGet holds it.
test("catalog with a cold settings cache never calls tryLock while it holds the lock", () => {
  const h = loadWithCatalog([[EPI, 20]], SEED_EPI);
  h.clock.now = Date.parse("2026-10-30T09:00:00+07:00"); // the caches filled at 08:00 have run out

  const catalog = getCatalog(h);

  assert.equal(catalog.reports.length, 8);
  assert.equal(h.lock.nested, 0);
  assert.equal(h.lock.releaseLock, h.lock.tryLock);
});

test("while another execution holds the script lock past the 30 s wait → error Busy, and no catalog sheet is read", () => {
  const h = loadWithCatalog([[EPI, 20]], SEED_EPI);
  h.otherHolder.held = true;
  const before = CATALOG_SHEETS.map((name) => h.reads(name));

  const res = getCatalog(h);

  assert.deepEqual(res, { status: "error", message: "Busy" });
  assert.deepEqual(CATALOG_SHEETS.map((name) => h.reads(name)), before);
});
