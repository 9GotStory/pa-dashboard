import { notFound } from "next/navigation";
import PaDashboard from "../PaDashboard";
import { processPaSnapshot } from "@/lib/pa/process";
import { readClosedPaYears, readPaSnapshot } from "@/lib/pa/snapshot";
import { paYearLinks } from "@/lib/pa/years";

// PA ปีที่ปิดแล้ว (SPEC §4, ADR-0017): one page per file of data/pa-years/,
// processed as /pa is, with no fetch to GAS. A year with no file is 404.
export const dynamicParams = false;

// With output: 'export', Next.js 16.4.3 fails the build when
// generateStaticParams returns no param, so no file builds the stand-in
// /pa/_ as the 404 page; postbuild (pa-years-postbuild.mjs) deletes it from
// out/ (SPEC §4).
const NO_YEAR = "_";

export function generateStaticParams() {
  const years = readClosedPaYears().map(({ year }) => ({ year }));
  return years.length > 0 ? years : [{ year: NO_YEAR }];
}

export default async function Page({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const closed = readClosedPaYears();
  const snapshot = closed.find((c) => c.year === year)?.snapshot;
  if (!snapshot) notFound();
  const years = paYearLinks(
    readPaSnapshot().BATCH_ALL.meta?.current_year ?? "",
    closed.map((c) => c.year),
  );
  return <PaDashboard initial={processPaSnapshot(snapshot)} years={years} closedYear={year} />;
}
