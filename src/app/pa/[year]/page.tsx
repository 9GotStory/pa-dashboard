import { notFound } from "next/navigation";
import PaDashboard from "../PaDashboard";
import { processPaSnapshot } from "@/lib/pa/process";
import { readClosedPaYears, readPaYearLinks } from "@/lib/pa/snapshot";

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
  const snapshot = readClosedPaYears().find((c) => c.year === year)?.snapshot;
  if (!snapshot) notFound();
  return <PaDashboard initial={processPaSnapshot(snapshot)} years={readPaYearLinks()} closedYear={year} />;
}
