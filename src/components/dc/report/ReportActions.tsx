"use client";

import { useEffect, useRef, useState } from "react";
import type { reportCsv } from "@/lib/dc/csv";
import { PressButton } from "../Press";

// How long ดาวน์โหลด CSV says ดาวน์โหลดแล้ว, in ms (SPEC §9.1 "การบอกสถานะ", F91)
const DONE_MS = 2000;

/**
 * ดาวน์โหลด CSV and พิมพ์รายงาน (SPEC §9.4). csv builds the file of what is
 * shown with reportCsv when asked; null when nothing is shown, which disables
 * the download. After a download the button says ดาวน์โหลดแล้ว for 2 s, and
 * a live region says it to a screen reader (F91).
 */
export default function ReportActions({ csv }: { csv: (() => ReturnType<typeof reportCsv>) | null }) {
  const [done, setDone] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const download = () => {
    if (!csv) return;
    const { name, text } = csv();
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), DONE_MS);
  };
  return (
    <div className="flex gap-2 print:hidden">
      <PressButton
        type="button"
        onClick={download}
        disabled={!csv}
        className="min-h-11 flex-1 rounded-md border border-dc-border-subtle bg-white px-3 text-xs font-semibold text-dc-brand-deep transition-colors enabled:hover:bg-dc-highlight-soft disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
      >
        {/* Both labels in one cell, so the button is as wide as the longer one whichever shows */}
        <span className="grid">
          <span className={done ? "invisible col-start-1 row-start-1" : "col-start-1 row-start-1"}>ดาวน์โหลด CSV</span>
          <span className={done ? "col-start-1 row-start-1" : "invisible col-start-1 row-start-1"}>ดาวน์โหลดแล้ว</span>
        </span>
      </PressButton>
      <span role="status" className="sr-only">
        {done ? "ดาวน์โหลดแล้ว" : ""}
      </span>
      <PressButton
        type="button"
        onClick={() => window.print()}
        className="min-h-11 flex-1 rounded-md border border-dc-border-subtle bg-white px-3 text-xs font-semibold text-dc-brand-deep transition-colors hover:bg-dc-highlight-soft sm:flex-none"
      >
        พิมพ์รายงาน
      </PressButton>
    </div>
  );
}
