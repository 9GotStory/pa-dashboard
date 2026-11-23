import type { ReactNode } from "react";

/**
 * The hero of a report page (SPEC §9.4, §9.4.1): the report's status badge,
 * if any (HDC ไม่แสดงรายงานนี้แล้ว), the report's name, and a line naming
 * where the data comes from (credit, such as "ข้อมูลจาก HDC Open Data"). The
 * หมวด, หัวข้อ and กลุ่ม are the breadcrumb's alone (F88).
 */
export default function ReportHero(props: { badges?: ReactNode; title: string; credit: string }) {
  const { badges, title, credit } = props;
  return (
    <header className="mb-4 rounded-[10px] border border-l-4 border-dc-border-subtle border-l-dc-brand-accent bg-white px-4 py-5 sm:px-7 sm:py-6">
      {badges && <div className="mb-3 flex flex-wrap items-center gap-2">{badges}</div>}
      <h1 className="font-prompt text-[22px] font-semibold leading-snug text-dc-brand-deep sm:text-[28px]">{title}</h1>
      <p className="mt-3 border-t border-dc-border-subtle pt-3 text-xs text-dc-text-secondary">
        {`อำเภอสอง จังหวัดแพร่ · ${credit}`}
      </p>
    </header>
  );
}
