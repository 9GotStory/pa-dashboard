# SCHEMA — Song Health Data Center

> สถานะ: ร่าง v0.9 · 11 พ.ย. 2569 · คู่กับ [SPEC.md](SPEC.md) · คำศัพท์ตาม [GLOSSARY.md](GLOSSARY.md) · เหตุผลของโครงอยู่ใน `docs/adr/`
> ข้อมูลอ้างอิงที่ใช้ตรวจ: header จริงของชีต `PA-Data` (29 ต.ค. 2569), response ของ API แค็ตตาล็อกที่ได้มา 29 ต.ค. 2569, โค้ด `src/scripts/รหัส.js` และไฟล์ของ stat.bora ปี 2564–2568 (ดาวน์โหลด 6 พ.ย. 2569 และ `stat_m` ดาวน์โหลด 11 พ.ย. 2569, §11)

---

## 1. ชีตทั้งหมดใน `PA-Data`

| ชีต | สถานะ | ผู้เขียน | ผู้อ่าน |
|---|---|---|---|
| `settings` | แก้: เพิ่ม `district_code`, `deploy_hook_url` | ผู้ดูแล | GAS |
| `kpi_registry`, `kpi_master` | เดิม | ผู้ดูแล | GAS → PA |
| `kpi_epi` | เดิม (catalog อ่านเกณฑ์รายวัคซีน) | ผู้ดูแล | GAS → PA, catalog |
| `hospitals`, `tambon_master` | เดิม (catalog อ่านด้วย) | ผู้ดูแล | GAS → PA, catalog |
| `system_logs` | เดิม | GAS | ผู้ดูแล |
| ชีตข้อมูลปีปัจจุบัน `s_*` | เดิม ชื่อเดิม โครงเดิม แต่เหลือเฉพาะแถวของอำเภอ | GAS | GAS (`BATCH_ALL`, report) |
| ชีตข้อมูลปีย้อนหลัง `s_*_y{YYYY}` | ใหม่ | GAS | GAS (report) |
| `hdc_topics` | ใหม่ | ผู้ดูแล + GAS | GAS |
| `hdc_reports` | ใหม่ | GAS (คอลัมน์จาก API) + ผู้ดูแล | GAS |
| `sync_status` | ใหม่ | GAS | GAS, ผู้ดูแล |
| `registry_population` | ใหม่ (เฟส 2) | GAS (`save_registry_population` จากการอัปโหลดของผู้ดูแล) | GAS (`registry_population`), ผู้ดูแล |
| `registry_population_age` | ใหม่ (เฟส 2) | GAS (`save_registry_population` จากการอัปโหลดของผู้ดูแล) | GAS (`registry_population`), ผู้ดูแล |
| `registry_population_village` | ใหม่ (Track I) | GAS (`save_registry_population` จากการอัปโหลดของผู้ดูแล) | GAS (`registry_population`), ผู้ดูแล |

- แถว 1 เป็น header · ตัวอ่านใหม่ทั้งหมด (`hdc_topics`, `hdc_reports`, `sync_status`, `registry_population`, `registry_population_age`, `registry_population_village` และการอ่าน `hospitals`/`tambon_master` ใน `?action=catalog`) อ่านคอลัมน์ตามชื่อ header (trim + ตัวพิมพ์เล็ก) แบบเดียวกับตัวอ่านแท็บ registry ของเดิม ลำดับคอลัมน์ไม่มีผล · ตัวอ่านเดิม (`settings` = trim อย่างเดียว, ชีตข้อมูล = header ตรง ๆ) ไม่แก้
- ค่าติ๊กอ่านด้วย `parseBool` เดิม
- header จริงที่ตรวจจากชีต 29 ต.ค. 2569: `hospitals` = `hospcode, hospname, tambon_id` (17 แถว) · `tambon_master` = `id, name_th, district_id, zip_code` (8 แถวของ `5406`) · PA อ่านสองชีตนี้ตามตำแหน่งคอลัมน์ ส่วนตัวอ่านใหม่อ่านตามชื่อ · ตารางข้อมูลทั้ง 18 ตารางตรวจ header แล้วตาม §4.1 รวม `s_kpi_dental28`/`s_kpi_dental33` ซึ่งมี `target`/`result` และมีค่า `target` จริง (comment ใน `verify-all.js` ที่ว่า dental33 ไม่มี target เป็นข้อมูลเก่า)

## 2. รายละเอียดชีต

### 2.1 `settings` (แถว 1 = ชื่อค่า, แถว 2 = ค่า)

| คอลัมน์ | ชนิด | ค่าเริ่มต้น | กติกา |
|---|---|---|---|
| `current_quarter` | int 1–4 | `CONFIG.CURRENT_QUARTER` | เดิม |
| `current_year` | string `^\d{4}$` | `CONFIG.YEAR` | เดิม และเป็นปีสุดท้ายของ window |
| `province_code` | string `^\d{2}$` | `CONFIG.PROVINCE` | เดิม |
| `district_code` | string `^\d{4}$` | `CONFIG.DISTRICT` (`"5406"`, ใหม่) | **ใหม่** ตรวจแค่รูปแบบ 4 หลักด้วย `validateSetting` เดิม ค่าที่ไม่ผ่านใช้ค่าเริ่มต้นและ `Logger.log` แบบเดียวกับค่าอื่น · ไม่ตรวจว่าขึ้นต้นด้วย `province_code` เพราะกฎข้ามฟิลด์ทำใน `SETTINGS_SCHEMA` ไม่ได้และต้องแก้ `readSettings` ซึ่ง SPEC §12.4 ไม่อนุญาต ค่าผิดจังหวัดจะเห็นเองเพราะทุกตารางเหลือ 0 แถวหลังกรองและมี WARNING ใน `system_logs` |
| `deploy_hook_url` | string `^https://api\.cloudflare\.com/client/v4/pages/webhooks/deploy_hooks/[A-Za-z0-9-]+$` หรือว่าง | `""` | **ใหม่** ว่าง = ปิดการ rebuild อัตโนมัติ ค่าที่ไม่ตรงรูปแบบถือเป็นว่างและ `Logger.log` |

- เพิ่มใน `SETTINGS_SCHEMA` (ชนิด `string`) และเปลี่ยน `SETTINGS_CACHE_KEY` จาก `settings_v2` เป็น `settings_v3` เพราะรูปแบบที่แคชเปลี่ยน
- จำนวนปีย้อนหลังเป็นค่าคงที่ `CONFIG.HISTORY_YEARS = 5` ไม่ใช่ค่าในชีต
- window = ปี `current_year − 4` … `current_year` เรียงจากน้อยไปมาก (`getYearWindow(settings)`)

### 2.2 `hdc_topics` — หัวข้อที่เลือก (allowlist)

| คอลัมน์ | ผู้กรอก | ชนิด | ความหมาย |
|---|---|---|---|
| `cat_id` | ผู้ดูแล | `^[A-Za-z0-9_-]{8,64}$` | **key** รหัสหัวข้อ (= `subcatalogId` ของ HDC) ตัวพิมพ์ตามจริง |
| `order` | ผู้ดูแล | int ≥ 1 หรือว่าง | ลำดับหัวข้อ (SPEC §5.4) ค่าเริ่มต้นของ 6 หัวข้อใน §6 |
| `category_name` | GAS | text | จาก API ผ่าน `dcCleanName` (§3.4) |
| `main_report_id` | GAS | text | จากรายงานแรกของหัวข้อ |
| `main_report_name` | GAS | text | ชื่อหมวด ผ่าน `dcCleanName` (§3.4) |
| `report_count` | GAS | int | จำนวน `opendata_id` ไม่ซ้ำในการรีเฟรชล่าสุด |
| `last_refreshed_at` | GAS | datetime | เวลาที่รีเฟรชล่าสุด |

- ตรวจ `cat_id` ด้วยชุดอักษรแบบ nanoid ไม่ใช่ hex เพราะมีรหัสจริงที่ไม่ใช่ hex เช่น `77e69d3ad62b4737b87sds811129462` (31 ตัว) และไม่แปลงตัวพิมพ์ (§3, §5.2)
- แถวเริ่มต้น: 6 หัวข้อตามตาราง `hdc_topics` ใน §6 (ผล `find` ของ 18 ตาราง ยืนยันกับไฟล์ export 30 ต.ค. 2569)
- ลบแถวหัวข้อ = ซ่อนรายงานทั้งหัวข้อจาก snapshot และตารางของหัวข้อนั้นไม่ถูก sync ในฐานะ DC unit อีก (§2.3) ส่วนตารางที่ PA ใช้ยัง sync ตามเดิม

### 2.3 `hdc_reports` — รายงานในหัวข้อที่เลือก

| คอลัมน์ | ผู้กรอก | ชนิด | ความหมาย |
|---|---|---|---|
| `opendata_id` | GAS | `^[A-Za-z0-9_-]{8,64}$` | **key** = ค่า `id` ในข้อมูลดิบ (32 hex หรือรหัสสั้น 15–23 ตัว) ตัวพิมพ์ตามจริง |
| `report_name` | GAS | text | ชื่อรายงานจาก HDC ผ่าน `dcCleanName` (§3.4) |
| `source_table` | GAS | `^s_[a-z0-9_]+$` | ชื่อตาราง HDC และชื่อชีตข้อมูลปีปัจจุบัน |
| `enabled` | ผู้ดูแล | checkbox | ค่าเริ่มต้น FALSE |
| `subgroup` | ผู้ดูแล | text หรือว่าง | ชื่อกลุ่มภายในหัวข้อ |
| `order` | ผู้ดูแล | int ≥ 1 หรือว่าง | ลำดับในหัวข้อ ใช้หาลำดับกลุ่มด้วย |
| `report_type` | ผู้ดูแล | `coverage` \| `workload` | ชนิดหน้ารายงาน |
| `goal` | ผู้ดูแล | number 0–100 หรือว่าง | เกณฑ์ผ่าน (ร้อยละ) |
| `col_target` | ผู้ดูแล | ชื่อคอลัมน์ หรือว่าง | override เป้าหมายรายปี (§4.1) |
| `col_result` | ผู้ดูแล | ชื่อคอลัมน์ หรือว่าง | override ผลงานรายปี ต้องกรอกคู่กับ `col_target` |
| `cat_id` | GAS | text | หัวข้อ |
| `category_name` | GAS | text | ชื่อหัวข้อ ผ่าน `dcCleanName` (§3.4) |
| `main_report_id` | GAS | text | หมวด |
| `main_report_name` | GAS | text | ชื่อหมวด ผ่าน `dcCleanName` (§3.4) |
| `catalog_status` | GAS | `active` \| `removed` | `removed` = ไม่พบใน API ครั้งล่าสุด |
| `last_seen_at` | GAS | datetime | ครั้งล่าสุดที่พบใน API |

**รายงานที่ใช้งาน** คือแถวที่ (1) `enabled = TRUE` (2) `cat_id` อยู่ใน `hdc_topics` และ (3) `opendata_id` กับ `source_table` ผ่านรูปแบบ แถวที่ไม่ผ่านข้อ 3 จะถูกข้ามและบันทึก WARNING ด้วย `Logger.log` ไม่ใช่ `system_logs` เพราะ `readHdcReports` ถูกเรียกทุกครั้งที่แคช DC units หมดอายุ (ราวนาทีละครั้ง) และทุกครั้งที่ build ถ้าเขียนลง `system_logs` แถวผิดแถวเดียวจะดันประวัติ sync ออกจาก 500 แถวที่เก็บ (CODING_STANDARDS §2) · แถวแบบนี้เกิดได้เฉพาะเมื่อมีคนแก้คอลัมน์ของ GAS ด้วยมือ และเห็นได้จากจำนวนรายงานใน `?action=catalog`

- `source_table` บังคับขึ้นต้นด้วย `s_` ทุกตาราง summary ของ HDC ที่พบใช้รูปแบบนี้ และช่วยกันไม่ให้ชนชีตระบบ (`settings`, `hdc_reports` ฯลฯ) ซึ่งสำคัญเพราะชื่อนี้กลายเป็นชีตที่ `doPost` เขียนได้
- `source_table` ของรายงานที่ใช้งาน คือ DC units (SPEC §8)
- GAS เขียนคอลัมน์ผู้ดูแลแค่ 2 กรณี: ตอนเพิ่มแถวใหม่ (ตั้ง `enabled = FALSE` และปล่อยคอลัมน์อื่นว่าง) และตอนรัน `setup=dc_seed`

### 2.4 `sync_status` — ปีที่มีข้อมูลในแต่ละตาราง

| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `table` | text | ชื่อตาราง (ไม่ใช่ชื่อชีต `_y`) |
| `b_year` | string 4 หลัก | ปีงบประมาณ |
| `sheet` | text | ชีตที่เก็บจริง: `{table}` ถ้าเป็นปีปัจจุบัน หรือ `{table}_y{YYYY}` |
| `row_count` | int | จำนวนแถวที่บันทึกหลังกรองอำเภอ |
| `max_date_com` | string 12–14 หลัก | `date_com` มากที่สุดของปีนั้น (ใช้ตรวจ `Stale data`) |
| `synced_at` | datetime | เวลาที่บันทึก |

- key = (`table`, `b_year`) และ GAS เป็นผู้เขียนคนเดียว
- เมื่อบันทึกตารางใด GAS ลบแถวของตารางนั้นที่ `b_year` อยู่นอก window และเมื่อย้ายปี (§2.5) อัปเดต `sheet` ของแถวปีที่ถูกย้าย

### 2.5 ชีตข้อมูล `s_*` และ `s_*_y{YYYY}`

| เรื่อง | กติกา |
|---|---|
| ชีตปีปัจจุบัน | ชื่อ = ชื่อตาราง (`source_table` หรือ `CONFIG.KPIS[].sheet`) เก็บเฉพาะ `current_year` |
| ชีตปีย้อนหลัง | ชื่อ `{table}_y{YYYY}` หนึ่งชีตต่อปีใน window ที่ไม่ใช่ปีปัจจุบัน |
| header | ของแต่ละชีต = key ของแถวที่ MOPH ส่งมาในครั้งที่บันทึก ไม่รวม header ข้ามปี |
| แถวที่เก็บ | `areacode` ขึ้นต้นด้วย `district_code` เท่านั้น |
| ความซ้ำ | แต่ละชีตมาจากการบันทึกครั้งล่าสุดครั้งเดียว (แทนที่ทั้งชีต) |
| การเรียงแถว | ตามที่ MOPH ส่งมา (เดิม) ไม่เรียงใหม่ |
| คอลัมน์ข้อความ | `id`, `hospcode`, `areacode`, `vhid` (เดิม) |
| ค่าว่าง | ค่า falsy เขียนเป็น `""` (เดิม) ตอนอ่านถือเป็น 0 |
| `b_year` | เทียบแบบ string เสมอ ถ้าแถวไม่มีคอลัมน์นี้ GAS เติมเป็นปีที่ส่งมา |
| ไม่มี `areacode` | ปฏิเสธการบันทึก (ERROR) ในเฟส 1 |
| ขนาดชีต | หลังเขียน ตัดแถวว่างท้ายชีตออก (`deleteRows`) ให้ชีตมีแถวเท่าข้อมูล + header เพื่อไม่เปลือง cell |
| ปีนอก window | ไม่อ่าน ไม่เขียน และไม่ลบชีตอัตโนมัติ |

**การย้ายปีอัตโนมัติ (ทำก่อนเขียนชีตปีปัจจุบันทุกครั้ง):** อ่านชีตปีปัจจุบัน ถ้ามีคอลัมน์ `b_year` และพบแถวที่ `b_year ≠ year ที่กำลังบันทึก` ให้เก็บเฉพาะแถวที่ `areacode` ขึ้นต้นด้วย `district_code` (ตัวกรองเดียวกับ §3.3 ขั้น 4 เผื่อชีตยังเป็นแถวทั้งจังหวัดจากทางบันทึกเดิม แถวนอกอำเภอทิ้งพร้อม WARNING บอกจำนวน) แล้วจัดกลุ่มแถวที่เหลือตาม `b_year` แล้วสำหรับปี Z แต่ละปี (เฉพาะที่อยู่ใน window): ถ้า `sync_status` (table, Z) ชี้ไปชีต `_y{Z}` อยู่แล้ว และ `max_date_com` ของมัน ≥ `date_com` สูงสุดของแถวที่จะย้าย → **ไม่ทับ** แค่ทิ้งแถวเหล่านั้นจากชีตปีปัจจุบัน (กรณีมีคน sync ปี Z ซ้ำไปแล้วหลังเปลี่ยนปี) ไม่อย่างนั้นเขียนแทนที่ชีต `{table}_y{Z}` ด้วยแถวเหล่านั้น (header เดิมของชีตปีปัจจุบัน) และอัปเดต `sync_status` (Z → sheet `_y{Z}`, `row_count` และ `max_date_com` จากแถวที่ย้าย) · แถวของปีนอก window ทิ้งพร้อม WARNING · กรณีปกติ (ทุกแถวเป็นปีเดียวกับที่บันทึก) ไม่มีอะไรถูกย้าย

คอลัมน์ทั่วไปของแถว HDC: `id` (บางตารางไม่มี เช่น `s_dental_0_5_cavity_free`), `hospcode` 5 หลัก, `areacode` 8 หลัก (จังหวัด 2 + อำเภอ 2 + ตำบล 2 + หมู่ 2), `flag_sent`, `date_com` (`YYYYMMDDHHmm` และ `s_epi1` มีวินาทีต่อท้าย), `b_year` (ปีงบประมาณ พ.ศ.), `ip`

### 2.6 `registry_population` — ประชากรและบ้านรายตำบล (เฟส 2)

หนึ่งแถวต่อแถวระดับตำบลของไฟล์ `stat_m` (§11.1, ก่อน Track I คือ `stat_t` ซึ่งบรรทัดตำบลเหมือนกันทุกบรรทัด) ที่ `tt` ขึ้นต้นด้วย `district_code` และ `mm` เป็น `0` รวมแถวของสำนักทะเบียนเทศบาล: อำเภอสองได้ปีละ 10 แถว (8 ตำบลของสำนักทะเบียน `5406` และ 2 ตำบลของ `5489`) · คอลัมน์ตามลำดับในไฟล์ แล้วต่อด้วย `uploaded_at`

| คอลัมน์ | ชนิด | ความหมาย (ฟิลด์ของ stat.bora) |
|---|---|---|
| `yymm` | string `^\d{2}12$` | ปีเดือนข้อมูล (`YYMM`) เช่น `6812` = ณ 31 ธ.ค. 2568 |
| `cc` | string 2 หลัก | รหัสจังหวัด (`CC-CODE`) |
| `cc_name` | string | ชื่อจังหวัด (`CC-DESC`) |
| `rcode` | string 4 หลัก | รหัสสำนักทะเบียน (`RCODE-CODE`) เช่น `5406` อำเภอสอง, `5489` เทศบาลตำบลสอง |
| `rcode_name` | string | ชื่อสำนักทะเบียน (`RCODE-DESC`) เช่น "อำเภอสอง", "ท้องถิ่นเทศบาลตำบลสอง" |
| `tt` | string 8 หลัก | รหัสตำบล (`CCAATT-CODE`) 6 หลักแรก = `tambon_master.id` |
| `tt_name` | string | ชื่อตำบล (`CCAATT-DESC`) เช่น "ตำบลบ้านหนุน" |
| `mm` | string | รหัสหมู่บ้าน (`CCAATTMM-CODE`) แถวระดับตำบลเป็น `0` |
| `mm_name` | string | ชื่อหมู่บ้าน (`CCAATTMM-DESC`) แถวระดับตำบลเป็น `""` |
| `male`, `female`, `total` | int ≥ 0 | ประชากรชาย หญิง และทั้งหมด (`MALE`, `FEMALE`, `TOTAL`) |
| `house` | int ≥ 0 | จำนวนบ้าน (`HOUSE`) |
| `uploaded_at` | datetime | เวลาที่ GAS บันทึก ไม่ได้มาจากไฟล์ และ GET ไม่คืน (§3.9) |

- key = (`yymm`, `rcode`, `tt`) · ข้อความ trim แล้วและตัวเลขเป็น number แล้วตาม §11.1 ค่าที่เหลือตรงกับไฟล์ ผู้ดูแลเปิดชีตเทียบกับไฟล์ต้นทางได้ทีละแถว
- คอลัมน์รหัส (`yymm`, `cc`, `rcode`, `tt`, `mm`) ตั้งรูปแบบเป็นข้อความ (`@`) และเก็บเป็น string แบบคอลัมน์ข้อความของ §2.5
- **แทนที่ตาม `yymm`:** บันทึก `yymm` ใดแทนที่เฉพาะแถวของ `yymm` นั้น แถวของปีอื่นคงเดิม เก็บทุกปี ไม่มี window และไม่ลบปีเก่าเอง · แถวในชีตเรียงตาม `yymm` และภายในปีตามลำดับที่ส่งมา
- GAS สร้างชีตพร้อม header ตอนบันทึกครั้งแรก ไม่ต้องรัน setup · หลังเขียนตัดแถวว่างท้ายชีตแบบ §2.5
- ไม่อยู่ใน PA units, sync units หรือ `BATCH_ALL` และชื่อไม่ขึ้นต้นด้วย `s_` จึงไม่ชนกติกาชีตที่ `save_kpi_data` เขียนได้ (§2.3) · `save_registry_population` เขียนได้เฉพาะชีตนี้ §2.7 และ §2.8 (§3.8)

### 2.7 `registry_population_age` — จำนวนรายปีอายุรายตำบล (เฟส 2)

หนึ่งแถวต่อแถวตำบลของไฟล์อายุ (§11.1) ที่จับคู่กับแถวของ `registry_population` ใน `yymm` เดียวกันได้ (§11.2) อำเภอสองได้ปีละ 10 แถว · 224 คอลัมน์ตามลำดับนี้ ตั้งแต่ `tt_name` ถึง `total_t` เป็นลำดับในไฟล์

| คอลัมน์ | ชนิด | ความหมาย (ฟิลด์ของ stat.bora) |
|---|---|---|
| `yymm` | string `^\d{2}12$` | ปีเดือนข้อมูล จากชื่อไฟล์ (§11.1) |
| `rcode` | string 4 หลัก | สำนักทะเบียน จากการจับคู่บล็อก (§11.2) |
| `tt` | string 8 หลัก | รหัสตำบล จากการจับคู่ชื่อตำบล (§11.2) |
| `tt_name` | string | ชื่อตำบลตามไฟล์ (`DESC-CCAATT`) |
| `m0`, `f0`, `m1`, `f1`, … `m100`, `f100` | int ≥ 0 | ชายและหญิงอายุ 0 ถึง 100 ปี สลับกันทีละอายุ (`MALE_AGE(n)`, `FEMALE_AGE(n)`) |
| `m101`, `f101` | int ≥ 0 | อายุมากกว่า 100 ปี (`MALE_AGE(101)`, `FEMALE_AGE(101)`) |
| `lunar_m`, `lunar_f`, `lunar_t` | int ≥ 0 | เกิดปีจันทรคติ ชาย หญิง รวม (`*_TDOB`) |
| `central_m`, `central_f`, `central_t` | int ≥ 0 | มีชื่อในทะเบียนบ้านกลาง (`*_XHOUSE`) |
| `nonthai_m`, `nonthai_f`, `nonthai_t` | int ≥ 0 | ไม่ใช่สัญชาติไทย (`*_OTHER_NAT`) |
| `moving_m`, `moving_f`, `moving_t` | int ≥ 0 | อยู่ระหว่างการย้าย (`*_MOVE`) |
| `total_m`, `total_f`, `total_t` | int ≥ 0 | ยอดรวมทั้งหมด (`*_TOT`) |
| `uploaded_at` | datetime | เวลาที่ GAS บันทึก ไม่ได้มาจากไฟล์ และ GET ไม่คืน (§3.9) |

- key, รูปแบบข้อความของคอลัมน์รหัส (`yymm`, `rcode`, `tt`), การแทนที่ตาม `yymm`, การสร้างชีต และการไม่อยู่ใน units เหมือน §2.6
- แถวของ `yymm` หนึ่งต้องสอดคล้องกับ §2.6 ของ `yymm` เดียวกันเสมอ: ชุด (`rcode`, `tt`) เท่ากัน และ `total_m`, `total_f`, `total_t` เท่ากับ `male`, `female`, `total` ของแถวคู่กัน GAS ตรวจทั้งตอนบันทึกชีตนี้และตอนบันทึก §2.6 ซ้ำ (§3.8 ข้อ 12–14)

### 2.8 `registry_population_village` — ประชากรและบ้านรายหมู่บ้าน (Track I)

หนึ่งแถวต่อบรรทัดหมู่บ้านของไฟล์ `stat_m` (§11.1) คือบรรทัดที่ `tt` ขึ้นต้นด้วย `district_code` และ `mm` ไม่ใช่ `0` รวมบรรทัดไม่ระบุหมู่ (`mm` ลงท้าย `00`, GLOSSARY) และบรรทัดของสำนักทะเบียนเทศบาล: อำเภอสองได้ปีละ 94 แถว (§11.4) · 13 คอลัมน์ตามไฟล์ ชื่อ ลำดับ และชนิดเหมือน §2.6 แล้วต่อด้วย `uploaded_at` ต่างกันแค่สองคอลัมน์นี้

| คอลัมน์ | ชนิด | ความหมาย (ฟิลด์ของ stat.bora) |
|---|---|---|
| `mm` | string 8 หลัก | รหัสหมู่บ้าน (`CCAATTMM-CODE`) 6 หลักแรกเท่ากับ 6 หลักแรกของ `tt` · 2 หลักท้ายคือหมู่ที่ และ `00` คือไม่ระบุหมู่ |
| `mm_name` | string | ชื่อหมู่บ้าน (`CCAATTMM-DESC`) ซ้ำกันในตำบลเดียวได้ · บรรทัดไม่ระบุหมู่ก็มีชื่อตามไฟล์ (อำเภอสองคือ "บ้านกลาง") ซึ่งหน้าเว็บไม่แสดง (SPEC §9.2) |

- key = (`yymm`, `rcode`, `mm`) · หมู่บ้านเดียวกันมีได้สองแถวต่อปีเมื่อมีบรรทัดในสองสำนักทะเบียน (§11.4) ตอน build จึงรวมตาม `mm` (§11.3)
- รูปแบบข้อความของคอลัมน์รหัส (`yymm`, `cc`, `rcode`, `tt`, `mm`), การแทนที่ตาม `yymm` (เก็บทุกปี), การสร้างชีต และการไม่อยู่ใน units เหมือน §2.6
- แถวของ `yymm` หนึ่งรวมแล้วต้องเท่ากับแถวของ §2.6 ใน `yymm` เดียวกันตามเงื่อนไขของ §3.8 ข้อ 15 · GAS ตรวจตอนบันทึกชีตนี้เท่านั้น ไม่ตรวจตอนบันทึก §2.6 ซ้ำ (เหตุผลท้าย §3.8) · prebuild ตรวจซ้ำเฉพาะปีที่แสดง (§7)

## 3. GAS Web App

- GET ส่งค่าทาง query เท่านั้น และ POST ใช้ `Content-Type: text/plain` โดย body เป็น JSON
- ทุก response เป็น HTTP 200 กรณีผิดพลาดตอบ `{ "status": "error", "message": "…" }` (`createJsonError` เดิม)
- `doGet` ตรวจ `action` ตามลำดับ `diag` → `catalog` → `report` → `registry_population` (เฟส 2) ก่อนดู `sheet` · `doPost` แยกตาม `action`: `save_kpi_data`, `save_catalog`, `rebuild`, `save_registry_population` (เฟส 2)
- ฟังก์ชันใหม่ `sanitizeHdcId(v)` = trim + `^[A-Za-z0-9_-]{8,64}$` ไม่แปลงตัวพิมพ์ ใช้กับ `cat_id` และ `opendata_id` · รหัสใช้ตัวพิมพ์ตามจริงทุกที่ (ชีต, `?action=report&id=`, URL `/reports/{id}`, ลิงก์ HDC/Open Data, ชื่อไฟล์ CSV) เพราะรหัสสั้นของ HDC มีตัวพิมพ์ใหญ่ และคอลัมน์ `id` ในข้อมูลดิบเก็บตามนั้น (§5.2) ส่วน `sanitizeGuid` เดิมของ PA ไม่แก้
- ฟังก์ชันใหม่ `dcCleanName(v)` = ตัดแท็ก HTML → แทนช่องว่างทุกชนิดที่ติดกัน (รวม tab และขึ้นบรรทัด) ด้วยช่องว่างเดียว → trim ใช้กับ `report_name`, `category_name`, `main_report_name` ตอน `save_catalog` (§3.4) ไม่แปลง HTML entity เพราะไม่พบในแค็ตตาล็อก (§5.2)
- ฟังก์ชันชื่อชีต `sheetNameFor(table, year, settings?)` (`settings` ไม่ส่ง = `readSettings()`) = `table` ถ้า `year = current_year` ไม่อย่างนั้น `table + "_y" + year` ใช้ทุกที่ ห้ามประกอบชื่อเอง
- `catalog`, `report` และ `registry_population` ถือ script lock (`tryLock(30000)` ถ้าไม่ได้ตอบ error `Busy`) ตลอดการอ่าน เพื่อไม่ให้ build อ่านชีตที่ `saveTableYear` หรือ `save_registry_population` กำลัง clear/เขียนอยู่ (prebuild script จะ retry เอง)
- ผู้ถือ script lock คือ handler เท่านั้น: `doPost` ถือครั้งเดียวก่อนแยก action, `doGet` ถือสำหรับ `catalog`/`report`/`registry_population`, `syncAllData` และ `rebuildWebsiteMenu` ถือเอง · `saveTableYear`, ตัวบันทึกของ `save_catalog` และ `save_registry_population` และ `requestRebuild` ไม่เรียก `LockService` และระบุใน comment ว่า caller must hold the lock เพราะเอกสาร Apps Script บอกแค่ว่า `tryLock` ซ้ำ "has no effect if the lock has already been acquired" โดยไม่ระบุค่าที่คืน การถือซ้อนจึงไม่มีสัญญา (เทสต์: stub `LockService` นับว่าถูกถือครั้งเดียวต่อคำขอ) · ของเดิมใน `รหัส.js` (`readSettings`, `readKpiMasterConfig`) ยัง `tryLock` เองตอน cache miss แม้ถูกเรียกจาก handler ที่ถือ lock อยู่ ไม่แก้เพราะเป็นโค้ด PA ที่ใช้งานอยู่ handler จึงเรียกสองฟังก์ชันนี้ก่อนถือ lock (เติมแคช) และ `syncAllData` ซึ่งรันนานกว่าอายุแคช 60 วินาที อ่านครั้งเดียวก่อนถือ lock แล้วส่งค่าต่อให้ `saveTableYear` (`options.settings`, `options.kpiCfg`) และ `requestRebuild(reason, settings)` ฟังก์ชันภายในอ่านเองเฉพาะเมื่อไม่ได้รับค่า (#136)

### 3.1 `GET ?action=catalog`

ตอบ `GasCatalog` (§9) ยังไม่เรียง (prebuild script เป็นคนเรียงและสร้าง `catalog.json`)

| ฟิลด์ | ที่มา |
|---|---|
| `meta.current_year`, `meta.district_code` | `settings` |
| `meta.years` | window เรียงจากน้อยไปมาก |
| `meta.generated_at` | เวลาที่สร้าง response (ISO) |
| `areas` | `tambon_master` แถวที่ `district_id = district_code` → `{ id, name_th }` |
| `hospitals` | `hospitals` → `{ hospcode, hospname, tambon_id }` |
| `topics` | ทุกแถวของ `hdc_topics` ที่ `cat_id` ผ่านรูปแบบ |
| `reports` | รายงานที่ใช้งาน (§2.3) |
| `reports[].measure_goals` | แถวของ `kpi_epi` ที่ `source_sheet = source_table` และมี `value_prefix` → `{ [value_prefix]: target }` · แถวที่ `target` ไม่ใช่ตัวเลข 0–100 (รวมช่องว่าง) ถูกข้าม รายการนั้นจึงไม่มีเกณฑ์ เหมือนรายการที่ไม่มีใน `kpi_epi` (§4.4, §6, #112) |
| `reports[].years` | แถวของ `sync_status` ที่ `table = source_table` และอยู่ใน window เรียงตามปี |

ไม่แคช เพราะถูกเรียกเฉพาะตอน build และจากสคริปต์ผู้ดูแล

### 3.2 `GET ?action=report&id={opendata_id}`

1. `id` ผ่าน `sanitizeHdcId` และต้องเป็นรายงานที่ใช้งาน ไม่อย่างนั้นตอบ error `Unknown report`
2. สำหรับแต่ละปีใน `reports[].years` (จาก `sync_status`): อ่านชีตตาม `sync_status.sheet` ถ้าชีตหายไป ข้ามปีนั้นและบันทึก WARNING ใน `system_logs` (ปีนั้นยังอยู่ใน `report.years` #113)
3. กรองแถวของแต่ละปี:
   1. `areacode` ขึ้นต้นด้วย `district_code` (กันแถวเก่าแบบทั้งจังหวัดที่อาจค้างอยู่)
   2. ถ้าชีตมีคอลัมน์ `id` เก็บเฉพาะแถวที่ `id` = `opendata_id` ตรงตัวทุกตัวอักษร (ไม่แปลงตัวพิมพ์) เสมอ ไม่ว่าตารางจะมีกี่รายงาน (ถ้า `id` ในข้อมูลดิบไม่ตรงกับแค็ตตาล็อก จะได้ 0 แถวและเห็นชัดในขั้นตรวจรับ ดีกว่ารวมแถวของรายงานอื่นเข้ามาเงียบ ๆ) · ถ้าชีตไม่มีคอลัมน์ `id` (เช่น `s_dental_0_5_cavity_free`) ใช้ทุกแถว แต่ถ้าตารางนั้นมีรายงานที่ใช้งานมากกว่าหนึ่ง ตอบ error `Shared table without id column`
4. ตอบ `GasReport` (§9): `years` เป็น array ของ `{ b_year, headers, rows, max_date_com, sheet_rows, expected_rows }` เรียงปีน้อยไปมาก `rows` เป็น array ของ array ตามลำดับ `headers` (ไม่ใช่ object เพื่อลดขนาด) · `sheet_rows` = จำนวนแถวที่อ่านได้จากชีตหลังกรองอำเภอแต่ก่อนกรอง `id` · `expected_rows` = `sync_status.row_count` ของปีนั้น (prebuild script ใช้สองค่านี้ตรวจความครบ SPEC §6.2) · `max_date_com` = `date_com` สูงสุดของ `rows` ใน block นั้น (`""` ถ้าไม่มีแถว) ไม่ใช่ค่าของทั้งตารางใน `sync_status` ซึ่งอยู่ใน `report.years` แล้ว · `report` เป็น `DcReport` ตัวเดียวกับใน `?action=catalog` (#113)
5. ไม่แคช

### 3.3 `POST save_kpi_data` (แก้)

```ts
{ action: "save_kpi_data"; tableName: string; year?: string; total?: number; force?: boolean; data: Row[] | { data: Row[] } }
```

| ฟิลด์ | บังคับ | ความหมาย |
|---|---|---|
| `tableName` | ใช่ | ต้องอยู่ใน sync units (เดิม) |
| `year` | ไม่ | ค่าเริ่มต้น = `current_year` ต้องตรง `^\d{4}$` และอยู่ใน window ไม่อย่างนั้นตอบ error `Year outside window` |
| `total` | ไม่ | `total` จาก MOPH ถ้ามีและ `data.length < total` ตอบ error `Incomplete data` โดยไม่บันทึก |
| `force` | ไม่ | `true` = ข้ามการตรวจ `Stale data` · `syncAllData` ส่ง `true` เสมอ (ADR-0005) |
| `data` | ใช่ | แถวจาก MOPH (array หรือ envelope `{data:[…]}` แบบเดิม) |

ขั้นตอน (`doPost`/`syncAllData` ถือ script lock ไว้แล้ว `saveTableYear` ไม่ถือเอง):

1. ตรวจ `tableName`, `year`, `total` ตามตาราง
2. แกะ envelope ถ้าไม่ใช่ array ตอบ error ถ้าได้ 0 แถว คงข้อมูลเดิมและบันทึก WARNING (เดิม)
3. ถ้าแถวแรกไม่มี `areacode` ตอบ error `No areacode column`
4. เก็บเฉพาะแถวที่ `String(areacode)` ขึ้นต้นด้วย `district_code` ถ้าเหลือ 0 แถว คงข้อมูลเดิมและบันทึก WARNING
5. แถวที่ไม่มี `b_year` เติมเป็น `year` ส่วนแถวที่ `b_year ≠ year` ตัดทิ้งและบันทึก WARNING พร้อมจำนวน
6. ตรวจ `Stale data`: ถ้า `force` ไม่ใช่ `true` และ `sync_status` มีแถว (`tableName`, `year`) ที่ `max_date_com` มากกว่า `date_com` สูงสุดของแถวใหม่ ตอบ error `Stale data: existing {old} > incoming {new}` ไม่บันทึก
7. ถ้าชื่อคอลัมน์หรือค่าใดของแถวที่จะเขียน (แถวที่เหลือจากข้อ 4–5) อ่านเป็น string แล้วขึ้นต้นด้วย `=` ตอบ error `Invalid value` ไม่เขียนชีตใดเลย และบันทึก ERROR ใน `system_logs` โดยไม่ใส่ค่าดิบจากคำขอ เพราะ `setValues` เขียนค่าแบบนั้นเป็นสูตร (กฎเดียวกับ §3.8 ข้อ 6, #181) · แถวที่ถูกตัดทิ้งในข้อ 4–5 ไม่นับ เพราะไม่ถูกเขียน
8. ถ้า `year = current_year`: ทำการย้ายปีอัตโนมัติตาม §2.5 ก่อน
9. เขียนแทนที่ชีต `sheetNameFor(tableName, year)` ทั้งชีต: clear → header (key ของแถวใหม่ตามลำดับที่พบ) → ตั้งรูปแบบคอลัมน์ข้อความ → ค่า → ตัดแถวว่างท้ายชีต
10. upsert `sync_status` (`tableName`, `year`, `sheet`, `row_count`, `max_date_com`, `synced_at`) และลบแถวของตารางนี้ที่อยู่นอก window · ถ้าชีต `sync_status` ยังไม่มี สร้างพร้อม header ตรงนี้เลย (ไม่รอ `setup=datacenter` เพราะ trigger รายวันอาจรันก่อน)
11. บันทึก SUCCESS `Synced {table} {year}` พร้อมจำนวนแถว

Response: `{ status: "success"; year: string; sheet: string; received: number; count: number; archived: string[] }`

- `received` = จำนวนแถวที่ส่งมา · `count` = จำนวนแถวที่บันทึกหลังกรองอำเภอ (ความหมายเปลี่ยนจากเดิม ซึ่ง `count` เคยเป็นจำนวนแถวที่ส่งมา) · `archived` = ปีที่ถูกย้ายไปชีต `_y` ในครั้งนี้ (ปกติว่าง)
- `syncAllData` เรียกฟังก์ชันเดียวกันนี้โดยตรง (ไม่ผ่าน HTTP) ด้วย `year = current_year`, `total` จาก response ของ MOPH, `settings`/`kpiCfg` ที่อ่านไว้ก่อนถือ lock (§3) และ `force = true` เพราะข้อมูลที่ดึงจาก MOPH สดคือของจริงโดยนิยาม (ADR-0005)

### 3.4 `POST save_catalog` (ใหม่)

```ts
{ action: "save_catalog"; cat_id: string; category_name?: string; reports: ApiReportRow[] }
```

`reports` คือ array จาก `by-category-id` ตามที่ได้มา (§5.2)

ขั้นตอน (`doPost` ถือ script lock ไว้แล้ว):

1. `cat_id` ผ่าน `sanitizeHdcId` และต้องมีอยู่ใน `hdc_topics` ไม่อย่างนั้นตอบ error `Topic not in hdc_topics`
2. ถ้า `reports` ว่าง ตอบ error `Empty report list` และไม่แก้อะไร เพื่อกันการตั้ง `removed` ทั้งหัวข้อเมื่อดึงจาก API ไม่สำเร็จ
3. เก็บเฉพาะแถวที่ `opendata_id` ผ่าน `sanitizeHdcId`, `source_table` ตรง `^s_[a-z0-9_]+$` และ `cat_id` เท่ากับใน body ที่เหลือนับเป็น `skipped` · ถ้าไม่เหลือแถวที่ผ่านเลย ตอบ error `No valid reports` และไม่แก้อะไร เพราะแปลว่ารูปแบบ response เปลี่ยน (เช่นรหัสรูปแบบใหม่) หรือส่ง array ผิดหัวข้อ ไม่ใช่รายงานถูกถอดทั้งหัวข้อ (เหตุผลเดียวกับข้อ 2) · แถวที่เก็บ ทำความสะอาด `report_name`, `category_name`, `main_report_name` ด้วย `dcCleanName` ก่อน (ชื่อจาก HDC มีแท็ก `<font>` ช่องว่างซ้ำ และ tab §5.2)
4. กรองซ้ำด้วย `opendata_id` โดยเก็บตัวแรก (แถวซ้ำไม่นับใน `skipped`)
5. ทำทีละรายงาน:
   - มีอยู่แล้ว และ `cat_id` เดิมเท่ากับหัวข้อนี้หรือว่าง: อัปเดต `report_name`, `source_table`, `cat_id`, `category_name`, `main_report_id`, `main_report_name` ตั้ง `catalog_status = active` และ `last_seen_at = now` นับเป็น `updated`
   - มีอยู่แล้ว แต่ `cat_id` เดิมเป็นหัวข้ออื่น: ไม่แก้ (หัวข้อแรกได้สิทธิ์) นับเป็น `skipped` และบันทึก INFO
   - ยังไม่มี: เพิ่มแถวพร้อมคอลัมน์จาก API, `enabled = FALSE`, `catalog_status = active`, `last_seen_at = now` นับเป็น `added`
6. แถวเดิมของหัวข้อนี้ที่ไม่อยู่ในรายการ และยังเป็น `active` ตั้งเป็น `removed` นับเป็น `removed`
7. อัปเดตแถวใน `hdc_topics`: `category_name` (จาก body หรือรายงานแรก ผ่าน `dcCleanName`), `main_report_id`, `main_report_name` (ผ่าน `dcCleanName`), `report_count`, `last_refreshed_at`
8. ถ้าค่าใดที่คำขอนี้จะเขียนขึ้นต้นด้วย `=` (ตรวจหลังทำความสะอาดในข้อ 3 และหลัง trim `main_report_id`) ตอบ error `Invalid value` ไม่เขียนชีตใดเลย และบันทึก ERROR ใน `system_logs` โดยไม่ใส่ค่าดิบจากคำขอ เพราะ `setValues` เขียนค่าแบบนั้นเป็นสูตร (กฎเดียวกับ §3.3 ข้อ 7, #188) · ค่าที่นับคือคอลัมน์จาก API ของรายงานที่ข้อ 5 เพิ่มหรืออัปเดต และค่าที่ข้อ 7 จะใส่ `hdc_topics` ซึ่งมาจากรายงานแรกแม้รายงานนั้นอยู่ในหัวข้ออื่น · แถวที่ไม่ผ่านรูปแบบ แถวซ้ำ และแถวของหัวข้ออื่น ไม่นับ เพราะค่าของแถวเหล่านั้นไม่ถูกเขียน · ค่าที่อยู่ในชีตอยู่แล้วไม่นับ เพราะไม่ได้มาจากคำขอนี้
9. เขียน `hdc_reports` และ `hdc_topics` ทั้งชีตกลับ คงลำดับคอลัมน์เดิม และต่อท้ายคอลัมน์ที่ยังไม่มี
10. บันทึก SUCCESS

Response: `{ status: "success"; added: number; updated: number; removed: number; skipped: number }`

### 3.5 `GET ?sheet=BATCH_ALL` (แก้เล็กน้อย)

- การอ่านและคำนวณ **ไม่แก้** ยังอ่านชีตปีปัจจุบัน (ชื่อเดิม) ซึ่งตอนนี้มีเฉพาะแถวของอำเภอและปีเดียว
- `getSyncUnits` เดิมเปลี่ยนชื่อเป็น `getPaUnits` (ใช้คำนวณ `data`) · `getSyncUnits` ใหม่ = PA units ∪ DC units ใช้กับ whitelist ของ `doPost`, `syncAllData` และ `meta.kpi_config` รายการ DC ไม่มี `target_months`/`effective_quarter` (เป็น `null`)
- รายชื่อ DC units (ชื่อตารางเท่านั้น) แคชใน `CacheService` คีย์ `dc_units_v1` 60 วินาที เหมือน `kpi_master` · `?action=catalog` อ่านชีตตรงไม่ผ่านแคชนี้ · `clearConfigCache()` และ `save_catalog` ล้างคีย์นี้ด้วย · ถ้าชีต `hdc_reports` ยังไม่มี = ว่าง
- `fetchMophForKpi` (ใช้โดย `syncAllData`) ส่ง `limit = 5000` ทุกตาราง (หรือค่าของ unit ถ้ามากกว่า) และคืน `total` จาก envelope ให้ `saveTableYear` ตรวจ
- เพิ่ม `meta.years` = window (array ของ string เรียงน้อยไปมาก) ให้หน้า `/sync` ใช้ทำตัวเลือกปี
- นอกจากนี้ response เหมือนเดิมทุกอย่าง PA ไม่อ่านฟิลด์ใหม่

### 3.6 diag (เพิ่ม)

| เรียก | ผล |
|---|---|
| `?action=diag&pin=…&setup=datacenter` | สร้าง `hdc_topics`, `hdc_reports`, `sync_status` ที่ยังไม่มีพร้อม header และเพิ่ม header `district_code`, `deploy_hook_url` ใน `settings` ถ้ายังไม่มี รันซ้ำได้ ตอบ `{ created: […], settings_columns_added: […] }` |
| `?action=diag&pin=…&setup=dc_seed` | เขียนคอลัมน์ผู้ดูแลตาม §6 ลงแถวที่ `opendata_id` ตรงกัน ตอบ `{ applied: n, not_found: […] }` |

### 3.7 `POST rebuild` (ใหม่)

```ts
{ action: "rebuild"; reason?: string }
```

1. อ่าน `deploy_hook_url` จาก `settings` ถ้าว่าง ตอบ `{ status: "error", message: "Deploy hook not configured" }`
2. นับครั้งต่อวันใน `PropertiesService.getScriptProperties()` คีย์ `rebuild_count_{YYYY-MM-DD}` (วันตามเขตเวลา `Asia/Bangkok`) ถ้า ≥ 5 ตอบ error `Rebuild quota exceeded for today (5/5)` ไม่เรียก hook · ลบคีย์ของวันก่อน ๆ ทิ้ง (ผู้เรียกถือ script lock อยู่แล้ว ซึ่งกันสองคำขอพร้อมกันผ่านที่ 4/5 ทั้งคู่)
3. `UrlFetchApp.fetch(hook, { method: "post", muteHttpExceptions: true })` ถ้าได้ 2xx เพิ่มตัวนับ บันทึก INFO `Rebuild requested ({reason})` และตอบ `{ status: "success", remaining_today: n }` ไม่อย่างนั้นตอบ error พร้อม status code
4. ฟังก์ชันภายใน `requestRebuild(reason, settings?)` (`settings` ไม่ส่ง = `readSettings()` §3) ใช้โดย `syncAllData` และเมนู "Rebuild Website" ใน `onOpen` (ผ่าน `rebuildWebsiteMenu()` ที่ไม่รับ argument เพราะ menu handler ของ Apps Script ส่งค่าให้ไม่ได้ แล้วแสดงผลด้วย `toast`) โดยไม่ผ่าน HTTP · `requestRebuild` ไม่ถือ lock เอง `rebuildWebsiteMenu` ถือให้

### 3.8 `POST save_registry_population` (ใหม่ เฟส 2)

```ts
{ action: "save_registry_population"; kind: "population" | "village" | "age"; yymm: string; rows: RegistryPopulationRow[] | RegistryPopulationVillageRow[] | RegistryPopulationAgeRow[] }
```

| ฟิลด์ | ความหมาย |
|---|---|
| `kind` | `population` = แถวตำบลของ `stat_m` เขียน `registry_population` (§2.6) · `village` = แถวหมู่บ้านของ `stat_m` เขียน `registry_population_village` (§2.8, Track I) · `age` = แถวของไฟล์อายุ เขียน `registry_population_age` (§2.7) |
| `yymm` | ปีของข้อมูล เดือน 12 เสมอ |
| `rows` | แถวตาม `kind`: object ที่มี key ตรงกับคอลัมน์ของชีตนั้นทุกคอลัมน์ยกเว้น `uploaded_at` (type ใน §9) |

ชีตที่เขียนมาจาก `kind` เท่านั้น ไม่รับชื่อชีตจากคำขอ ฟิลด์อื่นใน body (เช่น `sheet`, `tableName`) ไม่มีผล · โค้ดอยู่ใน `src/scripts/dc-population.js` (SPEC §12.4)

ขั้นตอน (`doPost` ถือ script lock ไว้แล้ว ตัวบันทึกไม่ถือเอง และอ่าน `district_code` จาก `readSettings()` ที่ `doPost` เติมแคชไว้ก่อนถือ lock §3): ตรวจตามลำดับในตาราง ข้อแรกที่ไม่ผ่านตอบ `{ status: "error", message }` ตามคอลัมน์ขวา บันทึก ERROR ใน `system_logs` (เฉพาะข้อความ error และค่าที่ผ่านการตรวจแล้ว ไม่ใส่ค่าดิบจากคำขอ) และไม่เขียนชีตใดเลย

| # | ตรวจ | `message` |
|---|---|---|
| 1 | `kind` เป็น `population`, `village` หรือ `age` | `Unknown kind` |
| 2 | `yymm` เป็น string ที่ตรง `^\d{2}12$` และปีนั้นสิ้นสุดแล้ว: 25{yy} น้อยกว่าปี พ.ศ. ปัจจุบันตามเวลา `Asia/Bangkok` เพราะยอด ณ 31 ธ.ค. มีได้หลังปีนั้นจบเท่านั้น ปีอนาคตที่ปลอมขึ้นจึงไม่กลายเป็นปีล่าสุดบนหน้าแรก | `Invalid yymm` |
| 3 | `rows` เป็น array ที่มีอย่างน้อย 1 แถว | `Empty rows` |
| 4 | ทุกแถวเป็น object ที่มี key ครบตามคอลัมน์ของชีตตาม `kind` ยกเว้น `uploaded_at` ไม่ขาดและไม่เกิน | `Row keys do not match the header` |
| 5 | `yymm` ของทุกแถวเท่ากับ `yymm` ของ body | `Row of another yymm` |
| 6 | ทุกค่าตรงกับคอลัมน์ "ชนิด" ของ §2.6–2.8: คอลัมน์ string เป็น string ตามรูปแบบที่ระบุ (`cc` ตัวเลข 2 หลัก, `rcode` ตัวเลข 4 หลัก) ที่ไม่ขึ้นต้นด้วย `=` (`setValues` เขียนค่าแบบนั้นเป็นสูตร) และคอลัมน์จำนวนเป็นจำนวนเต็ม ≥ 0 | `Invalid value` |
| 7 | `tt` เป็นตัวเลข 8 หลักที่ขึ้นต้นด้วย `district_code` | `Row outside district` |
| 8 | (`population`) `mm` เป็น `"0"` · (`village`) `mm` เป็นตัวเลข 8 หลักที่ 6 หลักแรกเท่ากับ 6 หลักแรกของ `tt` | `Not a tambon row` · `Not a village row` |
| 9 | (`population`, `age`) (`rcode`, `tt`) ไม่ซ้ำกันในคำขอ · (`village`) (`rcode`, `mm`) ไม่ซ้ำกันในคำขอ | `Duplicate tambon row` · `Duplicate village row` |
| 10 | ชาย + หญิง = รวม: (`population`, `village`) `male + female = total` · (`age`) `{x}_m + {x}_f = {x}_t` ทั้ง 5 ชุด (`lunar`, `central`, `nonthai`, `moving`, `total`) | `Male + female does not equal total` |
| 11 | (`age`) Σ `m0…m101` + `lunar_m` + `central_m` + `nonthai_m` + `moving_m` = `total_m` และแบบเดียวกันของหญิง (สูตรของ stat.bora §11.1) | `Ages do not add up to total` |
| 12 | (`age`, `village`) `registry_population` มีแถวของ `yymm` นี้แล้ว | `No registry_population rows for this yymm` |
| 13 | (`age`) ชุด (`rcode`, `tt`) เท่ากับของแถว `registry_population` ใน `yymm` นี้ และทุกแถว `total_m`, `total_f`, `total_t` เท่ากับ `male`, `female`, `total` ของแถวคู่กัน | `Does not match registry_population` |
| 14 | (`population`) ถ้า `registry_population_age` มีแถวของ `yymm` นี้อยู่แล้ว ต้องตรงกับแถวที่ส่งมาตามเงื่อนไขของข้อ 13 | `Does not match registry_population_age` |
| 15 | (`village`) ชุด (`rcode`, `tt`) ของแถวที่ส่งมาเท่ากับของแถว `registry_population` ใน `yymm` นี้ (ทุกแถวตำบลมีหมู่บ้าน) และผลรวม `male`, `female`, `total`, `house` ของแถวที่ส่งมาต่อ (`rcode`, `tt`) เท่ากับแถวคู่กัน | `Villages do not add up to registry_population` |

ผ่านทุกข้อ: แทนที่แถวของ `yymm` นี้ในชีตตาม `kind` ด้วยแถวที่ส่งมา โดยสร้างชีตพร้อม header ถ้ายังไม่มี (§2.6) เติม `uploaded_at` = เวลาปัจจุบันทุกแถว แล้วบันทึก SUCCESS `Saved {ชีต} {yymm}` พร้อมจำนวนแถว

Response: `{ status: "success"; kind: "population" | "village" | "age"; yymm: string; count: number }` · `count` = จำนวนแถวที่เขียน

- ข้อ 12–14 ทำให้ตัวเลขของ `registry_population` กับ `registry_population_age` ตรงกันเสมอ แต่ก็ทำให้แก้ปีที่มีแถวอายุแล้วด้วย `stat_m` ที่ตัวเลขต่างจากเดิมไม่ได้ ถ้ากรมการปกครองแก้ไฟล์ของปีนั้น ผู้ดูแลลบแถวของปีนั้นใน `registry_population_age` ด้วยมือก่อน แล้วอัปโหลดทั้งสองไฟล์ใหม่ในชุดเดียวกัน
- `population` ไม่ตรวจกับแถวหมู่บ้านที่มีอยู่ (ไม่มีคู่ของข้อ 14) เพราะส่วนอัปโหลดส่ง `village` ของปีเดียวกันตามหลังในการอัปโหลดเดียวกัน (SPEC §12.1) การอัปโหลด `stat_m` ที่ตัวเลขเปลี่ยนจึงไม่ต้องลบแถวหมู่บ้านก่อน · ถ้า `population` สำเร็จแต่ `village` ไม่สำเร็จ แถวหมู่บ้านเดิมของปีนั้นอาจไม่ตรงกับแถวตำบลใหม่ ถ้าเป็นปีที่แสดง prebuild ล้มดัง ๆ (§7) เว็บคงเวอร์ชันก่อนหน้าจนกว่าผู้ดูแลอัปโหลด `stat_m` ปีนั้นใหม่
- ไม่มีการยืนยันตัวตนฝั่ง server เช่นเดียวกับ `save_kpi_data` (ADR-0005, SPEC §14)

### 3.9 `GET ?action=registry_population` (ใหม่ เฟส 2)

1. ถือ script lock แบบ `catalog`/`report` (§3) ถ้าไม่ได้ตอบ error `Busy` (prebuild script จะ retry เอง ส่วนอัปโหลดในหน้า `/sync` แสดงให้ผู้ดูแลลองใหม่)
2. อ่านสามชีต (§2.6–2.8) ตามชื่อ header (§1) ชีตที่ยังไม่มีถือว่าไม่มีแถว · ทุกแถวคืนเป็น object ตามคอลัมน์ของ §2.6–2.8 ยกเว้น `uploaded_at` (รูปเดียวกับ `rows` ของ §3.8) คอลัมน์ที่ชนิดเป็น string คืนเป็น string แม้คนแก้ชีตจนกลายเป็นตัวเลข คอลัมน์จำนวนคืนเป็น number · คอลัมน์ที่ชีตไม่มี (คนเปลี่ยนชื่อหรือลบ) และช่องจำนวนที่ว่างหรือไม่ใช่ตัวเลข ไม่อยู่ในแถวนั้น prebuild จึงล้มดัง ๆ ตาม §7 ไม่ใช่แสดง 0 บนเว็บ · ช่องจำนวนที่เป็นวันที่หรือ boolean ถือว่าไม่ใช่ตัวเลข ส่วนข้อความที่เป็นตัวเลขอ่านเป็น number · แถวที่ทุกคอลัมน์ที่ GET อ่านว่าง (ไม่นับ `uploaded_at`) ไม่นับเป็นแถว · แถวที่ `yymm` ว่างแต่คอลัมน์อื่นมีค่า อยู่ในคำตอบเป็นปีที่ `yymm` ว่าง และชีตที่ไม่มีคอลัมน์ `yymm` (เช่น แถว header ถูกลบ) คืนทุกแถวใต้แถวแรก prebuild จึงล้มดัง ๆ ตาม §7 ไม่ใช่ตัดแถวนั้นทิ้งแล้วเผยแพร่ยอดที่ขาด · แถวที่ `yymm` ว่างไม่นับเป็นแถวของ `yymm` ใดในข้อ 12–15 ของ §3.8
3. ตอบ `GasRegistryPopulation` (§9): `{ years }` คือทุก `yymm` ที่มีแถวในชีตใดชีตหนึ่ง เรียงน้อยไปมาก แต่ละปีเป็น `{ yymm, population, village, age }` คือแถวของปีนั้นจากแต่ละชีตตามลำดับในชีต (`[]` ถ้าชีตนั้นไม่มีหรือไม่มีแถวของปีนั้น เช่น `village` ของปีที่ยังไม่ได้อัปโหลดด้วย `stat_m`)
4. ยังไม่มีทั้งสามชีต → `years: []` ไม่ใช่ error
5. ไม่แคช

## 4. กติกาคำนวณรายงานชนิด `coverage`

ทำทีละ block ปี (`years[i]`) ด้วย `headers` ของ block นั้น ผลของแต่ละปีไม่ขึ้นต่อกัน

### 4.1 กลุ่มคอลัมน์

`MM` คือเดือนตามปีงบประมาณ เรียงเป็น `10, 11, 12, 01, 02, …, 09` (ต.ค. … ก.ย.)

| รหัส | เป้าหมาย | ผลงาน | ตารางในเฟส 1 |
|---|---|---|---|
| `ANNUAL` | `target` | `result` | `s_kpi_anc12`, `s_anc5`, `s_kpi_food`, `s_aged9`, `s_dm_screen`, `s_ht_screen`, `s_ncd_screen_repleate1`, `s_ht_screen_follow`, `s_kpi_dental28`, `s_kpi_dental33`, `s_epi_complete` |
| `Q_A` | `target1`…`target4` | `result1`…`result4` | `s_kpi_anc12`, `s_anc5`, `s_kpi_food`, `s_kpi_childdev4`, `s_kpi_childdev2` |
| `Q_B` | `targetq1`…`targetq4` | `resultq1`…`resultq4` | `s_ncd_screen_repleate1` |
| `Q_C` | `t_q1`…`t_q4` | `r_q1`…`r_q4` | `s_ht_screen_follow` |
| `M_A` | `target{MM}` | `result{MM}` | `s_epi_complete` |
| `M_B` | `target{MM}` | `{measure}_{MM}` | `s_epi1`, `s_epi2`, `s_epi3`, `s_epi5` |
| `OVERRIDE` | `hdc_reports.col_target` | `hdc_reports.col_result` | `s_dental_0_5_cavity_free` (`b`, `a`) |

### 4.2 การตรวจพบ

- กลุ่มคอลัมน์ถือว่า "มี" เมื่อ header มีครบทุกคอลัมน์ของกลุ่ม จึงไม่นับ `result1–9` ของ `s_aged9` (ผลรายด้าน) และ `result1–4` ของ `s_dm_screen`/`s_ht_screen` (ผลงานรายไตรมาสที่ไม่มีเป้าหมายรายไตรมาส #169) เป็นกลุ่มไตรมาส เพราะตารางเหล่านั้นไม่มี `target1–4` (§4.5)
- ไตรมาสใช้กลุ่มแรกที่พบตามลำดับ `Q_A` → `Q_B` → `Q_C` (ลำดับเดียวกับ `getQuarterSum`)
- รายการ (measure) ของ `M_B`: หา header ที่ตรง `^(.+)_(0[1-9]|1[0-2])$` แล้วนับ prefix ที่มีครบ 12 เดือน ไม่นับ prefix `target`/`result` และต้องมี `target{MM}` ครบ 12 เดือนด้วย
- ชื่อรายการที่แสดง = prefix ตัวพิมพ์ใหญ่ และเปลี่ยน `_` เป็น `-` เช่น `dtp_hb3` เป็น `DTP-HB3`
- รายการที่ผลงานรวมทั้งอำเภอว่างทุก block ปีไม่นับเป็นรายการ (SPEC §9.4 "ว่างทั้งปี") · รายการที่ผลงานรวมทั้งอำเภอของปีหนึ่งเป็น 0 ไม่มีข้อมูลปีนั้น
- หน้าวัคซีนรายการ (SPEC §9.4) ไม่มีรายการเริ่มต้น: ไม่เลือก = ภาพรวมของทุกรายการ · รายการที่เลือกไว้แต่ไม่มีในปีอื่น หรือไม่มีข้อมูลปีนั้น แสดงปีนั้นในแนวโน้มเป็น "—"

### 4.3 เป้าหมายและผลงานต่อแถว

`n(v)` = `Number(v)` เมื่อเป็นตัวเลขจำกัด ไม่อย่างนั้นเป็น 0 (`""` จึงเป็น 0)

| ช่วงเวลา | วิธีหา (ใช้ข้อแรกที่ใช้ได้) |
|---|---|
| `year` | 1. `OVERRIDE` · 2. `M_B` ของรายการที่เลือก: Σ `target{MM}`, Σ `{measure}_{MM}` · 3. `ANNUAL` · 4. Σ ไตรมาสทั้ง 4 · 5. Σ `M_A` ทั้ง 12 เดือน · 6. ไม่มีข้อใดใช้ได้: แสดง "ไม่รู้จักโครงสร้างตาราง ต้องกำหนด col_target/col_result" |
| `q1`–`q4` | กลุ่มไตรมาสที่ตรวจพบ: `target`/`result` ของไตรมาสนั้น · หน้าวัคซีนรายการ (`M_B` ไม่มีกลุ่มไตรมาส, SPEC §9.4): Σ 3 เดือนของไตรมาสนั้น (q1 = ต.ค.–ธ.ค.) |
| `m10`–`m09` | `M_A`: `target{MM}`/`result{MM}` หรือ `M_B`: `target{MM}`/`{measure}_{MM}` |

- หน้ารายงานแสดงตัวเลือกช่วงเวลาเฉพาะระดับที่หาได้ และไม่ว่างทั้งอำเภอทั้งปี (SPEC §9.4)
- "ทั้งปี" ของตารางที่มีแต่รายไตรมาส (`s_kpi_childdev4`, `s_kpi_childdev2`) คือผลรวม 4 ไตรมาส ซึ่งต่างจาก PA ที่ตั้ง `target_months = 9` / `effective_quarter = 3` ให้ KPI สองตัวนี้ (รวมแค่ 3 ไตรมาส) เป็นความต่างโดยตั้งใจ: Data Center แสดงตามข้อมูล HDC ส่วน PA แสดงตามรอบประเมิน และต้องระบุไว้ใน "เกี่ยวกับรายงานนี้"

### 4.4 การรวมและการแสดง

- เลือกแถวตาม SPEC §10 ข้อ 1
- `T` = Σ เป้าหมาย, `R` = Σ ผลงาน และ `pct` = `R / T × 100` เมื่อ `T > 0` ไม่อย่างนั้น `null`
- จัดกลุ่มรายตำบลด้วย `areacode.slice(0, 6)` แล้วหาชื่อจาก `areas` ถ้าไม่พบแสดง "รหัสพื้นที่ {6 หลัก}"
- จัดกลุ่มรายหน่วยบริการด้วย `hospcode` แล้วหาชื่อจาก `hospitals` ถ้าไม่พบแสดง "หน่วยบริการ {hospcode}"
- แนวโน้ม: คำนวณซ้ำทีละ block ปี
- ผ่านเกณฑ์เมื่อ `pct ≥ goal` โดยเทียบค่าก่อนปัดเหมือน PA และแสดงร้อยละด้วย `formatPct` ใน `src/lib/dc/format.ts` (ทศนิยม 2 ตำแหน่ง สำเนาของ PA)
- เกณฑ์ของรายการวัคซีน = `measure_goals[measure]` อย่างเดียว ไม่มี → ไม่มีเกณฑ์ (`null`) ไม่ใช้ `goal` ของรายงาน (SPEC §9.4, ADR-0015)
- วันที่ข้อมูล = `max_date_com` ของ block ปีที่เลือก แปลงเลข 12–14 หลักเป็นวันที่ไทยด้วย `formatThaiDate` ใน `src/lib/dc/format.ts` (เขียนใหม่ให้ผลเหมือน PA ไม่ import ไฟล์ PA)

### 4.5 คอลัมน์ที่ยังไม่แสดงในเฟส 1

ความหมายมาจาก `COLUMN_COMMENT` ของ `report_schema` (§5.4 ตรวจ 6 พ.ย. 2569) คอลัมน์ที่ `COLUMN_COMMENT` ว่างยังไม่รู้ความหมาย ไม่ตั้งชื่อเอง

| ตาราง | คอลัมน์ | ความหมาย |
|---|---|---|
| `s_kpi_food` | `r1`–`r6` | เด็กอายุครบ 6 เดือนที่แม่หรือผู้เลี้ยงดูตอบว่ากินนมแม่อย่างเดียว ช่วงอายุ 1–6 เดือนตามเลข |
| `s_kpi_food` | `total` | "จำนวนรวม" ไม่ระบุว่ารวมอะไร |
| `s_aged9` | `result1`–`result9` | คัดกรองรายด้าน ตามเลข: การมองเห็น · การกลั้นปัสสาวะ · การได้ยิน · การปฏิบัติกิจวัตรประจำวัน · ความคิดความจำ · ภาวะซึมเศร้า (2Q) · การเคลื่อนไหว · สุขภาพช่องปาก · ภาวะขาดสารอาหาร |
| `s_aged9` | `result{n}_1`, `result{n}_2` | ด้าน n: `_1` ปกติ (ด้าน 7 "ไม่เสี่ยง") · `_2` เสี่ยง (ด้าน 2 "มีปัญหา", ด้าน 5 และ 6 "ผิดปกติ") |
| `s_aged9` | `result6_3` | ภาวะซึมเศร้า "2Q+ผิดปกติ" |
| `s_dm_screen` | `result1`–`result4` | ผลงานคัดกรองเบาหวานรายไตรมาส 1–4 ไม่สะสม (Σ = `result` ทุก block ปีใน snapshot 4 พ.ย. 2569) ไม่มีเป้าหมายรายไตรมาส (#169) |
| `s_ht_screen` | `result1`–`result4` | ผลงานคัดกรองความดันโลหิตสูงรายไตรมาส 1–4 แบบเดียวกับ `s_dm_screen` (#169) |
| `s_ht_screen_follow` | `r1`, `r2` | รวมทั้งปีงบประมาณ ได้รับการติดตามโดยทำ HBPM [A1] / OBPM [A2] (`target` คือ [B] และ `result` คือ [A] ไม่นับซ้ำ) |
| `s_ht_screen_follow` | `r1_q1`–`r1_q4`, `r2_q1`–`r2_q4` | A1 / A2 รายไตรมาส |

`COLUMN_COMMENT` ว่าง:

| ตาราง | คอลัมน์ |
|---|---|
| `s_ht_screen` | `yymm`, `date_fz` |
| `s_ncd_screen_repleate1` | `yymm`, `date_fz`, `target_13`, `result_13`, `non_follow180_13`, `over180` |
| `s_ht_screen_follow` | `target_13`, `result_13`, `r_home_bp_13`, `r_hosp_bp_13`, `non_follow90_13`, `over90` |
| `s_dental_0_5_cavity_free` | `c` (`a`, `b` ก็ว่าง ใช้ตาม `col_target`/`col_result` ของ seed §6) |

ไม่ใช้เป็นตัวชี้วัดเลย: `flag_sent`, `ip`

ผลการวิเคราะห์ตารางรายตารางอยู่ใน §4.6 ซึ่งแทนตารางข้างบนเมื่อขัดกัน

### 4.6 การวิเคราะห์ตาราง (Track J)

ความหมายของทุกคอลัมน์ใน 18 ตารางต้นทาง (21 รายงาน) ที่หน้า `/reports/{id}` รายตารางใช้ ไม่รวม `id`, `hospcode`, `areacode`, `date_com`, `b_year` ที่ความหมายเหมือนกันทุกตาราง (§2.5)

**ที่มาและวันที่ตรวจ**

- **[S]** = `COLUMN_COMMENT` ของ `report_schema` (§5.4) ดึง 12 พ.ย. 2569 ได้ 200 ทั้ง 18 ตาราง · **[H]** = หัวตารางภาษาไทยบนหน้า `https://hdc.moph.go.th/pre/public/standard-report-detail/{opendata_id}` เปิดใน Chrome 12 พ.ย. 2569 (หน้านี้เป็น JS ล้วน `curl` อ่านไม่ได้ และ ADR-0010 ไม่ให้ปลอม header เป็นเบราว์เซอร์) · หน้าแสดงจังหวัดแพร่ปี 2569 รายอำเภอ วันที่ประมวลผล 11–12 พ.ย. 2569 ซึ่งใหม่กว่า `date_com` ส่วนใหญ่ใน snapshot (9 พ.ย.) ตัวเลขบางตัวจึงต่างกันเล็กน้อย · จับคู่หัวตารางกับคอลัมน์ด้วยแถวอำเภอสอง ทั้งปีและรายไตรมาส · ทั้งสองแบบนับเป็น **ยืนยันแล้ว**
- **อนุมาน** = ความหมายจากตัวเลขของ snapshot และชื่อรายงาน ระบุเหตุผลทุกครั้ง · คอลัมน์ที่อนุมานไม่แสดงเป็นอัตราและไม่ตีความทางคลินิก (GLOSSARY "ยืนยันแล้ว / อนุมาน")
- ตัวเลขใน §4.6 มาจาก snapshot `public/data/` ยกเว้นที่ระบุว่ามาจากหน้า HDC · snapshot build 11 พ.ย. 2569 (`latest_date_com` `202611110600`) ตรวจ 12 พ.ย. 2569 · ยอดอ้างอิงคือผลรวมทั้งอำเภอของปี 2569 รูป `เป้าหมาย/ผลงาน` · `n(v)` ตาม §4.3
- ต้นแบบ V0.4.2 ตรงกับ snapshot ทุกค่าที่มี: EPI1 เป้าหมายรายเดือนและทั้ง 20 รายการปี 2569 และ 2568 · AGED9 เป้าหมาย ผลงาน และ 9 ด้านปี 2569 และ 2568

**ผลการเปิดหน้า HDC ของคอลัมน์ที่ต้องยืนยันเป็นพิเศษ**

| ตาราง | คอลัมน์ | `opendata_id` | ผล |
|---|---|---|---|
| `s_dental_0_5_cavity_free` | `a`, `b`, `c` | `abt2t2k4z4xeqzytwbave` | ยืนยันได้ · สอง 1,361/954/795 ตรงกับ snapshot (§4.6.11) |
| `s_kpi_food` | `total`, `r1`–`r6` | `4164a7c49fcb2b8c3ccca67dcdf28bd0` | ยืนยันได้ · สอง 166 และ 10/7/77/18/60/15 ตรงกับ snapshot (§4.6.6) |
| `s_ncd_screen_repleate1` | `target_13`, `result_13`, `non_follow180_13`, `over180` | `e9e461e793e8258f47d46d6956f12832` | ยืนยันได้บางส่วน · `target_13`/`result_13` ยืนยันได้ · `non_follow180_13`/`over180` ตัวเลขบนหน้าไม่ตรงกับ snapshot จึงเป็นอนุมานจากชื่อคอลัมน์ (§4.6.9) |
| `s_ht_screen_follow` | `target_13`, `result_13`, `r_home_bp_13`, `r_hosp_bp_13`, `non_follow90_13`, `over90` | `b57439ff27302ade8c38d1dd189644a4` | ยืนยันได้ · สอง ตรงกับ snapshot ทุกคอลัมน์ (§4.6.10) |
| `s_aged9` | `result{k}_1`, `_2`, `result6_3` | `aa86b13e8cb60cae6c3216b7e3e5f151` | ยืนยันได้ (หัวตารางตรงกับ [S]) · ความผิดปกติของด้าน 1 และ 6 อยู่บนหน้าด้วย (§4.6.7) |
| `s_kpi_childdev4` | B / A | `1b60d68b1cb5b003fcba38a4a0e4027b` | ยืนยันได้ · สอง 4 ไตรมาสตรงกับ snapshot (§4.6.3) |
| `s_kpi_childdev2` | B / A | `684e99dc7538c8b1a97f19f91a100f08` | ยืนยันได้ · สอง 4 ไตรมาสตรงกับ snapshot (§4.6.3) |
| `s_epi1` | ทุกคอลัมน์ (ไม่มี comment เลย) | `c88658f4d09acb8c76e6c06ffb58ebaf` | ยืนยันได้ 6 คอลัมน์ตรงตัว · อีก 14 คอลัมน์ยืนยันได้ระดับกลุ่มที่ตัวเลขเท่ากัน การจับคู่รายตัวในกลุ่มเป็นอนุมาน (§4.6.4) |
| `s_epi2` | `mmr2_{MM}`, `pcv4_{MM}` | `71e49e4b61aafee17761601c506d5f85` | ยืนยันได้ · ทั้ง 6 รายการจับคู่ด้วยตัวเลขได้ตรงตัว (§4.6.4) |

#### 4.6.1 ข้อที่เหมือนกันทุกตาราง

- header ของแต่ละตารางเหมือนกันทุกปีที่มีใน snapshot (2565–2569) · `s_dental_0_5_cavity_free` มีแค่ปี 2569 · `s_ht_screen_follow` ไม่มี block ปี 2567 (#258 ไม่ใช่ข้อมูลของ HDC)
- `areacode` 8 หลักขึ้นต้น `5406` ทุกแถว · `date_com` 12 หลัก ยกเว้น `s_epi1` ปี 2569 ที่ 14 หลัก (`20261109193511`)
- **ช่องว่างแทนศูนย์:** ไม่มีช่องตัวชี้วัดใดเป็นเลข 0 เลย (เลข 0 มีแค่ใน `flag_sent`) ทุกศูนย์เป็น `""` จึงรู้ว่า "ไม่ได้เก็บ" ได้จากผลรวมทั้งอำเภอของปีนั้นเป็น 0 เท่านั้น
- **รูปแถว:** ตารางรายหมู่บ้าน `areacode` = หมู่บ้าน · `54060610` มีสองแถวคือ `hospcode` `06423` และ `06424` ทุกตารางรายหมู่บ้าน ตารางที่ครบทุกหมู่บ้านจึงมี 86 แถว 85 `areacode` · ตาราง **1 แถวต่อหน่วยบริการ** (`s_kpi_childdev4`, `s_kpi_childdev2`, `s_ncd_screen_repleate1`, `s_ht_screen_follow`): แต่ละ `hospcode` มี `areacode` เดียวทุกปี และ 6 หลักแรกตรงกับ `tambon_id` ของหน่วยใน `catalog.json` ทุกหน่วย จึง **อนุมาน** ว่า `areacode` คือที่ตั้งหน่วย ไม่ใช่ที่อยู่ของคน
- **ไม่ใช้:** `flag_sent` (ทุกตาราง ยกเว้น `s_dental_0_5_cavity_free`) ไม่อยู่ใน `report_schema` เป็น 1 ทุกแถวปี 2565–2566 และ 0 ตั้งแต่ 2567 · `ip` ไม่อยู่ใน `report_schema` ว่างทุกแถว ยกเว้น `s_kpi_dental33` ปี 2566 ที่เป็น `203.157.102.154` ทั้ง 86 แถว · `yymm`, `date_fz` (`s_ht_screen`, `s_ncd_screen_repleate1`) comment ว่างและว่างทุกแถว · อนุมานว่าเป็นค่าระบบของ HDC ไม่ใช่ตัวชี้วัด

#### 4.6.2 `s_kpi_anc12` และ `s_anc5` (ANC)

รายหมู่บ้าน · ทั้งปี + `Q_A` · Σ ไตรมาส = ทั้งปีทุกแถวทุกปี

| คอลัมน์ | `s_kpi_anc12` | `s_anc5` | ที่มา |
|---|---|---|---|
| `target`, `target1`–`target4` | หญิงไทยในเขตรับผิดชอบที่สิ้นสุดการตั้งครรภ์ แฟ้ม LABOR ทั้งปี / ไตรมาส 1–4 | หญิงไทยในเขตรับผิดชอบสิ้นสุดการตั้งครรภ์ด้วยการคลอด LABOR (BTYPE ≠ 6) ทั้งปี / ไตรมาส 1–4 | [S] |
| `result`, `result1`–`result4` | หญิงตาม B ที่ฝากครรภ์ครั้งแรกเมื่ออายุครรภ์ ≤ 12 สัปดาห์ แฟ้ม ANC | หญิงตาม B ที่ฝากครรภ์คุณภาพครบ 5 ครั้งตามเกณฑ์ แฟ้ม ANC | [S] |

- ยอด 2569: `s_kpi_anc12` 84/66 (41 แถว) · `s_anc5` 82/60 (40 แถว) · ไตรมาส anc12 22/20, 17/14, 23/19, 22/13 · anc5 22/20, 15/12, 23/17, 22/11
- ความผิดปกติ: ไม่พบ · คำถามค้าง: ไม่มี

#### 4.6.3 `s_kpi_childdev4` และ `s_kpi_childdev2` (พัฒนาการเด็ก)

1 แถวต่อหน่วยบริการ (17 แถว) · `Q_A` อย่างเดียว ไม่มีทั้งปี · ทั้งปี = Σ 4 ไตรมาส (§4.3)

| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `target1`–`target4` | "ไตรมาส n B" | [S] (comment บอกแค่ B) |
| `result1`–`result4` | "ไตรมาส n A" | [S] (comment บอกแค่ A) |
| B / A ของ `s_kpi_childdev4` | B = เด็กไทยอายุ 9, 18, 30, 42 และ 60 เดือนทุกคนที่อยู่อาศัยในพื้นที่รับผิดชอบ · A = เด็กตาม B ที่ได้รับการตรวจคัดกรองและพัฒนาการสมวัยครั้งแรกและหลังการติดตาม (1B260) | [H] · B ของ childdev4 ≥ B ของ childdev2 ทุกหน่วยทุกไตรมาสปี 2568 และ 2569 |
| B / A ของ `s_kpi_childdev2` | B = เด็กตามช่วงอายุเดียวกันที่ได้รับการตรวจคัดกรองพัฒนาการจริง · A = มีพัฒนาการสงสัยล่าช้าครั้งแรกและส่งต่อทันที (1B261+1B262) | [H] |

- ยอด 2569: childdev4 1,083/861 (ไตรมาส 286/276, 297/264, 258/218, 242/103) · childdev2 906/168 (278/57, 279/48, 228/37, 121/26)
- ความผิดปกติ: A ของ childdev4 + A ของ childdev2 เกิน B ของ childdev2 ใน 35 จาก 68 ช่องหน่วย×ไตรมาสปี 2569 เพราะ A ของ childdev4 นับคนที่สมวัยหลังการติดตามด้วย [H] จึงไม่ใช่การแบ่ง B เป็นสองกลุ่ม · ร้อยละไตรมาส 4 ของ childdev4 ต่ำกว่าไตรมาสอื่นทุกปี 2565–2569 (2565 58.8%, 2566 39.2%, 2567 51.7%, 2568 57.1%, 2569 42.6%) และปี 2569 ต่ำทั้งจังหวัด (64.12% บนหน้า HDC) จึงเป็นรูปแบบประจำ ไม่ใช่ข้อมูลของอำเภอสองที่ยังไม่ครบ · ของ childdev2 ที่ต่ำในไตรมาส 4 คือ B ไม่ใช่ร้อยละ: B ไตรมาส 4 น้อยกว่าไตรมาสอื่นทุกปี 2565–2569 (209, 137, 165, 164, 121 ส่วนไตรมาสอื่นน้อยสุด 216) แต่ร้อยละไตรมาส 4 อยู่ในช่วงเดียวกับไตรมาสอื่น (ตรวจ 12 พ.ย. 2569)
- คำถามค้าง: ทำไมไตรมาส 4 ต่ำทุกปี (อาจเป็นรอบติดตามที่ยังไม่จบ แต่ตัวเลขไม่พอยืนยัน)

#### 4.6.4 `s_epi1`, `s_epi2`, `s_epi3`, `s_epi5` (วัคซีนรายการ)

รายหมู่บ้าน · `M_B`: `target{MM}` + `{measure}_{MM}` · ร้อยละรายไตรมาสได้จากผลรวมเดือน · รายการตามลำดับ header · ทุกแถวทุกปี ผลงานของรายการ ≤ เป้าหมายในเดือนเดียวกัน

| ตาราง | คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|---|
| `s_epi1` | `target{MM}` | เด็กอายุครบ 1 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด (Type area 1 และ 3) | [H] · comment ว่างทั้งตาราง · B รายไตรมาสของสอง 48/39/43/51 ตรงกับ snapshot · Σ ทั้งปีเท่ากับ `target` ของ `s_epi_complete` อายุ 1 ปีทุกปี 2565–2569 |
| `s_epi1` | `hbv`, `ipv1`, `ipv`, `rota`, `hib3`, `mmr` `_{MM}` | HBV แรกเกิด · IPV 2 เดือน · IPV 4 เดือน · Rota (ครบถ้วนตามเกณฑ์) · Hib 6 เดือน · MMR 9 เดือน | [H] · ตัวเลข 4 ไตรมาสของสองตรงกับรายการเดียวบนหน้า (`mmr` ต่าง 1 ในไตรมาส 3 เพราะหน้าใหม่กว่า) |
| `s_epi1` | `bcg`, `rota1` `_{MM}` | BCG แรกเกิด · Rota 2 เดือน | [H] ยืนยันว่าสองคอลัมน์นี้คือสองรายการนี้ (ตัวเลขเท่ากันทุกไตรมาส) · ตัวไหนคือรายการไหนเป็นอนุมานจากชื่อคอลัมน์ |
| `s_epi1` | `dtp2`, `hbv4` `_{MM}` | DTP 4 เดือน · HBV 4 เดือน | [H] ยืนยันว่าสองคอลัมน์นี้คือสองรายการนี้ · ตัวไหนคือรายการไหนเป็นอนุมานจากชื่อคอลัมน์ |
| `s_epi1` | `dtp1`, `dtp_hb3`, `hbv2`, `hbv3`, `hib1`, `hib2`, `opv3` `_{MM}` | DTP 2 เดือน · DTP 6 เดือน · HBV 2 เดือน · HBV 6 เดือน · Hib 2 เดือน · Hib 4 เดือน · OPV 6 เดือน | [H] ยืนยันว่าเจ็ดคอลัมน์นี้คือเจ็ดรายการนี้ (ตัวเลขเท่ากันทุกไตรมาส) · การจับคู่รายตัว รวมถึง `hbv2`/`hbv3` กับ HBV 2/6 เดือน เป็นอนุมานจากชื่อคอลัมน์ |
| `s_epi1` | `pcv1`, `pcv2`, `pcv3` `_{MM}` | PCV 2 เดือน · PCV 4 เดือน · PCV 6 เดือน ("นอกแผน" บนหน้า HDC) | [H] ยืนยันว่าสามคอลัมน์นี้คือ PCV สามรายการ (ทั้งหมดเป็น 1 ในไตรมาส 4) · ลำดับเป็นอนุมานจากชื่อคอลัมน์ |
| `s_epi2` | `target{MM}` | เด็กอายุครบ 2 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด | [S] |
| `s_epi2` | `dtp4`, `opv4`, `je2` `_{MM}` | เด็กอายุครบ 2 ปีในงวดที่ได้รับ DTP4 / โปลิโอ4 / JE · ชื่อบนหน้า HDC: DTP 1 ปี 6 เดือน · OPV 1 ปี 6 เดือน · LAJE/JE 1 ปี | [S] · [H] สอง 192/188/190 |
| `s_epi2` | `mmr1_{MM}` | MMR1 เก็บตก | [S] ได้รับ MMR1 (comment เขียน "อายุครบ 3 ปี" ในตารางอายุ 2 ปี) · [H] ชื่อ "MMR1 เก็บตก" · ไตรมาส 1 ของสอง 53 แยกจาก `dtp4` 52 ที่ทั้งปีเท่ากัน (192) |
| `s_epi2` | `mmr2_{MM}`, `pcv4_{MM}` | MMR 1 ปี 6 เดือน · PCV 1 ปี | [H] · comment ว่าง · สอง 191 และ 0 |
| `s_epi3` | `target{MM}` | เด็กอายุครบ 3 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด | [S] |
| `s_epi3` | `je3`, `mmr2` `_{MM}` | ได้รับวัคซีน JE / MMR2 | [S] |
| `s_epi5` | `target{MM}` | เด็กอายุครบ 5 ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด | [S] |
| `s_epi5` | `dtp5`, `opv5` `_{MM}` | ได้รับวัคซีน DTP5 / โปลิโอ5 | [S] |

- ยอด 2569 `s_epi1` (เป้าหมาย 181, 63 แถว): bcg 180 · dtp_hb3 178 · opv3 178 · mmr 174 · hbv 179 · ipv 172 · dtp1 178 · rota 164 · hbv3 178 · hib3 177 · dtp2 179 · hbv2 178 · hbv4 179 · hib1 178 · hib2 178 · ipv1 161 · rota1 180 · pcv1 1 · pcv2 1 · pcv3 1
- ยอด 2569 `s_epi2` (205, 73 แถว): dtp4 192 · opv4 188 · je2 190 · mmr1 192 · mmr2 191 · pcv4 0 · `s_epi3` (226, 70 แถว): je3 207 · mmr2 215 · `s_epi5` (260, 78 แถว): dtp5 245 · opv5 242
- ความผิดปกติ: รายการที่ว่างทั้งอำเภอ: `s_epi1` 10 รายการตั้งแต่ `dtp2` ปี 2565–2568 · `s_epi2` `mmr2` ปี 2565–2567 และ `pcv4` ทุกปี · `pcv1`–`pcv3` ปี 2569 ได้ 1 จาก 181 และทั้งจังหวัดได้ 1 จาก 1,387 บนหน้า HDC จึงไม่ใช่ข้อมูลของอำเภอสองที่ขาด
- คำถามค้าง: การจับคู่รายตัวภายในกลุ่มที่ตัวเลขเท่ากันของ `s_epi1` (ยืนยันได้เมื่อตัวเลขของสองต่างกันในปีหรือไตรมาสที่ข้อมูลเปลี่ยน)

#### 4.6.5 `s_epi_complete` (ครบตามเกณฑ์ 4 รายงาน)

รายหมู่บ้าน · ทั้งปี + `M_A` · Σ เดือน = ทั้งปีทุกแถวทุกปี · ตารางเดียวมีแถวของ 4 รายงานแยกด้วย `id` (ปี 2569 รวม 284 แถว)

| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `target`, `target{MM}` | เด็กอายุครบ N ปีที่อาศัยอยู่จริงในพื้นที่รับผิดชอบในงวด | [S] (comment เขียนอายุ 1 ปีทุกคอลัมน์ ใช้กับทั้ง 4 `id`) · N ตามชื่อรายงาน |
| `result`, `result{MM}` | เด็กตาม B ที่ได้รับวัคซีนแต่ละชนิดครบตามเกณฑ์ ปี 2569 อายุ 2 ปี: BCG 1, HBV 3 ครั้ง (แรกเกิด, 2 เดือน และ 6 เดือน), DTP 4, Hib 3, IPV 2, OPV 2, MMR 2 ครั้ง, Rota ครบตามเกณฑ์, LAJE 1 หรือ JE 2 ครั้ง · 3 ปี: เหมือน 2 ปี แต่ LAJE 2 หรือ JE 3 ครั้ง · 5 ปี: เหมือน 3 ปี แต่ DTP 5 และ OPV 3 ครั้ง | [S] · รายการวัคซีนจาก [H] |

| อายุ | `opendata_id` | 2565 | 2566 | 2567 | 2568 | 2569 |
|---|---|---|---|---|---|---|
| 1 ปี | `28dd2c79…` | 259/196 (75.7%) | 257/189 (73.5%) | 248/184 (74.2%) | 217/184 (84.8%) | 181/142 (78.5%) |
| 2 ปี | `35f4a8d4…` | 272/209 (76.8%) | 266/216 (81.2%) | 260/210 (80.8%) | 245/202 (82.4%) | 205/72 (35.1%) |
| 3 ปี | `d1fe173d…` | 293/222 (75.8%) | 266/211 (79.3%) | 275/202 (73.5%) | 253/201 (79.4%) | 228/28 (12.3%) |
| 5 ปี | `f033ab37…` | 277/244 (88.1%) | 311/281 (90.4%) | 291/226 (77.7%) | 262/227 (86.6%) | 262/26 (9.9%) |

- ความผิดปกติ: ปี 2569 อายุ 2, 3, 5 ปีลดลงมาก ขณะที่วัคซีนรายการของอายุเดียวกันปี 2569 อยู่ที่ 92–95% ยกเว้น `pcv4` (§4.6.4) · อายุ 3 ปีผลงานเป็น 0 ทุกเดือน ต.ค.–มี.ค. แล้วได้ 3–6 ต่อเดือนตั้งแต่ เม.ย. · เป้าหมายตรงกับ Σ `target{MM}` ของ `s_epi1`/`s_epi2`/`s_epi3`/`s_epi5` ทุกปี ยกเว้นปี 2569 อายุ 3 ปี (228 กับ 226) และ 5 ปี (262 กับ 260)
- ร้อยละที่ลดลงในปี 2569 ไม่ได้เกิดเฉพาะอำเภอสอง: หน้า HDC แสดงทั้งจังหวัดแพร่ลดแบบเดียวกัน (2 ปี 67.41%, 3 ปี 30.36%, 5 ปี 11.54%) และตัวเลขของสองบนหน้าตรงกับ snapshot (205/72, 228/28, 262/26) · อนุมานว่ามาจากนิยามของปี 2569 (รายการวัคซีนข้างบน) มากกว่าการบันทึกข้อมูล เพราะลดลงทั้งจังหวัดพร้อมกันเฉพาะอายุ 2, 3, 5 ปี ขณะที่อายุ 1 ปีไม่ลด และวัคซีนรายการของอายุเดียวกันยังอยู่ที่ 92–95%
- คำถามค้าง: นิยามของปีก่อนนับวัคซีนอะไร (หน้า HDC แสดงนิยามของปีที่เลือกเท่านั้น ยังไม่ได้เปิดปีก่อน) · แสดงตามข้อมูลและระบุในข้อจำกัด

#### 4.6.6 `s_kpi_food` (นมแม่)

รายหมู่บ้าน · ทั้งปีอย่างเดียว: `target1`–`result4` ว่างทั้งอำเภอทุกปี จึงไม่มีระดับไตรมาส

| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `target` | เด็กอายุครบ 6 เดือนในปีงบประมาณที่แม่หรือผู้เลี้ยงดูถูกสอบถามเรื่องการกินนมแม่ | [S] |
| `result` | เด็กอายุครบ 6 เดือนที่แม่หรือผู้เลี้ยงดูตอบว่ากินนมแม่อย่างเดียว | [S] |
| `target1`–`target4`, `result1`–`result4` | เป้าหมาย / ผลงานไตรมาส 1–4 | [S] · ว่างทุกปี |
| `total` | จำนวนเด็กอายุครบ 6 เดือน (ทั้งที่ถูกและไม่ถูกสอบถาม) | [S] "จำนวนรวม" · [H] สอง 166 · หน้า HDC แสดง "ร้อยละสอบถาม" = `target` ÷ `total` · `total` ≥ `target` ทุกแถวทุกปี |
| `r1`–`r6` | ตอบว่ากินนมแม่อย่างเดียวที่ช่วงอายุ 1–6 เดือน | [S] · [H] "ตอบว่ากินนมแม่อย่างเดียวในแต่ละช่วงอายุ" สอง 10/7/77/18/60/15 · หมายเหตุของหน้า: เก็บประวัติตั้งแต่แรกเกิดถึง 6 เดือน และนับว่ากินนมแม่อย่างเดียวเมื่อตอบเช่นนั้นทุกครั้ง เด็กคนหนึ่งจึงอยู่ได้หลายช่วงอายุ |

- ยอด 2569: 109/91 (66 แถว) · `total` 166 · `r1`–`r6` 10/7/77/18/60/15 รวม 187 (> `result` 91)
- ความผิดปกติ: Σ `r1`–`r6` (187) เกิน `result` (91) ซึ่งเข้ากับหมายเหตุของหน้าที่นับเด็กคนเดียวได้หลายช่วงอายุ `r1`–`r6` จึงไม่ใช่ส่วนแบ่งของ `result` · `r6` = `result` แค่ 20 จาก 66 แถว
- คำถามค้าง: ไม่มี

#### 4.6.7 `s_aged9` (คัดกรองผู้สูงอายุ 9 ด้าน)

รายหมู่บ้าน · ทั้งปีอย่างเดียว · ด้าน k = `result{k}` (GLOSSARY "ด้าน")

| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `target` | ผู้สูงอายุ (คน) | [S] · [H] หัวตารางเขียน "ผู้สูงอายุได้รับการคัดกรอง (คนต่อสถานพยาบาล)" |
| `result` | คัดกรองครบ 9 ด้าน (คน) | [S] · [H] "คัดกรองครบ 9 ด้าน (คนต่อสถานพยาบาล)" |
| `result1`–`result9` | คัดกรองด้าน: 1 การมองเห็น · 2 การกลั้นปัสสาวะ · 3 การได้ยิน · 4 การปฏิบัติกิจวัตรประจำวัน · 5 ความคิดความจำ · 6 ภาวะซึมเศร้า (2Q) · 7 การเคลื่อนไหว · 8 สุขภาพช่องปาก · 9 ภาวะขาดสารอาหาร | [S] |
| `result{k}_1` | ด้าน k ปกติ (ด้าน 7 "ไม่เสี่ยง") | [S] |
| `result{k}_2` | ด้าน k เสี่ยง (ด้าน 2 "มีปัญหา", ด้าน 5 และ 6 "ผิดปกติ") | [S] |
| `result6_3` | ภาวะซึมเศร้า "2Q+ผิดปกติ" | [S] |

- ยอด 2569: 12,188/11,992 (86 แถว) · ด้าน (คัดกรอง / ปกติ / เสี่ยง): 1 12,041/11,986/2,198 · 2 12,040/11,691/349 · 3 12,039/11,605/434 · 4 12,047/11,422/625 · 5 12,040/11,565/475 · 6 11,970/11,872/98 (`_3` 81) · 7 12,023/11,168/855 · 8 12,040/10,827/1,213 · 9 12,004/11,596/408
- ความผิดปกติ: ด้าน 2, 3, 4, 5, 7, 8, 9 `_1 + _2 = result{k}` ทุกแถวปี 2569 · ด้าน 1 `_1 + _2` = 14,184 > 12,041 ใน 82 แถว และ `_1` เท่ากับ `result1` ใน 62 แถว · ด้าน 6 `_1 + _2 = result6` ทุกแถว แต่ `_3` อยู่นอกผลรวมนั้น (มีแถวที่ `_2` ว่างแต่ `_3` เป็น 1) · `result` > `result6` ใน 25 แถว ทั้งที่ `result` คือคนที่ครบ 9 ด้าน · ปี 2565 `result` ว่างทั้งอำเภอ แต่รายด้านมีค่า (ด้าน 9 ว่าง ด้าน 3 แค่ 198)
- หน้า HDC แสดงความผิดปกติของด้าน 1 และด้าน 6 เหมือนกัน (สอง ด้าน 1 คัดกรอง 12,039 ปกติ 11,984 เสี่ยง 2,196 · ด้าน 6 ผิดปกติ 98 และ 2Q+ผิดปกติ 81) จึงเป็นข้อมูลต้นทาง ไม่ใช่การดึงข้อมูลของเรา · "ร้อยละ" ของด้าน 1 บนหน้าเท่ากับร้อยละครบ 9 ด้าน ไม่ใช่ `result1` ÷ `target`
- คำถามค้าง: `target` คือผู้สูงอายุทั้งหมด ([S]) หรือผู้ที่ได้รับการคัดกรอง ([H]) · ตัวเลขเข้ากับ [S] มากกว่า เพราะ 12,188 ใกล้กับผู้มีอายุ ≥ 60 ปีของ `s_kpi_dental33` (12,193) · ด้าน 1 `_1`/`_2` นับอย่างไร · `result6_3` สัมพันธ์กับ `_1`/`_2` อย่างไร · ปี 2565 แสดง "—" ตามข้อมูล · ยังไม่ใช้ `_1`/`_2`/`_3` จนกว่าจะตอบได้

#### 4.6.8 `s_dm_screen` และ `s_ht_screen` (คัดกรองเบาหวานและความดัน)

รายหมู่บ้าน · ทั้งปี + ผลงานรายไตรมาสที่ไม่มีเป้าหมายรายไตรมาส (§4.2, #169) · Σ `result1`–`result4` = `result` ทุกแถวทุกปี

| คอลัมน์ | `s_dm_screen` | `s_ht_screen` | ที่มา |
|---|---|---|---|
| `target` | ประชากรอายุ 35 ปีขึ้นไปในเขตรับผิดชอบ | เหมือนกัน | [S] |
| `result` | ได้รับการคัดกรองเบาหวาน | ได้รับการคัดกรองโรคความดันโลหิตสูง | [S] |
| `result1`–`result4` | ผลงานไตรมาส 1–4 | ผลงานไตรมาส 1–4 | [S] |

- ยอด 2569: dm 20,306/18,528 ไตรมาส 7,919/10,265/215/129 · ht 15,306/14,358 ไตรมาส 6,397/7,740/117/104 (86 แถวทั้งคู่)
- ความผิดปกติ: การคัดกรองเกือบทั้งหมดอยู่ในไตรมาส 1–2 ทุกปี · คำถามค้าง: ไม่มี

#### 4.6.9 `s_ncd_screen_repleate1` (ติดตามยืนยันวินิจฉัยเบาหวาน)

1 แถวต่อหน่วยบริการ (16 แถวปี 2569) · ทั้งปี + `Q_B` · Σ ไตรมาส = ทั้งปีทุกแถวทุกปี

| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `target`, `targetq1`–`targetq4` | "รวม B" / "ไตรมาส n B" | [S] (comment บอกแค่ B) · ความหมายของ B ตามแถว B / A |
| `result`, `resultq1`–`resultq4` | "รวม A" / "ไตรมาส n A" | [S] · ความหมายของ A ตามแถว B / A |
| B / A | B = ประชากรอายุ 35 ปีขึ้นไปในเขตรับผิดชอบที่ได้รับการคัดกรองเบาหวานและเป็นกลุ่มสงสัยป่วย · A = กลุ่มสงสัยป่วยที่ได้รับการตรวจยืนยันด้วย FPG ทางห้องปฏิบัติการภายใน 1–180 วันก่อนสิ้นปีงบประมาณ | [H] · ในส่วน "ได้รับการตรวจติดตามภายในปีงบประมาณ" ของหน้า B และ A ของทั้งปีและรายไตรมาสเขียนเป็น D และ C |
| `target_13` | กลุ่มสงสัยป่วย (ภายในไตรมาส 1–3) [B] | [H] · comment ว่าง · ปี 2569 `target_13` = `target` − `targetq4` ในแถวที่ต่างกัน |
| `result_13` | ได้รับการตรวจติดตามภายใน 1–180 วัน [A] ของกลุ่มไตรมาส 1–3 | [H] · comment ว่าง |
| `non_follow180_13` | ไม่ได้รับการตรวจติดตามแต่ยังอยู่ในระยะเวลา 1–180 วัน [A1] | อนุมาน: comment ว่าง · ชื่อคอลัมน์ตรงกับหัวตาราง [H] แต่ตัวเลขบนหน้าไม่ตรงกับ snapshot จึงยืนยันด้วยตัวเลขไม่ได้ |
| `over180` | กลุ่มสงสัยป่วยที่ได้รับการตรวจติดตามตั้งแต่วันที่ 181 ขึ้นไป | อนุมาน เหมือน `non_follow180_13` · `target_13 = result_13 + non_follow180_13 + over180` ทุกแถวปี 2568–2569 และบนหน้า (สอง 202 = 195 + 5 + 2) |

- ยอด 2569: 192/188 · ไตรมาส 139/137, 52/51, 0/0, 1/0 · `_13` 191/188/3/0
- **ร้อยละของ HDC ใช้กลุ่มไตรมาส 1–3:** กราฟบนหน้า HDC คือ `result_13` ÷ `target_13` (สอง 195 ÷ 202 = 96.53%) ไม่ใช่ `result` ÷ `target` (195 ÷ 203 = 96.06%) ส่วน §4.3 ใช้ `ANNUAL` คือ `target`/`result` · ปี 2565–2567 ไม่มีกลุ่มนี้ (`_13` ว่าง)
- ความผิดปกติ: คอลัมน์ `_13` ว่างทั้งอำเภอปี 2565–2567 · `resultq4` ว่างทุกปี · ปี 2569 `target_13` ≠ `target` 1 แถว (`06415` 40 กับ 39 ซึ่งมี `targetq4` 1)
- อนุมาน: B ไตรมาส 3–4 น้อยเพราะการคัดกรองอยู่ในไตรมาส 1–2 (§4.6.8)
- คำถามที่ตอบแล้วใน F59 (13 พ.ย. 2569): หน้า HDC (ประมวลผล 11 พ.ย.) ต่างจาก snapshot (`date_com` 9 พ.ย.) ราว 6% (สอง `target` 203 กับ 192 · `_13` 202/195/5/2 กับ 191/188/3/0) เพราะ snapshot ตอนนั้นยังไม่อัปเดต · snapshot ที่ build 12 พ.ย. (`date_com` 11 พ.ย.) ได้ 203/195 (96.06%) ไตรมาส 147/142, 55/53, 0/0, 1/0 และ `_13` 202/195/5/2 ตรงกับหน้า HDC · ยอด 2569 ข้างบนและในการตัดสินของ F49 จึงเป็นของ snapshot 9 พ.ย.
- **ตัดสินใน F49 (12 พ.ย. 2569, ADR-0015):** หน้ารายงานใช้ `target`/`result` ตาม §4.3 (ปี 2569 188 ÷ 192 = 97.92% · `_13` ได้ 188 ÷ 191 = 98.43%) ไม่แสดงคอลัมน์ `_13`, `non_follow180_13`, `over180` และข้อจำกัดของหน้าบอกว่ากราฟของ HDC ใช้กลุ่มไตรมาส 1–3

#### 4.6.10 `s_ht_screen_follow` (ติดตามยืนยันวินิจฉัยความดัน)

1 แถวต่อหน่วยบริการ (17 แถวปี 2569) · ทั้งปี + `Q_C` · Σ ไตรมาส = ทั้งปีทุกแถวทุกปีที่มี

| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `target`, `t_q1`–`t_q4` | กลุ่มสงสัยป่วยโรคความดันโลหิตสูง (คน) [B] ทั้งปี / ไตรมาส | [S] |
| `result`, `r_q1`–`r_q4` | ได้รับการติดตามเพื่อการวินิจฉัย ไม่นับซ้ำ (คน) [A] | [S] |
| `r1`, `r1_q1`–`r1_q4` | ได้รับการติดตามโดยทำ HBPM [A1] | [S] |
| `r2`, `r2_q1`–`r2_q4` | ได้รับการติดตามโดยทำ OBPM [A2] | [S] |
| `target_13` | กลุ่มสงสัยป่วย (ไตรมาส 1–3) [B]: ประชากรอายุ 35 ปีขึ้นไปที่ยังไม่ได้รับการวินิจฉัยว่าเป็นความดันโลหิตสูง ได้รับการคัดกรองและเป็นกลุ่มสงสัยป่วย สะสม 1 ต.ค.–30 มิ.ย. | [H] · comment ว่าง · เท่ากับ `target` ยกเว้น 2 แถวปี 2569 |
| `result_13` | ได้รับการติดตามเพื่อการวินิจฉัยภายใน 1–90 วัน ไม่นับซ้ำ [A] | [H] · comment ว่าง |
| `r_home_bp_13` | ได้รับการติดตามโดยทำ HBPM [A1] | [H] · comment ว่าง · เท่ากับ `r1` ทุกแถวปี 2568–2569 |
| `r_hosp_bp_13` | ได้รับการติดตามโดยทำ OBPM [A2] | [H] · comment ว่าง · เท่ากับ `r2` ยกเว้น 1 แถวปี 2569 |
| `non_follow90_13` | ไม่ได้รับการตรวจติดตาม แต่ยังอยู่ภายในระยะเวลา 1–90 วัน [A3] | [H] · comment ว่าง |
| `over90` | กลุ่มสงสัยป่วยได้รับการตรวจติดตามตั้งแต่วันที่ 91 ขึ้นไป **รวมทั้งปีงบประมาณ** [C3] | [H] · comment ว่าง · นับจากทั้งปี ไม่ใช่กลุ่มไตรมาส 1–3 จึง `target_13 = result_13 + non_follow90_13 + over90` ไม่จริง 4 แถวปี 2569 ต่างจาก §4.6.9 |

- ยอด 2569: 1,215/1,202 · `r1` 1,172 · `r2` 811 · ไตรมาส B/A 739/733, 470/465, 3/3, 3/1 · `_13` 1,212/1,201/1,172/810/1/5
- ความผิดปกติ: `max(r1, r2) ≤ result ≤ r1 + r2` ทุกแถวทุกปี เข้ากับ [S] ที่บอกว่า `result` ไม่นับซ้ำ คนหนึ่งจึงวัดได้ทั้งสองวิธี · คอลัมน์ `_13` ว่างปี 2565–2566 · อนุมาน: B ไตรมาส 3–4 มีแค่ 3 คนเพราะการคัดกรองความดันอยู่ในไตรมาส 1–2 (§4.6.8) ส่วน A ของไตรมาสเหล่านั้นได้ 3/3 และ 1/3 จึงไม่ใช่รอบติดตามที่ค้างจำนวนมาก
- **ร้อยละของ HDC ใช้กลุ่มไตรมาส 1–3:** กราฟบนหน้า HDC คือ `result_13` ÷ `target_13` (สอง 1,201 ÷ 1,212 = 99.09%) ไม่ใช่ `result` ÷ `target` (1,202 ÷ 1,215 = 98.93%) และมีกราฟร้อยละ HBPM และ OBPM ของกลุ่มเดียวกัน · บนหน้าตัวเลขของสองตรงกับ snapshot ทุกคอลัมน์
- **ตัดสินใน F49 เหมือน §4.6.9:** หน้ารายงานใช้ `target`/`result` (1,202 ÷ 1,215 = 98.93%) แสดง `r1`/`r2` เป็นจำนวน ไม่แสดงคอลัมน์ `_13`, `non_follow90_13`, `over90` · คำถามค้าง: ไม่มี

#### 4.6.11 `s_dental_0_5_cavity_free` (ฟันดีไม่มีผุ)

รายหมู่บ้าน · ปี 2569 ปีเดียว · ไม่มี `id`, `flag_sent`, `ip` · ใช้ `col_target` = `b`, `col_result` = `a` (§6)

| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `c` | อายุ 0–5 ปี เด็กทั้งหมด (คน) [C] | [H] · comment ว่าง · `a ≤ b ≤ c` ทุกแถว (86 แถว) |
| `b` | ตรวจช่องปาก (คน) [B] | [H] · comment ว่าง · หน้า HDC แสดงร้อยละ (B/C) × 100 ด้วย |
| `a` | ฟันดีไม่มีผุ (คน) [A] | [H] · comment ว่าง · ร้อยละของรายงานคือ (A/B) × 100 ตรงกับ `col_target`/`col_result` ของ seed |

- ยอด 2569: `c` 1,361 · `b` 954 · `a` 795
- ความผิดปกติ: `b` = `c` 16 แถว · มี 4 แถวที่ `a` ว่าง (หนึ่งในนั้น `b` ก็ว่าง)
- หน้า HDC แถวสอง 1,361/954/795 ตรงกับ snapshot (ประมวลผล 12 พ.ย. 2569) · คำถามค้าง: ไม่มี

#### 4.6.12 `s_kpi_dental28` และ `s_kpi_dental33` (ทันตกรรมรายปี)

รายหมู่บ้าน · ทั้งปีอย่างเดียว

| คอลัมน์ | `s_kpi_dental28` | `s_kpi_dental33` | ที่มา |
|---|---|---|---|
| `target` | เด็ก 6 ปีในเขตรับผิดชอบ | ผู้มีอายุ ≥ 60 ปีในเขตรับผิดชอบ | [S] |
| `result` | เด็ก 6 ปีที่มีรหัสหัตถการเคลือบหลุมร่องฟันแท้ คนใหม่ | ผู้มีอายุ ≥ 60 ปีที่ได้ตรวจทั้งปากและวางแผน ลงแฟ้ม dental | [S] |

- ยอด 2569: dental28 274/105 (81 แถว) · dental33 12,193/6,986 (86 แถว)
- ความผิดปกติ: dental33 ปี 2566 ได้ 1,645 จาก 11,167 (14.7%) ขณะที่ปีอื่น 34–62% และปีนั้นมีค่า `ip` ทุกแถว (§4.6.1)
- คำถามค้าง: ปี 2566 ของ dental33 ข้อมูลไม่ครบหรือเปลี่ยนวิธีนับ

## 5. HDC Open Data API

| Endpoint | สถานะการตรวจ |
|---|---|
| `GET /opendata_api/reports/categories` | ยืนยันแล้วด้วย response จริงจากเบราว์เซอร์ 29 ต.ค. 2569 · 30 ต.ค. 2569 ทดสอบจากเครื่องผู้ดูแล: เบราว์เซอร์ได้ข้อมูล, `curl` ได้ 403, `fetch` ของ node ได้ 403 → endpoint นี้กันไคลเอนต์ที่ไม่ใช่เบราว์เซอร์ ดึงผ่าน snippet ใน DevTools เท่านั้น (SPEC §12.3, ADR-0010) |
| `GET /opendata_api/reports/categorie/by-category-id/{cat_id}` | ยืนยันแล้วด้วย response จริงของหัวข้อวัคซีนจากเบราว์เซอร์ 29 ต.ค. 2569 · กันไคลเอนต์ที่ไม่ใช่เบราว์เซอร์เช่นเดียวกับ `categories` |
| `POST /api/report_data` | ใช้งานอยู่แล้ว เรียกจากสคริปต์ได้ (`curl` จากเครื่องผู้ดูแลได้ 201, 30 ต.ค. 2569) · 429 ที่พบคือการจำกัดความถี่ ให้ retry และเว้นช่วงตาม SPEC §7.1 · ส่วน `total` ใน response พบในตัวอย่างของ R6 และต้องยืนยันในขั้นตรวจรับว่า `limit = 5000` ได้ครบ `total` (SPEC §13 ขั้น 6) |
| `GET /api/report_year/{tableName}`, `GET /api/report_schema/{tableName}` | ตรวจแล้ว 6 พ.ย. 2569: `curl` จากเครื่องผู้ดูแลได้ 200 ไม่ถูกกันแบบ API แค็ตตาล็อก · ยังไม่ใช้ในเฟส 1 (§5.4) |

Base URL: `https://opendata.moph.go.th`

### 5.1 `categories`

ตอบเป็น array ของ `{ "cat_id": string, "category_name": string }` ณ 29 ต.ค. 2569 มี 51 หัวข้อ ไม่มีชื่อหมวดใน response นี้ · export 30 ต.ค. 2569 ได้ 51 หัวข้อเท่าเดิม

### 5.2 `categorie/by-category-id/{cat_id}`

สะกด `categorie` ไม่มี s ตอบเป็น array ของ object:

| ฟิลด์ | ชนิด | ใช้ |
|---|---|---|
| `id`, `report_id` | number | ไม่ใช้ (รายการซ้ำมีค่าต่างกัน) |
| `report_name` | string | ใช้ |
| `cat_id`, `category_name` | string | ใช้ (หัวข้อ) |
| `main_report_id`, `main_report_name` | string | ใช้ (หมวด) |
| `source_table` | string \| null | ใช้ (พบ `null` 1 แถวในหัวข้อโรงเรียนและนักเรียน ตกข้อ 3 ของ §3.4) |
| `opendata_id` | string | ใช้ เป็น key |
| `view_count` | number | ไม่ใช้ |
| `last_synced_at`, `created_at`, `updated_at` | ISO string | ไม่ใช้ |

สิ่งที่พบในหัวข้อวัคซีน (`4df36051…`):
- มี 46 แถว แต่ `opendata_id` ไม่ซ้ำแค่ 34 ตัว แถวซ้ำมีชื่อและตารางเหมือนกัน
- มีรายการขยะชื่อ "dasf" (`s_psychoactive_coverage`)
- `s_epi_complete` มี 4 รายงาน คือ อายุ 1, 2, 3 และ 5 ปี
- `main_report_id` `73daf277928bc32a1b3c8e772192543c` = ส่งเสริมป้องกัน

สิ่งที่พบในไฟล์ export ทั้ง 51 หัวข้อ (`catalog-exports/hdc-catalog-20261030.json`, 30 ต.ค. 2569, ไม่มี `errors`):
- 1,220 แถว `opendata_id` ไม่ซ้ำ 951 ตัว แถวซ้ำ 267 ตัว ในจำนวนนี้ 16 ตัวมี `report_name` ต่างกันระหว่างแถวซ้ำ (เช่น ต่อท้าย "(ปิดรายงาน)") §3.4 ข้อ 4 เก็บแถวแรก
- `opendata_id` 4 ตัวอยู่ใน 2 หัวข้อ (`abt2t2k4z4xeqzytwbave` ใน สุขภาพช่องปาก และ แพทย์แผนไทย · `jkr4q9r4ix630v70nh9l4` ใน อนามัยแม่และเด็ก และ Service Plan สาขาแม่และเด็ก · `Qe95V9DKGQYy5ij` · `Twfd175Rp8TCPca8n5GTK`) §3.4 ข้อ 5 ให้หัวข้อแรกได้สิทธิ์
- รูปแบบ `opendata_id`: 32 hex 891 ตัว · hex 31 ตัวอักษร 1 ตัว (`cef2a37336604ee3b85a6ac5412b995`) · รหัสสั้น 15–23 ตัวอักษร 58 ตัว ซึ่ง 29 ตัวมีตัวพิมพ์ใหญ่ (เช่น `T81yHkXJY8lk8nGZQqldk` ของ `s_pregnant_anemia_coverage`) และ 1 ตัวมี `_` (`iEds82J3Z67JHB8KLETD_`) · ค่าขยะ 1 ตัวเป็นชื่อตาราง (`s_rebies_overview`) · ตรวจแล้วว่าไม่มีรหัส 2 ตัวที่ต่างกันแค่ตัวพิมพ์ (951 รหัสเมื่อลดตัวพิมพ์ทั้งหมดยังได้ 951 ค่าไม่ซ้ำ) · คอลัมน์ `id` ในข้อมูลดิบเก็บตัวพิมพ์ตามรหัส (ทดสอบ `report_data` ของ `s_pregnant_anemia_coverage` ปี 2569 จังหวัด 54 วันที่ 30 ต.ค. 2569 ได้ `id = T81yHkXJY8lk8nGZQqldk`)
- ทุกหัวข้อมี `main_report_id` เดียว (ไม่มีหัวข้อที่รายงานข้ามหมวด)
- `report_name` มี HTML (`<font color=red>…</font>`) 9 รายงาน (2 รายงานอยู่ในหัวข้อการคัดกรอง ที่เหลือใน บสต. ฯลฯ ไม่มีใน 21 รายงาน seed) และ 114 รายงานมีช่องว่างซ้ำหรือช่องว่างหัวท้าย (9 ชื่อมี tab หรือขึ้นบรรทัดอยู่ในชื่อ) · `category_name` 1 หัวข้อมีช่องว่างท้าย (สาเหตุการป่วย/ตาย) · `main_report_name` สะอาด · ไม่พบ HTML entity (`&nbsp;`, `&amp;` ฯลฯ) ในชื่อใดเลย

### 5.3 `report_data`

Request (`Content-Type: application/json`):

```json
{ "tableName": "s_epi_complete", "year": "2569", "province": "54", "type": "json", "limit": 5000 }
```

- Response เป็น envelope เช่น `{ "data": [...], "total": "2444", "limit": 1000, "offset": 0 }` (ตัวอย่างจาก R6) หรือ array ของแถวตรง ๆ แบบเก่า ต้องรับได้ทั้งสองแบบ
- `total` อาจเป็น string ต้องแปลงเป็นตัวเลขก่อนเทียบ
- ส่ง `total` ไปกับ `save_kpi_data` เสมอ ถ้า `data.length < total` GAS ปฏิเสธ (SPEC §7.1) การแบ่งหน้าด้วย `offset` ยังไม่ทำในเฟส 1

### 5.4 `report_year` และ `report_schema` (ยังไม่ใช้ในเฟส 1)

ตรวจ 6 พ.ย. 2569 ด้วย `curl` (GET ไม่มี body ไม่ต้องใช้ header ของเบราว์เซอร์):

- `report_year/{tableName}` ตอบ array ของ `{ "b_year": string, "process_date": string }` เรียงจากปีใหม่ไปปีเก่า `process_date` เป็นเลข 12–14 หลักแบบ `date_com` เช่น `s_aged9` ได้ 2569 (`202611060558`) ถึง 2564 และ `s_epi1` ปี 2569 ได้ `20261106045726`
- `report_schema/{tableName}` ตอบ array ของ `{ "COLUMN_NAME", "IS_NULLABLE", "COLUMN_TYPE", "COLUMN_COMMENT" }` ตามลำดับคอลัมน์ของตาราง แต่ไม่มี `flag_sent` และ `ip` ซึ่งมีในแถวของ `report_data` (6 ใน 7 ตารางของ §4.5 ยกเว้น `s_dental_0_5_cavity_free`) · `COLUMN_COMMENT` คือคำอธิบายภาษาไทยของ HDC บางตารางปล่อยว่างแม้แต่คอลัมน์ key เช่น `id`, `hospcode`, `areacode`, `date_com`, `b_year` ของ `s_aged9` ว่าง แต่ของ `s_dm_screen` มี

### 5.5 ไฟล์ export แค็ตตาล็อก (อินพุตของ `hdc-catalog.js --from`)

สร้างโดย snippet `tools/hdc-catalog-export.js` ใน DevTools console บนหน้า `https://opendata.moph.go.th` (SPEC §12.3) ไฟล์เดียวต่อการ export หนึ่งครั้ง ชื่อ `hdc-catalog-YYYYMMDD.json` (ปี ค.ศ. ตามวันที่รัน) เก็บใต้ `catalog-exports/` (อยู่ใน `.gitignore`)

```ts
{
  exported_at: string;                                        // ISO เวลาที่ export
  source: "https://opendata.moph.go.th";
  categories: { cat_id: string; category_name: string }[];   // response ของ §5.1 ตามที่ได้มา
  reports: Record<string, ApiReportRow[]>;                   // key = cat_id · response ของ §5.2 ตามที่ได้มา ไม่กรองซ้ำ
  errors: { cat_id: string; status: number }[];              // หัวข้อที่ดึงไม่สำเร็จหลัง retry
}
```

- snippet ดึงทุกหัวข้อใน `categories` (ราว 51 หัวข้อ ใช้เวลา 1–2 นาที) ไม่ใช่เฉพาะที่อยู่ใน `hdc_topics` เพื่อให้ `find` ค้นได้ทุกตาราง
- `find` และ `refresh` อ่านไฟล์นี้อย่างเดียว การกรองซ้ำและตรวจรูปแบบทำที่ `save_catalog` (§3.4) เหมือนเดิม
- `refresh` ตรวจว่ามี `exported_at` และ `reports` ไม่อย่างนั้น exit 1 ว่าไม่ใช่ไฟล์ export และข้ามหัวข้อที่ไม่มี key ใน `reports` หรืออยู่ใน `errors` พร้อมข้อความ (ไม่ส่ง `reports: []` ซึ่ง GAS ปฏิเสธอยู่แล้ว)

## 6. Seed เฟส 1

21 รายงานจาก 18 ตาราง ใน 6 หัวข้อ ทุกตัวเป็น `enabled = TRUE` และ `report_type = coverage`

- `opendata_id` ทั้ง 21 ตัวและหัวข้อของทุกตาราง ยืนยันแล้วกับไฟล์ export แค็ตตาล็อก 30 ต.ค. 2569 (§5.2) · ของ 13 KPI เดิมตรงกับลิงก์ใน `kpi_master` ทุกตัว
- `goal` มาจาก `target` ใน `kpi_master`/`kpi_epi` ตามค่าที่อ่านจากชีตจริง 29 ต.ค. 2569 (ไม่ใช่ค่าใน `setupEpiSplit` ของ `รหัส.js` ซึ่งเป็นโค้ด bootstrap เก่าที่ตั้ง 95 ทุกแถวและมีแถว pcv ซึ่งชีตจริงไม่มีแล้ว)

**แถว `hdc_topics` (ผู้ดูแลใส่ในขั้น 3 ของ SPEC §13 · จำนวนรายงาน = `opendata_id` ไม่ซ้ำที่ผ่านรูปแบบ ณ export 30 ต.ค. 2569):**

| `cat_id` | `order` | หัวข้อ | หมวด | รายงานในหัวข้อ | seed เปิดใช้ |
|---|---|---|---|---|---|
| `1ed90bc32310b503b7ca9b32af425ae5` | 10 | อนามัยแม่และเด็ก | ส่งเสริมป้องกัน | 69 | 4 |
| `4df360514655f79f13901ef1181ca1c7` | 20 | การสร้างเสริมภูมิคุ้มกันโรค | ส่งเสริมป้องกัน | 34 | 8 |
| `bebf866fceaef84c4078965eaf619565` | 30 | การเฝ้าระวังด้านส่งเสริมสุขภาพและอนามัยสิ่งแวดล้อม | ส่งเสริมป้องกัน | 4 | 1 |
| `6966b0664b89805a484d7ac96c6edc48` | 40 | การคัดกรอง | ส่งเสริมป้องกัน | 18 | 1 |
| `b2b59e64c4e6c92d4b1ec16a599d882b` | 50 | ข้อมูลเพื่อตอบสนอง Service Plan สาขาโรคไม่ติดต่อ (NCD DM,HT,CVD) | ข้อมูลตอบสนอง Service Plan | 55 | 4 |
| `db30e434e30565c12fbac44958e338d5` | 60 | ข้อมูลเพื่อตอบสนอง Service Plan สาขาสุขภาพช่องปาก | ข้อมูลตอบสนอง Service Plan | 61 | 3 |

- หลัง `refresh` ครบ 6 หัวข้อ `hdc_reports` มี 241 แถว (ณ export 30 ต.ค. 2569) เปิดใช้ 21
- `s_dental_0_5_cavity_free` (`abt2t2k4z4xeqzytwbave`) อยู่ใน 2 หัวข้อของ HDC คือ สุขภาพช่องปาก และ แพทย์แผนไทย (`30bc6364fc06a33a7802e16bc596ac3b`) seed ให้อยู่หัวข้อสุขภาพช่องปาก ถ้าวันหน้าเพิ่มหัวข้อแพทย์แผนไทย แถวนี้ยังอยู่หัวข้อเดิมตาม §3.4 ข้อ 5
- ลำดับหัวข้อ: เรื่องเด็กอยู่ติดกัน และ EPI ซึ่งเป็นเรื่องหลักของ R6 ขึ้นก่อน หมวดส่งเสริมป้องกันจึงมาก่อน Service Plan ตาม SPEC §5.4 · ผู้ดูแลพิมพ์ `order` พร้อม `cat_id` ในขั้น 3 ของ SPEC §13 · `setup=dc_seed` เขียนเฉพาะ `hdc_reports` ไม่แตะ `hdc_topics`
- `order` ของรายงานนับใหม่ 10, 20, 30… ภายในหัวข้อ คงลำดับสัมพัทธ์ของ `kpi_master.order` เดิม

**หัวข้อ: อนามัยแม่และเด็ก (`1ed90bc32310b503b7ca9b32af425ae5`)**

| `opendata_id` | `source_table` | รายงาน (ย่อ) | `order` | `goal` | `col_target` / `col_result` |
|---|---|---|---|---|---|
| `1c1b8e24aff59258a806f122e264031e` | `s_kpi_anc12` | ANC ครั้งแรก ≤ 12 สัปดาห์ | 10 | 75 | |
| `bd63b8d99f7054560fcf9c3b96f39c13` | `s_anc5` | ANC 5 ครั้งตามเกณฑ์ | 20 | 75 | |
| `1b60d68b1cb5b003fcba38a4a0e4027b` | `s_kpi_childdev4` | พัฒนาการสมวัย 0–5 ปี | 30 | 87 | |
| `684e99dc7538c8b1a97f19f91a100f08` | `s_kpi_childdev2` | คัดกรองพัฒนาการ พบสงสัยล่าช้า | 40 | 20 | |

**หัวข้อ: การเฝ้าระวังด้านส่งเสริมสุขภาพและอนามัยสิ่งแวดล้อม (`bebf866fceaef84c4078965eaf619565`)**

| `opendata_id` | `source_table` | รายงาน (ย่อ) | `order` | `goal` | `col_target` / `col_result` |
|---|---|---|---|---|---|
| `4164a7c49fcb2b8c3ccca67dcdf28bd0` | `s_kpi_food` | นมแม่อย่างเดียว < 6 เดือน | 10 | 50 | |

**หัวข้อ: การคัดกรอง (`6966b0664b89805a484d7ac96c6edc48`)**

| `opendata_id` | `source_table` | รายงาน (ย่อ) | `order` | `goal` | `col_target` / `col_result` |
|---|---|---|---|---|---|
| `aa86b13e8cb60cae6c3216b7e3e5f151` | `s_aged9` | คัดกรองผู้สูงอายุ 9 ด้าน | 10 | 80 | |

**หัวข้อ: ข้อมูลเพื่อตอบสนอง Service Plan สาขาโรคไม่ติดต่อ (NCD DM,HT,CVD) (`b2b59e64c4e6c92d4b1ec16a599d882b`)**

| `opendata_id` | `source_table` | รายงาน (ย่อ) | `order` | `goal` | `col_target` / `col_result` |
|---|---|---|---|---|---|
| `626c89f6b8d9f7ed90c72c719775eb07` | `s_dm_screen` | คัดกรองเบาหวาน 35 ปีขึ้นไป | 10 | 90 | |
| `9702fa28cd2ec73ecc6af89d14f46874` | `s_ht_screen` | คัดกรองความดันโลหิตสูง 35 ปีขึ้นไป | 20 | 90 | |
| `e9e461e793e8258f47d46d6956f12832` | `s_ncd_screen_repleate1` | ติดตามยืนยันวินิจฉัย สงสัยเบาหวาน | 30 | 70 | |
| `b57439ff27302ade8c38d1dd189644a4` | `s_ht_screen_follow` | ติดตามยืนยันวินิจฉัย สงสัยความดัน | 40 | 80 | |

**หัวข้อ: ข้อมูลเพื่อตอบสนอง Service Plan สาขาสุขภาพช่องปาก (`db30e434e30565c12fbac44958e338d5`)**

| `opendata_id` | `source_table` | รายงาน (ย่อ) | `order` | `goal` | `col_target` / `col_result` |
|---|---|---|---|---|---|
| `abt2t2k4z4xeqzytwbave` | `s_dental_0_5_cavity_free` | เด็ก 0–5 ปี ฟันดีไม่มีผุ | 10 | 80 | `b` / `a` |
| `e07a6ff3cd63d34a759be4bff5c1a4c6` | `s_kpi_dental28` | เด็ก 6 ปี เคลือบหลุมร่องฟันแท้ | 20 | 25 | |
| `1fb6b46f1d1fd42362f97072f4b3b653` | `s_kpi_dental33` | ผู้สูงอายุตรวจช่องปากโดยทันตบุคลากร | 30 | 50 | |

`subgroup` ของ 13 รายงานนี้ว่าง (PA ไม่มีกลุ่มย่อยสำหรับ 13 KPI นี้)

**หัวข้อ: การสร้างเสริมภูมิคุ้มกันโรค (`4df360514655f79f13901ef1181ca1c7`)**

| `opendata_id` | `source_table` | รายงาน (ย่อ) | `subgroup` | `order` | `goal` |
|---|---|---|---|---|---|
| `c88658f4d09acb8c76e6c06ffb58ebaf` | `s_epi1` | ความครอบคลุมเด็กครบ 1 ปี รายวัคซีน | กลุ่มอายุ 1 ปี | 10 | 90 |
| `28dd2c7955ce926456240b2ff0100bde` | `s_epi_complete` | fully immunized 1 ปี | กลุ่มอายุ 1 ปี | 11 | 90 |
| `71e49e4b61aafee17761601c506d5f85` | `s_epi2` | ความครอบคลุมเด็กครบ 2 ปี รายวัคซีน | กลุ่มอายุ 2 ปี | 20 | 90 |
| `35f4a8d465e6e1edc05f3d8ab658c551` | `s_epi_complete` | fully immunized 2 ปี | กลุ่มอายุ 2 ปี | 21 | 90 |
| `267ce09f2a704eb7783997e25d1f18ba` | `s_epi3` | ความครอบคลุมเด็กครบ 3 ปี รายวัคซีน | กลุ่มอายุ 3 ปี | 30 | 90 |
| `d1fe173d08e959397adf34b1d77e88d7` | `s_epi_complete` | fully immunized 3 ปี | กลุ่มอายุ 3 ปี | 31 | 90 |
| `c47283d3c2c1e6528ddcf88c254f21b3` | `s_epi5` | ความครอบคลุมเด็กครบ 5 ปี DTP5, OPV5 | กลุ่มอายุ 5 ปี | 50 | 90 |
| `f033ab37c30201f73f142449d037028d` | `s_epi_complete` | fully immunized 5 ปี | กลุ่มอายุ 5 ปี | 51 | 90 |

- เกณฑ์รายวัคซีนมาจาก `kpi_epi` ผ่าน `measure_goals` (ชีตจริงมี 30 แถว): `s_epi1.mmr` = 95, `s_epi2.mmr1` = 95, `s_epi2.mmr2` = 95 ที่เหลือ = 90 (รวม `s_epi3.mmr2` = 90) ส่วนรายการที่ไม่มีใน `kpi_epi` (`pcv1`–`pcv3` ของ `s_epi1`, `pcv4` ของ `s_epi2`) ไม่มีเกณฑ์ (§4.4)
- รายงานอื่นในหัวข้อนี้ (work load, วัยเรียน, หญิงตั้งครรภ์, ผู้ใหญ่, 7 ปี ฯลฯ) ยังปิดไว้ เพราะยังไม่มีข้อมูลดิบ หรือเป็นชนิด `workload` ซึ่งรอเฟส 2

## 7. ไฟล์ snapshot (`public/data/`)

สร้างโดย `src/scripts/build-snapshot.mjs` จาก `?action=catalog`, `?action=report` และ `?action=registry_population` (เฟส 2) เท่านั้น ไม่มีการคำนวณค่าของรายงานหรือยอดประชากรในขั้นนี้

| ไฟล์ | รูปแบบ (type ใน §9) |
|---|---|
| `meta.json` | `SnapshotMeta` |
| `catalog.json` | `DcCatalog` |
| `reports/{opendata_id}.json` | `DcReportData` |
| `population.json` (เฟส 2) | `PopulationSnapshot` |
| `reports/population.json` (Track K) | `PopulationReportData` |

สิ่งที่ prebuild script ทำเพิ่มจาก response ของ GAS:
- เรียงหมวด/หัวข้อ/กลุ่ม/รายงานตาม SPEC §5.4 แล้วเก็บเป็นโครงซ้อน (`DcCatalog.mains[].topics[].groups[].reports[]`) เพื่อให้หน้าเว็บวนลูปได้เลย
- `DcReport.cat_id`/`main_report_id` ยังอยู่ในรายงานแต่ละตัว (ใช้ทำ breadcrumb และ "รายงานที่เกี่ยวข้อง")
- `meta.latest_date_com` = `max_date_com` ที่มากที่สุดในทุกรายงาน
- ตัดกลุ่ม หัวข้อ และหมวดที่ไม่มีรายงานที่ใช้งานออก
- ตรวจความครบ: ทุก block ปีต้อง `sheet_rows = expected_rows`, ทุกปีใน `report.years` ต้องมี block ใน `years` (§3.2 ข้ามปีที่ชีตหาย), รายงานที่ใช้งานทุกตัวที่มีปีปัจจุบันใน `years` ต้องได้ `rows.length > 0` และต้องมีรายงานที่ใช้งานอย่างน้อยหนึ่งตัวที่มีแถวในปีปัจจุบัน ไม่อย่างนั้น exit 1 (รายงานที่ยังไม่มีปีปัจจุบันผ่านได้ หน้าเว็บแสดงปีล่าสุดที่มีข้อมูล หรือ "ยังไม่มีข้อมูล" ถ้าไม่มีสักปี SPEC §9.3)
- ตรวจขนาดไฟล์ตาม SPEC §6.1: เกินเป้าหมาย = exit 1, ถึง 80% = เตือน

`population.json` (เฟส 2) จากคำตอบของ `?action=registry_population` (§3.9):
- `years` = ปีของคำตอบที่มีแถว `population` อย่างน้อย 1 แถว เรียงน้อยไปมาก ทุกปีมีแถว `population` ครบ ส่วน `age` และ `village` มีเฉพาะปีสุดท้าย (ปีล่าสุดที่มีแถว `population`) ปีอื่นเป็น `[]` และถ้าปีสุดท้ายไม่มีแถวอายุหรือแถวหมู่บ้านก็เป็น `[]` · แถวคัดลอกจากคำตอบโดยไม่แก้
- ไฟล์จึงโตตามจำนวนปีแค่ปีละ 10 แถวประชากร (ราว 3 KB) ส่วนแถวอายุ (ราว 20 KB) และแถวหมู่บ้าน (94 แถว ราว 28 KB) มีปีเดียวเสมอ: ปี 2564–2568 ราว 62 KB (ก่อนมีแถวหมู่บ้าน 34.5 KB, ประมาณจากแถวของ `stat_m68` 11 พ.ย. 2569) เป้าหมาย < 100 KB (SPEC §6.1)
- ไม่มีปีใดมีแถว `population` (รวมกรณียังไม่มีชีต) → เขียน `{ "years": [] }` ไม่ล้ม
- ล้มดัง ๆ (exit 1 ไม่เขียนไฟล์ใด) เมื่อ GET ล้มหลัง retry (SPEC §6.2) หรือคำตอบผิดรูป: `years` ไม่ใช่ array, ปีใดมี `yymm` ไม่ตรง `^\d{2}12$` หรือซ้ำ, `population`/`village`/`age` ไม่ใช่ array (รวมคำตอบที่ไม่มี `village` เช่น GAS ก่อน Track I) หรือแถวใดขาดคอลัมน์ของ §2.6–2.8 (ไม่นับ `uploaded_at`)
- ล้มดัง ๆ เช่นกันเมื่อปีใดมีแถว `age` แต่ไม่ตรงกับแถว `population` ของปีนั้น: ผ่านเมื่อตรงตามเงื่อนไขของ §3.8 ข้อ 13 และ (`rcode`, `tt`) ไม่ซ้ำในแต่ละฝั่ง เพราะยอดรวมบวกตรง ๆ แถวซ้ำจึงนับสองครั้ง · ข้อความบอกปี ชีต และแถวที่ต้องแก้ · ตอนบันทึก §3.8 กันไว้แล้ว กรณีนี้จึงเกิดได้จากการแก้ชีตด้วยมือเท่านั้น · ปีที่ไม่มีแถว `age` เลยผ่าน หน้าแรกซ่อนพีระมิด (§11.3) และรายงานประชากรบอกว่าไม่มีข้อมูลอายุของปีนั้น (§11.5) รวมช่วงที่ผู้ดูแลลบแถวอายุของปีนั้นเพื่ออัปโหลดใหม่ (§3.8) · ก่อน Track K ตรวจเฉพาะปีที่แสดง (§11.3) ตั้งแต่ Track K ตรวจทุกปี เพราะ `reports/population.json` มีแถวอายุของทุกปี
- ล้มดัง ๆ แบบเดียวกันเมื่อปีใดมีแถว `village` แต่ไม่ตรงกับแถว `population` ของปีนั้น: ผ่านเมื่อตรงตามเงื่อนไขของ §3.8 ข้อ 15 และ (`rcode`, `mm`) ไม่ซ้ำ · ข้อความบอกปี ชีต และ (`rcode`, `tt`) ที่ยอดไม่ตรง · เกิดได้จากการแก้ชีตด้วยมือ หรือบันทึก `population` สำเร็จแต่ `village` ไม่สำเร็จ (§3.8) · ปีที่ไม่มีแถว `village` เลยผ่าน หน้าแรกซ่อนรายการและจำนวนหมู่บ้าน (§11.3) · ตรวจทุกปีตั้งแต่ Track K เหมือนแถวอายุ

`reports/population.json` (Track K, ADR-0016) จากคำตอบเดียวกันของ `?action=registry_population` ไม่เรียก GAS เพิ่ม:
- `years` = ปีเดียวกับของ `population.json` (มีแถว `population` อย่างน้อย 1 แถว เรียงน้อยไปมาก) แต่ทุกปีมี `population`, `age` และ `village` ตามคำตอบ ปีที่ไม่มีแถวอายุหรือแถวหมู่บ้านเป็น `[]` · แถวคัดลอกจากคำตอบโดยไม่แก้ · `population.json` ไม่เปลี่ยน
- ทุกปีผ่านการตรวจรูปแบบและการตรวจแถว `age`/`village` กับแถว `population` ข้างบน ไฟล์ทั้งสองเขียนพร้อมกันหรือไม่เขียนเลย
- ไม่มีปีใดมีแถว `population` → เขียน `{ "years": [] }` ไม่ล้ม แล้วรายงานประชากรแสดงสถานะไม่มีข้อมูล (SPEC §9.4.1)
- ขนาดต่อปีราว 51 KB: แถวประชากร 2.7 KB อายุ 20.7 KB หมู่บ้าน 27.9 KB (ไบต์ของ UTF-8 แบบไม่จัดย่อหน้า วัดจากปี 2568 ใน `population.json` ของ build 13 พ.ย. 2569) ปี 2564–2568 จึงราว 256 KB · เป้าหมาย < 500 KB (SPEC §6.1) เกิน = exit 1 ถึง 80% = เตือน งบจึงพอราว 9 ปี

## 8. ขอบเขตตำบล (GeoJSON)

| เรื่อง | ค่า |
|---|---|
| ไฟล์ | `public/geo/song-tambon.geojson` (FeatureCollection, 8 features) |
| แหล่ง | MOPH GIS `https://pherportal.moph.go.th/arcgis/rest/services/MOPH_DATA/tambon/MapServer/0` |
| Query | `/query?where=ADMIN_ID2%3D%275406%27&outFields=ADMIN_ID3%2CNAME3%2CNAME2%2CNAME1&returnGeometry=true&outSR=4326&geometryPrecision=5&f=geojson` |
| properties ที่ใช้ | `ADMIN_ID3` (6 หลัก = `tambon_master.id`) และ `NAME3` (ชื่อตำบล) |
| ตรวจรับ | ครบ 8 features และ `ADMIN_ID3` ตรงกับ `540601`–`540608` |
| แหล่งสำรอง (จาก R6) | ปภ. `MapDX/DPM_TH_Boundary/FeatureServer/3` (`AMP_CODE='5406'`) และ GISTDA (`P_code='54' AND A_code='06'`) ชื่อฟิลด์ต่างกัน ต้องแปลงเป็น `ADMIN_ID3`/`NAME3` ก่อนบันทึก |

- ถ้า `f=geojson` ใช้ไม่ได้ ให้ใช้ `f=json` แล้วแปลง rings แบบ `arcgisToGeoJSON` ของ R6
- แผนที่ใช้ `leaflet@1.9.4` จาก npm โหลดฝั่ง client เท่านั้น และใช้ tiles ของ OpenStreetMap พร้อมข้อความ attribution
- ที่ footer ระบุแหล่งขอบเขตและวันที่ดาวน์โหลดไฟล์

## 9. Type ฝั่ง frontend (`src/lib/dc/types.ts`)

```ts
export type ReportType = "coverage" | "workload";

export type Month = "10" | "11" | "12" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09";
export type Period = "year" | "q1" | "q2" | "q3" | "q4" | `m${Month}`;

/** หนึ่งแถวใน sync_status */
export interface DcYearStatus {
  b_year: string;
  row_count: number;
  max_date_com: string;
  synced_at: string; // ISO
}

export interface DcReport {
  opendata_id: string;        // ตัวพิมพ์ตามจริง (§3)
  report_name: string;
  source_table: string;
  cat_id: string;
  main_report_id: string;
  subgroup: string;              // "" = ไม่มีกลุ่ม
  order: number | null;
  report_type: ReportType | null;
  goal: number | null;
  col_target: string | null;
  col_result: string | null;
  measure_goals: Record<string, number>;
  catalog_status: "active" | "removed";
  years: DcYearStatus[];         // ว่าง = ยังไม่มีข้อมูล
}

export interface DcTopic {
  cat_id: string;
  category_name: string;
  main_report_id: string;
  main_report_name: string;
  order: number | null;
}

/** response ดิบของ GAS ?action=catalog (ยังไม่เรียง) */
export interface GasCatalog {
  meta: { current_year: string; years: string[]; district_code: string; generated_at: string };
  areas: { id: string; name_th: string }[];
  hospitals: { hospcode: string; hospname: string; tambon_id: string }[];
  topics: DcTopic[];
  reports: DcReport[];
}

/** catalog.json — เรียงแล้วและซ้อนตามลำดับชั้น */
export interface DcCatalog {
  meta: GasCatalog["meta"];
  areas: GasCatalog["areas"];
  hospitals: GasCatalog["hospitals"];
  mains: {
    main_report_id: string;
    main_report_name: string;
    topics: (DcTopic & {
      groups: { subgroup: string; reports: DcReport[] }[];   // subgroup "" อยู่ท้ายสุด
    })[];
  }[];
}

/** meta.json */
export interface SnapshotMeta {
  built_at: string;              // ISO
  current_year: string;
  years: string[];
  report_count: number;
  latest_date_com: string;       // "" ถ้ายังไม่มีข้อมูล
}

/** properties ของตำบลใน public/geo/song-tambon.geojson ที่แผนที่หน้าแรกอ่าน (§8) */
export interface AreaBoundary {
  ADMIN_ID3: string;             // รหัสตำบล 6 หลัก = areas[].id
}

export type Cell = string | number;

/** response ของ GAS ?action=report และเนื้อหา reports/{id}.json (รูปแบบเดียวกัน) */
export interface DcYearBlock {
  b_year: string;
  headers: string[];
  rows: Cell[][];                // เรียงตาม headers (กรอง id แล้ว)
  max_date_com: string;
  sheet_rows: number;            // แถวที่อ่านจากชีตก่อนกรอง id
  expected_rows: number;         // sync_status.row_count
}

export interface DcReportData {
  report: DcReport;
  years: DcYearBlock[];          // เรียงปีน้อยไปมาก
}
export type GasReport = DcReportData;

/** query ของ /reports/{id} — ค่าที่ยอมรับและค่าเริ่มต้น */
export interface ReportQuery {
  year: string;                  // 4 หลัก · default = ปีล่าสุดที่ block มีแถว ("" ถ้ายังไม่มีสักปี) · ปีที่ไม่มีข้อมูลคงไว้ให้หน้าแสดง "ไม่มีข้อมูลปี … ในระบบ"
  area: "all" | string;          // "all" หรือรหัสตำบล 6 หลัก · default "all"
  period: Period;                // default "year"
  measure: string | null;        // prefix ของรายการวัคซีน (เฉพาะตาราง M_B) ที่เปิดดูรายละเอียด · ไม่มีหรือไม่ใช่รายการของตาราง = null (ภาพรวม)
  by: "area" | "hosp";           // default "area" · ถ้า area ≠ "all" บังคับเป็น "hosp" · ตาราง 1 แถวต่อหน่วยบริการ: "hosp" เสมอ และ area เป็น "all" (SPEC §9.4)
  domain: number | null;         // ด้าน 1–9 ของ s_aged9 ที่เปิดดูรายละเอียด (F57) · ค่าอื่นหรือตารางอื่น = null
}

/** query ของ /reports — ค่าที่ยอมรับและค่าเริ่มต้น (SPEC §9.3) */
export interface LibraryQuery {
  main: string | null;           // main_report_id ของหมวดใน catalog.json หรือ "population" (SPEC §5.6) · default null (ทุกหมวด) · เป็น null เมื่อมี cat
  cat: string | null;            // cat_id ของหัวข้อใน catalog.json หรือ "population" · default null · ชนะ main
  q: string;                     // คำค้นตามที่พิมพ์ · default ""
}                                // ไม่มี page/size: ไม่แบ่งหน้า ลิงก์เก่าที่มีสองค่านี้ได้ query เดียวกับไม่มี (ADR-0013)

/** รายงานทั้งหมดที่ตรงกับ LibraryQuery ของหน้ารายงานสุขภาพ */
export interface LibraryList {
  groups: { topic: DcTopic; subgroup: string; reports: DcReport[] }[];   // ทุกรายงานที่ตรงตามหัวข้อและกลุ่ม ลำดับตาม catalog.json
  total: number;                 // จำนวนรายงานใน groups
}

export interface Totals {
  target: number;
  result: number;
  pct: number | null;
}

/** กลุ่มคอลัมน์ (§4.1) */
export type Family = "ANNUAL" | "Q_A" | "Q_B" | "Q_C" | "M_A" | "M_B" | "OVERRIDE";

/** ผลรวมของตำบลหรือหน่วยบริการหนึ่ง (§4.4) */
export interface UnitTotals {
  key: string;                   // รหัสตำบล 6 หลัก หรือ hospcode
  name: string;
  totals: Totals;
}

/** ค่าของปีหนึ่งในแนวโน้ม (§4.4) */
export interface TrendPoint {
  b_year: string;
  totals: Totals | null;         // null = ปีนั้นไม่มีคอลัมน์ที่ใช้ได้หรือไม่มีข้อมูล (SPEC §9.4) แสดง "—"
}

/* ---------- ประชากรทะเบียนราษฎร (เฟส 2 และ Track I, §2.6–2.8, §3.8–3.9, §11) ---------- */

/** แถวของ registry_population ไม่รวม uploaded_at: rows ของ POST, GET และ population.json */
export interface RegistryPopulationRow {
  yymm: string;                  // `^\d{2}12$`
  cc: string;
  cc_name: string;
  rcode: string;                 // สำนักทะเบียน 4 หลัก
  rcode_name: string;
  tt: string;                    // 8 หลัก · 6 หลักแรก = areas[].id
  tt_name: string;
  mm: string;                    // "0"
  mm_name: string;               // ""
  male: number;
  female: number;
  total: number;
  house: number;
}

/** แถวของ registry_population_village ไม่รวม uploaded_at (§2.8): คอลัมน์และชนิดเดียวกับ RegistryPopulationRow
 *  ต่างที่ mm เป็นรหัสหมู่บ้าน 8 หลัก (6 หลักแรกเท่ากับ 6 หลักแรกของ tt · 2 หลักท้าย "00" = ไม่ระบุหมู่) และ mm_name เป็นชื่อหมู่บ้านตามไฟล์ */
export type RegistryPopulationVillageRow = RegistryPopulationRow;

/** ประเภทของประชากรที่ไม่แยกอายุ ตามคอลัมน์ท้ายของไฟล์อายุ (§2.7) */
export type UnsplitGroup = "lunar" | "central" | "nonthai" | "moving";

/** แถวของ registry_population_age ไม่รวม uploaded_at · m0 … m101 และ f0 … f101 = ชายและหญิงรายปีอายุ (101 = มากกว่า 100 ปี) */
export type RegistryPopulationAgeRow = {
  yymm: string;
  rcode: string;
  tt: string;
  tt_name: string;
} & { [age: `m${number}` | `f${number}`]: number }
  & { [column in `${UnsplitGroup | "total"}_${"m" | "f" | "t"}`]: number };

export interface RegistryPopulationYear {
  yymm: string;
  population: RegistryPopulationRow[];
  village: RegistryPopulationVillageRow[];
  age: RegistryPopulationAgeRow[];
}

/** population.json (§7) */
export interface PopulationSnapshot {
  years: RegistryPopulationYear[];   // ปีที่มีแถว population เรียงน้อยไปมาก · [] = ยังไม่มีข้อมูล · age และ village มีเฉพาะปีสุดท้าย ปีอื่น []
}
/** response ของ GAS ?action=registry_population (§3.9): รูปเดียวกัน แต่มีทุก yymm ของสามชีต และแถวอายุกับแถวหมู่บ้านของทุกปี */
export type GasRegistryPopulation = PopulationSnapshot;

/** reports/population.json (§7, Track K): ทุกปีที่มีแถว population เรียงน้อยไปมาก แต่ละปีมีแถว age และ village ของปีนั้น ([] เมื่อปีนั้นไม่มี) · [] = ยังไม่มีข้อมูล */
export interface PopulationReportData {
  years: RegistryPopulationYear[];
}

/** response ของ GAS เมื่อคำขอล้มเหลว (§3): message คือเหตุผล มีเสมอ */
export interface GasError {
  status: "error";
  message: string;
}

/** response ของ POST ของ GAS เฉพาะส่วนที่ส่วนอัปโหลดในหน้า /sync อ่าน (§3.7, §3.8) */
export type GasUploadAnswer = { status: "success"; count?: number; remaining_today?: number } | GasError;

/** ไฟล์หนึ่งที่ผู้ดูแลเลือกในส่วนอัปโหลดของหน้า /sync หลังอ่านและตรวจ (§11.2): แถวของอำเภอตามชนิดไฟล์ ซึ่ง save_registry_population รับไปตามนั้น (§3.8) หรือเหตุที่ปฏิเสธ */
export type RegistryFileRead = { name: string } & (
  | { ok: true; kind: "population"; yymm: string; rows: RegistryPopulationRow[]; villages: RegistryPopulationVillageRow[] }   // stat_m: rows = แถวตำบล (kind population) · villages = แถวหมู่บ้าน (kind village)
  | { ok: true; kind: "age"; yymm: string; rows: RegistryPopulationAgeRow[] }       // ไฟล์อายุ
  | { ok: false; reason: string }
);

/** ชาย หญิง รวม และบ้านของพื้นที่หนึ่ง (§11.3) */
export interface PopulationTotals {
  male: number;
  female: number;
  total: number;
  house: number;
}

/** ช่วงอายุหนึ่งของพีระมิด (§11.3) */
export interface AgeBand {
  label: string;                 // "0–4" … "75–79", "80+"
  male: number;
  female: number;
}

/** โครงสร้างอายุของพื้นที่หนึ่ง (§11.3) */
export interface AgeProfile {
  bands: AgeBand[];              // 17 ช่วง จากอายุน้อยไปมาก
  age_total: number;             // ผลรวมจำนวนรายปีอายุ ชายและหญิง (m0…m101 + f0…f101)
  aged60: number;                // อายุ 60 ปีขึ้นไป ชายและหญิง
  aged60_pct: number;            // aged60 ÷ age_total × 100 ไม่ปัด
  unsplit: Record<UnsplitGroup, number>;   // ประชากรที่ไม่แยกอายุตามประเภท ผลรวม = totals.total − age_total
}

/** หมู่บ้านหนึ่งในแผงตำบล (§11.3): แถวหมู่บ้านของรหัสเดียวกันรวมข้ามสำนักทะเบียนแล้ว */
export interface VillagePopulation {
  code: string;                  // รหัสหมู่บ้าน 8 หลัก (mm)
  moo: number | null;            // หมู่ที่ = 2 หลักท้ายของรหัส · null = ไม่ระบุหมู่ (รหัสลงท้าย "00")
  name: string;                  // mm_name ตามไฟล์ · หน้าเว็บไม่แสดงเมื่อ moo เป็น null
  totals: PopulationTotals;
}

/** หมู่บ้านของพื้นที่หนึ่ง (§11.3) */
export interface AreaVillages {
  count: number;                 // จำนวนหมู่บ้าน ไม่นับไม่ระบุหมู่ · อำเภอ = ผลรวมของทุกตำบล
  list: VillagePopulation[];     // ตำบล: เรียงตามหมู่ที่ ไม่ระบุหมู่อยู่ท้าย · อำเภอ: [] เพราะแผงแสดงแค่จำนวน
}

/** อำเภอหรือตำบลหนึ่งในส่วนประชากรของหน้าแรก */
export interface AreaPopulation {
  key: string;                   // "all" = ทั้งอำเภอ หรือรหัสตำบล 6 หลัก (= areas[].id)
  name: string;
  totals: PopulationTotals;
  age: AgeProfile | null;        // null = ปีที่แสดงไม่มีแถวอายุ (ซ่อนพีระมิด)
  villages: AreaVillages | null; // null = ปีที่แสดงไม่มีแถวหมู่บ้าน (ซ่อนรายการและจำนวนหมู่บ้าน)
}

/** ส่วนประชากรของหน้าแรกที่ server component ส่งให้ client (SPEC §9.2) · null = ไม่มีข้อมูลประชากร */
export interface HomePopulation {
  yymm: string;                  // ปีที่แสดง (§11.3)
  district: AreaPopulation;      // key "all"
  areas: AreaPopulation[];       // ตำบล เรียงตามรหัส
}

/* ---------- รายงานประชากร (Track K, ADR-0016, SPEC §5.6, §9.4.1, §11.5) ---------- */

/** ค่าตายตัวของรายงานประชากรในแค็ตตาล็อก (SPEC §5.6) · ค่าคงที่ POPULATION_REPORT อยู่ในชั้นข้อมูล (SPEC §9.5) ไม่อยู่ใน catalog.json */
export interface PopulationReportEntry {
  id: "population";              // ไม่ใช่ hex 32 หลัก จึงไม่ชนกับ opendata_id
  report_name: string;           // "ประชากรและบ้าน รายตำบลและรายหมู่บ้าน"
  cat_id: "population";
  category_name: string;         // "ประชากรทะเบียนราษฎร"
  main_report_id: "population";
  main_report_name: string;      // "ข้อมูลประชากร"
  keywords: string[];            // คำค้นที่นับเป็นข้อมูลอ้างอิงภายในระบบ (SPEC §9.3): ["ผู้สูงอายุ"]
}

/** query ของ /reports/population — ค่าที่ยอมรับและค่าเริ่มต้น (SPEC §9.4.1) */
export interface PopulationQuery {
  year: string;                  // ปีข้อมูล 4 หลัก เช่น "2568" (yymm "6812") · default = ปีล่าสุด ("" ถ้ายังไม่มีสักปี) · ปีที่ไม่มีคงไว้ให้หน้าแสดง "ไม่มีข้อมูลปี … ในระบบ"
  area: "all" | string;          // "all", รหัสตำบล 6 หลักของ areas หรือรหัสหมู่บ้าน 8 หลักที่มีแถวในปีใดปีหนึ่งและไม่ลงท้าย "00" · รหัส 8 หลักอื่นได้ตำบลของรหัสถ้า 6 หลักแรกอยู่ใน areas ไม่อย่างนั้น "all" · ค่าอื่น "all"
}

/** การเปลี่ยนแปลงของค่าหนึ่ง (§11.5) */
export interface PopulationChange {
  count: number;                 // ค่าใหม่ − ค่าเดิม
  pct: number | null;            // count ÷ ค่าเดิม × 100 ไม่ปัด · null เมื่อค่าเดิมเป็น 0 (แสดง "—")
}

/** ยอดของพื้นที่หนึ่งในปีข้อมูลหนึ่ง */
export interface PopulationPoint {
  year: string;                  // ปีข้อมูล 4 หลัก
  totals: PopulationTotals | null;   // null = พื้นที่ไม่มีแถวในปีนั้น แสดง "—" ไม่ใช่ 0
}

/** หน่วยย่อยหนึ่งของส่วนเปรียบเทียบ (§11.5) */
export interface PopulationUnit {
  key: string;                   // รหัสตำบล 6 หลัก หรือรหัสหมู่บ้าน 8 หลัก
  name: string;                  // ชื่อตำบล หรือ "หมู่ {หมู่ที่} {ชื่อตามปีที่เลือก}" หรือ "ไม่ระบุหมู่"
  unspecified: boolean;          // ไม่ระบุหมู่: อยู่ท้ายทุกการเรียง ไม่มีแท่ง เลือกไม่ได้
  totals: (number | null)[];     // ประชากรรวม ตามลำดับ PopulationReport.years · null = ไม่มีแถว
  change: PopulationChange | null;   // จากปีแรกที่หน่วยมีแถวถึงปีที่เลือก · null เมื่อปีที่เลือกไม่มีแถว หรือเป็นปีแรกของหน่วย
}

/** ส่วนอายุของรายงานประชากร ระดับอำเภอและตำบล (§11.5) */
export interface PopulationAgeReport {
  shown: AgeProfile | null;      // ปีที่เลือก (§11.3) · null = ปีนั้นไม่มีแถวอายุ
  first: { year: string; bands: AgeBand[] } | null;   // เส้นขอบของพีระมิด: ปีข้อมูลแรกที่มีแถวอายุ · null เมื่อเป็นปีที่เลือก หรือไม่มีปีใดมีแถวอายุ
  aged60: { year: string; pct: number | null }[];     // ร้อยละอายุ 60 ปีขึ้นไปทุกปีข้อมูล ไม่ปัด · null = ปีนั้นไม่มีแถวอายุ
  bands: { label: string; totals: (number | null)[] }[];   // 17 ช่วงอายุ × ปีข้อมูล ชายรวมหญิง · null = ปีนั้นไม่มีแถวอายุ
  sex_ratio: number | null;      // ชายต่อหญิง 100 คนของปีที่เลือก ไม่ปัด · null เมื่อ shown เป็น null
  groups: { child: number; working: number; aged: number } | null;   // ร้อยละ 0–14 / 15–59 / 60 ปีขึ้นไปของปีที่เลือก ไม่ปัด
}

/** ทุกค่าที่หน้ารายงานประชากรใช้ คืนจากชั้นข้อมูลฟังก์ชันเดียว (SPEC §9.5) */
export interface PopulationReport {
  years: string[];               // ปีข้อมูล 4 หลัก เรียงน้อยไปมาก · [] = ยังไม่มีข้อมูล
  query: PopulationQuery;        // หลังแก้ค่าที่ไม่ยอมรับ
  level: "district" | "tambon" | "village";
  name: string;                  // "อำเภอสอง", ชื่อตำบล หรือ "หมู่ 4 ศรีมูลเรือง"
  parent: { key: string; name: string } | null;   // พื้นที่ที่ใหญ่กว่า: อำเภอของตำบล ตำบลของหมู่บ้าน · null ที่ระดับอำเภอ
  villages: { key: string; name: string }[];      // ตัวเลือกช่องที่สอง: หมู่บ้านของตำบลที่เลือก (หรือของตำบลของหมู่บ้านที่เลือก) เรียงตามหมู่ที่ ไม่มีไม่ระบุหมู่ · [] ที่ระดับอำเภอ
  shown: PopulationTotals | null;                 // ปีที่เลือก · null = ไม่มีปีนั้นในระบบ หรือพื้นที่ไม่มีแถว
  change: Record<keyof PopulationTotals, PopulationChange> | null;   // จากปีก่อน (§11.5) · null เมื่อปีก่อนไม่มีในระบบ หรือพื้นที่ไม่มีแถวในปีที่เลือกหรือปีก่อน
  share: number | null;          // ร้อยละของประชากรรวมของ parent ในปีที่เลือก ไม่ปัด · null ที่ระดับอำเภอ
  trend: PopulationPoint[];      // ทุกปีข้อมูล
  units: PopulationUnit[] | null;    // ส่วนเปรียบเทียบ เรียงตามรหัส (ไม่ระบุหมู่ท้าย) · null ที่ระดับหมู่บ้าน
  partial: boolean;              // มีหน่วยที่ไม่มีแถวบางปี (หมายเหตุใต้ตาราง)
  age: PopulationAgeReport | null;   // null ที่ระดับหมู่บ้าน
}
```

## 10. ตัวแปรแวดล้อมและค่าตั้งนอกโค้ด

| ที่ | ชื่อ | ค่า |
|---|---|---|
| Cloudflare Pages (build) | `NEXT_PUBLIC_GAS_SCRIPT_URL` | URL ของ GAS Web App (prebuild script และหน้า `/sync` ใช้) |
| Cloudflare Pages (build) | `NEXT_PUBLIC_SYNC_PIN_CODE` | PIN ของหน้า `/sync` (เดิมอยู่ใน GitHub secrets) |
| Cloudflare Pages (build) | `NODE_VERSION` | `24` (Node 20 หมดอายุ 30 เม.ย. 2569) |
| GitHub secrets (ci.yml) | `NEXT_PUBLIC_GAS_SCRIPT_URL` | เดิม และ `ci.yml` ส่งเข้า build step ตั้งแต่ F14 เพราะ prebuild ต้องใช้ |
| เครื่องที่รันสคริปต์ node และ `npm run build` | `NEXT_PUBLIC_GAS_SCRIPT_URL` | `build-snapshot.mjs` และ `hdc-catalog.js` บังคับต้องมี · `sync-moph-to-gas.js` ยังมี fallback เดิม |
| `.claspignore` | `**/test/**`, `**/hdc-catalog.js`, `**/*.mjs` (เพิ่มจากของเดิม) | กันสคริปต์ node และเทสต์ไม่ให้ถูก push ขึ้น Apps Script |
| dependencies ใหม่ | `leaflet@1.9.4` | แผนที่หน้าแรก (ตอนนี้ `package.json` ยังไม่มี) |
| devDependencies ใหม่ | `tsx`, `@types/leaflet` | ตัวรันเทสต์ และ type ของ Leaflet (ไม่มีก็ build ไม่ผ่าน) |
| ชีต `settings` | `deploy_hook_url` | URL ของ Cloudflare Deploy Hook (§2.1) |
| GAS (`CONFIG`) | `DIAG_PIN` | เดิม |
| `.gitignore` | `public/data/` | ไฟล์ snapshot ไม่ commit |
| `.gitignore` | `catalog-exports/` | ไฟล์ export แค็ตตาล็อก ไม่ commit (เพิ่มแล้ว 30 ต.ค. 2569) |

## 11. ประชากรทะเบียนราษฎร (เฟส 2)

นิยามและเหตุผลใน ADR-0011, ADR-0014 (หมู่บ้าน, `stat_m` แทน `stat_t`) และ ADR-0016 (รายงานประชากร) · ชีตใน §2.6–2.8 · สัญญา GAS ใน §3.8–3.9 · `population.json` และ `reports/population.json` ใน §7 · type ใน §9 · หน้าแรกใช้ §11.3 รายงานประชากรใช้ §11.5

### 11.1 ไฟล์ของ stat.bora

ผู้ดูแลดาวน์โหลดจาก `https://stat.bora.dopa.go.th/` เมนู "ดาวน์โหลดสถิติ" · รูปแบบข้างล่างตรวจ 6 พ.ย. 2569 กับไฟล์ปี 2564–2568 และหน้า "โครงสร้างข้อมูลสถิติ" ของ stat.bora และตรวจ `stat_m` ปี 2564–2568 กับเมนูบนเว็บจริงเมื่อ 11 พ.ย. 2569 · ทั้งสองไฟล์เป็น UTF-8 มี BOM ขึ้นบรรทัดด้วย LF คั่นค่าด้วย `|` และมี `|` ปิดท้ายทุกบรรทัด (แยกด้วย `|` แล้วช่องสุดท้ายว่าง)

| | `stat_m{yy}.txt` (ก่อน Track I ใช้ `stat_t{yy}.txt`) | `{yy}12cc{จังหวัด}.txt` (ไฟล์อายุ) |
|---|---|---|
| เมนู | "จำนวนประชากร" → ปี พ.ศ. → ระดับหมู่บ้าน Text File (ลิงก์ `https://stat.bora.dopa.go.th/new_stat/file/{yy}/stat_m{yy}.txt`) · `stat_t` อยู่ที่ระดับตำบลของเมนูเดียวกัน | "จำนวนประชากรแยกรายอายุ" → ปี → จังหวัด |
| ขอบเขต | ทั้งประเทศ ราว 92,400 บรรทัด 18 MB (`stat_t` ราว 11,400 บรรทัด 2 MB) | ทั้งจังหวัด แพร่มี 118 บรรทัด ราว 76 KB |
| ค่าต่อบรรทัด | 13 ค่า `YYMM`, `CC-CODE`, `CC-DESC`, `RCODE-CODE`, `RCODE-DESC`, `CCAATT-CODE`, `CCAATT-DESC`, `CCAATTMM-CODE`, `CCAATTMM-DESC`, `MALE`, `FEMALE`, `TOTAL`, `HOUSE` = คอลัมน์ของ §2.6 ตามลำดับ | 220 ค่า: ชื่อพื้นที่ (`DESC-CCAATT`) แล้ว `MALE_AGE(0)`, `FEMALE_AGE(0)` … `MALE_AGE(101)`, `FEMALE_AGE(101)` (101 = มากกว่า 100 ปี) แล้ว `TDOB`, `XHOUSE`, `OTHER_NAT`, `MOVE`, `TOT` ชุดละ ชาย หญิง รวม = คอลัมน์ของ §2.7 ตั้งแต่ `tt_name` |
| ตัวเลข | มีจุลภาค เช่น `40,389` | ไม่มีจุลภาค |
| ปีและพื้นที่ | `YYMM` ทุกบรรทัด เช่น `6812` · บรรทัดที่ `CCAATT-CODE` เป็น `0` คือยอดรวมของสำนักทะเบียน (บรรทัดแรกเป็นยอดทั้งประเทศ และบรรทัดที่ `RCODE-CODE` เป็น `0` เป็นยอดจังหวัด) · บรรทัดที่ `CCAATTMM-CODE` เป็น `0` คือบรรทัดตำบล ส่วนบรรทัดที่ไม่ใช่ `0` คือบรรทัดหมู่บ้าน: รหัส 8 หลักที่ 6 หลักแรกเท่ากับ 6 หลักแรกของ `CCAATT-CODE` และลงท้าย `00` เมื่อไม่ระบุหมู่ | ไม่มีรหัสและปีในเนื้อไฟล์ อ่านปีและจังหวัดจากชื่อไฟล์ส่วน `{yymm}cc{จังหวัด}` ด้วย `/(\d{2})(\d{2})cc(\d{2})/` ซึ่งต้องอ่านได้แม้เบราว์เซอร์เติมเลขต่อท้ายชื่อ เช่น `6812cc54 (1).txt` |
| ลำดับบรรทัด | ประเทศ → จังหวัด → สำนักทะเบียน → ตำบล → หมู่บ้านของตำบลนั้นในสำนักทะเบียนเดียวกัน เรียงตามรหัส | บรรทัดจังหวัด แล้วเป็นบล็อก: บรรทัด "อำเภอ…" หรือ "เทศบาล…" ขึ้นบล็อกใหม่ ตามด้วยบรรทัด "ตำบล…" ของบล็อกนั้น ชื่อตำบลซ้ำข้ามบล็อกได้ เช่น "ตำบลน้ำชำ" มีทั้งในอำเภอเมืองแพร่และอำเภอสูงเม่น |
| ข้อความ | ชื่อมีช่องว่างท้าย เช่น `ตำบลบ้านหนุน ` และช่องที่ไม่มีค่าเป็น `" "` | ชื่อบล็อกเทศบาลมีช่องว่างท้าย เช่น `เทศบาลตำบลสอง ` |

- ก่อนเก็บ ตัดช่องว่างหัวท้ายของข้อความ (ช่องที่ไม่มีค่าจึงเป็น `""`) และแปลงตัวเลขเป็น number
- สูตรของ stat.bora ที่ทุกบรรทัดของไฟล์อายุเป็นไปตาม: `MALE_TOT` = Σ `MALE_AGE(0…101)` + `MALE_TDOB` + `MALE_XHOUSE` + `MALE_OTHER_NAT` + `MALE_MOVE` และแบบเดียวกันของหญิง ส่วนทุกชุด ชาย + หญิง = รวม · ทุกบรรทัดของ `stat_t` ชาย + หญิง = รวม (ตรวจครบทุกบรรทัดของ `stat_t` ปี 2564–2568 และไฟล์อายุปี 2564, 2567, 2568)
- สำนักทะเบียนของอำเภอหาจากบรรทัดที่ `CCAATT-CODE` ขึ้นต้นด้วย `district_code` ไม่ใช่จาก `RCODE-CODE` เพราะสำนักทะเบียนอำเภอสอง (`5406`) ไม่รวมเขตเทศบาลตำบลสอง ซึ่งเป็นสำนักทะเบียนแยก (`5489`) คลุมบางส่วนของบ้านหนุนและบ้านกลาง
- ไฟล์ทั้งสองของ ธ.ค. 2568 ตรงกันทุกตัวเลขในทั้ง 10 แถวของอำเภอสอง และตรงกับไฟล์รายเดือนของ ธ.ค. 2568 (ADR-0011) · `stat_t68` แก้ไขล่าสุด 24 มี.ค. 2569 ใกล้วันที่กรมการปกครองประกาศ
- **`stat_m` คือ `stat_t` ที่เพิ่มบรรทัดหมู่บ้าน (ADR-0014):** ตัดบรรทัดที่ `CCAATTMM-CODE` ไม่ใช่ `0` ออกแล้วเหลือเหมือน `stat_t` ปีเดียวกันทุกบรรทัดทั้งไฟล์ (ตรวจปี 2564–2568) · `stat_m68` กับ `stat_t68` แก้ไขล่าสุดเวลาเดียวกัน (`Last-Modified` 24 มี.ค. 2569) · ทุกบรรทัดของ `stat_m` ชาย + หญิง = รวม (ตรวจครบทุกบรรทัดปี 2564–2568)
- ภายในแต่ละสำนักทะเบียน ผลรวม ชาย หญิง รวม และบ้าน ของบรรทัดหมู่บ้านของตำบลหนึ่งเท่ากับบรรทัดตำบลนั้น และทุกบรรทัดตำบลของอำเภอสองมีบรรทัดหมู่บ้าน (ตรวจปี 2564–2568) · หมู่บ้านเดียวกันมีบรรทัดได้ทั้งใต้สำนักทะเบียนอำเภอและเทศบาล ชื่อตรงกันทุกบรรทัด (§11.4)
- บรรทัดไม่ระบุหมู่มีชื่อตามไฟล์ เช่น `54060200` "บ้านกลาง" ทั้งประเทศมี 2,016 บรรทัดในปี 2568

### 11.2 การตรวจในเบราว์เซอร์ (ส่วนอัปโหลดในหน้า `/sync`)

ฟังก์ชันล้วนใน `src/lib/dc/population.ts` (SPEC §9.5, §12.1) · ไฟล์ที่ไม่ผ่านแม้ข้อเดียวถูกปฏิเสธทั้งไฟล์พร้อมเหตุผลภาษาไทยและไม่ถูกส่ง · `district_code` อ่านจาก `meta.district_code` ของ `/data/catalog.json` (`DcCatalog` §9) ซึ่งหน้า `/sync` โหลดจากเว็บเดียวกัน การตรวจจึงไม่ต้องเรียก GAS · จังหวัดคือ 2 หลักแรกของ `district_code` (= `province_code` เพราะรหัสอำเภอขึ้นต้นด้วยรหัสจังหวัด) · ชนิดไฟล์แยกจากชื่อไฟล์ (`stat_m{yy}` หรือ `{yymm}cc{จังหวัด}`) และจำนวนค่าต่อบรรทัด · ไฟล์ที่ชื่อมี `stat_t{yy}` ถูกปฏิเสธพร้อมเหตุผลที่บอกให้ใช้ `stat_m{yy}.txt` จากเมนูระดับหมู่บ้าน (§11.1, ADR-0014) · ในชุดที่เลือก ไฟล์ที่ได้ `yymm` ซ้ำกับไฟล์ชนิดเดียวกันที่ผ่านการตรวจก่อนหน้าถูกปฏิเสธ แต่ละปีจึงถูกบันทึกครั้งเดียวต่อการอัปโหลด

`stat_m` (ข้อ 1–4 เหมือนที่เคยตรวจ `stat_t` เพราะบรรทัดตำบลเหมือนกัน §11.1):

1. ทุกบรรทัดมี 13 ค่าตาม §11.1 และตัวเลขอ่านได้
2. `YYMM` เท่ากันทุกบรรทัดและเป็นเดือน 12
3. มีบรรทัดระดับตำบลที่ `CCAATT-CODE` ขึ้นต้นด้วย `district_code`
4. ทุกสำนักทะเบียนที่มีบรรทัดตำบลของอำเภอ (อำเภอสองคือ `5406` และ `5489`): ผลรวม ชาย หญิง รวม และบ้าน ของบรรทัดตำบล (`CCAATTMM-CODE` เป็น `0`) ทุกบรรทัดของสำนักทะเบียนนั้นในทั้งไฟล์ (ตรวจก่อนตัด) เท่ากับบรรทัดยอดรวมของสำนักทะเบียน
5. บรรทัดหมู่บ้านของอำเภอ (`CCAATT-CODE` ขึ้นต้นด้วย `district_code` และ `CCAATTMM-CODE` ไม่ใช่ `0`): รหัสหมู่บ้านเป็นตัวเลข 8 หลักที่ 6 หลักแรกเท่ากับ 6 หลักแรกของ `CCAATT-CODE` · (สำนักทะเบียน, รหัสหมู่บ้าน) ไม่ซ้ำ · ผลรวม ชาย หญิง รวม และบ้าน ของบรรทัดหมู่บ้านต่อ (สำนักทะเบียน, ตำบล) เท่ากับบรรทัดตำบลคู่กัน และทุกบรรทัดตำบลของอำเภอมีบรรทัดหมู่บ้าน (เงื่อนไขเดียวกับ §3.8 ข้อ 15)
6. ผ่านแล้วเก็บบรรทัดตำบลของอำเภอเป็นแถวของ §2.6 และบรรทัดหมู่บ้านของอำเภอเป็นแถวของ §2.8 · สรุปก่อนบันทึกแสดงปี จำนวนแถว ยอดรวม และจำนวนหมู่บ้าน (รหัสหมู่บ้านไม่ซ้ำ ไม่นับไม่ระบุหมู่ อำเภอสองปี 2568: 85)

ไฟล์อายุ:

1. ชื่อไฟล์มี `{yymm}cc{จังหวัด}` เดือนเป็น 12 และจังหวัดเท่ากับ 2 หลักแรกของ `district_code`
2. ทุกบรรทัดมี 220 ค่าตาม §11.1 และตัวเลขเป็นจำนวนเต็ม
3. ในชุดที่เลือกมี `stat_m` ของ `yymm` เดียวกันที่ผ่านการตรวจ
4. จับคู่บล็อกกับสำนักทะเบียนของบรรทัดอำเภอใน `stat_m` ด้วยชื่อหลังตัดช่องว่าง: บล็อก "อำเภอ…" กับ `rcode_name` และบล็อก "เทศบาล…" กับ `rcode_name` ที่ตัดคำนำหน้า "ท้องถิ่น" (เช่น "เทศบาลตำบลสอง" ↔ "ท้องถิ่นเทศบาลตำบลสอง") สำนักทะเบียนละหนึ่งบล็อกพอดี
5. ภายในบล็อกนั้น จับคู่บรรทัดตำบลด้วยชื่อ (`tt_name` = ชื่อบรรทัด) ทุกแถวตำบลของ `stat_m` ที่เก็บต้องจับคู่ได้บรรทัดเดียว ชื่อที่ซ้ำในบล็อกอื่นจึงไม่ปนกัน
6. ยอดตรงกันสองระดับ: ตำบล `total_m`, `total_f`, `total_t` เท่ากับ `male`, `female`, `total` ของแถวคู่ · บล็อก ยอดของบรรทัดบล็อกเท่ากับบรรทัดยอดรวมของสำนักทะเบียนนั้นใน `stat_m`
7. ทุกบรรทัดตำบลที่จับคู่ได้ในข้อ 5 เป็นไปตามสูตรของ §11.1 ซึ่งเป็นแถวเดียวกับที่ GAS ตรวจซ้ำ (§3.8 ข้อ 10–11) ส่วนบรรทัดของบล็อกไม่ถูกเก็บ จึงตรวจแค่ยอดในข้อ 6
8. ผ่านแล้วได้แถวของ §2.7: `yymm` จากชื่อไฟล์ `rcode` และ `tt` จากการจับคู่ `tt_name` ตามไฟล์ สรุปก่อนบันทึกแสดงปี จำนวนแถวที่จับคู่ได้ และยอดรวม

GAS ตรวจแถวที่ส่งไปซ้ำเองตาม §3.8 ไม่เชื่อเบราว์เซอร์

### 11.3 การคำนวณ (ตอน build)

ฟังก์ชันล้วนใน `src/lib/dc/population.ts` รับ `PopulationSnapshot` กับ `areas` ของ `catalog.json` แล้วคืน `HomePopulation` (§9) หรือ `null` ถ้า `years` ว่าง:

- **ปีที่แสดง:** ปีสุดท้ายของ `years` คือ `yymm` ล่าสุดที่มีแถว `population` แสดงเป็น "ณ 31 ธ.ค. 25{yy}" เช่น `6812` → "ณ 31 ธ.ค. 2568" ทุกส่วนของหน้าแรกใช้ปีนี้
- **รายตำบล:** รวมแถว `population` ของปีที่แสดงตาม 6 หลักแรกของ `tt` (= `areas[].id`) ข้ามทุกสำนักทะเบียน ทั้ง `male`, `female`, `total`, `house` · ชื่อจาก `areas` ถ้าไม่พบใช้ `tt_name` · เรียงตามรหัสตำบล
- **ทั้งอำเภอ:** ผลรวมของทุกตำบล
- **อายุ** (เมื่อปีที่แสดงมีแถว `age`) ของอำเภอและของแต่ละตำบล รวมข้ามสำนักทะเบียนแบบเดียวกัน:
  - 17 ช่วงอายุแยกชายหญิง: `0–4`, `5–9` … `75–79` (ผลรวม `m{a}`/`f{a}` ของอายุในช่วง) และ `80+` (อายุ 80 ถึง 101 จึงรวมมากกว่า 100 ปี)
  - `age_total` = Σ `m0…m101` + Σ `f0…f101` · `aged60` = ผลรวมของอายุ 60 ถึง 101 ทั้งสองเพศ · `aged60_pct` = `aged60 ÷ age_total × 100` แสดงด้วย `formatPct` แบบร้อยละอื่น (CODING_STANDARDS §4)
  - ประชากรที่ไม่แยกอายุ = `total_t − age_total` แยกตามประเภทเป็น `lunar_t`, `central_t`, `nonthai_t`, `moving_t` (ผลรวมเท่ากันตามสูตรของ §11.1)
- ปีที่แสดงไม่มีแถว `age` → `age = null` ทุกพื้นที่ (ซ่อนเฉพาะพีระมิด)
- **หมู่บ้าน** (เมื่อปีที่แสดงมีแถว `village`, Track I):
  - รวมแถว `village` ของปีที่แสดงตาม `mm` ข้ามทุกสำนักทะเบียน ทั้ง `male`, `female`, `total`, `house` · ตำบลของหมู่บ้านคือ 6 หลักแรกของ `mm` · ชื่อคือ `mm_name` ของแถวแรกตามลำดับใน `population.json` (ชื่อตรงกันทุกสำนักทะเบียนในปี 2564–2568 §11.4)
  - หมู่ที่ = 2 หลักท้ายของ `mm` เป็นตัวเลข (`"04"` → 4) · `00` = ไม่ระบุหมู่ (`moo = null`) ไม่นับใน `count` และอยู่ท้าย `list`
  - ตำบล: `list` เรียงตามหมู่ที่ และ `count` = จำนวนหมู่บ้านที่ `moo` ไม่ใช่ `null` · ผลรวม `list` เท่ายอดของตำบล เพราะ prebuild ตรวจแล้ว (§7) · อำเภอ: `count` = ผลรวมของทุกตำบล และ `list = []`
- ปีที่แสดงไม่มีแถว `village` → `villages = null` ทุกพื้นที่ (ซ่อนรายการและจำนวนหมู่บ้าน)

### 11.4 ตัวเลขอ้างอิง ธ.ค. 2568 (ค่าคาดหวังของเทสต์)

จาก `stat_t68.txt` และ `6812cc54.txt` (ตรวจ 6 พ.ย. 2569) และแถวหมู่บ้านจาก `stat_m64.txt`–`stat_m68.txt` (ตรวจ 11 พ.ย. 2569, ตัวเลขเป็นของปี 2568 ถ้าไม่ระบุปี) · `stat_m68` ให้แถวตำบลเดียวกับ `stat_t68` ตัวเลขของแถวตำบลจึงใช้ได้กับทั้งสองไฟล์ · ค่าคาดหวังของเทสต์ใช้ตัวเลขที่มาจากแหล่งอิสระ ไม่คำนวณซ้ำด้วยสูตรเดียวกับโค้ด (CODING_STANDARDS §5) จึงระบุที่มาไว้

| เรื่อง | ค่า | ที่มา |
|---|---|---|
| อำเภอสองทั้งอำเภอ | 46,527 คน (ชาย 22,475 หญิง 24,052) บ้าน 20,101 | ยอดที่จังหวัดประกาศ = บรรทัดยอดรวมของ `5406` + `5489` |
| บรรทัดยอดรวมของสำนักทะเบียน | `5406` อำเภอสอง 40,389 คน (ชาย 19,692 หญิง 20,697) บ้าน 16,904 · `5489` ท้องถิ่นเทศบาลตำบลสอง 6,138 คน (ชาย 2,783 หญิง 3,355) บ้าน 3,197 | บรรทัดที่ `CCAATT-CODE` = `0` |
| แถวต่อปีในชีต | 10 แถว: `5406` 8 ตำบล และ `5489` 2 ตำบล (บ้านหนุน บ้านกลาง) | บรรทัดตำบลในไฟล์ |
| ตำบลที่มีสองสำนักทะเบียน | บ้านหนุน 7,399 คน (4,536 + 2,863) 3,499 บ้าน (2,163 + 1,336) · บ้านกลาง 6,686 คน (3,411 + 3,275) 3,335 บ้าน (1,474 + 1,861) | บรรทัดตำบลของ `5406` + `5489` |
| ผลรวมจำนวนรายปีอายุ (อำเภอ) | 46,362 คน (ชาย 22,363 หญิง 23,999) | เท่ากับประชากรทะเบียนราษฎรระดับอำเภอบนหน้าเว็บ HDC (ADR-0011) |
| อายุ 60 ปีขึ้นไป (อำเภอ) | 13,487 คน (ชาย 5,896 หญิง 7,591) ร้อยละ 29.09 ของ 46,362 | ผลรวมคอลัมน์ `m60…m101`, `f60…f101` ของไฟล์ |
| ประชากรที่ไม่แยกอายุ (อำเภอ) | 165 คน: ไม่ใช่สัญชาติไทย 81 · ทะเบียนบ้านกลาง 75 · ระหว่างการย้าย 9 · เกิดปีจันทรคติ 0 | คอลัมน์ `*_t` ท้ายแถวของไฟล์อายุ และ 46,527 − 46,362 |
| ยอดรวมรายปี | 2564 = 48,645 · 2565 = 48,175 · 2566 = 47,636 · 2567 = 47,053 · 2568 = 46,527 | บรรทัดยอดรวมของ `5406` + `5489` ใน `stat_t` แต่ละปี |
| หมู่บ้านทั้งอำเภอ | 85 หมู่บ้าน: บ้านหนุน 11 · บ้านกลาง 12 · ห้วยหม้าย 17 · เตาปูน 12 · หัวเมือง 13 · สะเอียบ 10 · แดนชุมพล 4 · ทุ่งน้าว 6 · ชุดรหัสและชื่อเหมือนกันทุกปี 2564–2568 | รหัสหมู่บ้านไม่ซ้ำที่ไม่ลงท้าย `00` ในบรรทัดหมู่บ้านของอำเภอสอง |
| แถวหมู่บ้านต่อปีในชีต | 94 แถวทุกปี 2564–2568 = 85 หมู่บ้าน + 7 หมู่บ้านที่มีบรรทัดซ้ำในสำนักทะเบียนที่สอง + 2 บรรทัดไม่ระบุหมู่ | บรรทัดหมู่บ้านของอำเภอสองใน `stat_m` |
| หมู่บ้านที่มีสองสำนักทะเบียน | บ้านหนุน หมู่ 4–8 และบ้านกลาง หมู่ 7, 12 มีบรรทัดทั้งใต้ `5406` และ `5489` เช่น หมู่ 4 ศรีมูลเรือง 1,031 คน (192 + 839) 538 บ้าน (128 + 410) · บ้านหนุน หมู่ 3 และบ้านกลาง หมู่ 2, 3, 5, 6 มีบรรทัดใต้ `5489` อย่างเดียว · หมู่อื่นอยู่ใต้ `5406` อย่างเดียว | บรรทัดหมู่บ้านของ `5406` และ `5489` |
| ไม่ระบุหมู่ | บ้านกลาง `54060200` เท่านั้น: `5406` 0 คน 1 บ้าน และ `5489` 14 คน (ชาย 9 หญิง 5) 2 บ้าน รวม 14 คน 3 บ้าน · ชื่อในไฟล์ "บ้านกลาง" | บรรทัดที่รหัสหมู่บ้านลงท้าย `00` |
| ผลรวมหมู่บ้าน = ตำบล | ทั้ง 10 แถวตำบล (`rcode`, `tt`) ทั้ง ชาย หญิง รวม และบ้าน ทุกปี 2564–2568 · บ้านหนุนรวมทุกหมู่ 7,399 คน 3,499 บ้าน · บ้านกลางรวมทุกหมู่และไม่ระบุหมู่ 6,686 คน 3,335 บ้าน | บรรทัดตำบลของไฟล์เดียวกัน |
| ชื่อซ้ำในตำบลเดียว | เช่น ห้วยหม้ายมี "ห้วยขอน" 4 หมู่ (หมู่ 3, 11, 14, 16) และบ้านหนุนมี "ลองลือบุญ" 3 หมู่ (หมู่ 3, 6, 8) | `CCAATTMM-DESC` |
| ชื่อหมู่บ้านยาวที่สุด | ห้วยหม้าย หมู่ 17 "ห้วยหม้ายหล่ายห้วย" (18 ตัวอักษร) | `CCAATTMM-DESC` ของอำเภอสอง |

### 11.5 การคำนวณของรายงานประชากร (Track K)

ฟังก์ชันล้วนชั้นข้อมูลเดียว (SPEC §9.5) รับ `PopulationReportData`, `PopulationQuery` และ `areas` ของ `catalog.json` แล้วคืน `PopulationReport` (§9) · ยอดของพื้นที่ในปีหนึ่งใช้การรวมของ §11.3 (ตำบลและอำเภอรวมแถว `population` ข้ามสำนักทะเบียน หมู่บ้านรวมแถว `village` ตาม `mm`) ไม่เขียนสูตรซ้ำ · ร้อยละเก็บไม่ปัด แสดงด้วย `formatPct`

- **ปีข้อมูล:** `yymm` → "25{yy}" (`6812` → `2568`) · `years` = ทุกปีของ snapshot · "ปีก่อน" ของปี Y คือปี Y − 1 เท่านั้น ถ้าไม่มีในระบบก็ไม่มีการเปลี่ยนแปลงจากปีก่อน ไม่ข้ามไปปีที่เก่ากว่า
- **พื้นที่:** ทั้งอำเภอ = ผลรวมทุกตำบล · ตำบล = รหัส 6 หลักของ `areas` · หมู่บ้าน = รหัส `mm` 8 หลักที่ไม่ลงท้าย `00` และมีแถว `village` ในปีใดปีหนึ่งของ snapshot ตำบลของหมู่คือ 6 หลักแรก · หมู่ที่ = 2 หลักท้ายเป็นตัวเลข · ชื่อหมู่ = `mm_name` ของแถวแรกในปีที่เลือก ถ้าปีนั้นไม่มีแถวใช้ของปีล่าสุดที่มีแถว · พื้นที่ที่ไม่มีแถวในปีหนึ่งได้ `null` ของปีนั้น ไม่ใช่ 0
- **การเปลี่ยนแปลง:** `count` = ค่าใหม่ − ค่าเดิม · `pct` = `count ÷ ค่าเดิม × 100` · ค่าเดิมเป็น 0 → `pct = null` · ตัวเลขสรุปเทียบปีที่เลือกกับปีก่อน ทีละค่า (`male`, `female`, `total`, `house`) · ส่วนเปรียบเทียบเทียบประชากรรวมของปีที่เลือกกับปีแรกที่หน่วยนั้นมีแถว (ปีแรกของ snapshot ถ้ามีครบทุกปี) ซึ่งต้องไม่หลังปีที่เลือก
- **ร้อยละของพื้นที่ที่ใหญ่กว่า:** ประชากรรวมของพื้นที่ ÷ ประชากรรวมของพื้นที่ที่ใหญ่กว่าในปีเดียวกัน × 100 · ตำบล → อำเภอ · หมู่บ้าน → ตำบลของหมู่ · ใช้คนเท่านั้น ไม่ใช้บ้าน
- **เปรียบเทียบหน่วยย่อย:** ทั้งอำเภอ → 8 ตำบลของ `areas` · ตำบล → หมู่บ้านของตำบลนั้นตามข้อ "พื้นที่" แล้วต่อด้วย "ไม่ระบุหมู่" (`…00`) ถ้ามีแถวในปีใดปีหนึ่ง · `totals` ทุกปีข้อมูล · `partial` = มีหน่วยใด (รวมไม่ระบุหมู่) ที่ไม่มีแถวในปีใดปีหนึ่ง · เรียงตามรหัส (ค่าเริ่มต้น) ตามประชากรรวมของปีที่เลือกจากมากไปน้อย หรือตาม `change.pct` จากมากไปน้อย (`null` ท้าย) ค่าเท่ากันเรียงตามรหัส ไม่ระบุหมู่อยู่ท้ายเสมอ
- **อายุ** (อำเภอและตำบล เมื่อปีนั้นมีแถว `age`) ใช้ `AgeProfile` ของ §11.3 ต่อปี:
  - `first` = ช่วงอายุของปีข้อมูลแรกที่มีแถว `age` เมื่อไม่ใช่ปีที่เลือก
  - `aged60[].pct` = `aged60_pct` ของแต่ละปี · `bands[].totals` = ชาย + หญิง ของช่วงอายุนั้นในแต่ละปี
  - `sex_ratio` = Σ `m0…m101` ÷ Σ `f0…f101` × 100 ของปีที่เลือก คือชายต่อหญิง 100 คนในผู้ที่แยกอายุได้ ไม่ใช้ `male`/`female` ของแถว `population` เพื่อให้ทุกค่าของส่วนอายุใช้ฐานเดียวกัน
  - `groups` = ผลรวมอายุ 0–14, 15–59 และ 60–101 ทั้งสองเพศ ÷ `age_total` × 100 · ผลรวมสามค่าเท่ากับ 100 ก่อนปัด
  - ประชากรที่ไม่แยกอายุของปีที่เลือกคือ `shown.unsplit` (§11.3)
- ปีที่ไม่มีแถว `age` → `shown = null` (ปีที่เลือก) และ `null` ของปีนั้นใน `aged60` และ `bands` · ไม่มีปีใดมีแถว `age` → `first = null` และ `bands` เป็น `null` ทุกช่อง
- ระดับหมู่บ้าน: `units = null` และ `age = null` เพราะไฟล์อายุมีแค่ระดับตำบล (§11.1)

### 11.6 ตัวเลขอ้างอิงหลายปี (ค่าคาดหวังของเทสต์ Track K)

อ่านจาก `stat_m64.txt`–`stat_m68.txt` และ `6412cc54.txt`–`6812cc54.txt` ของ stat.bora (สำเนาที่ดาวน์โหลดใน F29 และ F45 ตามลิงก์ใน §11.1) ด้วยสคริปต์ที่บวกคอลัมน์ของไฟล์ตรง ๆ ไม่ใช้โค้ดของระบบ ตรวจ 13 พ.ย. 2569 · ปี 2568 ตรงกับ §11.4 · ร้อยละปัดทศนิยม 2 ตำแหน่งจากจำนวนในตาราง · ค่าคาดหวังของเทสต์คัดลอกจากที่นี่ ไม่คำนวณซ้ำด้วยสูตรเดียวกับโค้ด (CODING_STANDARDS §5)

| เรื่อง | ค่า | ที่มา |
|---|---|---|
| ทั้งอำเภอรายปี (คน ชาย / หญิง บ้าน) | 2564 = 48,645 (23,578 / 25,067) บ้าน 19,360 · 2565 = 48,175 (23,328 / 24,847) 19,552 · 2566 = 47,636 (23,067 / 24,569) 19,763 · 2567 = 47,053 (22,768 / 24,285) 19,943 · 2568 = 46,527 (22,475 / 24,052) 20,101 | บรรทัดยอดรวมของ `5406` + `5489` ใน `stat_m` แต่ละปี |
| เปลี่ยนจากปีก่อน ปี 2568 ทั้งอำเภอ | คน −526 (−1.12% ของ 47,053) · ชาย −293 (−1.29%) · หญิง −233 (−0.96%) · บ้าน +158 (+0.79% ของ 19,943) | แถวข้างบน |
| เปลี่ยนจากปีแรก 2564 → 2568 ทั้งอำเภอ | คน −2,118 (−4.35% ของ 48,645) | แถวข้างบน |
| รายตำบลรายปี (คน 2564 · 2565 · 2566 · 2567 · 2568) | บ้านหนุน 7,877 · 7,765 · 7,624 · 7,495 · 7,399 · บ้านกลาง 7,182 · 7,069 · 6,945 · 6,809 · 6,686 · ห้วยหม้าย 7,823 · 7,749 · 7,648 · 7,532 · 7,467 · เตาปูน 8,135 · 8,126 · 8,104 · 8,052 · 7,992 · หัวเมือง 6,215 · 6,147 · 6,090 · 6,108 · 6,037 · สะเอียบ 5,501 · 5,466 · 5,441 · 5,397 · 5,335 · แดนชุมพล 2,538 · 2,501 · 2,471 · 2,431 · 2,411 · ทุ่งน้าว 3,374 · 3,352 · 3,313 · 3,229 · 3,200 · ผลรวม 8 ตำบลเท่ายอดทั้งอำเภอทุกปี | บรรทัดตำบลของ `5406` + `5489` |
| บ้านรายตำบล 2564 → 2568 | บ้านหนุน 3,378 → 3,499 · บ้านกลาง 3,230 → 3,335 · ห้วยหม้าย 3,001 → 3,096 · เตาปูน 2,837 → 2,954 · หัวเมือง 2,204 → 2,297 · สะเอียบ 2,449 → 2,555 · แดนชุมพล 918 → 957 · ทุ่งน้าว 1,343 → 1,408 | บรรทัดตำบลของ `5406` + `5489` |
| บ้านหนุน | 2568 = 7,399 คน ร้อยละ 15.90 ของ 46,527 · 2564 → 2568 −478 (−6.07% ของ 7,877) · หัวเมืองเป็นตำบลเดียวที่ปีหนึ่งเพิ่มขึ้น (2566 → 2567 +18) | แถวข้างบน |
| หมู่ 4 ศรีมูลเรือง (`54060104`) รายปี (คน บ้าน) | 2564 = 1,092 คน 524 บ้าน · 2565 = 1,069 / 529 · 2566 = 1,064 / 532 · 2567 = 1,034 / 536 · 2568 = 1,031 / 538 (192 + 839 คน) ร้อยละ 13.93 ของบ้านหนุน 7,399 · เปลี่ยนจากปีก่อน −3 คน (−0.29% ของ 1,034) · 2564 → 2568 −61 คน (−5.59%) | บรรทัดหมู่บ้านของ `5406` + `5489` |
| บ้านกลาง | 12 หมู่ทุกปี · ไม่ระบุหมู่ (`54060200`) 2564 = 16 คน · 2565 = 14 · 2566 = 15 · 2567 = 16 · 2568 = 14 คน 3 บ้านทุกปี | บรรทัดหมู่บ้านของบ้านกลาง |
| หมู่บ้านข้ามปี | ทั้ง 85 หมู่มีแถวครบทุกปี 2564–2568 ชื่อเหมือนกันทุกปี (§11.4) · ข้อมูลจริงจึงไม่มีหมู่ที่ขาดบางปี กรณีนั้นทดสอบด้วย fixture ที่ตัดปีออก | `CCAATTMM-CODE`, `CCAATTMM-DESC` |
| ผู้ที่แยกอายุได้ ทั้งอำเภอรายปี (ชาย / หญิง) | 2564 = 48,422 (23,435 / 24,987) · 2565 = 47,964 (23,189 / 24,775) · 2566 = 47,426 (22,928 / 24,498) · 2567 = 46,874 (22,641 / 24,233) · 2568 = 46,362 (22,363 / 23,999) | ผลรวม `MALE_AGE(0…101)` และ `FEMALE_AGE(0…101)` ของบรรทัดบล็อก "อำเภอสอง" + "เทศบาลตำบลสอง" ในไฟล์อายุ |
| อายุ 60 ปีขึ้นไป ทั้งอำเภอรายปี | 2564 = 11,770 (24.31%) · 2565 = 12,200 (25.44%) · 2566 = 12,594 (26.56%) · 2567 = 13,087 (27.92%) · 2568 = 13,487 (29.09%) ของผู้ที่แยกอายุได้ปีเดียวกัน | อายุ 60–101 ของบรรทัดบล็อกเดียวกัน |
| กลุ่มวัย ทั้งอำเภอ ปี 2568 | 0–14 = 5,129 (11.06%) · 15–59 = 27,746 (59.85%) · 60 ปีขึ้นไป = 13,487 (29.09%) ของ 46,362 · ปี 2564: 5,946 (12.28%) · 30,706 (63.41%) · 11,770 (24.31%) ของ 48,422 | บรรทัดบล็อกเดียวกัน |
| อัตราส่วนเพศ (ชายต่อหญิง 100 คน ผู้ที่แยกอายุได้) | 2564 = 93.79 · 2565 = 93.60 · 2566 = 93.59 · 2567 = 93.43 · 2568 = 93.18 · ถ้าใช้ `male`/`female` ของแถวประชากรจะได้ 2568 = 93.44 ซึ่ง §11.5 ไม่ใช้ | แถวผู้ที่แยกอายุได้ข้างบน |
| ช่วงอายุ ทั้งอำเภอ 2564 → 2568 (ชาย + หญิง) | 0–4 = 1,679 → 1,328 · 80+ = 1,171 → 1,298 | บรรทัดบล็อกเดียวกัน |
| ประชากรที่ไม่แยกอายุ ทั้งอำเภอรายปี | 2564 = 223 (ทะเบียนบ้านกลาง 140 · ไม่ใช่สัญชาติไทย 78 · ระหว่างการย้าย 5) · 2565 = 211 (128 · 78 · 5) · 2566 = 210 (120 · 80 · 10) · 2567 = 179 (92 · 83 · 4) · 2568 = 165 (75 · 81 · 9) · เกิดปีจันทรคติ 0 ทุกปี · เท่ายอดทั้งอำเภอ − ผู้ที่แยกอายุได้ทุกปี | คอลัมน์ `*_t` ของ `TDOB`, `XHOUSE`, `OTHER_NAT`, `MOVE` ในบรรทัดบล็อกเดียวกัน |
