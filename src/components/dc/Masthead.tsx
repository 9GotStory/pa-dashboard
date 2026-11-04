import Link from "next/link";
import MainNav from "./MainNav";

// Masthead and main menu of the Data Center pages, after R6 (SPEC §9.1). A
// printed page keeps the name and drops the menu, as R6 prints.
export default function Masthead() {
  return (
    <>
      <div className="border-b border-dc-border bg-dc-blue-light text-xs text-dc-ink print:hidden">
        <p className="mx-auto max-w-7xl px-4 py-1.5 sm:px-7">
          ระบบสารสนเทศรายงานสาธารณสุขระดับพื้นที่ <strong className="font-semibold whitespace-nowrap">อำเภอสอง จังหวัดแพร่</strong>
        </p>
      </div>
      <header className="border-t-4 border-dc-teal bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-7 sm:py-5">
          <Link href="/" className="flex min-w-0 items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-[11px] bg-dc-blue-dark font-prompt text-xl font-bold text-white shadow-[inset_0_-3px_0_var(--color-dc-teal-light)] sm:size-12"
            >
              S<span className="text-[15px]">+</span>
            </span>
            <span className="min-w-0">
              <strong className="block font-prompt text-lg font-semibold leading-snug text-dc-navy sm:text-xl">
                Song Health Data Center
              </strong>
              <small className="mt-0.5 block text-[11px] text-dc-muted sm:text-xs">ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่</small>
            </span>
          </Link>
          <p className="hidden text-right text-xs text-dc-muted md:block">
            ระบบรายงานสถิติและตัวชี้วัด
            <strong className="block text-[13px] font-semibold text-dc-navy">District Health Information Portal</strong>
          </p>
        </div>
      </header>
      <nav aria-label="เมนูหลัก" className="bg-dc-navy print:hidden">
        <div className="mx-auto flex max-w-7xl justify-between gap-4 sm:px-7">
          <MainNav />
          <span className="hidden items-center text-xs text-dc-blue-light md:flex">อำเภอสอง · จังหวัดแพร่</span>
        </div>
      </nav>
    </>
  );
}
