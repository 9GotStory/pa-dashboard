import assert from "node:assert/strict";
import test from "node:test";
import { AGE_6812, AGE_6812_LINES } from "./fixtures/age-6812cc54-20261106";
import { STAT_T68, STAT_T68_LINES } from "./fixtures/stat-t68-20261106";
import { ageRowsTotals, homePopulation, populationTotals, readRegistryFiles, registryAsOf, registryYear } from "./population";
import type { PopulationSnapshot, RegistryPopulationRow } from "./types";

// FEATURES F24: reading and checking stat_t files in the /sync upload
// (SCHEMA §11.1–11.2), on lines cut from the real stat_t68.txt. Expected
// values come from the file's own สำนักทะเบียน total lines and the figures the
// province announced (SCHEMA §11.4).

test("stat_t68.txt → ปี 2568, 10 rows, 46,527 people (ชาย 22,475 หญิง 24,052) and 20,101 บ้าน, the figures the province announced", () => {
  const [read] = readRegistryFiles([{ name: "stat_t68.txt", text: STAT_T68 }], "5406");

  assert.ok(read.ok && read.kind === "population", !read.ok ? read.reason : "");
  assert.equal(registryYear(read.yymm), "2568");
  assert.equal(read.rows.length, 10);
  assert.deepEqual(populationTotals(read.rows), { male: 22475, female: 24052, total: 46527, house: 20101 });
});

test("the rows are the district's ตำบล lines as SCHEMA §2.6 keeps them: 8 of 5406 adding up to its total line (40,389) and 2 of 5489 to its own (6,138); other districts' ตำบลน้ำชำ and ตำบลสูงเม่น are cut", () => {
  const [read] = readRegistryFiles([{ name: "stat_t68.txt", text: STAT_T68 }], "5406");
  assert.ok(read.ok && read.kind === "population");

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

  assert.equal(refusal(fileOf(mixed)), "ปีเดือนไม่เท่ากันทั้งไฟล์: บรรทัดที่ 1 เป็น 6812 แต่บรรทัดที่ 29 เป็น 6712");
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

  assert.equal(refusal("\uFEFF" + lines.join("\n")), "บรรทัดที่ 31 มี 11 ค่า ไฟล์ stat_t มีบรรทัดละ 13 ค่า");
});

test("a count that is no number (\"2,1x6\") → refused, naming the line", () => {
  const changed = changeLine("5406", "54060100", (v) => [...v.slice(0, 9), "2,1x6", ...v.slice(10)]);

  assert.equal(refusal(fileOf(changed)), "บรรทัดที่ 19 มีค่าที่ไม่ใช่ตัวเลข: 2,1x6");
});

test("a file named neither stat_t{yy} nor {yymm}cc{จังหวัด} (ประชากร.txt, or cc54.txt without its year) → refused without reading it", () => {
  assert.equal(refusal(STAT_T68, "ประชากร.txt"), "ไม่ใช่ไฟล์ stat_t{ปี}.txt หรือ {ปี}12cc{จังหวัด}.txt ของ stat.bora");
  assert.equal(refusal(AGE_6812, "cc54.txt"), "ไม่ใช่ไฟล์ stat_t{ปี}.txt หรือ {ปี}12cc{จังหวัด}.txt ของ stat.bora");
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
if (!read68.ok || read68.kind !== "population") throw new Error(read68.ok ? `read as ${read68.kind}` : read68.reason);
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

// FEATURES F27: reading and checking the age file in the /sync upload
// (SCHEMA §11.1–11.2), on lines cut from the real 6812cc54.txt and
// stat_t68.txt. Expected values come from stat_t's lines and the figures of
// SCHEMA §11.4, which were added up from the file's own columns.

// The pick of 2568 as a browser lists it, by name: the age file first.
const PICK_6812 = [
  { name: "6812cc54.txt", text: AGE_6812 },
  { name: "stat_t68.txt", text: STAT_T68 },
];

test("6812cc54.txt picked with stat_t68.txt → the age rows of ปี 2568, one for each of stat_t's 10 rows (8 of สำนักทะเบียน 5406, 2 of 5489), adding up to the 46,527 people the province announced (ชาย 22,475 หญิง 24,052)", () => {
  const [read] = readRegistryFiles(PICK_6812, "5406");

  assert.ok(read.ok && read.kind === "age", read.ok ? `read as ${read.kind}` : read.reason);
  assert.equal(registryYear(read.yymm), "2568");
  assert.deepEqual(read.rows.map((r) => `${r.rcode} ${r.tt} ${r.tt_name}`), [
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
  ]);
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
  const groupTotal = (group: "lunar" | "central" | "nonthai" | "moving") => read.rows.reduce((sum, row) => sum + row[`${group}_t`], 0);
  assert.deepEqual([ages("m", 0), ages("f", 0)], [22363, 23999]);
  assert.deepEqual([ages("m", 60), ages("f", 60)], [5896, 7591]);
  assert.deepEqual(
    { nonthai: groupTotal("nonthai"), central: groupTotal("central"), moving: groupTotal("moving"), lunar: groupTotal("lunar") },
    { nonthai: 81, central: 75, moving: 9, lunar: 0 },
  );
  // ตำบลบ้านกลาง of 5406: the last 15 values of its line.
  const banKlang = read.rows[1];
  assert.deepEqual(
    [banKlang.lunar_m, banKlang.lunar_f, banKlang.lunar_t, banKlang.central_m, banKlang.central_f, banKlang.central_t,
      banKlang.nonthai_m, banKlang.nonthai_f, banKlang.nonthai_t, banKlang.moving_m, banKlang.moving_f, banKlang.moving_t,
      banKlang.total_m, banKlang.total_f, banKlang.total_t],
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

// Why readRegistryFiles refuses the age file (text, named name), picked with stat_t68.txt.
function ageRefusal(text: string, name = "6812cc54.txt"): string {
  const [read] = readRegistryFiles([{ name, text }, { name: "stat_t68.txt", text: STAT_T68 }], "5406");
  assert.ok(!read.ok, "the age file was read");
  return read.reason;
}

test("6812cc54.txt without a stat_t of 2568 that passed (picked alone, with stat_t67.txt, or with a stat_t68.txt that was refused) → refused: an age file needs the stat_t of its year in the same pick", () => {
  const stat67 = fileOf(STAT_T68_LINES.map((line) => line.replace(/^6812\|/, "6712|")));
  const stat68Refused = fileOf(STAT_T68_LINES.filter((line) => !line.includes("|54060800|")));
  const reasons = [
    readRegistryFiles([{ name: "6812cc54.txt", text: AGE_6812 }], "5406"),
    readRegistryFiles([{ name: "6812cc54.txt", text: AGE_6812 }, { name: "stat_t67.txt", text: stat67 }], "5406"),
    readRegistryFiles([{ name: "6812cc54.txt", text: AGE_6812 }, { name: "stat_t68.txt", text: stat68Refused }], "5406"),
  ].map(([read]) => (read.ok ? "read" : read.reason));

  const reason = "ไม่มีไฟล์ stat_t68.txt ที่ผ่านการตรวจในชุดที่เลือก ไฟล์อายุต้องเลือกพร้อม stat_t ของปีเดียวกัน";
  assert.deepEqual(reasons, [reason, reason, reason]);
});

test("an age file named 6811cc54.txt (November) → refused: not the figures at 31 ธ.ค.", () => {
  assert.equal(ageRefusal(AGE_6812, "6811cc54.txt"), "ปีเดือนในชื่อไฟล์คือ 6811 ไม่ใช่เดือน 12 (ยอด ณ 31 ธ.ค.)");
});

test("6812cc53.txt, the age file of another จังหวัด (53) → refused: อำเภอ 5406 is in จังหวัด 54", () => {
  assert.equal(ageRefusal(AGE_6812, "6812cc53.txt"), "ชื่อไฟล์เป็นของจังหวัด 53 ไม่ใช่จังหวัด 54 ของอำเภอ 5406");
});

test("6812cc54 (1).txt, a second download the browser renamed → read like 6812cc54.txt", () => {
  const [read] = readRegistryFiles([{ name: "6812cc54 (1).txt", text: AGE_6812 }, { name: "stat_t68.txt", text: STAT_T68 }], "5406");

  assert.ok(read.ok && read.kind === "age", read.ok ? `read as ${read.kind}` : read.reason);
  assert.equal(read.yymm, "6812");
  assert.equal(read.rows.length, 10);
});

test("two age files of 6812 with stat_t68.txt in one pick → the first is read, the second refused, so each year's age rows are saved once", () => {
  const reads = readRegistryFiles([...PICK_6812, { name: "6812cc54 (1).txt", text: AGE_6812 }], "5406");

  assert.deepEqual(reads.map((r) => r.ok), [true, true, false]);
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

test("ตำบลบ้านหนุน of อำเภอสอง with one more boy aged 0, ชาย 2,137 รวม 4,537 → refused: not the 2,136 of stat_t68.txt", () => {
  const changed = changeAgeLine(SONG_BAN_NUN, (v) => plusOne(v, M0, TOTAL_M, TOTAL_T));

  assert.equal(ageRefusal(fileOf(changed)), "ยอดของ ตำบลบ้านหนุน ในบล็อก อำเภอสอง ไม่ตรงกับ stat_t68.txt: ชาย 2,137 แต่ stat_t 2,136");
});

test("the line of อำเภอสอง with รวม 40,390 → refused: not the total line of สำนักทะเบียน 5406 in stat_t68.txt (40,389)", () => {
  const changed = changeAgeLine(SONG, (v) => plusOne(v, TOTAL_T));

  assert.equal(
    ageRefusal(fileOf(changed)),
    "ยอดของบล็อก อำเภอสอง ไม่ตรงกับบรรทัดยอดรวมของสำนักทะเบียน 5406 ใน stat_t68.txt: รวม 40,390 แต่ stat_t 40,389",
  );
});

test("ทะเบียนบ้านกลาง of ตำบลบ้านกลาง (อำเภอสอง) with รวม 63 for ชาย 50 + หญิง 12 → refused: ชาย + หญิง = รวม in each group of stat.bora's file", () => {
  const changed = changeAgeLine(SONG_BAN_KLANG, (v) => plusOne(v, CENTRAL_T));

  assert.equal(ageRefusal(fileOf(changed)), "ตำบลบ้านกลาง ในบล็อก อำเภอสอง: ทะเบียนบ้านกลาง ชาย 50 + หญิง 12 ไม่เท่ารวม 63");
});

test("ตำบลบ้านหนุน of อำเภอสอง with one more boy aged 0 but ชาย 2,136 as in stat_t → refused: its ages and ประชากรที่ไม่แยกอายุ add up to 2,137", () => {
  const changed = changeAgeLine(SONG_BAN_NUN, (v) => plusOne(v, M0));

  assert.equal(
    ageRefusal(fileOf(changed)),
    "ตำบลบ้านหนุน ในบล็อก อำเภอสอง: จำนวนรายปีอายุของชายรวมกับประชากรที่ไม่แยกอายุได้ 2,137 ไม่เท่ายอดรวม 2,136",
  );
});
