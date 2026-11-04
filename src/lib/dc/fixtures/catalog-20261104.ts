import type { DcCatalog, DcReport, DcTopic } from "../types";

// catalog.json of the snapshot built on 4 Nov 2569, in its order (SPEC §5.4):
// the real หมวด, หัวข้อ and กลุ่ม, and each report's real opendata_id,
// report_name, source_table and order. The fields that the search and the
// paging of /reports do not read are left empty.

function report(
  topic: DcTopic,
  subgroup: string,
  order: number,
  opendata_id: string,
  source_table: string,
  report_name: string,
): DcReport {
  return {
    opendata_id,
    report_name,
    source_table,
    cat_id: topic.cat_id,
    main_report_id: topic.main_report_id,
    subgroup,
    order,
    report_type: "coverage",
    goal: null,
    col_target: null,
    col_result: null,
    measure_goals: {},
    catalog_status: "active",
    years: [],
  };
}

export const PROMOTION = { main_report_id: "73daf277928bc32a1b3c8e772192543c", main_report_name: "ส่งเสริมป้องกัน" };
export const SERVICE_PLAN = { main_report_id: "02e752187c7282ebc9315123aa1cabbe", main_report_name: "ข้อมูลตอบสนอง Service Plan" };

export const MCH: DcTopic = { cat_id: "1ed90bc32310b503b7ca9b32af425ae5", category_name: "อนามัยแม่และเด็ก", ...PROMOTION, order: 10 };
export const VACCINES: DcTopic = { cat_id: "4df360514655f79f13901ef1181ca1c7", category_name: "การสร้างเสริมภูมิคุ้มกันโรค", ...PROMOTION, order: 20 };
const SURVEILLANCE: DcTopic = { cat_id: "bebf866fceaef84c4078965eaf619565", category_name: "การเฝ้าระวังด้านส่งเสริมสุขภาพและอนามัยสิ่งแวดล้อม", ...PROMOTION, order: 30 };
const SCREENING: DcTopic = { cat_id: "6966b0664b89805a484d7ac96c6edc48", category_name: "การคัดกรอง", ...PROMOTION, order: 40 };
const NCD: DcTopic = { cat_id: "b2b59e64c4e6c92d4b1ec16a599d882b", category_name: "ข้อมูลเพื่อตอบสนอง Service Plan สาขาโรคไม่ติดต่อ (NCD DM,HT,CVD)", ...SERVICE_PLAN, order: 50 };
const DENTAL: DcTopic = { cat_id: "db30e434e30565c12fbac44958e338d5", category_name: "ข้อมูลเพื่อตอบสนอง Service Plan สาขาสุขภาพช่องปาก", ...SERVICE_PLAN, order: 60 };

export const MAINS: DcCatalog["mains"] = [
  {
    ...PROMOTION,
    topics: [
      {
        ...MCH,
        groups: [
          {
            subgroup: "",
            reports: [
              report(MCH, "", 10, "1c1b8e24aff59258a806f122e264031e", "s_kpi_anc12", "ร้อยละหญิงตั้งครรภ์ได้รับการฝากครรภ์ครั้งแรกก่อนหรือเท่ากับ 12 สัปดาห์"),
              report(MCH, "", 20, "bd63b8d99f7054560fcf9c3b96f39c13", "s_anc5", "ร้อยละหญิงตั้งครรภ์ที่ได้รับการดูแลก่อนคลอด 5 ครั้ง ตามเกณฑ์"),
              report(MCH, "", 30, "1b60d68b1cb5b003fcba38a4a0e4027b", "s_kpi_childdev4", "ร้อยละของเด็กอายุ 0-5 ปี ทั้งหมดตามช่วงอายุที่กำหนดมีพัฒนาการสมวัย"),
              report(MCH, "", 40, "684e99dc7538c8b1a97f19f91a100f08", "s_kpi_childdev2", "ร้อยละของเด็กอายุ 0-5 ปี ที่ได้รับการคัดกรองพัฒนาการ พบสงสัยล่าช้า"),
            ],
          },
        ],
      },
      {
        ...VACCINES,
        groups: [
          {
            subgroup: "กลุ่มอายุ 1 ปี",
            reports: [
              report(VACCINES, "กลุ่มอายุ 1 ปี", 10, "c88658f4d09acb8c76e6c06ffb58ebaf", "s_epi1", "ความครอบคลุมของเด็กอายุครบ 1 ปีที่ได้รับวัคซีน BCG ,HBV1,DTP1,DTP3,HBV3,Hib3,โปลิโอ3, MMR1,IPV,Rota รายไตรมาส"),
              report(VACCINES, "กลุ่มอายุ 1 ปี", 11, "28dd2c7955ce926456240b2ff0100bde", "s_epi_complete", "ความครอบคลุมการได้รับวัคซีนแต่ละชนิดครบตามเกณฑ์ในเด็กอายุครบ 1 ปี (fully immunized)"),
            ],
          },
          {
            subgroup: "กลุ่มอายุ 2 ปี",
            reports: [
              report(VACCINES, "กลุ่มอายุ 2 ปี", 20, "71e49e4b61aafee17761601c506d5f85", "s_epi2", "ความครอบคลุมของเด็กอายุครบ 2 ปีที่ได้รับวัคซีนแต่ละชนิด รายไตรมาส"),
              report(VACCINES, "กลุ่มอายุ 2 ปี", 21, "35f4a8d465e6e1edc05f3d8ab658c551", "s_epi_complete", "ความครอบคลุมการได้รับวัคซีนแต่ละชนิดครบตามเกณฑ์ในเด็กอายุครบ 2 ปี (fully immunized)"),
            ],
          },
          {
            subgroup: "กลุ่มอายุ 3 ปี",
            reports: [
              report(VACCINES, "กลุ่มอายุ 3 ปี", 30, "267ce09f2a704eb7783997e25d1f18ba", "s_epi3", "ความครอบคลุมของเด็กอายุครบ 3 ปี ที่ได้รับวัคซีนแต่ละชนิด รายไตรมาส"),
              report(VACCINES, "กลุ่มอายุ 3 ปี", 31, "d1fe173d08e959397adf34b1d77e88d7", "s_epi_complete", "ความครอบคลุมการได้รับวัคซีนแต่ละชนิดครบตามเกณฑ์ในเด็กอายุครบ 3 ปี (fully immunized)"),
            ],
          },
          {
            subgroup: "กลุ่มอายุ 5 ปี",
            reports: [
              report(VACCINES, "กลุ่มอายุ 5 ปี", 50, "c47283d3c2c1e6528ddcf88c254f21b3", "s_epi5", "ความครอบคลุมของเด็กอายุครบ 5 ปีที่ได้รับวัคซีน DTP5,โปลิโอ5 รายไตรมาส"),
              report(VACCINES, "กลุ่มอายุ 5 ปี", 51, "f033ab37c30201f73f142449d037028d", "s_epi_complete", "ความครอบคลุมการได้รับวัคซีนแต่ละชนิดครบตามเกณฑ์ในเด็กอายุครบ 5 ปี (fully immunized)"),
            ],
          },
        ],
      },
      {
        ...SURVEILLANCE,
        groups: [
          {
            subgroup: "",
            reports: [
              report(SURVEILLANCE, "", 10, "4164a7c49fcb2b8c3ccca67dcdf28bd0", "s_kpi_food", "ร้อยละของเด็กแรกเกิด - ต่ำกว่า 6 เดือน กินนมแม่อย่างเดียว"),
            ],
          },
        ],
      },
      {
        ...SCREENING,
        groups: [
          {
            subgroup: "",
            reports: [
              report(SCREENING, "", 10, "aa86b13e8cb60cae6c3216b7e3e5f151", "s_aged9", "การคัดกรองผู้สูงอายุ 9 ด้าน (Basic/Community Screen STEP1)"),
            ],
          },
        ],
      },
    ],
  },
  {
    ...SERVICE_PLAN,
    topics: [
      {
        ...NCD,
        groups: [
          {
            subgroup: "",
            reports: [
              report(NCD, "", 10, "626c89f6b8d9f7ed90c72c719775eb07", "s_dm_screen", "ร้อยละของประชากรอายุ 35 ปีขึ้นไปที่ได้รับการคัดกรองเพื่อวินิจฉัยเบาหวาน"),
              report(NCD, "", 20, "9702fa28cd2ec73ecc6af89d14f46874", "s_ht_screen", "ร้อยละของประชากรอายุ 35 ปีขึ้นไปที่ได้รับการคัดกรองเพื่อวินิจฉัยความดันโลหิตสูง"),
              report(NCD, "", 30, "e9e461e793e8258f47d46d6956f12832", "s_ncd_screen_repleate1", "ร้อยละการตรวจติดตามยืนยันวินิจฉัยกลุ่มสงสัยป่วยโรคเบาหวาน"),
              report(NCD, "", 40, "b57439ff27302ade8c38d1dd189644a4", "s_ht_screen_follow", "ร้อยละการตรวจติดตามยืนยันวินิจฉัยกลุ่มสงสัยป่วยโรคความดันโลหิตสูง"),
            ],
          },
        ],
      },
      {
        ...DENTAL,
        groups: [
          {
            subgroup: "",
            reports: [
              report(DENTAL, "", 10, "abt2t2k4z4xeqzytwbave", "s_dental_0_5_cavity_free", "ร้อยละของเด็กอายุ0-5 ปี ฟันดีไม่มีผุ (Cavity Free) (คน)"),
              report(DENTAL, "", 20, "e07a6ff3cd63d34a759be4bff5c1a4c6", "s_kpi_dental28", "OHSP ร้อยละเด็ก 6 ปี ได้รับการเคลือบหลุมร่องฟันแท้ เฉพาะเขตรับผิดชอบ (คน) (ใช้แบบความครอบคลุม)"),
              report(DENTAL, "", 30, "1fb6b46f1d1fd42362f97072f4b3b653", "s_kpi_dental33", "OHSP ร้อยละผู้สูงอายุ ได้รับการตรวจช่องปาก เฉพาะเขตรับผิดชอบ (คน) (ใช้แบบความครอบคลุม)"),
            ],
          },
        ],
      },
    ],
  },
];
