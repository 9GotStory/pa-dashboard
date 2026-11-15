import assert from "node:assert/strict";
import test from "node:test";
import { loadGas } from "./gas-harness.js";

// FEATURES F77 / SCHEMA §3.10.

const SETTINGS = [
  ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
  [4, 2569, 54, 5406, ""],
];

const HEADER = ["table", "b_year", "sheet", "row_count", "max_date_com", "synced_at"];

// sync_status as GAS writes it (SCHEMA §2.4): b_year and max_date_com are
// plain text, but an admin may have retyped one as a number. s_epi1's
// date_com has seconds (14 digits). s_anc's 2564 row is outside the window
// 2565–2569: current_year moved on and s_anc has not been saved since.
const SYNC_STATUS = [
  HEADER,
  ["s_epi1", "2569", "s_epi1", 41, "20261102210446", new Date("2026-11-03T02:00:00Z")],
  ["s_anc", "2564", "s_anc_y2564", 12, "202110010000", new Date("2021-10-02T02:00:00Z")],
  ["s_anc", 2568, "s_anc_y2568", 30, 202509300830, new Date("2025-10-01T02:00:00Z")],
  ["s_epi1", "2568", "s_epi1_y2568", 40, "20250930120000", new Date("2025-10-01T03:00:00Z")],
];

// PA-Data with settings, at 10:00 on 15 Nov 2569 (Bangkok).
function load(sheets = {}) {
  const h = loadGas({ sheets: { settings: SETTINGS, ...sheets } });
  h.clock.now = Date.parse("2026-11-15T10:00:00+07:00");
  return h;
}

function getSyncStatus(h) {
  return JSON.parse(h.gas.doGet({ parameter: { action: "sync_status" } }).getContent());
}

test("GET → every sync_status row inside the window in sheet order, all six columns; years and dates as strings, row_count a number, synced_at ISO", () => {
  const h = load({ sync_status: SYNC_STATUS });

  assert.deepEqual(getSyncStatus(h), {
    rows: [
      {
        table: "s_epi1",
        b_year: "2569",
        sheet: "s_epi1",
        row_count: 41,
        max_date_com: "20261102210446",
        synced_at: "2026-11-03T02:00:00.000Z",
      },
      {
        table: "s_anc",
        b_year: "2568",
        sheet: "s_anc_y2568",
        row_count: 30,
        max_date_com: "202509300830",
        synced_at: "2025-10-01T02:00:00.000Z",
      },
      {
        table: "s_epi1",
        b_year: "2568",
        sheet: "s_epi1_y2568",
        row_count: 40,
        max_date_com: "20250930120000",
        synced_at: "2025-10-01T03:00:00.000Z",
      },
    ],
  });
});

test("GET before sync_status exists → { rows: [] }, not an error", () => {
  const h = load();

  assert.deepEqual(getSyncStatus(h), { rows: [] });
});

test("GET with only the header, or only rows outside the window → { rows: [] }", () => {
  assert.deepEqual(getSyncStatus(load({ sync_status: [HEADER] })), { rows: [] });
  assert.deepEqual(getSyncStatus(load({ sync_status: [HEADER, SYNC_STATUS[2]] })), { rows: [] });
});

test("GET takes the script lock once and releases it", () => {
  const h = load({ sync_status: SYNC_STATUS });
  // readSettings (PA code) locks by itself on a cache miss: warm it first so
  // only doGet's lock is counted.
  h.gas.readSettings();
  h.lock.tryLock = 0;
  h.lock.releaseLock = 0;

  getSyncStatus(h);

  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

test("GET while another execution holds the script lock past the 30 s wait → error Busy, and sync_status is not read", () => {
  const h = load({ sync_status: SYNC_STATUS });
  h.otherHolder.held = true;
  const before = h.reads("sync_status");

  assert.deepEqual(getSyncStatus(h), { status: "error", message: "Busy" });
  assert.equal(h.reads("sync_status"), before);
});
