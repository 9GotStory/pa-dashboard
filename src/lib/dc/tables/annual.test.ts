import assert from "node:assert/strict";
import test from "node:test";
import { S_KPI_DENTAL28, S_KPI_DENTAL33, S_KPI_FOOD } from "../fixtures/reports-annual-20261113";
import type { Cell, DcReportData, ReportQuery } from "../types";
import { reportQuery } from "../values";
import { annualValues } from "./annual";

// FEATURES F60: the data layer of the ตัวชี้วัดเดียวรายปี page (SPEC §9.4) on
// s_kpi_food, s_kpi_dental28 and s_kpi_dental33 from the snapshot of 13 Nov
// 2569. s_kpi_food and s_kpi_dental28 give SCHEMA §4.6.6 and §4.6.12's
// figures; s_kpi_dental33 2569 is 12,191/6,984 where SCHEMA writes the 4 Nov
// 12,193/6,986, as HDC's update of 11 Nov (date_com 202611111849) moved it a
// little. The expected values are the sums of rows in reports/{id}.json, added
// up apart from this code.

/** The fixture as /data/reports/{id}.json gives it: each row in header order, "" where left out */
function snapshot(cut: typeof S_KPI_FOOD): DcReportData {
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

const FOOD = snapshot(S_KPI_FOOD);
const DENTAL28 = snapshot(S_KPI_DENTAL28);
const DENTAL33 = snapshot(S_KPI_DENTAL33);
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
const DISTRICT_2569: ReportQuery = { year: "2569", area: "all", period: "year", measure: null, by: "area", domain: null };

/** เป้าหมาย/ผลงาน as SCHEMA writes them, null for no data */
const pair = (t: { target: number; result: number } | null) => t && `${t.target}/${t.result}`;

test("s_kpi_food 2569 ทั้งอำเภอ → 109/91, 83.49%, เกณฑ์ 50 ผ่าน · r1–r6 10 · 7 · 77 · 18 · 60 · 15", () => {
  const food = annualValues(FOOD, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(food.total), "109/91");
  assert.equal(food.total?.pct?.toFixed(2), "83.49");
  assert.equal(food.goal, 50);
  assert.equal(food.passed, true);
  assert.deepEqual(
    food.ageMonths?.map((m) => [m.month, m.count]),
    [
      [1, 10],
      [2, 7],
      [3, 77],
      [4, 18],
      [5, 60],
      [6, 15],
    ],
  );
});

test("s_kpi_food 2569 ตำบลหัวเมือง → 12/12 · r1–r6 3 · 0 · 6 · 1 · 5 · 1: a เดือนอายุ the ตำบล has none of is 0", () => {
  const food = annualValues(FOOD, { ...DISTRICT_2569, area: "540605", by: "hosp" }, NAMES, YEARS);
  assert.equal(pair(food.total), "12/12");
  assert.deepEqual(
    food.ageMonths?.map((m) => m.count),
    [3, 0, 6, 1, 5, 1],
  );
});

test("s_kpi_food: no ช่วงเวลา to pick, ?period=q1 gives ทั้งปี (target1–result4 empty every year)", () => {
  for (const year of YEARS) {
    const query = reportQuery(FOOD, new URLSearchParams({ year, period: "q1" }), NAMES);
    assert.equal(query.period, "year", year);
  }
});

test("s_kpi_dental28 2569 ทั้งอำเภอ → 274/105, 38.32%, เกณฑ์ 25 ผ่าน · no เดือนอายุ", () => {
  const dental = annualValues(DENTAL28, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(dental.total), "274/105");
  assert.equal(dental.total?.pct?.toFixed(2), "38.32");
  assert.equal(dental.goal, 25);
  assert.equal(dental.passed, true);
  assert.equal(dental.ageMonths, null);
});

test("s_kpi_dental33 2569 ทั้งอำเภอ → 12,191/6,984, 57.29%, เกณฑ์ 50 ผ่าน", () => {
  const dental = annualValues(DENTAL33, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(dental.total), "12191/6984");
  assert.equal(dental.total?.pct?.toFixed(2), "57.29");
  assert.equal(dental.goal, 50);
  assert.equal(dental.passed, true);
});

test("s_kpi_dental33 2566 is shown as the data has it: 11,167/1,645, 14.73%, ไม่ผ่าน, in the trend and by ตำบล", () => {
  const dental = annualValues(DENTAL33, { ...DISTRICT_2569, year: "2566" }, NAMES, YEARS);
  assert.equal(pair(dental.total), "11167/1645");
  assert.equal(dental.total?.pct?.toFixed(2), "14.73");
  assert.equal(dental.passed, false);
  assert.deepEqual(
    dental.trend.map((p) => [p.b_year, p.totals?.pct?.toFixed(2) ?? null]),
    [
      ["2565", "61.89"],
      ["2566", "14.73"],
      ["2567", "47.58"],
      ["2568", "34.37"],
      ["2569", "57.29"],
    ],
  );
  assert.deepEqual(
    dental.units?.map((u) => [u.key, pair(u.totals)]),
    [
      ["540601", "2032/303"],
      ["540602", "1942/279"],
      ["540603", "1786/164"],
      ["540604", "1540/279"],
      ["540605", "1470/313"],
      ["540606", "1072/126"],
      ["540607", "514/55"],
      ["540608", "811/126"],
    ],
  );
});
