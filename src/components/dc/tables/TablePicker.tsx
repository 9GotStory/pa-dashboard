"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { tablePage } from "@/lib/dc/tables";
import type { DcCatalog, TablePage } from "@/lib/dc/types";
import ReportStatus from "../report/ReportStatus";

type Props = { id: string; names: Pick<DcCatalog, "areas" | "hospitals">; years: string[] };

const loading = () => <ReportStatus>กำลังโหลดข้อมูลรายงาน…</ReportStatus>;

// Each page in a chunk of its own, so a report loads its own table's page
// only (SPEC §9.4, §9.6). A Client Component, since a Server Component's
// dynamic import of a Client Component is not code split (ADR-0015).
const PAGES: Record<TablePage, ComponentType<Props>> = {
  anc: dynamic(() => import("./AncPage"), { loading }),
};
const Coverage = dynamic(() => import("../CoverageReport"), { loading });

/** ผลรายงาน of the report: the page of its source table, or CoverageReport for a table without one yet (ADR-0015) */
export default function TablePicker({ sourceTable, ...props }: Props & { sourceTable: string }) {
  const page = tablePage(sourceTable);
  const Page = page ? PAGES[page] : Coverage;
  return <Page {...props} />;
}
