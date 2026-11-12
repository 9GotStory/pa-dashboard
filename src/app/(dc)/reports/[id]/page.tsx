import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TableLimits, TableMethod } from "@/components/dc/tables/methods";
import TablePicker from "@/components/dc/tables/TablePicker";
import { formatThaiDate } from "@/lib/dc/format";
import { readCatalog } from "@/lib/dc/snapshot";
import { tablePage } from "@/lib/dc/tables";
import type { DcCatalog, DcReport } from "@/lib/dc/types";

// The report page (SPEC §9.4): one page per report in catalog.json, and 404
// for any other id. The frame (breadcrumb, hero, เกี่ยวกับรายงานนี้, รายงานที่
// เกี่ยวข้อง) is built here from catalog.json at build time; the numbers come
// from /data/reports/{id}.json in the browser.
export const dynamicParams = false;

type Main = DcCatalog["mains"][number];
type Topic = Main["topics"][number];
type Group = Topic["groups"][number];
/** A report with the หมวด, หัวข้อ and กลุ่ม it sits in */
type Entry = { main: Main; topic: Topic; group: Group; report: DcReport };

/** Every report of catalog.json in its order (SPEC §5.4) */
function entries(catalog: DcCatalog): Entry[] {
  return catalog.mains.flatMap((main) =>
    main.topics.flatMap((topic) => topic.groups.flatMap((group) => group.reports.map((report) => ({ main, topic, group, report })))),
  );
}

/** Up to 3 other reports: the same กลุ่ม first, then the rest of the หัวข้อ, in catalog order (SPEC §9.4) */
function related(all: Entry[], here: Entry): Entry[] {
  const others = all.filter((e) => e.topic === here.topic && e !== here);
  return [...others.filter((e) => e.group === here.group), ...others.filter((e) => e.group !== here.group)].slice(0, 3);
}

export function generateStaticParams() {
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
  if (!here) notFound();
  const { main, topic, group, report } = here;
  const hdc = `https://hdc.moph.go.th/pre/public/standard-report-detail/${report.opendata_id}?subcatalogId=${report.cat_id}`;
  const openData = `https://opendata.moph.go.th/th/services/summary-table/${report.main_report_id}/${report.source_table}/${report.opendata_id}`;
  const latest = report.years.reduce((max, y) => (y.max_date_com > max ? y.max_date_com : max), "");
  const others = related(all, here);
  // The page of the report's source table, or none yet: CoverageReport for a coverage report (ADR-0015)
  const page = tablePage(report.source_table);
  const crumbs = [
    { label: "รายงานสุขภาพ", href: "/reports" },
    { label: main.main_report_name, href: `/reports?main=${main.main_report_id}` },
    { label: topic.category_name, href: `/reports?cat=${topic.cat_id}` },
    ...(group.subgroup ? [{ label: group.subgroup }] : []),
  ];

  return (
    <>
      <nav aria-label="ลำดับหน้าของรายงาน" className="mb-3 print:hidden">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dc-muted">
          {crumbs.map((c, i) => (
            <li key={c.label} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.href ? (
                <Link href={c.href} className="font-semibold text-dc-blue underline-offset-2 hover:underline">
                  {c.label}
                </Link>
              ) : (
                c.label
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="mb-4 rounded-[10px] border border-l-4 border-dc-border border-l-dc-teal bg-white px-4 py-5 sm:px-7 sm:py-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-[5px] bg-dc-blue-light px-2.5 py-1 text-xs font-bold text-dc-blue-dark">{report.source_table}</span>
          {report.catalog_status === "removed" && (
            <span className="rounded-[5px] border border-dc-gold px-2.5 py-1 text-xs font-semibold text-dc-ink">HDC ไม่แสดงรายงานนี้แล้ว</span>
          )}
        </div>
        <p className="mb-1.5 text-xs font-bold text-dc-blue">{topic.category_name}</p>
        <h1 className="font-prompt text-[22px] font-semibold leading-snug text-dc-navy sm:text-[28px]">{report.report_name}</h1>
        <p className="mt-3 border-t border-dc-border pt-3 text-xs text-dc-muted">
          {group.subgroup && `${group.subgroup} · `}อำเภอสอง จังหวัดแพร่ · ข้อมูลจาก HDC Open Data
        </p>
      </header>

      <div className="overflow-hidden rounded-[10px] border border-dc-border bg-white print:border-0">
        {page || report.report_type === "coverage" ? (
          <TablePicker
            id={report.opendata_id}
            page={page}
            names={{ areas: catalog.areas, hospitals: catalog.hospitals }}
            years={catalog.meta.years}
          />
        ) : (
          // workload, empty or anything else of a table without a page: not shown (SPEC §9.4)
          <section aria-labelledby="unsupported-title" className="px-4 py-10 text-center sm:px-6">
            <h2 id="unsupported-title" className="font-prompt text-lg font-semibold text-dc-navy">
              ยังไม่รองรับรูปแบบรายงานนี้
            </h2>
            <p className="mt-1 text-dc-muted">
              หน้านี้แสดงได้เฉพาะรายงานแบบความครอบคลุม (coverage) ดูรายงานนี้ได้ที่{" "}
              <a href={hdc} className="font-semibold text-dc-blue underline underline-offset-2">
                หน้ารายงานบน HDC
              </a>
            </p>
          </section>
        )}

        <section aria-labelledby="about-title" className="border-t border-dc-border bg-dc-canvas/60 px-4 py-5 sm:px-6">
          <h2 id="about-title" className="font-prompt text-[15px] font-semibold text-dc-navy">
            เกี่ยวกับรายงานนี้
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-dc-border bg-white p-4">
              <h3 className="font-prompt text-[13px] font-semibold text-dc-navy">แหล่งข้อมูล</h3>
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-dc-muted">ตารางต้นทาง</dt>
                <dd>{report.source_table}</dd>
                <dt className="text-dc-muted">รหัสรายงาน</dt>
                <dd>{report.opendata_id}</dd>
                <dt className="text-dc-muted">ปีที่มีในระบบ</dt>
                <dd>{report.years.length > 0 ? report.years.map((y) => y.b_year).join(", ") : "ยังไม่มีข้อมูล"}</dd>
                <dt className="text-dc-muted">วันที่ข้อมูลล่าสุด</dt>
                <dd>{formatThaiDate(latest) || "—"}</dd>
                <dt className="text-dc-muted">ต้นทาง</dt>
                <dd>
                  <a href={hdc} className="text-dc-blue underline underline-offset-2">
                    HDC
                  </a>{" "}
                  ·{" "}
                  <a href={openData} className="text-dc-blue underline underline-offset-2">
                    HDC Open Data
                  </a>
                </dd>
              </dl>
            </div>
            <div className="min-w-0 rounded-lg border border-dc-border bg-white p-4 text-xs leading-relaxed">
              {(page || report.report_type === "coverage") && (
                <h3 className="mb-1 font-prompt text-[13px] font-semibold text-dc-brand-deep">วิธีคำนวณ</h3>
              )}
              {page ? (
                <div className="mb-3">
                  <TableMethod page={page} report={report} districtCode={catalog.meta.district_code} />
                </div>
              ) : (
                // The coverage method of CoverageReport; another report_type has no page of its own yet
                report.report_type === "coverage" && (
                  <p className="mb-3">
                    รวมเป้าหมายและผลงานของทุกแถวที่ areacode ขึ้นต้นด้วย {catalog.meta.district_code} (หรือ 6 หลักแรกตรงกับตำบลที่เลือก)
                    แล้วคิดร้อยละ = ผลงาน ÷ เป้าหมาย × 100 จากผลรวม ไม่เฉลี่ยร้อยละของแต่ละแถว · ผ่านเกณฑ์เมื่อร้อยละ ≥ เกณฑ์
                    {report.col_target && report.col_result && ` · เป้าหมายทั้งปีจากคอลัมน์ ${report.col_target} และผลงานจากคอลัมน์ ${report.col_result}`}
                  </p>
                )
              )}
              <h3 className="font-prompt text-[13px] font-semibold text-dc-navy">ข้อจำกัด</h3>
              <ul className="mt-1 list-disc pl-4">
                <li>ตัวเลขเป็นไปตามนิยามและการประมวลผลของ HDC</li>
                <li>นิยามและคอลัมน์ของตารางอาจเปลี่ยนข้ามปี ควรระวังเมื่อเทียบแนวโน้ม</li>
                {page && <TableLimits page={page} report={report} />}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {others.length > 0 && (
        <section aria-labelledby="related-title" className="mt-6 rounded-[10px] border border-dc-border bg-white p-4 sm:p-5 print:hidden">
          <h2 id="related-title" className="font-prompt text-base font-semibold text-dc-navy">
            รายงานที่เกี่ยวข้อง
          </h2>
          <p className="text-xs text-dc-muted">รายงานในกลุ่มและหัวข้อเดียวกัน</p>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {others.map((e) => (
              <li key={e.report.opendata_id} className="min-w-0">
                <Link
                  href={`/reports/${e.report.opendata_id}`}
                  className="flex h-full flex-col rounded-lg border border-dc-border bg-dc-canvas/40 p-3 hover:border-dc-blue"
                >
                  <strong className="text-[13px] leading-snug font-semibold text-dc-ink">{e.report.report_name}</strong>
                  <small className="mt-1 text-[11px] text-dc-muted">
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
