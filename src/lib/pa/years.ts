import type { PaSnapshot } from "./process";

// PA ปีที่ปิดแล้ว (GLOSSARY): data/pa-years/{ปี}.json, a copy of pa.json kept
// at the freeze of that year (SCHEMA §7), built as /pa/{ปี} (SPEC §4).

/** The year of a closed-year file, or an error naming the file when its name is not BATCH_ALL.meta.current_year */
export function closedYearOf(fileName: string, snapshot: Pick<PaSnapshot, "BATCH_ALL">): string {
  const year = snapshot.BATCH_ALL.meta?.current_year;
  if (!/^\d{4}$/.test(year ?? "") || fileName !== `${year}.json`)
    throw new Error(
      `data/pa-years/${fileName}: the name must be BATCH_ALL.meta.current_year (${year}).json (SCHEMA §7)`,
    );
  return year as string;
}

export interface PaYearLink {
  year: string;
  href: string;
}

/**
 * The year row at the PA header (SPEC §4): the current year to /pa, each closed
 * year to /pa/{ปี}, newest first. Empty unless a closed year other than the
 * current one exists: between the freeze and the switch of current_year the
 * current year has its own file, built as a page but left out of the row.
 */
export function paYearLinks(currentYear: string, closedYears: string[]): PaYearLink[] {
  const closed = closedYears.filter((year) => year !== currentYear);
  if (closed.length === 0) return [];
  return [
    { year: currentYear, href: "/pa" },
    ...closed.sort((a, b) => Number(b) - Number(a)).map((year) => ({ year, href: `/pa/${year}` })),
  ];
}
