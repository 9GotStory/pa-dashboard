import assert from "node:assert/strict";
import test from "node:test";
import { compareSnapshots } from "../pa-check.mjs";

// pa-check.mjs compare, without a browser: two snapshots as load() reads them.
// A daily sync between them (docs/agents/gas-deploy.md step 4) gives every row
// a newer date_com and the page a newer อัปเดตล่าสุด line; on 16 Nov 2569 F79
// had to compare without date_com by hand to see PA unchanged.

const LINES = ["PA Dashboard", "อัปเดตล่าสุด: 15 พฤศจิกายน 2569 เวลา 06:05 น.", "ร้อยละ 90.5"];
const ROW = { areacode: "54060101", b_year: "2569", target: 20, result: 18, date_com: "202611142032" };

function snap(rows, lines = LINES, labels = ["รายละเอียด ANC 90.5"]) {
  const tab = { labels, text: lines.join("\n") };
  return {
    batch: { meta: { current_year: "2569" }, data: { s_kpi_anc12: rows } },
    page: { main: tab, epi: tab },
  };
}

const synced = (row) => ({ ...row, date_com: "202611151845" });
const SYNCED_LINES = LINES.map((l) => l.replace("15 พฤศจิกายน 2569 เวลา 06:05", "16 พฤศจิกายน 2569 เวลา 06:02"));

test("the same snapshot twice: unchanged", () => {
  assert.equal(compareSnapshots(snap([ROW]), snap([ROW])).changed, 0);
});

test("across a daily sync: rows the same apart from date_com, and the อัปเดตล่าสุด line, count as unchanged", () => {
  const { changed, lines } = compareSnapshots(snap([ROW]), snap([synced(ROW)], SYNCED_LINES));
  assert.equal(changed, 0);
  assert.ok(lines.some((l) => /s_kpi_anc12: .*apart from max date_com 202611142032 → 202611151845/.test(l)));
  assert.ok(lines.some((l) => /อัปเดตล่าสุด.*not judged/.test(l)));
});

test("rows narrowed to the district and the current year, with a newer date_com: unchanged", () => {
  const other = { ...ROW, areacode: "54010101" };
  const lastYear = { ...ROW, b_year: "2568" };
  assert.equal(compareSnapshots(snap([ROW, other, lastYear]), snap([synced(ROW)], SYNCED_LINES)).changed, 0);
});

test("a value that changed is a change, with or without a newer date_com", () => {
  assert.equal(compareSnapshots(snap([ROW]), snap([{ ...synced(ROW), result: 17 }], SYNCED_LINES)).changed, 1);
  assert.equal(compareSnapshots(snap([ROW]), snap([{ ...ROW, result: 17 }])).changed, 1);
});

test("the อัปเดตล่าสุด line changed while no date_com did: a change", () => {
  assert.equal(compareSnapshots(snap([ROW]), snap([ROW], SYNCED_LINES)).changed, 2);
});

test("a KPI cell that changed is a change, whatever the data says", () => {
  assert.equal(compareSnapshots(snap([ROW]), snap([synced(ROW)], SYNCED_LINES, ["รายละเอียด ANC 85.0"])).changed, 2);
});
