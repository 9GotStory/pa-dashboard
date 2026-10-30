import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { loadGas } from "./gas-harness.js";
import { PA_SHEETS } from "./fixtures/batch-all-sheets.js";

// FEATURES F04.

// BATCH_ALL's response to PA_SHEETS from the code before F04 (main at
// 6b37bd7, recorded 30 Oct 2569).
const BEFORE = JSON.parse(fs.readFileSync(new URL("./fixtures/batch-all-before-f04.json", import.meta.url)));

// The vaccine topic from the catalog export of 30 Oct 2569 (SCHEMA §5.5).
const EXPORT = JSON.parse(fs.readFileSync(new URL("./fixtures/hdc-catalog-20261030-subset.json", import.meta.url)));
const EPI = "4df360514655f79f13901ef1181ca1c7";
const IPV = "d8976d09a8e90349cf356e1135b36c2e"; // s_ipv: not a PA unit
const EPI2 = "71e49e4b61aafee17761601c506d5f85"; // s_epi2: a PA unit (CONFIG.KPIS)

// A DC unit in meta.kpi_config: no kpi_master settings (SCHEMA §3.5).
function dcUnit(table) {
  return { table, sheet: table, isQuarterly: false, target_months: null, effective_quarter: null, limit: null };
}

function batchAll(h) {
  return JSON.parse(h.gas.doGet({ parameter: { sheet: "BATCH_ALL" } }).getContent());
}

// A sheet's data rows as objects keyed by its header row.
function records(values) {
  const [header, ...rows] = values;
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

// One row of s_ipv in อำเภอ 5406.
const IPV_ROWS = [
  { id: IPV, hospcode: "10953", areacode: "54060101", date_com: "202610290915", b_year: "2569", target: 6, result: 5 },
];

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

// The admin's steps (SPEC §13) on top of the PA sheets: setup=datacenter, the
// vaccine topic in hdc_topics, refresh the catalog, tick the given reports.
function loadWithCatalog(enabledIds, fetch = undefined) {
  const h = loadGas({ sheets: PA_SHEETS, fetch });
  h.gas.doGet({ parameter: { action: "diag", pin: vm.runInContext("CONFIG.DIAG_PIN", h.gas), setup: "datacenter" } });
  setCell(h, "hdc_topics", 2, "cat_id", EPI);
  const saved = post(h, { action: "save_catalog", cat_id: EPI, reports: EXPORT.reports[EPI] });
  assert.equal(saved.status, "success", saved.message);
  enabledIds.forEach((id) => enable(h, id));
  return h;
}

test("BATCH_ALL without hdc_reports is the response from before F04 plus meta.years 2565…2569", () => {
  const h = loadGas({ sheets: PA_SHEETS });

  const res = batchAll(h);

  const { years, ...meta } = res.meta;
  assert.deepEqual(years, ["2565", "2566", "2567", "2568", "2569"]);
  assert.deepEqual({ ...res, meta }, BEFORE);
});

test("active reports add their source_table to meta.kpi_config once, after the PA units; data and the rest of meta are unchanged", () => {
  // s_epi2 is already a PA unit; the other reports (s_influenza, …) keep enabled = FALSE.
  const h = loadWithCatalog([IPV, EPI2]);

  const res = batchAll(h);

  assert.deepEqual(res, {
    data: BEFORE.data,
    meta: { ...BEFORE.meta, years: res.meta.years, kpi_config: [...BEFORE.meta.kpi_config, dcUnit("s_ipv")] },
  });
});

test("BATCH_ALL twice in a row → the second reads neither hdc_reports nor hdc_topics, and still lists s_ipv", () => {
  const h = loadWithCatalog([IPV]);
  batchAll(h);
  const reads = { hdc_reports: h.reads("hdc_reports"), hdc_topics: h.reads("hdc_topics") };

  const res = batchAll(h);

  assert.deepEqual({ hdc_reports: h.reads("hdc_reports"), hdc_topics: h.reads("hdc_topics") }, reads);
  assert.deepEqual(res.meta.kpi_config.at(-1), dcUnit("s_ipv"));
});

test("a report ticked after a BATCH_ALL shows up once the admin runs Clear Config Cache", () => {
  const h = loadWithCatalog([]);
  batchAll(h);
  enable(h, IPV);
  assert.deepEqual(batchAll(h).meta.kpi_config, BEFORE.meta.kpi_config, "cached for up to 60 s");

  h.gas.clearConfigCache();

  assert.deepEqual(batchAll(h).meta.kpi_config, [...BEFORE.meta.kpi_config, dcUnit("s_ipv")]);
});

test("save_catalog that moves an active report to another source_table → the next BATCH_ALL lists the new table", () => {
  const h = loadWithCatalog([IPV]);
  batchAll(h);
  const renamed = EXPORT.reports[EPI].map((r) => (r.opendata_id === IPV ? { ...r, source_table: "s_ipv2" } : r));

  const saved = post(h, { action: "save_catalog", cat_id: EPI, reports: renamed });

  assert.equal(saved.status, "success", saved.message);
  assert.deepEqual(batchAll(h).meta.kpi_config, [...BEFORE.meta.kpi_config, dcUnit("s_ipv2")]);
});

test("save_kpi_data accepts the source_table of an active report (s_ipv) and rejects that of a report with enabled = FALSE (s_influenza)", () => {
  const h = loadWithCatalog([IPV]);

  const ipv = post(h, { action: "save_kpi_data", tableName: "s_ipv", year: "2569", data: IPV_ROWS });
  const influenza = post(h, { action: "save_kpi_data", tableName: "s_influenza", year: "2569", data: IPV_ROWS });

  assert.deepEqual(ipv, { status: "success", year: "2569", sheet: "s_ipv", received: 1, count: 1, archived: [] });
  assert.deepEqual(influenza, { status: "error", message: "Unknown table: s_influenza" });
  assert.equal(h.sheet("s_influenza"), null);
});

test("syncAllData fetches every sync unit, the DC unit s_ipv last, and saves it", () => {
  const h = loadWithCatalog([IPV], (url, payload) => ({
    code: 201,
    body: payload.tableName === "s_ipv" ? { data: IPV_ROWS, total: "1" } : { data: [], total: "0" },
  }));
  // setup=datacenter (a diag call) probes MOPH too.
  const fetchesBefore = h.fetches.length;

  h.gas.syncAllData();

  assert.deepEqual(
    h.fetches.slice(fetchesBefore).map((f) => f.payload.tableName),
    [...BEFORE.meta.kpi_config.map((k) => k.table), "s_ipv"],
  );
  assert.deepEqual(records(h.sheet("s_ipv")).map((r) => r.areacode), ["54060101"]);
});

test("single-sheet mode serves PA units only: ?sheet=s_ipv is refused even though s_ipv is a sync unit", () => {
  const h = loadWithCatalog([IPV]);
  post(h, { action: "save_kpi_data", tableName: "s_ipv", year: "2569", data: IPV_ROWS });

  const ipv = JSON.parse(h.gas.doGet({ parameter: { sheet: "s_ipv" } }).getContent());
  const anc12 = JSON.parse(h.gas.doGet({ parameter: { sheet: "s_kpi_anc12" } }).getContent());

  assert.deepEqual(ipv, { status: "error", message: "Unknown or forbidden sheet: s_ipv" });
  assert.equal(anc12.length, 5);
});

test("after each PA data sheet is saved through save_kpi_data (อำเภอ rows only), BATCH_ALL has exactly the rows PA showed before", () => {
  const h = loadGas({ sheets: PA_SHEETS });
  const dataSheets = Object.keys(PA_SHEETS).filter((name) => name.startsWith("s_"));
  for (const table of dataSheets) {
    const saved = post(h, { action: "save_kpi_data", tableName: table, year: "2569", data: records(PA_SHEETS[table]) });
    assert.equal(saved.status, "success", `${table}: ${saved.message}`);
  }

  const res = batchAll(h);

  // PA keeps the rows whose areacode starts with 5406 (TARGET_AREA_PREFIX in
  // src/lib/useKPIData.ts).
  const shownBefore = Object.fromEntries(
    Object.entries(BEFORE.data).map(([table, rows]) => [table, rows.filter((r) => r.areacode.startsWith("5406"))]),
  );
  assert.deepEqual(res.data, shownBefore);
  assert.ok(dataSheets.every((table) => records(h.sheet(table)).every((r) => r.areacode.startsWith("5406"))));
});
