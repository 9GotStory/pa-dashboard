import assert from "node:assert/strict";
import test from "node:test";
import { closedYearOf, paYearLinks } from "./years";

// FEATURES F85: the files of PA ปีที่ปิดแล้ว (SCHEMA §7) and the year link row
// at the PA header (SPEC §4).

const batch = (current_year: string) => ({ BATCH_ALL: { meta: { current_year } } });

test("a closed-year file named after its current_year is that year", () => {
  assert.equal(closedYearOf("2568.json", batch("2568")), "2568");
});

test("a closed-year file named after another year fails with the file name", () => {
  assert.throws(() => closedYearOf("2567.json", batch("2568")), /2567\.json/);
});

test("a file in data/pa-years/ not named {ปี}.json fails with its name", () => {
  assert.throws(() => closedYearOf("2568.json.bak", batch("2568")), /2568\.json\.bak/);
});

test("the year row links the current year to /pa and each closed year to /pa/{ปี}, newest first", () => {
  assert.deepEqual(paYearLinks("2571", ["2569", "2570"]), [
    { year: "2571", href: "/pa" },
    { year: "2570", href: "/pa/2570" },
    { year: "2569", href: "/pa/2569" },
  ]);
});

test("no closed year: no year row", () => {
  assert.deepEqual(paYearLinks("2569", []), []);
});

test("the current year's own closed-year file, between the freeze and the switch, is not in the row", () => {
  assert.deepEqual(paYearLinks("2569", ["2569"]), []);
  assert.deepEqual(paYearLinks("2570", ["2569", "2570"]), [
    { year: "2570", href: "/pa" },
    { year: "2569", href: "/pa/2569" },
  ]);
});
