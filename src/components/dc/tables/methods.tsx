import type { tablePage } from "@/lib/dc/tables";
import type { DcReport } from "@/lib/dc/types";
import { goalFor, measureLabel } from "@/lib/dc/values";

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

/** เป้าหมาย of each table, and the vaccine each รายการ is in header order where HDC's page names it (SCHEMA §4.6.4) */
const EPI_MEANINGS: Record<string, { target: string; doses?: Record<string, string> }> = {
  s_epi1: {
    target: "เด็กอายุครบ 1 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด (Type area 1 และ 3)",
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
  // The รายการ that kpi_epi gives no เกณฑ์ (SCHEMA §4.4): PCV1–3 of s_epi1
  const withoutGoal = Object.keys(meaning?.doses ?? {}).filter((measure) => goalFor(report, measure) === null);
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
        {withoutGoal.length > 0 && ` · รายการที่ไม่มีเกณฑ์ (${withoutGoal.map(measureLabel).join(", ")}) ไม่มีผลประเมิน`}
      </li>
    </ul>
  );
}

/** The pairing of columns with vaccines that a table infers (SCHEMA §4.6.4): s_epi1 alone, as s_epi2's 6 are matched by their numbers */
const EPI_INFERRED: Record<string, string> = {
  s_epi1:
    "หน้า HDC ยืนยันชื่อวัคซีนของคอลัมน์ได้เป็นกลุ่มที่ตัวเลขเท่ากัน การจับคู่คอลัมน์กับวัคซีนภายในกลุ่ม (BCG กับ ROTA1, DTP2 กับ HBV4, DTP1 DTP-HB3 HBV2 HBV3 HIB1 HIB2 และ OPV3 และลำดับของ PCV1–3) จึงอนุมานจากชื่อคอลัมน์",
};

function EpiLimits({ report }: { report: DcReport }) {
  const inferred = EPI_INFERRED[report.source_table];
  return inferred ? <li>{inferred}</li> : null;
}

/** ร้อยละปี 2569 of อายุ 2, 3 and 5 ปี, which fell across the province (SCHEMA §4.6.5) */
const COMPLETE_FELL_2569 =
  "ร้อยละปี 2569 ต่ำกว่าปีก่อนมาก หน้า HDC แสดงทั้งจังหวัดแพร่ลดลงแบบเดียวกัน จึงไม่ได้เกิดเฉพาะอำเภอสอง · รายการวัคซีนในวิธีคำนวณเป็นนิยามของปี 2569 ส่วนนิยามของปีก่อนยังไม่ได้ยืนยัน จึงยังไม่รู้สาเหตุที่ลดลง";

/**
 * Each of s_epi_complete's reports (SCHEMA §4.6.5): its เป้าหมาย, the
 * vaccines its ผลงาน counts in ปี 2569 where HDC's page names them (อายุ 1
 * ปี's are not recorded), and its own ข้อจำกัด
 */
const COMPLETE_MEANINGS: Record<string, { target: string; doses?: string; limits: string[] }> = {
  "28dd2c7955ce926456240b2ff0100bde": { target: "เด็กอายุครบ 1 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด", limits: [] },
  "35f4a8d465e6e1edc05f3d8ab658c551": {
    target: "เด็กอายุครบ 2 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด",
    doses: "BCG 1, HBV 3 ครั้ง (แรกเกิด, 2 เดือน และ 6 เดือน), DTP 4, Hib 3, IPV 2, OPV 2, MMR 2 ครั้ง, Rota ครบตามเกณฑ์, LAJE 1 หรือ JE 2 ครั้ง",
    limits: [COMPLETE_FELL_2569],
  },
  d1fe173d08e959397adf34b1d77e88d7: {
    target: "เด็กอายุครบ 3 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด",
    doses: "เหมือนอายุ 2 ปี แต่ LAJE 2 หรือ JE 3 ครั้ง",
    limits: [COMPLETE_FELL_2569, "ปี 2569 ผลงานเป็น 0 ทุกเดือน ต.ค.–มี.ค. แล้วได้ 3–6 คนต่อเดือนตั้งแต่ เม.ย. ยังไม่รู้สาเหตุ"],
  },
  f033ab37c30201f73f142449d037028d: {
    target: "เด็กอายุครบ 5 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด",
    doses: "เหมือนอายุ 3 ปี แต่ DTP 5 และ OPV 3 ครั้ง",
    limits: [COMPLETE_FELL_2569],
  },
};

function CompleteMethod({ report, districtCode }: MethodProps) {
  const meaning = COMPLETE_MEANINGS[report.opendata_id];
  return (
    <ul className="list-disc pl-4">
      <li>
        รวมทุกแถว (หนึ่งแถวต่อหมู่บ้าน) ของรายงานนี้ที่ areacode ขึ้นต้นด้วย {districtCode} หรือ 6 หลักแรกตรงกับตำบลที่เลือก · ตาราง s_epi_complete
        มีแถวของรายงานอายุ 1, 2, 3 และ 5 ปี แยกกันด้วยคอลัมน์ id
      </li>
      {meaning && <li>เป้าหมาย: {meaning.target} (คอลัมน์ target)</li>}
      <li>
        ผลงาน: เด็กตามเป้าหมายที่ได้รับวัคซีนแต่ละชนิดครบตามเกณฑ์ (คอลัมน์ result)
        {meaning?.doses && ` · ปี 2569 นับ ${meaning.doses}`}
      </li>
      <li>
        ร้อยละ = ผลรวมผลงาน ÷ ผลรวมเป้าหมาย × 100 ไม่เฉลี่ยร้อยละของแต่ละพื้นที่ · เป้าหมายเป็น 0 แสดง “—”
        {report.goal !== null && ` · ผ่านเกณฑ์เมื่อร้อยละ ≥ ${report.goal}`}
      </li>
      <li>รายเดือนใช้คอลัมน์ target10–target09 และ result10–result09 ซึ่ง 12 เดือนรวมกันเท่าทั้งปี · ตารางไม่มีรายไตรมาส</li>
    </ul>
  );
}

function CompleteLimits({ report }: { report: DcReport }) {
  return (COMPLETE_MEANINGS[report.opendata_id]?.limits ?? []).map((limit) => <li key={limit}>{limit}</li>);
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

/** ผลงาน of s_dm_screen and s_ht_screen (SCHEMA §4.6.8) */
const SCREEN_RESULTS: Record<string, string> = {
  s_dm_screen: "ประชากรตามเป้าหมายที่ได้รับการคัดกรองเบาหวาน",
  s_ht_screen: "ประชากรตามเป้าหมายที่ได้รับการคัดกรองโรคความดันโลหิตสูง",
};

function ScreenMethod({ report, districtCode }: MethodProps) {
  const result = SCREEN_RESULTS[report.source_table];
  return (
    <ul className="list-disc pl-4">
      <li>
        รวมทุกแถว (หนึ่งแถวต่อหมู่บ้าน) ที่ areacode ขึ้นต้นด้วย {districtCode} หรือ 6 หลักแรกตรงกับตำบลที่เลือก
      </li>
      <li>เป้าหมาย: ประชากรอายุ 35 ปีขึ้นไปในเขตรับผิดชอบ (คอลัมน์ target){result && ` · ผลงาน: ${result} (คอลัมน์ result)`}</li>
      <li>
        ร้อยละ = ผลรวมผลงาน ÷ ผลรวมเป้าหมาย × 100 ไม่เฉลี่ยร้อยละของแต่ละพื้นที่ · เป้าหมายเป็น 0 แสดง “—”
        {report.goal !== null && ` · ผ่านเกณฑ์เมื่อร้อยละ ≥ ${report.goal}`}
      </li>
      <li>
        ผลงานรายไตรมาส (คอลัมน์ result1–4) ไม่มีเป้าหมายรายไตรมาส จึงแสดงเป็นร้อยละสะสม = ผลงานไตรมาส 1 ถึงไตรมาสนั้นรวมกัน ÷ เป้าหมายทั้งปี × 100
        ของพื้นที่ที่เลือก ไม่ใช่ร้อยละของแต่ละไตรมาส · ผลงาน 4 ไตรมาสรวมกันเท่าทั้งปี ร้อยละสะสมไตรมาส 4 จึงเท่าร้อยละทั้งปี · ไตรมาสที่ไม่มีผลงานนับเป็น 0
      </li>
    </ul>
  );
}

/**
 * B and A of s_ncd_screen_repleate1 and s_ht_screen_follow as HDC's page
 * heads them, their quarter columns, the years their _13 columns are empty
 * (SCHEMA §4.6.9–4.6.10), HBPM/OBPM of s_ht_screen_follow and the table's
 * own ข้อจำกัด
 */
const FOLLOW_MEANINGS: Record<string, { target: string; result: string; quarters: string; empty13: string; bpMethods?: string; limits: string[] }> = {
  s_ncd_screen_repleate1: {
    target: "ประชากรอายุ 35 ปีขึ้นไปในเขตรับผิดชอบที่ได้รับการคัดกรองเบาหวานและเป็นกลุ่มสงสัยป่วย",
    result: "กลุ่มสงสัยป่วยที่ได้รับการตรวจยืนยันด้วย FPG ทางห้องปฏิบัติการภายใน 1–180 วันก่อนสิ้นปีงบประมาณ",
    quarters: "targetq1–4 และ resultq1–4",
    empty13: "2565–2567",
    limits: ["ผลงานไตรมาส 4 (resultq4) ว่างทุกปี 2565–2569 ไตรมาส 4 ที่มีเป้าหมายจึงได้ร้อยละ 0 ยังไม่รู้สาเหตุ"],
  },
  s_ht_screen_follow: {
    target: "กลุ่มสงสัยป่วยโรคความดันโลหิตสูง",
    result: "กลุ่มสงสัยป่วยที่ได้รับการติดตามเพื่อการวินิจฉัย ไม่นับซ้ำ",
    quarters: "t_q1–4 และ r_q1–4",
    empty13: "2565–2566",
    limits: [],
    bpMethods:
      "จำนวนตามวิธีวัดของช่วงเวลาที่เลือก: HBPM (วัดที่บ้าน) คอลัมน์ r1 และ OBPM (วัดที่สถานบริการ) คอลัมน์ r2 รายไตรมาสคือ r1_q1–4 และ r2_q1–4 · เป็นจำนวนคน ไม่คิดเป็นร้อยละ · คนหนึ่งวัดได้ทั้งสองวิธี ผลรวมสองวิธีจึงเกินผลงานได้",
  },
};

function FollowMethod({ report, districtCode }: MethodProps) {
  const meaning = FOLLOW_MEANINGS[report.source_table];
  return (
    <ul className="list-disc pl-4">
      <li>
        รวมทุกแถวที่ areacode ขึ้นต้นด้วย {districtCode} ตารางนี้มีหนึ่งแถวต่อหน่วยบริการ จึงแสดงทั้งอำเภอรายหน่วยบริการ ไม่มีตัวกรองตำบล
      </li>
      {meaning && (
        <>
          <li>เป้าหมาย (B ของ HDC): {meaning.target} (คอลัมน์ target)</li>
          <li>ผลงาน (A ของ HDC): {meaning.result} (คอลัมน์ result)</li>
        </>
      )}
      <li>
        ร้อยละ = ผลรวมผลงาน ÷ ผลรวมเป้าหมาย × 100 ไม่เฉลี่ยร้อยละของแต่ละหน่วยบริการ · เป้าหมายเป็น 0 แสดง “—”
        {report.goal !== null && ` · ผ่านเกณฑ์เมื่อร้อยละ ≥ ${report.goal}`}
      </li>
      {meaning && <li>รายไตรมาสใช้คอลัมน์ {meaning.quarters} ซึ่ง 4 ไตรมาสรวมกันเท่าทั้งปี</li>}
      {meaning?.bpMethods && <li>{meaning.bpMethods}</li>}
    </ul>
  );
}

function FollowLimits({ report }: { report: DcReport }) {
  const meaning = FOLLOW_MEANINGS[report.source_table];
  return (
    <>
      <li>
        กราฟบนหน้า HDC คิดร้อยละจากกลุ่มสงสัยป่วยไตรมาส 1–3 (คอลัมน์ target_13 และ result_13) ส่วนหน้านี้ใช้ทั้งปี (target และ result) ร้อยละจึงต่างจาก
        HDC เล็กน้อย
        {meaning && ` · คอลัมน์ของกลุ่มไตรมาส 1–3 ว่างปี ${meaning.empty13} ถ้าใช้กลุ่มนั้นแนวโน้มจะขาดหลายปี`}
      </li>
      <li>เป้าหมายไตรมาส 3–4 มีน้อยมาก อนุมานว่าเพราะการคัดกรองส่วนใหญ่อยู่ในไตรมาส 1–2 ยังไม่ได้ยืนยัน</li>
      <li>areacode ของแต่ละหน่วยบริการตรงกับตำบลที่ตั้งของหน่วยทุกแถว จึงอนุมานว่าเป็นที่ตั้งหน่วยบริการ ไม่ใช่ที่อยู่ของผู้ป่วย หน้านี้จึงไม่แยกรายตำบล</li>
      {meaning?.limits.map((limit) => <li key={limit}>{limit}</li>)}
    </>
  );
}

/**
 * เป้าหมาย and ผลงาน of s_kpi_food, s_kpi_dental28 and s_kpi_dental33
 * (SCHEMA §4.6.6, §4.6.12), the เดือนอายุ of s_kpi_food and each table's own
 * ข้อจำกัด
 */
const ANNUAL_MEANINGS: Record<string, { target: string; result: string; annualOnly?: string; ageMonths?: string; limits: string[] }> = {
  s_kpi_food: {
    target: "เด็กอายุครบ 6 เดือนในปีงบประมาณที่แม่หรือผู้เลี้ยงดูถูกสอบถามเรื่องการกินนมแม่",
    result: "เด็กอายุครบ 6 เดือนที่แม่หรือผู้เลี้ยงดูตอบว่ากินนมแม่อย่างเดียว",
    annualOnly: "คอลัมน์รายไตรมาส (target1–4 และ result1–4) ว่างทุกปี",
    ageMonths:
      "จำนวนที่ตอบว่ากินนมแม่อย่างเดียวที่อายุ 1–6 เดือน (คอลัมน์ r1–r6) ของพื้นที่ที่เลือก · เป็นจำนวนคน ไม่คิดเป็นร้อยละ · HDC เก็บประวัติตั้งแต่แรกเกิดถึง 6 เดือน เด็กคนหนึ่งจึงนับได้หลายเดือนอายุ ผลรวมจึงเกินผลงาน",
    limits: [],
  },
  s_kpi_dental28: {
    target: "เด็ก 6 ปีในเขตรับผิดชอบ",
    result: "เด็ก 6 ปีที่มีรหัสหัตถการเคลือบหลุมร่องฟันแท้ คนใหม่",
    limits: [],
  },
  s_kpi_dental33: {
    target: "ผู้มีอายุ 60 ปีขึ้นไปในเขตรับผิดชอบ",
    result: "ผู้มีอายุ 60 ปีขึ้นไปที่ได้ตรวจทั้งปากและวางแผน ลงแฟ้ม dental",
    limits: [
      "ปี 2566 ผลงาน 1,645 จากเป้าหมาย 11,167 (ร้อยละ 14.73) ต่ำกว่าปีอื่นมาก (ร้อยละ 34–62) และปีนั้นทุกแถวมีค่าในคอลัมน์ ip ซึ่งปีอื่นว่าง ยังไม่รู้ว่าข้อมูลปีนั้นไม่ครบหรือเปลี่ยนวิธีนับ หน้านี้แสดงตามข้อมูล",
    ],
  },
};

function AnnualMethod({ report, districtCode }: MethodProps) {
  const meaning = ANNUAL_MEANINGS[report.source_table];
  return (
    <ul className="list-disc pl-4">
      <li>
        รวมทุกแถว (หนึ่งแถวต่อหมู่บ้าน) ที่ areacode ขึ้นต้นด้วย {districtCode} หรือ 6 หลักแรกตรงกับตำบลที่เลือก · ข้อมูลเป็นทั้งปีอย่างเดียว
        {meaning?.annualOnly && ` เพราะ${meaning.annualOnly}`}
      </li>
      {meaning && (
        <li>
          เป้าหมาย: {meaning.target} (คอลัมน์ target) · ผลงาน: {meaning.result} (คอลัมน์ result)
        </li>
      )}
      <li>
        ร้อยละ = ผลรวมผลงาน ÷ ผลรวมเป้าหมาย × 100 ไม่เฉลี่ยร้อยละของแต่ละพื้นที่ · เป้าหมายเป็น 0 แสดง “—”
        {report.goal !== null && ` · ผ่านเกณฑ์เมื่อร้อยละ ≥ ${report.goal}`}
      </li>
      {meaning?.ageMonths && <li>{meaning.ageMonths}</li>}
    </ul>
  );
}

function AnnualLimits({ report }: { report: DcReport }) {
  return (ANNUAL_MEANINGS[report.source_table]?.limits ?? []).map((limit) => <li key={limit}>{limit}</li>);
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
    case "complete":
      return <CompleteMethod {...props} />;
    case "screen":
      return <ScreenMethod {...props} />;
    case "follow":
      return <FollowMethod {...props} />;
    case "annual":
      return <AnnualMethod {...props} />;
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
    case "complete":
      return <CompleteLimits report={report} />;
    case "screen":
      return null;
    case "follow":
      return <FollowLimits report={report} />;
    case "annual":
      return <AnnualLimits report={report} />;
  }
}
