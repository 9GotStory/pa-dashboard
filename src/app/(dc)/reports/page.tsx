import type { Metadata } from "next";
import ReportLibrary from "@/components/dc/ReportLibrary";
import ReportsHero from "@/components/dc/ReportsHero";
import { readCatalog } from "@/lib/dc/snapshot";

export const metadata: Metadata = { title: "รายงานสุขภาพ | Song Health Data Center" };

// รายงานสุขภาพ (SPEC §9.3): catalog.json is read at build time and handed to
// the client component, which picks, searches and pages its reports by the
// URL's query in the browser.
export default function ReportsPage() {
  const { mains } = readCatalog();
  return (
    <>
      <ReportsHero />
      <ReportLibrary mains={mains} />
    </>
  );
}
