# GLOSSARY — Song Health Data Center

คำศัพท์ที่ใช้ใน SPEC/SCHEMA/FEATURES, ชื่อ issue, ชื่อเทสต์ และโค้ด ใช้คำตามนี้ ไม่ใช้คำพ้องที่ระบุว่าเลี่ยง

## ระบบ

| คำ | ความหมาย | เลี่ยง |
|---|---|---|
| **Data Center** (Song Health Data Center) | เว็บสาธารณะของ สสอ.สอง ที่ `/`, `/reports`, `/reports/{id}` อ่านจาก snapshot | "dashboard" (ใช้กับ PA เท่านั้น) |
| **PA** (PA Dashboard) | หน้าตัวชี้วัดเดิมของ คปสอ.สอง ย้ายไป `/pa` เรียก GAS สด ห้ามแก้ | |
| **GAS** | Google Apps Script web app ใน `src/scripts/` เป็น API และตัว sync | "backend" |
| **PA-Data** | สเปรดชีต Google Sheets ที่ GAS ใช้เป็นฐานข้อมูล | |
| **HDC Open Data** / **MOPH** | แหล่งข้อมูลต้นทาง `opendata.moph.go.th` ทั้ง `report_data` และ API แค็ตตาล็อก | |
| **R6** | ไฟล์ต้นแบบหน้าจอ `docs/reference/…-r6.html` ตัวเลขในนั้นเป็นข้อมูลจำลอง | |
| **stub** | หน้า GitHub Pages ที่ส่งต่อลิงก์เก่าไปโดเมนใหม่ | "redirect page" |

## แค็ตตาล็อก

| คำ | ความหมาย | เลี่ยง |
|---|---|---|
| **หมวด** (main) | ชั้นบนสุดของ HDC: `main_report_id`, `main_report_name` เช่น ส่งเสริมป้องกัน | "category" (ชนกับหัวข้อ) |
| **หัวข้อ** (topic) | ชั้นที่สองของ HDC: `cat_id`, `category_name` เช่น การสร้างเสริมภูมิคุ้มกันโรค `cat_id` = `subcatalogId` บน hdc.moph.go.th | "subcatalog", "หมวดย่อย" |
| **กลุ่ม** (subgroup) | ชั้นที่เรากำหนดเองภายในหัวข้อ ด้วยคอลัมน์ `subgroup` เช่น กลุ่มอายุ 1 ปี | "sub-topic" |
| **รายงาน** (report) | หน่วยที่แสดงบนเว็บ key = `opendata_id` ซึ่งเท่ากับคอลัมน์ `id` ในข้อมูลดิบ | "KPI" (คำของ PA) |
| **ตารางต้นทาง** (source table) | ตาราง HDC ที่รายงานใช้ `source_table` เช่น `s_epi_complete` ตารางเดียวมีหลายรายงานได้ | "sheet" (ชีตคือที่เก็บ ไม่ใช่ตาราง) |
| **รายงานที่ใช้งาน** (active report) | รายงานที่ `enabled = TRUE`, หัวข้ออยู่ใน `hdc_topics` และ key ผ่านรูปแบบ (SCHEMA §2.3) | "enabled report" |
| **opt-in** | หลักการเลือกเฉพาะหัวข้อและรายงานที่ต้องการ รายงานใหม่ปิดเสมอ | "hidden", "blacklist" |
| **รีเฟรชแค็ตตาล็อก** | `hdc-catalog.js refresh` → `save_catalog` อัปเดตเฉพาะคอลัมน์จาก API | "sync catalog" |
| **`removed`** | สถานะรายงานที่หายจาก API แต่ยังเก็บแถวไว้ | "deleted" |

## ข้อมูลและชีต

| คำ | ความหมาย | เลี่ยง |
|---|---|---|
| **ปีงบประมาณ** (`b_year`) | ปี พ.ศ. ตามปีงบประมาณ ต.ค.–ก.ย. เทียบเป็น string เสมอ | "fiscal year" ในโค้ดใช้ `b_year` |
| **ปีปัจจุบัน** (`current_year`) | ค่าใน `settings` ปีสุดท้ายของ window | |
| **window** | 5 ปี `current_year − 4` … `current_year` | "history range" |
| **ชีตปีปัจจุบัน** | ชีตชื่อเดิม (`s_epi1`) เก็บเฉพาะปีปัจจุบัน | "main sheet", "live sheet" |
| **ชีตปีย้อนหลัง** | ชีต `{table}_y{YYYY}` หนึ่งชีตต่อปี | "archive sheet" |
| **การย้ายปี** (archive) | การที่ GAS ย้ายแถวปีเก่าจากชีตปีปัจจุบันไปชีต `_y` ก่อนเขียนปีใหม่ | "rollover" |
| **อำเภอ** / `district_code` | `5406` ทุกชีตเก็บเฉพาะแถวที่ `areacode` ขึ้นต้นด้วยค่านี้ | |
| **ตำบล** (area) | 6 หลักแรกของ `areacode` ชื่อจาก `tambon_master` | "subdistrict" |
| **หน่วยบริการ** (hospital) | `hospcode` 5 หลัก ชื่อและ `tambon_id` จาก `hospitals` | "facility" (คำของ PA) |
| **sync** | ดึงตารางจาก MOPH แล้ว POST `save_kpi_data` เข้า GAS | "import" |
| **backfill** | sync ทุกปีใน window ครั้งเดียว | |
| **`sync_status`** | ชีตที่บอกว่า (ตาราง, ปี) ใดมีข้อมูล กี่แถว `date_com` ล่าสุดเมื่อไร และอยู่ชีตไหน | |
| **Stale data** | การปฏิเสธข้อมูลที่ `date_com` เก่ากว่าที่มี เว้นแต่ `force` | |
| **PA units** | ตารางที่ PA คำนวณ (`CONFIG.KPIS` ∪ `source_sheet` ใน registry) | |
| **DC units** | `source_table` ของรายงานที่ใช้งาน | |
| **sync units** | PA units ∪ DC units = ตารางที่ whitelist ให้ sync และเขียนได้ | |

## snapshot และ build

| คำ | ความหมาย | เลี่ยง |
|---|---|---|
| **snapshot** | ไฟล์ใน `public/data/` (`meta.json`, `catalog.json`, `reports/{id}.json`) ที่สร้างตอน build | "cache" |
| **prebuild** | `src/scripts/build-snapshot.mjs` ที่ npm รันก่อน `next build` | "fetch script" |
| **rebuild** | การสั่ง Cloudflare build ใหม่ผ่าน Deploy Hook ด้วย POST `rebuild` ของ GAS (5 ครั้ง/วัน) | "redeploy", "trigger build" |
| **Deploy Hook** | URL ของ Cloudflare Pages ที่เก็บใน `settings.deploy_hook_url` | |
| **ล้มดัง ๆ** (fail loudly) | prebuild exit 1 เมื่อข้อมูลไม่ครบ ไม่ publish ข้อมูลบางส่วน | |

## การคำนวณรายงาน

| คำ | ความหมาย | เลี่ยง |
|---|---|---|
| **block ปี** (year block) | ข้อมูลของรายงานหนึ่งปีใน snapshot: `headers`, `rows`, `max_date_com` | "year slice" |
| **กลุ่มคอลัมน์** (column family) | รูปแบบคอลัมน์ที่ตรวจพบจาก header: `ANNUAL`, `Q_A/Q_B/Q_C`, `M_A/M_B`, `OVERRIDE` (SCHEMA §4.1) | "pattern" |
| **รายการ** / **measure** | วัคซีนหนึ่งตัวในตาราง `M_B` เช่น `dtp_hb3` แสดงเป็น `DTP-HB3` | "vaccine column" |
| **ช่วงเวลา** (period) | `year`, `q1`–`q4`, `m10`–`m09` | "quarter/month" แยกกัน |
| **ชนิดรายงาน** (`report_type`) | `coverage` (เป้าหมาย/ผลงาน/ร้อยละ) หรือ `workload` (จำนวนครั้ง เฟส 2) | |
| **เป้าหมาย / ผลงาน / ร้อยละ** | `target` / `result` / `pct = result ÷ target × 100` รวมก่อนหาร ไม่เฉลี่ยร้อยละ | "numerator/denominator" |
| **เกณฑ์** (goal) | ร้อยละที่ถือว่าผ่าน `hdc_reports.goal` หรือ `measure_goals[measure]` ผ่านเมื่อ `pct ≥ goal` | "target %" (ชนกับ `target`) |
| **เปรียบเทียบตาม** (by) | `area` (รายตำบล) หรือ `hosp` (รายหน่วยบริการ) | |
| **วันที่ข้อมูล** | `date_com` สูงสุดของ block ที่แสดง | "last updated" (คำของ PA) |
