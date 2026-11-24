"use client";

import { MoveHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The box of a table wider than a phone: it scrolls sideways inside its own
 * frame, never the page (SPEC §9.1), and is focusable, so a keyboard scrolls
 * it. While the table is wider than the box, ปัดตารางซ้ายหรือขวา shows under
 * it (F95): measured, not by a breakpoint, as the width a table needs varies
 * with its data and the column it sits in. hint places that line.
 */
export default function ScrollBox({
  label,
  className = "",
  hint,
  children,
}: {
  label: string;
  className?: string;
  hint: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = box.current!;
    // The box for a change of the page's width, the table for a change of its data
    const observer = new ResizeObserver(() => setScrolls(el.scrollWidth > el.clientWidth));
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div ref={box} role="region" tabIndex={0} aria-label={label} className={`overflow-x-auto ${className}`}>
        {children}
      </div>
      {scrolls && (
        <p className={`flex items-center gap-1.5 text-sm text-dc-text-secondary ${hint}`}>
          <MoveHorizontal aria-hidden="true" className="size-3.5 shrink-0" />
          ปัดตารางซ้ายหรือขวาเพื่อดูคอลัมน์อื่น
        </p>
      )}
    </>
  );
}
