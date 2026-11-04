import assert from "node:assert/strict";
import test from "node:test";
import { csvFileName, formatPct, formatThaiDate, toCsv } from "./format";

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

// FEATURES F20: the CSV download of the report page (SPEC §9.4).

test("CSV → UTF-8 BOM first, CRLF between lines, every cell in quotes with \" doubled (Excel reads Thai and commas right)", () => {
  assert.equal(toCsv([["ตำบล", "เป้าหมาย"], ["บ้านหนุน", 12], ["ชื่อ \"ย่อ\", ยาว", ""]]), '\uFEFF"ตำบล","เป้าหมาย"\r\n"บ้านหนุน","12"\r\n"ชื่อ ""ย่อ"", ยาว",""');
});

test("CSV cells starting with = + - @ tab or CR, after spaces too as in R6 → ' put first so Excel keeps them as text; — and 1-2 untouched", () => {
  assert.equal(
    toCsv([["=SUM(A1)", "+1", "-1", "@A1", "\tx", "\rx", " =1", "—", "1-2"]]),
    '\uFEFF"\'=SUM(A1)","\'+1","\'-1","\'@A1","\'\tx","\'\rx","\' =1","—","1-2"',
  );
});

test("CSV file name → SHDC-{source_table}-{first 8 of opendata_id}-{year}.csv (SPEC §9.4), the id in its own letter case (SCHEMA §3)", () => {
  assert.equal(csvFileName({ source_table: "s_epi_complete", opendata_id: "28dd2c7955ce926456240b2ff0100bde" }, "2569"), "SHDC-s_epi_complete-28dd2c79-2569.csv");
  assert.equal(csvFileName({ source_table: "s_dental_0_5_cavity_free", opendata_id: "AbT2t2K4z4xeqzytwbave" }, "2568"), "SHDC-s_dental_0_5_cavity_free-AbT2t2K4-2568.csv");
});
