import assert from "node:assert/strict";
import test from "node:test";
import { S_ANC5, S_KPI_ANC12 } from "../fixtures/reports-anc-20261112";
import type { Cell, DcReportData, ReportQuery } from "../types";
import { ancValues } from "./anc";

// FEATURES F52: the data layer of the ANC page (SPEC §9.4) on s_kpi_anc12 and
// s_anc5 cut from the snapshot. The expected values are SCHEMA §4.6.2's, the
// ANC V0.2 mockup's where SCHEMA gives none (read from PA-Data), and otherwise
// the sums of rows in reports/{id}.json, added up apart from this code.

/** The fixture as /data/reports/{id}.json gives it: each row in header order, "" where left out */
function snapshot(cut: typeof S_KPI_ANC12): DcReportData {
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

const ANC12 = snapshot(S_KPI_ANC12);
const ANC5 = snapshot(S_ANC5);
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
const DISTRICT_2569: ReportQuery = { year: "2569", area: "all", period: "year", measure: null, by: "area" };

/** เป้าหมาย/ผลงาน as SCHEMA writes them, null for no data */
const pair = (t: { target: number; result: number } | null) => t && `${t.target}/${t.result}`;
/** The quarters added up, as เป้าหมาย/ผลงาน */
const quarterSum = (quarters: { totals: { target: number; result: number } | null }[]) =>
  pair(quarters.reduce((s, q) => ({ target: s.target + q.totals!.target, result: s.result + q.totals!.result }), { target: 0, result: 0 }));

test("s_kpi_anc12 2569 ทั้งอำเภอ → 84/66, 78.57%, เกณฑ์ 75 ผ่าน", () => {
  const anc = ancValues(ANC12, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(anc.total), "84/66");
  assert.equal(anc.total?.pct?.toFixed(2), "78.57");
  assert.equal(anc.goal, 75);
  assert.equal(anc.passed, true);
});

test("s_kpi_anc12 2569 รายไตรมาส → 22/20, 17/14, 23/19, 22/13, and the 4 quarters sum to ทั้งปี 84/66", () => {
  const { quarters } = ancValues(ANC12, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    quarters.map((q) => [q.period, pair(q.totals)]),
    [["q1", "22/20"], ["q2", "17/14"], ["q3", "23/19"], ["q4", "22/13"]],
  );
  assert.equal(quarterSum(quarters), "84/66");
});

test("s_anc5 2569 ทั้งอำเภอ → 82/60, 73.17%, เกณฑ์ 75 ไม่ผ่าน · รายไตรมาส 22/20, 15/12, 23/17, 22/11 summing to ทั้งปี", () => {
  const anc = ancValues(ANC5, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(anc.total), "82/60");
  assert.equal(anc.total?.pct?.toFixed(2), "73.17");
  assert.equal(anc.goal, 75);
  assert.equal(anc.passed, false);
  assert.deepEqual(anc.quarters.map((q) => pair(q.totals)), ["22/20", "15/12", "23/17", "22/11"]);
  assert.equal(quarterSum(anc.quarters), "82/60");
});

test("s_kpi_anc12 2569 รายตำบล → the ANC V0.2 table: บ้านหนุน 14/12 … ทุ่งน้าว 6/5", () => {
  const { units } = ancValues(ANC12, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    units?.map((u) => [u.name, pair(u.totals)]),
    [
      ["บ้านหนุน", "14/12"],
      ["บ้านกลาง", "6/5"],
      ["ห้วยหม้าย", "15/12"],
      ["เตาปูน", "14/10"],
      ["หัวเมือง", "6/5"],
      ["สะเอียบ", "22/16"],
      ["แดนชุมพล", "1/1"],
      ["ทุ่งน้าว", "6/5"],
    ],
  );
});

test("แนวโน้ม s_kpi_anc12 ทั้งอำเภอ ทั้งปี → the ANC V0.2 line: 69.83, 81.20, 65.26, 65.32, 78.57", () => {
  const { trend } = ancValues(ANC12, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    trend.map((p) => [p.b_year, p.totals?.pct?.toFixed(2)]),
    [["2565", "69.83"], ["2566", "81.20"], ["2567", "65.26"], ["2568", "65.32"], ["2569", "78.57"]],
  );
});

test("แนวโน้ม of a report without the block ปี 2567 → 2567 stays on the axis as no data (null), not left out", () => {
  const without2567 = { ...ANC12, years: ANC12.years.filter((b) => b.b_year !== "2567") };
  const { trend } = ancValues(without2567, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    trend.map((p) => [p.b_year, pair(p.totals)]),
    [["2565", "116/81"], ["2566", "117/95"], ["2567", null], ["2568", "124/81"], ["2569", "84/66"]],
  );
});

test("?year=2568&area=540606&period=q2&by=hosp → ตำบลสะเอียบ ไตรมาส 2 6/3 by its 3 หน่วยบริการ; its quarters 9/6, 6/3, 5/4, 6/3 sum to its ทั้งปี 26/16", () => {
  const query: ReportQuery = { year: "2568", area: "540606", period: "q2", measure: null, by: "hosp" };
  const anc = ancValues(ANC12, query, NAMES, YEARS);
  assert.equal(pair(anc.total), "6/3");
  assert.deepEqual(
    anc.units?.map((u) => [u.key, pair(u.totals)]),
    [["06423", "2/1"], ["06424", "1/0"], ["06425", "3/2"]],
  );
  assert.deepEqual(anc.quarters.map((q) => pair(q.totals)), ["9/6", "6/3", "5/4", "6/3"]);
  assert.equal(quarterSum(anc.quarters), "26/16");
  assert.equal(pair(ancValues(ANC12, { ...query, period: "year" }, NAMES, YEARS).total), "26/16");
});

test("?year=2560, a year without a block ปี → block null and nothing to show, never zeros", () => {
  const anc = ancValues(ANC12, { ...DISTRICT_2569, year: "2560" }, NAMES, YEARS);
  assert.deepEqual([anc.block, anc.total, anc.units, anc.passed, anc.quarters], [null, null, null, null, []]);
});
