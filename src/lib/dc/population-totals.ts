import type { PopulationTotals, RegistryPopulationRow } from "./types";

// ประชากรทะเบียนราษฎร added up the same way for the home page (SCHEMA §11.3)
// and รายงานประชากร (SCHEMA §11.5). Apart from population.ts, which holds the
// /sync file reader too, so that รายงานประชากร's JavaScript does not carry it
// (SPEC §9.5). Pure functions: no React, no DOM, no fetch (CODING_STANDARDS §4).

/** The พ.ศ. year whose 31 Dec a yymm counts: "6812" → "2568" */
export function registryYear(yymm: string): string {
  return `25${yymm.slice(0, 2)}`;
}

/** The day a ปีข้อมูล's figures count to: "2568" → "ณ 31 ธ.ค. 2568" */
export function yearAsOf(year: string): string {
  return `ณ 31 ธ.ค. ${year}`;
}

/** The day a yymm's figures count to, as the home page shows it: "6812" → "ณ 31 ธ.ค. 2568" */
export function registryAsOf(yymm: string): string {
  return yearAsOf(registryYear(yymm));
}

/** ชาย หญิง รวม and บ้าน of rows added up */
export function populationTotals(rows: RegistryPopulationRow[]): PopulationTotals {
  return rows.reduce(
    (sum, r) => ({
      male: sum.male + r.male,
      female: sum.female + r.female,
      total: sum.total + r.total,
      house: sum.house + r.house,
    }),
    { male: 0, female: 0, total: 0, house: 0 },
  );
}
