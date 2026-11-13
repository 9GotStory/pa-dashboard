import type {
  AgeProfile,
  PopulationTotals,
  RegistryPopulationAgeRow,
  RegistryPopulationRow,
  UnsplitGroup,
} from "./types";

// ประชากรทะเบียนราษฎร and its age structure, added up the same way for the
// home page (SCHEMA §11.3) and รายงานประชากร (SCHEMA §11.5). Apart from
// population.ts, which holds the /sync file reader too, so that
// รายงานประชากร's JavaScript does not carry it (SPEC §9.5). Pure functions:
// no React, no DOM, no fetch (CODING_STANDARDS §4).

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

/** The kinds of ประชากรที่ไม่แยกอายุ, as the age file's columns name them (SCHEMA §2.7) */
export const UNSPLIT_GROUPS: UnsplitGroup[] = ["lunar", "central", "nonthai", "moving"];

// The ช่วงอายุ of the pyramid (SCHEMA §11.3): 5 years each from 0–4 to
// 75–79, then 80+, which takes the ages 80 to 101 and so the over-100s.
export const BAND_LABELS = [...Array.from({ length: 16 }, (_, k) => `${k * 5}–${k * 5 + 4}`), "80+"];

/** The age structure of an area from its age rows (SCHEMA §11.3), every สำนักทะเบียน added up */
export function ageProfile(rows: RegistryPopulationAgeRow[]): AgeProfile {
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
