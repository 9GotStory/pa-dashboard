import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadGas } from "./gas-harness.js";
import { PA_SHEETS } from "./fixtures/batch-all-sheets.js";
import { AGE_COLUMNS, AGE_ROWS_6712, AGE_ROWS_6812, ROWS_6712, ROWS_6812 } from "./fixtures/registry-population-20261106.js";
import { VILLAGE_ROWS_6712, VILLAGE_ROWS_6812 } from "./fixtures/registry-population-village-20261111.js";

// FEATURES F24, F27, F44 / SCHEMA §2.6–2.8, §3.8, §3.9.

const SETTINGS = [
  ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
  [4, 2569, 54, 5406, ""],
];

// registry_population's header (SCHEMA §2.6): the 13 values of a stat_m line
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

// Requests of kind population that break one rule of SCHEMA §3.8 (rules
// 1–10; rule 14 and kind age come with F27, below): [what, changes to a valid
// body for 6812, the error message].
const REJECTED = [
  ["kind of another name", { kind: "ages" }, "Unknown kind"],
  ["no kind", { kind: undefined }, "Unknown kind"],
  ["the ตำบล rows of stat_m sent as kind age", { kind: "age" }, "Row keys do not match the header"],
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
  ["a tt_name that setValues would write as a formula (=1+1)", { rows: withRow(0, { tt_name: "=1+1" }) }, "Invalid value"],
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
      { yymm: "6712", population: ROWS_6712, village: [], age: [] },
      { yymm: "6812", population: ROWS_6812, village: [], age: [] },
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

test("GET while another execution holds the script lock past the 30 s wait → error Busy, and no sheet is read", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveVillage(h, "6812", VILLAGE_ROWS_6812);
  h.otherHolder.held = true;
  const sheets = ["registry_population", "registry_population_village", "registry_population_age"];
  const before = sheets.map((name) => h.reads(name));

  const res = getRegistryPopulation(h);

  assert.deepEqual(res, { status: "error", message: "Busy" });
  assert.deepEqual(sheets.map((name) => h.reads(name)), before);
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

  assert.deepEqual(res, { years: [{ yymm: "6812", population: [ROWS_6812[0]], village: [], age: [] }] });
});

// The admin typing value into (row, column by header name) of a sheet.
function setCell(h, sheetName, row, column, value) {
  const col = h.sheet(sheetName)[0].indexOf(column) + 1;
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getRange(row, col).setValues([[value]]);
}

function setPopulationCell(h, row, column, value) {
  setCell(h, "registry_population", row, column, value);
}

// A row without the given keys.
function omit(row, ...keys) {
  const out = { ...row };
  keys.forEach((key) => delete out[key]);
  return out;
}

test("GET after the admin renames the house column (บ้าน) → every row leaves house out, so the prebuild fails loudly (SCHEMA §7) instead of showing 0 บ้าน", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  setPopulationCell(h, 1, "house", "บ้าน");

  const res = getRegistryPopulation(h);

  assert.deepEqual(res, { years: [{ yymm: "6812", population: ROWS_6812.map((r) => omit(r, "house")), village: [], age: [] }] });
});

test("GET after the admin blanks one count and types text into another → each is left out of its row, not read as 0 or null", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  setPopulationCell(h, 3, "male", "");
  setPopulationCell(h, 4, "female", "สองพัน");

  const res = getRegistryPopulation(h);

  const expected = ROWS_6812.map((r, i) => (i === 1 ? omit(r, "male") : i === 2 ? omit(r, "female") : r));
  assert.deepEqual(res, { years: [{ yymm: "6812", population: expected, village: [], age: [] }] });
});

test("GET after the admin blanks the yymm of a row in each sheet, its other cells kept → those rows are in the answer as a year with a blank yymm, so the prebuild fails loudly (SCHEMA §7) instead of publishing a total short of them", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveAge(h, "6812", AGE_ROWS_6812);
  setCell(h, "registry_population", 2, "yymm", "");
  setCell(h, "registry_population_age", 5, "yymm", "");

  const res = getRegistryPopulation(h);

  assert.deepEqual(res, {
    years: [
      { yymm: "", population: [{ ...ROWS_6812[0], yymm: "" }], village: [], age: [{ ...AGE_ROWS_6812[3], yymm: "" }] },
      { yymm: "6812", population: ROWS_6812.slice(1), village: [], age: AGE_ROWS_6812.filter((_, i) => i !== 3) },
    ],
  });
});

test("GET after the admin clears a row but for a count that is no number → the row stays, under a blank yymm and without that count, because a value is left in it", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  HEADER.filter((column) => column !== "uploaded_at").forEach((column) => setPopulationCell(h, 3, column, ""));
  setPopulationCell(h, 3, "male", "สองพัน");

  const res = getRegistryPopulation(h);

  const blank = { yymm: "", cc: "", cc_name: "", rcode: "", rcode_name: "", tt: "", tt_name: "", mm: "", mm_name: "" };
  assert.deepEqual(res, {
    years: [
      { yymm: "", population: [blank], village: [], age: [] },
      { yymm: "6812", population: ROWS_6812.filter((_, i) => i !== 1), village: [], age: [] },
    ],
  });
});

test("GET after the admin clears a whole row of each sheet, and another but for its uploaded_at → those are no rows, and the other rows come back as sent", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveAge(h, "6812", AGE_ROWS_6812);
  for (const [sheet, columns] of [["registry_population", HEADER], ["registry_population_age", [...AGE_COLUMNS, "uploaded_at"]]]) {
    columns.forEach((column) => setCell(h, sheet, 3, column, ""));
    columns.filter((column) => column !== "uploaded_at").forEach((column) => setCell(h, sheet, 5, column, ""));
  }
  // A space looks blank in the sheet, and every other column is read trimmed.
  setCell(h, "registry_population", 3, "tt_name", " ");

  const res = getRegistryPopulation(h);

  const others = (rows) => rows.filter((_, i) => i !== 1 && i !== 3);
  assert.deepEqual(res, { years: [{ yymm: "6812", population: others(ROWS_6812), village: [], age: others(AGE_ROWS_6812) }] });
});

test("GET after the admin deletes the header row → the rows left stay in the answer without any column, so the prebuild fails loudly (SCHEMA §7) instead of publishing no population", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName("registry_population").deleteRows(1, 1);

  const res = getRegistryPopulation(h);

  // Row 1 is now ROWS_6812[0], read as the header: the other 9 are read by it.
  assert.deepEqual(res, { years: [{ population: ROWS_6812.slice(1).map(() => ({})), village: [], age: [] }] });
});

test("GET after the admin types a date and TRUE and FALSE into counts → each is left out of its row, not read as a number; a count typed as text is still a number", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  setPopulationCell(h, 2, "male", new Date("2026-01-02T00:00:00Z"));
  setPopulationCell(h, 3, "house", true);
  setPopulationCell(h, 4, "female", false);
  setPopulationCell(h, 5, "total", "7992");

  const res = getRegistryPopulation(h);

  const expected = ROWS_6812.map((r, i) => (i === 0 ? omit(r, "male") : i === 1 ? omit(r, "house") : i === 2 ? omit(r, "female") : r));
  assert.deepEqual(res, { years: [{ yymm: "6812", population: expected, village: [], age: [] }] });
});

test("GET returns registry_population_age rows too, typed as SCHEMA §2.7 says; years are every yymm of either sheet", () => {
  // An age row of ตำบลบ้านหนุน (5489) in 6812, and one of 6712, a year with
  // no registry_population rows, written by hand after the population of 6812
  // is saved (which would be refused against this row, SCHEMA §3.8 rule 14).
  const counts = Object.fromEntries(AGE_COLUMNS.slice(4).map((c, i) => [c, i % 7]));
  const row6812 = { yymm: "6812", rcode: "5489", tt: "54060100", tt_name: "ตำบลบ้านหนุน", ...counts };
  const row6712 = { ...row6812, yymm: "6712" };
  const sheetRow = (row) => [...AGE_COLUMNS.map((c) => (c === "rcode" || c === "tt" ? Number(row[c]) : row[c])), new Date()];
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  const values = [[...AGE_COLUMNS, "uploaded_at"], sheetRow(row6812), sheetRow(row6712)];
  h.gas.SpreadsheetApp.getActiveSpreadsheet().insertSheet("registry_population_age")
    .getRange(1, 1, values.length, values[0].length).setValues(values);

  const res = getRegistryPopulation(h);

  assert.deepEqual(res, {
    years: [
      { yymm: "6712", population: [], village: [], age: [row6712] },
      { yymm: "6812", population: ROWS_6812, village: [], age: [row6812] },
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

// FEATURES F27: kind age, and rule 14 of kind population (SCHEMA §2.7, §3.8).

function saveAge(h, yymm, rows) {
  return post(h, { action: "save_registry_population", kind: "age", yymm, rows });
}

test("kind: age of 6812 after its population → registry_population_age created with its header and the 10 rows as sent, uploaded_at = now, no blank rows below", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);

  const res = saveAge(h, "6812", AGE_ROWS_6812);

  assert.deepEqual(res, { status: "success", kind: "age", yymm: "6812", count: 10 });
  const sheet = h.sheet("registry_population_age");
  assert.deepEqual(sheet[0], [...AGE_COLUMNS, "uploaded_at"]);
  assert.deepEqual(records(sheet).map(sent), AGE_ROWS_6812);
  assert.ok(records(sheet).every((r) => r.uploaded_at.getTime() === h.clock.now));
  assert.equal(h.maxRows("registry_population_age"), 11);
});

test("kind: age of 6812 saved again → only 6812's age rows are replaced; 6712's, saved in between, keep their rows and uploaded_at, and sort first", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveAge(h, "6812", AGE_ROWS_6812);
  h.clock.now += 60_000;
  savePopulation(h, "6712", ROWS_6712);
  saveAge(h, "6712", AGE_ROWS_6712);
  const saved6712 = records(h.sheet("registry_population_age")).filter((r) => r.yymm === "6712");
  h.clock.now += 60_000;
  // stat.bora corrects the age of one man of ตำบลทุ่งน้าว in its 6812 file: 31, not 30.
  const corrected = AGE_ROWS_6812.map((r) => (r.rcode === "5406" && r.tt === "54060800" ? { ...r, m30: 25, m31: 26 } : r));

  const res = saveAge(h, "6812", corrected);

  assert.deepEqual(res, { status: "success", kind: "age", yymm: "6812", count: 10 });
  const rows = records(h.sheet("registry_population_age"));
  assert.deepEqual(rows.slice(0, 10), saved6712);
  assert.deepEqual(rows.slice(10).map(sent), corrected);
  assert.ok(rows.slice(10).every((r) => r.uploaded_at.getTime() === h.clock.now));
  assert.equal(h.maxRows("registry_population_age"), 21);
});

test("an age save takes the script lock once and releases it", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  h.gas.readSettings();
  h.gas.readKpiMasterConfig();
  h.lock.tryLock = 0;
  h.lock.releaseLock = 0;

  saveAge(h, "6812", AGE_ROWS_6812);

  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

test("sheet, sheetName and tableName in the body of kind age are ignored: only registry_population_age is written", () => {
  const h = load({ hospitals: [["hospcode", "hospname", "tambon_id"], ["06413", "บ้านหนุน", "540601"]] });
  savePopulation(h, "6812", ROWS_6812);
  const before = sheetsExceptLogs(h);

  const res = post(h, {
    action: "save_registry_population", kind: "age", yymm: "6812", rows: AGE_ROWS_6812,
    sheet: "registry_population", sheetName: "hospitals", tableName: "s_epi2",
  });

  assert.equal(res.status, "success");
  const after = sheetsExceptLogs(h);
  assert.deepEqual(Object.keys(after).sort(), [...Object.keys(before), "registry_population_age"].sort());
  for (const name of Object.keys(before)) assert.deepEqual(after[name], before[name], name);
});

test("GET after the population of 6712 and both kinds of 6812 → 6712 without age rows, 6812 with its age rows as sent", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveAge(h, "6812", AGE_ROWS_6812);
  savePopulation(h, "6712", ROWS_6712);

  assert.deepEqual(getRegistryPopulation(h), {
    years: [
      { yymm: "6712", population: ROWS_6712, village: [], age: [] },
      { yymm: "6812", population: ROWS_6812, village: [], age: AGE_ROWS_6812 },
    ],
  });
});

// AGE_ROWS_6812 with row i changed (a key set to undefined is left out, as JSON drops it).
function withAgeRow(i, change) {
  return AGE_ROWS_6812.map((r, j) => (j === i ? { ...r, ...change } : r));
}
// 5406's ตำบลบ้านหนุน, ตำบลบ้านกลาง and ตำบลห้วยหม้าย.
const [BAN_NUN, , HUAI_MAI] = AGE_ROWS_6812;

// Requests of kind age that break one rule of SCHEMA §3.8, sent once 6812
// has its registry_population rows: [what, changes to a valid body for 6812,
// the error message].
const REJECTED_AGE = [
  ["yymm of November", { yymm: "6811" }, "Invalid yymm"],
  ["yymm of 2569, which has not ended on 6 Nov 2569", { yymm: "6912" }, "Invalid yymm"],
  ["no rows", { rows: [] }, "Empty rows"],
  ["a row without m57", { rows: withAgeRow(3, { m57: undefined }) }, "Row keys do not match the header"],
  ["a row with uploaded_at", { rows: withAgeRow(3, { uploaded_at: "2026-11-06" }) }, "Row keys do not match the header"],
  ["a row of 6712", { rows: withAgeRow(9, { yymm: "6712" }) }, "Row of another yymm"],
  ["rcode as a number", { rows: withAgeRow(0, { rcode: 5406 }) }, "Invalid value"],
  ["a tt_name that setValues would write as a formula (=1+1)", { rows: withAgeRow(0, { tt_name: "=1+1" }) }, "Invalid value"],
  ["m0 below 0", { rows: withAgeRow(0, { m0: -1 }) }, "Invalid value"],
  ["f101 not a whole number", { rows: withAgeRow(0, { f101: 0.5 }) }, "Invalid value"],
  ["total_t as a string", { rows: withAgeRow(0, { total_t: "4536" }) }, "Invalid value"],
  ["ตำบลน้ำชำ of อำเภอเมืองแพร่ (54010300)", { rows: withAgeRow(4, { tt: "54010300" }) }, "Row outside district"],
  ["5406's ตำบลบ้านหนุน twice", { rows: [...AGE_ROWS_6812, BAN_NUN] }, "Duplicate tambon row"],
  ["เกิดปีจันทรคติ ชาย 0 + หญิง 0 with รวม 1", { rows: withAgeRow(1, { lunar_t: 1 }) }, "Male + female does not equal total"],
  ["total_m + total_f ≠ total_t", { rows: withAgeRow(1, { total_t: 3412 }) }, "Male + female does not equal total"],
  ["one more man aged 30 in ตำบลห้วยหม้าย, total_m as before", { rows: withAgeRow(2, { m30: HUAI_MAI.m30 + 1 }) }, "Ages do not add up to total"],
  ["one more woman in ทะเบียนบ้านกลาง (50 + 13 = 63), total_f as before", { rows: withAgeRow(1, { central_f: 13, central_t: 63 }) }, "Ages do not add up to total"],
  ["9 of the 10 rows", { rows: AGE_ROWS_6812.slice(0, 9) }, "Does not match registry_population"],
  ["ตำบลห้วยหม้าย sent as 5489's", { rows: withAgeRow(2, { rcode: "5489" }) }, "Does not match registry_population"],
  [
    "one more boy aged 0 in ตำบลบ้านหนุน and in its totals, so the row adds up but is not stat_m's 2,136 ชาย",
    { rows: withAgeRow(0, { m0: BAN_NUN.m0 + 1, total_m: BAN_NUN.total_m + 1, total_t: BAN_NUN.total_t + 1 }) },
    "Does not match registry_population",
  ],
];

for (const [what, change, message] of REJECTED_AGE) {
  test(`kind: age, ${what} → error ${message}, no sheet written, an ERROR in system_logs`, () => {
    const h = load();
    savePopulation(h, "6812", ROWS_6812);
    const before = sheetsExceptLogs(h);

    const res = post(h, { action: "save_registry_population", kind: "age", yymm: "6812", rows: AGE_ROWS_6812, ...change });

    assert.deepEqual(res, { status: "error", message });
    assert.deepEqual(sheetsExceptLogs(h), before);
    const errors = records(h.sheet("system_logs")).filter((r) => r.Type === "ERROR");
    assert.deepEqual(errors.map((r) => r.Details), [message]);
    assert.match(errors[0].Message, /^Save rejected registry_population_age /);
  });
}

test("kind: age of 6812 before 6812 has registry_population rows (none saved, or only 6712's) → error No registry_population rows for this yymm, no sheet written", () => {
  for (const saved of [[], [ROWS_6712]]) {
    const h = load();
    saved.forEach((rows) => savePopulation(h, rows[0].yymm, rows));
    const before = sheetsExceptLogs(h);

    const res = saveAge(h, "6812", AGE_ROWS_6812);

    assert.deepEqual(res, { status: "error", message: "No registry_population rows for this yymm" });
    assert.deepEqual(sheetsExceptLogs(h), before);
  }
});

// stat_m68.txt's ตำบล rows with ตำบลทุ่งน้าว's ชาย one more (as if stat.bora corrected it), or cut to 9 rows.
const REJECTED_POPULATION_AGAINST_AGE = [
  ["ตำบลทุ่งน้าว's ชาย one more", ROWS_6812.map((r) => (r.rcode === "5406" && r.tt === "54060800" ? { ...r, male: 1567, total: 3201 } : r))],
  ["9 of its 10 rows", ROWS_6812.slice(0, 9)],
];

for (const [what, rows] of REJECTED_POPULATION_AGAINST_AGE) {
  test(`kind: population of 6812 again once 6812 has age rows, ${what} → error Does not match registry_population_age, neither sheet written`, () => {
    const h = load();
    savePopulation(h, "6812", ROWS_6812);
    saveAge(h, "6812", AGE_ROWS_6812);
    const before = sheetsExceptLogs(h);

    const res = savePopulation(h, "6812", rows);

    assert.deepEqual(res, { status: "error", message: "Does not match registry_population_age" });
    assert.deepEqual(sheetsExceptLogs(h), before);
  });
}

// Rules 12–15 of SCHEMA §3.8 read the other sheet, where a row whose yymm is
// blank is a row of no yymm (SCHEMA §3.9): [the kind saved, how many of that
// sheet's 10 rows of 6812 have their yymm blanked, the rows sent, what the
// rule then says, the error or null when saved].
const BLANK_YYMM_IN_THE_OTHER_SHEET = [
  ["age", 10, AGE_ROWS_6812, "rule 12: no registry_population rows of 6812", "No registry_population rows for this yymm"],
  ["age", 1, AGE_ROWS_6812, "rule 13: its 9 rows of 6812 do not match the 10 sent", "Does not match registry_population"],
  ["population", 10, withRow(7, { male: 1567, total: 3201 }), "rule 14: no age rows of 6812 to match, so figures unlike theirs are saved", null],
  ["population", 1, ROWS_6812, "rule 14: its 9 age rows of 6812 do not match the 10 sent", "Does not match registry_population_age"],
  ["village", 10, VILLAGE_ROWS_6812, "rule 12: no registry_population rows of 6812", "No registry_population rows for this yymm"],
  ["village", 1, VILLAGE_ROWS_6812, "rule 15: its 9 rows of 6812 are not the 10 ตำบล the villages add up to", "Villages do not add up to registry_population"],
];

for (const [kind, blanked, rows, what, message] of BLANK_YYMM_IN_THE_OTHER_SHEET) {
  test(`kind: ${kind} of 6812 with the yymm of ${blanked} of the other sheet's 10 rows blanked → ${what}`, () => {
    const h = load();
    savePopulation(h, "6812", ROWS_6812);
    if (kind === "population") saveAge(h, "6812", AGE_ROWS_6812);
    const otherSheet = kind === "population" ? "registry_population_age" : "registry_population";
    for (let row = 2; row < 2 + blanked; row++) setCell(h, otherSheet, row, "yymm", "");

    const res = post(h, { action: "save_registry_population", kind, yymm: "6812", rows });

    assert.deepEqual(res, message ? { status: "error", message } : { status: "success", kind, yymm: "6812", count: rows.length });
  });
}

test("kind: population of 6812 again with the same figures once 6812 has age rows → saved, as when stat_m68.txt is picked again with its age file", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveAge(h, "6812", AGE_ROWS_6812);

  const res = savePopulation(h, "6812", ROWS_6812);

  assert.deepEqual(res, { status: "success", kind: "population", yymm: "6812", count: 10 });
});

// FEATURES F44: kind village (SCHEMA §2.8, §3.8 rules 8, 9, 12 and 15) and
// the village rows of GET (SCHEMA §3.9).

function saveVillage(h, yymm, rows) {
  return post(h, { action: "save_registry_population", kind: "village", yymm, rows });
}

test("kind: village of 6812 after its population → registry_population_village created with its header (that of registry_population) and the 94 rows as sent, uploaded_at = now, no blank rows below", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);

  const res = saveVillage(h, "6812", VILLAGE_ROWS_6812);

  assert.deepEqual(res, { status: "success", kind: "village", yymm: "6812", count: 94 });
  const sheet = h.sheet("registry_population_village");
  assert.deepEqual(sheet[0], HEADER);
  assert.deepEqual(records(sheet).map(sent), VILLAGE_ROWS_6812);
  assert.ok(records(sheet).every((r) => r.uploaded_at.getTime() === h.clock.now));
  assert.equal(h.maxRows("registry_population_village"), 95);
});

test("kind: village of 6812 saved again → only 6812's village rows are replaced; 6712's, saved in between, keep their rows and uploaded_at, and sort first", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveVillage(h, "6812", VILLAGE_ROWS_6812);
  h.clock.now += 60_000;
  savePopulation(h, "6712", ROWS_6712);
  saveVillage(h, "6712", VILLAGE_ROWS_6712);
  const saved6712 = records(h.sheet("registry_population_village")).filter((r) => r.yymm === "6712");
  h.clock.now += 60_000;
  // stat.bora renames หมู่ 1 of บ้านหนุน in its 6812 file.
  const corrected = VILLAGE_ROWS_6812.map((r) => (r.rcode === "5406" && r.mm === "54060101" ? { ...r, mm_name: "หนุนเหนือใหม่" } : r));

  const res = saveVillage(h, "6812", corrected);

  assert.deepEqual(res, { status: "success", kind: "village", yymm: "6812", count: 94 });
  const rows = records(h.sheet("registry_population_village"));
  assert.deepEqual(rows.slice(0, 94), saved6712);
  assert.deepEqual(rows.slice(94).map(sent), corrected);
  assert.ok(rows.slice(94).every((r) => r.uploaded_at.getTime() === h.clock.now));
  assert.equal(h.maxRows("registry_population_village"), 189);
});

test("a village save takes the script lock once and releases it", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  h.gas.readSettings();
  h.gas.readKpiMasterConfig();
  h.lock.tryLock = 0;
  h.lock.releaseLock = 0;

  saveVillage(h, "6812", VILLAGE_ROWS_6812);

  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

test("sheet, sheetName and tableName in the body of kind village are ignored: only registry_population_village is written", () => {
  const h = load({ hospitals: [["hospcode", "hospname", "tambon_id"], ["06413", "บ้านหนุน", "540601"]] });
  savePopulation(h, "6812", ROWS_6812);
  const before = sheetsExceptLogs(h);

  const res = post(h, {
    action: "save_registry_population", kind: "village", yymm: "6812", rows: VILLAGE_ROWS_6812,
    sheet: "registry_population", sheetName: "hospitals", tableName: "s_epi2",
  });

  assert.equal(res.status, "success");
  const after = sheetsExceptLogs(h);
  assert.deepEqual(Object.keys(after).sort(), [...Object.keys(before), "registry_population_village"].sort());
  for (const name of Object.keys(before)) assert.deepEqual(after[name], before[name], name);
});

// VILLAGE_ROWS_6812 with the row of (rcode, mm) changed (a key set to
// undefined is left out, as JSON drops it).
function withVillage(rcode, mm, change) {
  assert.ok(VILLAGE_ROWS_6812.some((r) => r.rcode === rcode && r.mm === mm), `${rcode} ${mm}`);
  return VILLAGE_ROWS_6812.map((r) => (r.rcode === rcode && r.mm === mm ? { ...r, ...change } : r));
}
// หมู่ 1 หนุนเหนือ of บ้านหนุน under 5406: 229 + 249 = 478 คน, 224 บ้าน.
const NUN_NUEA = ["5406", "54060101"];

// Requests of kind village that break one rule of SCHEMA §3.8, sent once 6812
// has its registry_population rows: [what, changes to a valid body for 6812,
// the error message].
const REJECTED_VILLAGE = [
  ["kind of another name", { kind: "villages" }, "Unknown kind"],
  ["yymm of November", { yymm: "6811" }, "Invalid yymm"],
  ["yymm of 2569, which has not ended on 6 Nov 2569", { yymm: "6912" }, "Invalid yymm"],
  ["no rows", { rows: [] }, "Empty rows"],
  ["rows not an array", { rows: { 0: VILLAGE_ROWS_6812[0] } }, "Empty rows"],
  ["a row without house", { rows: withVillage(...NUN_NUEA, { house: undefined }) }, "Row keys do not match the header"],
  ["a row with uploaded_at", { rows: withVillage(...NUN_NUEA, { uploaded_at: "2026-11-11" }) }, "Row keys do not match the header"],
  ["the ตำบล rows of stat_m sent as kind village", { rows: ROWS_6812 }, "Not a village row"],
  ["a row of 6712", { rows: withVillage(...NUN_NUEA, { yymm: "6712" }) }, "Row of another yymm"],
  ["rcode as a number", { rows: withVillage(...NUN_NUEA, { rcode: 5406 }) }, "Invalid value"],
  ["mm as a number", { rows: withVillage(...NUN_NUEA, { mm: 54060101 }) }, "Invalid value"],
  ["an mm_name that setValues would write as a formula (=1+1)", { rows: withVillage(...NUN_NUEA, { mm_name: "=1+1" }) }, "Invalid value"],
  ["house below 0", { rows: withVillage(...NUN_NUEA, { house: -1 }) }, "Invalid value"],
  ["ตำบลน้ำชำ of อำเภอเมืองแพร่ (54010300) with its หมู่ 1", { rows: withVillage(...NUN_NUEA, { tt: "54010300", mm: "54010301" }) }, "Row outside district"],
  ["mm of 7 digits", { rows: withVillage(...NUN_NUEA, { mm: "5406010" }) }, "Not a village row"],
  ["mm of บ้านกลาง (54060211) under ตำบลบ้านหนุน", { rows: withVillage(...NUN_NUEA, { mm: "54060211" }) }, "Not a village row"],
  ["หมู่ 1 of บ้านหนุน under 5406 twice", { rows: [...VILLAGE_ROWS_6812, VILLAGE_ROWS_6812[0]] }, "Duplicate village row"],
  ["male + female ≠ total", { rows: withVillage(...NUN_NUEA, { total: 479 }) }, "Male + female does not equal total"],
  ["หนุนเหนือ with 225 บ้าน, so บ้านหนุน of 5406 adds up to 2,164 not 2,163", { rows: withVillage(...NUN_NUEA, { house: 225 }) }, "Villages do not add up to registry_population"],
  ["one more man in หนุนเหนือ (230 + 249 = 479), so บ้านหนุน of 5406 adds up to 2,137 ชาย", { rows: withVillage(...NUN_NUEA, { male: 230, total: 479 }) }, "Villages do not add up to registry_population"],
  ["without the 6 villages of ตำบลทุ่งน้าว (5406)", { rows: VILLAGE_ROWS_6812.filter((r) => r.tt !== "54060800") }, "Villages do not add up to registry_population"],
  [
    "a village of ห้วยหม้าย under 5489, which has no ตำบลห้วยหม้าย row",
    { rows: [...VILLAGE_ROWS_6812, { ...VILLAGE_ROWS_6812.find((r) => r.mm === "54060301"), rcode: "5489", rcode_name: "ท้องถิ่นเทศบาลตำบลสอง" }] },
    "Villages do not add up to registry_population",
  ],
];

for (const [what, change, message] of REJECTED_VILLAGE) {
  test(`kind: village, ${what} → error ${message}, no sheet written, an ERROR in system_logs`, () => {
    const h = load();
    savePopulation(h, "6812", ROWS_6812);
    const before = sheetsExceptLogs(h);

    const res = post(h, { action: "save_registry_population", kind: "village", yymm: "6812", rows: VILLAGE_ROWS_6812, ...change });

    assert.deepEqual(res, { status: "error", message });
    assert.deepEqual(sheetsExceptLogs(h), before);
    const errors = records(h.sheet("system_logs")).filter((r) => r.Type === "ERROR");
    assert.deepEqual(errors.map((r) => r.Details), [message]);
    if (message !== "Unknown kind") assert.match(errors[0].Message, /^Save rejected registry_population_village /);
  });
}

test("kind: village of 6812 before 6812 has registry_population rows (none saved, or only 6712's) → error No registry_population rows for this yymm, no sheet written", () => {
  for (const saved of [[], [ROWS_6712]]) {
    const h = load();
    saved.forEach((rows) => savePopulation(h, rows[0].yymm, rows));
    const before = sheetsExceptLogs(h);

    const res = saveVillage(h, "6812", VILLAGE_ROWS_6812);

    assert.deepEqual(res, { status: "error", message: "No registry_population rows for this yymm" });
    assert.deepEqual(sheetsExceptLogs(h), before);
  }
});

test("kind: population of 6812 again with figures unlike its village rows → saved, the village rows kept: rule 14 has no village pair, as the upload sends kind village right after (SCHEMA §3.8)", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveVillage(h, "6812", VILLAGE_ROWS_6812);
  const villages = h.sheet("registry_population_village");
  const corrected = ROWS_6812.map((r) => (r.rcode === "5406" && r.tt === "54060800" ? { ...r, male: 1567, total: 3201 } : r));

  const res = savePopulation(h, "6812", corrected);

  assert.deepEqual(res, { status: "success", kind: "population", yymm: "6812", count: 10 });
  assert.deepEqual(h.sheet("registry_population_village"), villages);
});

test("GET after the population of 6712 and 6812 and the villages of 6812 → 6812 with its 94 village rows as sent, 6712 with village []", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveVillage(h, "6812", VILLAGE_ROWS_6812);
  savePopulation(h, "6712", ROWS_6712);

  assert.deepEqual(getRegistryPopulation(h), {
    years: [
      { yymm: "6712", population: ROWS_6712, village: [], age: [] },
      { yymm: "6812", population: ROWS_6812, village: VILLAGE_ROWS_6812, age: [] },
    ],
  });
});

test("GET reads registry_population_village by header name; codes typed in as numbers come back as strings, a count left blank is left out of its row", () => {
  const h = load();
  savePopulation(h, "6812", ROWS_6812);
  saveVillage(h, "6812", VILLAGE_ROWS_6812);
  setCell(h, "registry_population_village", 2, "mm", 54060101);
  setCell(h, "registry_population_village", 3, "house", "");

  const res = getRegistryPopulation(h);

  const expected = VILLAGE_ROWS_6812.map((r, i) => (i === 1 ? omit(r, "house") : r));
  assert.deepEqual(res.years[0].village, expected);
});

test("registry_population_village is no PA unit, sync unit or BATCH_ALL table: BATCH_ALL is unchanged with it saved, and save_kpi_data refuses it", () => {
  const h = loadGas({ sheets: PA_SHEETS });
  h.clock.now = Date.parse("2026-11-06T10:00:00+07:00");
  savePopulation(h, "6812", ROWS_6812);
  saveVillage(h, "6812", VILLAGE_ROWS_6812);
  const saved = h.sheet("registry_population_village");

  const batch = JSON.parse(h.gas.doGet({ parameter: { sheet: "BATCH_ALL" } }).getContent());
  const kpi = post(h, { action: "save_kpi_data", tableName: "registry_population_village", year: "2569", data: VILLAGE_ROWS_6812 });

  const { years, ...meta } = batch.meta;
  assert.deepEqual(years, ["2565", "2566", "2567", "2568", "2569"]);
  assert.deepEqual({ ...batch, meta }, BATCH_ALL_BEFORE_F04);
  assert.deepEqual(kpi, { status: "error", message: "Unknown table: registry_population_village" });
  assert.deepEqual(h.sheet("registry_population_village"), saved);
});
