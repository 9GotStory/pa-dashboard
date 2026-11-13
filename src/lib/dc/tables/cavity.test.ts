import assert from "node:assert/strict";
import test from "node:test";
import { S_DENTAL_0_5_CAVITY_FREE } from "../fixtures/reports-cavity-20261113";
import type { Cell, DcReportData, ReportQuery } from "../types";
import { cavityValues } from "./cavity";

// FEATURES F61: the data layer of the กรวยปีเดียว page (SPEC §9.4) on
// s_dental_0_5_cavity_free from the snapshot of 13 Nov 2569, which gives
// SCHEMA §4.6.11's figures. The expected values are the sums of rows in
// reports/{id}.json, added up apart from this code.

/** The fixture as /data/reports/{id}.json gives it: each row in header order, "" where left out */
function snapshot(cut: typeof S_DENTAL_0_5_CAVITY_FREE): DcReportData {
  return {
    report: cut.report,
    years: Object.entries(cut.years).map(([b_year, rows]) => ({
      b_year,
      headers: cut.headers,
      rows: rows.map((row) => cut.headers.map((h): Cell => row[h] ?? "")),
      max_date_com: "",
      sheet_rows: rows.length,
      expected_rows: rows.length,
    })),
  };
}

const CAVITY = snapshot(S_DENTAL_0_5_CAVITY_FREE);
const NAMES = {
  areas: [
    { id: "540601", name_th: "บ้านหนุน" },
    { id: "540602", name_th: "บ้านกลาง" },
    { id: "540603", name_th: "ห้วยหม้าย" },
    { id: "540604", name_th: "เตาปูน" },
    { id: "540605", name_th: "หัวเมือง" },
    { id: "540606", name_th: "สะเอียบ" },
    { id: "540607", name_th: "แดนชุมพล" },
    { id: "540608", name_th: "ทุ่งน้าว" },
  ],
  hospitals: [],
};
const DISTRICT_2569: ReportQuery = {
  year: "2569",
  area: "all",
  period: "year",
  measure: null,
  by: "area",
  domain: null,
};

test("2569 ทั้งอำเภอ → c 1,361 · b 954 · a 795 · ฟันดีไม่มีผุ 83.33% เกณฑ์ 80 ผ่าน · ตรวจช่องปาก 70.10%", () => {
  const cavity = cavityValues(CAVITY, DISTRICT_2569, NAMES);
  assert.equal(cavity.funnel?.children, 1361);
  assert.equal(cavity.funnel?.screened, 954);
  assert.equal(cavity.funnel?.cavityFree, 795);
  assert.equal(cavity.funnel?.screenedPct?.toFixed(2), "70.10");
  assert.equal(cavity.funnel?.cavityFreePct?.toFixed(2), "83.33");
  assert.equal(cavity.goal, 80);
  assert.equal(cavity.passed, true);
});

test("2569 รายตำบล → c/b/a ของ 8 ตำบลตามรหัส · a ≤ b ≤ c ทุกตำบล · ร้อยละฟันดีไม่มีผุ = a ÷ b", () => {
  const cavity = cavityValues(CAVITY, DISTRICT_2569, NAMES);
  assert.deepEqual(
    cavity.units?.map((u) => [u.name, u.funnel.children, u.funnel.screened, u.funnel.cavityFree]),
    [
      ["บ้านหนุน", 180, 159, 119],
      ["บ้านกลาง", 144, 114, 89],
      ["ห้วยหม้าย", 201, 103, 84],
      ["เตาปูน", 322, 184, 169],
      ["หัวเมือง", 160, 117, 102],
      ["สะเอียบ", 191, 138, 110],
      ["แดนชุมพล", 68, 65, 60],
      ["ทุ่งน้าว", 95, 74, 62],
    ],
  );
  for (const u of cavity.units ?? []) {
    assert.ok(u.funnel.cavityFree <= u.funnel.screened && u.funnel.screened <= u.funnel.children, u.name);
  }
  assert.equal(cavity.units?.[6].funnel.cavityFreePct?.toFixed(2), "92.31");
  // กราฟ A reads the same ร้อยละฟันดีไม่มีผุ from totals
  assert.equal(cavity.units?.[6].totals.pct?.toFixed(2), "92.31");
});

test("2569 ตำบลแดนชุมพล รายหน่วยบริการ → กรวย 68/65/60 · ตรวจช่องปาก 95.59% · หน่วยบริการ 06426 หน่วยเดียว", () => {
  const cavity = cavityValues(CAVITY, { ...DISTRICT_2569, area: "540607", by: "hosp" }, NAMES);
  assert.deepEqual(
    cavity.funnel && [cavity.funnel.children, cavity.funnel.screened, cavity.funnel.cavityFree],
    [68, 65, 60],
  );
  assert.equal(cavity.funnel?.screenedPct?.toFixed(2), "95.59");
  assert.deepEqual(
    cavity.units?.map((u) => [u.name, u.funnel.children, u.funnel.screened, u.funnel.cavityFree]),
    [["หน่วยบริการ 06426", 68, 65, 60]],
  );
  assert.equal(cavity.units?.[0].funnel.screenedPct?.toFixed(2), "95.59");
});

test("?year=2568, a year the table does not have → no block, no กรวย, no units", () => {
  const cavity = cavityValues(CAVITY, { ...DISTRICT_2569, year: "2568" }, NAMES);
  assert.equal(cavity.block, null);
  assert.equal(cavity.funnel, null);
  assert.equal(cavity.units, null);
});
