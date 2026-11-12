import type { tablePage } from "@/lib/dc/tables";
import type { DcReport } from "@/lib/dc/types";
import { measureLabel } from "@/lib/dc/values";

// วิธีคำนวณ of เกี่ยวกับรายงานนี้ for each page of a source table (SPEC §9.4):
// the rows taken, what เป้าหมาย and ผลงาน mean (SCHEMA §4.6) and the page's
// formula of ร้อยละ; and the page's own ข้อจำกัด. Server Components, so the
// text is in the page's HTML.

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
        รวมทุกแถวที่ areacode ขึ้นต้นด้วย {districtCode} ตารางนี้มีหนึ่งแถวต่อหน่วยบริการ จึงแสดงทั้งอำเภอรายหน่วยบริการ ไม่มีตัวกรองตำบล
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

/** ไตรมาส 4 that is low every year for a reason not known yet (SCHEMA §4.6.3) */
const CHILDDEV_LOW_QUARTER_4: Record<string, string> = {
  s_kpi_childdev4:
    "ร้อยละไตรมาส 4 ต่ำกว่าไตรมาสอื่นทุกปี 2565–2569 และปี 2569 ทั้งจังหวัดแพร่ก็ต่ำ จึงเป็นรูปแบบของข้อมูล HDC ไม่ใช่ข้อมูลของอำเภอสองที่ยังไม่ครบ ยังไม่รู้สาเหตุ",
  s_kpi_childdev2: "เป้าหมายไตรมาส 4 (เด็กที่ได้รับการคัดกรอง) น้อยกว่าไตรมาสอื่นทุกปี 2565–2569 ยังไม่รู้สาเหตุ",
};

function ChilddevLimits({ report }: { report: DcReport }) {
  const lowQuarter4 = CHILDDEV_LOW_QUARTER_4[report.source_table];
  return (
    <>
      <li>ทั้งปีคือผลรวม 4 ไตรมาสตามข้อมูล HDC ส่วน PA Dashboard รวม 3 ไตรมาสตามรอบประเมิน ตัวเลขทั้งปีจึงต่างจาก PA</li>
      <li>areacode ของแต่ละหน่วยบริการตรงกับตำบลที่ตั้งของหน่วยทุกแถว จึงอนุมานว่าเป็นที่ตั้งหน่วยบริการ ไม่ใช่ที่อยู่ของเด็ก หน้านี้จึงไม่แยกรายตำบล</li>
      {lowQuarter4 && <li>{lowQuarter4}</li>}
    </>
  );
}

/**
 * เป้าหมาย of each table, the vaccine each รายการ is in header order where
 * HDC's page names it, and the รายการ without a เกณฑ์ (SCHEMA §4.6.4)
 */
const EPI_MEANINGS: Record<string, { target: string; doses?: Record<string, string>; noGoal?: string }> = {
  s_epi1: {
    target: "เด็กอายุครบ 1 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด (Type area 1 และ 3)",
    noGoal: "PCV",
    doses: {
      bcg: "BCG แรกเกิด",
      dtp_hb3: "DTP 6 เดือน",
      opv3: "OPV 6 เดือน",
      mmr: "MMR 9 เดือน",
      hbv: "HBV แรกเกิด",
      ipv: "IPV 4 เดือน",
      dtp1: "DTP 2 เดือน",
      rota: "Rota (ครบถ้วนตามเกณฑ์)",
      hbv3: "HBV 6 เดือน",
      hib3: "Hib 6 เดือน",
      dtp2: "DTP 4 เดือน",
      hbv2: "HBV 2 เดือน",
      hbv4: "HBV 4 เดือน",
      hib1: "Hib 2 เดือน",
      hib2: "Hib 4 เดือน",
      ipv1: "IPV 2 เดือน",
      rota1: "Rota 2 เดือน",
      pcv1: "PCV 2 เดือน (นอกแผน)",
      pcv2: "PCV 4 เดือน (นอกแผน)",
      pcv3: "PCV 6 เดือน (นอกแผน)",
    },
  },
  s_epi2: {
    target: "เด็กอายุครบ 2 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด",
    doses: { dtp4: "DTP 1 ปี 6 เดือน", opv4: "OPV 1 ปี 6 เดือน", je2: "LAJE/JE 1 ปี", mmr1: "MMR1 เก็บตก", mmr2: "MMR 1 ปี 6 เดือน" },
  },
  s_epi3: { target: "เด็กอายุครบ 3 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด" },
  s_epi5: { target: "เด็กอายุครบ 5 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด" },
};

function EpiMethod({ report, districtCode }: MethodProps) {
  const meaning = EPI_MEANINGS[report.source_table];
  return (
    <ul className="list-disc pl-4">
      <li>
        รวมทุกแถว (หนึ่งแถวต่อหมู่บ้าน) ที่ areacode ขึ้นต้นด้วย {districtCode} หรือ 6 หลักแรกตรงกับตำบลที่เลือก · ทั้งอำเภอเปรียบเทียบรายตำบล
        เลือกตำบลเปรียบเทียบรายหน่วยบริการ
      </li>
      {meaning && <li>เป้าหมาย: {meaning.target} คอลัมน์ target ของแต่ละเดือน</li>}
      <li>ผลงาน: เด็กตามเป้าหมายที่ได้รับวัคซีนรายการนั้น คอลัมน์ {"{รายการ}_{เดือน}"} ทั้งปีคือผลรวม 12 เดือน และไตรมาสคือผลรวม 3 เดือน (ไตรมาส 1 = ต.ค.–ธ.ค.)</li>
      {meaning?.doses && (
        <li>
          วัคซีนของแต่ละรายการ:{" "}
          {Object.entries(meaning.doses)
            .map(([measure, dose]) => `${measureLabel(measure)} = ${dose}`)
            .join(" · ")}
        </li>
      )}
      <li>
        ร้อยละ = ผลรวมผลงาน ÷ ผลรวมเป้าหมาย × 100 ไม่เฉลี่ยร้อยละของแต่ละพื้นที่ · เป้าหมายเป็น 0 แสดง “—” · รายการที่ผลงานรวมทั้งอำเภอของปีเป็น 0
        ถือว่าไม่มีข้อมูลปีนั้น แสดง “—”
      </li>
      <li>
        เกณฑ์ของแต่ละรายการตาม PA Dashboard ผ่านเกณฑ์เมื่อร้อยละ ≥ เกณฑ์
        {meaning?.noGoal && ` · รายการที่ไม่มีเกณฑ์ (${meaning.noGoal}) ไม่มีผลประเมิน`}
      </li>
    </ul>
  );
}

/** The pairing of columns with vaccines within a group of equal numbers, which s_epi1 alone infers (SCHEMA §4.6.4) */
function EpiLimits({ report }: { report: DcReport }) {
  if (report.source_table !== "s_epi1") return null;
  return (
    <li>
      หน้า HDC ยืนยันชื่อวัคซีนของคอลัมน์ได้เป็นกลุ่มที่ตัวเลขเท่ากัน การจับคู่คอลัมน์กับวัคซีนภายในกลุ่ม (BCG กับ ROTA1, DTP2 กับ HBV4, DTP1 DTP-HB3 HBV2 HBV3
      HIB1 HIB2 และ OPV3 และลำดับของ PCV1–3) จึงอนุมานจากชื่อคอลัมน์
    </li>
  );
}

function Aged9Method({ report, districtCode }: MethodProps) {
  return (
    <ul className="list-disc pl-4">
      <li>
        รวมทุกแถว (หนึ่งแถวต่อหมู่บ้าน) ที่ areacode ขึ้นต้นด้วย {districtCode} หรือ 6 หลักแรกตรงกับตำบลที่เลือก · ข้อมูลเป็นทั้งปีอย่างเดียว
      </li>
      <li>เป้าหมาย: ผู้สูงอายุ (คอลัมน์ target) · ผลงาน: ผู้สูงอายุที่คัดกรองครบ 9 ด้าน (คอลัมน์ result)</li>
      <li>
        ร้อยละความครอบคลุม = ผลรวมผลงาน ÷ ผลรวมเป้าหมาย × 100 ไม่เฉลี่ยร้อยละของแต่ละพื้นที่ · เป้าหมายเป็น 0 แสดง “—” · ปีที่ผลงานรวมทั้งอำเภอเป็น 0
        ถือว่าไม่มีข้อมูลปีนั้น แสดง “—” ไม่ใช่ไม่ผ่าน
        {report.goal !== null && ` · ผ่านเกณฑ์เมื่อร้อยละ ≥ ${report.goal}`}
      </li>
      <li>
        ผลการคัดกรองแต่ละด้านคือผลรวมคอลัมน์ result1–result9 ของพื้นที่ เป็นจำนวนรายการ ไม่ใช่จำนวนผู้มีความเสี่ยง ไม่คิดเป็นร้อยละและไม่มีเกณฑ์ ·
        ด้านที่ผลรวมทั้งอำเภอของปีเป็น 0 แสดง “—”
      </li>
    </ul>
  );
}

function Aged9Limits() {
  return (
    <>
      <li>
        ยังไม่แสดงจำนวนปกติและเสี่ยงของแต่ละด้าน (คอลัมน์ result1_1–result9_2 และ result6_3) เพราะด้าน 1 ปกติรวมกับเสี่ยงมากกว่าจำนวนที่คัดกรองด้านนั้น
        และด้าน 6 มี 2Q+ผิดปกติอยู่นอกผลรวม หน้า HDC ก็แสดงแบบเดียวกัน จึงยังไม่รู้วิธีนับ
      </li>
      <li>
        คำอธิบายของ HDC บอกว่าเป้าหมายคือผู้สูงอายุทั้งหมด แต่หัวตารางบนหน้า HDC เขียนว่าผู้สูงอายุที่ได้รับการคัดกรอง ตัวเลขเข้ากับผู้สูงอายุทั้งหมดมากกว่า
        แต่ยังไม่ได้ยืนยัน
      </li>
      <li>
        ปี 2565 ผลงานว่างทั้งอำเภอ ความครอบคลุมจึงแสดง “—” แต่รายด้านมีค่า ยกเว้นด้าน 9 ที่ว่างและด้าน 3 ที่มีแค่ 198 รายการ ยังไม่รู้สาเหตุ
      </li>
    </>
  );
}

/** วิธีคำนวณ of a page */
export function TableMethod({ page, ...props }: MethodProps & { page: NonNullable<ReturnType<typeof tablePage>> }) {
  switch (page) {
    case "anc":
      return <AncMethod {...props} />;
    case "childdev":
      return <ChilddevMethod {...props} />;
    case "epi":
      return <EpiMethod {...props} />;
    case "aged9":
      return <Aged9Method {...props} />;
  }
}

/** The ข้อจำกัด of a page, after those of every report: <li> items */
export function TableLimits({ page, report }: { page: NonNullable<ReturnType<typeof tablePage>>; report: DcReport }) {
  switch (page) {
    case "anc":
      return null;
    case "childdev":
      return <ChilddevLimits report={report} />;
    case "epi":
      return <EpiLimits report={report} />;
    case "aged9":
      return <Aged9Limits />;
  }
}
