import type { ReactNode, RefObject } from "react";
import { formatThaiDate } from "@/lib/dc/format";

/**
 * ผลรายงาน with the filters in one line and วันที่ข้อมูล (dateCom null: no
 * block ปี to date), and the actions (ReportActions) beside them. heading is
 * useReportQuery's, so แสดงผล moves focus here.
 */
export default function ResultsHeader(props: {
  heading: RefObject<HTMLHeadingElement | null>;
  summary: string;
  dateCom: string | null;
  children: ReactNode;
}) {
  const { heading, summary, dateCom, children } = props;
  return (
    <div className="flex flex-col gap-3 px-4 pt-5 pb-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
      <div>
        <h2 ref={heading} tabIndex={-1} className="font-prompt text-lg font-semibold text-dc-brand-deep">
          ผลรายงาน
        </h2>
        {/* Read out after แสดงผล, as R6 announces the new result */}
        <p aria-live="polite" className="text-xs text-dc-brand-deep">
          {summary}
        </p>
        {dateCom !== null && <p className="text-xs text-dc-text-secondary">วันที่ข้อมูล {formatThaiDate(dateCom)}</p>}
      </div>
      {children}
    </div>
  );
}
