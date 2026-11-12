import assert from "node:assert/strict";
import test from "node:test";
import { S_EPI1 } from "../fixtures/reports-20261111";
import { S_EPI1_ALL } from "../fixtures/reports-epi1-20261111";
import type { Cell, DcReportData, ReportQuery } from "../types";
import { reportQuery } from "../values";
import { epiValues, findMeasures } from "./epi";

// FEATURES F54: the data layer of the EPI1 page (SPEC §9.4) on s_epi1 cut
// from the snapshot of 11 Nov 2569. The expected values are SCHEMA §4.6.4's,
// the EPI1 V0.4.2 mockup's where SCHEMA gives none (read from PA-Data, and
// equal to the snapshot, SCHEMA §4.6), and otherwise the sums of rows in
// reports/{id}.json, added up apart from this code.

/** The fixture as /data/reports/{id}.json gives it: each row in header order, "" where left out */
function snapshot(cut: typeof S_EPI1_ALL): DcReportData {
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

/** 2568–2569 with all 20 measures */
const EPI1 = snapshot(S_EPI1_ALL);
/** 2565–2569 with mmr, dtp2 and pcv1 */
const EPI1_YEARS = snapshot(S_EPI1);
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
const OVERVIEW_2569: ReportQuery = { year: "2569", area: "all", period: "year", measure: null, by: "area" };

/** เป้าหมาย/ผลงาน as SCHEMA writes them, null for no data */
const pair = (t: { target: number; result: number } | null) => t && `${t.target}/${t.result}`;

test("s_epi1 2569 ภาพรวม → the 20 รายการ in header order, each 181/ผลงาน of SCHEMA §4.6.4", () => {
  const { rows } = epiValues(EPI1, OVERVIEW_2569, NAMES, YEARS);
  assert.deepEqual(
    rows.map((r) => `${r.label} ${pair(r.total)}`),
    [
      "BCG 181/180",
      "DTP-HB3 181/178",
      "OPV3 181/178",
      "MMR 181/174",
      "HBV 181/179",
      "IPV 181/172",
      "DTP1 181/178",
      "ROTA 181/164",
      "HBV3 181/178",
      "HIB3 181/177",
      "DTP2 181/179",
      "HBV2 181/178",
      "HBV4 181/179",
      "HIB1 181/178",
      "HIB2 181/178",
      "IPV1 181/161",
      "ROTA1 181/180",
      "PCV1 181/1",
      "PCV2 181/1",
      "PCV3 181/1",
    ],
  );
});

test("s_epi1 2569 MMR → 181/174, 96.13%, เกณฑ์ 95 ผ่าน · PCV1 → 181/1, 0.55%, ไม่มีเกณฑ์ and no ผ่าน or ไม่ผ่าน", () => {
  const { rows } = epiValues(EPI1, OVERVIEW_2569, NAMES, YEARS);
  const mmr = rows.find((r) => r.measure === "mmr")!;
  assert.equal(mmr.total?.pct?.toFixed(2), "96.13");
  assert.equal(mmr.goal, 95);
  assert.equal(mmr.passed, true);
  const pcv1 = rows.find((r) => r.measure === "pcv1")!;
  assert.equal(pair(pcv1.total), "181/1");
  assert.equal(pcv1.total?.pct?.toFixed(2), "0.55");
  assert.equal(pcv1.goal, null);
  assert.equal(pcv1.passed, null);
});

test("s_epi1 2568 ภาพรวม → still the 20 รายการ, with data for the 10 of SCHEMA §4.6.4 only: DTP2 and the 9 after it have none (—)", () => {
  const { rows } = epiValues(EPI1, { ...OVERVIEW_2569, year: "2568" }, NAMES, YEARS);
  assert.equal(rows.length, 20);
  assert.deepEqual(
    rows.filter((r) => r.total !== null).map((r) => `${r.label} ${pair(r.total)}`),
    ["BCG 217/210", "DTP-HB3 217/209", "OPV3 217/197", "MMR 217/202", "HBV 217/210", "IPV 217/206", "DTP1 217/210", "ROTA 217/195", "HBV3 217/209", "HIB3 217/200"],
  );
  const dtp2 = rows.find((r) => r.measure === "dtp2")!;
  assert.equal(dtp2.total, null);
  assert.equal(dtp2.passed, null);
});

test("ค้นหา MMR → พบ 1 จาก 20 · mmr or \" Mmr \" the same · DTP → DTP-HB3, DTP1, DTP2 · a word no รายการ has → พบ 0 จาก 20", () => {
  const { rows } = epiValues(EPI1, OVERVIEW_2569, NAMES, YEARS);
  const found = (search: string) => findMeasures(rows, search).map((r) => r.label);
  assert.deepEqual(found("MMR"), ["MMR"]);
  assert.deepEqual(found("mmr"), ["MMR"]);
  assert.deepEqual(found(" Mmr "), ["MMR"]);
  assert.deepEqual(found("DTP"), ["DTP-HB3", "DTP1", "DTP2"]);
  assert.deepEqual(found("วัคซีนบาดทะยัก"), []);
  assert.equal(found("").length, 20);
});

test("ภาพรวม (no measure) → no รายละเอียด", () => {
  assert.equal(epiValues(EPI1, OVERVIEW_2569, NAMES, YEARS).detail, null);
});

test("รายละเอียด MMR 2569 ทั้งอำเภอ → 181/174, เกณฑ์ 95 ผ่าน, by ตำบล as the EPI1 V0.4.2 table: บ้านหนุน 24/24 … ทุ่งน้าว 14/13", () => {
  const { query, detail } = epiValues(EPI1, { ...OVERVIEW_2569, measure: "mmr" }, NAMES, YEARS);
  assert.equal(query.by, "area");
  assert.equal(detail?.label, "MMR");
  assert.equal(pair(detail.total), "181/174");
  assert.equal(detail.goal, 95);
  assert.equal(detail.passed, true);
  assert.deepEqual(
    detail.units?.map((u) => `${u.name} ${pair(u.totals)}`),
    ["บ้านหนุน 24/24", "บ้านกลาง 23/23", "ห้วยหม้าย 28/24", "เตาปูน 46/45", "หัวเมือง 14/14", "สะเอียบ 23/22", "แดนชุมพล 9/9", "ทุ่งน้าว 14/13"],
  );
});

test("รายละเอียด MMR แนวโน้ม → 83.78, 87.94, 89.52, 93.09, 96.13 for 2565–2569 as the EPI1 V0.4.2 trend · DTP2 → 2569 alone (SCHEMA §4.6.4)", () => {
  const trend = (measure: string) =>
    epiValues(EPI1_YEARS, { ...OVERVIEW_2569, measure }, NAMES, YEARS).detail?.trend.map((p) => [p.b_year, p.totals?.pct?.toFixed(2) ?? null]);
  assert.deepEqual(trend("mmr"), [["2565", "83.78"], ["2566", "87.94"], ["2567", "89.52"], ["2568", "93.09"], ["2569", "96.13"]]);
  assert.deepEqual(trend("dtp2"), [["2565", null], ["2566", null], ["2567", null], ["2568", null], ["2569", "98.90"]]);
});

test("รายละเอียด MMR 2569 ทั้งปี → เป้าหมาย/ผลงานรายเดือน ต.ค.–ก.ย. as the EPI1 V0.4.2 chart (ก.ย. 19/19 from reports/{id}.json)", () => {
  const { detail } = epiValues(EPI1, { ...OVERVIEW_2569, measure: "mmr" }, NAMES, YEARS);
  assert.deepEqual(
    detail?.steps.map((s) => `${s.period} ${pair(s.totals)}`),
    ["m10 17/17", "m11 14/14", "m12 17/16", "m01 16/16", "m02 9/9", "m03 14/12", "m04 10/9", "m05 20/20", "m06 13/11", "m07 12/12", "m08 20/19", "m09 19/19"],
  );
});

test("รายละเอียด MMR 2569 ไตรมาส 2 → 39/37 and รายไตรมาส: ไตรมาส 1 = ต.ค.–ธ.ค. 48/47 (B of SCHEMA §4.6.4: 48/39/43/51), the 4 summing to ทั้งปี 181/174", () => {
  const { detail } = epiValues(EPI1, { ...OVERVIEW_2569, period: "q2", measure: "mmr" }, NAMES, YEARS);
  assert.equal(pair(detail!.total), "39/37");
  assert.deepEqual(
    detail?.steps.map((s) => `${s.period} ${pair(s.totals)}`),
    ["q1 48/47", "q2 39/37", "q3 43/40", "q4 51/50"],
  );
  const sum = detail!.steps.reduce((s, q) => ({ target: s.target + q.totals!.target, result: s.result + q.totals!.result }), { target: 0, result: 0 });
  assert.equal(pair(sum), "181/174");
});

test("รายละเอียด MMR 2569 เดือนมีนาคม → 14/12, steps still by เดือน", () => {
  const { detail } = epiValues(EPI1, { ...OVERVIEW_2569, period: "m03", measure: "mmr" }, NAMES, YEARS);
  assert.equal(pair(detail!.total), "14/12");
  assert.equal(detail?.steps.length, 12);
});

test("ตำบลบ้านหนุน → รายละเอียด by หน่วยบริการ, adding up to the ตำบล's 24/24 · ?by=hosp on ทั้งอำเภอ → still by ตำบล (no เปรียบเทียบตาม)", () => {
  const tambon = epiValues(EPI1, { ...OVERVIEW_2569, area: "540601", by: "area", measure: "mmr" }, NAMES, YEARS);
  assert.equal(tambon.query.by, "hosp");
  assert.equal(pair(tambon.detail!.total), "24/24");
  assert.ok(tambon.detail?.units?.every((u) => u.name.startsWith("หน่วยบริการ ")));
  const units = tambon.detail!.units!;
  assert.equal(pair(units.reduce((s, u) => ({ target: s.target + u.totals.target, result: s.result + u.totals.result }), { target: 0, result: 0 })), "24/24");
  assert.equal(epiValues(EPI1, { ...OVERVIEW_2569, by: "hosp", measure: "mmr" }, NAMES, YEARS).query.by, "area");
});

test("รายละเอียด DTP2 2568, a year without its data → —: total, units and steps' totals null, and ภาพรวม keeps the other รายการ", () => {
  const { detail, rows } = epiValues(EPI1, { ...OVERVIEW_2569, year: "2568", measure: "dtp2" }, NAMES, YEARS);
  assert.equal(detail?.total, null);
  assert.equal(detail?.units, null);
  assert.ok(detail?.steps.every((s) => s.totals === null));
  assert.equal(rows.length, 20);
});

test("?measure=mmr → รายละเอียด MMR straight away · ?measure=MMR, ?measure=pcv9 or none → ภาพรวม (SPEC §9.4)", () => {
  const detail = (search: string) => epiValues(EPI1, reportQuery(EPI1, new URLSearchParams(search), NAMES), NAMES, YEARS).detail?.label ?? null;
  assert.equal(detail("measure=mmr"), "MMR");
  assert.equal(detail("measure=MMR"), null);
  assert.equal(detail("measure=pcv9"), null);
  assert.equal(detail(""), null);
});
