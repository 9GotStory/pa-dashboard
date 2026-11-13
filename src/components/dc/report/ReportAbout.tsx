import { Fragment, type ReactNode } from "react";

/**
 * เกี่ยวกับรายงานนี้ (SPEC §9.4, §9.4.1): แหล่งข้อมูล as term and detail rows,
 * วิธีคำนวณ, and ข้อจำกัด as the report's <li> items. What each holds is the
 * report's: an HDC report names its source table and links HDC.
 */
export default function ReportAbout(props: {
  sourceRows: { term: string; detail: ReactNode }[];
  method: ReactNode;
  limits: ReactNode;
}) {
  const { sourceRows, method, limits } = props;
  return (
    <section
      aria-labelledby="about-title"
      className="border-t border-dc-border-subtle bg-dc-canvas/60 px-4 py-5 sm:px-6"
    >
      <h2 id="about-title" className="font-prompt text-[15px] font-semibold text-dc-brand-deep">
        เกี่ยวกับรายงานนี้
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-dc-border-subtle bg-white p-4">
          <h3 className="font-prompt text-[13px] font-semibold text-dc-brand-deep">แหล่งข้อมูล</h3>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
            {sourceRows.map((s) => (
              <Fragment key={s.term}>
                <dt className="text-dc-text-secondary">{s.term}</dt>
                <dd>{s.detail}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
        <div className="min-w-0 rounded-lg border border-dc-border-subtle bg-white p-4 text-xs leading-relaxed">
          <h3 className="mb-1 font-prompt text-[13px] font-semibold text-dc-brand-deep">วิธีคำนวณ</h3>
          <div className="mb-3">{method}</div>
          <h3 className="font-prompt text-[13px] font-semibold text-dc-brand-deep">ข้อจำกัด</h3>
          <ul className="mt-1 list-disc pl-4">{limits}</ul>
        </div>
      </div>
    </section>
  );
}
