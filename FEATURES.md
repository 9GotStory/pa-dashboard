# FEATURES — Song Health Data Center เฟส 1

> สถานะ: ร่าง v0.2 · 29 ต.ค. 2569 · คู่กับ [SPEC.md](SPEC.md) และ [SCHEMA.md](SCHEMA.md)
> รายการงานเรียงตามลำดับที่ต้องทำ แต่ละข้อมีเกณฑ์ตรวจรับที่ทดสอบได้ งานจะถือว่าเสร็จเมื่อผ่านเกณฑ์ ไม่ใช่เมื่อเขียนโค้ดเสร็จ
> ต้นแบบหน้าจอ R6 อยู่ที่ `docs/reference/song-health-data-center-review-03-epi-real-response-r6.html`

## กติกา

- แตก branch จาก `main` ทีละ feature (`feat/F01-settings-window` …) แล้ว PR เข้า `main` ส่วน `develop` (Backend v2) ไม่ใช้แล้ว ไม่ต้องแตะ
- GAS deploy ด้วย `npm run gas:sync` เมื่อ feature ฝั่ง GAS ผ่านเกณฑ์ (รวม deploy หลายข้อพร้อมกันได้) เป็น version ใหม่ของ deployment เดิม URL ไม่เปลี่ยน
- ห้ามแก้ไฟล์ PA เดิม (ไฟล์ที่มีอยู่ใต้ `src/components/` ไม่รวม `src/components/dc/` ใหม่, `src/lib/useKPIData.ts`, `kpi-*.ts`, `excel-export.ts`, `types.ts`) ยกเว้นย้ายไฟล์ใน F12
- ทุก PR ต้อง `npm run build` ผ่าน (ci.yml)
- ลำดับ: Track A → B → C ต้องเสร็จก่อนขึ้นเว็บจริง ส่วน Track D ทำคู่ขนานได้ตั้งแต่ F05–F06 ผ่าน และ Track E ทำท้ายสุด

| Track | งาน | ขึ้นกับ |
|---|---|---|
| A — GAS | F01–F07 | — |
| B — เครื่องมือ sync | F08–F10 | F02, F03, F04 |
| C — ข้อมูล | F11 | A, B |
| D — Frontend | F12–F18 | F05, F06 (เริ่ม F12–F15 ได้ก่อน) |
| E — Hosting | F19, F20 | D |

---

## Track A — GAS (`src/scripts/รหัส.js`)

### F01 ตั้งค่า `district_code` และ window ปี

- **ทำ:** เพิ่ม `district_code` ใน `SETTINGS_SCHEMA` (ต้องขึ้นต้นด้วย `province_code`) · `CONFIG.HISTORY_YEARS = 5` · ฟังก์ชัน `getYearWindow(settings)` คืน array 5 ปีเรียงน้อยไปมาก · bump `SETTINGS_CACHE_KEY` เป็น `settings_v3`
- **ตรวจรับ:**
  1. `settings` ไม่มีคอลัมน์ → ใช้ `5406` โดยไม่ error
  2. ใส่ `district_code = 5501` (ไม่ตรงจังหวัด) → ใช้ค่าเริ่มต้น และมีบรรทัด `readSettings: district_code has invalid value` ใน execution log ของ Apps Script
  3. `current_year = 2569` → window = `["2565","2566","2567","2568","2569"]`

### F02 บันทึกข้อมูลหลายปีเฉพาะอำเภอ

- **ทำ:** `save_kpi_data` รับ `year`/`total` · กรองอำเภอ · แทนที่เฉพาะปีที่ส่ง · รวม header ข้ามปี · เรียงแถว · upsert `sync_status` (SCHEMA §2.4–2.5, §3.3) · `saveDataToSheet` เดิมใช้กับ `syncAllData` ด้วย ให้ `syncAllData` ส่ง `year = current_year` ผ่านทางเดียวกัน
- **ตรวจรับ (ใช้ชีตทดสอบหรือตาราง `s_kpi_dental33` ซึ่งเล็ก):**
  1. ส่งปี 2569 แล้วส่งปี 2568 → ชีตมีแถวของทั้งสองปี `sync_status` มี 2 แถว
  2. ส่งปี 2569 ซ้ำด้วยข้อมูลที่ต่างกัน → แถว 2568 ไม่เปลี่ยน แถว 2569 เป็นชุดใหม่ทั้งหมด
  3. ข้อมูลทั้งจังหวัด 700 แถว → บันทึกเฉพาะ `5406` และ response `received = 700`, `count` = จำนวนแถวอำเภอ
  4. `year = 2560` (นอก window) → error `Year outside window` ไม่แก้ชีต
  5. `total = 2444` แต่ส่งมา 1000 แถว → error `Incomplete data` ไม่แก้ชีต
  6. payload ไม่มี `areacode` → error `No areacode column`
  7. ส่งปี 2568 ที่มีคอลัมน์ใหม่ → header ต่อท้าย และแถว 2569 เดิมมีค่าว่างในคอลัมน์นั้น

### F03 `BATCH_ALL` กรองปีปัจจุบัน และแยก PA units / DC units

- **ทำ:** `getSyncUnits` เดิมเปลี่ยนชื่อเป็น `getPaUnits` · `getSyncUnits` ใหม่ = PA ∪ DC · `BATCH_ALL` และ single-sheet mode เก็บเฉพาะแถว `b_year = current_year` (ถ้าไม่มีคอลัมน์ `b_year` ใช้ทุกแถว) · `meta.kpi_config` มาจาก `getSyncUnits` ใหม่ · เพิ่ม `meta.years` = window (SCHEMA §3.5)
- **ตรวจรับ:**
  1. ก่อนแก้ บันทึก response `BATCH_ALL` ไว้ หลังแก้ (ข้อมูลยังปีเดียว) response เหมือนเดิมทุกฟิลด์ ยกเว้น `meta.kpi_config` ที่อาจมีรายการ DC เพิ่ม และ `meta.years` ที่เพิ่มใหม่
  2. หลัง F02 ข้อ 1 (มี 2 ปีในชีต) ตัวเลข `target/result` ของตารางนั้นใน `BATCH_ALL` เท่ากับตอนมีปีเดียว
  3. `/pa` (หรือ `/` ก่อน F12) แสดงตัวเลขเท่าเดิม

### F04 ชีตแค็ตตาล็อกและ `save_catalog`

- **ทำ:** `setup=datacenter` สร้าง `hdc_topics`, `hdc_reports`, `sync_status` + คอลัมน์ `district_code` · ตัวอ่าน `readHdcTopics()`/`readHdcReports()` พร้อม validation และนิยาม "รายงานที่ใช้งาน" · `save_catalog` ตาม SCHEMA §3.4 · `sanitizeHdcId`
- **ตรวจรับ (ใช้ไฟล์ response จริงของหัวข้อวัคซีน 46 แถวเป็น fixture):**
  1. `setup=datacenter` รัน 2 ครั้ง → ครั้งสองตอบ `created: []` และไม่ลบข้อมูลที่มี
  2. `save_catalog` ครั้งแรก → `added: 34, updated: 0, removed: 0, skipped: 0` และทุกแถว `enabled = FALSE`
  3. ติ๊ก `enabled` 1 แถว ใส่ `subgroup` แล้วส่งซ้ำ → `updated: 34` และค่าที่ติ๊กไม่หาย
  4. ส่งรายการที่ตัด 1 รายงานออก → แถวนั้น `catalog_status = removed` แถวยังอยู่
  5. ส่ง `cat_id` ที่ไม่อยู่ใน `hdc_topics` → error `Topic not in hdc_topics`
  6. ส่ง `reports: []` → error `Empty report list` และไม่มีแถวถูกตั้ง `removed`
  7. รายงานที่ `source_table` ไม่ขึ้นต้นด้วย `s_` → นับใน `skipped` ไม่ถูกเพิ่ม

### F05 `GET ?action=catalog`

- **ทำ:** ตาม SCHEMA §3.1 + แคช `dc_catalog_v1` 300 วินาที + ล้างแคชใน `save_kpi_data`, `save_catalog`, `clearConfigCache`
- **ตรวจรับ:**
  1. response ตรง type `DcCatalog` (SCHEMA §8) ตรวจด้วยสคริปต์เล็ก ๆ ที่อ่าน JSON แล้วเช็กฟิลด์บังคับ
  2. มีเฉพาะรายงานที่ `enabled = TRUE` และหัวข้ออยู่ใน `hdc_topics`
  3. `s_epi2` มี `measure_goals.mmr1 = 95` และ `measure_goals.dtp4 = 90`
  4. `years` ของตารางที่ sync แล้วตรงกับ `sync_status`
  5. ติ๊ก `enabled` เพิ่มแล้วเรียกทันที → ยังไม่เห็น (แคช) · กด "Clear Config Cache" → เห็น

### F06 `GET ?action=report&id=`

- **ทำ:** ตาม SCHEMA §3.2
- **ตรวจรับ:**
  1. `id` ของ fully immunized 1 ปี → ทุกแถว `id = 28dd2c79…` และ `areacode` ขึ้นต้น `5406`
  2. `id` ของ `s_epi2` → ทุกแถว `id = 71e49e4b…` · `id` ของ `s_dental_0_5_cavity_free` (ชีตไม่มีคอลัมน์ `id`) → ได้ทุกแถวของอำเภอ
  3. `id` ที่ไม่เปิด หรือไม่มี → error `Unknown report`
  4. `id` ผ่านรูปแบบแต่ชีตยังไม่มี → `headers: [], rows: []`

### F07 `setup=dc_seed`

- **ทำ:** เขียนโค้ดของ `setup=dc_seed` ที่ใส่คอลัมน์ผู้ดูแลของ 21 รายงานตาม SCHEMA §6 โดยจับคู่ `opendata_id` (ข้อนี้เขียนโค้ดอย่างเดียว การรันจริงอยู่ใน F11 เพราะต้องรอ `refresh` จาก F09 ก่อน)
- **ตรวจรับ (รันใน F11):**
  1. ตอบ `applied: 21, not_found: []`
  2. `?action=catalog` มี 21 รายงาน `s_dental_0_5_cavity_free` มี `col_target = "b"`, `col_result = "a"`
  3. รัน 2 ครั้งผลเหมือนเดิม

---

## Track B — เครื่องมือ sync

### F08 `src/scripts/sync-moph-to-gas.js`

- **ทำ:** `--year` (ซ้ำได้) · `--backfill` · `limit = 5000` ทุกตาราง · ส่ง `year`, `total` และหยุดตารางนั้นพร้อมข้อความเมื่อได้แถวน้อยกว่า `total` (SPEC §6.1, §12.2)
- **ตรวจรับ:**
  1. `--only s_aged9` และ `--only s_epi_complete` → log แสดง `received`/`count` และจำนวนแถวที่ดึงได้ = `total` ของ MOPH
  2. `--year 2568 --only s_kpi_dental33` → `sync_status` มีแถว (`s_kpi_dental33`, 2568)

### F09 `src/scripts/hdc-catalog.js` (ใหม่)

- **ทำ:** `find <table…>`, `refresh [--cat <cat_id>]` ตาม SPEC §12.3
- **ตรวจรับ:**
  1. `find` กับ 18 ตาราง → พิมพ์ `cat_id`/`category_name`/`opendata_id`/`report_name` ครบทุกตาราง และ `opendata_id` ตรงกับ SCHEMA §6 (ถ้าไม่ตรง ต้องแก้ SCHEMA ก่อนทำ F07)
  2. `refresh` หลังใส่หัวข้อใน `hdc_topics` → สรุปต่อหัวข้อ `added/updated/removed/skipped` และ `hdc_topics.report_count` ถูกเติม
  3. ได้ 429 จาก MOPH → รอแล้วลองใหม่ ไม่ล้มทั้งคำสั่ง

### F10 หน้า `/sync`

- **ทำ:** ตัวเลือกปีจาก `meta.years` ของ `BATCH_ALL` (เพิ่มใน F03) · ส่ง `year`, `total` และ `limit = 5000` · retry เมื่อ MOPH ตอบ 429/5xx (ของเดิม retry เฉพาะ network error) · login ด้วย PIN คงเดิม
- **ตรวจรับ:**
  1. เลือกปี 2568 แล้ว sync 1 ตาราง → `sync_status` มีแถวปีนั้น
  2. ไม่เลือกปี → ค่าเริ่มต้นเป็น `current_year` และผลเหมือน sync แบบเดิม

---

## Track C — ข้อมูล

### F11 Backfill 5 ปีและตรวจตัวเลข

- **ทำ:** ตามขั้น 3–9 ใน SPEC §13: `find` → ใส่ `hdc_topics` → `refresh` → `dc_seed` → `--backfill` → `verify-all.js`
- **ตรวจรับ:**
  1. `sync_status` มีครบ 18 ตาราง × ทุกปีที่ HDC มีข้อมูลใน window (บางตารางอาจไม่มีปีเก่า ให้บันทึกไว้ว่าตารางไหนเริ่มปีไหน)
  2. `verify-all.js` ในวันเดียวกับ sync ตรงกับ `/pa` (สคริปต์ใช้ปี 2569 คงที่ ถ้า `current_year` เปลี่ยนแล้ว แก้ค่าในสคริปต์ก่อน)
  3. ค่ารายปีระดับอำเภอจาก `?action=report` ของ KPI แบบรายปี (เช่น `s_dm_screen`) คำนวณด้วยมือหรือสคริปต์แล้วตรงกับ PA

---

## Track D — Frontend

### F12 ย้าย PA ไป `/pa` และตัด `basePath`

- **ทำ:** ย้าย `src/app/page.tsx` → `src/app/pa/page.tsx`, `loading.tsx` → `pa/loading.tsx`, เพิ่ม `pa/layout.tsx` (metadata เดิม) · `src/app/page.tsx` ใหม่เป็นหน้าชั่วคราว (ชื่อระบบ + ลิงก์ไป `/pa`) จนกว่า F16 · ลบ `basePath`/`isProd` ใน `next.config.ts` · metadata root เป็นของ Data Center
- **ตรวจรับ:**
  1. `npm run build` ผ่าน และ `out/pa.html` มีอยู่
  2. `grep -r "/pa-dashboard" out/` ไม่พบ
  3. `npx serve out` แล้วเปิด `/pa` และ `/pa?cat=สร้างเสริมภูมิคุ้มกันโรค` → หน้าตาและตัวเลขเหมือน production ปัจจุบัน แท็บเปิดถูก
  4. `git diff --stat` ไม่มีไฟล์ใน `src/components` หรือ `src/lib` เปลี่ยน (นอกจาก rename)

### F13 ชั้นข้อมูล Data Center

- **ทำ:** `src/lib/dc-types.ts` (SCHEMA §8) · `src/lib/dc-api.ts` (cache ในหน่วยความจำของหน้าเท่านั้น) · `src/lib/dc-values.ts` (SCHEMA §4 ทั้งหมด: ตรวจกลุ่มคอลัมน์, measure, เป้าหมาย/ผลงานต่อแถว, รวม, จัดกลุ่มพื้นที่/หน่วย, แนวโน้ม, ผ่านเกณฑ์, วันที่ข้อมูล) · เทสต์ `src/lib/dc-values.test.ts` ด้วย `node:test` รันผ่าน `npx tsx --test` (เพิ่ม `tsx` เป็น devDependency ตัวเดียว)
- **ตรวจรับ (เทสต์):**
  1. header จริงของทั้ง 18 ตาราง (ตาม SCHEMA §4.1) → ตรวจพบกลุ่มคอลัมน์ตรงตารางนั้นทุกตัว และ `s_dm_screen`/`s_aged9` ไม่ถูกมองเป็นรายไตรมาส
  2. `s_epi1` → measure 20 รายการ `s_epi2` → 6 รายการ และ `dtp_hb3` แสดงเป็น `DTP-HB3`
  3. แถว 3 แถว target 10/20/0 result 5/10/0 → `T=30, R=15, pct=50` และแถว target 0 ทั้งหมด → `pct = null`
  4. `OVERRIDE` (`b`/`a`) ชนะ `ANNUAL` และ `M_B` ของ measure ที่เลือกชนะ `ANNUAL`
  5. `pct = 89.999` กับ `goal = 90` → ไม่ผ่าน (เทียบก่อนปัด)

### F14 โครงหน้าและธีม Data Center

- **ทำ:** `src/components/dc/Masthead.tsx` (masthead + เมนู หน้าแรก · คลังรายงาน · PA Dashboard) · `Footer.tsx` · token สีจาก R6 ใน `globals.css` ภายใต้ `@theme` (ชื่อ `--color-dc-*` ไม่ชนกับ `brand-*` ของ PA) · route group `src/app/(dc)/layout.tsx` ห่อเฉพาะ `/`, `/reports`, `/reports/view` ส่วน `/pa` และ `/sync` อยู่นอก group
- **ตรวจรับ:**
  1. `/pa` และ `/sync` ไม่มี masthead ของ Data Center และ class ของ PA ไม่เปลี่ยน
  2. `/`, `/reports`, `/reports/view` มี masthead และ footer แสดงผลได้ที่ความกว้าง 360px โดยไม่มี scroll แนวนอน

### F15 ไฟล์ขอบเขตตำบล

- **ทำ:** ดาวน์โหลดตาม SCHEMA §7 เก็บ `public/geo/song-tambon.geojson` + บันทึกวันที่และ URL ที่ใช้ใน `public/geo/README.md`
- **ตรวจรับ:**
  1. 8 features และ `ADMIN_ID3` = `540601`–`540608` ครบ ไม่ซ้ำ
  2. ไฟล์ < 500 KB
  3. วาดบน Leaflet แล้วรูปร่างอยู่ในกรอบอำเภอสอง (ไม่มี polygon หลุดไปจังหวัดอื่น)


### F16 หน้าแรก `/`

- **ทำ:** ตาม SPEC §9.2 · `src/components/dc/DistrictMap.tsx` (Leaflet, โหลดฝั่ง client ด้วย `next/dynamic` `ssr: false`, อ่าน `public/geo/song-tambon.geojson`) · เลือกตำบล (คลิกแผนที่หรือปุ่ม) แสดงรายชื่อหน่วยบริการจาก `hospitals` · การ์ดหัวข้อ · วันที่ข้อมูลล่าสุด · ที่มาของข้อมูล
- **ขึ้นกับ:** F15
- **ตรวจรับ:**
  1. แผนที่แสดง 8 ตำบลเป็นสีและชื่อตรง `tambon_master` คลิกตำบลแล้วแผงด้านข้างเปลี่ยนตาม
  2. ตำบลบ้านหนุน (`540601`) แสดงหน่วยบริการตามค่า `tambon_id` ในชีต `hospitals` ณ วันทดสอบ (ข้อมูล 29 ต.ค. 2569 คือ "บ้านหนุน" และ "สอง" — ถ้า รพ.สอง ควรอยู่ตำบลอื่น ให้แก้ที่ชีต ไม่ใช่ที่โค้ด)
  3. การ์ดหัวข้อมีจำนวนรายงานเท่ากับที่ `enabled` และลิงก์ไป `/reports?cat=…`
  4. ไม่มีคำว่า "จำลอง" หรือ "ตัวอย่าง" ในหน้า
  5. ปิด JavaScript ของ tile server (บล็อก `tile.openstreetmap.org`) → หน้ายังใช้งานได้ เลือกตำบลด้วยปุ่มได้


### F17 คลังรายงาน `/reports`

- **ทำ:** ตาม SPEC §9.3 · แถบหมวด → หัวข้อ · ค้นหา · รายการจัดหัวแถวตามหัวข้อ → กลุ่ม เรียงตาม SPEC §5.4 · แบ่งหน้า · สถานะใน URL (`main`, `cat`, `q`, `page`) · ห่อ `useSearchParams` ด้วย `<Suspense>`
- **ตรวจรับ:**
  1. `/reports?cat=4df36051…` เปิดมาเลือกหัวข้อวัคซีนและแสดง 8 รายงานใน 4 กลุ่ม เรียง กลุ่มอายุ 1 → 2 → 3 → 5 ปี และในกลุ่ม `s_epi1` มาก่อน fully immunized
  2. ค้นหา `s_epi_complete` → 4 รายงาน · ค้นหา "กลุ่มอายุ 2 ปี" → 2 รายงาน
  3. รายงานที่ยังไม่มี `years` แสดง "ยังไม่มีข้อมูล"
  4. กด back จากหน้ารายงานแล้วตัวกรองและหน้าเดิมยังอยู่ (มาจาก URL)


### F18 หน้ารายงาน `/reports/view?id=`

- **ทำ:** ตาม SPEC §9.4 ทั้งหมดสำหรับ `coverage` · กราฟ SVG 3 แบบใน `src/components/dc/charts/` · CSV · พิมพ์ (CSS `@media print`) · "เกี่ยวกับรายงานนี้" · รายงานที่เกี่ยวข้อง · fallback สำหรับ `report_type` อื่น
- **ตรวจรับ:**
  1. fully immunized 1 ปี ปี 2569 ทั้งอำเภอ: ค่า `T/R/pct` ตรงกับที่คำนวณจากชีตโดยตรง (สคริปต์หรือสูตรใน Sheets) และตรงกับ PA (`s_epi_complete__1y`)
  2. `s_epi2` เลือก measure `mmr1` → เกณฑ์แสดง 95 · เลือก `pcv4` → เกณฑ์ 90 (`goal`)
  3. `s_dental_0_5_cavity_free` ใช้ `b`/`a` และตัวเลือกช่วงเวลามีแค่ "ทั้งปี"
  4. `s_kpi_anc12` มีตัวเลือกไตรมาส และ `s_epi_complete` มีตัวเลือกเดือน ต.ค.–ก.ย.
  5. เปลี่ยนตัวกรองแล้ว URL เปลี่ยน และเปิด URL นั้นในแท็บใหม่ได้ผลเดียวกัน
  6. CSV เปิดใน Excel แล้วภาษาไทยถูก (BOM) ค่าที่ขึ้นต้นด้วย `=` ถูกกันสูตร ชื่อไฟล์ตาม SPEC §9.4
  7. เปิดด้วย URL `?year=2560` (ปีที่ไม่มีข้อมูล) → แสดง "ไม่มีข้อมูลปี … ในระบบ" ไม่ใช่ 0%
  8. `report_type` ว่าง → แสดงข้อความยังไม่รองรับ พร้อมลิงก์ HDC ไม่ crash

---

## Track E — Hosting

### F19 Cloudflare Pages

- **ทำ:** สร้างโปรเจกต์ต่อ repo ตาม SPEC §12.5 · ตั้ง env · ปิด preview · ใช้ `<project>.pages.dev` (D6)
- **ตรวจรับ:** ขั้น 10 ใน SPEC §13 และ push ไป branch อื่นที่ไม่ใช่ `main` ไม่ทำให้เกิด deployment

### F20 หน้า stub บน GitHub Pages

- **ทำ:** `legacy-redirect/index.html` + `404.html` และแก้ `deploy.yml` ตาม SPEC §12.6
- **ตรวจรับ:** ขั้น 11 ใน SPEC §13 · ปิด JavaScript แล้วหน้า stub ยังมีลิงก์ไปโดเมนใหม่ · `deploy.yml` ไม่มีขั้น `npm`

---

## งานที่รอเฟส 2 (ไม่ทำตอนนี้)

- ประชากรบนหน้าแรก (หัวข้อ "ประชากร" `ac4eed1b…`)
- รายงานชนิด `workload`
- ชื่อคอลัมน์ผลแยกย่อย (SCHEMA §4.5) หลังตรวจ `report_schema`
- ปุ่มรีเฟรชแค็ตตาล็อกบนหน้า `/sync`
- ทดลองดึง MOPH ด้วย Cloudflare Pages Function
- การยืนยันตัวตนฝั่ง server (D5) ถ้าความเสี่ยงเปลี่ยน เช่น เริ่มมีข้อมูลที่ไม่ใช่สาธารณะ
