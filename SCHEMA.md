# SCHEMA — Song Health Data Center

> สถานะ: ร่าง v0.2 · 29 ต.ค. 2569 · คู่กับ [SPEC.md](SPEC.md)
> v0.2: เพิ่ม §3.0 การยืนยันตัวตน (token ใน Script Properties) และ `verify_token`
> ข้อมูลอ้างอิงที่ใช้ตรวจ: header จริงของชีต `PA-Data` (29 ต.ค. 2569), response ของ API แค็ตตาล็อกที่ได้มา 29 ต.ค. 2569 และโค้ด `src/scripts/รหัส.js`

---

## 1. ชีตทั้งหมดใน `PA-Data`

| ชีต | สถานะ | ผู้เขียน | ผู้อ่าน |
|---|---|---|---|
| `settings` | แก้: เพิ่ม `district_code` | ผู้ดูแล | GAS |
| `kpi_registry`, `kpi_master` | เดิม | ผู้ดูแล | GAS → PA |
| `kpi_epi` | เดิม (Data Center อ่านเกณฑ์รายวัคซีน) | ผู้ดูแล | GAS → PA, DC |
| `hospitals`, `tambon_master` | เดิม (Data Center อ่านด้วย) | ผู้ดูแล | GAS → PA, DC |
| `system_logs` | เดิม | GAS | ผู้ดูแล |
| ชีตข้อมูล `s_*` | แก้: หลายปี เฉพาะอำเภอ | GAS | GAS |
| `hdc_topics` | ใหม่ | ผู้ดูแล + GAS | GAS |
| `hdc_reports` | ใหม่ | GAS (คอลัมน์จาก API) + ผู้ดูแล | GAS |
| `sync_status` | ใหม่ | GAS | GAS, ผู้ดูแล |

- แถว 1 เป็น header และ GAS อ่านคอลัมน์ตามชื่อ header (trim + ตัวพิมพ์เล็ก) เหมือนโค้ดเดิม ลำดับคอลัมน์ไม่มีผล
- ค่าติ๊กอ่านด้วย `parseBool` เดิม

## 2. รายละเอียดชีต

### 2.1 `settings` (แถว 1 = ชื่อค่า, แถว 2 = ค่า)

| คอลัมน์ | ชนิด | ค่าเริ่มต้น | กติกา |
|---|---|---|---|
| `current_quarter` | int 1–4 | `CONFIG.CURRENT_QUARTER` | เดิม |
| `current_year` | string `^\d{4}$` | `CONFIG.YEAR` | เดิม และเป็นปีสุดท้ายของ window |
| `province_code` | string `^\d{2}$` | `CONFIG.PROVINCE` | เดิม |
| `district_code` | string `^\d{4}$` | `5406` | **ใหม่** ต้องขึ้นต้นด้วย `province_code` ถ้าไม่ตรงใช้ค่าเริ่มต้นและบันทึก WARNING |

- เพิ่มใน `SETTINGS_SCHEMA` และเปลี่ยน `SETTINGS_CACHE_KEY` จาก `settings_v2` เป็น `settings_v3` เพราะรูปแบบที่แคชเปลี่ยน
- จำนวนปีย้อนหลังเป็นค่าคงที่ `CONFIG.HISTORY_YEARS = 5` ไม่ใช่ค่าในชีต
- window = ปี `current_year − 4` … `current_year` เรียงจากน้อยไปมาก

### 2.2 `hdc_topics` — หัวข้อที่เลือก (allowlist)

| คอลัมน์ | ผู้กรอก | ชนิด | ความหมาย |
|---|---|---|---|
| `cat_id` | ผู้ดูแล | `^[a-z0-9]{8,64}$` | **key** รหัสหัวข้อ (= `subcatalogId` ของ HDC) |
| `order` | ผู้ดูแล | int ≥ 1 หรือว่าง | ลำดับหัวข้อ (SPEC §5.4) |
| `category_name` | GAS | text | จาก API |
| `main_report_id` | GAS | text | จากรายงานแรกของหัวข้อ |
| `main_report_name` | GAS | text | ชื่อหมวด |
| `report_count` | GAS | int | จำนวน `opendata_id` ไม่ซ้ำในการรีเฟรชล่าสุด |
| `last_refreshed_at` | GAS | datetime | เวลาที่รีเฟรชล่าสุด |

- ตรวจ `cat_id` แค่ `a-z0-9` ไม่ใช่ hex เพราะมีรหัสจริงที่ไม่ใช่ hex เช่น `77e69d3ad62b4737b87sds811129462` (31 ตัว)
- แถวเริ่มต้น: `4df360514655f79f13901ef1181ca1c7` (การสร้างเสริมภูมิคุ้มกันโรค) และหัวข้อที่ได้จาก `hdc-catalog.js find`
- ลบแถวหัวข้อ = ซ่อนรายงานทั้งหัวข้อจาก Data Center และตารางของหัวข้อนั้นไม่ถูก sync ในฐานะ DC unit อีก (§2.3) ส่วนตารางที่ PA ใช้ยัง sync ตามเดิม

### 2.3 `hdc_reports` — รายงานในหัวข้อที่เลือก

| คอลัมน์ | ผู้กรอก | ชนิด | ความหมาย |
|---|---|---|---|
| `opendata_id` | GAS | `^[a-z0-9]{8,64}$` | **key** = ค่า `id` ในข้อมูลดิบ (32 hex หรือรหัสสั้น 21 ตัว) |
| `report_name` | GAS | text | ชื่อรายงานจาก HDC |
| `source_table` | GAS | `^s_[a-z0-9_]+$` | ชื่อตาราง HDC และชื่อชีตข้อมูล |
| `enabled` | ผู้ดูแล | checkbox | ค่าเริ่มต้น FALSE |
| `subgroup` | ผู้ดูแล | text หรือว่าง | ชื่อกลุ่มภายในหัวข้อ |
| `order` | ผู้ดูแล | int ≥ 1 หรือว่าง | ลำดับในหัวข้อ ใช้หาลำดับกลุ่มด้วย |
| `report_type` | ผู้ดูแล | `coverage` \| `workload` | ชนิดหน้ารายงาน |
| `goal` | ผู้ดูแล | number 0–100 หรือว่าง | เกณฑ์ผ่าน (ร้อยละ) |
| `col_target` | ผู้ดูแล | ชื่อคอลัมน์ หรือว่าง | override เป้าหมายรายปี (§4.1) |
| `col_result` | ผู้ดูแล | ชื่อคอลัมน์ หรือว่าง | override ผลงานรายปี ต้องกรอกคู่กับ `col_target` |
| `cat_id` | GAS | text | หัวข้อ |
| `category_name` | GAS | text | ชื่อหัวข้อ |
| `main_report_id` | GAS | text | หมวด |
| `main_report_name` | GAS | text | ชื่อหมวด |
| `catalog_status` | GAS | `active` \| `removed` | `removed` = ไม่พบใน API ครั้งล่าสุด |
| `last_seen_at` | GAS | datetime | ครั้งล่าสุดที่พบใน API |

**รายงานที่ใช้งานใน Data Center** คือแถวที่ (1) `enabled = TRUE` (2) `cat_id` อยู่ใน `hdc_topics` และ (3) `opendata_id` กับ `source_table` ผ่านรูปแบบ แถวที่ไม่ผ่านข้อ 3 จะถูกข้ามและบันทึก WARNING

- `source_table` บังคับขึ้นต้นด้วย `s_` ทุกตาราง summary ของ HDC ที่พบใช้รูปแบบนี้ และช่วยกันไม่ให้ชนชีตระบบ (`settings`, `hdc_reports` ฯลฯ) ซึ่งสำคัญเพราะชื่อนี้กลายเป็นชีตที่ `doPost` เขียนได้
- `source_table` ของรายงานที่ใช้งาน คือ DC units (SPEC §7)
- GAS เขียนคอลัมน์ผู้ดูแลแค่ 2 กรณี: ตอนเพิ่มแถวใหม่ (ตั้ง `enabled = FALSE` และปล่อยคอลัมน์อื่นว่าง) และตอนรัน `setup=dc_seed`

### 2.4 `sync_status` — ปีที่มีข้อมูลในแต่ละตาราง

| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `table` | text | ชื่อตาราง/ชีตข้อมูล |
| `b_year` | string 4 หลัก | ปีงบประมาณ |
| `row_count` | int | จำนวนแถวที่บันทึกหลังกรองอำเภอ |
| `max_date_com` | string 12–14 หลัก | `date_com` มากที่สุดของปีนั้น |
| `synced_at` | datetime | เวลาที่บันทึก |

- key = (`table`, `b_year`) และ GAS เป็นผู้เขียนคนเดียว
- เมื่อบันทึกตารางใด GAS ลบแถวของตารางนั้นที่ `b_year` อยู่นอก window

### 2.5 ชีตข้อมูล `s_*`

| เรื่อง | กติกา |
|---|---|
| ชื่อชีต | = ชื่อตาราง (`source_table` หรือ `CONFIG.KPIS[].sheet`) |
| header | รวมคอลัมน์ของทุกปี คงลำดับเดิมแล้วต่อท้ายคอลัมน์ใหม่ตามลำดับที่พบ |
| แถวที่เก็บ | `areacode` ขึ้นต้นด้วย `district_code` และ `b_year` อยู่ใน window |
| ความซ้ำ | แต่ละ (ตาราง, ปี) มาจากการบันทึกครั้งล่าสุดครั้งเดียว เพราะบันทึกแบบแทนที่ |
| การเรียงแถว | `b_year`, `areacode`, `hospcode` จากน้อยไปมาก |
| คอลัมน์ข้อความ | `id`, `hospcode`, `areacode`, `vhid` (เดิม) |
| ค่าว่าง | ค่า falsy เขียนเป็น `""` (เดิม) ตอนอ่านถือเป็น 0 |
| `b_year` | เทียบแบบ string เสมอ ถ้าตารางไม่มีคอลัมน์นี้ GAS เติมเป็นปีที่ส่งมา |
| ไม่มี `areacode` | ปฏิเสธการบันทึก (ERROR) ในเฟส 1 |

คอลัมน์ทั่วไปของแถว HDC: `id` (บางตารางไม่มี เช่น `s_dental_0_5_cavity_free`), `hospcode` 5 หลัก, `areacode` 8 หลัก (จังหวัด 2 + อำเภอ 2 + ตำบล 2 + หมู่ 2), `flag_sent`, `date_com` (`YYYYMMDDHHmm` และ `s_epi1` มีวินาทีต่อท้าย), `b_year` (ปีงบประมาณ พ.ศ.), `ip`

## 3. GAS Web App

- GET ส่งค่าทาง query เท่านั้น และ POST ใช้ `Content-Type: text/plain` โดย body เป็น JSON
- ทุก response เป็น HTTP 200 กรณีผิดพลาดตอบ `{ "status": "error", "message": "…" }` (`createJsonError` เดิม)
- `doGet` ตรวจ `action` ตามลำดับ `diag` → `catalog` → `report` ก่อนดู `sheet`
- ฟังก์ชันใหม่ `sanitizeHdcId(v)` = trim + ตัวพิมพ์เล็ก + `^[a-z0-9]{8,64}$` ใช้กับ `cat_id` และ `opendata_id` ส่วน `sanitizeGuid` เดิมของ PA ไม่แก้

### 3.0 การยืนยันตัวตน

| ค่า | ที่เก็บ | ใช้กับ | ส่งมาใน |
|---|---|---|---|
| `WRITE_TOKEN` | Script Properties | ทุก `doPost` | ฟิลด์ `token` ใน body |
| `DIAG_PIN` | Script Properties | `?action=diag` | query `pin` (ชื่อเดิม) |

- อ่านด้วย `PropertiesService.getScriptProperties().getProperty(...)` ตอนรับคำขอ ไม่แคช
- ลำดับใน `doPost`: parse body → ตรวจ `token` → จึงดู `action` ถ้า property ว่างหรือ `token` ไม่ตรง ตอบ error `Unauthorized` และบันทึก WARNING `doPost unauthorized` พร้อม `action` (ไม่บันทึก token ที่ส่งมา)
- `handleDiag` เทียบ `pin` กับ property แทน `CONFIG.DIAG_PIN` (ลบค่าคงที่นี้ออกจากโค้ด) property ว่าง = ปฏิเสธ
- เทียบด้วย `===` ธรรมดา GAS ไม่มี constant-time compare และความเสี่ยง timing attack ผ่าน GAS ต่ำพอที่จะยอมรับ
- token ควรยาวอย่างน้อย 32 ตัวอักษรแบบสุ่ม เช่นจาก `openssl rand -base64 32` และเปลี่ยนทั้งสองค่าเมื่อมีคนออกจากทีม
- GET ทุกตัวไม่ต้องใช้ token (ข้อมูลสาธารณะ)

### 3.0.1 `POST verify_token` (ใหม่)

```ts
{ action: "verify_token"; token: string }
```

ตอบ `{ status: "success" }` เมื่อ token ถูก ไม่อย่างนั้น error `Unauthorized` ตาม §3.0 ใช้โดยหน้า `/sync` ตอน login เท่านั้น

### 3.1 `GET ?action=catalog`

ตอบ `DcCatalog` (§8)

| ฟิลด์ | ที่มา |
|---|---|
| `meta.current_year`, `meta.district_code` | `settings` |
| `meta.years` | window เรียงจากน้อยไปมาก |
| `meta.generated_at` | เวลาที่สร้าง response (ISO) |
| `areas` | `tambon_master` แถวที่ `district_id = district_code` → `{ id, name_th }` |
| `hospitals` | `hospitals` → `{ hospcode, hospname, tambon_id }` |
| `topics` | ทุกแถวของ `hdc_topics` ที่ `cat_id` ผ่านรูปแบบ |
| `reports` | รายงานที่ใช้งาน (§2.3) |
| `reports[].measure_goals` | แถวของ `kpi_epi` ที่ `source_sheet = source_table` และมี `value_prefix` → `{ [value_prefix]: target }` |
| `reports[].years` | แถวของ `sync_status` ที่ `table = source_table` และอยู่ใน window เรียงตามปี |

แคชใน `CacheService` คีย์ `dc_catalog_v1` นาน 300 วินาที ถ้า JSON ใหญ่เกิน 100 KB (ขีดจำกัดของ CacheService) ไม่แคชและบันทึก WARNING ล้างแคชเมื่อ `save_kpi_data` หรือ `save_catalog` สำเร็จ และใน `clearConfigCache()`

### 3.2 `GET ?action=report&id={opendata_id}`

1. `id` ผ่าน `sanitizeHdcId` และต้องเป็นรายงานที่ใช้งาน ไม่อย่างนั้นตอบ error `Unknown report`
2. อ่านชีต `source_table` ถ้าไม่มีชีต ตอบ `headers: []` และ `rows: []`
3. กรองแถว:
   1. `areacode` ขึ้นต้นด้วย `district_code` (กันแถวเก่าแบบทั้งจังหวัดที่อาจค้างอยู่)
   2. `b_year` อยู่ใน window
   3. ถ้ามี `opendata_id` ไม่ซ้ำตั้งแต่ 2 ตัวขึ้นไปใน `hdc_reports` (ทุกสถานะ) ที่ใช้ `source_table` เดียวกัน ให้เก็บเฉพาะแถวที่ `id` (ตัวพิมพ์เล็ก) = `opendata_id` ถ้าชีตไม่มีคอลัมน์ `id` ตอบ error `Shared table without id column`
4. ตอบ `DcReportData` (§8) โดย `headers` คือ header ของชีต และ `rows` คือค่าตามที่อ่านได้จากชีต
5. ไม่แคช

### 3.3 `POST save_kpi_data` (แก้)

```ts
{ action: "save_kpi_data"; token: string; tableName: string; year?: string; total?: number; data: Row[] | { data: Row[] } }
```

| ฟิลด์ | บังคับ | ความหมาย |
|---|---|---|
| `token` | ใช่ | §3.0 |
| `tableName` | ใช่ | ต้องอยู่ใน sync units (เดิม) |
| `year` | ไม่ | ค่าเริ่มต้น = `current_year` ต้องตรง `^\d{4}$` และอยู่ใน window ไม่อย่างนั้นตอบ error `Year outside window` |
| `total` | ไม่ | `total` จาก MOPH ถ้ามีและ `data.length < total` ตอบ error `Incomplete data` โดยไม่บันทึก |
| `data` | ใช่ | แถวจาก MOPH (array หรือ envelope `{data:[…]}` แบบเดิม) |

ขั้นตอน (ถือ script lock เหมือนเดิม หลังผ่าน §3.0 แล้ว):

1. ตรวจ `tableName`, `year`, `total` ตามตาราง
2. แกะ envelope ถ้าไม่ใช่ array ตอบ error ถ้าได้ 0 แถว คงข้อมูลเดิมและบันทึก WARNING (เดิม)
3. ถ้าแถวแรกไม่มี `areacode` ตอบ error `No areacode column`
4. เก็บเฉพาะแถวที่ `String(areacode)` ขึ้นต้นด้วย `district_code` ถ้าเหลือ 0 แถว คงข้อมูลเดิมและบันทึก WARNING
5. แถวที่ไม่มี `b_year` เติมเป็น `year` ส่วนแถวที่ `b_year ≠ year` ตัดทิ้งและบันทึก WARNING พร้อมจำนวน
6. อ่านชีตเดิม เก็บแถวที่ `b_year ≠ year`, อยู่ใน window และ `areacode` ขึ้นต้นด้วย `district_code`
7. header = header เดิม ต่อท้ายด้วย key ใหม่ของแถวที่ส่งมาตามลำดับที่พบ
8. รวมแถวเดิมกับแถวใหม่ เรียงตาม §2.5 แล้วเขียนทั้งชีตใหม่ (clear → header → ตั้งรูปแบบคอลัมน์ข้อความ → ค่า)
9. upsert `sync_status` (`tableName`, `year`) และลบแถวของตารางนี้ที่อยู่นอก window
10. ล้างแคช catalog และบันทึก SUCCESS `Synced {table} {year}` พร้อมจำนวนแถว

Response: `{ status: "success"; year: string; received: number; count: number }`

- `received` = จำนวนแถวที่ส่งมา
- `count` = จำนวนแถวที่บันทึกหลังกรองอำเภอ ความหมายเปลี่ยนจากเดิม ซึ่ง `count` เคยเป็นจำนวนแถวที่ส่งมา

### 3.4 `POST save_catalog` (ใหม่)

```ts
{ action: "save_catalog"; token: string; cat_id: string; category_name?: string; reports: ApiReportRow[] }
```

`reports` คือ array จาก `by-category-id` ตามที่ได้มา (§5.2)

ขั้นตอน (ถือ script lock หลังผ่าน §3.0 แล้ว):

1. `cat_id` ผ่าน `sanitizeHdcId` และต้องมีอยู่ใน `hdc_topics` ไม่อย่างนั้นตอบ error `Topic not in hdc_topics`
2. ถ้า `reports` ว่าง ตอบ error `Empty report list` และไม่แก้อะไร เพื่อกันการตั้ง `removed` ทั้งหัวข้อเมื่อดึงจาก API ไม่สำเร็จ
3. เก็บเฉพาะแถวที่ `opendata_id` ผ่าน `sanitizeHdcId`, `source_table` ตรง `^s_[a-z0-9_]+$` และ `cat_id` เท่ากับใน body ที่เหลือนับเป็น `skipped`
4. กรองซ้ำด้วย `opendata_id` โดยเก็บตัวแรก
5. ทำทีละรายงาน:
   - มีอยู่แล้ว และ `cat_id` เดิมเท่ากับหัวข้อนี้หรือว่าง: อัปเดต `report_name`, `source_table`, `cat_id`, `category_name`, `main_report_id`, `main_report_name` ตั้ง `catalog_status = active` และ `last_seen_at = now` นับเป็น `updated`
   - มีอยู่แล้ว แต่ `cat_id` เดิมเป็นหัวข้ออื่น: ไม่แก้ (หัวข้อแรกได้สิทธิ์) นับเป็น `skipped` และบันทึก INFO
   - ยังไม่มี: เพิ่มแถวพร้อมคอลัมน์จาก API, `enabled = FALSE`, `catalog_status = active`, `last_seen_at = now` นับเป็น `added`
6. แถวเดิมของหัวข้อนี้ที่ไม่อยู่ในรายการ และยังเป็น `active` ตั้งเป็น `removed` นับเป็น `removed`
7. อัปเดตแถวใน `hdc_topics`: `category_name` (จาก body หรือรายงานแรก), `main_report_id`, `main_report_name`, `report_count`, `last_refreshed_at`
8. เขียน `hdc_reports` ทั้งชีตกลับ คงลำดับคอลัมน์เดิม และต่อท้ายคอลัมน์ที่ยังไม่มี
9. ล้างแคช catalog และบันทึก SUCCESS

Response: `{ status: "success"; added: number; updated: number; removed: number; skipped: number }`

### 3.5 `GET ?sheet=BATCH_ALL` (แก้)

- ข้อมูล (`data`) คำนวณเฉพาะ PA units (= `getSyncUnits` เดิม เปลี่ยนชื่อเป็น `getPaUnits`)
- ก่อน `processSheetRows` เก็บเฉพาะแถวที่ `String(b_year) = current_year` ถ้าชีตไม่มีคอลัมน์ `b_year` ใช้ทุกแถว (ข้อมูลรูปแบบเก่า) ใช้กติกาเดียวกันใน single-sheet mode
- `meta.kpi_config` สร้างจาก `getSyncUnits()` ใหม่ = PA units ∪ DC units ให้ client ฝั่ง sync เห็นตาราง DC รายการ DC ไม่มี `target_months`/`effective_quarter` (เป็น `null`)
- เพิ่ม `meta.years` = window (array ของ string เรียงน้อยไปมาก) ให้หน้า `/sync` ใช้ทำตัวเลือกปี
- นอกจากนี้ response เหมือนเดิมทุกอย่าง PA ไม่อ่านฟิลด์ใหม่

### 3.6 diag (เพิ่ม)

| เรียก | ผล |
|---|---|
| `?action=diag&pin=…&setup=datacenter` | สร้าง `hdc_topics`, `hdc_reports`, `sync_status` ที่ยังไม่มีพร้อม header และเพิ่ม header `district_code` ใน `settings` ถ้ายังไม่มี รันซ้ำได้ ตอบ `{ created: […], settings_column_added: bool }` |
| `?action=diag&pin=…&setup=dc_seed` | เขียนคอลัมน์ผู้ดูแลตาม §6 ลงแถวที่ `opendata_id` ตรงกัน ตอบ `{ applied: n, not_found: […] }` |

## 4. กติกาคำนวณรายงานชนิด `coverage`

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

- กลุ่มคอลัมน์ถือว่า "มี" เมื่อ header มีครบทุกคอลัมน์ของกลุ่ม จึงไม่เข้าใจผิดว่า `result1–4` ของ `s_dm_screen` หรือ `result1–9` ของ `s_aged9` เป็นไตรมาส เพราะตารางเหล่านั้นไม่มี `target1–4`
- ไตรมาสใช้กลุ่มแรกที่พบตามลำดับ `Q_A` → `Q_B` → `Q_C` (ลำดับเดียวกับ `getQuarterSum`)
- รายการ (measure) ของ `M_B`: หา header ที่ตรง `^(.+)_(0[1-9]|1[0-2])$` แล้วนับ prefix ที่มีครบ 12 เดือน ไม่นับ prefix `target`/`result` และต้องมี `target{MM}` ครบ 12 เดือนด้วย
- ชื่อรายการที่แสดง = prefix ตัวพิมพ์ใหญ่ และเปลี่ยน `_` เป็น `-` เช่น `dtp_hb3` เป็น `DTP-HB3`
- ตารางที่มีรายการต้องเลือกรายการเสมอ ค่าเริ่มต้นคือรายการแรกตามลำดับคอลัมน์

### 4.3 เป้าหมายและผลงานต่อแถว

`n(v)` = `Number(v)` เมื่อเป็นตัวเลขจำกัด ไม่อย่างนั้นเป็น 0 (`""` จึงเป็น 0)

| ช่วงเวลา | วิธีหา (ใช้ข้อแรกที่ใช้ได้) |
|---|---|
| `year` | 1. `OVERRIDE` · 2. `M_B` ของรายการที่เลือก: Σ `target{MM}`, Σ `{measure}_{MM}` · 3. `ANNUAL` · 4. Σ ไตรมาสทั้ง 4 · 5. Σ `M_A` ทั้ง 12 เดือน · 6. ไม่มีข้อใดใช้ได้: แสดง "ไม่รู้จักโครงสร้างตาราง ต้องกำหนด col_target/col_result" |
| `q1`–`q4` | กลุ่มไตรมาสที่ตรวจพบ: `target`/`result` ของไตรมาสนั้น |
| `m10`–`m09` | `M_A`: `target{MM}`/`result{MM}` หรือ `M_B`: `target{MM}`/`{measure}_{MM}` |

หน้ารายงานแสดงตัวเลือกช่วงเวลาเฉพาะระดับที่หาได้

### 4.4 การรวมและการแสดง

- เลือกแถวตาม SPEC §10 ข้อ 1
- `T` = Σ เป้าหมาย, `R` = Σ ผลงาน และ `pct` = `R / T × 100` เมื่อ `T > 0` ไม่อย่างนั้น `null`
- จัดกลุ่มรายตำบลด้วย `areacode.slice(0, 6)` แล้วหาชื่อจาก `areas` ถ้าไม่พบแสดง "รหัสพื้นที่ {6 หลัก}"
- จัดกลุ่มรายหน่วยบริการด้วย `hospcode` แล้วหาชื่อจาก `hospitals` ถ้าไม่พบแสดง "หน่วยบริการ {hospcode}"
- แนวโน้ม: คำนวณซ้ำทีละ `b_year` ใน `report.years`
- ผ่านเกณฑ์เมื่อ `pct ≥ goal` โดยเทียบค่าก่อนปัดเหมือน PA และแสดงร้อยละด้วย `formatPct` (ทศนิยม 2 ตำแหน่ง)
- เกณฑ์ของรายการวัคซีน = `measure_goals[measure]` ถ้ามี ไม่อย่างนั้นใช้ `goal`
- วันที่ข้อมูล = `date_com` สูงสุด แปลงเลข 12–14 หลักเป็นวันที่ไทยแบบเดียวกับ PA

### 4.5 คอลัมน์ที่ยังไม่แสดงในเฟส 1

ยังไม่รู้ความหมายแน่ชัด รอ data dictionary ของ HDC (อาจได้จาก `report_schema` ใน §5.4)

| ตาราง | คอลัมน์ |
|---|---|
| `s_kpi_food` | `total`, `r1`–`r6` |
| `s_aged9` | `result1`–`result9`, `result{n}_1`, `result{n}_2`, `result6_3` |
| `s_dm_screen` | `result1`–`result4` |
| `s_ht_screen` | `result1`–`result4`, `yymm`, `date_fz` |
| `s_ncd_screen_repleate1` | `yymm`, `date_fz`, `target_13`, `result_13`, `non_follow180_13`, `over180` |
| `s_ht_screen_follow` | `r1`, `r2`, `r1_q1`–`r1_q4`, `r2_q1`–`r2_q4`, `target_13`, `result_13`, `r_home_bp_13`, `r_hosp_bp_13`, `non_follow90_13`, `over90` |
| `s_dental_0_5_cavity_free` | `c` |

ไม่ใช้เป็นตัวชี้วัดเลย: `flag_sent`, `ip`

## 5. HDC Open Data API

| Endpoint | สถานะการตรวจ |
|---|---|
| `GET /opendata_api/reports/categories` | ยืนยันแล้วด้วย response จริง 29 ต.ค. 2569 |
| `GET /opendata_api/reports/categorie/by-category-id/{cat_id}` | ยืนยันแล้วด้วย response จริงของหัวข้อวัคซีน 29 ต.ค. 2569 |
| `POST /api/report_data` | ใช้งานอยู่แล้ว ส่วน `total`/`offset` พบในตัวอย่าง response ของ R6 และต้องยืนยันการแบ่งหน้าในขั้นตรวจรับ (SPEC §13) |
| `GET /api/report_year/{tableName}`, `GET /api/report_schema/{tableName}` | มาจาก repo อ้างอิง ยังไม่ได้ตรวจ และยังไม่ใช้ในเฟส 1 |

Base URL: `https://opendata.moph.go.th`

### 5.1 `categories`

ตอบเป็น array ของ `{ "cat_id": string, "category_name": string }` ณ 29 ต.ค. 2569 มี 51 หัวข้อ ไม่มีชื่อหมวดใน response นี้

### 5.2 `categorie/by-category-id/{cat_id}`

สะกด `categorie` ไม่มี s ตอบเป็น array ของ object:

| ฟิลด์ | ชนิด | ใช้ |
|---|---|---|
| `id`, `report_id` | number | ไม่ใช้ (รายการซ้ำมีค่าต่างกัน) |
| `report_name` | string | ใช้ |
| `cat_id`, `category_name` | string | ใช้ (หัวข้อ) |
| `main_report_id`, `main_report_name` | string | ใช้ (หมวด) |
| `source_table` | string | ใช้ |
| `opendata_id` | string | ใช้ เป็น key |
| `view_count` | number | ไม่ใช้ |
| `last_synced_at`, `created_at`, `updated_at` | ISO string | ไม่ใช้ |

สิ่งที่พบในหัวข้อวัคซีน (`4df36051…`):
- มี 46 แถว แต่ `opendata_id` ไม่ซ้ำแค่ 34 ตัว แถวซ้ำมีชื่อและตารางเหมือนกัน
- มีรายการขยะชื่อ "dasf" (`s_psychoactive_coverage`)
- `s_epi_complete` มี 4 รายงาน คือ อายุ 1, 2, 3 และ 5 ปี
- `main_report_id` `73daf277928bc32a1b3c8e772192543c` = ส่งเสริมป้องกัน

### 5.3 `report_data`

Request (`Content-Type: application/json`):

```json
{ "tableName": "s_epi_complete", "year": "2569", "province": "54", "type": "json", "limit": 5000, "offset": 0 }
```

- Response เป็น envelope เช่น `{ "data": [...], "total": "2444", "limit": 1000, "offset": 0 }` (ตัวอย่างจาก R6) หรือ array เปล่าแบบเก่า ต้องรับได้ทั้งสองแบบ
- `total` อาจเป็น string ต้องแปลงเป็นตัวเลขก่อนเทียบ
- การแบ่งหน้า: ถ้า `data.length < total` ให้ขอซ้ำด้วย `offset += data.length` จนครบ แล้วส่งทุกแถวพร้อม `total` ไปที่ `save_kpi_data`

### 5.4 ยังไม่ใช้ในเฟส 1

`report_year/{tableName}` (ปีที่มีข้อมูล) และ `report_schema/{tableName}` (โครงสร้างตาราง) ควรตรวจว่า `report_schema` ให้คำอธิบายคอลัมน์หรือไม่ ถ้าให้ จะใช้ตั้งชื่อคอลัมน์ใน §4.5 ได้

## 6. Seed เฟส 1

21 รายงานจาก 18 ตาราง ทุกตัวเป็น `enabled = TRUE` และ `report_type = coverage`

- `opendata_id` ของ EPI มาจาก response แค็ตตาล็อกจริง
- `opendata_id` ของ 13 KPI เดิมมาจากลิงก์ใน `kpi_master` (ขั้นตรวจรับข้อ 4 ใน SPEC §13 จะยืนยัน)
- `goal` มาจาก `target` ใน `kpi_master`/`kpi_epi`

**หัวข้อ: รอผลจาก `find`**

| `opendata_id` | `source_table` | รายงาน (ย่อ) | `order` | `goal` | `col_target` / `col_result` |
|---|---|---|---|---|---|
| `1c1b8e24aff59258a806f122e264031e` | `s_kpi_anc12` | ANC ครั้งแรก ≤ 12 สัปดาห์ | 10 | 75 | |
| `bd63b8d99f7054560fcf9c3b96f39c13` | `s_anc5` | ANC 5 ครั้งตามเกณฑ์ | 20 | 75 | |
| `4164a7c49fcb2b8c3ccca67dcdf28bd0` | `s_kpi_food` | นมแม่อย่างเดียว < 6 เดือน | 30 | 50 | |
| `1b60d68b1cb5b003fcba38a4a0e4027b` | `s_kpi_childdev4` | พัฒนาการสมวัย 0–5 ปี | 40 | 87 | |
| `684e99dc7538c8b1a97f19f91a100f08` | `s_kpi_childdev2` | คัดกรองพัฒนาการ พบสงสัยล่าช้า | 50 | 20 | |
| `aa86b13e8cb60cae6c3216b7e3e5f151` | `s_aged9` | คัดกรองผู้สูงอายุ 9 ด้าน | 60 | 80 | |
| `626c89f6b8d9f7ed90c72c719775eb07` | `s_dm_screen` | คัดกรองเบาหวาน 35 ปีขึ้นไป | 70 | 90 | |
| `9702fa28cd2ec73ecc6af89d14f46874` | `s_ht_screen` | คัดกรองความดันโลหิตสูง 35 ปีขึ้นไป | 80 | 90 | |
| `e9e461e793e8258f47d46d6956f12832` | `s_ncd_screen_repleate1` | ติดตามยืนยันวินิจฉัย สงสัยเบาหวาน | 90 | 70 | |
| `b57439ff27302ade8c38d1dd189644a4` | `s_ht_screen_follow` | ติดตามยืนยันวินิจฉัย สงสัยความดัน | 100 | 80 | |
| `abt2t2k4z4xeqzytwbave` | `s_dental_0_5_cavity_free` | เด็ก 0–5 ปี ฟันดีไม่มีผุ | 110 | 80 | `b` / `a` |
| `e07a6ff3cd63d34a759be4bff5c1a4c6` | `s_kpi_dental28` | เด็ก 6 ปี เคลือบหลุมร่องฟันแท้ | 120 | 25 | |
| `1fb6b46f1d1fd42362f97072f4b3b653` | `s_kpi_dental33` | ผู้สูงอายุตรวจช่องปากโดยทันตบุคลากร | 130 | 50 | |

`subgroup` ของ 13 รายงานนี้ว่างไว้ก่อน จนกว่าจะรู้หัวข้อ

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

- เกณฑ์รายวัคซีนมาจาก `kpi_epi` ผ่าน `measure_goals`: `s_epi1.mmr` = 95, `s_epi2.mmr1` = 95, `s_epi2.mmr2` = 95 ที่เหลือใน `kpi_epi` = 90 ส่วนรายการที่ไม่มีใน `kpi_epi` (เช่น `pcv1`–`pcv4`) ใช้ `goal` ของรายงาน
- รายงานอื่นในหัวข้อนี้ (work load, วัยเรียน, หญิงตั้งครรภ์, ผู้ใหญ่, 7 ปี ฯลฯ) ยังปิดไว้ เพราะยังไม่มีข้อมูลดิบ หรือเป็นชนิด `workload` ซึ่งรอเฟส 2

## 7. ขอบเขตตำบล (GeoJSON)

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

## 7.1 ตัวแปรแวดล้อม

| ที่ | ชื่อ | ค่า |
|---|---|---|
| Cloudflare Pages (build) | `NEXT_PUBLIC_GAS_SCRIPT_URL` | URL ของ GAS Web App |
| Cloudflare Pages (build) | `NODE_VERSION` | `20` |
| เครื่องที่รันสคริปต์ node | `NEXT_PUBLIC_GAS_SCRIPT_URL` | เดิม (ไม่บังคับ มี fallback ในสคริปต์) |
| เครื่องที่รันสคริปต์ node | `GAS_WRITE_TOKEN` | = `WRITE_TOKEN` ใน Script Properties |
| GAS Script Properties | `WRITE_TOKEN`, `DIAG_PIN` | §3.0 |

ลบ `NEXT_PUBLIC_SYNC_PIN_CODE` ออกจากทุกที่ (`deploy.yml`, `src/app/sync/page.tsx`, GitHub secrets)

## 8. Type ฝั่ง frontend (`src/lib/dc-types.ts`)

```ts
export type ReportType = "coverage" | "workload";

export type Month = "10" | "11" | "12" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09";
export type Period = "year" | "q1" | "q2" | "q3" | "q4" | `m${Month}`;

export interface DcYearStatus {
  b_year: string;
  row_count: number;
  max_date_com: string;
  synced_at: string; // ISO
}

export interface DcTopic {
  cat_id: string;
  category_name: string;
  main_report_id: string;
  main_report_name: string;
  order: number | null;
}

export interface DcReport {
  opendata_id: string;
  report_name: string;
  source_table: string;
  cat_id: string;
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

export interface DcCatalog {
  meta: { current_year: string; years: string[]; district_code: string; generated_at: string };
  areas: { id: string; name_th: string }[];
  hospitals: { hospcode: string; hospname: string; tambon_id: string }[];
  topics: DcTopic[];
  reports: DcReport[];
}

export type Cell = string | number;

export interface DcReportData {
  report: DcReport;
  headers: string[];
  rows: Cell[][];
}

export interface Totals {
  target: number;
  result: number;
  pct: number | null;
}
```
