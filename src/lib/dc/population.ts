import { formatCount } from "./format";
import type { PopulationTotals, RegistryPopulationRow } from "./types";

// ประชากรทะเบียนราษฎร (SCHEMA §11, ADR-0011): reading and checking the files
// the admin downloads from stat.bora, in the /sync upload (SCHEMA §11.2).
// Pure functions: no React, no DOM, no fetch (CODING_STANDARDS §4).

type StatTRead = { ok: true; yymm: string; rows: RegistryPopulationRow[] } | { ok: false; reason: string };

/** A file the admin picked, read and checked (SCHEMA §11.2): the district's rows, or why the file is refused */
export type RegistryFileRead = { name: string } & StatTRead;

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
    const read = readStatT(text, districtCode);
    if (!read.ok) return { name, ...read };
    const first = firstFile.get(read.yymm);
    if (first !== undefined) return { name, ok: false, reason: `ปี ${registryYear(read.yymm)} ซ้ำกับไฟล์ ${first} ที่เลือกไว้` };
    firstFile.set(read.yymm, name);
    return { name, ...read };
  });
}

// A count as stat_t writes it: digits, grouped by commas.
const COUNT = /^\d+(,\d{3})*$/;
// The 4 counts of a stat_t line (values 9–12) as the refusals name them.
const COUNT_LABELS = ["ชาย", "หญิง", "รวม", "บ้าน"];

function count(value: string): number {
  return Number(value.replace(/,/g, ""));
}

/**
 * One stat_t file by the rules of SCHEMA §11.2, in their order: the
 * district's ตำบล lines as rows of registry_population (SCHEMA §2.6), or the
 * first rule it breaks, in Thai.
 */
function readStatT(text: string, districtCode: string): StatTRead {
  const refuse = (reason: string): StatTRead => ({ ok: false, reason });
  const lines = text.replace(/^﻿/, "").split("\n");
  if (lines.at(-1) === "") lines.pop();

  // 1. 13 values a line (the | that closes it dropped), the counts readable.
  const values: string[][] = [];
  for (const [i, line] of lines.entries()) {
    const v = line.replace(/\|$/, "").split("|").map((s) => s.trim());
    if (v.length !== 13) return refuse(`บรรทัดที่ ${i + 1} มี ${v.length} ค่า ไฟล์ stat_t มีบรรทัดละ 13 ค่า`);
    const bad = v.slice(9).find((s) => !COUNT.test(s));
    if (bad !== undefined) return refuse(`บรรทัดที่ ${i + 1} มีค่าที่ไม่ใช่ตัวเลข: ${bad}`);
    values.push(v);
  }

  // 2. One yymm, of December: the figures at 31 Dec.
  const other = values.findIndex((v) => v[0] !== values[0][0]);
  if (other > -1) {
    return refuse(`ปีเดือนไม่เท่ากันทั้งไฟล์: บรรทัดที่ 1 เป็น ${values[0][0]} แต่บรรทัดที่ ${other + 1} เป็น ${values[other][0]}`);
  }
  if (values.length > 0 && !/^\d{2}12$/.test(values[0][0])) {
    return refuse(`ปีเดือนในไฟล์คือ ${values[0][0]} ไม่ใช่เดือน 12 (ยอด ณ 31 ธ.ค.)`);
  }

  // 3. ตำบล lines of the district. A ตำบล line has a CCAATT code and is not a
  // หมู่บ้าน line; a สำนักทะเบียน's total line has CCAATT 0.
  const isTambon = (v: string[]) => v[5] !== "0" && v[7] === "0";
  const district = values.filter((v) => isTambon(v) && v[5].startsWith(districtCode));
  if (district.length === 0) return refuse(`ไม่มีบรรทัดตำบลของอำเภอ ${districtCode} ในไฟล์`);

  // 4. Every สำนักทะเบียน of those lines: all its ตำบล lines in the file add
  // up to its total line. A สำนักทะเบียน is not the district (5489, the
  // เทศบาล, covers part of 5406's ตำบล), so it is found from the lines.
  for (const rcode of new Set(district.map((v) => v[3]))) {
    const name = district.find((v) => v[3] === rcode)![4];
    const total = values.find((v) => v[3] === rcode && v[5] === "0");
    if (!total) return refuse(`ไม่มีบรรทัดยอดรวมของสำนักทะเบียน ${rcode} ${name}`);
    const tambons = values.filter((v) => v[3] === rcode && isTambon(v));
    for (const [k, label] of COUNT_LABELS.entries()) {
      const sum = tambons.reduce((s, v) => s + count(v[9 + k]), 0);
      if (sum !== count(total[9 + k])) {
        return refuse(
          `ผลรวมบรรทัดตำบลของสำนักทะเบียน ${rcode} ${name} ไม่เท่าบรรทัดยอดรวม: ${label} ${formatCount(sum)} แต่บรรทัดยอดรวม ${formatCount(count(total[9 + k]))}`,
        );
      }
    }
  }

  // 5. The district's ตำบล lines are the rows.
  const rows = district.map((v) => ({
    yymm: v[0],
    cc: v[1],
    cc_name: v[2],
    rcode: v[3],
    rcode_name: v[4],
    tt: v[5],
    tt_name: v[6],
    mm: v[7],
    mm_name: v[8],
    male: count(v[9]),
    female: count(v[10]),
    total: count(v[11]),
    house: count(v[12]),
  }));
  return { ok: true, yymm: values[0][0], rows };
}
