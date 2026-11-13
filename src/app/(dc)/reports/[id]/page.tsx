import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReportAbout from "@/components/dc/report/ReportAbout";
import ReportBreadcrumb from "@/components/dc/report/ReportBreadcrumb";
import ReportHero from "@/components/dc/report/ReportHero";
import { TableLimits, TableMethod } from "@/components/dc/tables/methods";
import TablePicker from "@/components/dc/tables/TablePicker";
import { formatThaiDate } from "@/lib/dc/format";
import { readAwaitingWarnings, readCatalog } from "@/lib/dc/snapshot";
import { tablePage } from "@/lib/dc/tables";
import type { DcCatalog, DcReport } from "@/lib/dc/types";

// The report page (SPEC §9.4): one page per report in catalog.json whose
// source table has a page, and 404 for any other id. The frame (breadcrumb,
// hero, เกี่ยวกับรายงานนี้, รายงานที่เกี่ยวข้อง) is built here from
// catalog.json at build time; the numbers come from /data/reports/{id}.json
// in the browser.
export const dynamicParams = false;

type Main = DcCatalog["mains"][number];
type Topic = Main["topics"][number];
type Group = Topic["groups"][number];
/** A report with the หมวด, หัวข้อ and กลุ่ม it sits in */
type Entry = { main: Main; topic: Topic; group: Group; report: DcReport };

/** Every report of the catalog in its order (SPEC §5.4) */
function entries(catalog: DcCatalog): Entry[] {
  return catalog.mains.flatMap((main) =>
    main.topics.flatMap((topic) =>
      topic.groups.flatMap((group) => group.reports.map((report) => ({ main, topic, group, report }))),
    ),
  );
}

/** Up to 3 other reports: the same กลุ่ม first, then the rest of the หัวข้อ, in catalog order (SPEC §9.4) */
function related(all: Entry[], here: Entry): Entry[] {
  const others = all.filter((e) => e.topic === here.topic && e !== here);
  return [...others.filter((e) => e.group === here.group), ...others.filter((e) => e.group !== here.group)].slice(0, 3);
}

export function generateStaticParams() {
  // A รายงานที่รอวิเคราะห์ gets no page: the build warns, it does not fail (SPEC §5.2)
  for (const warning of readAwaitingWarnings()) console.warn(warning);
  return entries(readCatalog()).map((e) => ({ id: e.report.opendata_id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const report = entries(readCatalog()).find((e) => e.report.opendata_id === id)?.report;
  // Each report's own title, as R6 sets it
  return report ? { title: `${report.report_name} | Song Health Data Center` } : {};
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const catalog = readCatalog();
  const all = entries(catalog);
  const here = all.find((e) => e.report.opendata_id === id);
  // The page of the report's source table (ADR-0015); readCatalog keeps only
  // reports with one, so !page only narrows the type
  const page = here && tablePage(here.report.source_table);
  if (!here || !page) notFound();
  const { main, topic, group, report } = here;
  const hdc = `https://hdc.moph.go.th/pre/public/standard-report-detail/${report.opendata_id}?subcatalogId=${report.cat_id}`;
  const openData = `https://opendata.moph.go.th/th/services/summary-table/${report.main_report_id}/${report.source_table}/${report.opendata_id}`;
  const latest = report.years.reduce((max, y) => (y.max_date_com > max ? y.max_date_com : max), "");
  const others = related(all, here);
  const crumbs = [
    { label: "รายงานสุขภาพ", href: "/reports" },
    { label: main.main_report_name, href: `/reports?main=${main.main_report_id}` },
    { label: topic.category_name, href: `/reports?cat=${topic.cat_id}` },
    ...(group.subgroup ? [{ label: group.subgroup }] : []),
  ];

  return (
    <>
      <ReportBreadcrumb crumbs={crumbs} />
      <ReportHero
        badges={
          <>
            <span className="rounded-[5px] bg-dc-highlight-soft px-2.5 py-1 text-xs font-bold text-dc-brand-deep">
              {report.source_table}
            </span>
            {report.catalog_status === "removed" && (
              <span className="rounded-[5px] border border-dc-gold px-2.5 py-1 text-xs font-semibold text-dc-brand-deep">
                HDC ไม่แสดงรายงานนี้แล้ว
              </span>
            )}
          </>
        }
        topic={topic.category_name}
        title={report.report_name}
        subgroup={group.subgroup}
        source="HDC Open Data"
      />

      <div className="overflow-hidden rounded-[10px] border border-dc-border-subtle bg-white print:border-0">
        <TablePicker
          id={report.opendata_id}
          page={page}
          names={{ areas: catalog.areas, hospitals: catalog.hospitals }}
          years={catalog.meta.years}
        />

        <ReportAbout
          source={[
            { term: "ตารางต้นทาง", detail: report.source_table },
            { term: "รหัสรายงาน", detail: report.opendata_id },
            {
              term: "ปีที่มีในระบบ",
              detail: report.years.length > 0 ? report.years.map((y) => y.b_year).join(", ") : "ยังไม่มีข้อมูล",
            },
            { term: "วันที่ข้อมูลล่าสุด", detail: formatThaiDate(latest) || "—" },
            {
              term: "ต้นทาง",
              detail: (
                <>
                  <a href={hdc} className="text-dc-brand-primary underline underline-offset-2">
                    HDC
                  </a>{" "}
                  ·{" "}
                  <a href={openData} className="text-dc-brand-primary underline underline-offset-2">
                    HDC Open Data
                  </a>
                </>
              ),
            },
          ]}
          method={<TableMethod page={page} report={report} districtCode={catalog.meta.district_code} />}
          limits={
            <>
              <li>ตัวเลขเป็นไปตามนิยามและการประมวลผลของ HDC</li>
              {/* One year (s_dental_0_5_cavity_free) has no แนวโน้ม: nothing that reads as several years (SPEC §9.4) */}
              {report.years.length > 1 && <li>นิยามและคอลัมน์ของตารางอาจเปลี่ยนข้ามปี ควรระวังเมื่อเทียบแนวโน้ม</li>}
              <TableLimits page={page} report={report} />
            </>
          }
        />
      </div>

      {others.length > 0 && (
        <section
          aria-labelledby="related-title"
          className="mt-6 rounded-[10px] border border-dc-border-subtle bg-white p-4 sm:p-5 print:hidden"
        >
          <h2 id="related-title" className="font-prompt text-base font-semibold text-dc-brand-deep">
            รายงานที่เกี่ยวข้อง
          </h2>
          <p className="text-xs text-dc-text-secondary">รายงานในกลุ่มและหัวข้อเดียวกัน</p>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {others.map((e) => (
              <li key={e.report.opendata_id} className="min-w-0">
                <Link
                  href={`/reports/${e.report.opendata_id}`}
                  className="flex h-full flex-col rounded-lg border border-dc-border-subtle bg-dc-canvas/40 p-3 hover:border-dc-brand-primary"
                >
                  <strong className="text-[13px] leading-snug font-semibold text-dc-brand-deep">
                    {e.report.report_name}
                  </strong>
                  <small className="mt-1 text-[11px] text-dc-text-secondary">
                    {e.report.source_table}
                    {e.group.subgroup && ` · ${e.group.subgroup}`}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
