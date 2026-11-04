import { notFound } from "next/navigation";
import { readCatalog } from "@/lib/dc/snapshot";

// Placeholder until F20 builds the report page (SPEC §9.4): one page per
// report in catalog.json, and 404 for any other id.
export const dynamicParams = false;

function reports() {
  return readCatalog().mains.flatMap((m) => m.topics.flatMap((t) => t.groups.flatMap((g) => g.reports)));
}

export function generateStaticParams() {
  return reports().map((r) => ({ id: r.opendata_id }));
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = reports().find((r) => r.opendata_id === id);
  if (!report) notFound();
  return (
    <>
      <h1 className="font-prompt text-2xl font-bold text-dc-navy">{report.report_name}</h1>
      <p className="mt-1 text-dc-muted">ตารางต้นทาง {report.source_table} · หน้านี้อยู่ระหว่างจัดทำ</p>
    </>
  );
}
