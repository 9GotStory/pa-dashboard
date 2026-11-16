import assert from "node:assert/strict";
import test from "node:test";
import { PA_20261116 } from "./fixtures/pa-20261116";
import { processPaSnapshot, type PaSnapshot } from "./process";

// FEATURES F81: PA's processing moved out of useKPIData.ts (SPEC §4), on the
// GAS responses of 16 Nov 2569. Expected values are what production /pa showed
// from the same BATCH_ALL (.pa-check/f81-prod): each KPI's row (title,
// period badge, ผลงาน, TARGET), the per-hospital Target/Result of the cells and
// the อัปเดตล่าสุด line; the rest come from the sheets' own cells.

const fixture = (): PaSnapshot => structuredClone(PA_20261116);

// [title, period badge, ผลงาน, goal, months of the TARGET column]
const row = (k: { title: string; period?: string; percentage: number; targetValue: number; targetMonths: number }) => [
  k.title,
  k.period,
  k.percentage.toFixed(2),
  k.targetValue,
  k.targetMonths,
];

const ANC12 = "ร้อยละหญิงตั้งครรภ์ได้รับการฝากครรภ์ครั้งแรกก่อนหรือเท่ากับ 12 สัปดาห์";
const CHILDDEV4 = "ร้อยละของเด็กอายุ 0-5 ปี ทั้งหมดตามช่วงอายุที่กำหนดมีพัฒนาการสมวัย";
const NCD_REPEAT = "ร้อยละการตรวจติดตามยืนยันวินิจฉัยกลุ่มสงสัยป่วยโรคเบาหวาน";
const CAVITY_FREE = "ร้อยละของเด็กอายุ 0-5 ปี ฟันดีไม่มีผุ";
const BCG = "เด็กครบ 1 ปี ได้รับวัคซีน BCG";
const FULLY_1Y = "เด็กครบ 1 ปี ได้รับวัคซีนครบตามเกณฑ์ (fully immunized)";
const DTP4 = "เด็กครบ 2 ปี ได้รับวัคซีน DTP4";

// Rows 1, 4, 9 and 11 of ตัวชี้วัดพื้นฐาน, then rows 1, 18 and 19 of the
// สร้างเสริมภูมิคุ้มกันโรค tab (กลุ่มอายุ 1 ปี before กลุ่มอายุ 2 ปี).
const PRODUCTION_ROWS = [
  [ANC12, "รายปี", "77.65", 75, 12],
  [CHILDDEV4, "สะสม 9 เดือน", "89.93", 87, 9],
  [NCD_REPEAT, "สะสม 12 เดือน (Q4)", "96.06", 70, 12],
  [CAVITY_FREE, "รายปี", "83.33", 80, 12],
  [BCG, "รายปี", "99.45", 90, 12],
  [FULLY_1Y, "รายปี", "78.57", 90, 12],
  [DTP4, "รายปี", "93.69", 90, 12],
];

test("meta.registry of 16 Nov 2569 → the 7 KPIs in the order, period, ผลงาน and TARGET production /pa showed", () => {
  const { data } = processPaSnapshot(fixture());

  assert.deepEqual(data.map(row), PRODUCTION_ROWS);
  assert.deepEqual(
    data.map((k) => [k.tableName, k.category, k.subgroup]),
    [
      ["s_kpi_anc12", "ตัวชี้วัดพื้นฐาน", ""],
      ["s_kpi_childdev4", "ตัวชี้วัดพื้นฐาน", ""],
      ["s_ncd_screen_repleate1", "ตัวชี้วัดพื้นฐาน", ""],
      ["s_dental_0_5_cavity_free", "ตัวชี้วัดพื้นฐาน", ""],
      ["s_epi1__bcg", "สร้างเสริมภูมิคุ้มกันโรค", "กลุ่มอายุ 1 ปี"],
      ["s_epi_complete__1y", "สร้างเสริมภูมิคุ้มกันโรค", "กลุ่มอายุ 1 ปี"],
      ["s_epi2__dtp4", "สร้างเสริมภูมิคุ้มกันโรค", "กลุ่มอายุ 2 ปี"],
    ],
  );
  assert.equal(
    data[0].link,
    "https://hdc.moph.go.th/pre/public/standard-report-detail/1c1b8e24aff59258a806f122e264031e",
  );
});

test("s_kpi_anc12 → Target 85 Result 66 over 42 rows, and per hospital the Target/Result of production's 14 cells", () => {
  const { data, hospitalMap } = processPaSnapshot(fixture());
  const anc12 = data[0];

  assert.equal(anc12.data.length, 42);
  assert.deepEqual([anc12.totalTarget, anc12.totalResult], [85, 66]);
  const cells = Object.entries(anc12.breakdown).map(
    ([code, b]) => `${hospitalMap[code].name}: Target ${b.target}, Result ${b.result}`,
  );
  assert.deepEqual(
    cells.sort(),
    [
      "บ้านหนุน: Target 9, Result 7",
      "สอง: Target 6, Result 6",
      "วังดิน: Target 5, Result 4",
      "ลูนิเกตุ: Target 5, Result 5",
      "ห้วยหม้าย: Target 10, Result 7",
      "เตาปูน: Target 6, Result 3",
      "แม่แรม: Target 8, Result 7",
      "วังฟ่อน: Target 3, Result 3",
      "หนองเสี้ยว: Target 3, Result 2",
      "สะเอียบ: Target 14, Result 9",
      "ป่าเลา: Target 4, Result 3",
      "นาหลวง: Target 4, Result 4",
      "แดนชุมพล: Target 2, Result 1",
      "ทุ่งน้าว: Target 6, Result 5",
    ].sort(),
  );
  assert.equal(anc12.breakdown["06413"].percentage.toFixed(2), "77.78");
});

test("a row outside อำเภอสอง (areacode not 5406…) is left out", () => {
  const snapshot = fixture();
  const rows = snapshot.BATCH_ALL.data!.s_kpi_anc12;
  rows.push({ ...rows[0], hospcode: "06395", areacode: "54010101", target: 50, result: 0 });

  const anc12 = processPaSnapshot(snapshot).data[0];

  assert.equal(anc12.data.length, 42);
  assert.deepEqual([anc12.totalTarget, anc12.totalResult, anc12.percentage.toFixed(2)], [85, 66, "77.65"]);
  assert.equal(anc12.breakdown["06395"], undefined);
});

test("hospitals and tambon_master → the 17 hospitals and 8 ตำบล of the sheets", () => {
  const { hospitalMap, tambonMap } = processPaSnapshot(fixture());

  assert.equal(Object.keys(hospitalMap).length, 17);
  assert.deepEqual(hospitalMap["06413"], { name: "บ้านหนุน", tambon_id: "540601" });
  assert.deepEqual(hospitalMap["10368"], { name: "แม่แรม", tambon_id: "540604" });
  assert.deepEqual(tambonMap, {
    "540601": "บ้านหนุน",
    "540602": "บ้านกลาง",
    "540603": "ห้วยหม้าย",
    "540604": "เตาปูน",
    "540605": "หัวเมือง",
    "540606": "สะเอียบ",
    "540607": "แดนชุมพล",
    "540608": "ทุ่งน้าว",
  });
});

test("no meta.registry (GAS before the manifest) → the built-in pair kpi_master, kpi_epi gives the same 7 KPIs", () => {
  const snapshot = fixture();
  delete snapshot.BATCH_ALL.meta!.registry;

  const { data } = processPaSnapshot(snapshot);

  assert.deepEqual(data.map(row), PRODUCTION_ROWS);
  assert.deepEqual(
    data.map((k) => [k.category, k.categoryOrder]),
    [...Array(4).fill(["ตัวชี้วัดพื้นฐาน", 1]), ...Array(3).fill(["สร้างเสริมภูมิคุ้มกันโรค", 2])],
  );
});

test("a registry whose categoryOrder puts สร้างเสริมภูมิคุ้มกันโรค first → its 3 KPIs come first, each category in its own order", () => {
  const snapshot = fixture();
  snapshot.BATCH_ALL.meta!.registry = [
    { sheet: "kpi_master", category: "ตัวชี้วัดพื้นฐาน", categoryOrder: 2 },
    { sheet: "kpi_epi", category: "สร้างเสริมภูมิคุ้มกันโรค", categoryOrder: 1 },
  ];

  const { data } = processPaSnapshot(snapshot);

  assert.deepEqual(
    data.map((k) => k.title),
    [BCG, FULLY_1Y, DTP4, ANC12, CHILDDEV4, NCD_REPEAT, CAVITY_FREE],
  );
});

// No page has shown a quarter other than Q4 (every .pa-check snapshot is Q4):
// Q2's badge is written from PA's rule "สะสม N เดือน (Qn)", N = 3 × the quarter,
// to tell a period that follows current_quarter from one stuck at 12 months.
test("current_quarter 2 → the quarterly KPI shows สะสม 6 เดือน (Q2); target_months 9 and the annual KPIs stay", () => {
  const snapshot = fixture();
  snapshot.BATCH_ALL.meta!.current_quarter = 2;

  const { data } = processPaSnapshot(snapshot);

  assert.deepEqual(
    data.slice(0, 4).map((k) => [k.tableName, k.period, k.targetMonths]),
    [
      ["s_kpi_anc12", "รายปี", 12],
      ["s_kpi_childdev4", "สะสม 9 เดือน", 9],
      ["s_ncd_screen_repleate1", "สะสม 6 เดือน (Q2)", 6],
      ["s_dental_0_5_cavity_free", "รายปี", 12],
    ],
  );
});

test("date_com: the newest of every KPI's rows, 202611160602 of s_dental_0_5_cavity_free → the วันที่ข้อมูล of production's อัปเดตล่าสุด line", () => {
  assert.equal(processPaSnapshot(fixture()).lastUpdated, "16 พฤศจิกายน 2569 เวลา 06:02 น.");
});

test("date_com of 14 digits: s_epi1__bcg alone (20261115182132) → 18:21, the seconds dropped", () => {
  const snapshot = fixture();
  snapshot.BATCH_ALL.data = { s_epi1__bcg: snapshot.BATCH_ALL.data!.s_epi1__bcg };

  assert.equal(processPaSnapshot(snapshot).lastUpdated, "15 พฤศจิกายน 2569 เวลา 18:21 น.");
});

test("date_com of 12 and 14 digits together: 202611151822 of s_epi_complete__1y is newer than 20261115182132 of s_epi1__bcg", () => {
  const snapshot = fixture();
  const { s_epi1__bcg, s_epi_complete__1y } = snapshot.BATCH_ALL.data!;
  snapshot.BATCH_ALL.data = { s_epi1__bcg, s_epi_complete__1y };

  assert.equal(processPaSnapshot(snapshot).lastUpdated, "15 พฤศจิกายน 2569 เวลา 18:22 น.");
});

test("no row with a date_com → no วันที่ข้อมูล, and every KPI 0 of 0", () => {
  const snapshot = fixture();
  snapshot.BATCH_ALL.data = {};

  const { data, lastUpdated } = processPaSnapshot(snapshot);

  assert.equal(lastUpdated, "");
  assert.equal(data.length, 7);
  assert.ok(data.every((k) => k.totalTarget === 0 && k.data.length === 0));
});
