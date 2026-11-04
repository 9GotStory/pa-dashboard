"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/reports", label: "คลังรายงาน" },
  // PA is a heavy page outside the Data Center: no prefetch from every page.
  { href: "/pa", label: "PA Dashboard", prefetch: false },
];

// The main menu marks the section on show; /reports/{id} is in คลังรายงาน.
// A client component because the (dc) layout, and so the menu, stays mounted
// across navigations while the pathname changes.
export default function MainNav() {
  const pathname = usePathname();
  return (
    <div className="flex w-full justify-between sm:w-auto sm:justify-start">
      {LINKS.map(({ href, label, prefetch }) => {
        const inSection = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            prefetch={prefetch}
            aria-current={inSection ? (pathname === href ? "page" : "true") : undefined}
            className={`flex min-h-11 items-center px-3 text-xs sm:px-5 sm:text-[13.5px] ${
              inSection
                ? "bg-dc-navy-dark font-semibold text-white shadow-[inset_0_-4px_0_var(--color-dc-teal-light)]"
                : "text-dc-green-light hover:bg-dc-navy-dark hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
