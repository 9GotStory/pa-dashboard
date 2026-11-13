import assert from "node:assert/strict";
import test from "node:test";
import { MAINS, VACCINES } from "../fixtures/catalog-20261104";
import type { DcCatalog, DcReport } from "../types";
import { awaitingWarnings, shownCatalog } from "./index";

// FEATURES F62: a รายงานที่รอวิเคราะห์ (its source_table has no page in
// TABLE_PAGES) is not on the site (SPEC §5.2). The 21 reports of the real
// catalog all have a page; the awaiting ones are made up, on a table HDC has
// that no page shows.

/** A report of the table s_epi_dtp5, which has no page */
const AWAITING: DcReport = {
  ...MAINS[0].topics[1].groups[0].reports[0],
  opendata_id: "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f",
  report_name: "ความครอบคลุมวัคซีน DTP5 ในเด็กอายุ 5 ปี",
  source_table: "s_epi_dtp5",
};

/** catalog.json with these หมวด */
function catalog(mains: DcCatalog["mains"]): DcCatalog {
  return {
    meta: { current_year: "2569", years: ["2569"], district_code: "5406", generated_at: "" },
    areas: [],
    hospitals: [],
    mains,
  };
}

test("shownCatalog leaves out a รายงานที่รอวิเคราะห์ and keeps the 21 reports with a page in order", () => {
  // The awaiting report in กลุ่มอายุ 1 ปี of the vaccine หัวข้อ, between the real ones
  const mains = MAINS.map((main) => ({
    ...main,
    topics: main.topics.map((topic) =>
      topic.cat_id !== VACCINES.cat_id
        ? topic
        : { ...topic, groups: topic.groups.map((g, i) => (i === 0 ? { ...g, reports: [g.reports[0], AWAITING, ...g.reports.slice(1)] } : g)) },
    ),
  }));
  assert.equal(mains[0].topics[1].groups[0].reports.length, 3);

  assert.deepEqual(shownCatalog(catalog(mains)).mains, MAINS);
});

test("shownCatalog leaves out a กลุ่ม, หัวข้อ or หมวด that has only รายงานที่รอวิเคราะห์", () => {
  const topic = { ...VACCINES, cat_id: "1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a", category_name: "หัวข้อที่รอวิเคราะห์", groups: [{ subgroup: "", reports: [AWAITING] }] };
  const mains: DcCatalog["mains"] = [
    {
      ...MAINS[0],
      topics: [
        ...MAINS[0].topics.map((t) => (t.cat_id === VACCINES.cat_id ? { ...t, groups: [...t.groups, { subgroup: "กลุ่มอายุ 7 ปี", reports: [AWAITING] }] } : t)),
        topic,
      ],
    },
    ...MAINS.slice(1),
    { main_report_id: "2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b", main_report_name: "หมวดที่รอวิเคราะห์", topics: [topic] },
  ];

  assert.deepEqual(shownCatalog(catalog(mains)).mains, MAINS);
});

test("awaitingWarnings names each รายงานที่รอวิเคราะห์ and its source table, and none for the real catalog", () => {
  const second: DcReport = { ...AWAITING, opendata_id: "3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c", report_name: "ผู้สูงอายุได้รับการคัดกรองภาวะสมองเสื่อม", source_table: "s_aged_dementia" };
  const mains = [{ ...MAINS[0], topics: [{ ...VACCINES, groups: [{ subgroup: "", reports: [AWAITING, ...MAINS[0].topics[1].groups[0].reports, second] }] }] }];

  assert.deepEqual(awaitingWarnings(catalog(mains)), [
    "รายงานที่รอวิเคราะห์ not on the site: ความครอบคลุมวัคซีน DTP5 ในเด็กอายุ 5 ปี (0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f), source table s_epi_dtp5 has no page (SPEC §5.2)",
    "รายงานที่รอวิเคราะห์ not on the site: ผู้สูงอายุได้รับการคัดกรองภาวะสมองเสื่อม (3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c), source table s_aged_dementia has no page (SPEC §5.2)",
  ]);
  assert.deepEqual(awaitingWarnings(catalog(MAINS)), []);
});
