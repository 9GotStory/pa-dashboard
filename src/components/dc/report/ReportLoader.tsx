"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { loadReport } from "@/lib/dc/client";
import type { DcReportData } from "@/lib/dc/types";
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
    <Suspense fallback={<ReportStatus>กำลังโหลดข้อมูลรายงาน…</ReportStatus>}>
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

  if (load === "loading") return <ReportStatus>กำลังโหลดข้อมูลรายงาน…</ReportStatus>;
  if (load === "failed") {
    return (
      <ReportStatus>
        โหลดข้อมูลรายงานไม่สำเร็จ{" "}
        <button
          type="button"
          onClick={() => {
            setLoad("loading");
            setAttempt(attempt + 1);
          }}
          className="font-semibold text-dc-brand-primary underline underline-offset-2"
        >
          ลองอีกครั้ง
        </button>
      </ReportStatus>
    );
  }
  return children(load.data);
}
