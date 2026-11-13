import assert from "node:assert/strict";
import test from "node:test";
import { formatBuildTime, formatCount, formatPct, formatThaiDate } from "./format";

// FEATURES F15: the display helpers that must print what PA prints, checked
// against PA's own output (CODING_STANDARDS §5).

test('formatPct(89.585) → "89.58": rounded by toFixed like PA, not to 89.59', () => {
  assert.equal(formatPct(89.585), "89.58");
});

test('date_com 202611030557 (12 digits) → "3 พฤศจิกายน 2569 เวลา 05:57 น.", what PA showed for it on 4 Nov 2569', () => {
  assert.equal(formatThaiDate("202611030557"), "3 พฤศจิกายน 2569 เวลา 05:57 น.");
});

test('date_com 20261102210446 (14 digits, s_epi1) → the seconds left out as PA does: "2 พฤศจิกายน 2569 เวลา 21:04 น."', () => {
  assert.equal(formatThaiDate("20261102210446"), "2 พฤศจิกายน 2569 เวลา 21:04 น.");
});

test('max_date_com "" (a block ปี without rows, SCHEMA §3.2) → "" without throwing', () => {
  assert.equal(formatThaiDate(""), "");
});

test('เป้าหมาย and ผลงาน → Thai grouping with commas: 1234567 → "1,234,567", 0 → "0"', () => {
  assert.equal(formatCount(1234567), "1,234,567");
  assert.equal(formatCount(0), "0");
});

// FEATURES F18: the build time that the footer and the home page show (SPEC §9.1–9.2).

test('built_at 2026-11-04T08:29:28.802Z → "4 พฤศจิกายน 2569 เวลา 15:29 น.", what the footer showed for the snapshot of 4 Nov 2569', () => {
  assert.equal(formatBuildTime("2026-11-04T08:29:28.802Z"), "4 พฤศจิกายน 2569 เวลา 15:29 น.");
});

test("built_at 18:05 UTC → the next day in Thai time (UTC+7) whatever the build machine's time zone", () => {
  assert.equal(formatBuildTime("2026-11-04T18:05:00.000Z"), "5 พฤศจิกายน 2569 เวลา 01:05 น.");
});
