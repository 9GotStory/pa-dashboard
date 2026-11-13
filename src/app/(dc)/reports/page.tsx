import type { Metadata } from "next";
import ReportLibrary from "@/components/dc/ReportLibrary";
import ReportsHero from "@/components/dc/ReportsHero";
import { readCatalog, readPopulationReport } from "@/lib/dc/snapshot";
import { libraryMains } from "@/lib/dc/values";

export const metadata: Metadata = { title: "รายงานสุขภาพ | Song Health Data Center" };

// รายงานสุขภาพ (SPEC §9.3): catalog.json, with รายงานประชากร first (SPEC
// §5.6), is read at build time and handed to the client component. Its static
// HTML lists every report; in the browser it picks and searches them by the
// URL's query.
export default function ReportsPage() {
  const mains = libraryMains(readCatalog().mains, readPopulationReport().years.length > 0);
  return (
    <>
      <ReportsHero />
      <ReportLibrary mains={mains} />
    </>
  );
}
