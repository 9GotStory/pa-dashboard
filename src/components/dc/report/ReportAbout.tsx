import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

type Row = { term: string; detail: ReactNode };

/** Term and detail rows */
function TermRows({ rows }: { rows: Row[] }) {
  return (
    <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
      {rows.map((s) => (
        <Fragment key={s.term}>
          <dt className="text-dc-text-secondary">{s.term}</dt>
          <dd>{s.detail}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * เกี่ยวกับรายงานนี้ (SPEC §9.4, §9.4.1): แหล่งข้อมูล always shown, then
 * วิธีคำนวณ, ข้อจำกัด (the report's <li> items) and รหัสอ้างอิง, if any, folded
 * in a <details> (F88): the keyboard, the expanded state for a screen reader
 * and opening without JavaScript are the browser's, and print shows it open.
 * What each holds is the report's: an HDC report links HDC and names its
 * source table among refRows.
 */
export default function ReportAbout(props: {
  sourceRows: Row[];
  method: ReactNode;
  limits: ReactNode;
  refRows?: Row[];
}) {
  const { sourceRows, method, limits, refRows } = props;
  return (
    <section
      aria-labelledby="about-title"
      className="border-t border-dc-border-subtle bg-dc-canvas/60 px-4 py-5 sm:px-6"
    >
      <h2 id="about-title" className="font-prompt text-[15px] font-semibold text-dc-brand-deep">
        เกี่ยวกับรายงานนี้
      </h2>
      <div className="mt-3 grid items-start gap-3 md:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-dc-border-subtle bg-white p-4">
          <h3 className="font-prompt text-[13px] font-semibold text-dc-brand-deep">แหล่งข้อมูล</h3>
          <TermRows rows={sourceRows} />
        </div>
        <details className="group min-w-0 rounded-lg border border-dc-border-subtle bg-white print:details-content:[content-visibility:visible]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-4 font-prompt text-[13px] font-semibold text-dc-brand-deep [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 group-open:rotate-90 print:hidden" />
            {refRows ? "วิธีคำนวณ ข้อจำกัด และรหัสอ้างอิง" : "วิธีคำนวณและข้อจำกัด"}
          </summary>
          <div className="border-t border-dc-border-subtle p-4 text-xs leading-relaxed">
            <h3 className="mb-1 font-prompt text-[13px] font-semibold text-dc-brand-deep">วิธีคำนวณ</h3>
            <div className="mb-3">{method}</div>
            <h3 className="font-prompt text-[13px] font-semibold text-dc-brand-deep">ข้อจำกัด</h3>
            <ul className="mt-1 list-disc pl-4">{limits}</ul>
            {refRows && (
              <>
                <h3 className="mt-3 font-prompt text-[13px] font-semibold text-dc-brand-deep">รหัสอ้างอิง</h3>
                <TermRows rows={refRows} />
              </>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
