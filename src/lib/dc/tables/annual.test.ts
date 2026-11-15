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

// FEATURES F74: การเปลี่ยนแปลงจากปีก่อน of ตัวเลขสรุป (SPEC §9.4). The expected
// values are the sums of the fixture's rows, added up apart from this code.

test("s_kpi_food 2568 ทั้งอำเภอ (112/65) → จากปี 2567 (108/72): เป้าหมาย +4 (+3.70%), ผลงาน −7 (−9.72%), ร้อยละ −8.63 จุดร้อยละ", () => {
  const { change } = annualValues(FOOD, { ...DISTRICT_2569, year: "2568" }, NAMES, YEARS);
  assert.deepEqual(
    change && [
      change.year,
      change.target.count,
      change.target.pct?.toFixed(2),
      change.result.count,
      change.result.pct?.toFixed(2),
      change.points?.toFixed(2),
    ],
    ["2567", 4, "3.70", -7, "-9.72", "-8.63"],
  );
});

// FEATURES F75: ร้อยละสอบถาม of s_kpi_food (GLOSSARY, SPEC §9.4), on the
// column total of the snapshot of 14 Nov 2569. The district's figures are
// SCHEMA §4.6.6's, which has none by ตำบล: those are the sums of the
// snapshot's rows, added up apart from this code.

/** เด็กอายุครบ 6 เดือน/ถูกสอบถาม and ร้อยละสอบถาม as shown, "—" for null */
const askingText = (s: { children: number; asked: number; pct: number | null }) =>
  `${s.children}/${s.asked} ${s.pct?.toFixed(2) ?? "—"}`;

test("s_kpi_food 2568 ทั้งอำเภอ → เด็กอายุครบ 6 เดือน 208, ถูกสอบถาม 112, ร้อยละสอบถาม 53.85", () => {
  const { asking } = annualValues(FOOD, { ...DISTRICT_2569, year: "2568" }, NAMES, YEARS);
  assert.equal(asking && askingText(asking), "208/112 53.85");
});

test("s_kpi_food 2568 รายตำบล → each ตำบล's เด็กอายุครบ 6 เดือน, ถูกสอบถาม and ร้อยละสอบถาม, summed before dividing", () => {
  const { units } = annualValues(FOOD, { ...DISTRICT_2569, year: "2568" }, NAMES, YEARS);
  assert.deepEqual(
    units?.map((u) => [u.key, u.asking && askingText(u.asking)]),
    [
      ["540601", "33/30 90.91"],
      ["540602", "23/19 82.61"],
      ["540603", "27/23 85.19"],
      ["540604", "49/5 10.20"],
      ["540605", "19/15 78.95"],
      ["540606", "33/9 27.27"],
      ["540607", "9/6 66.67"],
      ["540608", "15/5 33.33"],
    ],
  );
});

test("s_kpi_food 2568 ตำบลเตาปูน → 49, 5, 10.20: ร้อยละสอบถาม is of the area picked", () => {
  const { asking } = annualValues(FOOD, { ...DISTRICT_2569, year: "2568", area: "540604", by: "hosp" }, NAMES, YEARS);
  assert.equal(asking && askingText(asking), "49/5 10.20");
});

/** S_KPI_FOOD with a cell of 2568 emptied in the rows of a ตำบล, or of the whole district ("5406") */
function food2568Without(column: string, area: string): DcReportData {
  const rows = S_KPI_FOOD.years["2568"].map((row) =>
    String(row.areacode).startsWith(area) ? { ...row, [column]: "" } : row,
  );
  return snapshot({ ...S_KPI_FOOD, years: { ...S_KPI_FOOD.years, "2568": rows } });
}

test("s_kpi_food: a ตำบล whose total is 0 (none in the snapshot: แดนชุมพล 2568 emptied) → ร้อยละสอบถาม —, the counts as they are", () => {
  const query: ReportQuery = { ...DISTRICT_2569, year: "2568" };
  const food = annualValues(food2568Without("total", "540607"), query, NAMES, YEARS);
  assert.equal(food.units?.[6].asking && askingText(food.units[6].asking), "0/6 —");
  // The district without แดนชุมพล's 9: 112 ÷ 199
  assert.equal(food.asking && askingText(food.asking), "199/112 56.28");
  const tambon = annualValues(
    food2568Without("total", "540607"),
    { ...query, area: "540607", by: "hosp" },
    NAMES,
    YEARS,
  );
  assert.equal(tambon.asking && askingText(tambon.asking), "0/6 —");
});

test("s_kpi_food: a year the district has no ผลงาน (2568 emptied) has no ร้อยละสอบถาม, as no เดือนอายุ", () => {
  const food = annualValues(food2568Without("result", "5406"), { ...DISTRICT_2569, year: "2568" }, NAMES, YEARS);
  assert.equal(food.total, null);
  assert.equal(food.ageMonths, null);
  assert.equal(food.asking, null);
});

test("s_kpi_dental28 and s_kpi_dental33 have no ร้อยละสอบถาม, of the area or of a unit", () => {
  for (const data of [DENTAL28, DENTAL33]) {
    const dental = annualValues(data, DISTRICT_2569, NAMES, YEARS);
    assert.equal(dental.asking, null);
    assert.deepEqual(
      dental.units?.map((u) => u.asking),
      Array(8).fill(null),
    );
  }
});
