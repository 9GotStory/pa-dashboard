"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// After a client-side page change, moves focus to the new page's <h1>, as R6
// does on every change of view (CODING_STANDARDS §4): a keyboard or screen
// reader user starts at the new content, not on the link just used. A full
// page load leaves focus to the browser.
export default function HeadingFocus() {
  const pathname = usePathname();
  const shown = useRef(pathname);
  useEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    const heading = document.querySelector<HTMLElement>("main h1");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
