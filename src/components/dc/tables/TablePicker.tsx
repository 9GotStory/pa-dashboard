"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { tablePage } from "@/lib/dc/tables";
import type { DcCatalog } from "@/lib/dc/types";
import ReportStatus from "../report/ReportStatus";

type Props = { id: string; names: Pick<DcCatalog, "areas" | "hospitals">; years: string[] };
/** A page of src/lib/dc/tables/index.ts */
type Page = NonNullable<ReturnType<typeof tablePage>>;

const loading = () => <ReportStatus>กำลังโหลดข้อมูลรายงาน…</ReportStatus>;

// Each page in a chunk of its own, so a report loads its own table's page
// only (SPEC §9.4, §9.6). A Client Component, since a Server Component's
// dynamic import of a Client Component is not code split (ADR-0015).
const PAGES: Record<Page, ComponentType<Props>> = {
  anc: dynamic(() => import("./AncPage"), { loading }),
  childdev: dynamic(() => import("./ChilddevPage"), { loading }),
  epi: dynamic(() => import("./EpiPage"), { loading }),
  aged9: dynamic(() => import("./Aged9Page"), { loading }),
  complete: dynamic(() => import("./CompletePage"), { loading }),
  screen: dynamic(() => import("./ScreenPage"), { loading }),
  follow: dynamic(() => import("./FollowPage"), { loading }),
};
const Coverage = dynamic(() => import("../CoverageReport"), { loading });

/** ผลรายงาน of the report: the page of its source table (tablePage), or CoverageReport for a table without one yet (ADR-0015) */
export default function TablePicker({ page, ...props }: Props & { page: Page | null }) {
  const Page = page ? PAGES[page] : Coverage;
  return <Page {...props} />;
}
