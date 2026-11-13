import assert from "node:assert/strict";
import test from "node:test";
import { POPULATION_REPORT_DATA } from "./fixtures/population-report-20261113";
import { formatPct } from "./format";
import { populationReport } from "./population-report";
import type { PopulationChange } from "./types";

// FEATURES F67: the data layer of รายงานประชากร (SCHEMA §11.5) on the
// population rows of 2564–2568 cut from the snapshot of 13 Nov 2569. Expected
// values are copied from SCHEMA §11.6, which reads them off the stat.bora
// files themselves, not worked out the way the code does.

/** A change as the page shows it: the count and its ร้อยละ to 2 decimals */
const shown = (change: PopulationChange) => [change.count, change.pct === null ? null : formatPct(change.pct)];

test("no ?year= → the latest ปีข้อมูล, 2568, of the 5 years 2564–2568", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "" });

  assert.deepEqual(report.years, ["2564", "2565", "2566", "2567", "2568"]);
  assert.deepEqual(report.query, { year: "2568" });
});

test("2568, the whole อำเภอ → 46,527 people (ชาย 22,475 หญิง 24,052) and 20,101 บ้าน", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2568" });

  assert.deepEqual(report.shown, { male: 22475, female: 24052, total: 46527, house: 20101 });
});

test("แนวโน้ม 2564–2568 of the whole อำเภอ → 48,645 · 48,175 · 47,636 · 47,053 · 46,527 people, with ชาย หญิง and บ้าน of each year", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2568" });

  assert.deepEqual(report.trend, [
    { year: "2564", totals: { male: 23578, female: 25067, total: 48645, house: 19360 } },
    { year: "2565", totals: { male: 23328, female: 24847, total: 48175, house: 19552 } },
    { year: "2566", totals: { male: 23067, female: 24569, total: 47636, house: 19763 } },
    { year: "2567", totals: { male: 22768, female: 24285, total: 47053, house: 19943 } },
    { year: "2568", totals: { male: 22475, female: 24052, total: 46527, house: 20101 } },
  ]);
});

test("2568 from the year before → −526 people (−1.12%), ชาย −293 (−1.29%), หญิง −233 (−0.96%), บ้าน +158 (+0.79%)", () => {
  const { change } = populationReport(POPULATION_REPORT_DATA, { year: "2568" });

  assert.ok(change);
  assert.deepEqual(shown(change.total), [-526, "-1.12"]);
  assert.deepEqual(shown(change.male), [-293, "-1.29"]);
  assert.deepEqual(shown(change.female), [-233, "-0.96"]);
  assert.deepEqual(shown(change.house), [158, "0.79"]);
});

test("2564, the first ปีข้อมูล → its totals and no change: there is no year before it", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2564" });

  assert.equal(report.shown?.total, 48645);
  assert.equal(report.change, null);
});

test("2566 left out of the data → 2567 has no change: the year before is 2566 only, never the older 2565", () => {
  const without2566 = { years: POPULATION_REPORT_DATA.years.filter((y) => y.yymm !== "6612") };

  const report = populationReport(without2566, { year: "2567" });

  assert.deepEqual(report.years, ["2564", "2565", "2567", "2568"]);
  assert.equal(report.shown?.total, 47053);
  assert.equal(report.change, null);
});

test("?year=2570, not in the data → kept as 2570, no totals and no change (the page says ไม่มีข้อมูลปี 2570 ในระบบ), the แนวโน้ม still of every year", () => {
  const report = populationReport(POPULATION_REPORT_DATA, { year: "2570" });

  assert.deepEqual(report.query, { year: "2570" });
  assert.equal(report.shown, null);
  assert.equal(report.change, null);
  assert.equal(report.trend.length, 5);
});

test("?year= that is not 4 digits (25680, abc) → the latest ปีข้อมูล", () => {
  for (const year of ["25680", "abc", "68"]) {
    assert.deepEqual(populationReport(POPULATION_REPORT_DATA, { year }).query, { year: "2568" }, year);
  }
});

test("no population data (years []) → no year, no totals and an empty แนวโน้ม, without failing", () => {
  const report = populationReport({ years: [] }, { year: "" });

  assert.deepEqual(report, { years: [], query: { year: "" }, shown: null, change: null, trend: [] });
});
