# SPEC — Song Health Data Center

> สถานะ: ร่าง v0.3 · 29 ต.ค. 2569 · ขอบเขต: เฟส 1
> v0.2: ย้าย hosting ไป Cloudflare Pages, ตัด `basePath`, GitHub Pages เป็นหน้า stub (D1–D6 สรุปแล้วใน §15)
> v0.3: ตัดการยืนยันตัวตนด้วย token และ Cloudflare Access ออก (D5 = ยอมรับความเสี่ยง)
> เอกสารคู่กัน: [SCHEMA.md](SCHEMA.md) (โครงชีต, สัญญา API, กติกาคำนวณ, seed)
> ต้นแบบหน้าจอ: `song-health-data-center-review-03-epi-real-response-r6.html` (R6) ใช้เป็นแบบหน้าตาและการใช้งานเท่านั้น ตัวเลขทุกตัวในไฟล์เป็นข้อมูลจำลอง

---

## 1. เป้าหมาย

1. หน้าหลักของ repo `pa-dashboard` เปลี่ยนเป็น **Song Health Data Center** ศูนย์ข้อมูลสุขภาพของ สสอ.สอง ตามแนวต้นแบบ R6
2. PA Dashboard ย้ายไปที่ `/pa` และทำงานเหมือนเดิมทุกอย่าง
3. จัดรายงานตามแค็ตตาล็อกของ HDC Open Data เป็น **หมวด → หัวข้อ → กลุ่ม → รายงาน** และเลือกเฉพาะหัวข้อและรายงานที่ต้องการ (opt-in)
4. เก็บข้อมูลย้อนหลัง 5 ปีงบประมาณ เฉพาะพื้นที่อำเภอสอง (`5406`)
5. ย้าย hosting จาก GitHub Pages ไป Cloudflare Pages โดยคง stack เดิม: Next.js static export + GAS + Google Sheets

## 2. ขอบเขต

### 2.1 เฟส 1

- ย้าย route: PA ไป `/pa` และ Data Center อยู่ที่ `/`
- Hosting: Cloudflare Pages และหน้า stub ส่งต่อลิงก์เก่าบน GitHub Pages (§12.5–12.6)
- ชีตแค็ตตาล็อก `hdc_topics`, `hdc_reports` กับสคริปต์ค้นหาและรีเฟรชแค็ตตาล็อก
- เก็บข้อมูลหลายปี: บันทึกแบบแทนที่ทีละปี และชีต `sync_status`
- หน้าแรก คลังรายงาน และหน้ารายงานชนิด `coverage`
- เปิดรายงานจากข้อมูลดิบ 18 ตารางที่ sync อยู่แล้ว รวม 21 รายงาน (SCHEMA §6)

### 2.2 ไม่อยู่ในเฟส 1

| เรื่อง | เหตุผล |
|---|---|
| ข้อมูลประชากรบนหน้าแรก (หัวข้อ "ประชากร" `ac4eed1bddb23d6130746d62d2538fd0`) | ยังไม่ได้เลือกตารางประชากร ทำในเฟส 2 |
| รายงานชนิด `workload` (นับจำนวนครั้ง) | 18 ตารางในเฟส 1 เป็นชนิด `coverage` ทั้งหมด |
| ชื่อคอลัมน์ผลแยกย่อย เช่น 9 ด้านของ `s_aged9`, `result1–4` ของการคัดกรอง NCD | ต้องยืนยันจาก data dictionary ของ HDC ก่อน ไม่ตั้งชื่อเอง (SCHEMA §4.5) |
| ปุ่มรีเฟรชแค็ตตาล็อกบนหน้า `/sync` | เฟส 1 ใช้สคริปต์ node |
| เทียบกับอำเภออื่นหรือภาพรวมจังหวัด | เก็บเฉพาะ `5406` ตามที่ตกลง |
| ดึงข้อมูล MOPH ด้วย Cloudflare Pages Function แทนเบราว์เซอร์ | MOPH อาจบล็อก IP ของ datacenter (น่าจะเป็นเหตุเดียวกับที่ GAS ดึงเองไม่เสถียร) ต้องทดลองก่อน |

**ตัดออกจาก R6 ถาวร:** ส่วนนำเข้า JSON ของรายงานวัคซีน EPI-01 ได้แก่ textarea, ปุ่มอัปโหลดไฟล์, `epiImport`, แผงจับคู่รหัสกลุ่มอายุ และแถบสถานะ coverage ของไฟล์ที่นำเข้า ทุกรายงานรับข้อมูลจาก GAS เท่านั้น

## 3. ภาพรวมระบบ

```
HDC Open Data (opendata.moph.go.th)
   │  report_data · แค็ตตาล็อก
   ▼
ตัวดึงข้อมูล: หน้า /sync (เบราว์เซอร์) · sync-moph-to-gas.js · hdc-catalog.js (node)
   │  POST (Content-Type: text/plain)
   ▼
GAS Web App (src/scripts/รหัส.js) ──► Google Sheets "PA-Data"
   ▲  GET ?action=… / ?sheet=…
   │
Next.js static export บน Cloudflare Pages (https://<project>.pages.dev, ไม่มี basePath)
   /                     Data Center หน้าแรก
   /reports              คลังรายงาน
   /reports/view?id=…    หน้ารายงาน
   /pa                   PA Dashboard (ย้ายมา)
   /sync                 Sync (เดิม + เลือกปี)

GitHub Pages (https://9gotstory.github.io/pa-dashboard/) → หน้า stub ส่งต่อไปโดเมนใหม่
```

หลักการ:

- ช่องทางหลักของการดึงข้อมูลยังเป็นฝั่ง client แล้วส่งเข้า GAS เหมือนเดิม เพราะ daily trigger ของ GAS ดึงจาก MOPH ได้ไม่เสถียร
- GAS เป็นจุดเดียวที่ whitelist ตาราง กรองพื้นที่ และจัดการข้อมูลหลายปี
- ข้อจำกัด GAS เดิมยังใช้: GET ส่งค่าทาง query string เท่านั้น ไม่มี custom header, POST ใช้ `Content-Type: text/plain`
- Frontend ใช้ `NEXT_PUBLIC_GAS_SCRIPT_URL` (ถ้าไม่มี ใช้ URL เดียวกับ `src/lib/useKPIData.ts`) ส่วน PA ไม่แก้

## 4. Routes

| Path | หน้า | ไฟล์ | หมายเหตุ |
|---|---|---|---|
| `/` | Data Center หน้าแรก | `src/app/page.tsx` (เขียนใหม่) | |
| `/reports` | คลังรายงาน | `src/app/reports/page.tsx` | query: `main`, `cat`, `q`, `page` |
| `/reports/view` | หน้ารายงาน | `src/app/reports/view/page.tsx` | query: `id` (= `opendata_id`) และตัวกรองใน §9.4 |
| `/pa` | PA Dashboard | `src/app/pa/page.tsx` | ย้ายจาก `src/app/page.tsx` โดยไม่แก้เนื้อหา, ย้าย `src/app/loading.tsx` ไปเป็น `src/app/pa/loading.tsx`, ตั้ง metadata ใน `src/app/pa/layout.tsx` |
| `/sync` | Sync | `src/app/sync/page.tsx` | เพิ่มตัวเลือกปี (§12.1) |

- หน้ารายงานใช้ query (`?id=`) แทน dynamic route `[id]` เพราะ `output: 'export'` สร้างได้เฉพาะ path ที่รู้ตอน build แต่รายงานต้องเปิดจากชีตได้โดยไม่ deploy ใหม่
- หน้าที่อ่าน query ด้วย `useSearchParams` ต้องห่อด้วย `<Suspense>` ตามข้อกำหนดของ static export
- `/pa?cat=…` ใช้ได้เหมือนเดิม เพราะโค้ด PA อ่าน `window.location.pathname` อยู่แล้ว
- ไม่มี `basePath` อีก: ลบ `basePath` และ `isProd` ออกจาก `next.config.ts` ส่วน `output: 'export'` และ `images.unoptimized` คงไว้
- ลิงก์เก่าบน `github.io` จัดการที่หน้า stub (§12.6) ไม่มี redirect ในแอป
- metadata ของ root layout เปลี่ยนเป็นของ Data Center

## 5. แค็ตตาล็อกรายงาน

### 5.1 ลำดับชั้น

| ระดับ | ที่มา | key | ตัวอย่าง |
|---|---|---|---|
| หมวด | HDC: `main_report_id`, `main_report_name` | `main_report_id` | ส่งเสริมป้องกัน |
| หัวข้อ | HDC: `cat_id`, `category_name` | `cat_id` | การสร้างเสริมภูมิคุ้มกันโรค |
| กลุ่ม | กำหนดเอง: `hdc_reports.subgroup` (ไม่บังคับ) | (`cat_id`, `subgroup`) | กลุ่มอายุ 1 ปี |
| รายงาน | HDC: `opendata_id`, `report_name`, `source_table` | `opendata_id` | fully immunized 1 ปี (`s_epi_complete`) |

- `cat_id` คือค่าเดียวกับ `subcatalogId` บน hdc.moph.go.th
- `opendata_id` คือค่าในคอลัมน์ `id` ของข้อมูลดิบ และเป็นรหัสเดียวกับในลิงก์รายงานของ HDC ตรวจแล้วกับ `s_epi2`, `s_epi_complete` (เทียบกับแค็ตตาล็อก) และ `s_dm_screen`, `s_aged9` (เทียบกับลิงก์ใน `kpi_master`)
- ตารางเดียวมีหลายรายงานได้ เช่น `s_epi_complete` มี fully immunized 1, 2, 3 และ 5 ปี ระบบแยกด้วย `id`

### 5.2 เลือกเฉพาะที่ต้องการ (opt-in)

1. **หัวข้อ:** ใส่ `cat_id` ใน `hdc_topics` เฉพาะที่ต้องการ ระบบเรียก API เฉพาะหัวข้อเหล่านี้
2. **รายงาน:** API ส่งรายงานมาทั้งหัวข้อในครั้งเดียว ระบบเก็บทุกตัวลง `hdc_reports` โดยรายงานใหม่เป็น `enabled = FALSE` เสมอ ผู้ดูแลติ๊กเปิดเอง
3. เฉพาะรายงานที่ `enabled = TRUE` และหัวข้อยังอยู่ใน `hdc_topics` จึง (ก) แสดงใน Data Center และ (ข) ถูก sync ข้อมูลดิบตาม `source_table` (นิยามเต็ม: "รายงานที่ใช้งาน" ใน SCHEMA §2.3)

### 5.3 การรีเฟรชแค็ตตาล็อก

- สั่งผ่าน `node src/scripts/hdc-catalog.js refresh` (§12.3) ซึ่ง POST `save_catalog` ทีละหัวข้อ
- จับคู่ด้วย `opendata_id` และกรองรายการซ้ำ (API ส่งซ้ำได้ เช่น หัวข้อวัคซีนมี 46 แถว แต่เป็น 34 รายงาน)
- อัปเดตเฉพาะคอลัมน์ที่มาจาก API **ไม่แตะคอลัมน์ที่ผู้ดูแลกรอก** (`enabled`, `subgroup`, `order`, `report_type`, `goal`, `col_target`, `col_result`)
- รายงานที่หายไปจาก API ตั้ง `catalog_status = removed` และไม่ลบแถว เพื่อให้ข้อมูลปีเก่ายังดูได้
- หนึ่ง `opendata_id` อยู่ได้หัวข้อเดียว คือหัวข้อแรกที่บันทึก
- อัลกอริทึมเต็ม: SCHEMA §3.4

### 5.4 การเรียงลำดับ

- หัวข้อ: `hdc_topics.order` แล้วตามชื่อหัวข้อ
- หมวด: `order` ที่น้อยที่สุดของหัวข้อในหมวด แล้วตามชื่อหมวด
- กลุ่ม: `order` ที่น้อยที่สุดของรายงานในกลุ่ม (กฎเดียวกับ `sortKpisByGroup` ของ PA) รายงานที่ไม่มีกลุ่มอยู่ท้ายหัวข้อ
- รายงาน: `order` แล้วตาม `report_name`
- `order` ว่างถือเป็นลำดับท้ายสุด เทียบชื่อด้วย `localeCompare(…, "th")`

### 5.5 ลิงก์ไปต้นทาง

- HDC: `https://hdc.moph.go.th/pre/public/standard-report-detail/{opendata_id}?subcatalogId={cat_id}`
- Open Data: `https://opendata.moph.go.th/th/services/summary-table/{main_report_id}/{source_table}/{opendata_id}`

## 6. ข้อมูลย้อนหลัง 5 ปี

| เรื่อง | กติกา |
|---|---|
| ช่วงปี (window) | `current_year − 4` ถึง `current_year` จากชีต `settings` เช่น ตอนนี้ 2565–2569 และเมื่อเปลี่ยนเป็น 2570 จะเป็น 2566–2570 |
| ที่เก็บ | หนึ่งชีตต่อ `source_table` เก็บทุกปีรวมกัน แยกด้วยคอลัมน์ `b_year` |
| พื้นที่ | เก็บเฉพาะแถวที่ `areacode` ขึ้นต้นด้วย `settings.district_code` (ค่าใหม่ = `5406`) โดย GAS กรองตอนบันทึก |
| การบันทึก | แทนที่เฉพาะแถวของปีที่ส่งมา ปีอื่นคงเดิม แถวที่อยู่นอก window ถูกตัดทิ้งเมื่อบันทึกตารางนั้นครั้งถัดไป |
| คอลัมน์ต่างปี | header เป็นการรวมคอลัมน์ของทุกปี เพราะ HDC เพิ่มคอลัมน์ได้ เช่น `*_13` ใน `s_ht_screen_follow` |
| สถานะ | ชีต `sync_status` หนึ่งแถวต่อ (ตาราง, ปี): จำนวนแถว, `date_com` ล่าสุด, เวลาที่บันทึก |
| sync ประจำ | เฉพาะ `current_year` เหมือนปัจจุบัน |
| ปีย้อนหลัง | ดึงครั้งเดียว (backfill) และสั่งดึงซ้ำเองเป็นรายปีเมื่อต้องการ |
| เปลี่ยนปีงบ | แก้ `settings.current_year` แล้ว PA กับ Data Center ขยับพร้อมกัน ก่อนเปลี่ยนควรดึงปีเดิมซ้ำอีกรอบ เพราะ HDC อาจยังปรับข้อมูลปีที่แล้ว และ sync ประจำจะไม่ดึงปีนั้นอีก |

### 6.1 การดึงจาก `report_data`

- ส่ง `limit = 5000` ทุกคำขอ (ถ้า unit กำหนด `limit` มากกว่านี้ ใช้ค่าของ unit)
- ตรวจ `total` ใน response ถ้าได้แถวน้อยกว่า `total` ดึงหน้าถัดไปด้วย `offset` จนครบ แล้วส่ง `total` ไปกับ `save_kpi_data` ให้ GAS ปฏิเสธข้อมูลที่ไม่ครบ
- ส่งทั้งจังหวัด (`province`) ตามเดิม GAS กรอง `5406` เอง
- เว้นช่วง 4–7 วินาทีระหว่างคำขอ และ retry เมื่อได้ 429/5xx เหมือนเดิม

## 7. Sync units

| ชุด | ที่มา | ใช้ที่ |
|---|---|---|
| PA units | `CONFIG.KPIS` ∪ `source_sheet` ในแท็บ registry (เหมือนเดิม) | `BATCH_ALL` คำนวณเฉพาะชุดนี้ |
| DC units | `source_table` ที่ไม่ซ้ำของรายงานที่ใช้งาน (SCHEMA §2.3) | `?action=report` |
| Sync units = PA ∪ DC | `getSyncUnits()` | whitelist ของ `doPost`, `syncAllData` และ `meta.kpi_config` ทำให้หน้า `/sync` และ `sync-moph-to-gas.js` เห็นตาราง DC เอง |

Data Center ไม่ใช้ `BATCH_ALL` และ PA ไม่โหลดตาราง DC

## 8. GAS endpoints

สรุปเท่านั้น สัญญาเต็มอยู่ใน SCHEMA §3

| Method | เรียก | ผู้ใช้ | สถานะ |
|---|---|---|---|
| GET | `?action=catalog` | Data Center, `hdc-catalog.js` | ใหม่ |
| GET | `?action=report&id={opendata_id}` | หน้ารายงาน | ใหม่ |
| GET | `?sheet=BATCH_ALL` | PA, `/sync`, node | แก้: คำนวณจากแถว `b_year = current_year` เท่านั้น |
| GET | `?sheet=hospitals` ฯลฯ | PA | เดิม |
| GET | `?action=diag&pin=…` | ผู้ดูแล | เพิ่ม `setup=datacenter` และ `setup=dc_seed` |
| POST | `save_kpi_data` | `/sync`, node | แก้: รับ `year` และบันทึกแบบหลายปี |
| POST | `save_catalog` | `hdc-catalog.js` | ใหม่ |

- ไม่มีการยืนยันตัวตนฝั่ง server เหมือนเดิม (D5, §14)

- `?action=catalog` แคชใน `CacheService` 5 นาที และล้างเมื่อบันทึกข้อมูล บันทึกแค็ตตาล็อก หรือเรียก `clearConfigCache()` ดังนั้นการแก้ชีตเอง (เช่น ติ๊ก `enabled` หรือเพิ่มหัวข้อ) จะเห็นผลภายใน 5 นาที หรือทันทีหลังกดเมนู "Clear Config Cache"
- `?action=report` ตอบเฉพาะรายงานที่ `enabled = TRUE`

## 9. หน้าจอ

### 9.1 โครงหน้า

- Masthead และเมนูตาม R6: **หน้าแรก · คลังรายงาน · PA Dashboard** (ตัดเมนู "เกี่ยวกับต้นแบบ")
- Footer: แหล่งข้อมูล (HDC Open Data, ขอบเขต GIS) และวันที่ข้อมูลล่าสุด
- สี: นำ token ของ R6 (`--green #17695f` ฯลฯ) มาเป็น theme ของ Data Center ใน `globals.css` ส่วนฟอนต์ใช้ Prompt/Sarabun ที่มีอยู่
- ไม่มีคำว่า "ข้อมูลจำลอง" หรือ "ข้อมูลตัวอย่าง" อีก เพราะทุกตัวเลขมาจาก HDC
- รูปแบบการเข้าถึงตาม R6: จัดการ focus, ตารางเลื่อนแนวนอน, รายการแบบมือถือ
- กราฟวาดด้วย SVG แบบ R6 ไม่เพิ่มไลบรารีกราฟ

### 9.2 หน้าแรก `/`

| ส่วนใน R6 | เฟส 1 |
|---|---|
| หัวเรื่อง "ข้อมูลพื้นฐานอำเภอสอง" + ป้ายสถานะ | ป้ายแสดงวันที่ข้อมูลล่าสุด (`date_com` สูงสุด) แทน "ข้อมูลประชากรจำลอง" |
| สรุปประชากร 4 ช่อง | แสดงเฉพาะช่อง "เขตการปกครอง 8 ตำบล" ช่องประชากรรอเฟส 2 |
| แผนที่และเลือกตำบล | Leaflet + OpenStreetMap tiles + GeoJSON ไฟล์คงที่ (SCHEMA §7, D4) รายชื่อตำบลจาก `tambon_master` |
| แผงข้อมูลพื้นที่ที่เลือก | ชื่อตำบลและรายชื่อหน่วยบริการในตำบล (จาก `hospitals`) ช่องประชากรรอเฟส 2 |
| ตารางประชากรรายตำบล | ซ่อนไว้จนถึงเฟส 2 |
| เข้าสู่หมวดรายงาน | การ์ดละหนึ่งหัวข้อที่มีรายงานเปิดอยู่ แสดงชื่อหมวด ชื่อหัวข้อ และจำนวนรายงาน ลิงก์ไป `/reports?cat={cat_id}` |
| ที่มาของข้อมูล | HDC Open Data, แหล่ง GIS และวันที่ sync ล่าสุด |

### 9.3 คลังรายงาน `/reports`

- แถบซ้าย: หมวด → หัวข้อ (ซ้อนกัน) พร้อมจำนวนรายงาน แสดงเฉพาะหัวข้อที่มีรายงานเปิดอยู่
- ค้นหาจาก `report_name`, `source_table`, `opendata_id`, ชื่อหัวข้อ และชื่อกลุ่ม
- รายการจัดหัวแถวตาม หัวข้อ → กลุ่ม คอลัมน์: ชื่อรายงาน (+ `source_table`) · หัวข้อ/กลุ่ม · ข้อมูลล่าสุด (ปีล่าสุดที่มีข้อมูล หรือ "ยังไม่มีข้อมูล") · เปิดรายงาน
- แบ่งหน้า 10/20 รายการตาม R6 และเก็บสถานะตัวกรองใน URL
- รายงานที่ `catalog_status = removed` ยังแสดง พร้อมป้าย "HDC ไม่แสดงรายงานนี้แล้ว"

### 9.4 หน้ารายงาน `/reports/view?id=`

โครงตาม `detailView` ของ R6: breadcrumb (หมวด / หัวข้อ / กลุ่ม) · hero (ชื่อรายงาน, ป้าย `source_table`, หัวข้อ) · ฟอร์มตัวกรองพร้อมปุ่ม "แสดงผล" · ผลรายงาน · ดาวน์โหลด CSV / พิมพ์ · "เกี่ยวกับรายงานนี้" · รายงานที่เกี่ยวข้อง

รูปแบบเลือกตาม `report_type`:

- `coverage`: เฟส 1 ตามตารางด้านล่าง
- `workload`, ค่าว่าง หรือค่าอื่น: แสดงข้อความว่ายังไม่รองรับรูปแบบนี้ พร้อมลิงก์ไปหน้า HDC

**coverage**

| องค์ประกอบ | รายละเอียด |
|---|---|
| ตัวกรอง | ปีงบประมาณ (เฉพาะปีที่มีข้อมูล ค่าเริ่มต้นเป็นปีล่าสุด) · พื้นที่ (ทั้งอำเภอ / 8 ตำบล) · ช่วงเวลา (ทั้งปี / ไตรมาส 1–4 / เดือน ต.ค.–ก.ย. แสดงเฉพาะระดับที่ตารางมี) · รายการวัคซีน (เฉพาะตารางที่มีหลายรายการ เช่น `s_epi1`) · เปรียบเทียบตาม (ตำบล / หน่วยบริการ) |
| URL | `?id=&year=&area=&period=&measure=&by=` เพื่อให้แชร์ลิงก์ได้ |
| ตัวเลขสรุป | เป้าหมาย · ผลงาน · ร้อยละ · ผ่าน/ไม่ผ่านเกณฑ์ เมื่อมีเกณฑ์ (ผ่านเมื่อร้อยละ ≥ เกณฑ์ เหมือน PA) |
| กราฟ A | ร้อยละรายตำบลหรือรายหน่วยบริการ เป็นแท่งแนวนอนพร้อมเส้นเกณฑ์ (แบบ `screening`/`epi` ของ R6) |
| กราฟ B | แนวโน้มร้อยละรายปีในช่วง 5 ปีพร้อมเส้นเกณฑ์ (แบบ `ncd` ของ R6) ใช้พื้นที่ ช่วงเวลา และรายการเดียวกับตัวกรอง |
| กราฟ C | เป้าหมายเทียบผลงานรายไตรมาสหรือรายเดือนของปีที่เลือก เมื่อตารางมีข้อมูลระดับนั้น |
| ตาราง | หน่วยที่เปรียบเทียบ × เป้าหมาย/ผลงาน/ร้อยละ พร้อมแถวรวม |
| ร้อยละ | ทศนิยม 2 ตำแหน่งด้วย `formatPct` เดิม ถ้าเป้าหมายเป็น 0 แสดง "—" |
| ไม่มีข้อมูล | แสดง "ไม่มีข้อมูลปี … ในระบบ" ไม่แสดงเป็นศูนย์ |

**เกณฑ์:** ใช้ `hdc_reports.goal` ส่วนตารางที่มีหลายรายการวัคซีน ใช้เกณฑ์รายวัคซีนจาก `kpi_epi` (จับคู่ `source_sheet` + `value_prefix` แล้วเอาค่า `target`) ถ้ามี ถ้าไม่มีใช้ `goal` ของรายงาน

**CSV:** UTF-8 มี BOM และขึ้นบรรทัดด้วย CRLF
- บรรทัดหัว: ชื่อระบบ, ชื่อรายงานพร้อม `opendata_id`, ตัวกรองที่ใช้, แหล่งข้อมูลและวันที่ข้อมูล ตามด้วยตารางที่แสดงอยู่
- กันสูตร: ค่าที่ขึ้นต้นด้วย `=` `+` `-` `@` tab หรือ CR ให้เติม `'` นำหน้า (ตาม R6)
- ชื่อไฟล์: `SHDC-{source_table}-{opendata_id 8 ตัวแรก}-{year}.csv` (ตารางเดียวมีหลายรายงานได้ จึงต้องมีรหัสรายงาน)

**เกี่ยวกับรายงานนี้:** ตารางต้นทาง, `opendata_id`, ปีที่มีในระบบ, วันที่ข้อมูล (`date_com` สูงสุด), ลิงก์ HDC และ Open Data, วิธีคำนวณ (รวมทุกแถวที่ `areacode` ขึ้นต้นด้วย `5406` และร้อยละ = ผลงาน ÷ เป้าหมาย × 100) และข้อจำกัด (นิยามตาม HDC และนิยามอาจเปลี่ยนข้ามปี)

**รายงานที่เกี่ยวข้อง:** รายงานในกลุ่มเดียวกันก่อน แล้วจึงหัวข้อเดียวกัน สูงสุด 3 รายการ

### 9.5 โครงไฟล์ frontend (ใหม่)

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/dc-types.ts` | type ตาม SCHEMA §8 |
| `src/lib/dc-api.ts` | เรียก `?action=catalog` (cache แบบ stale-while-revalidate ใน localStorage คีย์ `SHDC_CATALOG_V1`) และ `?action=report` (cache ในหน่วยความจำ) |
| `src/lib/dc-values.ts` | ฟังก์ชันคำนวณล้วนตาม SCHEMA §4 |
| `src/components/dc/*` | masthead, แผนที่, ตัวกรอง, กราฟ SVG, ตาราง |

## 10. การคำนวณค่า coverage

สรุปเท่านั้น กติกาเต็มอยู่ใน SCHEMA §4

1. เลือกแถว: GAS ส่งมาเฉพาะแถวของอำเภอ ปีใน window และ `id = opendata_id` เมื่อตารางนั้นมีมากกว่าหนึ่งรายงานใน `hdc_reports` (SCHEMA §3.2) จากนั้น frontend เลือกตามปี (`b_year`), พื้นที่ (6 หลักแรกของ `areacode` คือรหัสตำบล) และหน่วยบริการ (`hospcode`)
2. หาเป้าหมายและผลงานต่อแถวตามช่วงเวลา
   - ทั้งปี: `col_target/col_result` (ถ้ากำหนด) → รายการวัคซีนที่เลือก → `target/result` → ผลรวมรายไตรมาส → ผลรวมรายเดือน
   - ไตรมาสหรือเดือน: จากกลุ่มคอลัมน์ที่ตรวจพบ
3. รวมเป้าหมายและผลงานของทุกแถว แล้วคิดร้อยละจากผลรวม ไม่เฉลี่ยร้อยละของแต่ละแถว
4. คำนวณใน frontend (`src/lib/dc-values.ts`) จากข้อมูลดิบที่ GAS ส่งมา เพราะข้อมูลหลังกรอง `5406` มีขนาดเล็ก และหน้ารายงานต้องสลับปี พื้นที่ ช่วงเวลา และวัคซีนได้โดยไม่เรียก GAS ซ้ำ PA ยังคำนวณใน GAS ตามเดิม

## 11. PA Dashboard: สิ่งที่ต้องคงเดิม

- หน้าตา พฤติกรรม และตัวเลขที่ `/pa` เหมือน `/` ในปัจจุบัน
- `BATCH_ALL` คงรูปแบบ response เดิม แต่คำนวณจากแถว `b_year = current_year` เท่านั้น (จำเป็นเพราะชีตเก็บหลายปี) ใช้กับ single-sheet mode ด้วย
- ไม่แก้ `kpi_registry`, `kpi_master`, `kpi_epi` และไม่เปลี่ยนคีย์ cache `PA_DASHBOARD_CACHE_V4`
- `TARGET_AREA_PREFIX` ของ PA คงเดิม การกรอง `5406` ฝั่ง GAS ไม่ทำให้ยอดของ PA เปลี่ยน เพราะ PA กรองแบบเดียวกันอยู่แล้ว

## 12. งานดูแลระบบ

### 12.1 หน้า `/sync`

- หน้า login ด้วย PIN (`NEXT_PUBLIC_SYNC_PIN_CODE`) คงเดิม
- เพิ่มตัวเลือกปี: ปีใน window ค่าเริ่มต้นเป็น `current_year` และส่ง `year` ไปกับ `save_kpi_data`
- รายการตารางมาจาก `meta.kpi_config` เหมือนเดิม ซึ่งตอนนี้รวมตาราง DC แล้ว
- ใช้กติกาการดึงใน §6.1

### 12.2 `src/scripts/sync-moph-to-gas.js`

- `--year 2567` (ใส่ซ้ำได้) · `--backfill` ดึงทุกปีใน window · `--only <table>` เดิม
- ถ้าไม่ระบุปี ใช้ `current_year` เหมือนเดิม
- ใช้กติกาการดึงใน §6.1

### 12.3 `src/scripts/hdc-catalog.js` (ใหม่)

| คำสั่ง | ทำอะไร |
|---|---|
| `find <table> [...]` | ไล่ทุกหัวข้อจาก `categories` แล้วพิมพ์ว่าตารางที่ระบุอยู่หัวข้อใด (`cat_id`, `category_name`, `opendata_id`, `report_name`) ไม่เขียนข้อมูลใด ๆ |
| `refresh` | ดึงรายงานของทุกหัวข้อใน `hdc_topics` แล้ว POST `save_catalog` ทีละหัวข้อ |
| `refresh --cat <cat_id>` | ทำเฉพาะหัวข้อเดียว |

- `refresh` อ่านรายการหัวข้อจาก `?action=catalog` ถ้าเพิ่งเพิ่มหัวข้อในชีต ให้กด "Clear Config Cache" ก่อน (§8)
- เว้นช่วง 1–2 วินาทีต่อคำขอ และ retry เมื่อได้ 429

### 12.4 GAS

- `syncAllData` (trigger รายวัน): ดึง `current_year` ตามกติกา §6.1
- `?action=diag&pin=…&setup=datacenter`: สร้าง `hdc_topics`, `hdc_reports`, `sync_status` พร้อม header และเพิ่มคอลัมน์ `district_code` ใน `settings` รันซ้ำได้โดยไม่เสียหาย
- `?action=diag&pin=…&setup=dc_seed`: ตั้งค่าคอลัมน์ผู้ดูแลตาม SCHEMA §6 โดยจับคู่ `opendata_id` และตอบรายการที่ยังไม่มีแถวว่า "ไม่พบ"
- `clearConfigCache()` (เมนู "Clear Config Cache") ล้างแคช catalog ด้วย

### 12.5 Cloudflare Pages

| เรื่อง | ค่า |
|---|---|
| โปรเจกต์ | ต่อกับ repo GitHub โดยตรง production branch = `main` |
| Build | preset "Next.js (Static HTML Export)" · build command `npm run build` · output `out` · env `NODE_VERSION=20` |
| ตัวแปร build | `NEXT_PUBLIC_GAS_SCRIPT_URL`, `NEXT_PUBLIC_SYNC_PIN_CODE` (ย้ายจาก GitHub secrets) |
| Preview deployments | ปิด (Preview branch control = None) เพราะ `develop` เป็นโค้ดคนละสถาปัตยกรรมที่ build แบบ static ไม่ผ่าน |
| โดเมน | เฟส 1 ใช้ `<project>.pages.dev` (D6) ชื่อโปรเจกต์กำหนดตอนสร้าง เมื่อมีโดเมนของ สสอ.สอง บน Cloudflare ค่อยเพิ่ม custom domain |

- `.github/workflows/ci.yml` คงไว้ (build check ของ PR) ส่วน `deploy.yml` เปลี่ยนไปทำ stub (§12.6)
- Cloudflare Pages เสิร์ฟ `/sync` จาก `sync.html` และ redirect `/sync.html` → `/sync` เอง การตรวจรับต้องลองทั้งสองแบบ

### 12.6 หน้า stub บน GitHub Pages

- โฟลเดอร์ `legacy-redirect/` มี `index.html` และ `404.html` (เนื้อหาเดียวกัน) ไม่มี build
- JavaScript ในหน้าแปลง URL เก่าเป็นใหม่แล้ว `location.replace`:
  - `/pa-dashboard/` หรือ `/pa-dashboard/index.html` (มีหรือไม่มี `?cat=`) → `<ORIGIN>/pa` + query เดิม เพราะ root เดิมคือ PA
  - `/pa-dashboard/sync` → `<ORIGIN>/sync`
  - อื่น ๆ → `<ORIGIN>/`
  - `<ORIGIN>` เป็นค่าคงที่ตัวเดียวในไฟล์ (`https://<project>.pages.dev` ในเฟส 1) แก้ที่เดียวเมื่อย้ายโดเมน
- มี `<meta http-equiv="refresh">` ไปที่ `<ORIGIN>/` และลิงก์ให้กดเอง สำหรับกรณีไม่มี JavaScript
- `deploy.yml` ตัดขั้น Node/npm/build ออก เหลือ checkout → upload `./legacy-redirect` → deploy และคง trigger `push` ที่ `main` กับ `workflow_dispatch`
- GitHub Pages คงไว้แบบนี้ถาวร ไม่มีค่าใช้จ่าย

## 13. ขั้นตอนเปิดใช้และการตรวจรับ

| # | ขั้นตอน | ตรวจรับ |
|---|---|---|
| 1 | Deploy GAS ใหม่ | `BATCH_ALL` ตอบเหมือนเดิม · `save_kpi_data` ที่ไม่มี `year` บันทึกเป็น `current_year` |
| 2 | `setup=datacenter` | มีชีตใหม่ 3 ชีต และ `district_code` ใน `settings` |
| 3 | `hdc-catalog.js find` กับ 18 ตาราง แล้วใส่ `cat_id` ที่ได้ใน `hdc_topics` | ทุกตารางพบหัวข้อ |
| 4 | `hdc-catalog.js refresh` | `hdc_reports` มีครบ 21 `opendata_id` ใน SCHEMA §6 |
| 5 | `setup=dc_seed` | 21 รายงานเป็น `enabled = TRUE` และไม่มีรายการ "ไม่พบ" |
| 6 | ทดสอบการดึง: `s_aged9` ด้วย `limit = 5000` และ `s_epi_complete` ด้วย `limit = 1000` | `s_aged9`: จำนวนแถวเท่ากับ `total` และเท่ากับตอนไม่ส่ง `limit` · `s_epi_complete`: แบ่งหน้าด้วย `offset` แล้วได้ครบ `total` และตรงกับการขอครั้งเดียวด้วย `limit = 5000` |
| 7 | `sync-moph-to-gas.js --backfill` | `sync_status` มีครบ 18 ตาราง × ทุกปีที่ HDC มีข้อมูล |
| 8 | sync ปีปัจจุบัน แล้วรัน `src/scripts/verify-all.js` ในวันเดียวกัน | ตัวเลขตรงกับ `/pa` |
| 9 | ตรวจ Data Center | ค่าทั้งปีระดับอำเภอของ KPI ที่ PA คิดแบบรายปีตรงกับ PA ถ้าไม่ตรง ให้ตรวจแถวที่ `result` ว่าง (PA มี fallback ไปใช้ผลรวมรายไตรมาส) และเทียบรายงานอื่น 1–2 รายงานกับหน้า HDC ระดับอำเภอ |
| 10 | สร้างโปรเจกต์ Cloudflare Pages | `https://<project>.pages.dev/` เป็น Data Center, `/pa` เป็น PA, `/pa?cat=…` เปิดแท็บถูก, `/reports/view?id=…` เปิดได้โดยตรง (ไม่ใช่ 404) |
| 11 | Deploy stub บน GitHub Pages | `…/pa-dashboard/?cat=X` ไปที่ `https://<project>.pages.dev/pa?cat=X` และ `…/pa-dashboard/sync` ไปที่ `/sync` |

**ลำดับสำคัญ:** ตัวกรอง `b_year` ของ `BATCH_ALL` ในขั้น 1 ต้องใช้งานได้ก่อนบันทึกปีที่สองในขั้น 7 ไม่อย่างนั้น PA จะรวมยอดหลายปี และขั้น 11 ต้องทำหลังขั้น 10 ผ่านแล้วเท่านั้น เมื่อย้ายไปโดเมนเองในอนาคต ต้องแก้ปลายทางของ stub (ขั้น 11) ด้วย

## 14. ความเสี่ยงและข้อสังเกต

| เรื่อง | ผลกระทบ | แนวทาง |
|---|---|---|
| `doPost` ไม่มีการยืนยันตัวตนฝั่ง server (PIN ของ `/sync` ตรวจฝั่ง client และ `DIAG_PIN` อยู่ใน repo สาธารณะ) | ใครมี URL ของ GAS ก็เขียนทับชีตข้อมูลได้ | **ยอมรับ (D5)** เพราะ (1) เป็นสถานะเดิมของระบบอยู่แล้ว (2) ทุกตารางดึงจาก MOPH ใหม่ได้ทันที และ trigger รายวันเขียนปีปัจจุบันทับกลับเอง (3) ไม่มีข้อมูลส่วนบุคคลในชีต · ถ้าพบการเขียนทับ ให้รัน `sync-moph-to-gas.js --backfill` |
| URL ของ GAS Web App เป็นสาธารณะ (อยู่ใน bundle) | อ่านข้อมูลได้ทุกคน | ยอมรับ เพราะเป็นข้อมูลสาธารณะระดับหน่วยบริการอยู่แล้ว GET ไม่เปิดชีตภายใน (whitelist เดิม) |
| MOPH จำกัดความถี่และมี WAF | backfill ใช้เวลานาน และอาจโดน 429 | เว้นช่วงตาม §6.1 และทำ backfill ทีละปีได้ |
| นิยามรายงานของ HDC เปลี่ยนข้ามปี | แนวโน้ม 5 ปีอาจเทียบคนละนิยาม | แจ้งไว้ใน "เกี่ยวกับรายงานนี้" |
| แค็ตตาล็อกมีรายการซ้ำและรายการขยะ (เช่น "dasf") | ปนในคลังรายงาน | กรองซ้ำ และใช้ opt-in |
| ช่องว่างกับเลข 0 แยกกันไม่ได้ (การบันทึกเดิมเก็บ 0 เป็นค่าว่าง) | "ไม่มีข้อมูล" กับ "ศูนย์" ในระดับแถวดูเหมือนกัน | ยอมรับในเฟส 1 การไม่มีข้อมูลตัดสินที่ระดับ (ตาราง, ปี) จาก `sync_status` |

## 15. ข้อตัดสินใจ

| # | เรื่อง | ข้อสรุป (29 ต.ค. 2569) |
|---|---|---|
| D1 | Hosting และ URL | Cloudflare Pages ไม่มี `basePath` Data Center ที่ `/` (§12.5) |
| D2 | path ของ PA | `/pa` |
| D3 | ลิงก์ PA เดิมที่แชร์ไว้ | หน้า stub บน GitHub Pages ส่งต่อไปโดเมนใหม่ (§12.6) ไม่มี redirect ในแอป |
| D4 | ขอบเขตตำบลบนแผนที่ | ดาวน์โหลดจาก MOPH GIS ครั้งเดียว เก็บเป็น `public/geo/song-tambon.geojson` (SCHEMA §7) ไม่ดึงสดแบบ R6 |
| D5 | ความปลอดภัยของ endpoint ที่เขียนข้อมูล | ไม่ทำในเฟส 1 (ตกลง 29 ต.ค. 2569) ยอมรับความเสี่ยงตาม §14 |
| D6 | โดเมน | เฟส 1 ใช้ `<project>.pages.dev` (ตกลง 29 ต.ค. 2569) ย้ายไปโดเมนเองได้ภายหลังโดยแก้ `<ORIGIN>` ใน stub ที่เดียว |
