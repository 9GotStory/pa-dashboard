"use client";

import type { reportCsv } from "@/lib/dc/csv";

/**
 * ดาวน์โหลด CSV and พิมพ์รายงาน (SPEC §9.4). csv builds the file of what is
 * shown with reportCsv when asked; null when nothing is shown, which disables
 * the download.
 */
export default function ReportActions({ csv }: { csv: (() => ReturnType<typeof reportCsv>) | null }) {
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
  };
  return (
    <div className="flex gap-2 print:hidden">
      <button
        type="button"
        onClick={download}
        disabled={!csv}
        className="min-h-10 flex-1 rounded-md border border-dc-border-subtle bg-white px-3 text-xs font-semibold text-dc-brand-deep hover:bg-dc-highlight-soft disabled:opacity-50 sm:flex-none"
      >
        ดาวน์โหลด CSV
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="min-h-10 flex-1 rounded-md border border-dc-border-subtle bg-white px-3 text-xs font-semibold text-dc-brand-deep hover:bg-dc-highlight-soft sm:flex-none"
      >
        พิมพ์รายงาน
      </button>
    </div>
  );
}
