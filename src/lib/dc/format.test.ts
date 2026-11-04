import assert from "node:assert/strict";
import test from "node:test";
import { formatPct, formatThaiDate } from "./format";

// FEATURES F15: the display helpers that must print what PA prints, checked
// against PA's own output (CODING_STANDARDS §5).

test("formatPct(89.585) → \"89.58\": rounded by toFixed like PA, not to 89.59", () => {
  assert.equal(formatPct(89.585), "89.58");
});

test("date_com 202611030557 (12 digits) → \"3 พฤศจิกายน 2569 เวลา 05:57 น.\", what PA showed for it on 4 Nov 2569", () => {
  assert.equal(formatThaiDate("202611030557"), "3 พฤศจิกายน 2569 เวลา 05:57 น.");
});

test("date_com 20261102210446 (14 digits, s_epi1) → the seconds left out as PA does: \"2 พฤศจิกายน 2569 เวลา 21:04 น.\"", () => {
  assert.equal(formatThaiDate("20261102210446"), "2 พฤศจิกายน 2569 เวลา 21:04 น.");
});

test("max_date_com \"\" (a block ปี without rows, SCHEMA §3.2) → \"\" without throwing", () => {
  assert.equal(formatThaiDate(""), "");
});
