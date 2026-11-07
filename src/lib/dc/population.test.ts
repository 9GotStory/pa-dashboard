import assert from "node:assert/strict";
import test from "node:test";
import { STAT_T68, STAT_T68_LINES } from "./fixtures/stat-t68-20261106";
import { homePopulation, populationTotals, readRegistryFiles, registryAsOf, registryYear } from "./population";
import type { PopulationSnapshot, RegistryPopulationRow } from "./types";

// FEATURES F24: reading and checking stat_t files in the /sync upload
// (SCHEMA §11.1–11.2), on lines cut from the real stat_t68.txt. Expected
// values come from the file's own สำนักทะเบียน total lines and the figures the
// province announced (SCHEMA §11.4).

test("stat_t68.txt → ปี 2568, 10 rows, 46,527 people (ชาย 22,475 หญิง 24,052) and 20,101 บ้าน, the figures the province announced", () => {
  const [read] = readRegistryFiles([{ name: "stat_t68.txt", text: STAT_T68 }], "5406");

  assert.ok(read.ok, !read.ok ? read.reason : "");
  assert.equal(registryYear(read.yymm), "2568");
  assert.equal(read.rows.length, 10);
  assert.deepEqual(populationTotals(read.rows), { male: 22475, female: 24052, total: 46527, house: 20101 });
});

test("the rows are the district's ตำบล lines as SCHEMA §2.6 keeps them: 8 of 5406 adding up to its total line (40,389) and 2 of 5489 to its own (6,138); other districts' ตำบลน้ำชำ and ตำบลสูงเม่น are cut", () => {
  const [read] = readRegistryFiles([{ name: "stat_t68.txt", text: STAT_T68 }], "5406");
  assert.ok(read.ok);

  const of = (rcode: string) => read.rows.filter((r) => r.rcode === rcode);
  assert.deepEqual(read.rows.map((r) => r.tt), [
    "54060100", "54060200", "54060300", "54060400", "54060500", "54060600", "54060700", "54060800", "54060100", "54060200",
  ]);
  assert.deepEqual(populationTotals(of("5406")), { male: 19692, female: 20697, total: 40389, house: 16904 });
  assert.deepEqual(populationTotals(of("5489")), { male: 2783, female: 3355, total: 6138, house: 3197 });
  // Text trimmed and " " read as "", numbers without commas.
  assert.deepEqual(of("5489")[0], {
    yymm: "6812", cc: "54", cc_name: "จังหวัดแพร่", rcode: "5489", rcode_name: "ท้องถิ่นเทศบาลตำบลสอง",
    tt: "54060100", tt_name: "ตำบลบ้านหนุน", mm: "0", mm_name: "", male: 1306, female: 1557, total: 2863, house: 1336,
  });
});

// The cut file with changed lines, BOM first as stat.bora writes it.
function fileOf(lines: string[]): string {
  return "\uFEFF" + lines.join("\n") + "\n";
}

// STAT_T68_LINES with the line of (RCODE, CCAATT) changed by f, or dropped if f returns null.
function changeLine(rcode: string, tt: string, f: (values: string[]) => string[] | null): string[] {
  return STAT_T68_LINES.flatMap((line) => {
    const values = line.split("|");
    if (values[3] !== rcode || values[5] !== tt) return [line];
    const changed = f(values);
    return changed === null ? [] : [changed.join("|")];
  });
}

// Why readRegistryFiles refuses this one file.
function refusal(text: string, name = "stat_t68.txt"): string {
  const [read] = readRegistryFiles([{ name, text }], "5406");
  assert.ok(!read.ok, "the file was read");
  return read.reason;
}

test("a stat_t without a ตำบล line of อำเภอ 5406 → refused", () => {
  const others = STAT_T68_LINES.filter((line) => !/\|54(06|89)\|/.test(line));

  assert.equal(refusal(fileOf(others)), "ไม่มีบรรทัดตำบลของอำเภอ 5406 ในไฟล์");
});

test("a stat_t of November (yymm 6811 on every line) → refused: not the figures at 31 ธ.ค.", () => {
  const november = STAT_T68_LINES.map((line) => line.replace(/^6812\|/, "6811|"));

  assert.equal(refusal(fileOf(november)), "ปีเดือนในไฟล์คือ 6811 ไม่ใช่เดือน 12 (ยอด ณ 31 ธ.ค.)");
});

test("a stat_t with one line of 6712 among lines of 6812 → refused: one yymm per file", () => {
  const mixed = changeLine("5489", "54060200", (v) => ["6712", ...v.slice(1)]);

  assert.equal(refusal(fileOf(mixed)), "ปีเดือนไม่เท่ากันทั้งไฟล์: บรรทัดที่ 1 เป็น 6812 แต่บรรทัดที่ 18 เป็น 6712");
});

test("ตำบลบ้านกลาง of 5489 with 1,862 บ้าน instead of 1,861 → refused: its ตำบล lines no longer add up to the สำนักทะเบียน's total line", () => {
  const changed = changeLine("5489", "54060200", (v) => [...v.slice(0, 12), "1,862", ""]);

  assert.equal(
    refusal(fileOf(changed)),
    "ผลรวมบรรทัดตำบลของสำนักทะเบียน 5489 ท้องถิ่นเทศบาลตำบลสอง ไม่เท่าบรรทัดยอดรวม: บ้าน 3,198 แต่บรรทัดยอดรวม 3,197",
  );
});

test("a download cut off after ตำบลแดนชุมพล → refused: 5406's ตำบล lines add up to less than its total line", () => {
  const cut = STAT_T68_LINES.slice(0, STAT_T68_LINES.findIndex((line) => line.includes("|54060700|")) + 1);

  assert.equal(
    refusal(fileOf(cut)),
    "ผลรวมบรรทัดตำบลของสำนักทะเบียน 5406 อำเภอสอง ไม่เท่าบรรทัดยอดรวม: ชาย 18,126 แต่บรรทัดยอดรวม 19,692",
  );
});

test("a stat_t without the total line of 5406 → refused", () => {
  const noTotal = changeLine("5406", "0", () => null);

  assert.equal(refusal(fileOf(noTotal)), "ไม่มีบรรทัดยอดรวมของสำนักทะเบียน 5406 อำเภอสอง");
});

test("a download cut off mid-way through its last line (11 values, no line end) → refused, naming the line", () => {
  const lines = [...STAT_T68_LINES.slice(0, -1), "6812|54|จังหวัดแพร่ |5492|ท้องถิ่นเทศบาลตำบลสูงเม่น|54040100|ตำบลสูงเม่น |0| |1,626|1,8"];

  assert.equal(refusal("\uFEFF" + lines.join("\n")), "บรรทัดที่ 20 มี 11 ค่า ไฟล์ stat_t มีบรรทัดละ 13 ค่า");
});

test("a count that is no number (\"2,1x6\") → refused, naming the line", () => {
  const changed = changeLine("5406", "54060100", (v) => [...v.slice(0, 9), "2,1x6", ...v.slice(10)]);

  assert.equal(refusal(fileOf(changed)), "บรรทัดที่ 8 มีค่าที่ไม่ใช่ตัวเลข: 2,1x6");
});

test("a file not named stat_t{yy} (the age file 6812cc54.txt, or another name) → refused without reading it", () => {
  assert.equal(refusal(STAT_T68, "6812cc54.txt"), "ไม่ใช่ไฟล์ stat_t{ปี}.txt ของ stat.bora");
  assert.equal(refusal(STAT_T68, "ประชากร.txt"), "ไม่ใช่ไฟล์ stat_t{ปี}.txt ของ stat.bora");
});

test("stat_t68 (1).txt, a second download the browser renamed → read like stat_t68.txt", () => {
  const [read] = readRegistryFiles([{ name: "stat_t68 (1).txt", text: STAT_T68 }], "5406");

  assert.ok(read.ok, !read.ok ? read.reason : "");
  assert.equal(read.rows.length, 10);
});

test("two files of 6812 in one pick → the first is read, the second refused, so each year is saved once", () => {
  const reads = readRegistryFiles(
    [{ name: "stat_t68.txt", text: STAT_T68 }, { name: "stat_t68 (1).txt", text: STAT_T68 }],
    "5406",
  );

  assert.deepEqual(reads.map((r) => r.ok), [true, false]);
  assert.equal(!reads[1].ok && reads[1].reason, "ปี 2568 ซ้ำกับไฟล์ stat_t68.txt ที่เลือกไว้");
});

// FEATURES F26: the population of the home page (SCHEMA §11.3), on the real
// rows of 2568 as the upload reads them from the cut stat_t68.txt. Expected
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
const [read68] = readRegistryFiles([{ name: "stat_t68.txt", text: STAT_T68 }], "5406");
if (!read68.ok) throw new Error(read68.reason);
const ROWS_6812 = read68.rows;

// population.json as the prebuild writes it (SCHEMA §7): one year per list of
// rows, oldest first, without age rows.
function snapshotOf(...years: RegistryPopulationRow[][]): PopulationSnapshot {
  return { years: years.map((population) => ({ yymm: population[0].yymm, population, age: [] })) };
}

test("population.json of 2567 and 2568 → the home page shows 2568, the latest: ณ 31 ธ.ค. 2568 and its 46,527 people", () => {
  // stat_t67.txt's line of ตำบลบ้านหนุน in สำนักทะเบียน 5406
  const row6712 = { ...ROWS_6812[0], yymm: "6712", male: 2174, female: 2445, total: 4619, house: 2148 };

  const home = homePopulation(snapshotOf([row6712], ROWS_6812), AREAS);

  assert.ok(home);
  assert.equal(registryAsOf(home.yymm), "ณ 31 ธ.ค. 2568");
  assert.equal(home.district.totals.total, 46527);
});

test("ตำบล of 2568 → the 8 of areas by code, each adding up every สำนักทะเบียน: บ้านหนุน 7,399 คน 3,499 บ้าน (4,536 + 2,863 คน of 5406 and 5489), บ้านกลาง 6,686 คน 3,335 บ้าน (3,411 + 3,275)", () => {
  // The rows last to first: the order of the ตำบล comes from their codes.
  const home = homePopulation(snapshotOf([...ROWS_6812].reverse()), AREAS);

  assert.ok(home);
  // The file's ตำบล lines; บ้านหนุน and บ้านกลาง add the line of 5406 and the line of 5489.
  assert.deepEqual(home.areas, [
    { key: "540601", name: "บ้านหนุน", totals: { male: 3442, female: 3957, total: 7399, house: 3499 } },
    { key: "540602", name: "บ้านกลาง", totals: { male: 3152, female: 3534, total: 6686, house: 3335 } },
    { key: "540603", name: "ห้วยหม้าย", totals: { male: 3564, female: 3903, total: 7467, house: 3096 } },
    { key: "540604", name: "เตาปูน", totals: { male: 3903, female: 4089, total: 7992, house: 2954 } },
    { key: "540605", name: "หัวเมือง", totals: { male: 2975, female: 3062, total: 6037, house: 2297 } },
    { key: "540606", name: "สะเอียบ", totals: { male: 2692, female: 2643, total: 5335, house: 2555 } },
    { key: "540607", name: "แดนชุมพล", totals: { male: 1181, female: 1230, total: 2411, house: 957 } },
    { key: "540608", name: "ทุ่งน้าว", totals: { male: 1566, female: 1634, total: 3200, house: 1408 } },
  ]);
});

test("the อำเภอ of 2568 → 46,527 คน (ชาย 22,475 หญิง 24,052) and 20,101 บ้าน, the figures the province announced", () => {
  const home = homePopulation(snapshotOf(ROWS_6812), AREAS);

  assert.deepEqual(home?.district, {
    key: "all",
    name: "อำเภอสอง",
    totals: { male: 22475, female: 24052, total: 46527, house: 20101 },
  });
});

test("population.json without a year (nothing uploaded yet) → null: the home page stays as in phase 1", () => {
  assert.equal(homePopulation({ years: [] }, AREAS), null);
});

test("a ตำบล that areas lacks → named by its tt_name, its people still in the อำเภอ's 46,527", () => {
  const home = homePopulation(snapshotOf(ROWS_6812), AREAS.filter((a) => a.id !== "540602"));

  assert.ok(home);
  assert.equal(home.areas.find((a) => a.key === "540602")?.name, "ตำบลบ้านกลาง");
  assert.equal(home.district.totals.total, 46527);
});
