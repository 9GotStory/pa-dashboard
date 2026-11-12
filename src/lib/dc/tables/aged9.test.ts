import assert from "node:assert/strict";
import test from "node:test";
import { S_AGED9 } from "../fixtures/reports-aged9-20261112";
import type { Cell, DcReportData, ReportQuery } from "../types";
import { aged9Values } from "./aged9";

// FEATURES F57: the data layer of the AGED9 page (SPEC §9.4) on s_aged9 from
// the snapshot of 12 Nov 2569. SCHEMA §4.6.7's totals are those of 11 Nov
// (12,188/11,992); HDC's update of 11 Nov 16:49 (date_com 202611111649) took
// 2 off ปี 2569, and its page shows ด้าน 1 12,039 as this snapshot does. The
// expected values are the sums of rows in reports/{id}.json, added up apart
// from this code.

/** The fixture as /data/reports/{id}.json gives it: each row in header order, "" where left out */
function snapshot(cut: typeof S_AGED9): DcReportData {
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

const AGED9 = snapshot(S_AGED9);
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

test("s_aged9 2569 ทั้งอำเภอ → 12,186/11,990, 98.39%, เกณฑ์ 80 ผ่าน", () => {
  const aged = aged9Values(AGED9, DISTRICT_2569, NAMES, YEARS);
  assert.equal(pair(aged.total), "12186/11990");
  assert.equal(aged.total?.pct?.toFixed(2), "98.39");
  assert.equal(aged.goal, 80);
  assert.equal(aged.passed, true);
});

test("s_aged9 2569 ทั้งอำเภอ ด้าน 1–9 → 12,039 · 12,038 · 12,037 · 12,045 · 12,038 · 11,968 · 12,021 · 12,038 · 12,002 รายการ", () => {
  const { domains } = aged9Values(AGED9, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(
    domains.map((d) => [d.domain, d.count]),
    [[1, 12039], [2, 12038], [3, 12037], [4, 12045], [5, 12038], [6, 11968], [7, 12021], [8, 12038], [9, 12002]],
  );
});

test("ชื่อด้านตาม SCHEMA §4.6.7: 1 การมองเห็น … 6 ภาวะซึมเศร้า (2Q) … 9 ภาวะขาดสารอาหาร", () => {
  const { domains } = aged9Values(AGED9, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(domains.map((d) => d.label), [
    "การมองเห็น",
    "การกลั้นปัสสาวะ",
    "การได้ยิน",
    "การปฏิบัติกิจวัตรประจำวัน",
    "ความคิดความจำ",
    "ภาวะซึมเศร้า (2Q)",
    "การเคลื่อนไหว",
    "สุขภาพช่องปาก",
    "ภาวะขาดสารอาหาร",
  ]);
});

test("s_aged9 2565 → ความครอบคลุมไม่มีข้อมูล (ผลงานว่างทั้งปี) and ด้าน 9 ไม่มีข้อมูล, the other ด้าน as counted", () => {
  const aged = aged9Values(AGED9, { ...DISTRICT_2569, year: "2565" }, NAMES, YEARS);
  assert.equal(aged.block?.b_year, "2565");
  assert.equal(aged.total, null);
  assert.equal(aged.passed, null);
  assert.deepEqual(
    aged.domains.map((d) => d.count),
    [10263, 8364, 198, 10588, 10420, 10580, 10586, 10585, null],
  );
});

test("ตำบลเตาปูน 2565 → ด้าน 3 198, and ห้วยหม้าย ด้าน 3 0 (the district has data), ด้าน 9 still ไม่มีข้อมูล", () => {
  const count = (area: string, k: number) =>
    aged9Values(AGED9, { ...DISTRICT_2569, year: "2565", area, by: "hosp" }, NAMES, YEARS).domains[k - 1].count;
  assert.equal(count("540604", 3), 198);
  assert.equal(count("540603", 3), 0);
  assert.equal(count("540604", 9), null);
});

test("s_aged9 2569 รายตำบล → 8 ตำบล, บ้านหนุน 2,169/2,108 and บ้านกลาง 2,004/1,984", () => {
  const { units } = aged9Values(AGED9, DISTRICT_2569, NAMES, YEARS);
  assert.equal(units?.length, 8);
  assert.deepEqual(units?.slice(0, 2).map((u) => [u.name, pair(u.totals)]), [["บ้านหนุน", "2169/2108"], ["บ้านกลาง", "2004/1984"]]);
});

test("ตำบลสะเอียบ 2569 → รายหน่วยบริการ 06423 662/658, 06424 221/221, 06425 297/289", () => {
  const { units } = aged9Values(AGED9, { ...DISTRICT_2569, area: "540606", by: "hosp" }, NAMES, YEARS);
  assert.deepEqual(units?.map((u) => [u.key, pair(u.totals)]), [["06423", "662/658"], ["06424", "221/221"], ["06425", "297/289"]]);
});

test("แนวโน้มทั้งอำเภอ → 2565 —, 2566 93.26, 2567 96.36, 2568 97.05, 2569 98.39", () => {
  const { trend } = aged9Values(AGED9, DISTRICT_2569, NAMES, YEARS);
  assert.deepEqual(trend.map((p) => [p.b_year, p.totals?.pct?.toFixed(2) ?? null]), [
    ["2565", null],
    ["2566", "93.26"],
    ["2567", "96.36"],
    ["2568", "97.05"],
    ["2569", "98.39"],
  ]);
});

test("ด้าน 8 (สุขภาพช่องปาก) 2569 ทั้งอำเภอ → รายละเอียดรายตำบล บ้านหนุน 2,144 … ทุ่งน้าว 915, รวม 12,038", () => {
  const { detail } = aged9Values(AGED9, { ...DISTRICT_2569, domain: 8 }, NAMES, YEARS);
  assert.equal(detail?.label, "สุขภาพช่องปาก");
  assert.equal(detail?.count, 12038);
  assert.deepEqual(detail?.units?.map((u) => u.count), [2144, 1984, 1975, 1657, 1591, 1169, 603, 915]);
});

test("ด้าน 8 ตำบลสะเอียบ 2569 → รายหน่วยบริการ 658 · 221 · 290, รวม 1,169", () => {
  const { detail } = aged9Values(AGED9, { ...DISTRICT_2569, area: "540606", by: "hosp", domain: 8 }, NAMES, YEARS);
  assert.equal(detail?.count, 1169);
  assert.deepEqual(detail?.units?.map((u) => [u.key, u.count]), [["06423", 658], ["06424", 221], ["06425", 290]]);
});

test("ภาพรวม (domain null) → no รายละเอียด · ด้าน 9 ปี 2565 → รายละเอียดที่ไม่มีข้อมูล (count and units null)", () => {
  assert.equal(aged9Values(AGED9, DISTRICT_2569, NAMES, YEARS).detail, null);
  const { detail } = aged9Values(AGED9, { ...DISTRICT_2569, year: "2565", domain: 9 }, NAMES, YEARS);
  assert.equal(detail?.label, "ภาวะขาดสารอาหาร");
  assert.equal(detail?.count, null);
  assert.equal(detail?.units, null);
});
