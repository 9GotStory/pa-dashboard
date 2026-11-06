import { formatCount } from "./format";
import type { PopulationTotals, RegistryFileRead, RegistryPopulationRow } from "./types";

// ประชากรทะเบียนราษฎร (SCHEMA §11, ADR-0011): reading and checking the files
// the admin downloads from stat.bora, in the /sync upload (SCHEMA §11.2).
// Pure functions: no React, no DOM, no fetch (CODING_STANDARDS §4).

/** The พ.ศ. year whose 31 Dec a yymm counts: "6812" → "2568" */
export function registryYear(yymm: string): string {
  return `25${yymm.slice(0, 2)}`;
}

/** ชาย หญิง รวม and บ้าน of rows added up */
export function populationTotals(rows: RegistryPopulationRow[]): PopulationTotals {
  return rows.reduce(
    (sum, r) => ({ male: sum.male + r.male, female: sum.female + r.female, total: sum.total + r.total, house: sum.house + r.house }),
    { male: 0, female: 0, total: 0, house: 0 },
  );
}

// stat_t{yy}.txt, also as a browser names a second download: stat_t68 (1).txt
const STAT_T_NAME = /stat_t\d{2}/;

/**
 * The files the admin picked, in the order given, each read and checked on
 * its own (SCHEMA §11.2). A file of a yymm that an earlier file already gave
 * is refused, so each year is saved once.
 */
export function readRegistryFiles(files: { name: string; text: string }[], districtCode: string): RegistryFileRead[] {
  const firstFile = new Map<string, string>(); // yymm → the file read for it
  return files.map(({ name, text }): RegistryFileRead => {
    if (!STAT_T_NAME.test(name)) return { name, ok: false, reason: "ไม่ใช่ไฟล์ stat_t{ปี}.txt ของ stat.bora" };
    const read = readStatT(name, text, districtCode);
    if (!read.ok) return read;
    const first = firstFile.get(read.yymm);
    if (first !== undefined) return { name, ok: false, reason: `ปี ${registryYear(read.yymm)} ซ้ำกับไฟล์ ${first} ที่เลือกไว้` };
    firstFile.set(read.yymm, name);
    return read;
  });
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
 * district's ตำบล lines as rows of registry_population (SCHEMA §2.6), or the
 * first rule it breaks, in Thai.
 */
function readStatT(name: string, text: string, districtCode: string): RegistryFileRead {
  const refuse = (reason: string): RegistryFileRead => ({ name, ok: false, reason });
  const lines = text.replace(/^\uFEFF/, "").split("\n");
  if (lines.at(-1) === "") lines.pop();

  // 1. 13 values a line (the | that closes it dropped), the counts readable.
  // Each line is then a row of registry_population, text trimmed.
  const fileRows: RegistryPopulationRow[] = [];
  for (const [i, line] of lines.entries()) {
    const values = line.replace(/\|$/, "").split("|").map((s) => s.trim());
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
  for (const rcode of new Set(districtRows.map((r) => r.rcode))) {
    const name = districtRows.find((r) => r.rcode === rcode)!.rcode_name;
    const total = fileRows.find((r) => r.rcode === rcode && r.tt === "0");
    if (!total) return refuse(`ไม่มีบรรทัดยอดรวมของสำนักทะเบียน ${rcode} ${name}`);
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
  return { name, ok: true, yymm: fileRows[0].yymm, rows: districtRows };
}
