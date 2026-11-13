import assert from "node:assert/strict";
import test from "node:test";
import { AGE_6812, AGE_6812_LINES } from "./fixtures/age-6812cc54-20261106";
import { STAT_M68, STAT_M68_LINES } from "./fixtures/stat-m68-20261111";
import { formatPct } from "./format";
import { ageRowsTotals, homePopulation, readRegistryFiles, villageCount } from "./population";
import { populationTotals, registryAsOf, registryYear, yearAsOf } from "./population-totals";
import type { AgeBand, PopulationSnapshot, RegistryPopulationRow } from "./types";

// FEATURES F24, F44: reading and checking stat_m files in the /sync upload
// (SCHEMA §11.1–11.2), on lines cut from the real stat_m68.txt. Expected
// values come from the file's own สำนักทะเบียน total lines and ตำบล lines and
// the figures the province announced (SCHEMA §11.4).

test("stat_m68.txt → ปี 2568, 10 rows, 46,527 people (ชาย 22,475 หญิง 24,052) and 20,101 บ้าน, the figures the province announced", () => {
  const [read] = readRegistryFiles([{ name: "stat_m68.txt", text: STAT_M68 }], "5406");

  assert.ok(read.ok && read.kind === "population", !read.ok ? read.reason : "");
  assert.equal(registryYear(read.yymm), "2568");
  assert.equal(read.rows.length, 10);
  assert.deepEqual(populationTotals(read.rows), { male: 22475, female: 24052, total: 46527, house: 20101 });
});

test("stat_m68.txt → 94 หมู่บ้าน rows of อำเภอสอง (81 of 5406, 13 of 5489) and 85 หมู่บ้าน: the 7 with a line under each สำนักทะเบียน and the ไม่ระบุหมู่ lines are not counted twice", () => {
  const [read] = readRegistryFiles([{ name: "stat_m68.txt", text: STAT_M68 }], "5406");
  assert.ok(read.ok && read.kind === "population", !read.ok ? read.reason : "");

  assert.equal(read.villages.length, 94);
  assert.deepEqual(
    [read.villages.filter((r) => r.rcode === "5406").length, read.villages.filter((r) => r.rcode === "5489").length],
    [81, 13],
  );
  assert.equal(villageCount(read.villages), 85);
});

test("the หมู่บ้าน rows as SCHEMA §2.8 keeps them: หมู่ 4 ศรีมูลเรือง of บ้านหนุน has a row under 5406 (192 คน 128 บ้าน) and one under 5489 (839 คน 410 บ้าน); บ้านกลาง's ไม่ระบุหมู่ 54060200 is 0 คน 1 บ้าน under 5406 and 14 คน (ชาย 9 หญิง 5) 2 บ้าน under 5489", () => {
  const [read] = readRegistryFiles([{ name: "stat_m68.txt", text: STAT_M68 }], "5406");
  assert.ok(read.ok && read.kind === "population");

  const row = (rcode: string, mm: string) => read.villages.find((r) => r.rcode === rcode && r.mm === mm);
  assert.deepEqual(row("5406", "54060104"), {
    yymm: "6812",
    cc: "54",
    cc_name: "จังหวัดแพร่",
    rcode: "5406",
    rcode_name: "อำเภอสอง",
    tt: "54060100",
    tt_name: "ตำบลบ้านหนุน",
    mm: "54060104",
    mm_name: "ศรีมูลเรือง",
    male: 94,
    female: 98,
    total: 192,
    house: 128,
  });
  assert.deepEqual([row("5489", "54060104")?.total, row("5489", "54060104")?.house], [839, 410]);
  assert.deepEqual(row("5406", "54060200"), {
    yymm: "6812",
    cc: "54",
    cc_name: "จังหวัดแพร่",
    rcode: "5406",
    rcode_name: "อำเภอสอง",
    tt: "54060200",
    tt_name: "ตำบลบ้านกลาง",
    mm: "54060200",
    mm_name: "บ้านกลาง",
    male: 0,
    female: 0,
    total: 0,
    house: 1,
  });
  assert.deepEqual(
    [
      row("5489", "54060200")?.male,
      row("5489", "54060200")?.female,
      row("5489", "54060200")?.total,
      row("5489", "54060200")?.house,
    ],
    [9, 5, 14, 2],
  );
});

test("the rows are the district's ตำบล lines as SCHEMA §2.6 keeps them: 8 of 5406 adding up to its total line (40,389) and 2 of 5489 to its own (6,138); other districts' ตำบลน้ำชำ and ตำบลสูงเม่น are cut", () => {
  const [read] = readRegistryFiles([{ name: "stat_m68.txt", text: STAT_M68 }], "5406");
  assert.ok(read.ok && read.kind === "population");

  const of = (rcode: string) => read.rows.filter((r) => r.rcode === rcode);
  assert.deepEqual(
    read.rows.map((r) => r.tt),
    [
      "54060100",
      "54060200",
      "54060300",
      "54060400",
      "54060500",
      "54060600",
      "54060700",
      "54060800",
      "54060100",
      "54060200",
    ],
  );
  assert.deepEqual(populationTotals(of("5406")), { male: 19692, female: 20697, total: 40389, house: 16904 });
  assert.deepEqual(populationTotals(of("5489")), { male: 2783, female: 3355, total: 6138, house: 3197 });
  // Text trimmed and " " read as "", numbers without commas.
  assert.deepEqual(of("5489")[0], {
    yymm: "6812",
    cc: "54",
    cc_name: "จังหวัดแพร่",
    rcode: "5489",
    rcode_name: "ท้องถิ่นเทศบาลตำบลสอง",
    tt: "54060100",
    tt_name: "ตำบลบ้านหนุน",
    mm: "0",
    mm_name: "",
    male: 1306,
    female: 1557,
    total: 2863,
    house: 1336,
  });
});

// The cut file with changed lines, BOM first as stat.bora writes it.
function fileOf(lines: string[]): string {
  return "\uFEFF" + lines.join("\n") + "\n";
}

// STAT_M68_LINES with the line of (RCODE, CCAATT, CCAATTMM) changed by f, or
// dropped if f returns null: the ตำบล line unless mm is given.
function changeLine(rcode: string, tt: string, f: (values: string[]) => string[] | null, mm = "0"): string[] {
  return STAT_M68_LINES.flatMap((line) => {
    const values = line.split("|");
    if (values[3] !== rcode || values[5] !== tt || values[7] !== mm) return [line];
    const changed = f(values);
    return changed === null ? [] : [changed.join("|")];
  });
}

// Why readRegistryFiles refuses this one file.
function refusal(text: string, name = "stat_m68.txt"): string {
  const [read] = readRegistryFiles([{ name, text }], "5406");
  assert.ok(!read.ok, "the file was read");
  return read.reason;
}

test("a stat_m without a ตำบล line of อำเภอ 5406 → refused", () => {
  const others = STAT_M68_LINES.filter((line) => !/\|54(06|89)\|/.test(line));

  assert.equal(refusal(fileOf(others)), "ไม่มีบรรทัดตำบลของอำเภอ 5406 ในไฟล์");
});

test("a stat_m of November (yymm 6811 on every line) → refused: not the figures at 31 ธ.ค.", () => {
  const november = STAT_M68_LINES.map((line) => line.replace(/^6812\|/, "6811|"));

  assert.equal(refusal(fileOf(november)), "ปีเดือนในไฟล์คือ 6811 ไม่ใช่เดือน 12 (ยอด ณ 31 ธ.ค.)");
});

test("a stat_m with one line of 6712 among lines of 6812 → refused: one yymm per file", () => {
  const mixed = changeLine("5489", "54060200", (v) => ["6712", ...v.slice(1)]);

  assert.equal(refusal(fileOf(mixed)), "ปีเดือนไม่เท่ากันทั้งไฟล์: บรรทัดที่ 1 เป็น 6812 แต่บรรทัดที่ 226 เป็น 6712");
});

test("ตำบลบ้านกลาง of 5489 with 1,862 บ้าน instead of 1,861 → refused: its ตำบล lines no longer add up to the สำนักทะเบียน's total line", () => {
  const changed = changeLine("5489", "54060200", (v) => [...v.slice(0, 12), "1,862", ""]);

  assert.equal(
    refusal(fileOf(changed)),
    "ผลรวมบรรทัดตำบลของสำนักทะเบียน 5489 ท้องถิ่นเทศบาลตำบลสอง ไม่เท่าบรรทัดยอดรวม: บ้าน 3,198 แต่บรรทัดยอดรวม 3,197",
  );
});

test("a download cut off after ตำบลแดนชุมพล → refused: 5406's ตำบล lines add up to less than its total line", () => {
  const cut = STAT_M68_LINES.slice(0, STAT_M68_LINES.findLastIndex((line) => line.includes("|54060700|")) + 1);

  assert.equal(
    refusal(fileOf(cut)),
    "ผลรวมบรรทัดตำบลของสำนักทะเบียน 5406 อำเภอสอง ไม่เท่าบรรทัดยอดรวม: ชาย 18,126 แต่บรรทัดยอดรวม 19,692",
  );
});

test("a stat_m without the total line of 5406 → refused", () => {
  const noTotal = changeLine("5406", "0", () => null);

  assert.equal(refusal(fileOf(noTotal)), "ไม่มีบรรทัดยอดรวมของสำนักทะเบียน 5406 อำเภอสอง");
});

test("a download cut off mid-way through its last line (11 values, no line end) → refused, naming the line", () => {
  const lines = [
    ...STAT_M68_LINES.slice(0, -1),
    "6812|54|จังหวัดแพร่ |5492|ท้องถิ่นเทศบาลตำบลสูงเม่น|54040100|ตำบลสูงเม่น |54040108|สูงเม่น|256|2",
  ];

  assert.equal(refusal("\uFEFF" + lines.join("\n")), "บรรทัดที่ 241 มี 11 ค่า ไฟล์ stat_m มีบรรทัดละ 13 ค่า");
});

test('a count that is no number ("2,1x6") → refused, naming the line', () => {
  const changed = changeLine("5406", "54060100", (v) => [...v.slice(0, 9), "2,1x6", ...v.slice(10)]);

  assert.equal(refusal(fileOf(changed)), "บรรทัดที่ 129 มีค่าที่ไม่ใช่ตัวเลข: 2,1x6");
});

test("a file named neither stat_m{yy} nor {yymm}cc{จังหวัด} (ประชากร.txt, or cc54.txt without its year) → refused without reading it", () => {
  assert.equal(refusal(STAT_M68, "ประชากร.txt"), "ไม่ใช่ไฟล์ stat_m{ปี}.txt หรือ {ปี}12cc{จังหวัด}.txt ของ stat.bora");
  assert.equal(refusal(AGE_6812, "cc54.txt"), "ไม่ใช่ไฟล์ stat_m{ปี}.txt หรือ {ปี}12cc{จังหวัด}.txt ของ stat.bora");
});

// stat_t68.txt as stat.bora serves it: stat_m68.txt without its หมู่บ้าน
// lines, line for line (SCHEMA §11.1, ADR-0014).
const STAT_T68 = fileOf(STAT_M68_LINES.filter((line) => line.split("|")[7] === "0"));

test("stat_t68.txt, the ตำบล level read before Track I, or stat_t68 (1).txt → refused, naming the stat_m68.txt to pick from the หมู่บ้าน level", () => {
  const reason = "ไฟล์ stat_t เป็นระดับตำบล ไม่มีหมู่บ้าน ใช้ไฟล์ stat_m68.txt จากเมนูระดับหมู่บ้านแทน";

  assert.equal(refusal(STAT_T68, "stat_t68.txt"), reason);
  assert.equal(refusal(STAT_T68, "stat_t68 (1).txt"), reason);
});

test("stat_m68 (1).txt, a second download the browser renamed → read like stat_m68.txt", () => {
  const [read] = readRegistryFiles([{ name: "stat_m68 (1).txt", text: STAT_M68 }], "5406");

  assert.ok(read.ok && read.kind === "population", !read.ok ? read.reason : "");
  assert.deepEqual([read.rows.length, read.villages.length], [10, 94]);
});

test("two files of 6812 in one pick → the first is read, the second refused, so each year is saved once", () => {
  const reads = readRegistryFiles(
    [
      { name: "stat_m68.txt", text: STAT_M68 },
      { name: "stat_m68 (1).txt", text: STAT_M68 },
    ],
    "5406",
  );

  assert.deepEqual(
    reads.map((r) => r.ok),
    [true, false],
  );
  assert.equal(!reads[1].ok && reads[1].reason, "ปี 2568 ซ้ำกับไฟล์ stat_m68.txt ที่เลือกไว้");
});

// SCHEMA §11.2 stat_m rule 5: the district's หมู่บ้าน lines.

test("หมู่ 4 ศรีมูลเรือง of บ้านหนุน (5406) with 129 บ้าน instead of 128 → refused: บ้านหนุน's หมู่บ้าน lines of 5406 no longer add up to its ตำบล line (2,163)", () => {
  const changed = changeLine("5406", "54060100", (v) => [...v.slice(0, 12), "129", ""], "54060104");

  assert.equal(
    refusal(fileOf(changed)),
    "ผลรวมบรรทัดหมู่บ้านของ ตำบลบ้านหนุน ของสำนักทะเบียน 5406 อำเภอสอง ไม่เท่าบรรทัดตำบล: บ้าน 2,164 แต่บรรทัดตำบล 2,163",
  );
});

test("ตำบลทุ่งน้าว of 5406 without its 6 หมู่บ้าน lines → refused: every ตำบล line of the district has หมู่บ้าน lines", () => {
  const changed = STAT_M68_LINES.filter((line) => !/\|54060800\|[^|]*\|5406080[1-6]\|/.test(line));

  assert.equal(refusal(fileOf(changed)), "ตำบลทุ่งน้าว ของสำนักทะเบียน 5406 อำเภอสอง ไม่มีบรรทัดหมู่บ้าน");
});

test("a หมู่บ้าน code of 7 digits, or one of ตำบลบ้านกลาง under ตำบลบ้านหนุน → refused: a หมู่บ้าน code is 8 digits starting with its ตำบล's 6", () => {
  const short = changeLine("5406", "54060100", (v) => [...v.slice(0, 7), "5406011", ...v.slice(8)], "54060111");
  const misplaced = changeLine("5406", "54060100", (v) => [...v.slice(0, 7), "54060211", ...v.slice(8)], "54060111");

  assert.equal(refusal(fileOf(short)), "รหัสหมู่บ้าน 5406011 หนุนใต้ ไม่ใช่รหัส 8 หลักของ ตำบลบ้านหนุน (54060100)");
  assert.equal(refusal(fileOf(misplaced)), "รหัสหมู่บ้าน 54060211 หนุนใต้ ไม่ใช่รหัส 8 หลักของ ตำบลบ้านหนุน (54060100)");
});

test("หมู่ 11 of บ้านหนุน (5406) twice → refused: one line per (สำนักทะเบียน, หมู่บ้าน), though หมู่ 4 has a line under 5406 and one under 5489", () => {
  const line = STAT_M68_LINES.find((l) => l.includes("|5406|") && l.includes("|54060111|"))!;
  const changed = STAT_M68_LINES.flatMap((l) => (l === line ? [l, l] : [l]));

  assert.equal(refusal(fileOf(changed)), "หมู่บ้าน 54060111 หนุนใต้ ซ้ำในสำนักทะเบียน 5406 อำเภอสอง");
});

test("a หมู่บ้าน line of ตำบลห้วยหม้าย under 5489, which has no ตำบลห้วยหม้าย line → refused: its หมู่บ้าน lines go with a ตำบล line", () => {
  const line = "6812|54|จังหวัดแพร่ |5489|ท้องถิ่นเทศบาลตำบลสอง|54060300|ตำบลห้วยหม้าย |54060301|ลูนิเกต|1|1|2|1|";

  assert.equal(
    refusal(fileOf([...STAT_M68_LINES, line])),
    "หมู่บ้าน 54060301 ลูนิเกต ไม่มีบรรทัด ตำบลห้วยหม้าย ของสำนักทะเบียน 5489 ท้องถิ่นเทศบาลตำบลสอง",
  );
});

// FEATURES F26: the population of the home page (SCHEMA §11.3), on the real
// rows of 2568 as the upload reads them from the cut stat_m68.txt. Expected
// values come from the file's ตำบล and total lines and the figures the
// province announced (SCHEMA §11.4).

// catalog.json's areas: the 8 ตำบล of tambon_master.
const AREAS = [
  { id: "540601", name_th: "บ้านหนุน" },
  { id: "540602", name_th: "บ้านกลาง" },
  { id: "540603", name_th: "ห้วยหม้าย" },
  { id: "540604", name_th: "เตาปูน" },
  { id: "540605", name_th: "หัวเมือง" },
  { id: "540606", name_th: "สะเอียบ" },
  { id: "540607", name_th: "แดนชุมพล" },
  { id: "540608", name_th: "ทุ่งน้าว" },
];

// The 10 rows of 2568 (SCHEMA §2.6): 8 of สำนักทะเบียน 5406 and 2 of 5489.
const [read68] = readRegistryFiles([{ name: "stat_m68.txt", text: STAT_M68 }], "5406");
if (!read68.ok || read68.kind !== "population") throw new Error(read68.ok ? `read as ${read68.kind}` : read68.reason);
const ROWS_6812 = read68.rows;

// population.json as the prebuild writes it (SCHEMA §7): one year per list of
// rows, oldest first, without age rows and village rows.
function snapshotOf(...years: RegistryPopulationRow[][]): PopulationSnapshot {
  return { years: years.map((population) => ({ yymm: population[0].yymm, population, village: [], age: [] })) };
}

test("population.json of 2567 and 2568 → the home page shows 2568, the latest: ณ 31 ธ.ค. 2568 and its 46,527 people", () => {
  // stat_m67.txt's line of ตำบลบ้านหนุน in สำนักทะเบียน 5406
  const row6712 = { ...ROWS_6812[0], yymm: "6712", male: 2174, female: 2445, total: 4619, house: 2148 };

  const home = homePopulation(snapshotOf([row6712], ROWS_6812), AREAS);

  assert.ok(home);
  assert.equal(registryAsOf(home.yymm), "ณ 31 ธ.ค. 2568");
  assert.equal(home.district.totals.total, 46527);
});

test("ปีข้อมูล 2568, as รายงานประชากร lists it (SPEC §9.4.1) → ณ 31 ธ.ค. 2568, the text yymm 6812 gives on the home page", () => {
  assert.equal(yearAsOf("2568"), "ณ 31 ธ.ค. 2568");
  assert.equal(yearAsOf("2568"), registryAsOf("6812"));
});

test("ตำบล of 2568 → the 8 of areas by code, each adding up every สำนักทะเบียน: บ้านหนุน 7,399 คน 3,499 บ้าน (4,536 + 2,863 คน of 5406 and 5489), บ้านกลาง 6,686 คน 3,335 บ้าน (3,411 + 3,275)", () => {
  // The rows last to first: the order of the ตำบล comes from their codes.
  const home = homePopulation(snapshotOf([...ROWS_6812].reverse()), AREAS);

  assert.ok(home);
  // The file's ตำบล lines; บ้านหนุน and บ้านกลาง add the line of 5406 and the line of 5489.
  assert.deepEqual(home.areas, [
    {
      key: "540601",
      name: "บ้านหนุน",
      totals: { male: 3442, female: 3957, total: 7399, house: 3499 },
      age: null,
      villages: null,
    },
    {
      key: "540602",
      name: "บ้านกลาง",
      totals: { male: 3152, female: 3534, total: 6686, house: 3335 },
      age: null,
      villages: null,
    },
    {
      key: "540603",
      name: "ห้วยหม้าย",
      totals: { male: 3564, female: 3903, total: 7467, house: 3096 },
      age: null,
      villages: null,
    },
    {
      key: "540604",
      name: "เตาปูน",
      totals: { male: 3903, female: 4089, total: 7992, house: 2954 },
      age: null,
      villages: null,
    },
    {
      key: "540605",
      name: "หัวเมือง",
      totals: { male: 2975, female: 3062, total: 6037, house: 2297 },
      age: null,
      villages: null,
    },
    {
      key: "540606",
      name: "สะเอียบ",
      totals: { male: 2692, female: 2643, total: 5335, house: 2555 },
      age: null,
      villages: null,
    },
    {
      key: "540607",
      name: "แดนชุมพล",
      totals: { male: 1181, female: 1230, total: 2411, house: 957 },
      age: null,
      villages: null,
    },
    {
      key: "540608",
      name: "ทุ่งน้าว",
      totals: { male: 1566, female: 1634, total: 3200, house: 1408 },
      age: null,
      villages: null,
    },
  ]);
});

test("the อำเภอ of 2568 → 46,527 คน (ชาย 22,475 หญิง 24,052) and 20,101 บ้าน, the figures the province announced", () => {
  const home = homePopulation(snapshotOf(ROWS_6812), AREAS);

  assert.deepEqual(home?.district, {
    key: "all",
    name: "อำเภอสอง",
    totals: { male: 22475, female: 24052, total: 46527, house: 20101 },
    age: null,
    villages: null,
  });
});

test("population.json without a year (nothing uploaded yet) → null: the home page stays as in phase 1", () => {
  assert.equal(homePopulation({ years: [] }, AREAS), null);
});

test("a ตำบล that areas lacks → named by its tt_name, its people still in the อำเภอ's 46,527", () => {
  const home = homePopulation(
    snapshotOf(ROWS_6812),
    AREAS.filter((a) => a.id !== "540602"),
  );

  assert.ok(home);
  assert.equal(home.areas.find((a) => a.key === "540602")?.name, "ตำบลบ้านกลาง");
  assert.equal(home.district.totals.total, 46527);
});

// FEATURES F27: reading and checking the age file in the /sync upload
// (SCHEMA §11.1–11.2), on lines cut from the real 6812cc54.txt and
// stat_m68.txt. Expected values come from stat_m's lines and the figures of
// SCHEMA §11.4, which were added up from the file's own columns.

// The pick of 2568 as a browser lists it, by name: the age file first.
const PICK_6812 = [
  { name: "6812cc54.txt", text: AGE_6812 },
  { name: "stat_m68.txt", text: STAT_M68 },
];

test("6812cc54.txt picked with stat_m68.txt → the age rows of ปี 2568, one for each of stat_m's 10 rows (8 of สำนักทะเบียน 5406, 2 of 5489), adding up to the 46,527 people the province announced (ชาย 22,475 หญิง 24,052)", () => {
  const [read] = readRegistryFiles(PICK_6812, "5406");

  assert.ok(read.ok && read.kind === "age", read.ok ? `read as ${read.kind}` : read.reason);
  assert.equal(registryYear(read.yymm), "2568");
  assert.deepEqual(
    read.rows.map((r) => `${r.rcode} ${r.tt} ${r.tt_name}`),
    [
      "5406 54060100 ตำบลบ้านหนุน",
      "5406 54060200 ตำบลบ้านกลาง",
      "5406 54060300 ตำบลห้วยหม้าย",
      "5406 54060400 ตำบลเตาปูน",
      "5406 54060500 ตำบลหัวเมือง",
      "5406 54060600 ตำบลสะเอียบ",
      "5406 54060700 ตำบลแดนชุมพล",
      "5406 54060800 ตำบลทุ่งน้าว",
      "5489 54060100 ตำบลบ้านหนุน",
      "5489 54060200 ตำบลบ้านกลาง",
    ],
  );
  assert.deepEqual(ageRowsTotals(read.rows), { male: 22475, female: 24052, total: 46527 });
});

test("the age rows keep the file's counts under the names of SCHEMA §2.7: ages 0 … 101 add up to 46,362 (ชาย 22,363 หญิง 23,999), aged 60 and over to 13,487 (ชาย 5,896 หญิง 7,591), and the 165 ประชากรที่ไม่แยกอายุ are ไม่ใช่สัญชาติไทย 81, ทะเบียนบ้านกลาง 75, ระหว่างการย้าย 9 and เกิดปีจันทรคติ 0", () => {
  const [read] = readRegistryFiles(PICK_6812, "5406");
  assert.ok(read.ok && read.kind === "age");

  // Added up over the 10 rows, by column name.
  const ages = (sex: "m" | "f", from: number) =>
    read.rows.reduce((sum, row) => {
      for (let age = from; age <= 101; age++) sum += row[`${sex}${age}`];
      return sum;
    }, 0);
  const groupTotal = (group: "lunar" | "central" | "nonthai" | "moving") =>
    read.rows.reduce((sum, row) => sum + row[`${group}_t`], 0);
  assert.deepEqual([ages("m", 0), ages("f", 0)], [22363, 23999]);
  assert.deepEqual([ages("m", 60), ages("f", 60)], [5896, 7591]);
  assert.deepEqual(
    {
      nonthai: groupTotal("nonthai"),
      central: groupTotal("central"),
      moving: groupTotal("moving"),
      lunar: groupTotal("lunar"),
    },
    { nonthai: 81, central: 75, moving: 9, lunar: 0 },
  );
  // ตำบลบ้านกลาง of 5406: the last 15 values of its line.
  const banKlang = read.rows[1];
  assert.deepEqual(
    [
      banKlang.lunar_m,
      banKlang.lunar_f,
      banKlang.lunar_t,
      banKlang.central_m,
      banKlang.central_f,
      banKlang.central_t,
      banKlang.nonthai_m,
      banKlang.nonthai_f,
      banKlang.nonthai_t,
      banKlang.moving_m,
      banKlang.moving_f,
      banKlang.moving_t,
      banKlang.total_m,
      banKlang.total_f,
      banKlang.total_t,
    ],
    [0, 0, 0, 50, 12, 62, 7, 2, 9, 2, 3, 5, 1675, 1736, 3411],
  );
});

test("อำเภอสูงเม่น (5404), whose ตำบลน้ำชำ shares its name with one in อำเภอเมืองแพร่ → its ตำบลน้ำชำ gets the line of its own block (9,280 คน, not 1,629), and ตำบลสูงเม่น of 5404 and of the เทศบาล (5492) each the line of its own block (3,139 and 3,487)", () => {
  const [read] = readRegistryFiles(PICK_6812, "5404");

  assert.ok(read.ok && read.kind === "age", read.ok ? `read as ${read.kind}` : read.reason);
  const total = (rcode: string, tt: string) => read.rows.find((r) => r.rcode === rcode && r.tt === tt)?.total_t;
  assert.equal(read.rows.length, 13);
  assert.equal(total("5404", "54040200"), 9280);
  assert.equal(total("5404", "54040100"), 3139);
  assert.equal(total("5492", "54040100"), 3487);
});

// Why readRegistryFiles refuses the age file (text, named name), picked with stat_m68.txt.
function ageRefusal(text: string, name = "6812cc54.txt"): string {
  const [read] = readRegistryFiles(
    [
      { name, text },
      { name: "stat_m68.txt", text: STAT_M68 },
    ],
    "5406",
  );
  assert.ok(!read.ok, "the age file was read");
  return read.reason;
}

test("6812cc54.txt without a stat_m of 2568 that passed (picked alone, with stat_m67.txt, with a stat_m68.txt that was refused, or with stat_t68.txt) → refused: an age file needs the stat_m of its year in the same pick", () => {
  const stat67 = fileOf(STAT_M68_LINES.map((line) => line.replace(/^6812\|/, "6712|")));
  const stat68Refused = fileOf(STAT_M68_LINES.filter((line) => !line.includes("|54060800|")));
  const reasons = [
    readRegistryFiles([{ name: "6812cc54.txt", text: AGE_6812 }], "5406"),
    readRegistryFiles(
      [
        { name: "6812cc54.txt", text: AGE_6812 },
        { name: "stat_m67.txt", text: stat67 },
      ],
      "5406",
    ),
    readRegistryFiles(
      [
        { name: "6812cc54.txt", text: AGE_6812 },
        { name: "stat_m68.txt", text: stat68Refused },
      ],
      "5406",
    ),
    readRegistryFiles(
      [
        { name: "6812cc54.txt", text: AGE_6812 },
        { name: "stat_t68.txt", text: STAT_T68 },
      ],
      "5406",
    ),
  ].map(([read]) => (read.ok ? "read" : read.reason));

  const reason = "ไม่มีไฟล์ stat_m68.txt ที่ผ่านการตรวจในชุดที่เลือก ไฟล์อายุต้องเลือกพร้อม stat_m ของปีเดียวกัน";
  assert.deepEqual(reasons, [reason, reason, reason, reason]);
});

test("an age file named 6811cc54.txt (November) → refused: not the figures at 31 ธ.ค.", () => {
  assert.equal(ageRefusal(AGE_6812, "6811cc54.txt"), "ปีเดือนในชื่อไฟล์คือ 6811 ไม่ใช่เดือน 12 (ยอด ณ 31 ธ.ค.)");
});

test("6812cc53.txt, the age file of another จังหวัด (53) → refused: อำเภอ 5406 is in จังหวัด 54", () => {
  assert.equal(ageRefusal(AGE_6812, "6812cc53.txt"), "ชื่อไฟล์เป็นของจังหวัด 53 ไม่ใช่จังหวัด 54 ของอำเภอ 5406");
});

test("6812cc54 (1).txt, a second download the browser renamed → read like 6812cc54.txt", () => {
  const [read] = readRegistryFiles(
    [
      { name: "6812cc54 (1).txt", text: AGE_6812 },
      { name: "stat_m68.txt", text: STAT_M68 },
    ],
    "5406",
  );

  assert.ok(read.ok && read.kind === "age", read.ok ? `read as ${read.kind}` : read.reason);
  assert.equal(read.yymm, "6812");
  assert.equal(read.rows.length, 10);
});

test("two age files of 6812 with stat_m68.txt in one pick → the first is read, the second refused, so each year's age rows are saved once", () => {
  const reads = readRegistryFiles([...PICK_6812, { name: "6812cc54 (1).txt", text: AGE_6812 }], "5406");

  assert.deepEqual(
    reads.map((r) => r.ok),
    [true, true, false],
  );
  assert.equal(!reads[2].ok && reads[2].reason, "ปี 2568 ซ้ำกับไฟล์ 6812cc54.txt ที่เลือกไว้");
});

// Lines of the cut 6812cc54.txt, numbered as a refusal names them: the
// block of อำเภอสอง and its ตำบลบ้านหนุน, the block of เทศบาลตำบลสอง and its
// ตำบลบ้านหนุน.
const SONG = 17;
const SONG_BAN_NUN = 18;
const SONG_BAN_KLANG = 19;
const SONG_TOWN = 26;
const SONG_TOWN_BAN_NUN = 27;
// Where a count sits in a line's values (SCHEMA §11.1): the name, then m0, f0
// … m101, f101, then lunar, central, nonthai, moving and total, each as m f t.
const M0 = 1;
const CENTRAL_T = 210;
const TOTAL_M = 217;
const TOTAL_T = 219;

// AGE_6812_LINES with line n changed by f, which gets its values (the name
// first, the | that closes it dropped); f returning null drops the line.
function changeAgeLine(n: number, f: (values: string[]) => string[] | null): string[] {
  return AGE_6812_LINES.flatMap((line, i) => {
    if (i !== n - 1) return [line];
    const changed = f(line.slice(0, -1).split("|"));
    return changed === null ? [] : [`${changed.join("|")}|`];
  });
}

test("an age file cut off mid-way through its last line (120 of 220 values) → refused, naming the line", () => {
  const last = AGE_6812_LINES.at(-1)!.split("|").slice(0, 120).join("|");

  assert.equal(ageRefusal(fileOf([...AGE_6812_LINES.slice(0, -1), last])), "บรรทัดที่ 30 มี 120 ค่า ไฟล์อายุมีบรรทัดละ 220 ค่า");
});

test("a count of ตำบลบ้านหนุน that is no whole number (12.5) → refused, naming the line", () => {
  const changed = changeAgeLine(SONG_BAN_NUN, (v) => v.map((value, i) => (i === M0 ? "12.5" : value)));

  assert.equal(ageRefusal(fileOf(changed)), "บรรทัดที่ 18 มีค่าที่ไม่ใช่จำนวนเต็ม: 12.5");
});

test("6812cc54.txt without the line of เทศบาลตำบลสอง (so its ตำบล fall into the block before) → refused: no block for สำนักทะเบียน 5489 ท้องถิ่นเทศบาลตำบลสอง", () => {
  const changed = changeAgeLine(SONG_TOWN, () => null);

  assert.equal(ageRefusal(fileOf(changed)), "ไม่มีบล็อก เทศบาลตำบลสอง ของสำนักทะเบียน 5489 ในไฟล์อายุ");
});

test("two blocks named อำเภอสอง (the line of เทศบาลตำบลสอง renamed) → refused: one block for each สำนักทะเบียน", () => {
  const changed = changeAgeLine(SONG_TOWN, (v) => ["อำเภอสอง", ...v.slice(1)]);

  assert.equal(ageRefusal(fileOf(changed)), "มีบล็อก อำเภอสอง มากกว่าหนึ่งบล็อกในไฟล์อายุ");
});

test("the block of เทศบาลตำบลสอง without its ตำบลบ้านหนุน → refused, though the block of อำเภอสอง has one: a ตำบล is looked for in its own block only", () => {
  const changed = changeAgeLine(SONG_TOWN_BAN_NUN, () => null);

  assert.equal(ageRefusal(fileOf(changed)), "ไม่มีบรรทัด ตำบลบ้านหนุน ในบล็อก เทศบาลตำบลสอง");
});

test("ตำบลบ้านหนุน twice in the block of อำเภอสอง (its ตำบลบ้านกลาง renamed) → refused: one line for each ตำบล", () => {
  const changed = changeAgeLine(SONG_BAN_KLANG, (v) => ["ตำบลบ้านหนุน", ...v.slice(1)]);

  assert.equal(ageRefusal(fileOf(changed)), "มีบรรทัด ตำบลบ้านหนุน มากกว่าหนึ่งบรรทัดในบล็อก อำเภอสอง");
});

// values with one added to each count at the given places.
function plusOne(values: string[], ...at: number[]): string[] {
  return values.map((value, i) => (at.includes(i) ? String(Number(value) + 1) : value));
}

test("ตำบลบ้านหนุน of อำเภอสอง with one more boy aged 0, ชาย 2,137 รวม 4,537 → refused: not the 2,136 of stat_m68.txt", () => {
  const changed = changeAgeLine(SONG_BAN_NUN, (v) => plusOne(v, M0, TOTAL_M, TOTAL_T));

  assert.equal(
    ageRefusal(fileOf(changed)),
    "ยอดของ ตำบลบ้านหนุน ในบล็อก อำเภอสอง ไม่ตรงกับ stat_m68.txt: ชาย 2,137 แต่ stat_m 2,136",
  );
});

test("the line of อำเภอสอง with รวม 40,390 → refused: not the total line of สำนักทะเบียน 5406 in stat_m68.txt (40,389)", () => {
  const changed = changeAgeLine(SONG, (v) => plusOne(v, TOTAL_T));

  assert.equal(
    ageRefusal(fileOf(changed)),
    "ยอดของบล็อก อำเภอสอง ไม่ตรงกับบรรทัดยอดรวมของสำนักทะเบียน 5406 ใน stat_m68.txt: รวม 40,390 แต่ stat_m 40,389",
  );
});

test("ทะเบียนบ้านกลาง of ตำบลบ้านกลาง (อำเภอสอง) with รวม 63 for ชาย 50 + หญิง 12 → refused: ชาย + หญิง = รวม in each group of stat.bora's file", () => {
  const changed = changeAgeLine(SONG_BAN_KLANG, (v) => plusOne(v, CENTRAL_T));

  assert.equal(ageRefusal(fileOf(changed)), "ตำบลบ้านกลาง ในบล็อก อำเภอสอง: ทะเบียนบ้านกลาง ชาย 50 + หญิง 12 ไม่เท่ารวม 63");
});

test("ตำบลบ้านหนุน of อำเภอสอง with one more boy aged 0 but ชาย 2,136 as in stat_m → refused: its ages and ประชากรที่ไม่แยกอายุ add up to 2,137", () => {
  const changed = changeAgeLine(SONG_BAN_NUN, (v) => plusOne(v, M0));

  assert.equal(
    ageRefusal(fileOf(changed)),
    "ตำบลบ้านหนุน ในบล็อก อำเภอสอง: จำนวนรายปีอายุของชายรวมกับประชากรที่ไม่แยกอายุได้ 2,137 ไม่เท่ายอดรวม 2,136",
  );
});

// FEATURES F28: the population pyramid of the home page (SCHEMA §11.3), on
// the real rows of 2568 as the upload reads them from the cut stat_m68.txt
// and 6812cc54.txt. Expected values come from the figures of SCHEMA §11.4 and
// the age file's last columns and totals, never from adding up its counts by
// year of age as the code does.

// The 10 age rows of 2568 (SCHEMA §2.7), one for each of ROWS_6812.
const [ageRead68] = readRegistryFiles(PICK_6812, "5406");
if (!ageRead68.ok || ageRead68.kind !== "age")
  throw new Error(ageRead68.ok ? `read as ${ageRead68.kind}` : ageRead68.reason);

// population.json of 2568 with its age rows, as the prebuild writes its latest year (SCHEMA §7).
const SNAPSHOT_6812: PopulationSnapshot = {
  years: [{ yymm: "6812", population: ROWS_6812, village: [], age: ageRead68.rows }],
};

// ชาย and หญิง of bands added up.
function bandsTotal(bands: AgeBand[]): { male: number; female: number } {
  return bands.reduce((sum, b) => ({ male: sum.male + b.male, female: sum.female + b.female }), { male: 0, female: 0 });
}

test("the อำเภอ of 2568 → its pyramid: 17 ช่วงอายุ 0–4 … 75–79 and 80+, youngest first, holding the 46,362 counted by year of age (ชาย 22,363 หญิง 23,999), of whom 60–64 … 80+ are the 13,487 aged 60 and over (ชาย 5,896 หญิง 7,591), ร้อยละ 29.09", () => {
  const age = homePopulation(SNAPSHOT_6812, AREAS)?.district.age;

  assert.ok(age);
  assert.deepEqual(
    age.bands.map((b) => b.label),
    [
      "0–4",
      "5–9",
      "10–14",
      "15–19",
      "20–24",
      "25–29",
      "30–34",
      "35–39",
      "40–44",
      "45–49",
      "50–54",
      "55–59",
      "60–64",
      "65–69",
      "70–74",
      "75–79",
      "80+",
    ],
  );
  assert.deepEqual(bandsTotal(age.bands), { male: 22363, female: 23999 });
  assert.equal(age.age_total, 46362);
  assert.deepEqual(bandsTotal(age.bands.slice(12)), { male: 5896, female: 7591 });
  assert.equal(age.aged60, 13487);
  assert.equal(formatPct(age.aged60_pct), "29.09");
});

test("the อำเภอ of 2568 → its 165 ประชากรที่ไม่แยกอายุ (46,527 − 46,362) by kind: ไม่ใช่สัญชาติไทย 81, ทะเบียนบ้านกลาง 75, ระหว่างการย้าย 9 and เกิดปีจันทรคติ 0", () => {
  const age = homePopulation(SNAPSHOT_6812, AREAS)?.district.age;

  assert.deepEqual(age?.unsplit, { nonthai: 81, central: 75, moving: 9, lunar: 0 });
});

test("the 8 ตำบล of 2568 → a pyramid each, and together they hold the อำเภอ's 46,362 counted by year of age and its 13,487 aged 60 and over", () => {
  const home = homePopulation(SNAPSHOT_6812, AREAS);

  assert.ok(home);
  const ages = home.areas.map((a) => a.age);
  assert.equal(ages.filter((age) => age !== null).length, 8);
  assert.equal(
    ages.reduce((sum, age) => sum + (age?.age_total ?? 0), 0),
    46362,
  );
  assert.equal(
    ages.reduce((sum, age) => sum + (age?.aged60 ?? 0), 0),
    13487,
  );
});

test("บ้านหนุน and บ้านกลาง of 2568, each with a line of 5406 and one of 5489 → a pyramid of both lines: บ้านหนุน 7,384 counted by year of age (ชาย 3,432 หญิง 3,952) and ไม่ใช่สัญชาติไทย 15 (10 + 5); บ้านกลาง 6,589 (ชาย 3,079 หญิง 3,510), ทะเบียนบ้านกลาง 75 (62 + 13), ไม่ใช่สัญชาติไทย 15 (9 + 6) and ระหว่างการย้าย 7 (5 + 2)", () => {
  const home = homePopulation(SNAPSHOT_6812, AREAS);
  const ageOf = (key: string) => home?.areas.find((a) => a.key === key)?.age;

  // From the last 15 values of the 4 lines: each line's ชาย and หญิง by
  // year of age are its total less its ประชากรที่ไม่แยกอายุ, as stat.bora's
  // formula has it (SCHEMA §11.1), e.g. บ้านหนุน of 5406: 2,136 − 8 ชาย.
  const banNun = ageOf("540601");
  assert.ok(banNun);
  assert.deepEqual(bandsTotal(banNun.bands), { male: 3432, female: 3952 });
  assert.equal(banNun.age_total, 7384);
  assert.deepEqual(banNun.unsplit, { nonthai: 15, central: 0, moving: 0, lunar: 0 });
  const banKlang = ageOf("540602");
  assert.ok(banKlang);
  assert.deepEqual(bandsTotal(banKlang.bands), { male: 3079, female: 3510 });
  assert.equal(banKlang.age_total, 6589);
  assert.deepEqual(banKlang.unsplit, { nonthai: 15, central: 75, moving: 7, lunar: 0 });
});

test("ages at the edges of the ช่วงอายุ (ตำบลแดนชุมพล with its counts by year of age all 0 but ชาย 79, 80, 100, 101 and หญิง 4, 5, 59, 60) → 0–4 ends at 4, 55–59 at 59 and 75–79 at 79, 80+ takes 80 to 101, and aged 60 and over starts at 60, as SCHEMA §11.3 has them", () => {
  const counts: Record<string, number> = { m79: 1, m80: 2, m100: 3, m101: 4, f4: 5, f5: 6, f59: 7, f60: 8 };
  const edges = { ...ageRead68.rows.find((r) => r.tt === "54060700")! };
  for (let age = 0; age <= 101; age++) {
    for (const sex of ["m", "f"] as const) edges[`${sex}${age}`] = counts[`${sex}${age}`] ?? 0;
  }
  const population = ROWS_6812.filter((r) => r.tt === "54060700");

  const age = homePopulation({ years: [{ yymm: "6812", population, village: [], age: [edges] }] }, AREAS)?.district.age;

  assert.ok(age);
  assert.deepEqual(
    age.bands.filter((b) => b.male + b.female > 0),
    [
      { label: "0–4", male: 0, female: 5 },
      { label: "5–9", male: 0, female: 6 },
      { label: "55–59", male: 0, female: 7 },
      { label: "60–64", male: 0, female: 8 },
      { label: "75–79", male: 1, female: 0 },
      { label: "80+", male: 2 + 3 + 4, female: 0 },
    ],
  );
  assert.equal(age.aged60, 1 + 2 + 3 + 4 + 8);
});

test("population.json whose latest year has no age rows, as before F29 uploads them → age null for the อำเภอ and all 8 ตำบล: the home page hides only the pyramid", () => {
  const home = homePopulation(snapshotOf(ROWS_6812), AREAS);

  assert.ok(home);
  assert.deepEqual(
    [home.district, ...home.areas].map((a) => a.age),
    Array(9).fill(null),
  );
});

// FEATURES F46: the หมู่บ้าน of the ตำบล panel (SCHEMA §11.3), on the real
// village rows of 2568 as the upload reads them from the cut stat_m68.txt.
// Expected values come from the file's หมู่บ้าน and ตำบล lines (SCHEMA §11.4).

// population.json of 2568 with its village rows, as the prebuild writes its latest year (SCHEMA §7).
const VILLAGE_SNAPSHOT_6812: PopulationSnapshot = {
  years: [{ yymm: "6812", population: ROWS_6812, village: read68.villages, age: [] }],
};

test("บ้านหนุน of 2568 → 11 หมู่บ้าน, and หมู่ 4 ศรีมูลเรือง, with a line under 5406 and one under 5489, is 1,031 คน 538 บ้าน (192 + 839, 128 + 410)", () => {
  const villages = homePopulation(VILLAGE_SNAPSHOT_6812, AREAS)?.areas.find((a) => a.key === "540601")?.villages;

  assert.ok(villages);
  assert.equal(villages.count, 11);
  const moo4 = villages.list.find((v) => v.moo === 4);
  assert.deepEqual(
    [moo4?.code, moo4?.name, moo4?.totals.total, moo4?.totals.house],
    ["54060104", "ศรีมูลเรือง", 1031, 538],
  );
});

test("บ้านกลาง of 2568, its rows last to first → 12 หมู่บ้าน by หมู่ที่ 1 … 12, then ไม่ระบุหมู่ 54060200 last: 14 คน (ชาย 9 หญิง 5) 3 บ้าน (0 + 14 คน, 1 + 2 บ้าน of 5406 and 5489), not counted", () => {
  const reversed: PopulationSnapshot = {
    years: [{ ...VILLAGE_SNAPSHOT_6812.years[0], village: [...read68.villages].reverse() }],
  };

  const villages = homePopulation(reversed, AREAS)?.areas.find((a) => a.key === "540602")?.villages;

  assert.ok(villages);
  assert.equal(villages.count, 12);
  assert.deepEqual(
    villages.list.map((v) => v.moo),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, null],
  );
  assert.deepEqual(villages.list.at(-1), {
    code: "54060200",
    moo: null,
    name: "บ้านกลาง",
    totals: { male: 9, female: 5, total: 14, house: 3 },
  });
});

test("the อำเภอ of 2568 → 85 หมู่บ้าน, its 8 ตำบล 11, 12, 17, 12, 13, 10, 4 and 6, and no list: the panel shows the อำเภอ's count only", () => {
  const home = homePopulation(VILLAGE_SNAPSHOT_6812, AREAS);

  assert.ok(home);
  assert.deepEqual(home.district.villages, { count: 85, list: [] });
  assert.deepEqual(
    home.areas.map((a) => a.villages?.count),
    [11, 12, 17, 12, 13, 10, 4, 6],
  );
});

test("each ตำบล of 2568 → its หมู่บ้าน, ไม่ระบุหมู่ included, add up to the ตำบล: บ้านหนุน 7,399 คน 3,499 บ้าน, บ้านกลาง 6,686 คน 3,335 บ้าน, and so the other 6", () => {
  const home = homePopulation(VILLAGE_SNAPSHOT_6812, AREAS);

  assert.ok(home);
  const sums = home.areas.map((area) =>
    area.villages!.list.reduce(
      (s, v) => ({
        male: s.male + v.totals.male,
        female: s.female + v.totals.female,
        total: s.total + v.totals.total,
        house: s.house + v.totals.house,
      }),
      { male: 0, female: 0, total: 0, house: 0 },
    ),
  );
  assert.deepEqual(
    sums.slice(0, 2).map((s) => [s.total, s.house]),
    [
      [7399, 3499],
      [6686, 3335],
    ],
  );
  // area.totals come from the ตำบล lines, never from the หมู่บ้าน lines.
  assert.deepEqual(
    sums,
    home.areas.map((a) => a.totals),
  );
});

test("population.json whose latest year has no village rows, as before F45 uploads stat_m → villages null for the อำเภอ and all 8 ตำบล: the home page hides the list and count of หมู่บ้าน", () => {
  const home = homePopulation(snapshotOf(ROWS_6812), AREAS);

  assert.ok(home);
  assert.deepEqual(
    [home.district, ...home.areas].map((a) => a.villages),
    Array(9).fill(null),
  );
});
