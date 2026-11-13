import assert from "node:assert/strict";
import test from "node:test";
import { S_DM_SCREEN, S_HT_SCREEN } from "../fixtures/reports-screen-20261112";
import type { Cell, DcReportData, ReportQuery } from "../types";
import { reportQuery } from "../values";
import { screenValues } from "./screen";

// FEATURES F58: the data layer of the คัดกรองเบาหวานและความดัน page (SPEC
// §9.4) on s_dm_screen and s_ht_screen from the snapshot of 12 Nov 2569.
// SCHEMA §4.6.8's totals are those of 4 Nov (dm 20,306/18,528, ht
// 15,306/14,358); HDC's updates of 11 Nov (date_com 202611111724 and
// 202611111801) moved them a little. The expected values are the sums of rows
// in reports/{id}.json, added up apart from this code.

/** The fixture as /data/reports/{id}.json gives it: each row in header order, "" where left out */
function snapshot(cut: typeof S_DM_SCREEN): DcReportData {
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

const DM = snapshot(S_DM_SCREEN);
const HT = snapshot(S_HT_SCREEN);
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

test("s_dm_screen 2569 ทั้งอำเภอ → 20,308/18,528, 91.23%, เกณฑ์ 90 ผ่าน", () => {
  const dm = screenValues(DM, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(dm.total), "20308/18528");
  assert.equal(dm.total?.pct?.toFixed(2), "91.23");
  assert.equal(dm.goal, 90);
  assert.equal(dm.passed, true);
});

/** Each ไตรมาส as [ผลงาน, ผลงานสะสม, ร้อยละสะสม to 2 places] */
const steps = (quarters: { result: number; cumulative: number; pct: number | null }[]) =>
  quarters.map((q) => [q.result, q.cumulative, q.pct?.toFixed(2) ?? null]);

test("s_dm_screen 2569 ทั้งอำเภอ ไตรมาส 1–4 → ผลงาน 7,910 · 10,268 · 223 · 127, ร้อยละสะสม 38.95 · 89.51 · 90.61 · 91.23", () => {
  const { quarters } = screenValues(DM, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    quarters.map((q) => q.period),
    ["q1", "q2", "q3", "q4"],
  );
  assert.deepEqual(steps(quarters), [
    [7910, 7910, "38.95"],
    [10268, 18178, "89.51"],
    [223, 18401, "90.61"],
    [127, 18528, "91.23"],
  ]);
});

test("s_ht_screen 2569 ทั้งอำเภอ → 15,309/14,357, 93.78% ผ่าน · ไตรมาส 6,403 · 7,740 · 117 · 97, ร้อยละสะสม 41.83 · 92.38 · 93.15 · 93.78", () => {
  const ht = screenValues(HT, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(ht.total), "15309/14357");
  assert.equal(ht.total?.pct?.toFixed(2), "93.78");
  assert.equal(ht.goal, 90);
  assert.equal(ht.passed, true);
  assert.deepEqual(steps(ht.quarters), [
    [6403, 6403, "41.83"],
    [7740, 14143, "92.38"],
    [117, 14260, "93.15"],
    [97, 14357, "93.78"],
  ]);
});

test("ผลงานสะสมไตรมาส 4 เท่าผลงานทั้งปี: ทุกปีของทั้งสองตาราง", () => {
  for (const data of [DM, HT]) {
    for (const year of YEARS) {
      const { total, quarters } = screenValues(data, { ...DISTRICT_2569, year }, NAMES, YEARS);
      assert.equal(quarters.at(-1)?.cumulative, total?.result, `${data.report.source_table} ${year}`);
      assert.equal(quarters.at(-1)?.pct, total?.pct, `${data.report.source_table} ${year}`);
    }
  }
});

test("s_ht_screen 2566: ไตรมาส 3–4 ว่างทั้งอำเภอ → ผลงาน 0 และร้อยละสะสมคงที่ที่ทั้งปี 91.60", () => {
  const { quarters } = screenValues(HT, { ...DISTRICT_2569, year: "2566" }, NAMES, YEARS);
  assert.deepEqual(steps(quarters), [
    [11474, 11474, "70.87"],
    [3356, 14830, "91.60"],
    [0, 14830, "91.60"],
    [0, 14830, "91.60"],
  ]);
});

test("s_dm_screen 2569 ตำบลบ้านหนุน → 3,199/2,954 ร้อยละสะสมหารด้วยเป้าหมายของตำบล 65.27 · 92.31 · 92.31 · 92.34", () => {
  const dm = screenValues(DM, { ...DISTRICT_2569, area: "540601", by: "hosp" }, NAMES, YEARS);
  assert.equal(pair(dm.total), "3199/2954");
  assert.deepEqual(steps(dm.quarters), [
    [2088, 2088, "65.27"],
    [865, 2953, "92.31"],
    [0, 2953, "92.31"],
    [1, 2954, "92.34"],
  ]);
});

test("s_dm_screen แนวโน้ม 2565–2569 ทั้งอำเภอ → 90.91 · 86.25 · 81.05 · 81.40 · 91.23", () => {
  const { trend } = screenValues(DM, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    trend.map((p) => [p.b_year, p.totals?.pct?.toFixed(2) ?? null]),
    [
      ["2565", "90.91"],
      ["2566", "86.25"],
      ["2567", "81.05"],
      ["2568", "81.40"],
      ["2569", "91.23"],
    ],
  );
});

test("?period=q2 → ทั้งปี: ตารางไม่มีกลุ่มไตรมาส จึงไม่มีช่วงเวลาอื่น", () => {
  assert.equal(reportQuery(DM, new URLSearchParams("year=2569&period=q2"), NAMES).period, "year");
  assert.equal(reportQuery(HT, new URLSearchParams("year=2569&period=m10"), NAMES).period, "year");
});
