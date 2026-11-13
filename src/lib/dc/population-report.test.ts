import assert from "node:assert/strict";
import test from "node:test";
import { AREAS, POPULATION_REPORT_DATA } from "./fixtures/population-report-20261113";
import { formatPct } from "./format";
import { populationReport, sortUnits } from "./population-report";
import type { PopulationChange } from "./types";

// FEATURES F67 and F68: the data layer of รายงานประชากร (SCHEMA §11.5) on the
// population rows of 2564–2568 cut from the snapshot of 13 Nov 2569. Expected
// values are copied from SCHEMA §11.6, which reads them off the stat.bora
// files themselves, not worked out the way the code does.

/** A change as the page shows it: the count and its ร้อยละ to 2 decimals */
const shown = (change: PopulationChange) => [change.count, change.pct === null ? null : formatPct(change.pct)];

test("no ?year= → the latest ปีข้อมูล, 2568, of the 5 years 2564–2568", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "", area: "all" }, AREAS);

  assert.deepEqual(report.years, ["2564", "2565", "2566", "2567", "2568"]);
  assert.deepEqual(report.query, { year: "2568", area: "all" });
});

test("2568, the whole อำเภอ → 46,527 people (ชาย 22,475 หญิง 24,052) and 20,101 บ้าน", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "all" }, AREAS);

  assert.deepEqual(report.shown, { male: 22475, female: 24052, total: 46527, house: 20101 });
});

test("แนวโน้ม 2564–2568 of the whole อำเภอ → 48,645 · 48,175 · 47,636 · 47,053 · 46,527 people, with ชาย หญิง and บ้าน of each year", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "all" }, AREAS);

  assert.deepEqual(report.trend, [
    { year: "2564", totals: { male: 23578, female: 25067, total: 48645, house: 19360 } },
    { year: "2565", totals: { male: 23328, female: 24847, total: 48175, house: 19552 } },
    { year: "2566", totals: { male: 23067, female: 24569, total: 47636, house: 19763 } },
    { year: "2567", totals: { male: 22768, female: 24285, total: 47053, house: 19943 } },
    { year: "2568", totals: { male: 22475, female: 24052, total: 46527, house: 20101 } },
  ]);
});

test("2568 from the year before → −526 people (−1.12%), ชาย −293 (−1.29%), หญิง −233 (−0.96%), บ้าน +158 (+0.79%)", () => {
  const { change } = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "all" }, AREAS);

  assert.ok(change);
  assert.deepEqual(shown(change.total), [-526, "-1.12"]);
  assert.deepEqual(shown(change.male), [-293, "-1.29"]);
  assert.deepEqual(shown(change.female), [-233, "-0.96"]);
  assert.deepEqual(shown(change.house), [158, "0.79"]);
});

test("2564, the first ปีข้อมูล → its totals and no change: there is no year before it", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2564", area: "all" }, AREAS);

  assert.equal(report.shown?.total, 48645);
  assert.equal(report.change, null);
});

test("2566 left out of the data → 2567 has no change: the year before is 2566 only, never the older 2565", () => {
  const without2566 = { years: POPULATION_REPORT_DATA.years.filter((y) => y.yymm !== "6612") };

  const report = populationReport(without2566, { year: "2567", area: "all" }, AREAS);

  assert.deepEqual(report.years, ["2564", "2565", "2567", "2568"]);
  assert.equal(report.shown?.total, 47053);
  assert.equal(report.change, null);
});

test("?year=2570, not in the data → kept as 2570, no totals and no change (the page says ไม่มีข้อมูลปี 2570 ในระบบ), the แนวโน้ม still of every year", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2570", area: "all" }, AREAS);

  assert.deepEqual(report.query, { year: "2570", area: "all" });
  assert.equal(report.shown, null);
  assert.equal(report.change, null);
  assert.equal(report.trend.length, 5);
});

test("?year= that is not 4 digits (25680, abc) → the latest ปีข้อมูล", () => {
  for (const year of ["25680", "abc", "68"]) {
    assert.deepEqual(
      populationReport(POPULATION_REPORT_DATA, { year, area: "all" }, AREAS).query,
      { year: "2568", area: "all" },
      year,
    );
  }
});

test("no population data (years []) → no year, no totals and an empty แนวโน้ม, without failing", () => {
  const report = populationReport({ years: [] }, { year: "", area: "all" }, AREAS);

  assert.deepEqual(report.years, []);
  assert.deepEqual(report.query, { year: "", area: "all" });
  assert.equal(report.shown, null);
  assert.equal(report.change, null);
  assert.deepEqual(report.trend, []);
});

test("?area=540601, บ้านหนุน in 2568 → 7,399 people and 3,499 บ้าน across both สำนักทะเบียน, ร้อยละ 15.90 of the อำเภอ's 46,527", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "540601" }, AREAS);

  assert.deepEqual(report.query, { year: "2568", area: "540601" });
  assert.equal(report.level, "tambon");
  assert.equal(report.name, "บ้านหนุน");
  assert.deepEqual(report.parent, { key: "all", name: "อำเภอสอง" });
  assert.equal(report.shown?.total, 7399);
  assert.equal(report.shown?.house, 3499);
  assert.ok(report.share !== null);
  assert.equal(formatPct(report.share), "15.90");
});

test("the whole อำเภอ in 2568 → เปรียบเทียบ of its 8 ตำบล by code × 2564–2568, each across both สำนักทะเบียน, none partial", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "all" }, AREAS);

  assert.deepEqual(
    report.units.map((u) => [u.key, u.name, u.unspecified, u.totals]),
    [
      ["540601", "บ้านหนุน", false, [7877, 7765, 7624, 7495, 7399]],
      ["540602", "บ้านกลาง", false, [7182, 7069, 6945, 6809, 6686]],
      ["540603", "ห้วยหม้าย", false, [7823, 7749, 7648, 7532, 7467]],
      ["540604", "เตาปูน", false, [8135, 8126, 8104, 8052, 7992]],
      ["540605", "หัวเมือง", false, [6215, 6147, 6090, 6108, 6037]],
      ["540606", "สะเอียบ", false, [5501, 5466, 5441, 5397, 5335]],
      ["540607", "แดนชุมพล", false, [2538, 2501, 2471, 2431, 2411]],
      ["540608", "ทุ่งน้าว", false, [3374, 3352, 3313, 3229, 3200]],
    ],
  );
  assert.equal(report.partial, false);
});

test("บ้านหนุน in the เปรียบเทียบ of 2568 → changed 2564 → 2568 by −478 people (−6.07%); in 2564, its first year, no change", () => {
  const unit = (year: string) =>
    populationReport(POPULATION_REPORT_DATA, { year, area: "all" }, AREAS).units.find((u) => u.key === "540601");

  const change = unit("2568")?.change;
  assert.ok(change);
  assert.deepEqual(shown(change), [-478, "-6.07"]);
  assert.equal(unit("2564")?.change, null);
});

test("บ้านกลาง in 2568 → เปรียบเทียบ of its 12 หมู่บ้าน by หมู่ที่, then ไม่ระบุหมู่ last with 14 people", () => {
  const { units } = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "540602" }, AREAS);

  assert.deepEqual(
    units.map((u) => u.key),
    [...Array.from({ length: 12 }, (_, k) => `540602${String(k + 1).padStart(2, "0")}`), "54060200"],
  );
  assert.ok(units.slice(0, 12).every((u) => !u.unspecified));
  assert.deepEqual(units.at(-1), {
    key: "54060200",
    name: "ไม่ระบุหมู่",
    unspecified: true,
    totals: [16, 14, 15, 16, 14],
    change: { count: -2, pct: -12.5 },
  });
});

test("บ้านหนุน in 2568 → หมู่ 4 ศรีมูลเรือง, both สำนักทะเบียน added up: 1,092 · 1,069 · 1,064 · 1,034 · 1,031, −61 (−5.59%) from 2564", () => {
  const { units } = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "540601" }, AREAS);
  const moo4 = units.find((u) => u.key === "54060104");

  assert.equal(moo4?.name, "หมู่ 4 ศรีมูลเรือง");
  assert.deepEqual(moo4?.totals, [1092, 1069, 1064, 1034, 1031]);
  assert.ok(moo4?.change);
  assert.deepEqual(shown(moo4.change), [-61, "-5.59"]);
  assert.equal(units.length, 11);
});

/** The fixture with the rows of a หมู่บ้าน code cut out of some years */
const without = (code: string, yymms: string[]) => ({
  years: POPULATION_REPORT_DATA.years.map((y) =>
    yymms.includes(y.yymm) ? { ...y, village: y.village.filter((r) => r.mm !== code) } : y,
  ),
});

test('หมู่ 4 ศรีมูลเรือง cut out of 2564 and 2566 → null ("—") in those years, never 0, its change counted from 2565, and partial', () => {
  const report = populationReport(without("54060104", ["6412", "6612"]), { year: "2568", area: "540601" }, AREAS);
  const moo4 = report.units.find((u) => u.key === "54060104");

  assert.deepEqual(moo4?.totals, [null, 1069, null, 1034, 1031]);
  assert.ok(moo4?.change);
  assert.deepEqual(shown(moo4.change), [-38, "-3.55"]);
  assert.equal(report.partial, true);
});

test("หมู่ 4 ศรีมูลเรือง cut out of 2568 → named as in its latest year with rows, no change in 2568, and its first year 2565 gives no change", () => {
  const data = without("54060104", ["6412", "6812"]);
  const moo4 = (year: string) =>
    populationReport(data, { year, area: "540601" }, AREAS).units.find((u) => u.key === "54060104");

  assert.equal(moo4("2568")?.name, "หมู่ 4 ศรีมูลเรือง");
  assert.equal(moo4("2568")?.change, null);
  assert.equal(moo4("2565")?.change, null);
});

test("the 8 ตำบล of 2568 by จำนวน → most people first: เตาปูน 7,992 … แดนชุมพล 2,411", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "all" }, AREAS);

  assert.deepEqual(
    sortUnits(report, "count").map((u) => u.name),
    ["เตาปูน", "ห้วยหม้าย", "บ้านหนุน", "บ้านกลาง", "หัวเมือง", "สะเอียบ", "ทุ่งน้าว", "แดนชุมพล"],
  );
});

test("the 8 ตำบล of 2568 by การเปลี่ยนแปลง → largest ร้อยละ first: เตาปูน −1.76% … บ้านกลาง −6.91%", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "all" }, AREAS);

  assert.deepEqual(
    sortUnits(report, "change").map((u) => u.name),
    ["เตาปูน", "หัวเมือง", "สะเอียบ", "ห้วยหม้าย", "แดนชุมพล", "ทุ่งน้าว", "บ้านหนุน", "บ้านกลาง"],
  );
});

test("2564, the first year, by การเปลี่ยนแปลง → no unit has a change, so the order is by code, the same every time", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2564", area: "all" }, AREAS);

  assert.deepEqual(
    sortUnits(report, "change").map((u) => u.key),
    AREAS.map((a) => a.id),
  );
});

test("บ้านกลาง by code, จำนวน or การเปลี่ยนแปลง → ไม่ระบุหมู่ last every time", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "540602" }, AREAS);

  assert.deepEqual(report.units.at(-1)?.key, "54060200");
  for (const sort of ["code", "count", "change"] as const) {
    const units = sortUnits(report, sort);
    assert.equal(units.length, 13, sort);
    assert.equal(units.at(-1)?.name, "ไม่ระบุหมู่", sort);
  }
});

test("?area= not a ตำบล of areas (999999, abc, empty) → the whole อำเภอ, with its 8 ตำบล and no ร้อยละ of a larger area", () => {
  for (const area of ["999999", "abc", ""]) {
    const report = populationReport(POPULATION_REPORT_DATA, { year: "2568", area }, AREAS);

    assert.deepEqual(report.query, { year: "2568", area: "all" }, area);
    assert.equal(report.level, "district", area);
    assert.equal(report.shown?.total, 46527, area);
    assert.equal(report.share, null, area);
    assert.equal(report.parent, null, area);
    assert.equal(report.units.length, 8, area);
  }
});

test("บ้านหนุน's แนวโน้ม → 7,877 · 7,765 · 7,624 · 7,495 · 7,399 people, and 3,378 บ้าน in 2564", () => {
  const { trend } = populationReport(POPULATION_REPORT_DATA, { year: "2568", area: "540601" }, AREAS);

  assert.deepEqual(
    trend.map((p) => p.totals?.total),
    [7877, 7765, 7624, 7495, 7399],
  );
  assert.equal(trend[0].totals?.house, 3378);
});
