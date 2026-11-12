import assert from "node:assert/strict";
import test from "node:test";
import { MAINS, MCH, PROMOTION, SERVICE_PLAN, VACCINES } from "./fixtures/catalog-20261104";
import { HEADERS } from "./fixtures/headers-20261104";
import { S_AGED9, S_EPI1, S_EPI2 as S_EPI2_CUT, S_KPI_FOOD } from "./fixtures/reports-20261111";
import type { Cell, DcReport, DcReportData, DcYearBlock, Family, LibraryList, ReportQuery, TrendPoint } from "./types";
import {
  dataYears,
  families,
  goalFor,
  libraryByReference,
  libraryList,
  libraryNameParts,
  libraryQuery,
  librarySearch,
  measureLabel,
  measures,
  passes,
  periods,
  reportQuery,
  reportSearch,
  shownMeasures,
  totals,
  totalsBy,
  trend,
  yearBlock,
} from "./values";

// FEATURES F15: the coverage rules of SCHEMA §4 on year blocks, with the real
// headers of the 18 tables (CODING_STANDARDS §5).

// A block ปี with these headers; each row is given by column name, "" where
// left out (GAS writes falsy cells as "", SCHEMA §2.5).
function block(headers: string[], rows: Record<string, Cell>[] = [], b_year = "2569"): DcYearBlock {
  return {
    b_year,
    headers,
    rows: rows.map((row) => headers.map((h) => row[h] ?? "")),
    max_date_com: "",
    sheet_rows: rows.length,
    expected_rows: rows.length,
  };
}

const MONTHS = ["10", "11", "12", "01", "02", "03", "04", "05", "06", "07", "08", "09"];

// Reports as catalog.json has them (4 Nov 2569). Only col_target/col_result
// of a report decide its columns, so DM_SCREEN stands for every report
// without them; DENTAL has b and a.
const DM_SCREEN: DcReport = {
  opendata_id: "626c89f6b8d9f7ed90c72c719775eb07",
  report_name: "ร้อยละของประชากรอายุ 35 ปีขึ้นไปที่ได้รับการคัดกรองเพื่อวินิจฉัยเบาหวาน",
  source_table: "s_dm_screen",
  cat_id: "b2b59e64c4e6c92d4b1ec16a599d882b",
  main_report_id: "02e752187c7282ebc9315123aa1cabbe",
  subgroup: "",
  order: 10,
  report_type: "coverage",
  goal: 90,
  col_target: null,
  col_result: null,
  measure_goals: {},
  catalog_status: "active",
  years: [],
};
const DENTAL: DcReport = {
  opendata_id: "abt2t2k4z4xeqzytwbave",
  report_name: "ร้อยละของเด็กอายุ0-5 ปี ฟันดีไม่มีผุ (Cavity Free) (คน)",
  source_table: "s_dental_0_5_cavity_free",
  cat_id: "db30e434e30565c12fbac44958e338d5",
  main_report_id: "02e752187c7282ebc9315123aa1cabbe",
  subgroup: "",
  order: 10,
  report_type: "coverage",
  goal: 80,
  col_target: "b",
  col_result: "a",
  measure_goals: {},
  catalog_status: "active",
  years: [],
};
const S_EPI2: DcReport = {
  opendata_id: "71e49e4b61aafee17761601c506d5f85",
  report_name: "ความครอบคลุมของเด็กอายุครบ 2 ปีที่ได้รับวัคซีนแต่ละชนิด รายไตรมาส",
  source_table: "s_epi2",
  cat_id: "4df360514655f79f13901ef1181ca1c7",
  main_report_id: "73daf277928bc32a1b3c8e772192543c",
  subgroup: "กลุ่มอายุ 2 ปี",
  order: 20,
  report_type: "coverage",
  goal: 90,
  col_target: null,
  col_result: null,
  measure_goals: { dtp4: 90, opv4: 90, mmr1: 95, mmr2: 95, je2: 90 },
  catalog_status: "active",
  years: [],
};

// SCHEMA §4.1 by table: s_dental_0_5_cavity_free is OVERRIDE through its
// hdc_reports row (b, a), every other table has no col_target/col_result.
const FAMILIES: [string, Family[]][] = [
  ["s_kpi_anc12", ["ANNUAL", "Q_A"]],
  ["s_anc5", ["ANNUAL", "Q_A"]],
  ["s_kpi_food", ["ANNUAL", "Q_A"]],
  ["s_aged9", ["ANNUAL"]],
  ["s_dm_screen", ["ANNUAL"]],
  ["s_ht_screen", ["ANNUAL"]],
  ["s_ncd_screen_repleate1", ["ANNUAL", "Q_B"]],
  ["s_ht_screen_follow", ["ANNUAL", "Q_C"]],
  ["s_kpi_dental28", ["ANNUAL"]],
  ["s_kpi_dental33", ["ANNUAL"]],
  ["s_epi_complete", ["ANNUAL", "M_A"]],
  ["s_kpi_childdev4", ["Q_A"]],
  ["s_kpi_childdev2", ["Q_A"]],
  ["s_epi1", ["M_B"]],
  ["s_epi2", ["M_B"]],
  ["s_epi3", ["M_B"]],
  ["s_epi5", ["M_B"]],
  ["s_dental_0_5_cavity_free", ["OVERRIDE"]],
];

for (const [table, expected] of FAMILIES) {
  test(`real header of ${table} → กลุ่มคอลัมน์ ${expected.join(" + ")} and no other`, () => {
    const report = table === "s_dental_0_5_cavity_free" ? DENTAL : DM_SCREEN;
    assert.deepEqual(families(block(HEADERS[table]), report), expected);
  });
}

// The vaccines PA has for each table (the kpi_epi split rows in รหัส.js),
// sorted by name.
const PA_S_EPI1 = [
  "bcg", "dtp1", "dtp2", "dtp_hb3", "hbv", "hbv2", "hbv3", "hbv4", "hib1", "hib2",
  "hib3", "ipv", "ipv1", "mmr", "opv3", "pcv1", "pcv2", "pcv3", "rota", "rota1",
];

test("real header of s_epi1 → 20 measures, the vaccines PA has for s_epi1, BCG first as in the columns", () => {
  const found = measures(block(HEADERS.s_epi1));
  assert.deepEqual([...found].sort(), PA_S_EPI1);
  assert.equal(found[0], "bcg");
});

test("real header of s_epi2 → its 6 measures in column order (dtp4, opv4, je2 interleaved by month, then mmr1, mmr2, pcv4)", () => {
  assert.deepEqual(measures(block(HEADERS.s_epi2)), ["dtp4", "opv4", "je2", "mmr1", "mmr2", "pcv4"]);
});

test("a header without M_B (s_epi_complete has target{MM} and result{MM}) → no measures", () => {
  assert.deepEqual(measures(block(HEADERS.s_epi_complete)), []);
});

test("measure dtp_hb3 → shown as DTP-HB3, as PA titles it", () => {
  assert.equal(measureLabel("dtp_hb3"), "DTP-HB3");
});

const WHOLE_YEAR = { area: "all", period: "year", measure: null } as const;

test("3 rows with target 10/20/0 and result 5/10/0 → T 30, R 15, ร้อยละ 50 (summed first, not an average of row percentages)", () => {
  const b = block(HEADERS.s_dm_screen, [
    { hospcode: "06413", areacode: "54060101", target: 10, result: 5 },
    { hospcode: "06413", areacode: "54060102", target: 20, result: 10 },
    { hospcode: "06414", areacode: "54060801", target: 0, result: 0 },
  ]);
  assert.deepEqual(totals(b, DM_SCREEN, WHOLE_YEAR), { target: 30, result: 15, pct: 50 });
});

test("rows whose target is 0 or empty everywhere → ร้อยละ null, not 0", () => {
  const b = block(HEADERS.s_dm_screen, [
    { hospcode: "06413", areacode: "54060101", target: 0, result: 0 },
    { hospcode: "06414", areacode: "54060801", target: "", result: 2 },
  ]);
  assert.deepEqual(totals(b, DM_SCREEN, WHOLE_YEAR), { target: 0, result: 2, pct: null });
});

test("col_target b, col_result a on a header that also has target/result → ทั้งปี from b and a (OVERRIDE wins over ANNUAL)", () => {
  const b = block(["hospcode", "areacode", "target", "result", "c", "b", "a"], [
    { hospcode: "06413", areacode: "54060101", target: 100, result: 1, c: 3, b: 10, a: 8 },
    { hospcode: "06414", areacode: "54060801", target: 100, result: 1, c: 4, b: 10, a: 7 },
  ]);
  assert.deepEqual(totals(b, DENTAL, WHOLE_YEAR), { target: 20, result: 15, pct: 75 });
});

test("measure bcg on s_epi1 with target/result added → ทั้งปี from Σ target{MM} and Σ bcg_{MM} (M_B wins over ANNUAL)", () => {
  const headers = [...HEADERS.s_epi1.slice(0, 6), "target", "result", ...HEADERS.s_epi1.slice(6)];
  const b = block(headers, [
    { hospcode: "06413", areacode: "54060101", target: 100, result: 1, target10: 2, bcg_10: 2, dtp1_10: 2 },
    { hospcode: "06413", areacode: "54060102", target: 100, result: 1, target01: 2, bcg_01: 1, dtp1_01: 2 },
  ]);
  assert.deepEqual(totals(b, DM_SCREEN, { area: "all", period: "year", measure: "bcg" }), { target: 4, result: 3, pct: 75 });
});

test("s_kpi_childdev4 (quarters only) → ทั้งปี is the sum of all 4 quarters, not PA's 3 (SCHEMA §4.3)", () => {
  const b = block(HEADERS.s_kpi_childdev4, [
    { hospcode: "06413", areacode: "54060101", target1: 5, result1: 4, target2: 5, result2: 4, target3: 5, result3: 4, target4: 5, result4: 3 },
  ]);
  assert.deepEqual(totals(b, DM_SCREEN, WHOLE_YEAR), { target: 20, result: 15, pct: 75 });
});

test("s_epi_complete without target/result → ทั้งปี is the sum of the 12 months of M_A", () => {
  const b = block(HEADERS.s_epi_complete.filter((h) => h !== "target" && h !== "result"), [
    { hospcode: "06413", areacode: "54060101", target10: 4, result10: 3, target09: 4, result09: 3 },
  ]);
  assert.deepEqual(totals(b, DM_SCREEN, WHOLE_YEAR), { target: 8, result: 6, pct: 75 });
});

test("s_dental_0_5_cavity_free without col_target/col_result → no rule applies: null, not zeros", () => {
  const b = block(HEADERS.s_dental_0_5_cavity_free, [{ hospcode: "06413", areacode: "54060101", c: 1, b: 10, a: 8 }]);
  assert.equal(totals(b, { ...DENTAL, col_target: null, col_result: null }, WHOLE_YEAR), null);
});

// One row per case: the period's own columns hold 4 and 3; the other
// columns hold other values, so a wrong column shows in the sums.
const PERIOD_CASES: [string, string, Pick<ReportQuery, "period" | "measure">, Record<string, Cell>][] = [
  ["s_kpi_anc12", "Q_A target2/result2", { period: "q2", measure: null },
    { target: 90, result: 1, target1: 50, result1: 1, target2: 4, result2: 3, target3: 50, result3: 1 }],
  ["s_ncd_screen_repleate1", "Q_B targetq3/resultq3", { period: "q3", measure: null },
    { target: 90, result: 1, targetq2: 50, resultq2: 1, targetq3: 4, resultq3: 3, targetq4: 50, resultq4: 1 }],
  ["s_ht_screen_follow", "Q_C t_q4/r_q4", { period: "q4", measure: null },
    { target: 90, result: 1, t_q3: 50, r_q3: 1, t_q4: 4, r_q4: 3, r1_q4: 2, r2_q4: 1 }],
  ["s_epi_complete", "M_A target01/result01", { period: "m01", measure: null },
    { target: 90, result: 1, target12: 50, result12: 1, target01: 4, result01: 3, target02: 50, result02: 1 }],
  ["s_epi2", "M_B target11/mmr1_11", { period: "m11", measure: "mmr1" },
    { target10: 50, mmr1_10: 1, target11: 4, mmr1_11: 3, mmr2_11: 1, dtp4_11: 2 }],
];

for (const [table, used, query, cells] of PERIOD_CASES) {
  test(`${query.period}${query.measure ? ` of ${query.measure}` : ""} on ${table} → ${used} only`, () => {
    const b = block(HEADERS[table], [{ hospcode: "06413", areacode: "54060101", ...cells }]);
    assert.deepEqual(totals(b, DM_SCREEN, { area: "all", ...query }), { target: 4, result: 3, pct: 75 });
  });
}

test("q1 on s_dm_screen and s_aged9 → null: without target1–4, result1–4 (quarterly results) and result1–9 (the 9 dimensions) form no quarter family (SCHEMA §4.2)", () => {
  for (const table of ["s_dm_screen", "s_aged9"]) {
    const b = block(HEADERS[table], [{ hospcode: "06413", areacode: "54060101", target: 4, result: 3, result1: 2 }]);
    assert.equal(totals(b, DM_SCREEN, { area: "all", period: "q1", measure: null }), null, table);
  }
});

const MONTH_PERIODS = MONTHS.map((m) => `m${m}`);

test("periods: s_kpi_anc12 → ทั้งปี and quarters 1–4; s_epi_complete and s_epi1 → ทั้งปี and the months ต.ค.–ก.ย. (each with a ผลงาน in one quarter or month)", () => {
  const withResult = (table: string, cells: Record<string, Cell>) => block(HEADERS[table], [{ hospcode: "06413", areacode: "54060101", ...cells }]);
  assert.deepEqual(periods(withResult("s_kpi_anc12", { result2: 1 }), DM_SCREEN), ["year", "q1", "q2", "q3", "q4"]);
  assert.deepEqual(periods(withResult("s_epi_complete", { result01: 1 }), DM_SCREEN), ["year", ...MONTH_PERIODS]);
  assert.deepEqual(periods(withResult("s_epi1", { mmr_01: 1 }), DM_SCREEN), ["year", ...MONTH_PERIODS]);
});

test("periods: s_dental_0_5_cavity_free with b/a, s_dm_screen and s_aged9 → ทั้งปี only", () => {
  assert.deepEqual(periods(block(HEADERS.s_dental_0_5_cavity_free), DENTAL), ["year"]);
  assert.deepEqual(periods(block(HEADERS.s_dm_screen), DM_SCREEN), ["year"]);
  assert.deepEqual(periods(block(HEADERS.s_aged9), DM_SCREEN), ["year"]);
});

test("periods: a header no rule knows (s_dental_0_5_cavity_free without col_target/col_result) → none", () => {
  assert.deepEqual(periods(block(HEADERS.s_dental_0_5_cavity_free), { ...DENTAL, col_target: null, col_result: null }), []);
});

test("area 540601 → only the rows whose areacode starts with 540601 (a tambon is the first 6 digits, SPEC §10)", () => {
  const b = block(HEADERS.s_dm_screen, [
    { hospcode: "06413", areacode: "54060101", target: 2, result: 1 },
    { hospcode: "11170", areacode: "54060107", target: 2, result: 2 },
    { hospcode: "06414", areacode: "54060801", target: 50, result: 1 },
    { hospcode: "06415", areacode: "54060201", target: 50, result: 1 },
  ]);
  assert.deepEqual(totals(b, DM_SCREEN, { area: "540601", period: "year", measure: null }), { target: 4, result: 3, pct: 75 });
});

// Names from catalog.json (tambon_master and hospitals of PA-Data), part of them
const NAMES = {
  areas: [
    { id: "540601", name_th: "บ้านหนุน" },
    { id: "540602", name_th: "บ้านกลาง" },
    { id: "540608", name_th: "ทุ่งน้าว" },
  ],
  hospitals: [
    { hospcode: "06413", hospname: "บ้านหนุน", tambon_id: "540601" },
    { hospcode: "06414", hospname: "ทุ่งน้าว", tambon_id: "540608" },
    { hospcode: "11170", hospname: "สอง", tambon_id: "540601" },
  ],
};

test("by area → one row per tambon named from areas, in code order; a code not in areas → รหัสพื้นที่ {code}", () => {
  const b = block(HEADERS.s_dm_screen, [
    { hospcode: "06414", areacode: "54060801", target: 4, result: 1 },
    { hospcode: "06413", areacode: "54060101", target: 2, result: 1 },
    { hospcode: "11170", areacode: "54060107", target: 2, result: 2 },
    { hospcode: "06420", areacode: "54060403", target: 0, result: 0 },
  ]);
  assert.deepEqual(totalsBy(b, DM_SCREEN, { area: "all", period: "year", measure: null, by: "area" }, NAMES), [
    { key: "540601", name: "บ้านหนุน", totals: { target: 4, result: 3, pct: 75 } },
    { key: "540604", name: "รหัสพื้นที่ 540604", totals: { target: 0, result: 0, pct: null } },
    { key: "540608", name: "ทุ่งน้าว", totals: { target: 4, result: 1, pct: 25 } },
  ]);
});

test("area 540601 by hosp → the rows of that tambon by hospcode, whatever the hospital's own tambon_id; a hospcode not in hospitals → หน่วยบริการ {hospcode}", () => {
  const b = block(HEADERS.s_dm_screen, [
    { hospcode: "11170", areacode: "54060107", target: 2, result: 2 },
    { hospcode: "06413", areacode: "54060101", target: 2, result: 1 },
    { hospcode: "06413", areacode: "54060102", target: 2, result: 2 },
    { hospcode: "06414", areacode: "54060105", target: 4, result: 1 },
    { hospcode: "06414", areacode: "54060801", target: 50, result: 1 },
    { hospcode: "77777", areacode: "54060103", target: 4, result: 3 },
  ]);
  assert.deepEqual(totalsBy(b, DM_SCREEN, { area: "540601", period: "year", measure: null, by: "hosp" }, NAMES), [
    { key: "06413", name: "บ้านหนุน", totals: { target: 4, result: 3, pct: 75 } },
    { key: "06414", name: "ทุ่งน้าว", totals: { target: 4, result: 1, pct: 25 } },
    { key: "11170", name: "สอง", totals: { target: 2, result: 2, pct: 100 } },
    { key: "77777", name: "หน่วยบริการ 77777", totals: { target: 4, result: 3, pct: 75 } },
  ]);
});

test("by area on a header no rule knows → null, as totals", () => {
  const b = block(HEADERS.s_dental_0_5_cavity_free, [{ hospcode: "06413", areacode: "54060101", b: 10, a: 8 }]);
  const report = { ...DENTAL, col_target: null, col_result: null };
  assert.equal(totalsBy(b, report, { area: "all", period: "year", measure: null, by: "area" }, NAMES), null);
});

// s_epi2's columns in a year with mmr1 only, placed before target{MM}
const MMR1_ONLY = ["hospcode", "areacode", "date_com", "b_year", ...MONTHS.map((m) => `mmr1_${m}`), ...MONTHS.map((m) => `target${m}`)];

test("2 block ปี whose headers differ (2568: mmr1 before target{MM}, no pcv4) → each year from its own header; pcv4 in 2568 → null, not 0", () => {
  const data = {
    report: S_EPI2,
    years: [
      block(MMR1_ONLY, [
        { hospcode: "06413", areacode: "54060101", target10: 4, mmr1_10: 2 },
        { hospcode: "06414", areacode: "54060801", target11: 4, mmr1_11: 4 },
      ], "2568"),
      block(HEADERS.s_epi2, [
        { hospcode: "06413", areacode: "54060101", target10: 2, mmr1_10: 1, pcv4_10: 2 },
        { hospcode: "06414", areacode: "54060801", target12: 2, mmr1_12: 0, pcv4_12: 1 },
      ], "2569"),
    ],
  };
  assert.deepEqual(trend(data, { area: "all", period: "year", measure: "mmr1" }), [
    { b_year: "2568", totals: { target: 8, result: 6, pct: 75 } },
    { b_year: "2569", totals: { target: 4, result: 1, pct: 25 } },
  ]);
  assert.deepEqual(trend(data, { area: "all", period: "year", measure: "pcv4" }), [
    { b_year: "2568", totals: null },
    { b_year: "2569", totals: { target: 4, result: 3, pct: 75 } },
  ]);
});

test("เกณฑ์ of s_epi2: mmr1 → 95 from measure_goals (kpi_epi); pcv4, not in kpi_epi → none, not the report's goal 90; no measure → the report's goal 90 (SCHEMA §4.4)", () => {
  assert.equal(goalFor(S_EPI2, "mmr1"), 95);
  assert.equal(goalFor(S_EPI2, "pcv4"), null);
  assert.equal(goalFor(S_EPI2, null), 90);
});

test("เกณฑ์ of s_epi1 in the snapshot: pcv1 → none (PCV is not in kpi_epi), mmr → 95", () => {
  assert.equal(goalFor(EPI1.report, "pcv1"), null);
  assert.equal(goalFor(EPI1.report, "mmr"), 95);
});

test("เกณฑ์ of a measure named like an Object property (constructor, from ?measure=) → none, not a function", () => {
  assert.equal(goalFor(S_EPI2, "constructor"), null);
});

test("ร้อยละ 89.999 with เกณฑ์ 90 → not passed: compared before rounding, as PA does", () => {
  assert.equal(passes(89.999, 90), false);
});

test("ร้อยละ equal to the เกณฑ์ → passed (pct ≥ goal)", () => {
  assert.equal(passes(90, 90), true);
});

test("no ร้อยละ (target 0) or no เกณฑ์ → no verdict: null", () => {
  assert.equal(passes(null, 90), null);
  assert.equal(passes(95, null), null);
});

// FEATURES F20: ?year=&area=&period=&measure=&by= of /reports/{id} as a
// ReportQuery for the report's data (SPEC §9.4, SCHEMA §9). s_epi2 here has
// 2568 with mmr1 only and 2569 with the real header, where dtp4 and mmr1
// have a ผลงาน.
const EPI2_DATA = {
  report: S_EPI2,
  years: [
    block(MMR1_ONLY, [{ hospcode: "06413", areacode: "54060101", target10: 4, mmr1_10: 2 }], "2568"),
    block(HEADERS.s_epi2, [{ hospcode: "06413", areacode: "54060101", target10: 2, dtp4_10: 2, mmr1_10: 1 }], "2569"),
  ],
};
const query = (search: string) => reportQuery(EPI2_DATA, new URLSearchParams(search), NAMES);

test("no query on s_epi2 → the latest ปีงบประมาณ, ทั้งอำเภอ, ทั้งปี, that year's first measure dtp4, by area (the defaults of SCHEMA §9)", () => {
  assert.deepEqual(query(""), { year: "2569", area: "all", period: "year", measure: "dtp4", by: "area" });
});

test("?year=2568 → 2568, and its measure default comes from 2568's own columns: mmr1, not dtp4 of 2569", () => {
  assert.deepEqual(query("year=2568"), { year: "2568", area: "all", period: "year", measure: "mmr1", by: "area" });
});

test("?year=2560, a year without data → kept as 2560 with no measure, so the page says ไม่มีข้อมูลปี 2560 ในระบบ instead of another year", () => {
  assert.deepEqual(query("year=2560"), { year: "2560", area: "all", period: "year", measure: null, by: "area" });
});

test("a block ปี without rows (the id filter left none, SCHEMA §3.2) → not a year with data: not offered, not the default, and no block for it", () => {
  const data = {
    report: S_EPI2,
    years: [block(MMR1_ONLY, [{ hospcode: "06413", areacode: "54060101", target10: 4, mmr1_10: 2 }], "2567"), block(MMR1_ONLY, [], "2568")],
  };
  assert.deepEqual(dataYears(data), ["2567"]);
  assert.equal(reportQuery(data, new URLSearchParams(""), NAMES).year, "2567");
  assert.equal(yearBlock(data, "2568"), null);
});

test("years with data → latest first, as the ปีงบประมาณ options list them", () => {
  assert.deepEqual(dataYears(EPI2_DATA), ["2569", "2568"]);
});

test("?measure=mmr1 → mmr1; pcv4 in 2568, whose columns lack it, or MMR1 in another letter case → that year's first measure", () => {
  assert.equal(query("measure=mmr1").measure, "mmr1");
  assert.equal(query("year=2568&measure=pcv4").measure, "mmr1");
  assert.equal(query("measure=MMR1").measure, "dtp4");
});

test("?measure= on a report without measures (s_epi_complete) → null", () => {
  const data = { report: DM_SCREEN, years: [block(HEADERS.s_epi_complete, [{ hospcode: "06413", areacode: "54060101", target: 1, result: 1 }])] };
  assert.equal(reportQuery(data, new URLSearchParams("measure=bcg"), NAMES).measure, null);
});

test("?period= → kept when the year's columns have it (q2 on s_kpi_anc12, m01 on s_epi_complete), else ทั้งปี (q2 on s_epi_complete, m13)", () => {
  const row = { hospcode: "06413", areacode: "54060101", target: 1, result: 1, result2: 1, result01: 1 };
  const anc12 = { report: DM_SCREEN, years: [block(HEADERS.s_kpi_anc12, [row])] };
  const complete = { report: DM_SCREEN, years: [block(HEADERS.s_epi_complete, [row])] };
  const period = (data: typeof anc12, search: string) => reportQuery(data, new URLSearchParams(search), NAMES).period;
  assert.equal(period(anc12, "period=q2"), "q2");
  assert.equal(period(complete, "period=m01"), "m01");
  assert.equal(period(complete, "period=q2"), "year");
  assert.equal(period(complete, "period=m13"), "year");
});

test("?area=540601 → that ตำบล, compared by หน่วยบริการ even with by=area (SPEC §9.4); a code not in areas → ทั้งอำเภอ", () => {
  assert.deepEqual(query("area=540601&by=area"), { year: "2569", area: "540601", period: "year", measure: "dtp4", by: "hosp" });
  assert.equal(query("area=540699").area, "all");
});

test("?by=hosp → by หน่วยบริการ for ทั้งอำเภอ; any other by → by area", () => {
  assert.equal(query("by=hosp").by, "hosp");
  assert.equal(query("by=tambon").by, "area");
});

test("a ReportQuery → ?year=&area=&period=&measure=&by= in the order of SPEC §9.4, which reportQuery reads back as the same query", () => {
  const q = { year: "2568", area: "540601", period: "m11", measure: "mmr1", by: "hosp" } as const;
  assert.equal(reportSearch(q), "?year=2568&area=540601&period=m11&measure=mmr1&by=hosp");
  assert.deepEqual(reportQuery(EPI2_DATA, new URLSearchParams(reportSearch(q)), NAMES), q);
});

test("a ReportQuery without a measure → no measure in the URL", () => {
  assert.equal(reportSearch({ year: "2569", area: "all", period: "year", measure: null, by: "area" }), "?year=2569&area=all&period=year&by=area");
});

// FEATURES F50: a รายการ or ตัวชี้วัด whose ผลงาน the whole district lacks for
// a year has no data that year (SPEC §9.4 "ว่างทั้งปี"), on blocks cut from
// the snapshot of 11 Nov 2569. The expected values are SCHEMA §4.6's.
const snapshot = (cut: typeof S_EPI1): DcReportData => ({
  report: cut.report,
  years: Object.entries(cut.years).map(([year, rows]) => block(cut.headers, rows, year)),
});
const EPI1 = snapshot(S_EPI1);
const at = (data: DcReportData, year: string) => yearBlock(data, year)!;

test("s_epi1 2568 dtp2, whose ผลงาน the whole district lacks → no data (null), not 0 of 217; 2569 mmr → 181/174", () => {
  assert.equal(totals(at(EPI1, "2568"), EPI1.report, { area: "all", period: "year", measure: "dtp2" }), null);
  const mmr = totals(at(EPI1, "2569"), EPI1.report, { area: "all", period: "year", measure: "mmr" });
  assert.deepEqual(mmr && [mmr.target, mmr.result], [181, 174]);
});

const EPI2 = snapshot(S_EPI2_CUT);
/** The years of a trend that have a point: a ร้อยละ to plot */
const plotted = (points: TrendPoint[]) => points.filter((p) => p.totals?.pct != null).map((p) => p.b_year);

test("trend of s_epi1 dtp2 → a point in 2569 only; of s_epi2 mmr2 → 2568 and 2569 only (no data 2565–2567)", () => {
  assert.deepEqual(plotted(trend(EPI1, { area: "all", period: "year", measure: "dtp2" })), ["2569"]);
  const mmr2 = trend(EPI2, { area: "all", period: "year", measure: "mmr2" });
  assert.deepEqual(mmr2.map((p) => p.totals === null), [true, true, true, false, false]);
  assert.deepEqual(plotted(mmr2), ["2568", "2569"]);
});

test("s_aged9 2565, a เป้าหมาย but no ผลงาน in the whole district → no data (null), not 0%", () => {
  const aged9 = snapshot(S_AGED9);
  assert.equal(totals(at(aged9, "2565"), aged9.report, WHOLE_YEAR), null);
});

test("s_epi1 2569 pcv1: 1 of 181 in the district, none in ตำบล 540601 → that ตำบล gets 0 of its 24, not no data", () => {
  const query = { area: "540601", period: "year", measure: "pcv1" } as const;
  assert.deepEqual(totals(at(EPI1, "2569"), EPI1.report, query), { target: 24, result: 0, pct: 0 });
  const units = totalsBy(at(EPI1, "2569"), EPI1.report, { ...query, area: "all", by: "area" }, NAMES);
  assert.deepEqual(units?.find((u) => u.key === "540601")?.totals, { target: 24, result: 0, pct: 0 });
});

test("s_epi2: pcv4, in the header but without a ผลงาน in any year → not a รายการ; ?measure=pcv4 of an old link → the first รายการ", () => {
  assert.deepEqual(measures(at(EPI2, "2569")), ["mmr2", "pcv4"]);
  assert.deepEqual(shownMeasures(EPI2, at(EPI2, "2569")), ["mmr2"]);
  assert.equal(reportQuery(EPI2, new URLSearchParams("measure=pcv4"), NAMES).measure, "mmr2");
});

test("s_epi1 2568: dtp2, without data that year but with data in 2569 → still a รายการ, so the year shows it as no data", () => {
  assert.deepEqual(shownMeasures(EPI1, at(EPI1, "2568")), ["mmr", "dtp2", "pcv1"]);
  assert.equal(reportQuery(EPI1, new URLSearchParams("year=2568&measure=dtp2"), NAMES).measure, "dtp2");
});

test("s_kpi_food 2569: Q_A in the header but target1–result4 empty in the whole district → ทั้งปี only; ?period=q1 of an old link → ทั้งปี", () => {
  const food = snapshot(S_KPI_FOOD);
  assert.deepEqual(families(at(food, "2569"), food.report), ["ANNUAL", "Q_A"]);
  assert.deepEqual(periods(at(food, "2569"), food.report), ["year"]);
  assert.equal(reportQuery(food, new URLSearchParams("period=q1"), NAMES).period, "year");
});

// FEATURES F19, F40: ?main=&cat=&q= of /reports as a LibraryQuery, and the
// reports of catalog.json it lists (SPEC §9.3), on the real catalog of 4 Nov
// 2569: 21 reports, 14 in ส่งเสริมป้องกัน and 7 in ข้อมูลตอบสนอง Service Plan.
const library = (search: string) => libraryList(MAINS, libraryQuery(MAINS, new URLSearchParams(search)));
/** Each group of a list as its กลุ่ม followed by its reports' source_table */
const listed = (list: LibraryList) => list.groups.map((g) => [g.subgroup, ...g.reports.map((r) => r.source_table)]);

test("?cat= of การสร้างเสริมภูมิคุ้มกันโรค → its 8 reports in 4 กลุ่ม, กลุ่มอายุ 1 → 2 → 3 → 5 ปี, s_epi1 before fully immunized in its กลุ่ม", () => {
  const list = library(`cat=${VACCINES.cat_id}`);
  assert.deepEqual(listed(list), [
    ["กลุ่มอายุ 1 ปี", "s_epi1", "s_epi_complete"],
    ["กลุ่มอายุ 2 ปี", "s_epi2", "s_epi_complete"],
    ["กลุ่มอายุ 3 ปี", "s_epi3", "s_epi_complete"],
    ["กลุ่มอายุ 5 ปี", "s_epi5", "s_epi_complete"],
  ]);
  assert.ok(list.groups.every((g) => g.topic.category_name === "การสร้างเสริมภูมิคุ้มกันโรค"));
  assert.equal(list.total, 8);
});

test("?q=s_epi_complete → its 4 reports, fully immunized 1, 2, 3 and 5 ปี; ?q=กลุ่มอายุ 2 ปี → the 2 reports of that กลุ่ม", () => {
  assert.deepEqual(listed(library("q=s_epi_complete")), [
    ["กลุ่มอายุ 1 ปี", "s_epi_complete"],
    ["กลุ่มอายุ 2 ปี", "s_epi_complete"],
    ["กลุ่มอายุ 3 ปี", "s_epi_complete"],
    ["กลุ่มอายุ 5 ปี", "s_epi_complete"],
  ]);
  assert.deepEqual(listed(library("q=กลุ่มอายุ 2 ปี")), [["กลุ่มอายุ 2 ปี", "s_epi2", "s_epi_complete"]]);
});

test("?q= also finds an opendata_id and a หัวข้อ name, in any letter case and with spaces around it: 28DD2C79 → fully immunized 1 ปี; service plan → the 7 reports of its 2 หัวข้อ", () => {
  assert.deepEqual(
    library("q= 28DD2C79 ").groups.flatMap((g) => g.reports.map((r) => r.opendata_id)),
    ["28dd2c7955ce926456240b2ff0100bde"],
  );
  assert.equal(library("q=service plan").total, 7);
});

test("?main= of ข้อมูลตอบสนอง Service Plan → the reports of its 2 หัวข้อ, 4 and 3; with ?cat= as well, the หัวข้อ wins", () => {
  assert.deepEqual(
    library(`main=${SERVICE_PLAN.main_report_id}`).groups.map((g) => [g.topic.category_name, g.reports.length]),
    [
      ["ข้อมูลเพื่อตอบสนอง Service Plan สาขาโรคไม่ติดต่อ (NCD DM,HT,CVD)", 4],
      ["ข้อมูลเพื่อตอบสนอง Service Plan สาขาสุขภาพช่องปาก", 3],
    ],
  );
  assert.deepEqual(libraryQuery(MAINS, new URLSearchParams(`main=${SERVICE_PLAN.main_report_id}&cat=${VACCINES.cat_id}`)), {
    main: null,
    cat: VACCINES.cat_id,
    q: "",
  });
});

test("?q= searches within the หมวด or หัวข้อ picked: ร้อยละ in ส่งเสริมป้องกัน → its 5 reports named so, not the 7 of Service Plan; s_epi_complete in อนามัยแม่และเด็ก → none", () => {
  assert.deepEqual(listed(library(`main=${PROMOTION.main_report_id}&q=ร้อยละ`)), [
    ["", "s_kpi_anc12", "s_anc5", "s_kpi_childdev4", "s_kpi_childdev2"],
    ["", "s_kpi_food"],
  ]);
  assert.equal(library("q=ร้อยละ").total, 12);
  assert.equal(library(`cat=${MCH.cat_id}&q=s_epi_complete`).total, 0);
});

test("no query → all 21 reports in one list, in catalog.json order by หัวข้อ and กลุ่ม", () => {
  const list = library("");
  assert.equal(list.total, 21);
  assert.deepEqual(listed(list), [
    ["", "s_kpi_anc12", "s_anc5", "s_kpi_childdev4", "s_kpi_childdev2"],
    ["กลุ่มอายุ 1 ปี", "s_epi1", "s_epi_complete"],
    ["กลุ่มอายุ 2 ปี", "s_epi2", "s_epi_complete"],
    ["กลุ่มอายุ 3 ปี", "s_epi3", "s_epi_complete"],
    ["กลุ่มอายุ 5 ปี", "s_epi5", "s_epi_complete"],
    ["", "s_kpi_food"],
    ["", "s_aged9"],
    ["", "s_dm_screen", "s_ht_screen", "s_ncd_screen_repleate1", "s_ht_screen_follow"],
    ["", "s_dental_0_5_cavity_free", "s_kpi_dental28", "s_kpi_dental33"],
  ]);
});

test("?page=3&size=20 of an old link → the LibraryQuery of no query, and all 21 reports", () => {
  assert.deepEqual(libraryQuery(MAINS, new URLSearchParams("page=3&size=20")), { main: null, cat: null, q: "" });
  assert.equal(library("page=3&size=20").total, 21);
});

test("a LibraryQuery → ?main=&cat=&q= without its defaults or page/size, which libraryQuery reads back as the same query; the defaults alone → no query", () => {
  const picked = { main: null, cat: VACCINES.cat_id, q: "epi 2" } as const;
  assert.equal(librarySearch(picked), "?cat=4df360514655f79f13901ef1181ca1c7&q=epi+2");
  assert.deepEqual(libraryQuery(MAINS, new URLSearchParams(librarySearch(picked))), picked);
  const thai = { main: PROMOTION.main_report_id, cat: null, q: "กลุ่มอายุ 2 ปี" } as const;
  assert.deepEqual(libraryQuery(MAINS, new URLSearchParams(librarySearch(thai))), thai);
  assert.equal(librarySearch({ main: null, cat: null, q: "" }), "");
});

test("?main= or ?cat= that catalog.json lacks, such as a หัวข้อ no longer shown or the id cut short → every หมวด: all 21 reports", () => {
  assert.deepEqual(libraryQuery(MAINS, new URLSearchParams("main=73daf277&cat=4df36051")), { main: null, cat: null, q: "" });
  assert.equal(library("cat=4df36051").total, 21);
});

// FEATURES F41: the search of /reports (SPEC §9.3) on the same catalog.

test("?q=เบาหวาน → the 2 reports named so, s_dm_screen and s_ncd_screen_repleate1; ?q=ส่งเสริมป้องกัน, a หมวด name → the 14 reports of that หมวด", () => {
  assert.deepEqual(listed(library("q=เบาหวาน")), [["", "s_dm_screen", "s_ncd_screen_repleate1"]]);
  assert.equal(library("q=ส่งเสริมป้องกัน").total, 14);
});

test("s_epi_complete matches its 4 reports by source_table alone → libraryByReference; service plan, a หัวข้อ name, and เบาหวาน, in report names → not; s_epi_complete in อนามัยแม่และเด็ก, with no report → not", () => {
  const byReference = (search: string) => libraryByReference(MAINS, libraryQuery(MAINS, new URLSearchParams(search)));
  assert.equal(byReference("q=s_epi_complete"), true);
  assert.equal(byReference("q=service plan"), false);
  assert.equal(byReference("q=เบาหวาน"), false);
  assert.equal(byReference(`cat=${MCH.cat_id}&q=s_epi_complete`), false);
  assert.equal(byReference(""), false);
});

test("a report name split at the search, as typed in the name: เบาหวาน at its end; ' cavity ' → Cavity in its own case; ครบ twice; no search or none found → the name alone", () => {
  assert.deepEqual(libraryNameParts("ร้อยละของประชากรอายุ 35 ปีขึ้นไปที่ได้รับการคัดกรองเพื่อวินิจฉัยเบาหวาน", "เบาหวาน"), [
    { text: "ร้อยละของประชากรอายุ 35 ปีขึ้นไปที่ได้รับการคัดกรองเพื่อวินิจฉัย", mark: false },
    { text: "เบาหวาน", mark: true },
  ]);
  assert.deepEqual(libraryNameParts("ร้อยละของเด็กอายุ0-5 ปี ฟันดีไม่มีผุ (Cavity Free) (คน)", " cavity "), [
    { text: "ร้อยละของเด็กอายุ0-5 ปี ฟันดีไม่มีผุ (", mark: false },
    { text: "Cavity", mark: true },
    { text: " Free) (คน)", mark: false },
  ]);
  assert.deepEqual(libraryNameParts("ความครอบคลุมการได้รับวัคซีนแต่ละชนิดครบตามเกณฑ์ในเด็กอายุครบ 1 ปี (fully immunized)", "ครบ"), [
    { text: "ความครอบคลุมการได้รับวัคซีนแต่ละชนิด", mark: false },
    { text: "ครบ", mark: true },
    { text: "ตามเกณฑ์ในเด็กอายุ", mark: false },
    { text: "ครบ", mark: true },
    { text: " 1 ปี (fully immunized)", mark: false },
  ]);
  assert.deepEqual(libraryNameParts("การคัดกรองผู้สูงอายุ 9 ด้าน", ""), [{ text: "การคัดกรองผู้สูงอายุ 9 ด้าน", mark: false }]);
  assert.deepEqual(libraryNameParts("การคัดกรองผู้สูงอายุ 9 ด้าน", "s_aged9"), [{ text: "การคัดกรองผู้สูงอายุ 9 ด้าน", mark: false }]);
});
