import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadGas } from "./gas-harness.js";
import { PA_SHEETS } from "./fixtures/batch-all-sheets.js";
import { ROWS_6712, ROWS_6812 } from "./fixtures/registry-population-20261106.js";

// FEATURES F24 / SCHEMA §2.6, §3.8, §3.9.

const SETTINGS = [
  ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
  [4, 2569, 54, 5406, ""],
];

// registry_population's header (SCHEMA §2.6): the 13 values of a stat_t line
// in file order, then uploaded_at.
const HEADER = [
  "yymm", "cc", "cc_name", "rcode", "rcode_name", "tt", "tt_name", "mm", "mm_name",
  "male", "female", "total", "house", "uploaded_at",
];

// PA-Data with settings, at 10:00 on 6 Nov 2569 (Bangkok): 2568 has ended.
function load(sheets = {}) {
  const h = loadGas({ sheets: { settings: SETTINGS, ...sheets } });
  h.clock.now = Date.parse("2026-11-06T10:00:00+07:00");
  return h;
}

function post(h, body) {
  return JSON.parse(h.gas.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}

function savePopulation(h, yymm, rows) {
  return post(h, { action: "save_registry_population", kind: "population", yymm, rows });
}

// A sheet's data rows as objects keyed by its header row.
function records(values) {
  const [header, ...rows] = values;
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

// A record without uploaded_at, as the upload sent it.
function sent(record) {
  const row = { ...record };
  delete row.uploaded_at;
  return row;
}

test("first kind: population of 6812 → registry_population created with its header and the 10 rows as sent, uploaded_at = now, no blank rows below", () => {
  const h = load();

  const res = savePopulation(h, "6812", ROWS_6812);

  assert.deepEqual(res, { status: "success", kind: "population", yymm: "6812", count: 10 });
  const sheet = h.sheet("registry_population");
  assert.deepEqual(sheet[0], HEADER);
  assert.deepEqual(records(sheet).map(sent), ROWS_6812);
  assert.ok(records(sheet).every((r) => r.uploaded_at.getTime() === h.clock.now));
  assert.equal(h.maxRows("registry_population"), 11);
});

test("6812 saved again → only 6812's rows are replaced; 6712, saved in between, keeps its rows and uploaded_at, and sorts first", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  h.clock.now += 60_000;
  savePopulation(h, "6712", ROWS_6712);
  const saved6712 = records(h.sheet("registry_population")).filter((r) => r.yymm === "6712");
  h.clock.now += 60_000;
  // stat.bora corrects ตำบลทุ่งน้าว in its 6812 file.
  const corrected = ROWS_6812.map((r) => (r.tt === "54060800" ? { ...r, male: 1567, total: 3201 } : r));

  const res = savePopulation(h, "6812", corrected);

  assert.deepEqual(res, { status: "success", kind: "population", yymm: "6812", count: 10 });
  const rows = records(h.sheet("registry_population"));
  assert.deepEqual(rows.slice(0, 10), saved6712);
  assert.deepEqual(rows.slice(10).map(sent), corrected);
  assert.ok(rows.slice(10).every((r) => r.uploaded_at.getTime() === h.clock.now));
  assert.equal(h.maxRows("registry_population"), 21);
});

test("a save takes the script lock once and releases it", () => {
  const h = load();
  // readSettings and readKpiMasterConfig (PA code) lock by themselves on a
  // cache miss: warm them first so only doPost's lock is counted.
  h.gas.readSettings();
  h.gas.readKpiMasterConfig();
  h.lock.tryLock = 0;
  h.lock.releaseLock = 0;

  savePopulation(h, "6812", ROWS_6812);

  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

// SCHEMA §3: readSettings takes and releases the lock itself on a cache miss,
// which would drop doPost's lock if the save called it cold.
test("a save with cold caches never calls tryLock while the lock is held", () => {
  const h = load();

  const res = savePopulation(h, "6812", ROWS_6812);

  assert.equal(res.status, "success");
  assert.equal(h.lock.nested, 0);
  assert.equal(h.lock.releaseLock, h.lock.tryLock);
});

// ROWS_6812 with row i changed (a key set to undefined is left out, as JSON drops it).
function withRow(i, change) {
  return ROWS_6812.map((r, j) => (j === i ? { ...r, ...change } : r));
}

// Requests that break one rule of SCHEMA §3.8 (rules 1–10; 11–14 are F27's):
// [what, changes to a valid body for 6812, the error message].
const REJECTED = [
  ["kind age (F27)", { kind: "age" }, "Unknown kind"],
  ["no kind", { kind: undefined }, "Unknown kind"],
  ["yymm of November", { yymm: "6811" }, "Invalid yymm"],
  ["yymm as a number", { yymm: 6812 }, "Invalid yymm"],
  ["yymm of 2569, which has not ended on 6 Nov 2569", { yymm: "6912" }, "Invalid yymm"],
  ["no rows", { rows: [] }, "Empty rows"],
  ["rows missing", { rows: undefined }, "Empty rows"],
  ["rows not an array", { rows: { 0: ROWS_6812[0] } }, "Empty rows"],
  ["a row without house", { rows: withRow(3, { house: undefined }) }, "Row keys do not match the header"],
  ["a row with uploaded_at", { rows: withRow(3, { uploaded_at: "2026-11-06" }) }, "Row keys do not match the header"],
  ["a row that is null", { rows: [...ROWS_6812.slice(0, 9), null] }, "Row keys do not match the header"],
  ["a row of 6712", { rows: withRow(9, { yymm: "6712" }) }, "Row of another yymm"],
  ["cc of 3 digits", { rows: withRow(0, { cc: "054" }) }, "Invalid value"],
  ["rcode as a number", { rows: withRow(0, { rcode: 5406 }) }, "Invalid value"],
  ["tt as a number", { rows: withRow(0, { tt: 54060100 }) }, "Invalid value"],
  ["tt_name null", { rows: withRow(0, { tt_name: null }) }, "Invalid value"],
  ["male below 0", { rows: withRow(0, { male: -1, total: 2399 }) }, "Invalid value"],
  ["female not a whole number", { rows: withRow(0, { female: 2400.5, total: 4536.5 }) }, "Invalid value"],
  ["house as a string", { rows: withRow(0, { house: "2163" }) }, "Invalid value"],
  ["ตำบลน้ำชำ of อำเภอเมืองแพร่ (54010300)", { rows: withRow(4, { tt: "54010300" }) }, "Row outside district"],
  ["tt of 7 digits", { rows: withRow(4, { tt: "5406050" }) }, "Row outside district"],
  ["a หมู่บ้าน row (mm 1)", { rows: withRow(5, { mm: "1" }) }, "Not a tambon row"],
  ["5406's ตำบลบ้านหนุน twice", { rows: [...ROWS_6812, ROWS_6812[0]] }, "Duplicate tambon row"],
  ["male + female ≠ total", { rows: withRow(7, { total: 3201 }) }, "Male + female does not equal total"],
  // Rule by rule over every row: rule 5 fails on row 10 before rule 7 on row 1.
  ["row 1 outside the district and row 10 of 6712", { rows: withRow(9, { yymm: "6712" }).map((r, j) => (j === 0 ? { ...r, tt: "54010300" } : r)) }, "Row of another yymm"],
];

// Every sheet but system_logs, to tell that nothing was written.
function sheetsExceptLogs(h) {
  return Object.fromEntries(h.sheetNames().filter((name) => name !== "system_logs").map((name) => [name, h.sheet(name)]));
}

for (const [what, change, message] of REJECTED) {
  test(`${what} → error ${message}, no sheet written, an ERROR in system_logs`, () => {
    const h = load();
    savePopulation(h, "6712", ROWS_6712);
    const before = sheetsExceptLogs(h);

    const res = post(h, { action: "save_registry_population", kind: "population", yymm: "6812", rows: ROWS_6812, ...change });

    assert.deepEqual(res, { status: "error", message });
    assert.deepEqual(sheetsExceptLogs(h), before);
    const errors = records(h.sheet("system_logs")).filter((r) => r.Type === "ERROR");
    assert.deepEqual(errors.map((r) => r.Details), [message]);
  });
}

test("a rejected save logs only checked values: no kind or yymm from the request reaches system_logs until it passed its rule", () => {
  const h = load();

  post(h, { action: "save_registry_population", kind: "<b>x</b>", yymm: "6812", rows: ROWS_6812 });
  post(h, { action: "save_registry_population", kind: "population", yymm: "=IMPORTXML()", rows: ROWS_6812 });
  post(h, { action: "save_registry_population", kind: "population", yymm: "6812", rows: [] });

  const logged = JSON.stringify(h.sheet("system_logs"));
  assert.ok(!logged.includes("<b>x</b>") && !logged.includes("IMPORTXML"), logged);
  const errors = records(h.sheet("system_logs")).filter((r) => r.Type === "ERROR");
  assert.deepEqual(errors.map((r) => r.Details), ["Unknown kind", "Invalid yymm", "Empty rows"]);
  assert.match(errors[2].Message, /population 6812/);
});

test("yymm 6912 → Invalid yymm at 23:59 on 31 Dec 2569 in Bangkok, saved at 00:00 on 1 Jan 2570 (still 2569 in UTC)", () => {
  const h = load();
  const rows = ROWS_6812.map((r) => ({ ...r, yymm: "6912" }));

  h.clock.now = Date.parse("2026-12-31T23:59:00+07:00");
  const before = savePopulation(h, "6912", rows);
  h.clock.now = Date.parse("2027-01-01T00:00:00+07:00");
  const after = savePopulation(h, "6912", rows);

  assert.deepEqual(before, { status: "error", message: "Invalid yymm" });
  assert.deepEqual(after, { status: "success", kind: "population", yymm: "6912", count: 10 });
});

test("sheet, sheetName and tableName in the body are ignored: only registry_population is written", () => {
  const h = load({ hospitals: [["hospcode", "hospname", "tambon_id"], ["06413", "บ้านหนุน", "540601"]] });
  const before = sheetsExceptLogs(h);

  const res = post(h, {
    action: "save_registry_population", kind: "population", yymm: "6812", rows: ROWS_6812,
    sheet: "settings", sheetName: "hospitals", tableName: "s_epi2",
  });

  assert.equal(res.status, "success");
  const after = sheetsExceptLogs(h);
  assert.deepEqual(Object.keys(after).sort(), [...Object.keys(before), "registry_population"].sort());
  for (const name of Object.keys(before)) assert.deepEqual(after[name], before[name], name);
});

function getRegistryPopulation(h) {
  return JSON.parse(h.gas.doGet({ parameter: { action: "registry_population" } }).getContent());
}

test("GET after saving 6812 then 6712 → both years oldest first, each with its rows as sent and no age rows", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  savePopulation(h, "6712", ROWS_6712);

  const res = getRegistryPopulation(h);

  assert.deepEqual(res, {
    years: [
      { yymm: "6712", population: ROWS_6712, age: [] },
      { yymm: "6812", population: ROWS_6812, age: [] },
    ],
  });
});

test("GET before either sheet exists → { years: [] }, not an error", () => {
  const h = load();

  assert.deepEqual(getRegistryPopulation(h), { years: [] });
});

test("GET takes the script lock once and releases it", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  h.gas.readSettings();
  h.lock.tryLock = 0;
  h.lock.releaseLock = 0;

  getRegistryPopulation(h);

  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

test("GET while another execution holds the script lock past the 30 s wait → error Busy, and neither sheet is read", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  h.otherHolder.held = true;
  const before = [h.reads("registry_population"), h.reads("registry_population_age")];

  const res = getRegistryPopulation(h);

  assert.deepEqual(res, { status: "error", message: "Busy" });
  assert.deepEqual([h.reads("registry_population"), h.reads("registry_population_age")], before);
});

test("GET reads registry_population by header name (trim + lower case) in any column order; codes typed in as numbers come back as strings, counts as numbers", () => {
  // The admin reordered the columns and retyped some cells (SCHEMA §3.9).
  const h = load({
    registry_population: [
      [" House", "YYMM", "cc", "cc_name", "rcode", "rcode_name", "TT ", "tt_name", "mm", "mm_name", "male", "female", "total", "uploaded_at"],
      ["2163", 6812, 54, "จังหวัดแพร่", 5406, "อำเภอสอง", 54060100, "ตำบลบ้านหนุน", 0, "", 2136, 2400, 4536, new Date("2026-11-06T03:00:00Z")],
    ],
  });

  const res = getRegistryPopulation(h);

  assert.deepEqual(res, { years: [{ yymm: "6812", population: [ROWS_6812[0]], age: [] }] });
});

// registry_population_age's columns (SCHEMA §2.7) without uploaded_at.
const AGE_COLUMNS = [
  "yymm", "rcode", "tt", "tt_name",
  ...Array.from({ length: 102 }, (_, a) => [`m${a}`, `f${a}`]).flat(),
  ...["lunar", "central", "nonthai", "moving", "total"].flatMap((g) => [`${g}_m`, `${g}_f`, `${g}_t`]),
];

test("GET returns registry_population_age rows too, typed as SCHEMA §2.7 says; years are every yymm of either sheet", () => {
  // An age row of ตำบลบ้านหนุน (5489) in 6812, and one of 6712, a year with
  // no registry_population rows, as written by hand.
  const counts = Object.fromEntries(AGE_COLUMNS.slice(4).map((c, i) => [c, i % 7]));
  const row6812 = { yymm: "6812", rcode: "5489", tt: "54060100", tt_name: "ตำบลบ้านหนุน", ...counts };
  const row6712 = { ...row6812, yymm: "6712" };
  const sheetRow = (row) => [...AGE_COLUMNS.map((c) => (c === "rcode" || c === "tt" ? Number(row[c]) : row[c])), new Date()];
  const h = load({ registry_population_age: [[...AGE_COLUMNS, "uploaded_at"], sheetRow(row6812), sheetRow(row6712)] });
  savePopulation(h, "6812", ROWS_6812);

  const res = getRegistryPopulation(h);

  assert.deepEqual(res, {
    years: [
      { yymm: "6712", population: [], age: [row6712] },
      { yymm: "6812", population: ROWS_6812, age: [row6812] },
    ],
  });
});

// BATCH_ALL's response to PA_SHEETS from the code before F04 (batch-all.test.js).
const BATCH_ALL_BEFORE_F04 = JSON.parse(fs.readFileSync(new URL("./fixtures/batch-all-before-f04.json", import.meta.url)));

test("registry_population is no PA unit, sync unit or BATCH_ALL table: BATCH_ALL is unchanged with it saved, and save_kpi_data refuses it", () => {
  const h = loadGas({ sheets: PA_SHEETS });
  h.clock.now = Date.parse("2026-11-06T10:00:00+07:00");
  savePopulation(h, "6812", ROWS_6812);
  const saved = h.sheet("registry_population");

  const batch = JSON.parse(h.gas.doGet({ parameter: { sheet: "BATCH_ALL" } }).getContent());
  const kpi = post(h, { action: "save_kpi_data", tableName: "registry_population", year: "2569", data: ROWS_6812 });

  const { years, ...meta } = batch.meta;
  assert.deepEqual(years, ["2565", "2566", "2567", "2568", "2569"]);
  assert.deepEqual({ ...batch, meta }, BATCH_ALL_BEFORE_F04);
  assert.deepEqual(kpi, { status: "error", message: "Unknown table: registry_population" });
  assert.deepEqual(h.sheet("registry_population"), saved);
});
