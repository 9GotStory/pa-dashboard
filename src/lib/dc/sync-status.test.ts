import assert from "node:assert/strict";
import test from "node:test";
import { readSyncStatus, syncStatusDate } from "./sync-status";
import type { GasSyncStatus, SyncStatusRow } from "./types";

// FEATURES F77: the data date under each table of the /sync list, for the
// year picked (SPEC §12.1).

function row(table: string, b_year: string, max_date_com: string): SyncStatusRow {
  const sheet = b_year === "2569" ? table : `${table}_y${b_year}`;
  return { table, b_year, sheet, row_count: 40, max_date_com, synced_at: "2026-11-15T03:00:00.000Z" };
}

// sync_status written by hand: s_epi1's date_com has seconds (14 digits),
// s_anc's has 12; s_anc has no 2569 row yet.
const STATUS: GasSyncStatus = {
  rows: [
    row("s_epi1", "2569", "20261114210446"),
    row("s_anc", "2568", "202509300830"),
    row("s_epi1", "2568", "20250930120000"),
  ],
};

// 10:00 on 15 Nov 2569 in the browser's own time, as date_com is read.
const NOW = new Date(2026, 10, 15, 10, 0);

test("the date of the (table, year) picked: s_epi1 2568, not s_epi1 2569 nor s_anc 2568", () => {
  assert.equal(syncStatusDate(STATUS, "s_epi1", "2568", "2569", NOW)?.text, "30 กันยายน 2568 เวลา 12:00 น.");
  assert.equal(syncStatusDate(STATUS, "s_epi1", "2569", "2569", NOW)?.text, "14 พฤศจิกายน 2569 เวลา 21:04 น.");
  assert.equal(syncStatusDate(STATUS, "s_anc", "2568", "2569", NOW)?.text, "30 กันยายน 2568 เวลา 08:30 น.");
});

test("no sync_status row of (table, year) → null: s_anc 2569, a year never synced, a table not in sync_status, no rows at all", () => {
  assert.equal(syncStatusDate(STATUS, "s_anc", "2569", "2569", NOW), null);
  assert.equal(syncStatusDate(STATUS, "s_epi1", "2565", "2569", NOW), null);
  assert.equal(syncStatusDate(STATUS, "s_dm_screen", "2569", "2569", NOW), null);
  assert.equal(syncStatusDate({ rows: [] }, "s_epi1", "2569", "2569", NOW), null);
});

test("date_com of 12 and of 14 digits: the seconds left out", () => {
  const status = { rows: [row("s_anc", "2569", "202611140557"), row("s_epi1", "2569", "20261114055759")] };

  assert.deepEqual(syncStatusDate(status, "s_anc", "2569", "2569", NOW), {
    text: "14 พฤศจิกายน 2569 เวลา 05:57 น.",
    tone: "fresh",
  });
  assert.deepEqual(syncStatusDate(status, "s_epi1", "2569", "2569", NOW), {
    text: "14 พฤศจิกายน 2569 เวลา 05:57 น.",
    tone: "fresh",
  });
});

test("current year: the tone by age, fresh up to 2 days, recent up to 7 days, old after that", () => {
  const toneOf = (dateCom: string) =>
    syncStatusDate({ rows: [row("s_anc", "2569", dateCom)] }, "s_anc", "2569", "2569", NOW)?.tone;

  assert.equal(toneOf("202611150930"), "fresh"); // 30 minutes
  assert.equal(toneOf("202611131000"), "fresh"); // 2 days
  assert.equal(toneOf("202611130959"), "recent"); // 2 days and a minute
  assert.equal(toneOf("202611081000"), "recent"); // 7 days
  assert.equal(toneOf("202611080959"), "old"); // 7 days and a minute
  assert.equal(toneOf("202510010000"), "old");
});

test("a past year is always past (gray), however recent its date_com", () => {
  const status = { rows: [row("s_anc", "2568", "202611150930")] };

  assert.deepEqual(syncStatusDate(status, "s_anc", "2568", "2569", NOW), {
    text: "15 พฤศจิกายน 2569 เวลา 09:30 น.",
    tone: "past",
  });
  assert.equal(syncStatusDate(STATUS, "s_epi1", "2568", "2569", NOW)?.tone, "past");
});

test("readSyncStatus: GAS's answer with rows → as is", () => {
  assert.deepEqual(readSyncStatus(STATUS), STATUS);
  assert.deepEqual(readSyncStatus({ rows: [] }), { rows: [] });
});

test('readSyncStatus: a GAS error → throws its message, e.g. Busy, or Missing "sheet" parameter from a GAS without this action', () => {
  assert.throws(() => readSyncStatus({ status: "error", message: "Busy" }), { message: "Busy" });
  assert.throws(() => readSyncStatus({ status: "error", message: 'Missing "sheet" parameter' }), {
    message: 'Missing "sheet" parameter',
  });
});

test("readSyncStatus: an answer without a rows list → throws", () => {
  assert.throws(() => readSyncStatus({} as GasSyncStatus), { message: "คำตอบของ GAS ไม่มี rows" });
});
