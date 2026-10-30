// The PA sheets that BATCH_ALL reads, before F02: data sheets hold
// province-wide rows (อำเภอ 5401 and 5406). Covers every path of the PA
// calculation: annual target/result, quarter sums (kpi_master is_quarterly
// with effective_quarter, CONFIG isQuarterly, t_q/r_q and targetq/resultq
// columns, annual target with a zero result), s_aged9, the dental a/b pair,
// value_prefix and source_id virtual KPIs, and CONFIG units whose sheet does
// not exist yet (s_anc5, s_epi2, …).
// batch-all-before-f04.json is the BATCH_ALL response to these sheets from
// the code before F04.

const DATE_COM = "202610290915";

export const PA_SHEETS = {
  settings: [
    ["current_quarter", "current_year", "province_code", "district_code"],
    [2, 2569, 54, 5406],
  ],
  kpi_registry: [
    ["sheet_name", "category", "category_order"],
    ["kpi_master", "ตัวชี้วัดพื้นฐาน", 1],
    ["kpi_epi", "สร้างเสริมภูมิคุ้มกันโรค", 2],
  ],
  kpi_master: [
    ["table_name", "kpi_name", "is_quarterly", "target_months", "effective_quarter"],
    ["s_kpi_anc12", "ANC ครั้งแรก ≤ 12 สัปดาห์", "", "", ""],
    ["s_kpi_childdev2", "คัดกรองพัฒนาการ พบสงสัยล่าช้า", true, 8, 3],
    ["s_aged9", "คัดกรองผู้สูงอายุ 9 ด้าน", "", "", ""],
    ["s_dental_0_5_cavity_free", "เด็ก 0–5 ปี ฟันดีไม่มีผุ", "", "", ""],
    ["s_ht_screen_follow", "ติดตามยืนยันวินิจฉัย สงสัยความดัน", true, "", ""],
    ["s_dm_screen", "คัดกรองเบาหวาน 35 ปีขึ้นไป", false, "", ""],
  ],
  kpi_epi: [
    ["table_name", "kpi_name", "source_sheet", "value_prefix", "source_id"],
    ["s_epi1_bcg", "BCG", "s_epi1", "bcg", ""],
    ["s_epi2_dtp4", "DTP4", "s_epi2", "dtp4", ""],
    ["s_epi_complete_1", "ครบชุด อายุ 1 ปี", "s_epi_complete", "", "28dd2c7955ce926456240b2ff0100bde"],
    ["s_epi_complete_3", "ครบชุด อายุ 3 ปี", "s_epi_complete", "", "d1fe173d08e959397adf34b1d77e88d7"],
  ],
  s_kpi_anc12: [
    ["id", "hospcode", "areacode", "date_com", "b_year", "target", "result"],
    ["1c1b8e24aff59258a806f122e264031e", "10701", "54010101", DATE_COM, "2569", 30, 21],
    ["1c1b8e24aff59258a806f122e264031e", "10953", "54060101", DATE_COM, "2569", 12, 9],
    ["1c1b8e24aff59258a806f122e264031e", "10953", "54060102", DATE_COM, "2569", 8, 8],
    ["1c1b8e24aff59258a806f122e264031e", "10702", "54010205", DATE_COM, "2569", 22, 20],
    ["1c1b8e24aff59258a806f122e264031e", "10954", "54060203", DATE_COM, "2569", 15, 11],
  ],
  s_kpi_childdev2: [
    [
      "id", "hospcode", "areacode", "date_com", "b_year", "target", "result",
      "target1", "target2", "target3", "target4", "result1", "result2", "result3", "result4",
    ],
    ["684e99dc7538c8b1a97f19f91a100f08", "10701", "54010101", DATE_COM, "2569", 0, 0, 4, 5, 6, 7, 1, 1, 2, 2],
    ["684e99dc7538c8b1a97f19f91a100f08", "10953", "54060101", DATE_COM, "2569", 0, 0, 3, 2, 4, 5, 1, 0, 1, 1],
    ["684e99dc7538c8b1a97f19f91a100f08", "10954", "54060203", DATE_COM, "2569", 0, 0, 6, 4, 3, 2, 2, 1, 0, 1],
  ],
  s_aged9: [
    ["id", "hospcode", "areacode", "date_com", "b_year", "target", "result"],
    ["aa86b13e8cb60cae6c3216b7e3e5f151", "10953", "54060101", DATE_COM, "2569", 210, 180],
    ["aa86b13e8cb60cae6c3216b7e3e5f151", "10701", "54010101", DATE_COM, "2569", 330, 200],
    ["aa86b13e8cb60cae6c3216b7e3e5f151", "10954", "54060203", DATE_COM, "2569", 145, 0],
  ],
  s_dental_0_5_cavity_free: [
    ["id", "hospcode", "areacode", "date_com", "b_year", "a", "b"],
    ["abt2t2k4z4xeqzytwbave", "10953", "54060101", DATE_COM, "2569", 40, 52],
    ["abt2t2k4z4xeqzytwbave", "10954", "54060203", DATE_COM, "2569", 18, 30],
    ["abt2t2k4z4xeqzytwbave", "10701", "54010101", DATE_COM, "2569", 77, 90],
  ],
  s_ht_screen_follow: [
    [
      "id", "hospcode", "areacode", "date_com", "b_year", "target", "result",
      "t_q1", "t_q2", "t_q3", "t_q4", "r_q1", "r_q2", "r_q3", "r_q4",
    ],
    ["b57439ff27302ade8c38d1dd189644a4", "10953", "54060101", DATE_COM, "2569", 20, 15, 5, 6, 4, 5, 3, 4, 2, 6],
    ["b57439ff27302ade8c38d1dd189644a4", "10701", "54010101", DATE_COM, "2569", 31, 20, 8, 7, 9, 7, 5, 5, 5, 5],
  ],
  s_ncd_screen_repleate1: [
    [
      "id", "hospcode", "areacode", "date_com", "b_year", "target", "result",
      "targetq1", "targetq2", "targetq3", "targetq4", "resultq1", "resultq2", "resultq3", "resultq4",
    ],
    ["e9e461e793e8258f47d46d6956f12832", "10953", "54060102", DATE_COM, "2569", 9, 7, 2, 3, 1, 3, 2, 2, 1, 2],
    ["e9e461e793e8258f47d46d6956f12832", "10702", "54010205", DATE_COM, "2569", 14, 10, 4, 4, 3, 3, 3, 3, 2, 2],
  ],
  s_dm_screen: [
    [
      "id", "hospcode", "areacode", "date_com", "b_year", "target", "result",
      "result1", "result2", "result3", "result4",
    ],
    ["626c89f6b8d9f7ed90c72c719775eb07", "10953", "54060101", DATE_COM, "2569", 400, 0, 120, 95, 80, 60],
    ["626c89f6b8d9f7ed90c72c719775eb07", "10954", "54060203", DATE_COM, "2569", 350, 300, 100, 90, 70, 40],
    ["626c89f6b8d9f7ed90c72c719775eb07", "10701", "54010101", DATE_COM, "2569", 610, 480, 200, 150, 90, 40],
  ],
  s_epi1: [
    [
      "id", "hospcode", "areacode", "date_com", "b_year", "target", "result",
      "target01", "target02", "target03", "bcg_01", "bcg_02", "bcg_03",
    ],
    ["c88658f4d09acb8c76e6c06ffb58ebaf", "10953", "54060101", DATE_COM, "2569", 12, 10, 3, 2, 4, 3, 2, 3],
    ["c88658f4d09acb8c76e6c06ffb58ebaf", "10701", "54010101", DATE_COM, "2569", 16, 13, 5, 4, 5, 5, 4, 5],
    ["c88658f4d09acb8c76e6c06ffb58ebaf", "10954", "54060203", DATE_COM, "2569", 7, 4, 1, 3, 2, 1, 3, 1],
  ],
  s_epi_complete: [
    ["id", "hospcode", "areacode", "date_com", "b_year", "target", "result"],
    ["28dd2c7955ce926456240b2ff0100bde", "10953", "54060101", DATE_COM, "2569", 11, 10],
    ["d1fe173d08e959397adf34b1d77e88d7", "10953", "54060101", DATE_COM, "2569", 13, 12],
    ["f033ab37c30201f73f142449d037028d", "10953", "54060101", DATE_COM, "2569", 12, 9],
    ["28dd2c7955ce926456240b2ff0100bde", "10701", "54010101", DATE_COM, "2569", 21, 19],
    ["d1fe173d08e959397adf34b1d77e88d7", "10954", "54060203", DATE_COM, "2569", 7, 7],
  ],
};
