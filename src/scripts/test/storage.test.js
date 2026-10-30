import assert from "node:assert/strict";
import test from "node:test";
import { loadGas } from "./gas-harness.js";

// FEATURES F02. The table is `s_x`, registered as a sync unit through a
// kpi_master `source_sheet`, the way s_epi1 is in production.
const KPI_MASTER = [
  ["table_name", "source_sheet"],
  ["s_x_kpi", "s_x"],
];

function settings(currentYear) {
  return [
    ["current_quarter", "current_year", "province_code", "district_code"],
    [4, currentYear, 54, 5406],
  ];
}

// A province-wide MOPH response of 700 rows: 85 of them in อำเภอ 5406.
const ROWS_PER_DISTRICT = {
  5401: 140, 5402: 90, 5403: 75, 5404: 60, 5405: 70,
  5406: 85, 5407: 80, 5408: 50, 5409: 50,
};
const DISTRICT_ROWS = 85;

function provinceRows({ year, dateCom, extra = {} }) {
  const rows = [];
  for (const [district, n] of Object.entries(ROWS_PER_DISTRICT)) {
    for (let i = 0; i < n; i++) {
      const tambon = String((i % 8) + 1).padStart(2, "0");
      const moo = String((i % 12) + 1).padStart(2, "0");
      rows.push({
        id: "28dd2c79a1b2c3d4e5f60718293a4b5c",
        hospcode: String(10670 + (i % 17)).padStart(5, "0"),
        areacode: district + tambon + moo,
        flag_sent: "Y",
        date_com: dateCom,
        b_year: year,
        target: 10 + (i % 5),
        result: 8 + (i % 3),
        ...extra,
      });
    }
  }
  return rows;
}

// The same rows with only the first n of อำเภอ 5406 (other districts kept).
function keepDistrictRows(rows, n) {
  let seen = 0;
  return rows.filter((r) => !r.areacode.startsWith("5406") || seen++ < n);
}

// A response MOPH cut at 1000 rows: total says 2444.
function truncatedRows(dateCom) {
  return [...provinceRows({ year: "2569", dateCom }), ...provinceRows({ year: "2569", dateCom })].slice(0, 1000);
}

// A sheet's data rows as objects keyed by its header row.
function records(values) {
  const [header, ...rows] = values;
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

function load(currentYear = 2569, extraSheets = {}, fetch = undefined) {
  return loadGas({
    sheets: { settings: settings(currentYear), kpi_master: KPI_MASTER, ...extraSheets },
    fetch,
  });
}

test("saving the current year (700 province rows) keeps only อำเภอ 5406 rows in s_x and records sync_status", () => {
  const h = load();

  const res = h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});

  assert.equal(res.status, "success", res.message);
  assert.equal(res.received, 700);
  assert.equal(res.count, DISTRICT_ROWS);
  assert.equal(res.sheet, "s_x");
  assert.equal(res.year, "2569");
  assert.deepEqual([...res.archived], []);

  const saved = records(h.sheet("s_x"));
  assert.equal(saved.length, DISTRICT_ROWS);
  assert.ok(saved.every((r) => String(r.areacode).startsWith("5406")));

  const status = records(h.sheet("sync_status"));
  assert.equal(status.length, 1);
  assert.equal(status[0].table, "s_x");
  assert.equal(String(status[0].b_year), "2569");
  assert.equal(status[0].sheet, "s_x");
  assert.equal(Number(status[0].row_count), DISTRICT_ROWS);
  assert.equal(String(status[0].max_date_com), "202610300930");
});

test("saving 2568 creates s_x_y2568, leaves s_x as it was, and sync_status has 2 rows", () => {
  const h = load();
  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});
  const before = h.sheet("s_x");

  const res = h.gas.saveTableYear("s_x", "2568", provinceRows({ year: "2568", dateCom: "202510010800" }), {});

  assert.equal(res.status, "success", res.message);
  assert.equal(res.sheet, "s_x_y2568");
  assert.equal(records(h.sheet("s_x_y2568")).length, DISTRICT_ROWS);
  assert.ok(records(h.sheet("s_x_y2568")).every((r) => String(r.b_year) === "2568"));
  assert.deepEqual(h.sheet("s_x"), before);

  const status = records(h.sheet("sync_status"));
  assert.deepEqual(
    status.map((r) => [r.table, String(r.b_year), r.sheet]).sort(),
    [["s_x", "2568", "s_x_y2568"], ["s_x", "2569", "s_x"]],
  );
});

test("saving 2568 again with a newer date_com replaces s_x_y2568 as a whole", () => {
  const h = load();
  h.gas.saveTableYear("s_x", "2568", provinceRows({ year: "2568", dateCom: "202510010800" }), {});

  // The newer response has fewer district rows: only the first 3 of 5406.
  const newer = keepDistrictRows(provinceRows({ year: "2568", dateCom: "202512150800" }), 3);
  const res = h.gas.saveTableYear("s_x", "2568", newer, {});

  assert.equal(res.status, "success", res.message);
  const saved = records(h.sheet("s_x_y2568"));
  assert.deepEqual(saved.map((r) => r.areacode), ["54060101", "54060202", "54060303"]);
  assert.ok(saved.every((r) => String(r.date_com) === "202512150800"));
  const status = records(h.sheet("sync_status")).find((r) => String(r.b_year) === "2568");
  assert.equal(Number(status.row_count), 3);
  assert.equal(String(status.max_date_com), "202512150800");
});

test("no sync_status sheet before the first save → it is created with its header", () => {
  const h = load();
  assert.equal(h.sheet("sync_status"), null);

  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});

  assert.deepEqual(h.sheet("sync_status")[0], ["table", "b_year", "sheet", "row_count", "max_date_com", "synced_at"]);
});

// Every sheet except system_logs (logToSheet writes there on purpose).
function dataSheets(h) {
  return Object.fromEntries(
    h.sheetNames().filter((n) => n !== "system_logs").map((n) => [n, h.sheet(n)]),
  );
}

test("year 2560 (outside the window 2565–2569) → error Year outside window and no sheet changes", () => {
  const h = load();
  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});
  const before = dataSheets(h);

  const res = h.gas.saveTableYear("s_x", "2560", provinceRows({ year: "2560", dateCom: "201710010800" }), {});

  assert.deepEqual({ ...res }, { status: "error", message: "Year outside window" });
  assert.deepEqual(dataSheets(h), before);
});

test("total 2444 but 1000 rows sent → error Incomplete data and no sheet changes", () => {
  const h = load();
  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});
  const before = dataSheets(h);
  const truncated = truncatedRows("202610310930");

  // MOPH sends total as a string (SCHEMA §5.3).
  const res = h.gas.saveTableYear("s_x", "2569", truncated, { total: "2444" });

  assert.deepEqual({ ...res }, { status: "error", message: "Incomplete data" });
  assert.deepEqual(dataSheets(h), before);
});

test("rows without an areacode column → error No areacode column", () => {
  const h = load();
  const rows = provinceRows({ year: "2569", dateCom: "202610300930" }).map((r) => {
    const row = { ...r };
    delete row.areacode;
    return row;
  });

  const res = h.gas.saveTableYear("s_x", "2569", rows, {});

  assert.deepEqual({ ...res }, { status: "error", message: "No areacode column" });
  assert.equal(h.sheet("s_x"), null);
});

test("no rows of อำเภอ 5406 → error, the existing sheet and sync_status are kept", () => {
  const h = load();
  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});
  const before = dataSheets(h);
  const otherDistricts = provinceRows({ year: "2569", dateCom: "202610310930" })
    .filter((r) => !r.areacode.startsWith("5406"));

  const res = h.gas.saveTableYear("s_x", "2569", otherDistricts, {});

  assert.deepEqual({ ...res }, { status: "error", message: "No rows for district 5406" });
  assert.deepEqual(dataSheets(h), before);
});

test("rows without b_year get the year sent; rows of another b_year are dropped", () => {
  const h = load();
  const rows = [
    { areacode: "54060101", date_com: "202510010800", target: 5 },
    { areacode: "54060102", date_com: "202510010800", target: 6, b_year: "2567" },
    { areacode: "54060103", date_com: "202510010800", target: 7, b_year: 2568 },
  ];

  const res = h.gas.saveTableYear("s_x", "2568", rows, {});

  assert.equal(res.status, "success", res.message);
  assert.equal(res.count, 2);
  assert.deepEqual(
    records(h.sheet("s_x_y2568")).map((r) => [r.areacode, String(r.b_year)]),
    [["54060101", "2568"], ["54060103", "2568"]],
  );
});

test("an older date_com than sync_status has → error Stale data; again with force: true → saved", () => {
  const h = load();
  h.gas.saveTableYear("s_x", "2568", provinceRows({ year: "2568", dateCom: "202512150800" }), {});
  const before = dataSheets(h);
  const older = provinceRows({ year: "2568", dateCom: "202510010800", extra: { result: 0 } });

  const stale = h.gas.saveTableYear("s_x", "2568", older, {});

  assert.deepEqual({ ...stale }, { status: "error", message: "Stale data: existing 202512150800 > incoming 202510010800" });
  assert.deepEqual(dataSheets(h), before);

  const forced = h.gas.saveTableYear("s_x", "2568", older, { force: true });

  assert.equal(forced.status, "success", forced.message);
  assert.ok(records(h.sheet("s_x_y2568")).every((r) => String(r.date_com) === "202510010800"));
  const status = records(h.sheet("sync_status")).find((r) => String(r.b_year) === "2568");
  assert.equal(String(status.max_date_com), "202510010800");
});

// The admin edits settings.current_year; the next read must see it.
function changeCurrentYear(h, year) {
  h.gas.SpreadsheetApp.getActiveSpreadsheet().getSheetByName("settings").getRange(2, 2).setValues([[year]]);
  h.gas.clearConfigCache();
}

test("current_year 2569 → 2570, then saving 2570 moves the 2569 rows of s_x to s_x_y2569", () => {
  const h = load(2569);
  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202609300930" }), {});
  changeCurrentYear(h, 2570);

  const res = h.gas.saveTableYear("s_x", "2570", provinceRows({ year: "2570", dateCom: "202611010800" }), {});

  assert.equal(res.status, "success", res.message);
  assert.equal(res.sheet, "s_x");
  assert.deepEqual([...res.archived], ["2569"]);
  const current = records(h.sheet("s_x"));
  assert.equal(current.length, DISTRICT_ROWS);
  assert.ok(current.every((r) => String(r.b_year) === "2570"));
  const archived = records(h.sheet("s_x_y2569"));
  assert.equal(archived.length, DISTRICT_ROWS);
  assert.ok(archived.every((r) => String(r.b_year) === "2569" && String(r.date_com) === "202609300930"));

  const status = records(h.sheet("sync_status"));
  const y2569 = status.find((r) => String(r.b_year) === "2569");
  assert.equal(y2569.sheet, "s_x_y2569");
  assert.equal(Number(y2569.row_count), DISTRICT_ROWS);
  assert.equal(String(y2569.max_date_com), "202609300930");
  assert.equal(status.find((r) => String(r.b_year) === "2570").sheet, "s_x");
});

// A sheet as the old save path (saveDataToSheet) left it: every row the
// response had, province-wide.
function oldPathSheet(rows) {
  const header = Object.keys(rows[0]);
  return [header, ...rows.map((r) => header.map((k) => r[k]))];
}

test("archiving province-wide 2569 rows from the old save path keeps only อำเภอ 5406 rows in s_x_y2569", () => {
  const h = load(2570, { s_x: oldPathSheet(provinceRows({ year: "2569", dateCom: "202609300930" })) });

  const res = h.gas.saveTableYear("s_x", "2570", provinceRows({ year: "2570", dateCom: "202611010800" }), {});

  assert.equal(res.status, "success", res.message);
  assert.deepEqual([...res.archived], ["2569"]);
  const archived = records(h.sheet("s_x_y2569"));
  assert.equal(archived.length, DISTRICT_ROWS);
  assert.ok(archived.every((r) => String(r.areacode).startsWith("5406")));
  const y2569 = records(h.sheet("sync_status")).find((r) => String(r.b_year) === "2569");
  assert.equal(y2569.sheet, "s_x_y2569");
  assert.equal(Number(y2569.row_count), DISTRICT_ROWS);
});

test("2569 re-synced into s_x_y2569 with a newer date_com after the year change → saving 2570 does not overwrite it", () => {
  const h = load(2569);
  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202609300930" }), {});
  changeCurrentYear(h, 2570);
  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610150800" }), {});
  const resynced = h.sheet("s_x_y2569");

  const res = h.gas.saveTableYear("s_x", "2570", provinceRows({ year: "2570", dateCom: "202611010800" }), {});

  assert.equal(res.status, "success", res.message);
  assert.deepEqual([...res.archived], []);
  assert.deepEqual(h.sheet("s_x_y2569"), resynced);
  assert.ok(records(h.sheet("s_x")).every((r) => String(r.b_year) === "2570"));
  const y2569 = records(h.sheet("sync_status")).find((r) => String(r.b_year) === "2569");
  assert.equal(String(y2569.max_date_com), "202610150800");
});

test("saving a table deletes its sync_status rows outside the window, not other tables' rows", () => {
  const h = load(2569, {
    sync_status: [
      ["table", "b_year", "sheet", "row_count", "max_date_com", "synced_at"],
      ["s_x", 2564, "s_x_y2564", 80, "202109300930", ""],
      ["s_y", 2564, "s_y_y2564", 40, "202109300930", ""],
    ],
  });

  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});

  assert.deepEqual(
    records(h.sheet("sync_status")).map((r) => [r.table, String(r.b_year)]).sort(),
    [["s_x", "2569"], ["s_y", "2564"]],
  );
});

test("2568 and 2569 with different columns → each sheet has its own header, no blank columns", () => {
  const h = load();
  // 2569 adds result_q1 and has no flag_sent.
  const rows2569 = provinceRows({ year: "2569", dateCom: "202610300930", extra: { result_q1: 3 } })
    .map((r) => {
      const row = { ...r };
      delete row.flag_sent;
      return row;
    });
  h.gas.saveTableYear("s_x", "2568", provinceRows({ year: "2568", dateCom: "202510010800" }), {});
  h.gas.saveTableYear("s_x", "2569", rows2569, {});

  assert.deepEqual(h.sheet("s_x_y2568")[0], ["id", "hospcode", "areacode", "flag_sent", "date_com", "b_year", "target", "result"]);
  assert.deepEqual(h.sheet("s_x")[0], ["id", "hospcode", "areacode", "date_com", "b_year", "target", "result", "result_q1"]);
});

test("after a write every sheet has data rows + 1 rows, no blank rows left (new sheet, old 1000-row sheet, archive, sync_status)", () => {
  const h = load(2570, { s_x: oldPathSheet(provinceRows({ year: "2569", dateCom: "202609300930" })) });
  assert.equal(h.maxRows("s_x"), 1000);

  h.gas.saveTableYear("s_x", "2570", provinceRows({ year: "2570", dateCom: "202611010800" }), {});
  h.gas.saveTableYear("s_x", "2568", provinceRows({ year: "2568", dateCom: "202510010800" }), {});

  assert.equal(h.maxRows("s_x"), DISTRICT_ROWS + 1);
  assert.equal(h.maxRows("s_x_y2569"), DISTRICT_ROWS + 1);
  assert.equal(h.maxRows("s_x_y2568"), DISTRICT_ROWS + 1);
  assert.equal(h.maxRows("sync_status"), 3 + 1);

  // A sheet trimmed to 3 data rows grows again for the next, longer save.
  const three = keepDistrictRows(provinceRows({ year: "2568", dateCom: "202512150800" }), 3);
  h.gas.saveTableYear("s_x", "2568", three, {});
  assert.equal(h.maxRows("s_x_y2568"), 3 + 1);
  h.gas.saveTableYear("s_x", "2568", provinceRows({ year: "2568", dateCom: "202512160800" }), {});
  assert.equal(h.maxRows("s_x_y2568"), DISTRICT_ROWS + 1);
  assert.equal(records(h.sheet("s_x_y2568")).length, DISTRICT_ROWS);
});

test("a successful save logs SUCCESS Synced {table} {year} with the row count to system_logs", () => {
  const h = load();

  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});

  const logs = records(h.sheet("system_logs"));
  assert.ok(
    logs.some((r) => r.Type === "SUCCESS" && r.Message === "Synced s_x 2569" && r.Details === "85 rows"),
    "system_logs:\n" + JSON.stringify(logs, null, 1),
  );
});

test("a table that is not a sync unit (settings) → error Unknown table and no sheet changes", () => {
  const h = load();
  const before = dataSheets(h);

  const res = h.gas.saveTableYear("settings", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});

  assert.deepEqual({ ...res }, { status: "error", message: "Unknown table: settings" });
  assert.deepEqual(dataSheets(h), before);
});

function post(h, body) {
  return JSON.parse(h.gas.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}

// readSettings/readKpiMasterConfig (PA code, not changed) take the lock
// themselves on a cache miss (SCHEMA §3). Warm both caches first so the
// counters only see the lock taken by the code under test.
function warmCachesAndResetLock(h) {
  h.gas.readSettings();
  h.gas.readKpiMasterConfig();
  h.lock.tryLock = 0;
  h.lock.releaseLock = 0;
}

test("doPost with cold settings/kpi_master caches never calls tryLock while it holds the lock", () => {
  const h = load();

  const res = post(h, { action: "save_kpi_data", tableName: "s_x", data: provinceRows({ year: "2569", dateCom: "202610300930" }) });

  assert.equal(res.status, "success", res.message);
  assert.equal(h.lock.nested, 0);
});

test("doPost save_kpi_data takes the script lock once and releases it; year defaults to current_year", () => {
  const h = load();
  warmCachesAndResetLock(h);

  const res = post(h, {
    action: "save_kpi_data",
    tableName: "s_x",
    total: "700",
    data: { data: provinceRows({ year: "2569", dateCom: "202610300930" }), total: "700" },
  });

  assert.deepEqual(res, { status: "success", year: "2569", sheet: "s_x", received: 700, count: DISTRICT_ROWS, archived: [] });
  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

test("doPost releases the lock in finally when the save throws", () => {
  const h = load();
  warmCachesAndResetLock(h);

  const res = post(h, { action: "save_kpi_data", tableName: "s_x", data: [{ areacode: "54060101" }, null] });

  assert.equal(res.status, "error");
  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

test("calling saveTableYear directly never calls tryLock: the caller holds the lock", () => {
  const h = load();
  warmCachesAndResetLock(h);

  const res = h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});

  assert.equal(res.status, "success", res.message);
  assert.deepEqual({ ...h.lock }, { tryLock: 0, releaseLock: 0, nested: 0 });
});

// MOPH stub for syncAllData: s_x answers with `body`, every other sync unit
// with an empty envelope (logged as Empty data, nothing written).
function mophStub(body) {
  return (url, payload) => ({ code: 201, body: payload.tableName === "s_x" ? body : { data: [], total: "0" } });
}

test("syncAllData saves MOPH data with an older date_com without Stale data (force: true), requesting limit 5000", () => {
  const older = provinceRows({ year: "2569", dateCom: "202610010800" });
  const h = load(2569, {}, mophStub({ data: older, total: "700", limit: 5000, offset: 0 }));
  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});

  h.gas.syncAllData();

  assert.ok(records(h.sheet("s_x")).every((r) => String(r.date_com) === "202610010800"));
  assert.equal(records(h.sheet("s_x")).length, DISTRICT_ROWS);
  const status = records(h.sheet("sync_status")).find((r) => r.table === "s_x");
  assert.equal(String(status.max_date_com), "202610010800");
  const sx = h.fetches.find((f) => f.payload.tableName === "s_x");
  assert.equal(sx.payload.year, "2569");
  assert.ok(h.fetches.length > 1 && h.fetches.every((f) => f.payload.limit === 5000));
});

test("syncAllData passes MOPH's total: a truncated response (1000 of 2444) is not saved", () => {
  const truncated = truncatedRows("202610310930");
  const h = load(2569, {}, mophStub({ data: truncated, total: "2444", limit: 5000, offset: 0 }));
  h.gas.saveTableYear("s_x", "2569", provinceRows({ year: "2569", dateCom: "202610300930" }), {});
  const before = h.sheet("s_x");

  h.gas.syncAllData();

  assert.deepEqual(h.sheet("s_x"), before);
});
