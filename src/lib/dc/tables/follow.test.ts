import assert from "node:assert/strict";
import test from "node:test";
import { S_HT_SCREEN_FOLLOW, S_NCD_SCREEN_REPLEATE1 } from "../fixtures/reports-follow-20261112";
import type { Cell, DcReportData, ReportQuery } from "../types";
import { followValues } from "./follow";

// FEATURES F59: the data layer of the ติดตามยืนยันวินิจฉัย page (SPEC §9.4)
// on s_ncd_screen_repleate1 and s_ht_screen_follow cut from the snapshot of
// 12 Nov, one row per หน่วยบริการ. The expected values are SCHEMA §4.6.10's
// for s_ht_screen_follow; s_ncd_screen_repleate1 2569 has grown since SCHEMA
// §4.6.9's 192/188 (date_com 9 Nov) to 203/195 (date_com 11 Nov, as HDC's
// page of 11 Nov), so its are the sums of rows in reports/{id}.json, added up
// apart from this code.

/** The fixture as /data/reports/{id}.json gives it: each row in header order, "" where left out */
function snapshot(cut: typeof S_HT_SCREEN_FOLLOW): DcReportData {
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

const NCD = snapshot(S_NCD_SCREEN_REPLEATE1);
const HT = snapshot(S_HT_SCREEN_FOLLOW);
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

test("s_ncd_screen_repleate1 2569 ทั้งปี → 203/195, 96.06%, เกณฑ์ 70 ผ่าน", () => {
  const ncd = followValues(NCD, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(ncd.total), "203/195");
  assert.equal(ncd.total?.pct?.toFixed(2), "96.06");
  assert.equal(ncd.goal, 70);
  assert.equal(ncd.passed, true);
});

/** The quarters added up, as เป้าหมาย/ผลงาน */
const quarterSum = (quarters: { totals: { target: number; result: number } | null }[]) =>
  pair(quarters.reduce((s, q) => ({ target: s.target + q.totals!.target, result: s.result + q.totals!.result }), { target: 0, result: 0 }));

test("s_ncd_screen_repleate1 2569 รายไตรมาส (Q_B) → 147/142, 55/53, 0/0 with ร้อยละ null (“—”), 1/0, summing to ทั้งปี 203/195", () => {
  const { quarters } = followValues(NCD, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    quarters.map((q) => [q.period, pair(q.totals)]),
    [["q1", "147/142"], ["q2", "55/53"], ["q3", "0/0"], ["q4", "1/0"]],
  );
  assert.equal(quarters[2].totals?.pct, null);
  assert.equal(quarterSum(quarters), "203/195");
});

test("s_ht_screen_follow 2569 → 1,215/1,202, 98.93%, เกณฑ์ 80 ผ่าน · รายไตรมาส (Q_C) 739/733, 470/465, 3/3, 3/1 summing to ทั้งปี", () => {
  const ht = followValues(HT, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(ht.total), "1215/1202");
  assert.equal(ht.total?.pct?.toFixed(2), "98.93");
  assert.equal(ht.goal, 80);
  assert.equal(ht.passed, true);
  assert.deepEqual(ht.quarters.map((q) => pair(q.totals)), ["739/733", "470/465", "3/3", "3/1"]);
  assert.equal(quarterSum(ht.quarters), "1215/1202");
});

test("s_ht_screen_follow 2569 วิธีวัด ทั้งปี → HBPM (r1) 1,172 · OBPM (r2) 811, together more than ผลงาน 1,202", () => {
  const { methods } = followValues(HT, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(methods, [
    { label: "HBPM", count: 1172 },
    { label: "OBPM", count: 811 },
  ]);
});

test("s_ht_screen_follow 2569 วิธีวัด of the ช่วงเวลา: ไตรมาส 2 → HBPM 458 · OBPM 280 · ไตรมาส 4 (ผลงาน 1) → HBPM 0, not “—” · OBPM 1", () => {
  const at = (period: ReportQuery["period"]) => followValues(HT, { ...DISTRICT_2569, period }, NAMES, YEARS).methods?.map((m) => m.count);
  assert.deepEqual(at("q2"), [458, 280]);
  assert.deepEqual(at("q4"), [0, 1]);
});

test("s_ncd_screen_repleate1 has no r1/r2 → methods null: no วิธีวัด on its page", () => {
  assert.equal(followValues(NCD, DISTRICT_2569, NAMES, YEARS).methods, null);
});

test("s_ht_screen_follow ?year=2567, a year without a block ปี (#258) → nothing to show, never zeros; แนวโน้ม has no point for 2567", () => {
  const ht = followValues(HT, { ...DISTRICT_2569, year: "2567" }, NAMES, YEARS);
  assert.deepEqual([ht.block, ht.total, ht.units, ht.passed, ht.quarters, ht.methods], [null, null, null, null, [], null]);
  assert.deepEqual(
    ht.trend.map((p) => [p.b_year, p.totals?.pct?.toFixed(2) ?? null]),
    [["2565", "89.69"], ["2566", "90.76"], ["2567", null], ["2568", "87.53"], ["2569", "98.93"]],
  );
});

test("แนวโน้ม of s_ncd_screen_repleate1 ทั้งปี → 80.00, 87.50, 83.46, 69.70, 96.06", () => {
  const { trend } = followValues(NCD, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(trend.map((p) => p.totals?.pct?.toFixed(2)), ["80.00", "87.50", "83.46", "69.70", "96.06"]);
});

test("s_ht_screen_follow 2569 รายหน่วยบริการ → 17 หน่วย named from catalog.json, in hospcode order, summing to ทั้งปี", () => {
  const { units, total } = followValues(HT, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    units?.map((u) => [u.name, pair(u.totals)]),
    [
      ["บ้านหนุน", "97/97"],
      ["ทุ่งน้าว", "90/89"],
      ["วังดิน", "117/116"],
      ["ลูนิเกตุ", "12/10"],
      ["ห้วยขอน", "116/116"],
      ["ห้วยหม้าย", "81/80"],
      ["เตาปูน", "154/154"],
      ["นาไร่เดียว", "1/1"],
      ["หัวเมือง", "100/100"],
      ["วังฟ่อน", "27/26"],
      ["สะเอียบ", "2/2"],
      ["ป่าเลา", "46/42"],
      ["นาหลวง", "53/51"],
      ["แดนชุมพล", "134/133"],
      ["แม่แรม", "2/2"],
      ["สอง", "112/112"],
      ["หนองเสี้ยว", "71/71"],
    ],
  );
  assert.equal(pair(total), "1215/1202");
});

test("an old link ?area=540601&by=area → ทั้งอำเภอ by หน่วยบริการ: s_ncd_screen_repleate1's 16 หน่วย and 203/195, not ตำบลบ้านหนุน", () => {
  const ncd = followValues(NCD, { ...DISTRICT_2569, area: "540601", by: "area" }, NAMES, YEARS);
  assert.deepEqual([ncd.query.area, ncd.query.by], ["all", "hosp"]);
  assert.equal(pair(ncd.total), "203/195");
  assert.equal(ncd.units?.length, 16);
});
