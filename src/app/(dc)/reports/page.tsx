import type { Metadata } from "next";
import ReportLibrary from "@/components/dc/ReportLibrary";
import { readCatalog } from "@/lib/dc/snapshot";

export const metadata: Metadata = { title: "คลังรายงาน | Song Health Data Center" };

// The report library (SPEC §9.3): catalog.json is read at build time and
// handed to the client component, which picks, searches and pages its
// reports by the URL's query in the browser.
export default function ReportsPage() {
  const { mains } = readCatalog();
  return (
    <>
      <h1 className="font-prompt text-2xl font-bold text-dc-navy">คลังรายงาน</h1>
      <p className="mt-1 text-dc-muted">ค้นหาและเลือกรายงานสถิติสาธารณสุขอำเภอสอง จังหวัดแพร่</p>
      <ReportLibrary mains={mains} />
    </>
  );
}
