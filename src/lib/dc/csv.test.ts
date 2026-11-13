import assert from "node:assert/strict";
import test from "node:test";
import { populationCsv, reportCsv } from "./csv";
import { AREAS, POPULATION_REPORT_DATA } from "./fixtures/population-report-20261113";
import { populationReport, sortUnits } from "./population-report";

// The CSV piece of the report pages (FEATURES F51): what every page downloads.
const ANC12 = {
  report_name: "ร้อยละหญิงตั้งครรภ์ได้รับการฝากครรภ์ครั้งแรกก่อนหรือเท่ากับ 12 สัปดาห์",
  opendata_id: "1c1b8e24aff59258a806f122e264031e",
  source_table: "s_kpi_anc12",
};

test('CSV → UTF-8 BOM first, the header lines of SPEC §9.4, a blank line, then the table; CRLF between lines, every cell in quotes with " doubled', () => {
  const csv = reportCsv({
    report: ANC12,
    year: "2569",
    filters: "ปีงบประมาณ 2569 · ทั้งอำเภอ · ทั้งปี · เปรียบเทียบรายตำบล",
    dateCom: "202611030557",
    table: [
      ["ตำบล", "เป้าหมาย"],
      ["บ้านหนุน", 12],
      ['ชื่อ "ย่อ", ยาว', ""],
    ],
  });
  assert.equal(
    csv.text,
    "\uFEFF" +
      [
        '"Song Health Data Center · ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่"',
        '"รายงาน","ร้อยละหญิงตั้งครรภ์ได้รับการฝากครรภ์ครั้งแรกก่อนหรือเท่ากับ 12 สัปดาห์ (1c1b8e24aff59258a806f122e264031e)"',
        '"ตัวกรอง","ปีงบประมาณ 2569 · ทั้งอำเภอ · ทั้งปี · เปรียบเทียบรายตำบล"',
        '"แหล่งข้อมูล","HDC Open Data ตาราง s_kpi_anc12 · วันที่ข้อมูล 3 พฤศจิกายน 2569 เวลา 05:57 น."',
        "",
        '"ตำบล","เป้าหมาย"',
        '"บ้านหนุน","12"',
        '"ชื่อ ""ย่อ"", ยาว",""',
      ].join("\r\n"),
  );
});

test("CSV cells starting with = + - @ tab or CR, after spaces too as in R6 → ' put first so Excel keeps them as text; — and 1-2 untouched", () => {
  const csv = reportCsv({
    report: ANC12,
    year: "2569",
    filters: "",
    dateCom: "",
    table: [["=SUM(A1)", "+1", "-1", "@A1", "\tx", "\rx", " =1", "—", "1-2"]],
  });
  assert.equal(csv.text.split("\r\n").at(-1), '"\'=SUM(A1)","\'+1","\'-1","\'@A1","\'\tx","\'\rx","\' =1","—","1-2"');
});

test("CSV file name → SHDC-{source_table}-{first 8 of opendata_id}-{year}.csv (SPEC §9.4), the id in its own letter case (SCHEMA §3)", () => {
  const name = (report: { source_table: string; opendata_id: string }, year: string) =>
    reportCsv({ report: { ...report, report_name: "" }, year, filters: "", dateCom: "", table: [] }).name;
  assert.equal(
    name({ source_table: "s_epi_complete", opendata_id: "28dd2c7955ce926456240b2ff0100bde" }, "2569"),
    "SHDC-s_epi_complete-28dd2c79-2569.csv",
  );
  // A real HDC id in mixed case (SCHEMA §5.2), from the catalog export of 30 Oct 2569
  assert.equal(
    name({ source_table: "s_child_mom_hepb", opendata_id: "Qe95V9DKGQYy5ij" }, "2568"),
    "SHDC-s_child_mom_hepb-Qe95V9DK-2568.csv",
  );
});

test("CSV of an open รายละเอียด → -{measure} or -domain{1–9} before .csv (SPEC §9.4): SHDC-s_epi1-c88658f4-2569-mmr.csv", () => {
  const report = { report_name: "", source_table: "s_epi1", opendata_id: "c88658f4d09acb8c76e6c06ffb58ebaf" };
  assert.equal(
    reportCsv({ report, year: "2569", part: "mmr", filters: "", dateCom: "", table: [] }).name,
    "SHDC-s_epi1-c88658f4-2569-mmr.csv",
  );
  assert.equal(
    reportCsv({ report, year: "2569", filters: "", dateCom: "", table: [] }).name,
    "SHDC-s_epi1-c88658f4-2569.csv",
  );
});

// รายงานประชากร's CSV (FEATURES F68, SPEC §9.4.1): the units × years table shown.
const population = (area: string) => populationReport(POPULATION_REPORT_DATA, { year: "2568", area }, AREAS);

test("CSV of รายงานประชากร, the whole อำเภอ in 2568 → the header lines of SPEC §9.4.1, a blank line, then ตำบล × ปีข้อมูล with the change from the first year", () => {
  const report = population("all");
  const lines = populationCsv(report, report.units, "5406").text.split("\r\n");

  assert.deepEqual(lines.slice(0, 7), [
    '\uFEFF"Song Health Data Center · ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่"',
    '"รายงาน","ประชากรและบ้าน รายตำบลและรายหมู่บ้าน"',
    '"พื้นที่","ทั้งอำเภอสอง"',
    '"ปีข้อมูล","ณ 31 ธ.ค. 2568"',
    '"แหล่งข้อมูล","กรมการปกครอง stat.bora"',
    "",
    '"ตำบล","2564","2565","2566","2567","2568","เปลี่ยนแปลงจากปีแรกถึง 2568 (คน)","เปลี่ยนแปลงจากปีแรกถึง 2568 (ร้อยละ)"',
  ]);
  // A change below 0 starts with -, so it is kept as text (R6's rule)
  assert.equal(lines[7], '"บ้านหนุน","7877","7765","7624","7495","7399","\'-478","\'-6.07"');
  assert.equal(lines.length, 15);
});

test('CSV of บ้านกลาง → หมู่บ้าน × ปีข้อมูล in the order shown, ไม่ระบุหมู่ last, and "—" for a year without rows', () => {
  const report = population("540602");
  const lines = populationCsv(report, sortUnits(report, "count"), "5406").text.split("\r\n");

  assert.equal(lines[2], '"พื้นที่","ตำบลบ้านกลาง"');
  assert.equal(lines[6].split(",")[0], '"หมู่บ้าน"');
  assert.equal(lines.at(-1), '"ไม่ระบุหมู่","16","14","15","16","14","\'-2","\'-12.50"');

  const cut = {
    years: POPULATION_REPORT_DATA.years.map((y) => ({ ...y, village: y.yymm === "6612" ? [] : y.village })),
  };
  const partial = populationReport(cut, { year: "2568", area: "540602" }, AREAS);
  assert.equal(populationCsv(partial, partial.units, "5406").text.split("\r\n").at(-1)?.split(",")[3], '"—"');
});

test("CSV file name of รายงานประชากร → SHDC-population-{ปีข้อมูล}-{area code}.csv, the district_code for the whole อำเภอ", () => {
  const name = (area: string) => populationCsv(population(area), [], "5406").name;

  assert.equal(name("all"), "SHDC-population-2568-5406.csv");
  assert.equal(name("540601"), "SHDC-population-2568-540601.csv");
});
