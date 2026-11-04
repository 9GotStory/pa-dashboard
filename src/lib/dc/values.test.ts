import assert from "node:assert/strict";
import test from "node:test";
import { HEADERS } from "./fixtures/headers-20261104";
import type { Cell, DcReport, DcYearBlock, Family, ReportQuery } from "./types";
import { families, goalFor, measureLabel, measures, passes, periods, totals, totalsBy, trend } from "./values";

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

test("q1 on s_dm_screen and s_aged9 (result1–4 or result1–9 without target1–4) → null: they are not quarterly", () => {
  for (const table of ["s_dm_screen", "s_aged9"]) {
    const b = block(HEADERS[table], [{ hospcode: "06413", areacode: "54060101", target: 4, result: 3, result1: 2 }]);
    assert.equal(totals(b, DM_SCREEN, { area: "all", period: "q1", measure: null }), null, table);
  }
});

const MONTH_PERIODS = MONTHS.map((m) => `m${m}`);

test("periods: s_kpi_anc12 → ทั้งปี and quarters 1–4; s_epi_complete and s_epi1 → ทั้งปี and the months ต.ค.–ก.ย.", () => {
  assert.deepEqual(periods(block(HEADERS.s_kpi_anc12), DM_SCREEN), ["year", "q1", "q2", "q3", "q4"]);
  assert.deepEqual(periods(block(HEADERS.s_epi_complete), DM_SCREEN), ["year", ...MONTH_PERIODS]);
  assert.deepEqual(periods(block(HEADERS.s_epi1), DM_SCREEN), ["year", ...MONTH_PERIODS]);
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

test("2 block ปี whose headers differ (2568: mmr1 before target{MM}, no pcv4) → each year from its own header; pcv4 in 2568 → null, not 0", () => {
  const h2568 = ["hospcode", "areacode", "date_com", "b_year", ...MONTHS.map((m) => `mmr1_${m}`), ...MONTHS.map((m) => `target${m}`)];
  const data = {
    report: S_EPI2,
    years: [
      block(h2568, [
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

test("เกณฑ์ of s_epi2: mmr1 → 95 from measure_goals (kpi_epi); pcv4, not in kpi_epi, and no measure → the report's goal 90 (SCHEMA §6)", () => {
  assert.equal(goalFor(S_EPI2, "mmr1"), 95);
  assert.equal(goalFor(S_EPI2, "pcv4"), 90);
  assert.equal(goalFor(S_EPI2, null), 90);
});

test("เกณฑ์ of a measure named like an Object property (constructor, from ?measure=) → the report's goal, not a function", () => {
  assert.equal(goalFor(S_EPI2, "constructor"), 90);
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
