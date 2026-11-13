import type { Metadata } from "next";
import PopulationResults from "@/components/dc/population/PopulationResults";
import ReportAbout from "@/components/dc/report/ReportAbout";
import ReportBreadcrumb from "@/components/dc/report/ReportBreadcrumb";
import ReportHero from "@/components/dc/report/ReportHero";
import ReportStatus from "@/components/dc/report/ReportStatus";
import { POPULATION_REPORT } from "@/lib/dc/population-report";
import { registryYear } from "@/lib/dc/population-totals";
import { readPopulationReport } from "@/lib/dc/snapshot";

export const metadata: Metadata = { title: `${POPULATION_REPORT.report_name} | Song Health Data Center` };

// รายงานประชากร (SPEC §9.4.1, ADR-0016): a static segment of its own, not an
// id of [id], so it loads no HDC table page (SPEC §4). The frame is built
// here at build time with the report pieces of F66; the numbers come from
// /data/reports/population.json in the browser. Without any ปีข้อมูล it says
// so in place of the form and the results, and the build goes on.
export default function PopulationReportPage() {
  const { years } = readPopulationReport();
  const { report_name, category_name, main_report_name, cat_id, main_report_id } = POPULATION_REPORT;

  return (
    <>
      <ReportBreadcrumb
        crumbs={[
          { label: "รายงานสุขภาพ", href: "/reports" },
          { label: main_report_name, href: `/reports?main=${main_report_id}` },
          { label: category_name, href: `/reports?cat=${cat_id}` },
        ]}
      />
      <ReportHero topic={category_name} title={report_name} credit="ข้อมูลจากกรมการปกครอง" />

      <div className="overflow-hidden rounded-[10px] border border-dc-border-subtle bg-white print:border-0">
        {years.length > 0 ? <PopulationResults /> : <ReportStatus>ยังไม่มีข้อมูลประชากร</ReportStatus>}

        <ReportAbout
          sourceRows={[
            {
              term: "หน่วยงาน",
              detail: (
                <>
                  กรมการปกครอง ผ่านไฟล์รายปีของ{" "}
                  <a
                    href="https://stat.bora.dopa.go.th/"
                    className="text-dc-brand-primary underline underline-offset-2"
                  >
                    stat.bora
                  </a>
                </>
              ),
            },
            {
              term: "ปีข้อมูลที่มีในระบบ",
              detail: years.length > 0 ? years.map((y) => registryYear(y.yymm)).join(", ") : "ยังไม่มีข้อมูล",
            },
            { term: "ตัดยอด", detail: "ณ 31 ธ.ค. ของแต่ละปี" },
          ]}
          method={
            <p>
              ยอดของตำบลและหมู่บ้านรวมทุกสำนักทะเบียน (อำเภอสองและเทศบาลตำบลสอง) · การเปลี่ยนแปลงจากปีก่อนเทียบกับปีข้อมูลก่อนหน้าหนึ่งปี
              ร้อยละเป็นจำนวนที่เปลี่ยน ÷ ค่าของปีก่อน × 100 · ส่วนอายุใช้ผู้ที่แยกอายุได้เป็นตัวหาร
            </p>
          }
          limits={
            <>
              <li>
                ประชากรทะเบียนราษฎรเป็นคนละนิยามกับประชากรของ HDC ที่เป็นตัวหาร (เป้าหมาย) ของรายงานอื่น ตัวเลขจึงเทียบกันตรง ๆ ไม่ได้
              </li>
              <li>บ้านคือบ้านตามทะเบียนบ้าน ไม่ใช่ครัวเรือน</li>
              <li>ไฟล์อายุมีแค่ระดับตำบล และไม่นับประชากรที่ไม่แยกอายุ</li>
              <li>กรมการปกครองประกาศยอดปีละครั้งราวปลาย มี.ค. ช่วง ม.ค.–มี.ค. ปีล่าสุดจึงเป็นของปีก่อน</li>
            </>
          }
        />
      </div>
    </>
  );
}
