import { formatCount } from "./format";
import type {
  AgeProfile,
  DcCatalog,
  HomePopulation,
  PopulationSnapshot,
  PopulationTotals,
  RegistryFileRead,
  RegistryPopulationAgeRow,
  RegistryPopulationRow,
  UnsplitGroup,
} from "./types";

// ประชากรทะเบียนราษฎร (SCHEMA §11, ADR-0011): reading and checking the files
// the admin downloads from stat.bora, in the /sync upload (SCHEMA §11.2), and
// the population part of the home page, at build time (SCHEMA §11.3).
// Pure functions: no React, no DOM, no fetch (CODING_STANDARDS §4).

/** The พ.ศ. year whose 31 Dec a yymm counts: "6812" → "2568" */
export function registryYear(yymm: string): string {
  return `25${yymm.slice(0, 2)}`;
}

/** The day a yymm's figures count to, as the home page shows it: "6812" → "ณ 31 ธ.ค. 2568" */
export function registryAsOf(yymm: string): string {
  return `ณ 31 ธ.ค. ${registryYear(yymm)}`;
}

/** ชาย หญิง รวม and บ้าน of rows added up */
export function populationTotals(rows: RegistryPopulationRow[]): PopulationTotals {
  return rows.reduce(
    (sum, r) => ({ male: sum.male + r.male, female: sum.female + r.female, total: sum.total + r.total, house: sum.house + r.house }),
    { male: 0, female: 0, total: 0, house: 0 },
  );
}

/** ชาย หญิง and รวม of age rows added up, from their total_m, total_f and total_t */
export function ageRowsTotals(rows: RegistryPopulationAgeRow[]): Omit<PopulationTotals, "house"> {
  return rows.reduce(
    (sum, r) => ({ male: sum.male + r.total_m, female: sum.female + r.total_f, total: sum.total + r.total_t }),
    { male: 0, female: 0, total: 0 },
  );
}

/**
 * The population part of the home page (SCHEMA §11.3), or null when
 * population.json has no year: the latest year, which every part of the page
 * shows, by ตำบล in code order and for the whole อำเภอ, each with its age
 * structure for the pyramid when that year has age rows. A ตำบล is named from
 * areas, or by its tt_name if areas lacks it.
 */
export function homePopulation(snapshot: PopulationSnapshot, areas: DcCatalog["areas"]): HomePopulation | null {
  const shown = snapshot.years.at(-1);
  if (!shown) return null;
  // A ตำบล is the first 6 digits of tt, across every สำนักทะเบียน: 5489, the
  // เทศบาล, covers part of 5406's บ้านหนุน and บ้านกลาง. So for age rows too.
  const tambonOf = (row: { tt: string }) => row.tt.slice(0, 6);
  const byTambon = new Map<string, RegistryPopulationRow[]>();
  for (const row of shown.population) {
    const key = tambonOf(row);
    byTambon.set(key, [...(byTambon.get(key) ?? []), row]);
  }
  const names = new Map(areas.map((a) => [a.id, a.name_th]));
  // No age rows in the year shown, so no pyramid anywhere.
  const hasAge = shown.age.length > 0;
  return {
    yymm: shown.yymm,
    district: { key: "all", name: "อำเภอสอง", totals: populationTotals(shown.population), age: hasAge ? ageProfile(shown.age) : null },
    areas: [...byTambon.keys()].sort().map((key) => {
      const rows = byTambon.get(key)!;
      const age = hasAge ? ageProfile(shown.age.filter((r) => tambonOf(r) === key)) : null;
      return { key, name: names.get(key) ?? rows[0].tt_name, totals: populationTotals(rows), age };
    }),
  };
}

// The ช่วงอายุ of the pyramid (SCHEMA §11.3): 5 years each from 0–4 to
// 75–79, then 80+, which takes the ages 80 to 101 and so the over-100s.
const BAND_LABELS = [...Array.from({ length: 16 }, (_, k) => `${k * 5}–${k * 5 + 4}`), "80+"];

/** The age structure of an area from its age rows (SCHEMA §11.3), every สำนักทะเบียน added up */
function ageProfile(rows: RegistryPopulationAgeRow[]): AgeProfile {
  const bands = BAND_LABELS.map((label) => ({ label, male: 0, female: 0 }));
  let aged60 = 0;
  for (const row of rows) {
    for (let age = 0; age <= 101; age++) {
      const band = bands[Math.min(Math.floor(age / 5), bands.length - 1)];
      band.male += row[`m${age}`];
      band.female += row[`f${age}`];
      if (age >= 60) aged60 += row[`m${age}`] + row[`f${age}`];
    }
  }
  const age_total = bands.reduce((sum, b) => sum + b.male + b.female, 0);
  // The ประชากรที่ไม่แยกอายุ by the file's own columns, which stat.bora's
  // formula (SCHEMA §11.1) makes add up to the total less age_total.
  const unsplit = Object.fromEntries(
    UNSPLIT_GROUPS.map((group) => [group, rows.reduce((sum, r) => sum + r[`${group}_t`], 0)]),
  ) as Record<UnsplitGroup, number>;
  return { bands, age_total, aged60, aged60_pct: (aged60 / age_total) * 100, unsplit };
}

// stat_t{yy}.txt, also as a browser names a second download: stat_t68 (1).txt
const STAT_T_NAME = /stat_t\d{2}/;
// The {yymm}cc{จังหวัด} of an age file's name, as in 6812cc54.txt or
// 6812cc54 (1).txt: the file itself has no year and no codes (SCHEMA §11.1).
const AGE_FILE_NAME = /(\d{2})(\d{2})cc(\d{2})/;

type Refused = Extract<RegistryFileRead, { ok: false }>;

/**
 * A stat_t file that passed, with the total line of each สำนักทะเบียน of its
 * rows: the age file of its yymm is checked against both (SCHEMA §11.2).
 */
interface CheckedStatT {
  read: Extract<RegistryFileRead, { kind: "population" }>;
  officeTotals: RegistryPopulationRow[];
}

/**
 * The files the admin picked, in the order given, each read and checked on
 * its own (SCHEMA §11.2), its kind told by its name. An age file is checked
 * against the stat_t of its yymm in the same pick, wherever that is in it. A
 * file of a yymm that an earlier file of its kind already gave is refused,
 * so each year is saved once.
 */
export function readRegistryFiles(files: { name: string; text: string }[], districtCode: string): RegistryFileRead[] {
  const duplicate = (name: string, yymm: string, first: string): Refused => ({
    name,
    ok: false,
    reason: `ปี ${registryYear(yymm)} ซ้ำกับไฟล์ ${first} ที่เลือกไว้`,
  });
  // Every stat_t first, as an age file may come before the stat_t of its year.
  const statTs = new Map<string, CheckedStatT>(); // yymm → the stat_t read for it
  const statTReads = files.map(({ name, text }): RegistryFileRead | null => {
    if (!STAT_T_NAME.test(name)) return null;
    const statT = readStatT(name, text, districtCode);
    if (!("read" in statT)) return statT;
    const first = statTs.get(statT.read.yymm);
    if (first) return duplicate(name, statT.read.yymm, first.read.name);
    statTs.set(statT.read.yymm, statT);
    return statT.read;
  });
  const ageFiles = new Map<string, string>(); // yymm → the age file read for it
  return files.map(({ name, text }, i): RegistryFileRead => {
    const statTRead = statTReads[i];
    if (statTRead) return statTRead;
    if (!AGE_FILE_NAME.test(name)) return { name, ok: false, reason: "ไม่ใช่ไฟล์ stat_t{ปี}.txt หรือ {ปี}12cc{จังหวัด}.txt ของ stat.bora" };
    const read = readAgeFile(name, text, districtCode, statTs);
    if (!read.ok) return read;
    const first = ageFiles.get(read.yymm);
    if (first !== undefined) return duplicate(name, read.yymm, first);
    ageFiles.set(read.yymm, name);
    return read;
  });
}

/**
 * The lines of a stat.bora file as their values, text trimmed (SCHEMA
 * §11.1): UTF-8 with a BOM, LF line ends, values split by | and one more |
 * closing each line.
 */
function fileValues(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line) => line.replace(/\|$/, "").split("|").map((s) => s.trim()));
}

// A count as stat_t writes it: digits, grouped by commas.
const COUNT_FORMAT = /^\d+(,\d{3})*$/;
// The 4 counts of a stat_t line as the refusals name them.
const COUNT_LABELS: [keyof PopulationTotals, string][] = [
  ["male", "ชาย"],
  ["female", "หญิง"],
  ["total", "รวม"],
  ["house", "บ้าน"],
];

function count(value: string): number {
  return Number(value.replace(/,/g, ""));
}

/**
 * One stat_t file by the rules of SCHEMA §11.2, in their order: the
 * district's ตำบล lines as rows of registry_population (SCHEMA §2.6), with
 * the total lines of their สำนักทะเบียน, or the first rule it breaks, in Thai.
 */
function readStatT(name: string, text: string, districtCode: string): CheckedStatT | Refused {
  const refuse = (reason: string): Refused => ({ name, ok: false, reason });

  // 1. 13 values a line, the counts readable. Each line is then a row of
  // registry_population.
  const fileRows: RegistryPopulationRow[] = [];
  for (const [i, values] of fileValues(text).entries()) {
    if (values.length !== 13) return refuse(`บรรทัดที่ ${i + 1} มี ${values.length} ค่า ไฟล์ stat_t มีบรรทัดละ 13 ค่า`);
    const bad = values.slice(9).find((s) => !COUNT_FORMAT.test(s));
    if (bad !== undefined) return refuse(`บรรทัดที่ ${i + 1} มีค่าที่ไม่ใช่ตัวเลข: ${bad}`);
    const [yymm, cc, cc_name, rcode, rcode_name, tt, tt_name, mm, mm_name, male, female, total, house] = values;
    fileRows.push({
      yymm, cc, cc_name, rcode, rcode_name, tt, tt_name, mm, mm_name,
      male: count(male), female: count(female), total: count(total), house: count(house),
    });
  }

  // 2. One yymm, of December: the figures at 31 Dec.
  const other = fileRows.findIndex((r) => r.yymm !== fileRows[0].yymm);
  if (other > -1) {
    return refuse(`ปีเดือนไม่เท่ากันทั้งไฟล์: บรรทัดที่ 1 เป็น ${fileRows[0].yymm} แต่บรรทัดที่ ${other + 1} เป็น ${fileRows[other].yymm}`);
  }
  if (fileRows.length > 0 && !/^\d{2}12$/.test(fileRows[0].yymm)) {
    return refuse(`ปีเดือนในไฟล์คือ ${fileRows[0].yymm} ไม่ใช่เดือน 12 (ยอด ณ 31 ธ.ค.)`);
  }

  // 3. ตำบล lines of the district. A ตำบล line has a CCAATT code and is not a
  // หมู่บ้าน line; a สำนักทะเบียน's total line has CCAATT 0.
  const isTambon = (r: RegistryPopulationRow) => r.tt !== "0" && r.mm === "0";
  const districtRows = fileRows.filter((r) => isTambon(r) && r.tt.startsWith(districtCode));
  if (districtRows.length === 0) return refuse(`ไม่มีบรรทัดตำบลของอำเภอ ${districtCode} ในไฟล์`);

  // 4. Every สำนักทะเบียน of those lines: all its ตำบล lines in the file add
  // up to its total line. A สำนักทะเบียน is not the district (5489, the
  // เทศบาล, covers part of 5406's ตำบล), so it is found from the lines.
  const officeTotals: RegistryPopulationRow[] = [];
  for (const rcode of new Set(districtRows.map((r) => r.rcode))) {
    const name = districtRows.find((r) => r.rcode === rcode)!.rcode_name;
    const total = fileRows.find((r) => r.rcode === rcode && r.tt === "0");
    if (!total) return refuse(`ไม่มีบรรทัดยอดรวมของสำนักทะเบียน ${rcode} ${name}`);
    officeTotals.push(total);
    const sum = populationTotals(fileRows.filter((r) => r.rcode === rcode && isTambon(r)));
    for (const [key, label] of COUNT_LABELS) {
      if (sum[key] !== total[key]) {
        return refuse(
          `ผลรวมบรรทัดตำบลของสำนักทะเบียน ${rcode} ${name} ไม่เท่าบรรทัดยอดรวม: ${label} ${formatCount(sum[key])} แต่บรรทัดยอดรวม ${formatCount(total[key])}`,
        );
      }
    }
  }

  // 5. The district's ตำบล lines are the rows.
  return { read: { name, ok: true, kind: "population", yymm: fileRows[0].yymm, rows: districtRows }, officeTotals };
}

// The 219 counts of an age file line after its name, in file order, as
// registry_population_age names them (SCHEMA §2.7): ชาย and หญิง by year of
// age 0 … 101 (101 = over 100), then each group of the ประชากรที่ไม่แยกอายุ
// and the total, each as ชาย หญิง รวม.
type AgeCount = Exclude<keyof RegistryPopulationAgeRow, "yymm" | "rcode" | "tt" | "tt_name">;
const UNSPLIT_GROUPS: UnsplitGroup[] = ["lunar", "central", "nonthai", "moving"];
const UNSPLIT_AND_TOTAL: (UnsplitGroup | "total")[] = [...UNSPLIT_GROUPS, "total"];
const AGE_COUNTS: AgeCount[] = [
  ...Array.from({ length: 102 }, (_, age): AgeCount[] => [`m${age}`, `f${age}`]).flat(),
  ...UNSPLIT_AND_TOTAL.flatMap((group): AgeCount[] => [`${group}_m`, `${group}_f`, `${group}_t`]),
];
// The groups as the refusals name them (SCHEMA §11.4).
const GROUP_LABELS: Record<UnsplitGroup | "total", string> = {
  lunar: "เกิดปีจันทรคติ",
  central: "ทะเบียนบ้านกลาง",
  nonthai: "ไม่ใช่สัญชาติไทย",
  moving: "ระหว่างการย้าย",
  total: "ยอดรวม",
};

// A count as the age file writes it: digits, without commas.
const AGE_COUNT_FORMAT = /^\d+$/;

/** A line of an age file: an area's name and its counts */
type AgeLine = { tt_name: string } & Record<AgeCount, number>;

// The totals an age line shares with a stat_t line, as the refusals name them.
const SHARED_TOTALS: [`total_${"m" | "f" | "t"}`, keyof PopulationTotals, string][] = [
  ["total_m", "male", "ชาย"],
  ["total_f", "female", "หญิง"],
  ["total_t", "total", "รวม"],
];

/** The first of ชาย หญิง รวม in which an age line differs from a stat_t line, worded for a refusal, or null */
function totalsDiffer(line: AgeLine, stat: RegistryPopulationRow): string | null {
  for (const [column, key, label] of SHARED_TOTALS) {
    if (line[column] !== stat[key]) return `${label} ${formatCount(line[column])} แต่ stat_t ${formatCount(stat[key])}`;
  }
  return null;
}

/** A block of an age file: the line of a สำนักทะเบียน (อำเภอ… or เทศบาล…) and the ตำบล lines after it */
interface AgeBlock {
  line: AgeLine;
  tambons: AgeLine[];
}

/**
 * One age file by the rules of SCHEMA §11.2, in their order, checked against
 * the stat_t of its yymm among statTs: a row of registry_population_age
 * (SCHEMA §2.7) for each row of that stat_t, or the first rule it breaks, in
 * Thai.
 */
function readAgeFile(name: string, text: string, districtCode: string, statTs: Map<string, CheckedStatT>): RegistryFileRead {
  const refuse = (reason: string): Refused => ({ name, ok: false, reason });

  // 1. The yymm and จังหวัด from the name, which readRegistryFiles has
  // matched: December, of the district's จังหวัด (its first 2 digits).
  const [, yy, mm, cc] = AGE_FILE_NAME.exec(name)!;
  const yymm = yy + mm;
  if (mm !== "12") return refuse(`ปีเดือนในชื่อไฟล์คือ ${yymm} ไม่ใช่เดือน 12 (ยอด ณ 31 ธ.ค.)`);
  const province = districtCode.slice(0, 2);
  if (cc !== province) return refuse(`ชื่อไฟล์เป็นของจังหวัด ${cc} ไม่ใช่จังหวัด ${province} ของอำเภอ ${districtCode}`);

  // 2. 220 values a line: the area's name, then 219 whole numbers.
  const lines: AgeLine[] = [];
  for (const [i, values] of fileValues(text).entries()) {
    if (values.length !== 220) return refuse(`บรรทัดที่ ${i + 1} มี ${values.length} ค่า ไฟล์อายุมีบรรทัดละ 220 ค่า`);
    const bad = values.slice(1).find((s) => !AGE_COUNT_FORMAT.test(s));
    if (bad !== undefined) return refuse(`บรรทัดที่ ${i + 1} มีค่าที่ไม่ใช่จำนวนเต็ม: ${bad}`);
    const counts = Object.fromEntries(AGE_COUNTS.map((column, k) => [column, Number(values[k + 1])])) as Record<AgeCount, number>;
    lines.push({ tt_name: values[0], ...counts });
  }

  // 3. A stat_t of its yymm that passed, in the same pick.
  const statT = statTs.get(yymm);
  if (!statT) return refuse(`ไม่มีไฟล์ stat_t${yy}.txt ที่ผ่านการตรวจในชุดที่เลือก ไฟล์อายุต้องเลือกพร้อม stat_t ของปีเดียวกัน`);

  // 4. The block of each สำนักทะเบียน of stat_t's rows, by name: "อำเภอสอง" is
  // its rcode_name, "เทศบาลตำบลสอง" is "ท้องถิ่นเทศบาลตำบลสอง" without
  // "ท้องถิ่น". Every line but a ตำบล line starts a block, the จังหวัด line
  // first, which no สำนักทะเบียน is named after.
  const blocks: AgeBlock[] = [];
  for (const line of lines) {
    if (line.tt_name.startsWith("ตำบล")) blocks.at(-1)?.tambons.push(line);
    else blocks.push({ line, tambons: [] });
  }
  const blockOf = new Map<string, AgeBlock>(); // rcode → its block
  for (const office of statT.officeTotals) {
    const blockName = office.rcode_name.replace(/^ท้องถิ่น/, "");
    const named = blocks.filter((b) => b.line.tt_name === blockName);
    if (named.length === 0) return refuse(`ไม่มีบล็อก ${blockName} ของสำนักทะเบียน ${office.rcode} ในไฟล์อายุ`);
    if (named.length > 1) return refuse(`มีบล็อก ${blockName} มากกว่าหนึ่งบล็อกในไฟล์อายุ`);
    blockOf.set(office.rcode, named[0]);
  }

  // 5. In that block, the one ตำบล line of each stat_t row, by name: a ตำบล
  // of the same name in another block (ตำบลน้ำชำ of เมืองแพร่ and of
  // สูงเม่น, ตำบลบ้านหนุน of อำเภอสอง and of เทศบาลตำบลสอง) is never taken.
  const pairs: { row: RegistryPopulationRow; block: AgeBlock; line: AgeLine }[] = [];
  for (const row of statT.read.rows) {
    const block = blockOf.get(row.rcode)!;
    const named = block.tambons.filter((l) => l.tt_name === row.tt_name);
    if (named.length === 0) return refuse(`ไม่มีบรรทัด ${row.tt_name} ในบล็อก ${block.line.tt_name}`);
    if (named.length > 1) return refuse(`มีบรรทัด ${row.tt_name} มากกว่าหนึ่งบรรทัดในบล็อก ${block.line.tt_name}`);
    pairs.push({ row, block, line: named[0] });
  }

  // 6. The ชาย หญิง รวม of stat_t: each ตำบล line's are its row's, and each
  // block line's are the total line's of its สำนักทะเบียน.
  for (const { row, block, line } of pairs) {
    const differ = totalsDiffer(line, row);
    if (differ) return refuse(`ยอดของ ${line.tt_name} ในบล็อก ${block.line.tt_name} ไม่ตรงกับ ${statT.read.name}: ${differ}`);
  }
  for (const office of statT.officeTotals) {
    const block = blockOf.get(office.rcode)!;
    const differ = totalsDiffer(block.line, office);
    if (differ) {
      return refuse(`ยอดของบล็อก ${block.line.tt_name} ไม่ตรงกับบรรทัดยอดรวมของสำนักทะเบียน ${office.rcode} ใน ${statT.read.name}: ${differ}`);
    }
  }

  // 7. stat.bora's formula (SCHEMA §11.1) on every ตำบล line: ชาย + หญิง =
  // รวม in each group, then for ชาย and for หญิง, the counts by year of age
  // and the ประชากรที่ไม่แยกอายุ add up to the total.
  for (const { block, line } of pairs) {
    for (const group of UNSPLIT_AND_TOTAL) {
      const [m, f, t] = [line[`${group}_m`], line[`${group}_f`], line[`${group}_t`]];
      if (m + f !== t) {
        return refuse(
          `${line.tt_name} ในบล็อก ${block.line.tt_name}: ${GROUP_LABELS[group]} ชาย ${formatCount(m)} + หญิง ${formatCount(f)} ไม่เท่ารวม ${formatCount(t)}`,
        );
      }
    }
  }
  for (const { block, line } of pairs) {
    for (const [sex, label] of [["m", "ชาย"], ["f", "หญิง"]] as const) {
      let sum = 0;
      for (let age = 0; age <= 101; age++) sum += line[`${sex}${age}`];
      for (const group of UNSPLIT_GROUPS) sum += line[`${group}_${sex}`];
      if (sum !== line[`total_${sex}`]) {
        return refuse(
          `${line.tt_name} ในบล็อก ${block.line.tt_name}: จำนวนรายปีอายุของ${label}รวมกับประชากรที่ไม่แยกอายุได้ ${formatCount(sum)} ไม่เท่ายอดรวม ${formatCount(line[`total_${sex}`])}`,
        );
      }
    }
  }

  // 8. The rows: yymm from the name, rcode and tt from stat_t, the rest as in the line.
  return { name, ok: true, kind: "age", yymm, rows: pairs.map(({ row, line }) => ({ yymm, rcode: row.rcode, tt: row.tt, ...line })) };
}
