"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { loadReport } from "@/lib/dc/client";
import type { DcReportData } from "@/lib/dc/types";
import ReportLoading from "./ReportLoading";
import ReportStatus from "./ReportStatus";

/**
 * Loads the report's /data/reports/{id}.json once and renders children with
 * it; until then กำลังโหลด, or ลองอีกครั้ง after a failed load. The Suspense
 * boundary is for the useSearchParams of the page inside (useReportQuery).
 * T is the file's shape, DcReportData unless the page says otherwise.
 */
export default function ReportLoader<T = DcReportData>({
  id,
  children,
}: {
  id: string;
  children: (data: T) => ReactNode;
}) {
  return (
    <Suspense fallback={<ReportLoading>กำลังโหลดข้อมูลรายงาน…</ReportLoading>}>
      <Load<T> id={id}>{children}</Load>
    </Suspense>
  );
}

function Load<T>({ id, children }: { id: string; children: (data: T) => ReactNode }) {
  const [load, setLoad] = useState<{ data: T } | "loading" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    loadReport<T>(id).then(
      (data) => {
        if (!ignore) setLoad({ data });
      },
      () => {
        if (!ignore) setLoad("failed");
      },
    );
    return () => {
      ignore = true;
    };
  }, [id, attempt]);

  if (load === "loading") return <ReportLoading>กำลังโหลดข้อมูลรายงาน…</ReportLoading>;
  if (load === "failed") {
    return (
      <ReportStatus>
        โหลดข้อมูลรายงานไม่สำเร็จ{" "}
        {/* In the sentence, so it changes colour when pressed and does not shrink, as a link in a sentence (F90),
            yet the one thing to press here: 24px high, 44px on a touch screen (F95) */}
        <button
          type="button"
          onClick={() => {
            setLoad("loading");
            setAttempt(attempt + 1);
          }}
          className="inline-flex min-h-6 items-center font-semibold text-dc-brand-primary underline underline-offset-2 transition-colors hover:text-dc-brand-accent active:text-dc-brand-deep pointer-coarse:min-h-11"
        >
          ลองอีกครั้ง
        </button>
      </ReportStatus>
    );
  }
  return children(load.data);
}
