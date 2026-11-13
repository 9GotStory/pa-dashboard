import assert from "node:assert/strict";
import test from "node:test";
import {
  S_EPI_COMPLETE_1,
  S_EPI_COMPLETE_2,
  S_EPI_COMPLETE_3,
  S_EPI_COMPLETE_5,
} from "../fixtures/reports-complete-20261112";
import type { Cell, DcReportData, ReportQuery } from "../types";
import { completeValues } from "./complete";

// FEATURES F56: the data layer of the ครบตามเกณฑ์ page (SPEC §9.4) on
// s_epi_complete's 4 reports from the snapshot of 12 Nov 2569. The expected
// values are SCHEMA §4.6.5's but for อายุ 1 ปี ปี 2569: SCHEMA's 181/142 is
// the snapshot of 11 Nov, and HDC's update of 11 Nov 17:28 (date_com
// 202611111728) gives 181/143. The months and the areas are the sums of rows
// in reports/{id}.json, added up apart from this code.

/** The fixture as /data/reports/{id}.json gives it: each row in header order, "" where left out */
function snapshot(cut: typeof S_EPI_COMPLETE_1): DcReportData {
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

const AGE1 = snapshot(S_EPI_COMPLETE_1);
const AGE2 = snapshot(S_EPI_COMPLETE_2);
const AGE3 = snapshot(S_EPI_COMPLETE_3);
const AGE5 = snapshot(S_EPI_COMPLETE_5);
const YEARS = ["2565", "2566", "2567", "2568", "2569"];
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

/** เป้าหมาย/ผลงาน as SCHEMA writes them, null for no data */
const pair = (t: { target: number; result: number } | null) => t && `${t.target}/${t.result}`;
/** The months added up, as เป้าหมาย/ผลงาน */
const monthSum = (months: { totals: { target: number; result: number } | null }[]) =>
  pair(
    months.reduce((s, m) => ({ target: s.target + m.totals!.target, result: s.result + m.totals!.result }), {
      target: 0,
      result: 0,
    }),
  );

test("ปี 2569 ทั้งอำเภอ → 1 ปี 181/143 (79.01%), 2 ปี 205/72 (35.12%), 3 ปี 228/28 (12.28%), 5 ปี 262/26 (9.92%), เกณฑ์ 90 ไม่ผ่านทุกอายุ", () => {
  const ages = [AGE1, AGE2, AGE3, AGE5].map((data) => completeValues(data, DISTRICT_2569, NAMES, YEARS));
  assert.deepEqual(
    ages.map((v) => [pair(v.total), v.total?.pct?.toFixed(2), v.goal, v.passed]),
    [
      ["181/143", "79.01", 90, false],
      ["205/72", "35.12", 90, false],
      ["228/28", "12.28", 90, false],
      ["262/26", "9.92", 90, false],
    ],
  );
});

test("ปี 2569 รายเดือน → 12 เดือน ต.ค.–ก.ย. (M_A) that sum to ทั้งปี for each age", () => {
  for (const [data, year] of [
    [AGE1, "181/143"],
    [AGE2, "205/72"],
    [AGE3, "228/28"],
    [AGE5, "262/26"],
  ] as const) {
    const { months } = completeValues(data, DISTRICT_2569, NAMES, YEARS);
    assert.deepEqual(
      months.map((m) => m.period),
      ["m10", "m11", "m12", "m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09"],
    );
    assert.equal(monthSum(months), year);
  }
});

test("อายุ 3 ปี ปี 2569 รายเดือน → ผลงาน 0 ต.ค.–มี.ค. then 3–6 a month from เม.ย. (SCHEMA §4.6.5), shown as 0, not as no data", () => {
  const { months } = completeValues(AGE3, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    months.map((m) => pair(m.totals)),
    ["27/0", "14/0", "10/0", "22/0", "12/0", "19/0", "16/4", "18/3", "21/5", "23/6", "21/5", "25/5"],
  );
});

test("แนวโน้ม อายุ 1 ปี ทั้งอำเภอ ทั้งปี → 2565 259/196 … 2568 217/184, 2569 181/143", () => {
  const { trend } = completeValues(AGE1, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    trend.map((p) => [p.b_year, pair(p.totals)]),
    [
      ["2565", "259/196"],
      ["2566", "257/189"],
      ["2567", "248/184"],
      ["2568", "217/184"],
      ["2569", "181/143"],
    ],
  );
});

test("อายุ 1 ปี ปี 2569 รายตำบล → บ้านหนุน 24/20 … ทุ่งน้าว 14/13", () => {
  const { units } = completeValues(AGE1, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    units?.map((u) => [u.name, pair(u.totals)]),
    [
      ["บ้านหนุน", "24/20"],
      ["บ้านกลาง", "23/15"],
      ["ห้วยหม้าย", "28/20"],
      ["เตาปูน", "46/36"],
      ["หัวเมือง", "14/12"],
      ["สะเอียบ", "23/18"],
      ["แดนชุมพล", "9/9"],
      ["ทุ่งน้าว", "14/13"],
    ],
  );
});

test("?area=540606&period=m04&by=hosp → ตำบลสะเอียบ เม.ย. 2/2 by its 3 หน่วยบริการ; its months still the whole year's 12", () => {
  const query: ReportQuery = { ...DISTRICT_2569, area: "540606", period: "m04", by: "hosp" };
  const v = completeValues(AGE1, query, NAMES, YEARS);
  assert.equal(pair(v.total), "2/2");
  assert.deepEqual(
    v.units?.map((u) => [u.key, pair(u.totals)]),
    [
      ["06423", "1/1"],
      ["06424", "0/0"],
      ["06425", "1/1"],
    ],
  );
  assert.equal(v.months.length, 12);
  assert.equal(monthSum(v.months), "23/18");
});

test("?year=2560, a year without a block ปี → block null and nothing to show, never zeros", () => {
  const v = completeValues(AGE1, { ...DISTRICT_2569, year: "2560" }, NAMES, YEARS);
  assert.deepEqual([v.block, v.total, v.units, v.passed, v.months], [null, null, null, null, []]);
});
