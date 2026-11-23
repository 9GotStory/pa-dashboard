import type { ReactNode } from "react";

/**
 * A line in place of the results: loading, a failed load, or why there is
 * nothing to show. loading: กำลังโหลด… in a box a screen tall (SPEC §9.1
 * "การบอกสถานะ", F91). The results it stands for are taller than the
 * screen on a phone, and on most reports on a desktop, so the sections below
 * stay off the screen while they load and do not jump down when the data
 * comes.
 */
export default function ReportStatus({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  return (
    <p role="status" className={`${loading ? "min-h-svh " : ""}px-4 py-12 text-center text-dc-text-secondary sm:px-6`}>
      {children}
    </p>
  );
}

/** A year the report has no block ปี for, or none at all yet: never zeros for what is not there (SPEC §9.4) */
export function NoYear({ year }: { year: string }) {
  return <ReportStatus>{year ? `ไม่มีข้อมูลปี ${year} ในระบบ` : "ยังไม่มีข้อมูลของรายงานนี้ในระบบ"}</ReportStatus>;
}
