# SPEC — Song Health Data Center

> สถานะ: ร่าง v0.4 · 29 ต.ค. 2569 · ขอบเขต: เฟส 1 · ข้อตัดสินใจทั้งหมดอยู่ใน §15
> เอกสารคู่กัน: [SCHEMA.md](SCHEMA.md) (โครงชีต, สัญญา API, ไฟล์ snapshot, กติกาคำนวณ, seed) และ [FEATURES.md](FEATURES.md) (รายการงาน)
> ต้นแบบหน้าจอ: `docs/reference/song-health-data-center-review-03-epi-real-response-r6.html` (R6) ใช้เป็นแบบหน้าตาและการใช้งานเท่านั้น ตัวเลขทุกตัวในไฟล์เป็นข้อมูลจำลอง

---

## 1. เป้าหมาย

1. หน้าหลักของ repo `pa-dashboard` เปลี่ยนเป็น **Song Health Data Center** ศูนย์ข้อมูลสุขภาพของ สสอ.สอง ตามแนวต้นแบบ R6
2. PA Dashboard ย้ายไปที่ `/pa` และทำงานเหมือนเดิมทุกอย่าง ทั้งฝั่งเว็บและฝั่ง GAS
3. จัดรายงานตามแค็ตตาล็อกของ HDC Open Data เป็น **หมวด → หัวข้อ → กลุ่ม → รายงาน** และเลือกเฉพาะหัวข้อและรายงานที่ต้องการ (opt-in)
4. เก็บข้อมูลย้อนหลัง 5 ปีงบประมาณ เฉพาะพื้นที่อำเภอสอง (`5406`)
5. ย้าย hosting ไป Cloudflare Pages โดยคง stack เดิม (Next.js static export + GAS + Google Sheets) และให้เว็บสาธารณะอ่านไฟล์ JSON ที่สร้างตอน build แทนการเรียก GAS สด

## 2. ขอบเขต

### 2.1 เฟส 1

- ย้าย route: PA ไป `/pa` และ Data Center อยู่ที่ `/`
- Snapshot: prebuild script ดึงข้อมูลจาก GAS เป็นไฟล์ใน `public/data/` ตอน build และ GAS สั่ง rebuild ผ่าน Cloudflare Deploy Hook หลัง sync (§6)
- Hosting: Cloudflare Pages และหน้า stub ส่งต่อลิงก์เก่าบน GitHub Pages (§12.5–12.6)
- ชีตแค็ตตาล็อก `hdc_topics`, `hdc_reports` กับสคริปต์ค้นหาและรีเฟรชแค็ตตาล็อก
- เก็บข้อมูลหลายปี: ชีตปีปัจจุบันชื่อเดิม + ชีตปีย้อนหลังแยกปี และชีต `sync_status` (§7)
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
| ย้าย PA มาอ่าน snapshot แบบเดียวกับ Data Center | ได้ประโยชน์เดียวกัน แต่ผิดกฎไม่แตะ PA ทำเป็นงานแยกภายหลัง |
| ดึงข้อมูล MOPH ด้วย Cloudflare Pages Function แทนเบราว์เซอร์ | MOPH อาจบล็อก IP ของ datacenter (น่าจะเป็นเหตุเดียวกับที่ GAS ดึงเองไม่เสถียร) ต้องทดลองก่อน |

**ตัดออกจาก R6 ถาวร:** ส่วนนำเข้า JSON ของรายงานวัคซีน EPI-01 ได้แก่ textarea, ปุ่มอัปโหลดไฟล์, `epiImport`, แผงจับคู่รหัสกลุ่มอายุ และแถบสถานะ coverage ของไฟล์ที่นำเข้า ทุกรายงานรับข้อมูลจาก snapshot เท่านั้น

## 3. ภาพรวมระบบ

```
HDC Open Data (opendata.moph.go.th)
   │  report_data · แค็ตตาล็อก
   ▼
ตัวดึงข้อมูล: หน้า /sync (เบราว์เซอร์) · sync-moph-to-gas.js · hdc-catalog.js (node) · syncAllData (trigger ใน GAS)
   │  POST (Content-Type: text/plain)
   ▼
GAS Web App (src/scripts/*.js) ──► Google Sheets "PA-Data"
   │                      ▲
   │ POST rebuild         │ GET ?sheet=BATCH_ALL ฯลฯ (PA เรียกสดเหมือนเดิม)
   ▼                      │
Cloudflare Deploy Hook ──► Cloudflare Pages build
                             prebuild: build-snapshot.mjs → GET ?action=catalog / ?action=report → public/data/*.json
                             next build (static export) → CDN
   https://<project>.pages.dev
   /                     Data Center หน้าแรก       ← public/data/catalog.json
   /reports              คลังรายงาน              ← public/data/catalog.json
   /reports/{id}         หน้ารายงาน              ← public/data/reports/{id}.json
   /pa                   PA Dashboard (ย้ายมา)    ← GAS สด (เดิม)
   /sync                 Sync (เดิม + เลือกปี)     ← GAS สด (เดิม)

GitHub Pages (https://9gotstory.github.io/pa-dashboard/) → หน้า stub ส่งต่อไปโดเมนใหม่
```

หลักการ:

- **เว็บสาธารณะไม่เรียก GAS** หน้า Data Center อ่านไฟล์ใน `public/data/` ที่สร้างตอน build ทำให้เปิดได้ทันที ไม่ล้มตาม GAS และ GAS รับโหลดเฉพาะตอน build (ราว 1 + จำนวนรายงาน คำขอต่อ build) PA และ `/sync` ยังเรียก GAS สดเหมือนเดิม
- ข้อมูลบนเว็บสดเท่ากับ build ล่าสุด GAS สั่ง rebuild เองหลัง sync เสร็จ (ผ่าน Deploy Hook) จึงตามรอบ sync รายวัน
- ช่องทางหลักของการดึงข้อมูลยังเป็นฝั่ง client แล้วส่งเข้า GAS เหมือนเดิม เพราะ daily trigger ของ GAS ดึงจาก MOPH ได้ไม่เสถียร
- GAS เป็นจุดเดียวที่ whitelist ตาราง กรองพื้นที่ จัดการชีตหลายปี และสั่ง rebuild
- ข้อจำกัด GAS เดิมยังใช้: GET ส่งค่าทาง query string เท่านั้น ไม่มี custom header, POST ใช้ `Content-Type: text/plain`
- โค้ด GAS ของ Data Center อยู่ในไฟล์ใหม่ใต้ `src/scripts/` (clasp push ทุกไฟล์ใน rootDir ให้เอง) `รหัส.js` แก้เท่าที่จำเป็น (§12.4)

## 4. Routes

| Path | หน้า | ไฟล์ | ข้อมูล |
|---|---|---|---|
| `/` | Data Center หน้าแรก | `src/app/(dc)/page.tsx` | catalog.json ตอน build + GeoJSON |
| `/reports` | คลังรายงาน | `src/app/(dc)/reports/page.tsx` | catalog.json ตอน build · query: `main`, `cat`, `q`, `page` กรองฝั่ง client |
| `/reports/[id]` | หน้ารายงาน | `src/app/(dc)/reports/[id]/page.tsx` | `generateStaticParams` จาก catalog.json · เบราว์เซอร์โหลด `/data/reports/{id}.json` · query ตัวกรองใน §9.4 (ค่าที่ยอมรับ: SCHEMA §9 `ReportQuery`) |
| `/pa` | PA Dashboard | `src/app/pa/page.tsx` | ย้ายจาก `src/app/page.tsx` โดยไม่แก้เนื้อหา, ย้าย `src/app/loading.tsx` ไปเป็น `src/app/pa/loading.tsx`, ตั้ง metadata ใน `src/app/pa/layout.tsx` |
| `/sync` | Sync | `src/app/sync/page.tsx` | เพิ่มตัวเลือกปีและสั่ง rebuild (§12.1) |

- `/reports/[id]` เป็น route จริงได้ เพราะรายการรายงานรู้ตอน build (catalog.json) ตั้ง `dynamicParams = false` ให้ id ที่ไม่มีเป็น 404 รายงานที่เปิดใหม่ในชีตจะปรากฏหลัง rebuild
- หน้าที่อ่าน query ด้วย `useSearchParams` ต้องห่อด้วย `<Suspense>` ตามข้อกำหนดของ static export
- `/pa?cat=…` ใช้ได้เหมือนเดิม เพราะโค้ด PA อ่าน `window.location.pathname` อยู่แล้ว
- ไม่มี `basePath` อีก: ลบ `basePath` และ `isProd` ออกจาก `next.config.ts` ส่วน `output: 'export'` และ `images.unoptimized` คงไว้
- ลิงก์เก่าบน `github.io` จัดการที่หน้า stub (§12.6) ไม่มี redirect ในแอป
- หน้า Data Center ทั้งสามอยู่ใน route group `src/app/(dc)/` ซึ่งมี `layout.tsx` ของตัวเอง (masthead + footer) ส่วน `/pa` และ `/sync` อยู่นอก group จึงไม่มี masthead และไม่ถูกแตะ metadata ของ root layout เปลี่ยนเป็นของ Data Center

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
3. เฉพาะรายงานที่ `enabled = TRUE` และหัวข้อยังอยู่ใน `hdc_topics` จึง (ก) ถูกใส่ใน snapshot และแสดงบนเว็บ และ (ข) ถูก sync ข้อมูลดิบตาม `source_table` (นิยามเต็ม: "รายงานที่ใช้งาน" ใน SCHEMA §2.3)
4. หลังติ๊กเปิด/ปิดรายงานหรือแก้กลุ่ม ต้องสั่ง rebuild (§6.3) จึงจะเห็นบนเว็บ

### 5.3 การรีเฟรชแค็ตตาล็อก

- สั่งผ่าน `node src/scripts/hdc-catalog.js refresh` (§12.3) ซึ่ง POST `save_catalog` ทีละหัวข้อ
- จับคู่ด้วย `opendata_id` และกรองรายการซ้ำ (API ส่งซ้ำได้ เช่น หัวข้อวัคซีนมี 46 แถว แต่เป็น 34 รายงาน)
- อัปเดตเฉพาะคอลัมน์ที่มาจาก API **ไม่แตะคอลัมน์ที่ผู้ดูแลกรอก** (`enabled`, `subgroup`, `order`, `report_type`, `goal`, `col_target`, `col_result`)
- รายงานที่หายไปจาก API ตั้ง `catalog_status = removed` และไม่ลบแถว เพื่อให้ข้อมูลปีเก่ายังดูได้
- หนึ่ง `opendata_id` อยู่ได้หัวข้อเดียว คือหัวข้อแรกที่บันทึก (`refresh` ไล่หัวข้อตามลำดับแถวใน `hdc_topics` บนลงล่าง)
- อัลกอริทึมเต็ม: SCHEMA §3.4

### 5.4 การเรียงลำดับ

- หัวข้อ: `hdc_topics.order` แล้วตามชื่อหัวข้อ
- หมวด: `order` ที่น้อยที่สุดของหัวข้อในหมวด แล้วตามชื่อหมวด
- กลุ่ม: `order` ที่น้อยที่สุดของรายงานในกลุ่ม (กฎเดียวกับ `sortKpisByGroup` ของ PA) แต่เพิ่มว่ารายงานที่ไม่มีกลุ่มอยู่ท้ายหัวข้อเสมอ (PA จัดกลุ่มว่างเหมือนกลุ่มทั่วไป)
- รายงาน: `order` แล้วตาม `report_name`
- `order` ว่างถือเป็นลำดับท้ายสุด เทียบชื่อด้วย `localeCompare(…, "th")`
- การเรียงทำครั้งเดียวใน prebuild script และบันทึกลำดับไว้ใน catalog.json หน้าเว็บไม่ต้องเรียงซ้ำ

### 5.5 ลิงก์ไปต้นทาง

- HDC: `https://hdc.moph.go.th/pre/public/standard-report-detail/{opendata_id}?subcatalogId={cat_id}`
- Open Data: `https://opendata.moph.go.th/th/services/summary-table/{main_report_id}/{source_table}/{opendata_id}`

## 6. Snapshot และการ build

### 6.1 ไฟล์ snapshot

| ไฟล์ | เนื้อหา | ขนาดเป้าหมาย |
|---|---|---|
| `public/data/meta.json` | เวลาที่ build, window ปี, จำนวนรายงาน, วันที่ข้อมูลล่าสุดรวม | < 1 KB |
| `public/data/catalog.json` | หมวด/หัวข้อ/กลุ่ม/รายงาน เรียงแล้ว + `areas` + `hospitals` + ปีที่มีข้อมูลของแต่ละรายงาน | < 100 KB |
| `public/data/reports/{opendata_id}.json` | แถวดิบของอำเภอ แยกเป็น block ต่อปี (SCHEMA §7) | < 500 KB ต่อไฟล์ (ก่อน gzip) |

- โฟลเดอร์ `public/data/` อยู่ใน `.gitignore` ไม่ commit ข้อมูลลง git
- โครงสร้างเต็ม: SCHEMA §7

### 6.2 prebuild script (`src/scripts/build-snapshot.mjs`)

- รันอัตโนมัติผ่าน npm lifecycle `prebuild` ก่อน `next build` และสั่งเองได้ด้วย `npm run snapshot` (สำหรับ dev)
- ขั้นตอน: GET `?action=catalog` → สำหรับรายงานที่ใช้งานทุกตัว GET `?action=report&id=` → เขียนไฟล์ → พิมพ์สรุป (จำนวนรายงาน, ขนาดไฟล์ใหญ่สุด, เวลา)
- เรียก GAS ทีละ 3 คำขอพร้อมกัน retry 3 ครั้งต่อคำขอ (รอ 2, 4, 8 วินาที)
- **ล้มดัง ๆ:** ถ้า catalog ดึงไม่ได้, รายงานใดดึงไม่ได้หลัง retry, มีรายงานที่ใช้งาน 0 ตัว, หรือไฟล์ใดเกินขนาดเป้าหมาย 2 เท่า → exit 1 → build ล้ม → Cloudflare คง deployment ก่อนหน้าไว้ เว็บไม่เปลี่ยน
- ไม่ใช้ข้อมูลเก่าหรือข้อมูลบางส่วนแทนที่ของจริงเด็ดขาด
- อ่าน URL ของ GAS จาก env `NEXT_PUBLIC_GAS_SCRIPT_URL` (ถ้าไม่มี ใช้ URL เดียวกับ `src/lib/useKPIData.ts`)

### 6.3 การสั่ง rebuild

- Cloudflare Pages → Deploy Hook หนึ่งตัว URL เก็บในชีต `settings` คอลัมน์ `deploy_hook_url` (ว่าง = ปิดการ rebuild อัตโนมัติ)
- GAS มี POST `rebuild` (SCHEMA §3.7): เรียก hook แล้วตอบผล จำกัด **5 ครั้งต่อวัน** นับใน `PropertiesService` ต่อวัน เกินแล้วตอบ error โดยไม่เรียก hook เพราะไม่มีการยืนยันตัวตน (D5) การจำกัดนี้กันไม่ให้ใครยิงจนโควตา build ของ Cloudflare (500 ครั้ง/เดือน) หมด ผลร้ายสุดคือ deploy ไม่ได้ชั่วคราว ไม่ใช่ข้อมูลเสีย
- ใครเรียก `rebuild`: `syncAllData` ตอนจบถ้ามีตารางใดบันทึกสำเร็จ · `sync-moph-to-gas.js` ตอนจบ · หน้า `/sync` ตอนจบ · ผู้ดูแลเรียกเองหลังแก้ `hdc_reports` (เมนู "Rebuild Website" ในสเปรดชีต)
- push โค้ดไป `main` ก็ build ตามปกติของ Cloudflare (นับโควตาเดียวกัน)

## 7. ข้อมูลย้อนหลัง 5 ปี

| เรื่อง | กติกา |
|---|---|
| ช่วงปี (window) | `current_year − 4` ถึง `current_year` จากชีต `settings` เช่น ตอนนี้ 2565–2569 และเมื่อเปลี่ยนเป็น 2570 จะเป็น 2566–2570 |
| ชีตปีปัจจุบัน | ชื่อเดิม (`s_epi1` ฯลฯ) เก็บเฉพาะ `current_year` โครงเดิมทุกอย่าง PA และ `BATCH_ALL` จึงไม่ต้องแก้ |
| ชีตปีย้อนหลัง | หนึ่งชีตต่อ (ตาราง, ปี) ชื่อ `{table}_y{YYYY}` เช่น `s_epi1_y2568` header ของใครของมัน (คอลัมน์ต่างปีได้ ไม่ต้องรวม header) |
| พื้นที่ | ทุกชีตเก็บเฉพาะแถวที่ `areacode` ขึ้นต้นด้วย `settings.district_code` (`5406`) GAS กรองตอนบันทึก ชีตปีปัจจุบันจึงเล็กลงราว 8 เท่าจากเดิม และ `BATCH_ALL` เร็วขึ้น (PA กรอง `5406` เองอยู่แล้ว ตัวเลขไม่เปลี่ยน) |
| การบันทึก | แทนที่ทั้งชีตของ (ตาราง, ปี) นั้น ปีอื่นไม่ถูกแตะ |
| เปลี่ยนปีงบอัตโนมัติ | ก่อนเขียนปี Y ทับชีตปีปัจจุบัน ถ้าชีตมีแถวของปี Z ≠ Y อยู่ (เพราะเพิ่งเปลี่ยน `current_year`) GAS ย้ายแถวปี Z ไปชีต `_y{Z}` ก่อน (แทนที่ชีตนั้น) จึงไม่มีข้อมูลหาย และไม่ต้องสั่งอะไรเอง |
| ข้อมูลเก่ากว่า | ถ้า `date_com` สูงสุดของข้อมูลที่ส่งมา น้อยกว่าที่มีอยู่ของ (ตาราง, ปี) เดียวกัน GAS ปฏิเสธ (`Stale data`) ยกเว้นส่ง `force: true` กันการเขียนทับด้วยไฟล์เก่า |
| สถานะ | ชีต `sync_status` หนึ่งแถวต่อ (ตาราง, ปี): จำนวนแถว, `date_com` ล่าสุด, เวลาที่บันทึก |
| ปีนอก window | ไม่อ่านและไม่บันทึก ชีต `_y` เก่าไม่ถูกลบอัตโนมัติ ลบเองเมื่อต้องการ |
| sync ประจำ | เฉพาะ `current_year` เหมือนปัจจุบัน |
| ปีย้อนหลัง | ดึงครั้งเดียว (backfill) และสั่งดึงซ้ำเองเป็นรายปีเมื่อต้องการ |
| เปลี่ยนปีงบ | แก้ `settings.current_year` แล้ว PA กับ Data Center ขยับพร้อมกัน ก่อนเปลี่ยนควรดึงปีเดิมซ้ำอีกรอบ เพราะ HDC อาจยังปรับข้อมูลปีที่แล้ว และ sync ประจำจะไม่ดึงปีนั้นอีก |

### 7.1 การดึงจาก `report_data`

- ส่ง `limit = 5000` ทุกคำขอ (ถ้า unit กำหนด `limit` มากกว่านี้ ใช้ค่าของ unit) ตารางที่ใหญ่ที่สุดตอนนี้ (`s_epi_complete`) มีราว 2,450 แถวทั้งจังหวัด จึงพอในหน้าเดียว
- ส่ง `total` จาก response ไปกับ `save_kpi_data` ให้ GAS ปฏิเสธเมื่อได้แถวน้อยกว่า `total` (ข้อมูลถูกตัด) ยังไม่ทำการแบ่งหน้าด้วย `offset` ในเฟส 1 ถ้าวันหนึ่งมีตารางเกิน 5,000 แถว การปฏิเสธนี้จะบอกเอง
- ส่งทั้งจังหวัด (`province`) ตามเดิม GAS กรอง `5406` เอง
- เว้นช่วง 4–7 วินาทีระหว่างคำขอ และ retry เมื่อได้ 429/5xx (สคริปต์ node และ GAS ทำอยู่แล้ว ส่วนหน้า `/sync` ตอนนี้ retry เฉพาะ network error ต้องเพิ่มใน F11)

## 8. Sync units และ GAS endpoints

| ชุด | ที่มา | ใช้ที่ |
|---|---|---|
| PA units | `CONFIG.KPIS` ∪ `source_sheet` ในแท็บ registry (เหมือนเดิม) | `BATCH_ALL` คำนวณเฉพาะชุดนี้ |
| DC units | `source_table` ที่ไม่ซ้ำของรายงานที่ใช้งาน (SCHEMA §2.3) | `?action=report` |
| Sync units = PA ∪ DC | `getSyncUnits()` | whitelist ของ `doPost`, `syncAllData` และ `meta.kpi_config` ทำให้หน้า `/sync` และ `sync-moph-to-gas.js` เห็นตาราง DC เอง |

สรุปเท่านั้น สัญญาเต็มอยู่ใน SCHEMA §3

| Method | เรียก | ผู้ใช้ | สถานะ |
|---|---|---|---|
| GET | `?action=catalog` | prebuild script, `hdc-catalog.js` | ใหม่ |
| GET | `?action=report&id={opendata_id}` | prebuild script | ใหม่ |
| GET | `?sheet=BATCH_ALL` | PA, `/sync`, node | แก้เล็กน้อย: เพิ่ม `meta.years` และรายการ DC ใน `meta.kpi_config` การคำนวณไม่แก้ |
| GET | `?sheet=hospitals` ฯลฯ | PA | เดิม |
| GET | `?action=diag&pin=…` | ผู้ดูแล | เพิ่ม `setup=datacenter` และ `setup=dc_seed` |
| POST | `save_kpi_data` | `/sync`, node, `syncAllData` | แก้: รับ `year`, `total`, `force` และบันทึกลงชีตตามปี |
| POST | `save_catalog` | `hdc-catalog.js` | ใหม่ |
| POST | `rebuild` | `/sync`, node, `syncAllData`, ผู้ดูแล | ใหม่ |

- ไม่มีการยืนยันตัวตนฝั่ง server เหมือนเดิม (D5, §14)
- เว็บสาธารณะไม่เรียก endpoint ใดเลย จึงไม่ต้องมีแคชใน GAS

## 9. หน้าจอ

### 9.1 โครงหน้า

- Masthead และเมนูตาม R6: **หน้าแรก · คลังรายงาน · PA Dashboard** (ตัดเมนู "เกี่ยวกับต้นแบบ")
- Footer: แหล่งข้อมูล (HDC Open Data, ขอบเขต GIS), เวลาที่ build (`meta.json`) และวันที่ข้อมูลล่าสุด
- สี: นำ token ของ R6 (`--green #17695f` ฯลฯ) มาเป็น theme ของ Data Center ใน `globals.css` ส่วนฟอนต์ใช้ Prompt/Sarabun ที่มีอยู่
- ไม่มีคำว่า "ข้อมูลจำลอง" หรือ "ข้อมูลตัวอย่าง" อีก เพราะทุกตัวเลขมาจาก HDC
- รูปแบบการเข้าถึงตาม R6: จัดการ focus, ตารางเลื่อนแนวนอน, รายการแบบมือถือ
- กราฟวาดด้วย SVG แบบ R6 ไม่เพิ่มไลบรารีกราฟ

### 9.2 หน้าแรก `/`

| ส่วนใน R6 | เฟส 1 |
|---|---|
| หัวเรื่อง "ข้อมูลพื้นฐานอำเภอสอง" + ป้ายสถานะ | ป้ายแสดงวันที่ข้อมูลล่าสุด (จาก `meta.json`) แทน "ข้อมูลประชากรจำลอง" |
| สรุปประชากร 4 ช่อง | แสดงเฉพาะช่อง "เขตการปกครอง 8 ตำบล" ช่องประชากรรอเฟส 2 |
| แผนที่และเลือกตำบล | Leaflet + OpenStreetMap tiles + GeoJSON ไฟล์คงที่ (SCHEMA §8, D4) รายชื่อตำบลจาก `catalog.json.areas` |
| แผงข้อมูลพื้นที่ที่เลือก | ชื่อตำบลและรายชื่อหน่วยบริการในตำบล (จาก `catalog.json.hospitals`) ช่องประชากรรอเฟส 2 |
| ตารางประชากรรายตำบล | ซ่อนไว้จนถึงเฟส 2 |
| เข้าสู่หมวดรายงาน | การ์ดละหนึ่งหัวข้อที่มีรายงานเปิดอยู่ แสดงชื่อหมวด ชื่อหัวข้อ และจำนวนรายงาน ลิงก์ไป `/reports?cat={cat_id}` |
| ที่มาของข้อมูล | HDC Open Data, แหล่ง GIS และเวลาที่ build |

### 9.3 คลังรายงาน `/reports`

- แถบซ้าย: หมวด → หัวข้อ (ซ้อนกัน) พร้อมจำนวนรายงาน แสดงเฉพาะหัวข้อที่มีรายงานเปิดอยู่
- ค้นหาจาก `report_name`, `source_table`, `opendata_id`, ชื่อหัวข้อ และชื่อกลุ่ม โดยค้นภายในหมวด/หัวข้อที่เลือกอยู่ (`q` AND `main`/`cat`)
- รายการจัดหัวแถวตาม หัวข้อ → กลุ่ม คอลัมน์: ชื่อรายงาน (+ `source_table`) · หัวข้อ/กลุ่ม · ข้อมูลล่าสุด (ปีล่าสุดที่มีข้อมูล หรือ "ยังไม่มีข้อมูล") · เปิดรายงาน
- แบ่งหน้า 10/20 รายการตาม R6 และเก็บสถานะตัวกรองใน URL
- รายงานที่ `catalog_status = removed` ยังแสดง พร้อมป้าย "HDC ไม่แสดงรายงานนี้แล้ว"

### 9.4 หน้ารายงาน `/reports/{id}`

โครงตาม `detailView` ของ R6: breadcrumb (หมวด / หัวข้อ / กลุ่ม) · hero (ชื่อรายงาน, ป้าย `source_table`, หัวข้อ) · ฟอร์มตัวกรองพร้อมปุ่ม "แสดงผล" · ผลรายงาน · ดาวน์โหลด CSV / พิมพ์ · "เกี่ยวกับรายงานนี้" · รายงานที่เกี่ยวข้อง

โครงหน้า (breadcrumb, hero, "เกี่ยวกับรายงานนี้", รายงานที่เกี่ยวข้อง) pre-render ตอน build จาก catalog.json ส่วนตัวเลขโหลด `/data/reports/{id}.json` ฝั่ง client แล้วคำนวณตามตัวกรอง

รูปแบบเลือกตาม `report_type`:

- `coverage`: เฟส 1 ตามตารางด้านล่าง
- `workload`, ค่าว่าง หรือค่าอื่น: แสดงข้อความว่ายังไม่รองรับรูปแบบนี้ พร้อมลิงก์ไปหน้า HDC

**coverage**

| องค์ประกอบ | รายละเอียด |
|---|---|
| ตัวกรอง | ปีงบประมาณ (เฉพาะปีที่มีข้อมูล ค่าเริ่มต้นเป็นปีล่าสุด) · พื้นที่ (ทั้งอำเภอ / 8 ตำบล) · ช่วงเวลา (ทั้งปี / ไตรมาส 1–4 / เดือน ต.ค.–ก.ย. แสดงเฉพาะระดับที่ตารางมี) · รายการวัคซีน (เฉพาะตารางที่มีหลายรายการ เช่น `s_epi1`) · เปรียบเทียบตาม (ตำบล / หน่วยบริการ — เมื่อเลือกตำบลเดียว เปรียบเทียบได้เฉพาะรายหน่วยบริการ โดยกรองแถวด้วย `areacode` ของตำบลก่อนแล้วจัดกลุ่มตาม `hospcode` ส่วน `hospitals.tambon_id` ใช้แสดงชื่อเท่านั้น) |
| URL | `?year=&area=&period=&measure=&by=` เพื่อให้แชร์ลิงก์ได้ |
| ตัวเลขสรุป | เป้าหมาย · ผลงาน · ร้อยละ · ผ่าน/ไม่ผ่านเกณฑ์ เมื่อมีเกณฑ์ (ผ่านเมื่อร้อยละ ≥ เกณฑ์ เหมือน PA) |
| กราฟ A | ร้อยละรายตำบลหรือรายหน่วยบริการ เป็นแท่งแนวนอนพร้อมเส้นเกณฑ์ (แบบ `screening`/`epi` ของ R6) |
| กราฟ B | แนวโน้มร้อยละรายปีในช่วง 5 ปีพร้อมเส้นเกณฑ์ (แบบ `ncd` ของ R6) ใช้พื้นที่ ช่วงเวลา และรายการเดียวกับตัวกรอง |
| กราฟ C | เป้าหมายเทียบผลงานรายไตรมาสหรือรายเดือนของปีที่เลือก เมื่อตารางมีข้อมูลระดับนั้น |
| ตาราง | หน่วยที่เปรียบเทียบ × เป้าหมาย/ผลงาน/ร้อยละ พร้อมแถวรวม |
| ร้อยละ | ทศนิยม 2 ตำแหน่งด้วย `formatPct` เดิม ถ้าเป้าหมายเป็น 0 แสดง "—" |
| ไม่มีข้อมูล | แสดง "ไม่มีข้อมูลปี … ในระบบ" ไม่แสดงเป็นศูนย์ (เกิดได้เมื่อเปิดด้วย URL `?year=` ที่ไม่มีข้อมูล เพราะตัวเลือกปีในฟอร์มมีแต่ปีที่มีข้อมูล) |

**เกณฑ์:** ใช้ `hdc_reports.goal` ส่วนตารางที่มีหลายรายการวัคซีน ใช้เกณฑ์รายวัคซีนจาก `kpi_epi` (จับคู่ `source_sheet` + `value_prefix` แล้วเอาค่า `target`) ถ้ามี ถ้าไม่มีใช้ `goal` ของรายงาน

**CSV:** UTF-8 มี BOM และขึ้นบรรทัดด้วย CRLF
- บรรทัดหัว: ชื่อระบบ, ชื่อรายงานพร้อม `opendata_id`, ตัวกรองที่ใช้, แหล่งข้อมูลและวันที่ข้อมูล ตามด้วยตารางที่แสดงอยู่
- กันสูตร: ค่าที่ขึ้นต้นด้วย `=` `+` `-` `@` tab หรือ CR ให้เติม `'` นำหน้า (ตาม R6)
- ชื่อไฟล์: `SHDC-{source_table}-{opendata_id 8 ตัวแรก}-{year}.csv` (ตารางเดียวมีหลายรายงานได้ จึงต้องมีรหัสรายงาน)

**เกี่ยวกับรายงานนี้:** ตารางต้นทาง, `opendata_id`, ปีที่มีในระบบ, วันที่ข้อมูล (`date_com` สูงสุด), ลิงก์ HDC และ Open Data, วิธีคำนวณ (รวมทุกแถวที่ `areacode` ขึ้นต้นด้วย `5406` และร้อยละ = ผลงาน ÷ เป้าหมาย × 100) และข้อจำกัด (นิยามตาม HDC, นิยามอาจเปลี่ยนข้ามปี, และความต่างจาก PA ใน SCHEMA §4.3 ถ้ามี)

**รายงานที่เกี่ยวข้อง:** รายงานในกลุ่มเดียวกันก่อน แล้วจึงหัวข้อเดียวกัน สูงสุด 3 รายการ

### 9.5 โครงไฟล์ frontend (ใหม่)

| ไฟล์ | หน้าที่ | รันที่ |
|---|---|---|
| `src/lib/dc/types.ts` | type ตาม SCHEMA §9 | ทั้งสองฝั่ง |
| `src/lib/dc/snapshot.ts` | อ่าน `public/data/*.json` ด้วย `fs` สำหรับ server component และ `generateStaticParams` | build |
| `src/lib/dc/client.ts` | `fetch('/data/reports/{id}.json')` + cache ในหน่วยความจำของหน้า | เบราว์เซอร์ |
| `src/lib/dc/values.ts` | ฟังก์ชันคำนวณล้วนตาม SCHEMA §4 (ไม่ import React, ไม่แตะ DOM) | เบราว์เซอร์ + เทสต์ |
| `src/lib/dc/values.test.ts` | เทสต์ด้วย `node:test` ผ่าน `tsx` | เทสต์ |
| `src/components/dc/*` | masthead, footer, แผนที่ (dynamic import), ตัวกรอง, กราฟ SVG, ตาราง | เบราว์เซอร์ |
| `src/scripts/build-snapshot.mjs` | prebuild script (§6.2) ไม่ import จาก `src/lib` เพื่อให้รันด้วย node ตรง ๆ ได้ | build |

### 9.6 งบประมาณประสิทธิภาพ (วัดตอนตรวจรับ)

| ตัวชี้วัด | เป้าหมาย |
|---|---|
| หน้าแรก LCP บนมือถือ 4G (Lighthouse mobile) | < 2.5 วินาที |
| JavaScript ของหน้าแรกและคลังรายงาน (gzip) | < 150 KB ไม่รวม Leaflet ซึ่งโหลดทีหลังแบบ dynamic import เฉพาะหน้าแรก |
| `catalog.json` | < 100 KB |
| `reports/{id}.json` | < 500 KB ก่อน gzip |
| เวลาคำนวณหน้ารายงานหลังโหลด JSON (เปลี่ยนตัวกรอง) | < 100 ms บนมือถือระดับกลาง (คำนวณใน memo ไม่เรียกเครือข่ายซ้ำ) |
| เวลา build บน Cloudflare | < 5 นาที (prebuild ราว 1–2 นาที) |

## 10. การคำนวณค่า coverage

สรุปเท่านั้น กติกาเต็มอยู่ใน SCHEMA §4

1. เลือกแถว: snapshot มีเฉพาะแถวของอำเภอ แยก block ต่อปี และกรอง `id = opendata_id` แล้วเมื่อชีตมีคอลัมน์ `id` (SCHEMA §3.2) frontend เลือก block ตามปี แล้วเลือกแถวตามพื้นที่ (6 หลักแรกของ `areacode` คือรหัสตำบล) และหน่วยบริการ (`hospcode`)
2. หาเป้าหมายและผลงานต่อแถวตามช่วงเวลา จาก header ของ block ปีนั้น
   - ทั้งปี: `col_target/col_result` (ถ้ากำหนด) → รายการวัคซีนที่เลือก → `target/result` → ผลรวมรายไตรมาส → ผลรวมรายเดือน
   - ไตรมาสหรือเดือน: จากกลุ่มคอลัมน์ที่ตรวจพบ
3. รวมเป้าหมายและผลงานของทุกแถว แล้วคิดร้อยละจากผลรวม ไม่เฉลี่ยร้อยละของแต่ละแถว
4. คำนวณในเบราว์เซอร์ (`src/lib/dc/values.ts`) เพราะข้อมูลหลังกรอง `5406` มีขนาดเล็ก และหน้ารายงานต้องสลับปี พื้นที่ ช่วงเวลา และวัคซีนได้ทันที PA ยังคำนวณใน GAS ตามเดิม

## 11. PA Dashboard: สิ่งที่ต้องคงเดิม

- หน้าตา พฤติกรรม และตัวเลขที่ `/pa` เหมือน `/` ในปัจจุบัน
- `BATCH_ALL` คงรูปแบบและการคำนวณเดิม เพิ่มแค่ `meta.years` และรายการ DC ใน `meta.kpi_config` (PA ไม่อ่านสองอย่างนี้)
- ชีตปีปัจจุบันชื่อเดิม โครงเดิม ต่างแค่เหลือเฉพาะแถวของอำเภอ ซึ่ง PA กรองเองอยู่แล้ว
- ไม่แก้ `kpi_registry`, `kpi_master`, `kpi_epi` และไม่เปลี่ยนคีย์ cache `PA_DASHBOARD_CACHE_V4`
- ไม่แก้ไฟล์ PA เดิมใต้ `src/components/` และ `src/lib/` (ยกเว้นย้ายไฟล์ตาม §4)

## 12. งานดูแลระบบ

### 12.1 หน้า `/sync`

- หน้า login ด้วย PIN (`NEXT_PUBLIC_SYNC_PIN_CODE`) คงเดิม
- เพิ่มตัวเลือกปีจาก `meta.years`: ค่าเริ่มต้นเป็น `current_year` และส่ง `year`, `total` ไปกับ `save_kpi_data`
- รายการตารางมาจาก `meta.kpi_config` เหมือนเดิม ซึ่งตอนนี้รวมตาราง DC แล้ว
- ใช้กติกาการดึงใน §7.1 (รวม retry 429/5xx)
- ตอนจบ ถ้ามีตารางใดสำเร็จ POST `rebuild` หนึ่งครั้ง และแสดงผล (สั่งแล้ว / ครบโควตาวันนี้ / ไม่ได้ตั้ง hook)

### 12.2 `src/scripts/sync-moph-to-gas.js`

- `--year 2567` (ใส่ซ้ำได้) · `--backfill` ดึงทุกปีใน window · `--only <table>` เดิม · `--force` ข้ามการตรวจข้อมูลเก่ากว่า · `--no-rebuild`
- ถ้าไม่ระบุปี ใช้ `current_year` เหมือนเดิม
- ใช้กติกาการดึงใน §7.1 และ POST `rebuild` หนึ่งครั้งตอนจบ

### 12.3 `src/scripts/hdc-catalog.js` (ใหม่)

| คำสั่ง | ทำอะไร |
|---|---|
| `find <table> [...]` | ไล่ทุกหัวข้อจาก `categories` แล้วพิมพ์ว่าตารางที่ระบุอยู่หัวข้อใด (`cat_id`, `category_name`, `opendata_id`, `report_name`) ไม่เขียนข้อมูลใด ๆ |
| `refresh` | ดึงรายงานของทุกหัวข้อใน `hdc_topics` แล้ว POST `save_catalog` ทีละหัวข้อ |
| `refresh --cat <cat_id>` | ทำเฉพาะหัวข้อเดียว |

- `refresh` อ่านรายการหัวข้อจาก `?action=catalog`
- เว้นช่วง 1–2 วินาทีต่อคำขอ และ retry เมื่อได้ 429
- ไม่สั่ง rebuild เอง เพราะหลัง refresh ผู้ดูแลต้องไปติ๊กเปิดรายงานก่อน ค่อยสั่ง rebuild

### 12.4 GAS

- ไฟล์ใหม่ใต้ `src/scripts/`: `dc-storage.js` (บันทึกหลายปี, sync_status, กรองอำเภอ), `dc-catalog.js` (hdc_topics/hdc_reports, save_catalog, catalog), `dc-report.js` (report), `dc-rebuild.js` (rebuild) ฟังก์ชันทั้งหมดอยู่ใน global scope เดียวกับ `รหัส.js` ตามธรรมชาติของ Apps Script
- `รหัส.js` แก้เฉพาะ: `SETTINGS_SCHEMA` (เพิ่ม `district_code`, `deploy_hook_url`), `doGet`/`doPost` เพิ่มทางแยกไป action ใหม่, `getSyncUnits` รวม DC units, `BATCH_ALL` เพิ่ม `meta.years`, `syncAllData` เรียกทางบันทึกใหม่และ rebuild ตอนจบ, `handleDiag` เพิ่ม setup ใหม่, เมนู `onOpen` เพิ่ม "Rebuild Website"
- `syncAllData` (trigger รายวัน): ดึง `current_year` ส่ง `limit = 5000` ทุกตาราง ปฏิเสธเมื่อได้แถวน้อยกว่า `total` คงช่วงเว้น 1.5–2.5 วินาทีของเดิม บันทึกผ่านทางเดียวกับ `save_kpi_data` (`year = current_year`) และ POST `rebuild` ตอนจบถ้ามีตารางใดสำเร็จ
- `?action=diag&pin=…&setup=datacenter`: สร้าง `hdc_topics`, `hdc_reports`, `sync_status` พร้อม header และเพิ่มคอลัมน์ `district_code`, `deploy_hook_url` ใน `settings` รันซ้ำได้โดยไม่เสียหาย
- `?action=diag&pin=…&setup=dc_seed`: ตั้งค่าคอลัมน์ผู้ดูแลตาม SCHEMA §6 โดยจับคู่ `opendata_id` และตอบรายการที่ยังไม่มีแถวว่า "ไม่พบ"
- ทดสอบ logic ของ GAS ก่อน deploy ด้วย harness ใน `src/scripts/test/` (โหลดไฟล์ GAS ใน `node:vm` พร้อม stub ของ `SpreadsheetApp` ฯลฯ) รันด้วย `node --test src/scripts/test/`

### 12.5 Cloudflare Pages

| เรื่อง | ค่า |
|---|---|
| โปรเจกต์ | ต่อกับ repo GitHub โดยตรง production branch = `main` |
| Build | preset "Next.js (Static HTML Export)" · build command `npm run build` (npm รัน `prebuild` ให้เอง) · output `out` · env `NODE_VERSION=20` |
| ตัวแปร build | `NEXT_PUBLIC_GAS_SCRIPT_URL`, `NEXT_PUBLIC_SYNC_PIN_CODE` (ย้ายจาก GitHub secrets) |
| Deploy Hook | สร้างหนึ่งตัว แล้ววาง URL ใน `settings.deploy_hook_url` (§6.3) |
| Preview deployments | ปิด (Preview branch control = None) เพราะ `develop` เป็นโค้ดคนละสถาปัตยกรรมที่ build แบบ static ไม่ผ่าน และกันไม่ให้ branch งานกิน build quota |
| โดเมน | เฟส 1 ใช้ `<project>.pages.dev` (D6) ชื่อโปรเจกต์กำหนดตอนสร้าง เมื่อมีโดเมนของ สสอ.สอง บน Cloudflare ค่อยเพิ่ม custom domain |

- `.github/workflows/ci.yml` คงไว้ (build check ของ PR) ต้องมี `NEXT_PUBLIC_GAS_SCRIPT_URL` ใน GitHub secrets เพราะ prebuild ต้องดึงข้อมูลจริง ส่วน `deploy.yml` เปลี่ยนไปทำ stub (§12.6)
- Cloudflare Pages เสิร์ฟ `/sync` จาก `sync.html` และ redirect `/sync.html` → `/sync` เอง การตรวจรับต้องลองทั้งสองแบบ
- build ล้ม (เช่น GAS ล่มตอน build) = เว็บคงเวอร์ชันก่อนหน้า ดูเหตุได้ใน build log ของ Cloudflare

### 12.6 หน้า stub บน GitHub Pages

- โฟลเดอร์ `legacy-redirect/` มี `index.html` และ `404.html` (เนื้อหาเดียวกัน) ไม่มี build
- JavaScript ในหน้าแปลง URL เก่าเป็นใหม่แล้ว `location.replace`:
  - `/pa-dashboard/` หรือ `/pa-dashboard/index.html` (มีหรือไม่มี `?cat=`) → `<ORIGIN>/pa` + query เดิม เพราะ root เดิมคือ PA
  - `/pa-dashboard/sync`, `/pa-dashboard/sync/`, `/pa-dashboard/sync.html` → `<ORIGIN>/sync`
  - อื่น ๆ → `<ORIGIN>/`
  - `<ORIGIN>` เป็นค่าคงที่ตัวเดียวในไฟล์ (`https://<project>.pages.dev` ในเฟส 1) แก้ที่เดียวเมื่อย้ายโดเมน
- มี `<meta http-equiv="refresh">` ไปที่ `<ORIGIN>/` และลิงก์ให้กดเอง สำหรับกรณีไม่มี JavaScript
- `deploy.yml` ตัดขั้น Node/npm/build ออก เหลือ checkout → upload `./legacy-redirect` → deploy และคง trigger `push` ที่ `main` กับ `workflow_dispatch`
- GitHub Pages คงไว้แบบนี้ถาวร ไม่มีค่าใช้จ่าย

## 13. ขั้นตอนเปิดใช้และการตรวจรับ

| # | ขั้นตอน | ตรวจรับ |
|---|---|---|
| 1 | Deploy GAS ใหม่ | `BATCH_ALL` ตอบเหมือนเดิมและมี `meta.years` · `save_kpi_data` ที่ไม่มี `year` บันทึกลงชีตปีปัจจุบันเฉพาะแถวอำเภอ · `/` (PA เดิม) ตัวเลขเท่าเดิม |
| 2 | `setup=datacenter` | มีชีตใหม่ 3 ชีต และ `district_code`, `deploy_hook_url` ใน `settings` |
| 3 | `hdc-catalog.js find` กับ 18 ตาราง แล้วใส่ `cat_id` ที่ได้ใน `hdc_topics` | ทุกตารางพบหัวข้อ |
| 4 | `hdc-catalog.js refresh` | `hdc_reports` มีครบ 21 `opendata_id` ใน SCHEMA §6 |
| 5 | `setup=dc_seed` | 21 รายงานเป็น `enabled = TRUE` และไม่มีรายการ "ไม่พบ" |
| 6 | ทดสอบการดึง `s_aged9` และ `s_epi_complete` ด้วย `limit = 5000` | จำนวนแถวที่ได้เท่ากับ `total` ของทั้งสองตาราง และ `s_aged9` เท่ากับตอนไม่ส่ง `limit` |
| 7 | `sync-moph-to-gas.js --backfill --no-rebuild` | `sync_status` มีครบ 18 ตาราง × ทุกปีที่ HDC มีข้อมูล และมีชีต `_y` ตามนั้น |
| 8 | sync ปีปัจจุบัน แล้วรัน `src/scripts/verify-all.js` ในวันเดียวกัน (สคริปต์นี้ใช้ปี `2569` คงที่ ถ้า `current_year` ไม่ใช่ 2569 ต้องแก้ค่าในสคริปต์ก่อน) | ตัวเลขตรงกับ `/pa` |
| 9 | `npm run snapshot && npm run build` บนเครื่อง | ไฟล์ใน `public/data/` ครบ 21 รายงาน ขนาดไม่เกิน §6.1 และ `out/reports/{id}.html` มีครบ 21 ไฟล์ |
| 10 | ตรวจ Data Center บนเครื่อง (`npx serve out`) | ค่าทั้งปีระดับอำเภอของ KPI ที่ PA คิดแบบรายปีตรงกับ PA ถ้าไม่ตรง ให้ตรวจแถวที่ `result` ว่าง (PA มี fallback ไปใช้ผลรวมรายไตรมาส) และเทียบรายงานอื่น 1–2 รายงานกับหน้า HDC ระดับอำเภอ · Lighthouse ผ่าน §9.6 |
| 11 | สร้างโปรเจกต์ Cloudflare Pages + Deploy Hook + ใส่ `deploy_hook_url` | `https://<project>.pages.dev/` เป็น Data Center, `/pa` เป็น PA, `/pa?cat=…` เปิดแท็บถูก, `/reports/{id}` เปิดได้โดยตรง, id ปลอมได้ 404 |
| 12 | POST `rebuild` จากเครื่อง | Cloudflare เริ่ม build ใหม่ภายใน 1 นาที และครั้งที่ 6 ในวันเดียวกันถูกปฏิเสธ |
| 13 | Deploy stub บน GitHub Pages | `…/pa-dashboard/?cat=X` ไปที่ `https://<project>.pages.dev/pa?cat=X` และ `…/pa-dashboard/sync` ไปที่ `/sync` |

**ลำดับสำคัญ:** ขั้น 1 ต้องผ่านก่อนขั้น 7 เพราะการบันทึกปีย้อนหลังต้องใช้ทางบันทึกใหม่ (ไม่อย่างนั้นปีเก่าจะทับชีตปีปัจจุบัน) · ขั้น 13 ทำหลังขั้น 11 ผ่านแล้วเท่านั้น · เมื่อย้ายไปโดเมนเองในอนาคต ต้องแก้ปลายทางของ stub (ขั้น 13) ด้วย

## 14. ความเสี่ยงและข้อสังเกต

| เรื่อง | ผลกระทบ | แนวทาง |
|---|---|---|
| `doPost` ไม่มีการยืนยันตัวตนฝั่ง server (PIN ของ `/sync` ตรวจฝั่ง client และ `DIAG_PIN` อยู่ใน repo สาธารณะ) | ใครมี URL ของ GAS ก็เขียนทับชีตข้อมูล หรือสั่ง rebuild ได้ | **ยอมรับ (D5)** เพราะ (1) เป็นสถานะเดิมของระบบอยู่แล้ว (2) ทุกตารางดึงจาก MOPH ใหม่ได้ทันที และ trigger รายวันเขียนปีปัจจุบันทับกลับเอง (3) ไม่มีข้อมูลส่วนบุคคลในชีต (4) rebuild จำกัด 5 ครั้ง/วัน · ถ้าพบการเขียนทับ ให้รัน `sync-moph-to-gas.js --backfill --force` |
| URL ของ GAS Web App อยู่ใน bundle ของ `/pa` และ `/sync` | อ่านข้อมูลได้ทุกคน | ยอมรับ เพราะเป็นข้อมูลสาธารณะระดับหน่วยบริการอยู่แล้ว GET ไม่เปิดชีตภายใน (whitelist เดิม) · หน้า Data Center ไม่มี URL นี้ |
| GAS ล่มหรือตอบช้าตอน build | build ล้ม | เว็บคงเวอร์ชันก่อนหน้า (§12.5) สั่ง rebuild ใหม่เมื่อ GAS กลับมา |
| MOPH จำกัดความถี่และมี WAF | backfill ใช้เวลานาน และอาจโดน 429 | เว้นช่วงตาม §7.1 และทำ backfill ทีละปีได้ |
| นิยามรายงานของ HDC เปลี่ยนข้ามปี | แนวโน้ม 5 ปีอาจเทียบคนละนิยาม | แจ้งไว้ใน "เกี่ยวกับรายงานนี้" และเก็บ header แยกปีอยู่แล้ว |
| แค็ตตาล็อกมีรายการซ้ำและรายการขยะ (เช่น "dasf") | ปนในคลังรายงาน | กรองซ้ำ และใช้ opt-in |
| ช่องว่างกับเลข 0 แยกกันไม่ได้ (การบันทึกเดิมเก็บ 0 เป็นค่าว่าง) | "ไม่มีข้อมูล" กับ "ศูนย์" ในระดับแถวดูเหมือนกัน | ยอมรับในเฟส 1 การไม่มีข้อมูลตัดสินที่ระดับ (ตาราง, ปี) จาก `sync_status` |
| จำนวนชีตเพิ่มเป็นราว 18 + 18 × 4 ชีต | สเปรดชีตใหญ่ขึ้น แต่แต่ละชีตมีแค่แถวของอำเภอ | ตั้งขนาดชีตตามจำนวนแถวจริง (ไม่ปล่อยแถวว่าง 1,000 แถว) รวม cell ที่ใช้อยู่ห่างจากเพดาน 10 ล้าน cell ของ Google Sheets มาก |

## 15. ข้อตัดสินใจ

| # | เรื่อง | ข้อสรุป (29 ต.ค. 2569) |
|---|---|---|
| D1 | Hosting และ URL | Cloudflare Pages ไม่มี `basePath` Data Center ที่ `/` (§12.5) |
| D2 | path ของ PA | `/pa` |
| D3 | ลิงก์ PA เดิมที่แชร์ไว้ | หน้า stub บน GitHub Pages ส่งต่อไปโดเมนใหม่ (§12.6) ไม่มี redirect ในแอป |
| D4 | ขอบเขตตำบลบนแผนที่ | ดาวน์โหลดจาก MOPH GIS ครั้งเดียว เก็บเป็น `public/geo/song-tambon.geojson` (SCHEMA §8) ไม่ดึงสดแบบ R6 |
| D5 | ความปลอดภัยของ endpoint ที่เขียนข้อมูล | ไม่ทำในเฟส 1 ยอมรับความเสี่ยงตาม §14 |
| D6 | โดเมน | เฟส 1 ใช้ `<project>.pages.dev` ย้ายไปโดเมนเองได้ภายหลังโดยแก้ `<ORIGIN>` ใน stub ที่เดียว |
| D7 | เว็บสาธารณะอ่านข้อมูลจากไหน | ไฟล์ JSON ที่สร้างตอน build (§6) ไม่เรียก GAS สด เพราะประสิทธิภาพ ความทนทาน และข้อจำกัดการทำงานพร้อมกันของ GAS |
| D8 | โครงชีตหลายปี | ชีตปีปัจจุบันชื่อเดิม + ชีต `_y{YYYY}` ต่อปี (§7) เพื่อไม่แตะ PA/`BATCH_ALL` และให้ย้ายปีอัตโนมัติ |
