import type { tablePage } from "@/lib/dc/tables";
import type { DcReport } from "@/lib/dc/types";

// วิธีคำนวณ of เกี่ยวกับรายงานนี้ for each page of a source table (SPEC §9.4):
// the rows taken, what เป้าหมาย and ผลงาน mean (SCHEMA §4.6) and the page's
// formula of ร้อยละ. Server Components, so the text is in the page's HTML.

type MethodProps = { report: DcReport; districtCode: string };

/** เป้าหมาย and ผลงาน of s_kpi_anc12 and s_anc5 (SCHEMA §4.6.2) */
const ANC_MEANINGS: Record<string, { target: string; result: string }> = {
  s_kpi_anc12: {
    target: "หญิงไทยในเขตรับผิดชอบที่สิ้นสุดการตั้งครรภ์ (แฟ้ม LABOR)",
    result: "หญิงตามเป้าหมายที่ฝากครรภ์ครั้งแรกเมื่ออายุครรภ์ ≤ 12 สัปดาห์ (แฟ้ม ANC)",
  },
  s_anc5: {
    target: "หญิงไทยในเขตรับผิดชอบที่สิ้นสุดการตั้งครรภ์ด้วยการคลอด (แฟ้ม LABOR, BTYPE ≠ 6)",
    result: "หญิงตามเป้าหมายที่ฝากครรภ์คุณภาพครบ 5 ครั้งตามเกณฑ์ (แฟ้ม ANC)",
  },
};

function AncMethod({ report, districtCode }: MethodProps) {
  const meaning = ANC_MEANINGS[report.source_table];
  return (
    <ul className="list-disc pl-4">
      <li>
        รวมทุกแถว (หนึ่งแถวต่อหมู่บ้าน) ที่ areacode ขึ้นต้นด้วย {districtCode} หรือ 6 หลักแรกตรงกับตำบลที่เลือก
      </li>
      {meaning && (
        <>
          <li>เป้าหมาย: {meaning.target}</li>
          <li>ผลงาน: {meaning.result}</li>
        </>
      )}
      <li>
        ร้อยละ = ผลรวมผลงาน ÷ ผลรวมเป้าหมาย × 100 ไม่เฉลี่ยร้อยละของแต่ละพื้นที่ · เป้าหมายเป็น 0 แสดง “—”
        {report.goal !== null && ` · ผ่านเกณฑ์เมื่อร้อยละ ≥ ${report.goal}`}
      </li>
      <li>รายไตรมาสใช้คอลัมน์ target1–4 และ result1–4 ซึ่ง 4 ไตรมาสรวมกันเท่าทั้งปี</li>
    </ul>
  );
}

/** เป้าหมาย (B) and ผลงาน (A) of s_kpi_childdev4 and s_kpi_childdev2 as HDC's page heads them (SCHEMA §4.6.3) */
const CHILDDEV_MEANINGS: Record<string, { target: string; result: string }> = {
  s_kpi_childdev4: {
    target: "เด็กไทยอายุ 9, 18, 30, 42 และ 60 เดือนทุกคนที่อยู่อาศัยในพื้นที่รับผิดชอบ",
    result: "เด็กตามเป้าหมายที่ได้รับการตรวจคัดกรองและมีพัฒนาการสมวัย ครั้งแรกและหลังการติดตาม (1B260)",
  },
  s_kpi_childdev2: {
    target: "เด็กไทยอายุ 9, 18, 30, 42 และ 60 เดือนที่ได้รับการตรวจคัดกรองพัฒนาการจริง",
    result: "เด็กตามเป้าหมายที่มีพัฒนาการสงสัยล่าช้าครั้งแรกและส่งต่อทันที (1B261 + 1B262)",
  },
};

function ChilddevMethod({ report, districtCode }: MethodProps) {
  const meaning = CHILDDEV_MEANINGS[report.source_table];
  return (
    <ul className="list-disc pl-4">
      <li>
        รวมทุกแถวที่ areacode ขึ้นต้นด้วย {districtCode} ตารางนี้มีหนึ่งแถวต่อหน่วยบริการ และ areacode คือตำบลที่ตั้งของหน่วยบริการ (อนุมาน)
        จึงแสดงทั้งอำเภอรายหน่วยบริการ ไม่มีตัวกรองตำบล
      </li>
      {meaning && (
        <>
          <li>เป้าหมาย (B ของ HDC): {meaning.target}</li>
          <li>ผลงาน (A ของ HDC): {meaning.result}</li>
        </>
      )}
      <li>
        ร้อยละ = ผลรวมผลงาน ÷ ผลรวมเป้าหมาย × 100 ไม่เฉลี่ยร้อยละของแต่ละหน่วยบริการ · เป้าหมายเป็น 0 แสดง “—”
        {report.goal !== null && ` · ผ่านเกณฑ์เมื่อร้อยละ ≥ ${report.goal}`}
      </li>
      <li>ตารางมีแต่รายไตรมาส (target1–4 และ result1–4) ทั้งปีจึงเป็นผลรวม 4 ไตรมาส</li>
    </ul>
  );
}

/** วิธีคำนวณ of a page */
export function TableMethod({ page, ...props }: MethodProps & { page: NonNullable<ReturnType<typeof tablePage>> }) {
  switch (page) {
    case "anc":
      return <AncMethod {...props} />;
    case "childdev":
      return <ChilddevMethod {...props} />;
  }
}
