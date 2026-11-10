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
    <div className="flex justify-between gap-1 md:justify-start">
      {LINKS.map(({ href, label, prefetch }) => {
        const inSection = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            prefetch={prefetch}
            aria-current={inSection ? (pathname === href ? "page" : "true") : undefined}
            className={`flex min-h-11 items-center border-b-2 px-2 text-[13px] sm:px-3 ${
              inSection
                ? "border-dc-brand-accent font-bold text-dc-brand-primary"
                : "border-transparent text-dc-text-secondary hover:text-dc-brand-primary"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
