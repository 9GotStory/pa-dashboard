import Link from "next/link";
import MainNav from "./MainNav";

// Masthead and main menu of the Data Center pages, after V7.6 (SPEC §9.1): one
// white bar stuck to the top, the menu on its own row under the name on a
// narrow screen. A printed page keeps the name and drops the menu, and the bar
// does not stick there.
export default function Masthead() {
  return (
    <header className="sticky top-0 z-30 border-b border-dc-border-subtle bg-white print:static">
      <div className="mx-auto flex max-w-330 flex-wrap items-center justify-between gap-x-5 px-4 sm:px-8">
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-3 py-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-dc-brand-primary font-prompt text-xl font-bold text-white"
          >
            S<span className="text-dc-highlight-soft">+</span>
          </span>
          <span className="min-w-0">
            <strong className="block font-prompt text-base leading-snug font-bold text-dc-brand-deep sm:text-lg">
              Song Health <span className="text-dc-brand-accent">Data Center</span>
            </strong>
            <small className="mt-0.5 block text-[11px] text-dc-text-secondary sm:text-xs">ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่</small>
          </span>
        </Link>
        <nav aria-label="เมนูหลัก" className="w-full border-t border-dc-border-subtle md:w-auto md:border-t-0 print:hidden">
          <MainNav />
        </nav>
      </div>
    </header>
  );
}
