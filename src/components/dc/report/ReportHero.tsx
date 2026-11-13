import type { ReactNode } from "react";

/**
 * The hero of a report page (SPEC §9.4, §9.4.1): badges (an HDC report's
 * source_table; none for รายงานประชากร), the หัวข้อ, the report's name, and a
 * line naming the กลุ่ม, if any, and where the data comes from (credit, such
 * as "ข้อมูลจาก HDC Open Data").
 */
export default function ReportHero(props: {
  badges?: ReactNode;
  topic: string;
  title: string;
  subgroup?: string;
  credit: string;
}) {
  const { badges, topic, title, subgroup, credit } = props;
  return (
    <header className="mb-4 rounded-[10px] border border-l-4 border-dc-border-subtle border-l-dc-brand-accent bg-white px-4 py-5 sm:px-7 sm:py-6">
      {badges && <div className="mb-3 flex flex-wrap items-center gap-2">{badges}</div>}
      <p className="mb-1.5 text-xs font-bold text-dc-brand-primary">{topic}</p>
      <h1 className="font-prompt text-[22px] font-semibold leading-snug text-dc-brand-deep sm:text-[28px]">{title}</h1>
      <p className="mt-3 border-t border-dc-border-subtle pt-3 text-xs text-dc-text-secondary">
        {subgroup && `${subgroup} · `}
        {`อำเภอสอง จังหวัดแพร่ · ${credit}`}
      </p>
    </header>
  );
}
