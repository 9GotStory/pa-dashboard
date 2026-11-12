import assert from "node:assert/strict";
import test from "node:test";
import { S_KPI_CHILDDEV2, S_KPI_CHILDDEV4 } from "../fixtures/reports-childdev-20261112";
import type { Cell, DcReportData, ReportQuery } from "../types";
import { childdevValues } from "./childdev";

// FEATURES F53: the data layer of the พัฒนาการเด็ก page (SPEC §9.4) on
// s_kpi_childdev4 and s_kpi_childdev2 cut from the snapshot, one row per
// หน่วยบริการ. The expected values are SCHEMA §4.6.3's, and otherwise the sums
// of rows in reports/{id}.json, added up apart from this code.

/** The fixture as /data/reports/{id}.json gives it: each row in header order, "" where left out */
function snapshot(cut: typeof S_KPI_CHILDDEV4): DcReportData {
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

const CHILDDEV4 = snapshot(S_KPI_CHILDDEV4);
const CHILDDEV2 = snapshot(S_KPI_CHILDDEV2);
const YEARS = ["2565", "2566", "2567", "2568", "2569"];
// catalog.json's areas and hospitals of the snapshot
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
  hospitals: [
    { hospcode: "06413", hospname: "บ้านหนุน", tambon_id: "540601" },
    { hospcode: "06414", hospname: "ทุ่งน้าว", tambon_id: "540608" },
    { hospcode: "06415", hospname: "วังดิน", tambon_id: "540602" },
    { hospcode: "06416", hospname: "ลูนิเกตุ", tambon_id: "540603" },
    { hospcode: "06417", hospname: "ห้วยขอน", tambon_id: "540603" },
    { hospcode: "06418", hospname: "ห้วยหม้าย", tambon_id: "540603" },
    { hospcode: "06419", hospname: "เตาปูน", tambon_id: "540604" },
    { hospcode: "06420", hospname: "นาไร่เดียว", tambon_id: "540604" },
    { hospcode: "06421", hospname: "หัวเมือง", tambon_id: "540605" },
    { hospcode: "06422", hospname: "วังฟ่อน", tambon_id: "540605" },
    { hospcode: "06423", hospname: "สะเอียบ", tambon_id: "540606" },
    { hospcode: "06424", hospname: "ป่าเลา", tambon_id: "540606" },
    { hospcode: "06425", hospname: "นาหลวง", tambon_id: "540606" },
    { hospcode: "06426", hospname: "แดนชุมพล", tambon_id: "540607" },
    { hospcode: "10368", hospname: "แม่แรม", tambon_id: "540604" },
    { hospcode: "11170", hospname: "สอง", tambon_id: "540601" },
    { hospcode: "11760", hospname: "หนองเสี้ยว", tambon_id: "540605" },
  ],
};
const DISTRICT_2569: ReportQuery = { year: "2569", area: "all", period: "year", measure: null, by: "hosp", domain: null };

/** เป้าหมาย/ผลงาน as SCHEMA writes them, null for no data */
const pair = (t: { target: number; result: number } | null) => t && `${t.target}/${t.result}`;
/** The quarters added up, as เป้าหมาย/ผลงาน */
const quarterSum = (quarters: { totals: { target: number; result: number } | null }[]) =>
  pair(quarters.reduce((s, q) => ({ target: s.target + q.totals!.target, result: s.result + q.totals!.result }), { target: 0, result: 0 }));

test("s_kpi_childdev4 2569 ทั้งปี → 1,083/861, 79.50%, เกณฑ์ 87 ไม่ผ่าน", () => {
  const dev = childdevValues(CHILDDEV4, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(dev.total), "1083/861");
  assert.equal(dev.total?.pct?.toFixed(2), "79.50");
  assert.equal(dev.goal, 87);
  assert.equal(dev.passed, false);
});

test("s_kpi_childdev4 2569 รายไตรมาส → 286/276, 297/264, 258/218, 242/103, and the 4 quarters sum to ทั้งปี 1,083/861", () => {
  const { quarters } = childdevValues(CHILDDEV4, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    quarters.map((q) => [q.period, pair(q.totals)]),
    [["q1", "286/276"], ["q2", "297/264"], ["q3", "258/218"], ["q4", "242/103"]],
  );
  assert.equal(quarterSum(quarters), "1083/861");
});

test("s_kpi_childdev2 2569 → 906/168, 18.54%, เกณฑ์ 20 ไม่ผ่าน · รายไตรมาส 278/57, 279/48, 228/37, 121/26 summing to ทั้งปี", () => {
  const dev = childdevValues(CHILDDEV2, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(dev.total), "906/168");
  assert.equal(dev.total?.pct?.toFixed(2), "18.54");
  assert.equal(dev.goal, 20);
  assert.equal(dev.passed, false);
  assert.deepEqual(dev.quarters.map((q) => pair(q.totals)), ["278/57", "279/48", "228/37", "121/26"]);
  assert.equal(quarterSum(dev.quarters), "906/168");
});

test("s_kpi_childdev2 ผ่านเมื่อร้อยละ ≥ เกณฑ์: a เกณฑ์ equal to 168 ÷ 906 × 100 passes, one a hair above does not", () => {
  const at = (goal: number) => childdevValues({ ...CHILDDEV2, report: { ...CHILDDEV2.report, goal } }, DISTRICT_2569, NAMES, YEARS).passed;
  assert.equal(at((168 / 906) * 100), true);
  assert.equal(at(18.55), false);
});

test("s_kpi_childdev4 2569 รายหน่วยบริการ → 17 หน่วย named from catalog.json, in hospcode order, summing to ทั้งปี", () => {
  const { units, total } = childdevValues(CHILDDEV4, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    units?.map((u) => [u.name, pair(u.totals)]),
    [
      ["บ้านหนุน", "44/36"],
      ["ทุ่งน้าว", "78/66"],
      ["วังดิน", "49/41"],
      ["ลูนิเกตุ", "21/20"],
      ["ห้วยขอน", "54/48"],
      ["ห้วยหม้าย", "87/68"],
      ["เตาปูน", "108/63"],
      ["นาไร่เดียว", "15/15"],
      ["หัวเมือง", "47/40"],
      ["วังฟ่อน", "40/38"],
      ["สะเอียบ", "85/56"],
      ["ป่าเลา", "36/21"],
      ["นาหลวง", "40/28"],
      ["แดนชุมพล", "46/34"],
      ["แม่แรม", "138/107"],
      ["สอง", "162/158"],
      ["หนองเสี้ยว", "33/22"],
    ],
  );
  assert.equal(pair(total), "1083/861");
});

test("an old link ?area=540601&by=area → ทั้งอำเภอ by หน่วยบริการ: the 17 หน่วย and 1,083/861, not ตำบลบ้านหนุน", () => {
  const dev = childdevValues(CHILDDEV4, { ...DISTRICT_2569, area: "540601", by: "area" }, NAMES, YEARS);
  assert.deepEqual([dev.query.area, dev.query.by], ["all", "hosp"]);
  assert.equal(pair(dev.total), "1083/861");
  assert.equal(dev.units?.length, 17);
  assert.equal(dev.units?.[0].key, "06413");
});

test("?period=q4 → ไตรมาส 4 242/103 (42.56%) with its 17 หน่วย; รายไตรมาส stays the 4 quarters", () => {
  const dev = childdevValues(CHILDDEV4, { ...DISTRICT_2569, period: "q4" }, NAMES, YEARS);
  assert.equal(pair(dev.total), "242/103");
  assert.equal(dev.total?.pct?.toFixed(2), "42.56");
  assert.equal(dev.units?.length, 17);
  assert.equal(dev.quarters.length, 4);
});

test("แนวโน้ม ทั้งปี → s_kpi_childdev4 85.82, 71.23, 69.50, 71.08, 79.50 · s_kpi_childdev2 19.46, 15.11, 10.80, 8.84, 18.54", () => {
  const line = (data: DcReportData) => childdevValues(data, DISTRICT_2569, NAMES, YEARS).trend.map((p) => p.totals?.pct?.toFixed(2));
  assert.deepEqual(line(CHILDDEV4), ["85.82", "71.23", "69.50", "71.08", "79.50"]);
  assert.deepEqual(line(CHILDDEV2), ["19.46", "15.11", "10.80", "8.84", "18.54"]);
});

test("?year=2560, a year without a block ปี → block null and nothing to show, never zeros", () => {
  const dev = childdevValues(CHILDDEV4, { ...DISTRICT_2569, year: "2560" }, NAMES, YEARS);
  assert.deepEqual([dev.block, dev.total, dev.units, dev.passed, dev.quarters], [null, null, null, null, []]);
});
