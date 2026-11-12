import type { ReactNode } from "react";

/** A line in place of the results: loading, a failed load, or why there is nothing to show */
export default function ReportStatus({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="px-4 py-12 text-center text-dc-text-secondary sm:px-6">
      {children}
    </p>
  );
}

/** A year the report has no block ปี for, or none at all yet: never zeros for what is not there (SPEC §9.4) */
export function NoYear({ year }: { year: string }) {
  return <ReportStatus>{year ? `ไม่มีข้อมูลปี ${year} ในระบบ` : "ยังไม่มีข้อมูลของรายงานนี้ในระบบ"}</ReportStatus>;
}
