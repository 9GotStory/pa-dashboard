# FEATURES — Song Health Data Center เฟส 1 และเฟส 2

> สถานะ: ร่าง v0.9 · 10 พ.ย. 2569 · คู่กับ [SPEC.md](SPEC.md) v0.9 และ [SCHEMA.md](SCHEMA.md) v0.8 · คำศัพท์ตาม [GLOSSARY.md](GLOSSARY.md) · เฟส 1 คือ Track A–E (F01–F22) เฟส 2 คือ Track F (F23–F29) · หน้าแรกตาม V7.6 คือ Track G (F30–F37)
> รายการงานเรียงตามลำดับที่ต้องทำ แต่ละข้อมีเกณฑ์ตรวจรับที่ทดสอบได้ งานจะถือว่าเสร็จเมื่อผ่านเกณฑ์ ไม่ใช่เมื่อเขียนโค้ดเสร็จ
> ต้นแบบหน้าจอ: R6 อยู่ที่ `docs/reference/song-health-data-center-review-03-epi-real-response-r6.html` (`/reports` และ `/reports/{id}`) · V7.6 อยู่ที่ `docs/reference/v7-6/` (หน้าแรกและสีของทุกหน้า, ADR-0012)

## กติกา

### ขั้นตอนทำงาน (workflow ของ [mattpocock/skills](https://github.com/mattpocock/skills))

- ติดตั้งครั้งเดียว: เปิด plugin "Skills For Real Engineers" (`claude plugin install mattpocock-skills@claude-plugins-official`) แล้วรัน `/setup-matt-pocock-skills` เลือก GitHub Issues เป็น tracker และ label ค่าเริ่มต้น สคริปต์จะเขียน `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md` และส่วน `## Agent skills` ใน `CLAUDE.md`
- เอกสารชุดนี้ (SPEC/SCHEMA/FEATURES + GLOSSARY + ADR) คือผลของขั้น `/grill-with-docs` แล้ว ขั้นต่อไปคือ `/to-spec` → spec issue 1 ใบที่สรุปเป้าหมายและข้อตัดสินใจ (อ้าง ADR ไม่ใส่ path ไฟล์) → `/to-tickets` → issue ต่อ F## ตามหัวข้อด้านล่าง เป็น sub-issue ของ spec issue โดยใส่ "ขึ้นกับ" เป็น blocking relationship ของ GitHub · label ตามค่าเริ่มต้นของ skill คือ `ready-for-agent` ทุกใบ ยกเว้นงานคนทำ (F12, F21, F22) ใช้ `ready-for-human` · ใบที่หยิบได้คือใบที่ blocker ปิดหมดแล้ว (frontier)
- spec issue คือ [#107](https://github.com/9GotStory/pa-dashboard/issues/107) (สร้าง 30 ต.ค. 2569) ticket F## สร้างด้วย `/to-tickets` เป็น sub-issue ของใบนี้ · เมื่อสร้างแล้ว issue คือแหล่งความจริงของสถานะงาน ไฟล์นี้คือแหล่งความจริงของเกณฑ์ตรวจรับ ถ้าสองที่ขัดกันให้แก้ไฟล์นี้ก่อนแล้วอัปเดต issue
- ต่อ ticket: `/implement` ซึ่งเรียก `tdd` และ `code-review` เองตอนจบ (ไม่ต้องสั่งซ้ำ) โดย `tdd` เขียนเทสต์เฉพาะ seam ที่ตกลงใน CODING_STANDARDS §5 และ `code-review` เทียบ `CODING_STANDARDS.md` → `pr` (body มี Summary, Evidence, Merge Danger และ `Closes #<issue>`) · ขั้นที่ต้องมีคนทำเอง (F12 รันกับชีตจริง, F21 ตั้ง Cloudflare, F22 เปิด Pages ใหม่) ใช้ `/wizard` นำทีละขั้นและบันทึกผลใน issue
- หลังปิด Track แต่ละชุดรัน `/retro` และนำสิ่งที่เรียนรู้มาแก้ไฟล์นี้หรือ ADR ไม่ใช่จำไว้เฉย ๆ
- งานทั้งหมดเป็นรูป expand–contract: Track A–C ขยาย (GAS รับทั้งแบบเก่าและใหม่, ชีตเพิ่ม, snapshot เพิ่ม) · Track D ย้ายผู้ใช้ (เว็บอ่าน snapshot, PA ไป `/pa`) · Track E หด (GitHub Pages เหลือ stub) จึงอย่ารวม ticket ข้าม Track เป็นใบเดียว

### กติกาโค้ด

- แตก branch จาก `main` ทีละ ticket (`feat/F01-settings-window` …) แล้ว PR เข้า `main` ส่วน `develop` (Backend v2) ไม่ใช้แล้ว ไม่ต้องแตะ (ADR-0001)
- GAS deploy ด้วย `npm run gas:sync` เมื่อ ticket ฝั่ง GAS ผ่านเกณฑ์ (รวม deploy หลายข้อพร้อมกันได้) เป็น version ใหม่ของ deployment เดิม URL ไม่เปลี่ยน
- โค้ด GAS ของ Data Center อยู่ในไฟล์ใหม่ `src/scripts/dc-*.js` (SPEC §12.4) และทุก ticket ฝั่ง GAS ต้องมีเทสต์ใน `src/scripts/test/` ที่โหลดไฟล์ GAS ด้วย `node:vm` พร้อม stub (รันด้วย `npm test` ซึ่ง F01 ตั้งไว้) · ไฟล์ที่ไม่ใช่ GAS ใต้ `src/scripts/` ต้องอยู่ใน `.claspignore` (SCHEMA §10)
- ห้ามแก้ไฟล์ PA เดิม (รายการทางการใน CODING_STANDARDS §1: ไฟล์ที่มีอยู่ก่อนใต้ `src/components/` และ `src/lib/`) ยกเว้นย้ายไฟล์ใน F13 · ใน `รหัส.js` แก้เฉพาะจุดที่ SPEC §12.4 ระบุ
- โค้ดของ Data Center ใต้ `src/lib/dc/` และ `src/components/dc/` ไม่ import จากไฟล์ PA (CODING_STANDARDS §4) ฟังก์ชันที่ต้องให้ผลเหมือน PA (`formatPct`, `formatThaiDate`) อยู่ใน `src/lib/dc/format.ts` · snippet สำหรับเบราว์เซอร์อยู่ใน `tools/` ไม่ใช่ `src/scripts/`
- ทุก PR ต้อง `npm test`, `npm run lint`, `npm run build`, `npm run dc:budget` และ `npm run dc:check` ผ่าน (CI รัน test และ build ตั้งแต่ F01, lint ตั้งแต่ retro ของ Track A, dc:budget ตั้งแต่ retro ของ Track D และ dc:check ตั้งแต่ retro ของ Track F ทั้งหมดบน Node 24 · `lint` ตรวจวลีที่ GLOSSARY ให้เลี่ยง และ import ของโค้ด Data Center ด้วย · ตั้งแต่ F14 ci.yml รัน prebuild จริง จึงต้องส่ง `NEXT_PUBLIC_GAS_SCRIPT_URL` จาก GitHub secrets เข้า build step และ prebuild จะล้มถ้ายังไม่มีรายงานที่ใช้งานพร้อมข้อมูลปีปัจจุบัน F14 จึงต้องรอ F12)
- ลำดับ: Track A → B → C ต้องเสร็จก่อนขึ้นเว็บจริง ส่วน Track D: F13, F17 ทำคู่ขนานได้ตั้งแต่ต้น F15 รอแค่ F01 (ต่อสคริปต์ `npm test`) F14 ขึ้นไปรอ F12 และ Track E ทำท้ายสุด

| Track | งาน | ขึ้นกับ |
|---|---|---|
| A — GAS | F01–F08 | — |
| B — เครื่องมือ sync | F09–F11 | F02, F03, F04, F05, F07 |
| C — ข้อมูล | F12 | A, B |
| D — Frontend | F13–F20 | F13, F17 ไม่ขึ้นกับใคร · F15 ขึ้นกับ F01 · F14 ขึ้นกับ C · ที่เหลือขึ้นกับ F14 |
| E — Hosting | F21, F22 | C, D |

### ดัชนี ticket (เติมเลข issue เมื่อ `/to-tickets` สร้างแล้ว)

| F | ชื่อ | ขึ้นกับ | issue |
|---|---|---|---|
| F01 | ตั้งค่า `district_code`, `deploy_hook_url` และ window ปี | — | #108 |
| F02 | บันทึกข้อมูลตามปี เฉพาะอำเภอ | F01 | #109 |
| F03 | ชีตแค็ตตาล็อกและ `save_catalog` | F01 | #110 |
| F04 | `BATCH_ALL`: `meta.years` และ PA/DC units | F02, F03 | #111 |
| F05 | `GET ?action=catalog` | F03 | #112 |
| F06 | `GET ?action=report&id=` | F02, F03 | #113 |
| F07 | `POST rebuild` | F01 | #114 |
| F08 | `setup=dc_seed` (โค้ด) | F03 | #115 |
| F09 | `sync-moph-to-gas.js` | F02, F04, F07 | #116 |
| F10 | snippet export แค็ตตาล็อก + `hdc-catalog.js --from` | F03, F05 | #117 |
| F11 | หน้า `/sync` | F02, F04, F07 | #118 |
| F12 | Backfill 5 ปีและตรวจตัวเลข (คนทำ, `/wizard`) | F06, F08, F09, F10 | #119 |
| F13 | ย้าย PA ไป `/pa` และตัด `basePath` | — | #120 |
| F14 | prebuild snapshot | F12 (และ F05, F06 ผ่าน F12) | #121 |
| F15 | ชั้นคำนวณ `src/lib/dc/` | F01 | #122 |
| F16 | โครงหน้าและธีม | F13, F14 | #123 |
| F17 | ไฟล์ขอบเขตตำบล | — | #124 |
| F18 | หน้าแรก `/` | F14, F15, F16, F17 | #125 |
| F19 | คลังรายงาน `/reports` | F14, F16 | #126 |
| F20 | หน้ารายงาน `/reports/[id]` | F14, F15, F16 | #127 |
| F21 | Cloudflare Pages + Deploy Hook (คนทำ, `/wizard`) | F12, F18, F19, F20 | #128 |
| F22 | หน้า stub บน GitHub Pages (คนทำ, `/wizard`) | F21 | #129 |

---

## Track A — GAS

### F01 ตั้งค่า `district_code`, `deploy_hook_url` และ window ปี

- **ทำ:** ใน `รหัส.js` (ตามรายการ SPEC §12.4): เพิ่ม `district_code` (`^\d{4}$` ไม่มีกฎข้ามฟิลด์ SCHEMA §2.1) และ `deploy_hook_url` ใน `SETTINGS_SCHEMA` · `CONFIG.DISTRICT = "5406"`, `CONFIG.HISTORY_YEARS = 5` · bump `SETTINGS_CACHE_KEY` เป็น `settings_v3` · สร้าง `dc-storage.js` ใส่ `getYearWindow(settings)` และ `sheetNameFor(table, year, settings?)` (F02 เติม `saveTableYear` ในไฟล์เดียวกัน) · เพิ่ม `**/test/**`, `**/hdc-catalog.js`, `**/*.mjs` ใน `.claspignore` (SCHEMA §10) และวาง harness เทสต์ตัวแรกไว้ใน `src/scripts/test/` · `package.json` เพิ่ม `"test": "node --test \"src/scripts/test/**/*.test.js\""` (รูป glob ใช้ได้ตั้งแต่ Node 22 ส่วนรูปโฟลเดอร์ `node --test src/scripts/test/` ใช้ได้แค่ Node 20 ซึ่งหมดอายุ 30 เม.ย. 2569) · `ci.yml` เปลี่ยน `node-version` เป็น `"24"` และเพิ่มขั้น `npm test` ก่อน `npm run build`
- **ตรวจรับ (เทสต์ใน `src/scripts/test/settings.test.js`):**
  1. `settings` ไม่มีคอลัมน์ใหม่ → `district_code = "5406"`, `deploy_hook_url = ""` โดยไม่ error
  2. `district_code = 55` (ไม่ใช่ 4 หลัก) → ใช้ค่าเริ่มต้น `5406` และมี `Logger.log` ว่า `district_code has invalid value` · `district_code = 5501` ผ่าน (ไม่ตรวจจังหวัด)
  3. `deploy_hook_url` ที่ไม่ใช่ URL ของ Cloudflare → ถือเป็นว่าง
  4. `current_year = 2569` → window = `["2565","2566","2567","2568","2569"]`
  5. `sheetNameFor("s_epi1", "2569", settings)` = `s_epi1` · `sheetNameFor("s_epi1", "2567", settings)` = `s_epi1_y2567`
  6. `clasp show-file-status` แสดงเฉพาะ `รหัส.js`, `dc-*.js`, `appsscript.json` ไม่มีไฟล์เทสต์หรือสคริปต์ node
  7. `npm test` บน Node 24 รันเฉพาะไฟล์ `*.test.js` (ไฟล์ stub ใน `src/scripts/test/` ไม่ถูกนับเป็นเทสต์) และ CI ของ PR นี้แสดงขั้น `npm test` ผ่าน

### F02 บันทึกข้อมูลตามปี เฉพาะอำเภอ (`dc-storage.js`)

- **ทำ:** `saveTableYear(tableName, year, rows, { total, force })` ตาม SCHEMA §3.3 ขั้น 1–11 รวมการย้ายปีอัตโนมัติที่กรองอำเภอและไม่ทับข้อมูลใหม่กว่า (SCHEMA §2.5) และ `sync_status` (สร้างชีตเองถ้ายังไม่มี) · ไม่ถือ script lock เอง (`doPost`/`syncAllData` ถือ SCHEMA §3) · `save_kpi_data` ใน `doPost` เรียกฟังก์ชันนี้ · `syncAllData` เรียกฟังก์ชันนี้แทน `saveDataToSheet` เดิมด้วย `force: true` (`saveDataToSheet` เดิมคงไว้แต่ไม่มีใครเรียก ระบุใน comment) · `fetchMophForKpi` ส่ง `limit = 5000` และคืน `total`
- **ตรวจรับ (เทสต์ด้วย stub ของ SpreadsheetApp ที่จำลองชีตในหน่วยความจำ):**
  1. บันทึกปี 2569 (= current_year) 700 แถวทั้งจังหวัด → ชีต `s_x` มีเฉพาะแถว `5406` · response `received = 700`, `count` = จำนวนแถวอำเภอ, `sheet = "s_x"`, `archived = []` · `sync_status` มีแถว (`s_x`, 2569, sheet `s_x`)
  2. บันทึกปี 2568 → ชีต `s_x_y2568` ถูกสร้าง ชีต `s_x` ไม่เปลี่ยน · `sync_status` มี 2 แถว
  3. บันทึกปี 2568 ซ้ำด้วยข้อมูลใหม่ (date_com ใหม่กว่า) → `s_x_y2568` ถูกแทนที่ทั้งชีต
  4. ย้ายปีอัตโนมัติ: `s_x` มีแถว b_year 2569 อยู่ แล้ว `current_year` เปลี่ยนเป็น 2570 และบันทึกปี 2570 → แถว 2569 ไปอยู่ `s_x_y2569`, `s_x` มีแต่ 2570, response `archived = ["2569"]`, `sync_status` ของ 2569 ชี้ sheet `s_x_y2569` · ถ้า `s_x` ยังมีแถว 2569 นอกอำเภอ (ทั้งจังหวัดจากทางบันทึกเดิม) แถวเหล่านั้นถูกทิ้ง `s_x_y2569` มีเฉพาะแถว `5406` และ `row_count` นับเฉพาะแถวนั้น
  4b. เหมือนข้อ 4 แต่ก่อนหน้านั้นมีการ sync ปี 2569 ซ้ำลง `s_x_y2569` ด้วย `date_com` ใหม่กว่า → `s_x_y2569` ไม่ถูกทับ แถวเก่าใน `s_x` ถูกทิ้ง และ `archived = []`
  5. `year = 2560` (นอก window) → error `Year outside window` ไม่แก้ชีต
  6. `total = 2444` แต่ส่งมา 1000 แถว → error `Incomplete data` ไม่แก้ชีต
  7. payload ไม่มี `areacode` → error `No areacode column`
  8. ส่งข้อมูลที่ `date_com` เก่ากว่าที่มี → error `Stale data` · ส่งซ้ำพร้อม `force: true` → บันทึก · `syncAllData` (stub `UrlFetchApp` ตอบข้อมูลที่ `date_com` เก่ากว่า) → บันทึกโดยไม่ error เพราะส่ง `force: true`
  9. header ของปี 2568 ต่างจาก 2569 → แต่ละชีตมี header ของตัวเอง ไม่มีคอลัมน์ว่างปน
  10. หลังเขียน ชีตมีจำนวนแถว = ข้อมูล + 1 (ไม่เหลือแถวว่าง 1,000 แถว)
  11. ไม่มีชีต `sync_status` มาก่อน → ถูกสร้างพร้อม header ในการบันทึกครั้งแรก
  12. stub `LockService` นับการถือ lock: เรียกผ่าน `doPost` ถูกถือครั้งเดียวและปล่อยใน `finally` ส่วนเรียก `saveTableYear` ตรง ๆ ไม่เรียก `tryLock` เลย

### F03 ชีตแค็ตตาล็อกและ `save_catalog` (`dc-catalog.js`)

- **ทำ:** `setup=datacenter` สร้าง `hdc_topics`, `hdc_reports`, `sync_status` + คอลัมน์ `district_code`, `deploy_hook_url` ใน `settings` · `readHdcTopics()`/`readHdcReports()` พร้อม validation และนิยาม "รายงานที่ใช้งาน" · `save_catalog` ตาม SCHEMA §3.4 (ไม่ถือ lock เอง `doPost` ถือ) · `sanitizeHdcId` (trim + `^[A-Za-z0-9_-]{8,64}$` ไม่แปลงตัวพิมพ์) · `dcCleanName` (SCHEMA §3)
- **ตรวจรับ (ใช้ไฟล์ response จริงของหัวข้อวัคซีน 46 แถวเป็น fixture):**
  1. `setup=datacenter` รัน 2 ครั้ง → ครั้งสองตอบ `created: []`, `settings_columns_added: []` และไม่ลบข้อมูลที่มี
  2. `save_catalog` ครั้งแรก → `added: 34, updated: 0, removed: 0, skipped: 0` และทุกแถว `enabled = FALSE`
  3. ติ๊ก `enabled` 1 แถว ใส่ `subgroup` แล้วส่งซ้ำ → `updated: 34` และค่าที่ติ๊กไม่หาย
  4. ส่งรายการที่ตัด 1 รายงานออก → แถวนั้น `catalog_status = removed` แถวยังอยู่
  5. ส่ง `cat_id` ที่ไม่อยู่ใน `hdc_topics` → error `Topic not in hdc_topics`
  6. ส่ง `reports: []` → error `Empty report list` และไม่มีแถวถูกตั้ง `removed`
  7. รายงานที่ `source_table` ไม่ขึ้นต้นด้วย `s_` → นับใน `skipped` ไม่ถูกเพิ่ม
  8. fixture ที่มีรหัส `T81yHkXJY8lk8nGZQqldk` และ `iEds82J3Z67JHB8KLETD_` → ทั้งสองถูกเพิ่ม (ไม่ `skipped`) และ `opendata_id` ในชีตตรงทุกตัวอักษร ไม่ถูกแปลงเป็นตัวพิมพ์เล็ก
  9. fixture ที่ `report_name` มี `<font color=red>…</font>` tab และช่องว่างซ้ำ และ `category_name`/`main_report_name` มีช่องว่างท้าย → ค่าในชีตไม่มีแท็ก ช่องว่างเหลือช่องเดียว ไม่มีช่องว่างหัวท้าย ทั้งใน `hdc_reports` และ `hdc_topics`


### F04 `BATCH_ALL`: `meta.years` และ PA/DC units

- **ทำ:** ใน `รหัส.js`: `getSyncUnits` เดิมเปลี่ยนชื่อเป็น `getPaUnits` · `clearConfigCache` ล้าง `dc_units_v1` ด้วย · `meta.kpi_config` จาก `getSyncUnits` ใหม่ · เพิ่ม `meta.years` · การอ่านและคำนวณ `data` ไม่แตะ — ใน `dc-storage.js`: `getSyncUnits` ใหม่ = PA ∪ DC (DC units มาจาก `readHdcReports()` ใน F03 แคช 60 วินาทีคีย์ `dc_units_v1` ถ้ายังไม่มีชีต = ว่าง) — ใน `dc-catalog.js`: `save_catalog` (F03) ล้าง `dc_units_v1` หลังเขียน (SCHEMA §3.4)
- **ตรวจรับ:**
  1. ก่อนแก้ บันทึก response `BATCH_ALL` ไว้ หลังแก้ response เหมือนเดิมทุกฟิลด์ ยกเว้น `meta.kpi_config` ที่อาจมีรายการ DC เพิ่ม และ `meta.years` ที่เพิ่มใหม่
  2. หลัง F02 ข้อ 1 (ชีตปีปัจจุบันเหลือแถวอำเภอ) ตัวเลข `target/result` ใน `BATCH_ALL` เท่าเดิม
  3. `/` (PA เดิม ก่อน F13) แสดงตัวเลขเท่าเดิม
  4. เรียก `BATCH_ALL` 2 ครั้งติดกัน → ครั้งที่สองไม่อ่านชีต `hdc_reports` (ดูจาก stub ที่นับการอ่าน)

### F05 `GET ?action=catalog` (`dc-catalog.js`)

- **ทำ:** ตาม SCHEMA §3.1 ไม่มีแคช
- **ตรวจรับ:**
  1. response ตรง type `GasCatalog` (SCHEMA §9) ตรวจด้วยสคริปต์เล็ก ๆ ที่อ่าน JSON แล้วเช็กฟิลด์บังคับ
  2. มีเฉพาะรายงานที่ `enabled = TRUE` และหัวข้ออยู่ใน `hdc_topics`
  3. `s_epi2` มี `measure_goals.mmr1 = 95` และ `measure_goals.dtp4 = 90`
  4. `years` ของตารางที่ sync แล้วตรงกับ `sync_status`
  5. ติ๊ก `enabled` เพิ่มแล้วเรียกใหม่ → เห็นทันที (ไม่มีแคช)

### F06 `GET ?action=report&id=` (`dc-report.js`)

- **ทำ:** ตาม SCHEMA §3.2 ตอบ block ต่อปี พร้อม `sheet_rows`/`expected_rows` และถือ script lock ระหว่างอ่าน (`catalog` ใน F05 ก็ถือ lock เช่นกัน)
- **ตรวจรับ:**
  1. `id` ของ fully immunized 1 ปี → ทุก block ทุกแถว `id = 28dd2c79…` และ `areacode` ขึ้นต้น `5406` · `years` เรียงปีน้อยไปมาก
  2. `id` ของ `s_epi2` → ทุกแถว `id = 71e49e4b…` · `id` ของ `s_dental_0_5_cavity_free` (ชีตไม่มีคอลัมน์ `id`) → ได้ทุกแถวของอำเภอ
  3. `id` ที่ไม่เปิด ไม่มี หรือต่างจากที่เก็บแค่ตัวพิมพ์ → error `Unknown report`
  4. `id` ที่ผ่านรูปแบบแต่ยังไม่มีข้อมูล → `years: []`
  5. ตารางที่มี 2 ปีในชีต `s_x` และ `s_x_y2568` → ได้ 2 block header ของใครของมัน และ `sheet_rows = expected_rows` ทั้งสอง
  6. stub ให้ lock ถูกถืออยู่ → ตอบ error `Busy` ไม่ตอบข้อมูลครึ่งเดียว

### F07 `POST rebuild` และการเรียกจาก `syncAllData` (`dc-rebuild.js`)

- **ทำ:** ตาม SCHEMA §3.7 (`requestRebuild` ไม่ถือ lock เอง ผู้เรียกถือ) · `syncAllData` เรียก `requestRebuild("daily sync")` ตอนจบถ้า `okCount > 0` · เมนู `onOpen` เพิ่ม "Rebuild Website" ผ่าน `rebuildWebsiteMenu` ที่ถือ lock
- **ตรวจรับ (เทสต์ด้วย stub ของ UrlFetchApp/PropertiesService):**
  1. `deploy_hook_url` ว่าง → error `Deploy hook not configured` และไม่เรียก fetch
  2. ตั้ง URL แล้วเรียก 5 ครั้ง → สำเร็จทั้ง 5 (`remaining_today` ลดจาก 4 ถึง 0) ครั้งที่ 6 → error `Rebuild quota exceeded` และไม่เรียก fetch
  3. วันถัดไป (เปลี่ยนวันใน stub) → นับใหม่ และคีย์ของวันก่อนถูกลบ
  4. hook ตอบ 500 → error พร้อม status และไม่นับโควตา

### F08 `setup=dc_seed`

- **ทำ:** เขียนโค้ดของ `setup=dc_seed` ที่ใส่คอลัมน์ผู้ดูแลของ 21 รายงานตาม SCHEMA §6 โดยจับคู่ `opendata_id` (การรันกับชีตจริงอยู่ใน F12 เพราะต้องรอ `refresh` จาก F10 ก่อน)
- **ตรวจรับ (เทสต์ด้วย stub ชีต `hdc_reports` ที่มีแถวจาก fixture ของ F03 รวม 21 `opendata_id` ตาม SCHEMA §6):**
  1. ตอบ `applied: 21, not_found: []` และแถว `s_dental_0_5_cavity_free` มี `col_target = "b"`, `col_result = "a"`
  2. ตัดแถว `opendata_id` ออก 1 แถวจาก stub → `applied: 20`, `not_found` มี id นั้น และไม่สร้างแถวใหม่
  3. รัน 2 ครั้งผลเหมือนเดิม และคอลัมน์จาก API (`report_name`, `source_table`, `catalog_status`) ไม่ถูกแตะ
- **ตรวจรับกับชีตจริง (ใน F12):** `?action=catalog` มี 21 รายงานพร้อม `subgroup`/`order`/`goal` ตาม SCHEMA §6

---

## Track B — เครื่องมือ sync

### F09 `src/scripts/sync-moph-to-gas.js`

- **ทำ:** `--year` (ซ้ำได้) · `--backfill` · `--force` · `--no-rebuild` · `limit = 5000` ทุกตาราง · ส่ง `year`, `total`, `force` และหยุดตารางนั้นพร้อมข้อความเมื่อได้แถวน้อยกว่า `total` · POST `rebuild` ตอนจบถ้ามีตารางสำเร็จและไม่ได้ใส่ `--no-rebuild` (SPEC §7.1, §12.2)
- **ตรวจรับ:**
  1. `--only s_aged9 --no-rebuild` และ `--only s_epi_complete --no-rebuild` → log แสดง `received`/`count` และจำนวนแถวที่ดึงได้ = `total` ของ MOPH
  2. `--year 2568 --only s_kpi_dental33 --no-rebuild` → `sync_status` มีแถว (`s_kpi_dental33`, 2568, sheet `s_kpi_dental33_y2568`)
  3. รันโดยไม่ใส่ `--no-rebuild` → log บรรทัดสุดท้ายแสดงผลของ `rebuild` (สั่งแล้ว / ครบโควตา / ไม่ได้ตั้ง hook) · กรณี `Stale data` ทดสอบที่ F02 ข้อ 8 แล้ว ส่วน `--force` แค่ส่ง `force: true` ไปกับ body

### F10 snippet export แค็ตตาล็อก + `src/scripts/hdc-catalog.js` (ใหม่)

- **ทำ:** `tools/hdc-catalog-export.js` snippet สำหรับ DevTools console บนหน้า `https://opendata.moph.go.th` ตาม SPEC §12.3 มีอยู่แล้ว (เขียนตอน grill 30 ต.ค. 2569 เพื่อ export ครั้งแรก F10 ปรับตามผลรีวิวได้) · `hdc-catalog.js find --from <ไฟล์> <table…>` และ `refresh --from <ไฟล์> [--cat <cat_id>]` ไม่เรียก MOPH และไม่ส่ง header ปลอมเป็นเบราว์เซอร์ (ADR-0010) · `refresh` อ่าน `NEXT_PUBLIC_GAS_SCRIPT_URL` จาก env เท่านั้น ไม่มี fallback · `catalog-exports/` อยู่ใน `.gitignore` แล้ว
- **ตรวจรับ:**
  0. `refresh --from <ไฟล์>` โดยไม่ตั้ง env → exit 1 พร้อมข้อความบอกชื่อ env · `find` ทำงานได้โดยไม่มี env
  1. รัน snippet ในเบราว์เซอร์ → ได้ไฟล์ที่ `categories` ครบตามจำนวน ณ วันรัน (29 ต.ค. 2569 มี 51) และ `reports` มี key ครบทุก `cat_id` ที่ไม่อยู่ใน `errors` · หัวข้อวัคซีนมี 46 แถว · ถ้าได้ 429 ระหว่างทาง snippet รอแล้วลองใหม่ ไม่ต้องรันใหม่ทั้งหมด
  2. `find --from <ไฟล์>` กับ 18 ตาราง → พิมพ์ `cat_id`/`category_name`/`opendata_id`/`report_name` ครบทุกตาราง และ `cat_id`/`opendata_id` ตรงกับ SCHEMA §6 (ยืนยันกับ export 30 ต.ค. 2569 แล้ว ถ้า export ใหม่ไม่ตรง ต้องแก้ SCHEMA ก่อนทำ F08)
  3. `refresh --from <ไฟล์>` หลังใส่ 6 หัวข้อใน `hdc_topics` → สรุปต่อหัวข้อ `added/updated/removed/skipped` และ `hdc_topics.report_count` ถูกเติมตรงกับตารางใน SCHEMA §6
  4. ไฟล์ที่ไม่มี key ของหัวข้อหนึ่ง (หรือหัวข้อนั้นอยู่ใน `errors`) → `refresh` ข้ามหัวข้อนั้นพร้อมข้อความ ไม่ POST `reports: []` · ไฟล์ที่ไม่มี `exported_at` → exit 1

### F11 หน้า `/sync`

- **ทำ:** ตัวเลือกปีจาก `meta.years` ของ `BATCH_ALL` (เพิ่มใน F04) · ส่ง `year`, `total` และ `limit = 5000` · retry เมื่อ MOPH ตอบ 429/5xx (ของเดิม retry เฉพาะ network error) · ถ้า GAS ตอบ `Stale data` แสดงเป็น warning (การบันทึกทับใช้สคริปต์ node `--force`) · POST `rebuild` ตอนจบถ้ามีตารางสำเร็จ และแสดงผล · login ด้วย PIN คงเดิม
- **ตรวจรับ:**
  1. เลือกปี 2568 แล้ว sync 1 ตาราง → `sync_status` มีแถวปีนั้น
  2. ไม่เลือกปี → ค่าเริ่มต้นเป็น `current_year` และผลเหมือน sync แบบเดิม
  3. sync เสร็จ → log แสดงผล `rebuild` และ Cloudflare เริ่ม build (ตรวจได้หลัง F21)

---

## Track C — ข้อมูล

### F12 Backfill 5 ปีและตรวจตัวเลข

- **ทำ:** ตามขั้น 3–8 ใน SPEC §13: รัน snippet export ในเบราว์เซอร์ → `find --from` → ใส่ `hdc_topics` → `refresh --from` → `dc_seed` → `--backfill --no-rebuild` → sync ปีปัจจุบัน → `verify-all.js`
- **ตรวจรับ:**
  1. `sync_status` มีครบ 18 ตาราง × ทุกปีที่ HDC มีข้อมูลใน window (บางตารางอาจไม่มีปีเก่า ให้บันทึกไว้ว่าตารางไหนเริ่มปีไหน: คือบรรทัด `– <ตาราง> <ปี>: no data in HDC` ใน log ของ `--backfill` ซึ่งไม่นับเป็นล้ม `--backfill` จึงยัง exit 0) และมีชีต `_y` ตรงกับ `sync_status.sheet`
  2. `verify-all.js` ในวันเดียวกับ sync: KPI แบบรายปีและ EPI ตรงกับ `/pa` (สคริปต์ใช้ปี 2569 คงที่และรวม 4 ไตรมาสเสมอ KPI รายไตรมาสจึงไม่ต้องตรง ถ้า `current_year` เปลี่ยนแล้ว แก้ค่าในสคริปต์ก่อน)
  3. ค่ารายปีระดับอำเภอจาก `?action=report` ของ KPI แบบรายปี (เช่น `s_dm_screen`) คำนวณด้วยมือหรือสคริปต์แล้วตรงกับ PA
  4. บันทึกเวลาที่ `syncAllData` ใช้ต่อรอบจาก `system_logs` (SUCCESS แรกถึงสุดท้าย) ถ้าเกิน 4 นาที เปิด issue ตาม SPEC §14

---

## Track D — Frontend

### F13 ย้าย PA ไป `/pa` และตัด `basePath`

- **ทำ:** ย้าย `src/app/page.tsx` → `src/app/pa/page.tsx`, `loading.tsx` → `pa/loading.tsx`, เพิ่ม `pa/layout.tsx` (metadata เดิม) · `src/app/(dc)/page.tsx` ใหม่เป็นหน้าชั่วคราว (ชื่อระบบ + ลิงก์ไป `/pa`) จนกว่า F18 · ลบ `basePath`/`isProd` ใน `next.config.ts` · metadata root เป็นของ Data Center และ `<html lang="th">` · `deploy.yml` เหลือ trigger `workflow_dispatch` เท่านั้น (หยุด deploy อัตโนมัติขึ้น GitHub Pages จนกว่า F22 เพราะ build ไม่มี `basePath` แล้ว) · `package.json` เปลี่ยน `start` จาก `next start` เป็น `npx serve@latest out` (Next.js 16 ไม่ให้ใช้ `next start` กับ `output: 'export'`)
- **ตรวจรับ:**
  1. `npm run build` ผ่าน และ `out/pa.html` มีอยู่
  2. `grep -r "/pa-dashboard" out/` ไม่พบ
  3. `npm start` แล้วเปิด `/pa` และ `/pa?cat=สร้างเสริมภูมิคุ้มกันโรค` → หน้าตาและตัวเลขเหมือน production ปัจจุบัน แท็บเปิดถูก ยกเว้นรูปตัวอักษรไทยของข้อความเนื้อหาที่เปลี่ยนตาม `<html lang="th">` (SPEC §11) · ตัวเลขและข้อความตรวจด้วย `npm run pa:snapshot -- prod` (production) กับ `PA_URL=http://localhost:3000/pa npm run pa:snapshot -- f13-local` แล้ว `npm run pa:compare -- prod f13-local` ต้องได้ "PA unchanged"
  4. `git diff --stat` ไม่มีไฟล์ใน `src/components` หรือ `src/lib` เปลี่ยน (นอกจาก rename)
  5. หลัง merge ไม่มี workflow run ของ `deploy.yml` เกิดขึ้นเอง และ `https://9gotstory.github.io/pa-dashboard/` ยังเป็น PA เวอร์ชันก่อนหน้า

### F14 prebuild snapshot (`src/scripts/build-snapshot.mjs`)

- **ทำ:** ตาม SPEC §6.2 และ SCHEMA §7: ดึง catalog + report ทุกตัวทีละคำขอ (retry `Busy` ทุก 20 วินาทีไม่เกิน 5 นาที, error อื่น 3 ครั้ง) → เรียงตาม SPEC §5.4 และตัดกลุ่ม/หัวข้อ/หมวดว่าง → ตรวจความครบ (`sheet_rows = expected_rows`, ปีปัจจุบันมีแถว, ทุกปีใน `report.years` มี block ใน `years` เพราะ `?action=report` ข้ามปีที่ชีตหายไป SCHEMA §3.2) → เขียน `public/data/meta.json`, `catalog.json`, `reports/{id}.json` → ตรวจขนาด → ล้มดัง ๆ · ต้องมี env `NEXT_PUBLIC_GAS_SCRIPT_URL` ไม่มี URL สำรอง · `package.json`: `"prebuild"` และ `"snapshot"` = `node --env-file-if-exists=.env.local src/scripts/build-snapshot.mjs` (บนเครื่องอ่าน URL จาก `.env.local` ส่วน CI และ Cloudflare ตั้ง env เอง ค่าที่ตั้งไว้ชนะค่าในไฟล์) · `.gitignore` เพิ่ม `public/data/` · `ci.yml` ส่ง `NEXT_PUBLIC_GAS_SCRIPT_URL` จาก secrets เข้า build step · `src/lib/dc/snapshot.ts` (อ่านไฟล์ด้วย `fs` สำหรับ server component)
- **ขึ้นกับ:** F12 (prebuild ล้มถ้าไม่มีรายงานที่ใช้งานพร้อมข้อมูลปีปัจจุบัน จึงต้องมี seed + sync แล้ว) ซึ่งครอบ F05, F06
- **ตรวจรับ:**
  1. `npm run snapshot` → ไฟล์ครบตามจำนวนรายงานที่ใช้งาน และ `catalog.json` เรียงหัวข้อวัคซีนเป็น กลุ่มอายุ 1 → 2 → 3 → 5 ปี โดยในกลุ่ม `s_epi1` มาก่อน fully immunized
  2. ไม่ตั้ง env → exit 1 ทันที · ชี้ env ไป URL ที่ตอบ error → exit 1 และไม่เขียนไฟล์ใด ๆ (ไม่มีไฟล์ครึ่ง ๆ กลาง ๆ)
  3. จำลองรายงานหนึ่งตัวดึงไม่ได้, block ที่ `sheet_rows ≠ expected_rows` หรือ `years` ที่ขาดปีซึ่ง `report.years` มี (ใช้ stub server) → exit 1 · stub ตอบ `Busy` 2 ครั้งแล้วสำเร็จ → ผ่านโดยรอระหว่างนั้น · ตอบ `Busy` ตลอด → exit 1 เมื่อครบเวลา (ช่วงรอและเพดานตั้งผ่าน env ในเทสต์ได้)
  4. ขนาดไฟล์ทุกไฟล์ไม่เกิน SPEC §6.1 (เกิน = exit 1, ถึง 80% = เตือน) และ script พิมพ์ไฟล์ที่ใหญ่ที่สุด
  5. `npm run build` รัน prebuild เองและผ่าน · `git status` ไม่เห็น `public/data/` · CI ของ PR นี้ผ่านโดยใช้ secret

### F15 ชั้นคำนวณ (`src/lib/dc/types.ts`, `values.ts`, `client.ts`)

- **ทำ:** type ตาม SCHEMA §9 · `values.ts` ตาม SCHEMA §4 ทั้งหมด ทำงานบน `DcYearBlock` (ตรวจกลุ่มคอลัมน์ต่อ block, measure, เป้าหมาย/ผลงานต่อแถว, รวม, จัดกลุ่มพื้นที่/หน่วย, แนวโน้ม, ผ่านเกณฑ์, วันที่ข้อมูล) · `format.ts`: `formatPct` สำเนาจาก PA และ `formatThaiDate` เขียนใหม่ให้ผลเหมือน PA โดยไม่ import ไฟล์ PA และรับ `""` ได้โดยไม่ throw (`max_date_com` ของ block ที่ไม่มีแถว, SCHEMA §3.2) · `client.ts` โหลด `/data/reports/{id}.json` พร้อม cache ในหน่วยความจำ · เทสต์ `values.test.ts`, `format.test.ts` ด้วย `node:test` รันผ่าน `npx tsx --test src/lib/dc/*.test.ts` และต่อท้ายสคริปต์ `npm test` ด้วย `&& tsx --test src/lib/dc/*.test.ts` ให้ CI รันด้วย (devDependencies ใหม่ของ Data Center มี 2 ตัว: `tsx` ที่นี่ และ `@types/leaflet` ใน F18 นอกจาก `playwright-core` ของ `pa-check.mjs` และ `dc-check.mjs` ตาม CODING_STANDARDS §3)
- **ตรวจรับ (เทสต์):**
  1. header จริงของทั้ง 18 ตาราง (ตาม SCHEMA §4.1) → ตรวจพบกลุ่มคอลัมน์ตรงตารางนั้นทุกตัว และ `s_dm_screen`/`s_aged9` ไม่ถูกมองเป็นรายไตรมาส
  2. `s_epi1` → measure 20 รายการ `s_epi2` → 6 รายการ และ `dtp_hb3` แสดงเป็น `DTP-HB3`
  3. แถว 3 แถว target 10/20/0 result 5/10/0 → `T=30, R=15, pct=50` และแถว target 0 ทั้งหมด → `pct = null`
  4. `OVERRIDE` (`b`/`a`) ชนะ `ANNUAL` และ `M_B` ของ measure ที่เลือกชนะ `ANNUAL`
  5. `pct = 89.999` กับ `goal = 90` → ไม่ผ่าน (เทียบก่อนปัด)
  6. 2 block ปีที่ header ต่างกัน → แนวโน้มได้ค่าของแต่ละปีถูกต้อง และ measure ที่ไม่มีในปีหนึ่งได้ `null` ไม่ใช่ 0
  7. `formatPct(89.585)` = `"89.58"` (ปัดแบบ `toFixed` เหมือน PA) และ `formatThaiDate` กับ `date_com` 12 หลักและ 14 หลัก (`s_epi1`) ให้ข้อความเดียวกับที่ PA แสดงสำหรับค่าเดียวกัน

### F16 โครงหน้าและธีม Data Center

- **ทำ:** `src/components/dc/Masthead.tsx` (masthead + เมนู หน้าแรก · คลังรายงาน · PA Dashboard) · `Footer.tsx` (อ่าน `meta.json` ตอน build) · token สีจาก R6 ใน `globals.css` ภายใต้ `@theme` (ชื่อ `--color-dc-*` ไม่ชนกับ `brand-*` ของ PA) · route group `src/app/(dc)/layout.tsx` ห่อเฉพาะ `/`, `/reports`, `/reports/[id]` ส่วน `/pa` และ `/sync` อยู่นอก group · หน้าชั่วคราว `/reports` และ `/reports/[id]` (หัวเรื่อง + ข้อความสั้น, `[id]` จาก `generateStaticParams` ของ `catalog.json` + `dynamicParams = false`) จนกว่า F19/F20 · ลิงก์ข้ามไปเนื้อหาหลัก และ focus ไปที่ `<h1>` ของหน้าใหม่หลังเปลี่ยนหน้าในเบราว์เซอร์ (`HeadingFocus.tsx`, CODING_STANDARDS §4) · `src/scripts/dc-check.mjs` (`npm run dc:check`, CODING_STANDARDS §5) หลัง `npm run build` เปิดทุกหน้า HTML ของ `/`, `/reports`, `/reports/[id]` ใน `out/` ด้วย `playwright-core` ที่ความกว้าง 360px แล้ว exit 1 พร้อมชื่อหน้าและสิ่งที่ผิดเมื่อพบ: request ไป `script.google.com`, control ที่ไม่มี label, `<table>` ที่ไม่มี `<caption>`, `<svg>` ที่ไม่ได้ตั้ง `aria-hidden="true"` แต่ไม่มี `role="img"` + `aria-label`, scroll แนวนอนระดับหน้า, คำว่า "จำลอง"/"ตัวอย่าง" หรือ error ในหน้า (กฎ CODING_STANDARDS §4)
- **ขึ้นกับ:** F13, F14 (footer อ่าน `meta.json` ผ่าน `snapshot.ts` ของ F14)
- **ตรวจรับ:**
  1. `/pa` และ `/sync` ไม่มี masthead ของ Data Center และ class ของ PA ไม่เปลี่ยน
  2. `/`, `/reports`, `/reports/{id}` มี masthead และ footer แสดงผลได้ที่ความกว้าง 360px โดยไม่มี scroll แนวนอนระดับหน้า (ตารางเลื่อนได้ภายในกรอบของตัวเองตาม SPEC §9.1)
  3. footer แสดงเวลาที่ build ตรงกับ `meta.json`
  4. `npm run dc:check` ผ่านกับ build นี้ และล้ม (exit 1 พร้อมชื่อหน้า) เมื่อจงใจทำผิดทีละกฎ แล้วคืนโค้ดกลับ

### F17 ไฟล์ขอบเขตตำบล

- **ทำ:** ดาวน์โหลดตาม SCHEMA §8 เก็บ `public/geo/song-tambon.geojson` + บันทึกวันที่และ URL ที่ใช้ใน `public/geo/README.md`
- **ตรวจรับ:**
  1. 8 features และ `ADMIN_ID3` = `540601`–`540608` ครบ ไม่ซ้ำ
  2. ไฟล์ < 500 KB
  3. วาดบน Leaflet แล้วรูปร่างอยู่ในกรอบอำเภอสอง (ไม่มี polygon หลุดไปจังหวัดอื่น)

### F18 หน้าแรก `/`

- **ทำ:** ตาม SPEC §9.2 · หน้าเป็น server component อ่าน `catalog.json`/`meta.json` ตอน build แล้วส่ง `areas`/`hospitals` เป็น props ให้ `src/components/dc/DistrictExplorer.tsx` (`'use client'`) ซึ่งเป็นตัวเรียก `next/dynamic(() => import('./DistrictMap'), { ssr: false })` (Next.js ไม่ให้ใช้ `ssr: false` ใน server component โดยตรง) · `DistrictMap.tsx` ใช้ Leaflet อ่าน `/geo/song-tambon.geojson` · เพิ่ม `leaflet@1.9.4` เป็น dependency และ `@types/leaflet` เป็น devDependency · เลือกตำบล (คลิกแผนที่หรือปุ่ม) แสดงรายชื่อหน่วยบริการ · การ์ดหัวข้อ · วันที่ข้อมูลล่าสุด · ที่มาของข้อมูล · footer ของ F16 เพิ่มวันที่ข้อมูลล่าสุด (`meta.latest_date_com` ผ่าน `formatThaiDate`) และวันที่ดาวน์โหลดไฟล์ขอบเขต (SCHEMA §8)
- **ขึ้นกับ:** F14, F15 (`formatThaiDate`), F16, F17
- **ตรวจรับ:**
  1. แผนที่แสดง 8 ตำบลเป็นสีและชื่อตรง `areas` คลิกตำบลแล้วแผงด้านข้างเปลี่ยนตาม
  2. ตำบลบ้านหนุน (`540601`) แสดงหน่วยบริการตามค่า `tambon_id` ในชีต `hospitals` ณ วันทดสอบ (ข้อมูล 29 ต.ค. 2569 คือ "บ้านหนุน" และ "สอง" — ถ้า รพ.สอง ควรอยู่ตำบลอื่น ให้แก้ที่ชีต ไม่ใช่ที่โค้ด)
  3. การ์ดหัวข้อมีจำนวนรายงานเท่ากับใน `catalog.json` และลิงก์ไป `/reports?cat=…`
  4. ไม่มีคำว่า "จำลอง" หรือ "ตัวอย่าง" ในหน้า
  5. บล็อก `tile.openstreetmap.org` → หน้ายังใช้งานได้ เลือกตำบลด้วยปุ่มได้
  6. หน้าแรกไม่มี network request ไปที่ `script.google.com` เลย (ดูใน DevTools)
  7. Lighthouse mobile ตามวิธีวัดใน SPEC §9.6 (บล็อก tile ของแผนที่): LCP < 2.5 วินาที และ JS ของหน้า (ไม่รวม chunk ของ Leaflet) < 150 KB gzip
  8. footer ทุกหน้าของ Data Center แสดงวันที่ข้อมูลล่าสุดตรงกับ `meta.latest_date_com` และวันที่ดาวน์โหลดไฟล์ขอบเขตตาม `public/geo/README.md`

### F19 คลังรายงาน `/reports`

- **ทำ:** ตาม SPEC §9.3 · server component ส่ง `catalog.json` ให้ client component กรอง/ค้นหา/แบ่งหน้า · สถานะใน URL (`main`, `cat`, `q`, `page`, `size`) · ห่อ `useSearchParams` ด้วย `<Suspense>`
- **ขึ้นกับ:** F14, F16
- **ตรวจรับ:**
  1. `/reports?cat=4df36051…` เปิดมาเลือกหัวข้อวัคซีนและแสดง 8 รายงานใน 4 กลุ่ม เรียง กลุ่มอายุ 1 → 2 → 3 → 5 ปี และในกลุ่ม `s_epi1` มาก่อน fully immunized
  2. ค้นหา `s_epi_complete` → 4 รายงาน · ค้นหา "กลุ่มอายุ 2 ปี" → 2 รายงาน
  3. รายงานที่ยังไม่มี `years` แสดง "ยังไม่มีข้อมูล"
  4. กด back จากหน้ารายงานแล้วตัวกรองและหน้าเดิมยังอยู่ (มาจาก URL)
  5. หน้านี้ไม่มี network request ไปที่ `script.google.com`

### F20 หน้ารายงาน `/reports/[id]`

- **ทำ:** ตาม SPEC §9.4 ทั้งหมดสำหรับ `coverage` · `generateStaticParams` จาก `catalog.json` + `dynamicParams = false` · โครงหน้า pre-render จาก catalog ส่วนตัวเลขโหลด `/data/reports/{id}.json` ด้วย `client.ts` · กราฟ SVG 3 แบบใน `src/components/dc/charts/` · CSV · พิมพ์ (CSS `@media print`) · "เกี่ยวกับรายงานนี้" · รายงานที่เกี่ยวข้อง · fallback สำหรับ `report_type` อื่น
- **ขึ้นกับ:** F14, F15, F16
- **ตรวจรับ:**
  1. `out/reports/` มีไฟล์ HTML ครบตามจำนวนรายงานที่ใช้งาน และ `/reports/ไม่มีจริง` ได้ 404
  2. fully immunized 1 ปี ปี 2569 ทั้งอำเภอ: ค่า `T/R/pct` ตรงกับที่คำนวณจากชีตโดยตรง (สคริปต์หรือสูตรใน Sheets) และตรงกับ PA (`s_epi_complete__1y`)
  3. `s_epi2` เลือก measure `mmr1` → เกณฑ์แสดง 95 · เลือก `pcv4` → เกณฑ์ 90 (`goal`)
  4. `s_dental_0_5_cavity_free` ใช้ `b`/`a` และตัวเลือกช่วงเวลามีแค่ "ทั้งปี"
  5. `s_kpi_anc12` มีตัวเลือกไตรมาส และ `s_epi_complete` มีตัวเลือกเดือน ต.ค.–ก.ย.
  6. เปลี่ยนตัวกรองแล้ว URL เปลี่ยน และเปิด URL นั้นในแท็บใหม่ได้ผลเดียวกัน · เปลี่ยนตัวกรองไม่เกิด network request ใหม่ (JSON โหลดครั้งเดียว)
  7. CSV เปิดใน Excel แล้วภาษาไทยถูก (BOM) ค่าที่ขึ้นต้นด้วย `=` ถูกกันสูตร ชื่อไฟล์ตาม SPEC §9.4
  8. เปิดด้วย URL `?year=2560` (ปีที่ไม่มีข้อมูล) → แสดง "ไม่มีข้อมูลปี … ในระบบ" ไม่ใช่ 0%
  9. `report_type` ว่าง → แสดงข้อความยังไม่รองรับ พร้อมลิงก์ HDC ไม่ crash
  10. เปลี่ยนตัวกรองบนมือถือระดับกลาง → ผลขึ้นภายใน 100 ms (วัดด้วย Performance panel)

---

## Track E — Hosting

### F21 Cloudflare Pages + Deploy Hook

- **ทำ:** สร้างโปรเจกต์ต่อ repo ตาม SPEC §12.5 · ตั้ง env · ปิด preview · สร้าง Deploy Hook แล้วใส่ใน `settings.deploy_hook_url` · ใช้ `<project>.pages.dev` (D6)
- **ตรวจรับ:** ขั้น 11–12 ใน SPEC §13 · push ไป branch อื่นที่ไม่ใช่ `main` ไม่ทำให้เกิด deployment · ตั้งใจทำให้ prebuild ล้ม (เช่น env ผิด) แล้ว deploy ล้มโดยเว็บเดิมยังอยู่

### F22 หน้า stub บน GitHub Pages

- **ทำ:** `legacy-redirect/index.html` + `404.html` และแก้ `deploy.yml` ตาม SPEC §12.6
- **ตรวจรับ:** ขั้น 13 ใน SPEC §13 · ปิด JavaScript แล้วหน้า stub ยังมีลิงก์ไปโดเมนใหม่ · `deploy.yml` ไม่มีขั้น `npm`

---

## เฟส 2 — Track F: ประชากรทะเบียนราษฎรบนหน้าแรก

- spec issue คือ [#172](https://github.com/9GotStory/pa-dashboard/issues/172) (6 พ.ย. 2569) ticket F23–F29 เป็น sub-issue ของใบนี้ และ "ขึ้นกับ" เป็น blocking relationship ของ GitHub · ขอบเขตใน SPEC §2.3 และเหตุผลใน ADR-0011
- ขั้นตอนทำงานและกติกาโค้ดเหมือนเฟส 1 (ส่วน "กติกา" ข้างบน) · โค้ด GAS อยู่ในไฟล์ใหม่ `src/scripts/dc-population.js` · ไฟล์ห้ามแก้แก้ได้เฉพาะทางแยกใน `doGet`/`doPost` (SPEC §12.4) และการวาง component ในหน้า `/sync` (SPEC §12.1)
- ticket ฝั่งโค้ด (F24, F27) ไม่บันทึกกับ GAS จริง เพราะ GAS จริงมี action ใหม่หลัง deploy ในใบคนทำ (F25, F29) ซึ่งใช้ `/wizard` และ deploy ตาม `docs/agents/gas-deploy.md` (version ใหม่ของ deployment เดิม)
- F26 ต้องรอ F25 เพราะ CI รัน prebuild กับ GAS จริง ซึ่งต้องมี `?action=registry_population` ก่อน · หลังปิด F29 รัน `/retro` ของ Track F

| F | ชื่อ | ขึ้นกับ | issue |
|---|---|---|---|
| F23 | เอกสารเฟส 2: ประชากรทะเบียนราษฎรใน SPEC, SCHEMA และ FEATURES | — | #173 |
| F24 | อัปโหลดไฟล์ `stat_t` ในหน้า `/sync` (ประชากรและบ้าน) | F23 | #174 |
| F25 | deploy GAS และอัปโหลดประชากรย้อนหลัง 2564–2568 (คนทำ, `/wizard`) | F24 | #175 |
| F26 | ประชากรและบ้านบนหน้าแรก | F25 | #176 |
| F27 | อัปโหลดไฟล์อายุในหน้า `/sync` | F24 | #177 |
| F28 | พีระมิดประชากรบนหน้าแรก | F26 | #178 |
| F29 | deploy GAS อัปโหลดไฟล์อายุย้อนหลัง และตรวจตัวเลขทั้งหน้า (คนทำ, `/wizard`) | F27, F28 | #179 |

### F23 เอกสารเฟส 2

- **ทำ:** แก้ SPEC, SCHEMA และ FEATURES ให้ตรงกับ #172 และ ADR-0011 ใน branch `docs/phase2-population` ซึ่งมี ADR-0011 และหมวด "ประชากร" ของ GLOSSARY แล้ว รวมถึงจุดใน CODING_STANDARDS ที่โค้ดของเฟส 2 ต้องใช้ (ผู้ถือ script lock, component ที่เรียก GAS ได้, seam ของ `population.ts`) แล้ว PR เข้า `main` · งานเอกสารล้วน ไม่มีโค้ด
- **ตรวจรับ:**
  1. SPEC §2.3 เป็นขอบเขตเฟส 2 และแถว "ข้อมูลประชากรบนหน้าแรก" ใน §2.2 ชี้ไป §2.3 / ADR-0011
  2. SPEC §6.1 มีแถว `population.json`: เป้าหมาย < 100 KB เก็บแถวประชากรทุกปี และแถวอายุเฉพาะปีล่าสุดที่มีแถวประชากร
  3. SPEC §9.1 ไม่บอกว่าทุกตัวเลขมาจาก HDC และระบุว่าประชากรมาจากกรมการปกครอง · §9.2 อธิบายช่องสรุป แผงพื้นที่ ตาราง พีระมิด ป้าย และกรณีไม่มีข้อมูล
  4. SPEC §12.1 อนุญาตให้หน้า `/sync` วาง component อัปโหลดประชากรหลัง login · §12.4 อนุญาตทางแยกไป `save_registry_population` ใน `doPost` และ `registry_population` ใน `doGet`
  5. SCHEMA มีชีตใหม่ทั้งใน §1 และ §2.6–2.7 (คอลัมน์ ลำดับ ชนิด กติกาแทนที่ตาม `yymm`) สัญญา §3.8–3.9 `population.json` ใน §7 type ใน §9 และตัวเลขอ้างอิงปี 2568 ใน §11.4
  6. FEATURES มีส่วนนี้พร้อมเกณฑ์ตรวจรับของ F24–F29 ที่ตรงกับ issue และ "งานที่รอเฟส 2" ตัดเรื่องประชากรบนหน้าแรกออกแล้วเพิ่มรายชื่อหมู่บ้าน แนวโน้มหลายปี และความเคลื่อนไหวประชากร
  7. `npm run lint` ผ่าน (รวมการตรวจคำที่ GLOSSARY ให้เลี่ยง) และ PR merge แล้ว

### F24 อัปโหลดไฟล์ `stat_t` ในหน้า `/sync` (ประชากรและบ้าน)

- **ทำ:**
  - `src/lib/dc/population.ts`: อ่านและตรวจ `stat_t` ตาม SCHEMA §11.1–11.2 · เทสต์ `population.test.ts` กับ fixture ใน `src/lib/dc/fixtures/` ที่ตัดจากไฟล์จริงปี 2568: BOM, บรรทัดทั้งประเทศ, บรรทัดจังหวัด, บรรทัดของอำเภอสองและเทศบาลตำบลสอง และบรรทัดของอำเภออื่นและเทศบาลอื่น
  - `src/components/dc/RegistryPopulationUpload.tsx` วางในหน้า `/sync` หลัง login (SPEC §12.1): ส่วน "ประชากรทะเบียนราษฎร (กรมการปกครอง)" มีคำแนะนำ ลิงก์ stat.bora และปีที่มีในชีตแล้ว · อ่าน `district_code` จาก `/data/catalog.json` (SCHEMA §11.2) จึงตรวจไฟล์ได้ก่อน GAS จริงมี action ใหม่ · เลือก `stat_t{yy}.txt` ได้หลายไฟล์ ผ่านแล้วแสดงสรุปก่อนบันทึกต่อปี (ปี, จำนวนแถว, ยอดรวม) · ยืนยันแล้ว POST `kind: population` ทีละปี ตอนจบ POST `rebuild` ครั้งเดียวถ้ามีปีใดสำเร็จ แล้วแสดงผลรายไฟล์กับผลของ `rebuild`
  - GAS `src/scripts/dc-population.js`: POST `save_registry_population` ตาม SCHEMA §3.8 ใบนี้รับเฉพาะ `kind: population` (`age` ตอบ `Unknown kind` จนถึง F27) และ GET `?action=registry_population` ตาม §3.9 ซึ่งคืนแถวของทั้งสองชีตแล้ว · `รหัส.js` เพิ่มเฉพาะทางแยกใน `doGet`/`doPost` · เทสต์ใน `src/scripts/test/`
  - ไม่บันทึกกับ GAS จริง (GAS จริงมี action นี้หลัง F25)
- **ขึ้นกับ:** F23 (SPEC §12.1, §12.4 ต้องอนุญาตการแก้ไฟล์ห้ามแก้ก่อน)
- **ตรวจรับ:**
  1. ในเครื่อง เลือก `stat_t68.txt` จริงจาก stat.bora แล้วสรุปก่อนบันทึกแสดงปี 2568 จำนวน 10 แถว รวม 46,527 คน (ชาย 22,475 หญิง 24,052) และบ้าน 20,101 (ไม่ต้องกดบันทึก)
  2. ไฟล์ที่ผิดข้อใดข้อหนึ่งต่อไปนี้ถูกปฏิเสธพร้อมเหตุผลภาษาไทย และไม่มีคำขอไป GAS: ไม่มีแถวของ `district_code` · `yymm` ไม่ใช่เดือน 12 หรือไม่เท่ากันทั้งไฟล์ · ผลรวมแถวตำบลไม่เท่าแถวยอดรวมของสำนักทะเบียน
  3. harness `node:vm`: `kind: population` บันทึก 10 แถวตรงตามที่ส่ง สร้างชีตพร้อม header ครั้งแรก และอัปโหลด `yymm` เดิมซ้ำแทนที่เฉพาะปีนั้นโดยปีอื่นไม่เปลี่ยน · stub `LockService` นับว่าถูกถือครั้งเดียวต่อคำขอ
  4. harness: คำขอที่ผิดกฎข้อ 1–10 ในตาราง SCHEMA §3.8 (รวม `yymm` ของปีที่ยังไม่สิ้นสุด) ได้ error ตามข้อความในตาราง โดยไม่มีการเขียนชีต (ข้อ 11–14 อยู่ใน F27) และไม่มีคำขอใดเขียนชีตอื่นนอกจาก `registry_population` ได้ แม้คำขอจะใส่ชื่อชีตหรือ `tableName` มา
  5. harness: GET คืนปีที่มีเรียงตามปี คืน `{ years: [] }` เมื่อยังไม่มีชีต และตอบ `Busy` เมื่อ lock ถูกถือ
  6. `node:test`: ฟังก์ชันอ่านและตรวจ `stat_t` ใช้ fixture ที่ตัดจากไฟล์จริงปี 2568 ได้แก่ BOM, แถวทั้งประเทศ, แถวอำเภอสองและเทศบาลตำบลสอง และแถวอำเภออื่น ค่าคาดหวังมาจากแถวยอดรวมในไฟล์ (`5406` 40,389 และ `5489` 6,138) และยอดที่จังหวัดประกาศ (SCHEMA §11.4)
  7. PA ไม่เปลี่ยน: เทสต์เดิมผ่านทั้งหมด และชีตใหม่ไม่อยู่ใน PA units, sync units หรือ `BATCH_ALL`
  8. `npm run lint`, `npm test`, `npm run build` และ `npm run dc:budget` ผ่าน

### F25 deploy GAS และอัปโหลดประชากรย้อนหลัง 2564–2568 (คนทำ, `/wizard`)

- **ทำ:** ทีละขั้นด้วย `/wizard` และบันทึกผลใน issue: (1) deploy GAS ของ F24 ตาม `docs/agents/gas-deploy.md`: `npm run gas:sync` จาก `main` ซึ่ง push แล้ว redeploy deployment เดิมเป็น version ใหม่ (`gas:deploy` อย่างเดียวไม่ push โค้ดใหม่) ห้ามสร้าง deployment ใหม่ เพราะ PA ฝัง URL ของ web app ไว้ (2) ตรวจว่า PA เหมือนเดิมทั้งก่อนและหลัง deploy (3) ดาวน์โหลด `stat_t64`–`stat_t68` จาก stat.bora แล้วอัปโหลดในหน้า `/sync` ในรอบเดียว
- **ขึ้นกับ:** F24 · ใบนี้ทำให้ GAS จริงมี `?action=registry_population` และข้อมูลจริง ซึ่ง prebuild ของ F26 ต้องใช้
- **ตรวจรับ:**
  1. deploy เป็น version ใหม่ของ deployment เดิม URL ไม่เปลี่ยน และบันทึกเลข version กับวิธี rollback ใน issue
  2. PA ก่อนและหลัง deploy เหมือนกัน (`pa:snapshot` แล้ว `pa:compare`)
  3. อัปโหลด `stat_t` ปี 2564–2568 ครบ 5 ปีในรอบเดียว `rebuild` ถูกสั่งครั้งเดียว และส่วนอัปโหลดแสดงครบ 5 ปีในรายการปีที่มีแล้ว
  4. ชีต `registry_population` มี 50 แถว (ปีละ 10 แถว) สุ่มตรวจอย่างน้อยปีละ 1 แถวเทียบไฟล์ต้นทางแล้วตรงทุกคอลัมน์
  5. ยอดรวมรายปีตรงกับไฟล์ต้นทาง: 2564 = 48,645 · 2565 = 48,175 · 2566 = 47,636 · 2567 = 47,053 · 2568 = 46,527 (บ้าน 20,101)
  6. GET `?action=registry_population` บน GAS จริงคืนครบ 5 ปี

### F26 ประชากรและบ้านบนหน้าแรก

- **ทำ:**
  - prebuild (`build-snapshot.mjs`): GET `?action=registry_population` ด้วยกติกา retry และ `Busy` เดิม แล้วเขียน `population.json` ตาม SCHEMA §7 (แถวประชากรทุกปี แถวอายุเฉพาะปีล่าสุดที่มีแถวประชากร) · ไม่มีข้อมูลไม่ล้ม · ล้มดัง ๆ เมื่อ GET ล้มหรือคำตอบผิดรูป · ตรวจขนาดตาม SPEC §6.1
  - `snapshot.ts` อ่าน `population.json` · `population.ts` คำนวณปีที่แสดง ยอดรายตำบล และยอดทั้งอำเภอตาม SCHEMA §11.3 · type ตาม SCHEMA §9
  - หน้าแรกตาม SPEC §9.2 (server component อ่าน snapshot ตอน build แล้วส่งค่าที่คำนวณแล้วให้ client): ช่องสรุป 4 ช่องพร้อมป้าย "ทะเบียนราษฎร ณ 31 ธ.ค. {ปี} · กรมการปกครอง" · แผงพื้นที่เพิ่มประชากร ชาย/หญิง และบ้าน ทั้งภาพรวมอำเภอและตำบล · ตารางรายตำบล (ลำดับ ตำบล ชาย หญิง รวม บ้าน และปุ่ม "ดูข้อมูล") มี `<caption>` และแถวรวมทั้งอำเภอ บนมือถือเป็นรายการแบบกดขยาย · แผนที่ ปุ่มตำบล และปุ่ม "ดูข้อมูล" ใช้พื้นที่ที่เลือกร่วมกัน · ที่มาของข้อมูลเพิ่มกรมการปกครอง (stat.bora) · ไม่มีข้อมูล → เหมือนเฟส 1
- **ขึ้นกับ:** F25 (CI รัน prebuild กับ GAS จริง)
- **ตรวจรับ:**
  1. หลัง F25 รัน `npm run build` แล้วหน้าแรกแสดง 46,527 คน (ชาย 22,475 หญิง 24,052) พร้อมป้าย "ทะเบียนราษฎร ณ 31 ธ.ค. 2568 · กรมการปกครอง"
  2. ตารางรายตำบลรวมส่วนเทศบาลแล้ว: บ้านหนุน 7,399 คน 3,499 บ้าน (4,536 + 2,863 คนตามไฟล์) · บ้านกลาง 6,686 คน 3,335 บ้าน (3,411 + 3,275) · แถวรวมทั้งอำเภอ 46,527 คน 20,101 บ้าน
  3. กด "ดูข้อมูล" ของตำบลใดแล้วแผนที่และแผงพื้นที่เลือกตำบลนั้น แผงแสดงประชากร ชาย/หญิง และบ้านของตำบล และ "ดูภาพรวมอำเภอ" กลับไปที่ยอดอำเภอ
  4. ที่ความกว้าง 360px ตารางเป็นรายการแบบกดขยาย หน้าไม่ scroll แนวนอน และ `npm run dc:check` ผ่าน
  5. `population.json` ไม่มีปี → หน้าแรกเหมือนเฟส 1 (ไม่มีช่องประชากรและตาราง) และ build ไม่ล้ม
  6. prebuild กับ stub server: มีข้อมูล · ไม่มีข้อมูล (ไม่ล้ม) · `Busy` แล้วสำเร็จ · error, คำตอบผิดรูป และไฟล์เกินเป้า (exit 1 ทุกกรณี) · การเลือกแถวอายุเฉพาะปีล่าสุดที่มีแถวประชากร
  7. `node:test`: การคำนวณรายตำบล ยอดอำเภอ และปีที่แสดง ใช้แถวจริงปี 2568 และค่าคาดหวังจากแถวยอดรวมในไฟล์กับยอดที่จังหวัดประกาศ (SCHEMA §11.4)
  8. หน้าแรกไม่มี network request ไป `script.google.com` และ JavaScript ของหน้า < 150 KB gzip
  9. `npm run lint`, `npm test`, `npm run build` และ `npm run dc:budget` ผ่าน

### F27 อัปโหลดไฟล์อายุในหน้า `/sync`

- **ทำ:**
  - `population.ts`: อ่านไฟล์อายุ อ่านปีและจังหวัดจากชื่อไฟล์ (อ่านได้แม้เบราว์เซอร์เติมเลขต่อท้ายชื่อ) จับคู่บล็อกกับสำนักทะเบียนและจับคู่ชื่อตำบลภายในบล็อก ตรวจยอดข้ามไฟล์ทั้งระดับตำบลและระดับบล็อก และสูตรของ stat.bora แยกชายหญิง ตาม SCHEMA §11.1–11.2 · fixture เพิ่มบรรทัดจริงปี 2568 ของบล็อกอำเภอสองและเทศบาลตำบลสอง และบล็อกที่มี "ตำบลน้ำชำ" ทั้งในอำเภอเมืองแพร่และอำเภอสูงเม่น
  - ส่วนอัปโหลด: รับไฟล์อายุคู่กับ `stat_t` ของปีเดียวกันในชุดเดียวกัน แสดงสรุปก่อนบันทึก แล้วบันทึก `population` ก่อน `age` ของปีเดียวกัน
  - GAS: `save_registry_population` รับ `kind: age` ตาม SCHEMA §3.8 (ข้อ 10–13) แล้วเขียน `registry_population_age` แทนที่เฉพาะ `yymm` · `kind: population` ตรวจข้อ 14 · GET ของ F24 คืนแถวอายุโดยไม่ต้องแก้
  - ไม่บันทึกกับ GAS จริง (F29)
- **ขึ้นกับ:** F24
- **ตรวจรับ:**
  1. ในเครื่อง เลือก `stat_t68.txt` กับ `6812cc54.txt` จริงพร้อมกัน แล้วสรุปก่อนบันทึกแสดงปี 2568 มีแถวอายุครบ 10 แถวที่จับคู่ได้ และยอดตรงกับ `stat_t` (ไม่ต้องกดบันทึก)
  2. กรณีต่อไปนี้ถูกปฏิเสธพร้อมเหตุผลภาษาไทย และไม่มีคำขอไป GAS: ไฟล์อายุที่ไม่มี `stat_t` ของปีเดียวกันในชุดที่เลือก · ไฟล์ของจังหวัดอื่น · ชื่อไฟล์ที่อ่านปีไม่ได้หรือไม่ใช่เดือน 12 · ยอดไม่ตรงกับ `stat_t`
  3. `node:test`: การอ่านไฟล์อายุ การจับคู่บล็อกและชื่อตำบล (รวม "ตำบลน้ำชำ" ที่ซ้ำในเมืองแพร่และสูงเม่น) และการตรวจยอดข้ามไฟล์ ใช้ fixture ที่ตัดจากไฟล์จริงปี 2568
  4. harness `node:vm`: `kind: age` บันทึกและแทนที่เฉพาะ `yymm` สร้างชีตพร้อม header ครั้งแรก และปฏิเสธเมื่อไม่มีแถว `population` ของปีนั้น, ชุดตำบลต่างกัน และยอดไม่ตรง · กฎข้ออื่นของ `age` ใน SCHEMA §3.8 ได้ error ตามข้อความในตาราง
  5. harness: `kind: population` ปฏิเสธเมื่อยอดไม่ตรงกับแถวอายุที่มีอยู่ และ GET คืนแถวอายุของปีที่มี
  6. PA ไม่เปลี่ยน และ `npm run lint`, `npm test`, `npm run build`, `npm run dc:budget` ผ่าน

### F28 พีระมิดประชากรบนหน้าแรก

- **ทำ:** ตาม SPEC §9.2 ใต้ตารางรายตำบล พีระมิดของพื้นที่ที่เลือก (ไม่เลือก = ทั้งอำเภอ): 17 ช่วงอายุ ชายซ้าย หญิงขวา SVG ไม่เพิ่มไลบรารี มี `role="img"` และ `aria-label` · หัวบอกพื้นที่ ปี และจำนวนกับร้อยละอายุ 60 ปีขึ้นไป · ใต้พีระมิดบอกประชากรที่ไม่แยกอายุแยกตามประเภท · `population.ts` คำนวณช่วงอายุ อายุ 60 ปีขึ้นไป และประชากรที่ไม่แยกอายุต่อพื้นที่ตาม SCHEMA §11.3 จากแถวอายุใน `population.json` ซึ่งเป็นปีเดียวกับตาราง · ปีล่าสุดไม่มีแถวอายุ → ซ่อนเฉพาะพีระมิด · ก่อน F29 ชีตจริงยังไม่มีแถวอายุ จึงตรวจหน้าเว็บด้วย `population.json` ที่ทำจาก fixture: วางทับใน `public/data/` หลัง prebuild แล้ว `npx next build` ซึ่งไม่ดึง snapshot ซ้ำ
- **ขึ้นกับ:** F26
- **ตรวจรับ:**
  1. ด้วย snapshot ที่มีแถวอายุปี 2568 (fixture หรือหลัง F29) พีระมิดของอำเภอแสดง 17 ช่วงอายุ อายุ 60 ปีขึ้นไป 13,487 คน และใต้พีระมิดบอกว่าไม่รวม 165 คน (ไม่ใช่สัญชาติไทย 81 · ทะเบียนบ้านกลาง 75 · ระหว่างการย้าย 9)
  2. เลือกตำบลจากแผนที่ ปุ่มตำบล หรือ "ดูข้อมูล" แล้วพีระมิดเปลี่ยนเป็นของตำบลนั้น และ "ดูภาพรวมอำเภอ" กลับเป็นของอำเภอ
  3. ปีล่าสุดไม่มีแถวอายุ → ซ่อนเฉพาะพีระมิด ส่วนตารางและช่องสรุปยังอยู่
  4. `node:test`: ช่วงอายุ อายุ 60 ปีขึ้นไป และประชากรที่ไม่แยกอายุ ของอำเภอและตำบล ใช้แถวจริงปี 2568 และค่าคาดหวังจากตัวเลขอ้างอิงใน SCHEMA §11.4 กับคอลัมน์ท้ายแถวและยอดรวมในไฟล์
  5. `npm run dc:check` ผ่าน (พีระมิดมี `role="img"` + `aria-label` และหน้าไม่ scroll แนวนอนที่ 360px) และ `npm run dc:budget` ผ่าน
  6. `npm run lint`, `npm test` และ `npm run build` ผ่าน

### F29 deploy GAS อัปโหลดไฟล์อายุย้อนหลัง และตรวจตัวเลขทั้งหน้า (คนทำ, `/wizard`)

- **ทำ:** ทีละขั้นด้วย `/wizard` และบันทึกผลใน issue: (1) deploy GAS ของ F27 ตาม `docs/agents/gas-deploy.md` (`npm run gas:sync` จาก `main` เป็น version ใหม่ของ deployment เดิม) ห้ามสร้าง deployment ใหม่ (2) ตรวจว่า PA เหมือนเดิมทั้งก่อนและหลัง deploy (3) ดาวน์โหลดไฟล์อายุ `{yy}12cc54.txt` ปี 2564–2568 จาก stat.bora แล้วอัปโหลดในหน้า `/sync` โดยเลือกคู่กับ `stat_t` ของปีเดียวกัน (แถวประชากรถูกแทนที่ด้วยตัวเลขเดิม) (4) ตรวจหน้าแรกบนเว็บจริงทั้งหน้า
- **ขึ้นกับ:** F27, F28
- **ตรวจรับ:**
  1. deploy เป็น version ใหม่ของ deployment เดิม URL ไม่เปลี่ยน และบันทึกเลข version กับวิธี rollback ใน issue
  2. PA ก่อนและหลัง deploy เหมือนกัน (`pa:snapshot` แล้ว `pa:compare`)
  3. อัปโหลดไฟล์อายุปี 2564–2568 ครบ `rebuild` ถูกสั่งครั้งเดียว และชีต `registry_population_age` มี 50 แถว
  4. บน https://songhealth-dc.pages.dev/ : ยอดรวม 46,527 ตรงกับยอดที่จังหวัดประกาศ · ตารางรายตำบลตรงกับ stat.bora (บวกส่วนเทศบาลแล้ว) · พีระมิดของอำเภอแสดงอายุ 60 ปีขึ้นไป 13,487 คน และไม่รวม 165 คน
  5. สำหรับอำเภอและอย่างน้อย 2 ตำบล (รวมบ้านหนุน) ผลรวมของพีระมิด + ประชากรที่ไม่แยกอายุ = ยอดรวมของพื้นที่นั้น
  6. Lighthouse mobile ตามวิธีใน SPEC §9.6 ได้ LCP < 2.5 วินาที
  7. issue นี้มีบันทึกผลครบทุกข้อ

---

## Track G: หน้าแรกตาม V7.6

- ไม่มี spec issue: เหตุผลอยู่ใน ADR-0012 ขอบเขตใน SPEC §2.4 และสัญญาของหน้าใน SPEC §9.1–9.2 · `docs/reference/v7-6/design.md` เป็นแบบอ้างอิงด้านหน้าตา เมื่อขัดกับ SPEC ให้ถือ SPEC · ticket F30–F37 มี "ขึ้นกับ" เป็น blocking relationship ของ GitHub
- ขั้นตอนทำงานและกติกาโค้ดเหมือนเฟส 1 (ส่วน "กติกา" ข้างบน) · ทุกใบเป็นงาน frontend ไม่แตะ GAS ไฟล์ snapshot type ใน SCHEMA §9 และไฟล์ PA · ใบโค้ด (F31–F36) ผ่านด่านเดิมทุกใบ: `npm run lint`, `npm test`, `npm run build`, `npm run dc:budget` และ `npm run dc:check` · ใบที่เปลี่ยน JavaScript หรือส่วนบนของหน้าแรก (F32–F35) วัด LCP บนเครื่องเทียบกับ `main` ตาม SPEC §9.6 · ใบที่แก้ `dc:check` แก้คำอธิบายใน CODING_STANDARDS §5 ใน PR เดียวกัน
- `main` ขึ้นเว็บทุกครั้งที่ merge ระหว่าง Track หน้าแรกจึงมีทั้งส่วนใหม่และส่วนที่ยังเป็นแบบเดิมได้ แต่ทุกส่วนต้องใช้งานได้และผ่าน `dc:check` · ส่วนที่ใบใดแก้ใช้แต่ token ชื่อใหม่ (SPEC §9.1)
- ลำดับ: F31 ก่อน → F32 กับ F33 ทำคู่ขนานได้ → F34 และ F35 หลัง F33 ทำทีละใบ ไม่คู่ขนาน เพราะแก้ `DistrictExplorer.tsx` เดียวกัน (GitHub ไม่มี relation ระหว่าง #202 กับ #203 ให้เริ่มใบที่สองหลังใบแรก merge) → F36 หลัง F32 → F37 หลังทุกใบ · หลังปิด F37 รัน `/retro` ของ Track G

| F | ชื่อ | ขึ้นกับ | issue |
|---|---|---|---|
| F30 | เอกสาร Track G: หน้าแรกตาม V7.6 ใน SPEC และ FEATURES | — | #198 |
| F31 | design token และกรอบหน้าตาม V7.6 | F30 | #199 |
| F32 | Hero และภาพรวมประชากรบนหน้าแรก | F31 | #200 |
| F33 | ข้อมูลพื้นที่: แผนที่ ตัวเลือกตำบล และหน่วยบริการตามตำบลที่ตั้ง | F31 | #201 |
| F34 | เปรียบเทียบประชากรรายตำบล: กราฟแท่งและตาราง | F33 | #202 |
| F35 | โครงสร้างประชากร: พีระมิดและสรุปอายุ 60 ปีขึ้นไป | F33 | #203 |
| F36 | รายงานตามหัวข้อและที่มาของข้อมูลบนหน้าแรก | F32 | #204 |
| F37 | ตรวจรับหน้าแรกตาม V7.6 บนเว็บจริง | F32, F34, F35, F36 | #205 |

### F30 เอกสาร Track G

- **ทำ:** ใน branch `docs/v7-6-design` ซึ่งมีต้นแบบ V7.6 ใน `docs/reference/v7-6/`, ADR-0012, GLOSSARY (V7.6, ตำบลที่ตั้ง, R6) และบรรทัดใน Docs map ของ CLAUDE.md แล้ว: SPEC §2.4 (ขอบเขต), §9.1–9.2 (สัญญาของกรอบหน้าและหน้าแรก จุดที่ต่างจาก design.md), §9.6 (วัด LCP ก่อนขึ้นเว็บ), D11 · ส่วนนี้ของ FEATURES · กติกาสีและ icon ใน CODING_STANDARDS §4 · แล้ว PR เข้า `main` · งานเอกสารล้วน ไม่มีโค้ด
- **ตรวจรับ:**
  1. SPEC มีขอบเขต Track G และ §9.1–9.2 ตรงกับ ADR-0012 ทุกข้อ ไม่ขัดกับ GLOSSARY
  2. SPEC ระบุว่า §9.1–9.2 เป็นสัญญาของหน้าแรก design.md เป็นแบบอ้างอิงด้านหน้าตา และระบุจุดที่ต่างจาก design.md
  3. FEATURES มีส่วน Track G ดัชนี F30–F37 พร้อมเลข issue และเกณฑ์ตรวจรับที่ทดสอบได้ของ F31–F37
  4. การตรวจรับใช้ด่านเดิม (`npm test`, `lint`, `build`, `dc:budget`, `dc:check`, LCP ตาม SPEC §9.6) และ `dc:check` ตรวจ horizontal overflow ของหน้าแรกที่ 320, 390, 768, 1440 และ 1920px (F31)
  5. `npm run lint` ผ่าน (ไม่มีวลีที่ GLOSSARY ให้เลี่ยง) และ PR merge แล้ว

### F31 design token และกรอบหน้าตาม V7.6

- **ทำ:**
  - `globals.css`: token ชื่อใหม่ 12 ตัวตาม SPEC §9.1 ปรับค่าที่ไม่ผ่าน WCAG AA · ชื่อเก่าของ R6 ชี้ไปที่ token ใหม่ที่ใกล้ที่สุด พร้อม comment ว่าเป็นขั้นขยายของ ADR-0012 · ตัดสิน `dc-gold` และ `dc-teal` เป็นรายตัวแล้วบันทึกเหตุผลใน PR · วงแหวน focus เป็น `dc-brand-accent`
  - `Masthead.tsx`, `MainNav.tsx` และ `Footer.tsx` ตาม SPEC §9.1 ใช้แต่ชื่อใหม่ · layout ของ `(dc)` กว้างไม่เกิน 1320px และพื้นหน้าเป็น `dc-canvas` · วันที่ดาวน์โหลดขอบเขตตำบลออกจาก Footer ไปอยู่บรรทัดขอบเขตตำบลในส่วนที่มาของข้อมูลของหน้าแรก (วันที่ข้อมูล HDC ยังอยู่ในป้ายหัวหน้าจนถึง F32) และ `public/geo/README.md` ชี้ไปที่ใหม่ของค่านี้
  - `dc-check.mjs`: เปิดหน้าแรกเพิ่มที่ความกว้าง 320, 390, 768, 1440 และ 1920px แล้ว exit 1 พร้อมความกว้างเมื่อหน้า scroll แนวนอน (กฎอื่นยังตรวจที่ 360px)
- **ขึ้นกับ:** F30
- **ตรวจรับ:**
  1. `/`, `/reports` และ `/reports/{id}` เป็นโทนเขียว · diff ไม่มีไฟล์ของ `/reports` และ `/reports/{id}` (`src/app/(dc)/reports/`, `ReportLibrary.tsx`, `CoverageReport.tsx`, `src/components/dc/charts/`) และโครงหน้า ข้อความ และพฤติกรรมของสองหน้านี้เหมือนเดิม ยกเว้น Masthead และ Footer
  2. ทุกคู่สีข้อความกับพื้นที่ใช้จริงผ่าน WCAG AA และแท่ง `dc-pyramid-male` / `dc-pyramid-female` ได้อย่างน้อย 3:1 กับพื้น (บันทึกอัตราส่วนใน PR)
  3. Masthead sticky เป็นแถบขาวแถบเดียว มี 3 ลิงก์ `aria-current` ถูกต้องเหมือนเดิม เป้ากดสูงอย่างน้อย 44px ไม่มีเมนู anchor หรือแฮมเบอร์เกอร์ และที่ 320px ลิงก์ทั้งสามมองเห็นโดยไม่ต้องกดอะไร
  4. Footer ทุกหน้ามีแค่ชื่อเว็บกับหน่วยงาน · ส่วนที่มาของข้อมูลของหน้าแรกมีวันที่ดาวน์โหลดขอบเขตตำบลตรงกับ `public/geo/README.md`
  5. หน้าพิมพ์ของ `/reports/{id}` (print preview) มีชื่อเว็บ ไม่มีเมนู และ Masthead ไม่ทับเนื้อหา
  6. `npm run dc:check` ผ่าน และล้ม (exit 1 พร้อมความกว้าง) เมื่อจงใจให้ส่วนหนึ่งของหน้าแรกกว้างเกินจอที่ 320px แล้วคืนโค้ดกลับ
  7. `/pa` และ `/sync` หน้าตาไม่เปลี่ยน: diff ไม่มีไฟล์ PA และ `globals.css` เปลี่ยนเฉพาะ token `dc-*` และกฎ focus ของ `.dc`
  8. `npm run lint`, `npm test`, `npm run build` และ `npm run dc:budget` ผ่าน

### F32 Hero และภาพรวมประชากรบนหน้าแรก

- **ทำ:** ส่วน Hero และภาพรวมประชากรตาม SPEC §9.2 แทนหัวเรื่อง "ข้อมูลพื้นฐานอำเภอสอง" ป้ายวันที่ข้อมูลล่าสุด และช่องสรุปเดิม · วันที่ข้อมูล HDC ย้ายไปบรรทัด HDC Open Data ในส่วนที่มาของข้อมูล · ส่วนข้อมูลพื้นที่และส่วนประชากรรายตำบลมี `id` และ `scroll-margin-top` ให้ปุ่มและลิงก์ของ Hero (F34 คง `id` ของส่วนเปรียบเทียบไว้) · `dc:check` เทียบตัวเลขของภาพรวมประชากรแทนช่องสรุป
- **ขึ้นกับ:** F31
- **ตรวจรับ:**
  1. Hero มีปุ่มเต็มปุ่มเดียว "สำรวจข้อมูลพื้นที่" และลิงก์ข้อความ "เปรียบเทียบประชากร" ทั้งสองพาไปยังส่วนที่ถูกต้อง หัวเรื่องของส่วนปลายทางไม่ถูก Masthead บัง และเมื่อตั้ง `prefers-reduced-motion` หน้าไม่เลื่อนแบบนุ่มนวล
  2. ที่ 320 × 568px และ 390 × 844px หัวเรื่องและปุ่มของ Hero อยู่ในจอแรกโดยไม่ต้องเลื่อน
  3. ภาพรวมประชากรแสดงตัวเลขจาก `population.json` ปีล่าสุด (ปี 2568: 46,527 คน ชาย 22,475 หญิง 24,052 และ 8 ตำบล) พร้อมป้าย "ทะเบียนราษฎร ณ 31 ธ.ค. 2568 · กรมการปกครอง" ครั้งเดียวในส่วนนี้ ไม่มีคำว่า KPI และไม่มีตัวเลขใดเป็นปุ่มหรือลิงก์
  4. วันที่ข้อมูล HDC แสดงครั้งเดียวบนหน้า ในส่วนที่มาของข้อมูล
  5. `population.json` ไม่มีปี (วางทับใน `public/data/` แล้ว `npx next build`) → มี Hero แต่ไม่มีลิงก์รองและแถบประชากร มีเขตการปกครอง 8 ตำบล และ build ไม่ล้ม
  6. LCP ของหน้าแรกวัดบนเครื่องเทียบกับ `main` ตาม SPEC §9.6: ค่ากลางของ branch ช้ากว่าของ `main` ไม่เกิน 10% และบันทึกค่ากลางของทั้งสองใน PR
  7. `npm run dc:check` ผ่านที่ทุกความกว้าง และล้ม (exit 1 พร้อมชื่อพื้นที่) เมื่อจงใจให้ตัวเลขในภาพรวมประชากรไม่ตรงกับแถวรวมทั้งอำเภอ แล้วคืนโค้ดกลับ
  8. `npm run lint`, `npm test`, `npm run build` และ `npm run dc:budget` ผ่าน

### F33 ข้อมูลพื้นที่: แผนที่ ตัวเลือกตำบล และหน่วยบริการตามตำบลที่ตั้ง

- **ทำ:** ส่วนข้อมูลพื้นที่ตาม SPEC §9.2: สี polygon จาก token · `<select>` แทนแถวปุ่มตำบล · ปุ่มข้อความ "ล้างการเลือก" แทน "ดูภาพรวมอำเภอ" · แผงตำบลแบบแถวเรียบ ใช้คำว่า "ตั้งอยู่ใน" · ตำบลที่เลือกเป็นค่ากลางค่าเดียวเป็นรหัสตำบล (SPEC §9.2 "ตำบลที่เลือก") ตารางและพีระมิดที่ยังเป็นแบบเดิมอ่านค่านี้ และปุ่ม "ดูข้อมูล" ของตารางเดิมยังตั้งค่านี้ได้จนถึง F34 · `dc:check` เลือกตำบลด้วย `<select>` แทนปุ่ม
- **ขึ้นกับ:** F31
- **ตรวจรับ:**
  1. เลือกตำบลจาก polygon หรือ `<select>` แล้วทั้งสองตรงกัน แผงแสดงชื่อตำบล ประชากร ชาย/หญิง และบ้านของตำบลนั้นจาก `population.json` และหน่วยบริการที่ `tambon_id` เป็นตำบลนั้นใน `catalog.json` ของ build (เช่น บ้านหนุน `540601`)
  2. ไม่เลือกตำบล → แผงแสดงยอดทั้งอำเภอ 8 ตำบล และจำนวนหน่วยบริการเท่ากับใน `catalog.json` ไม่แสดงรายชื่อหน่วยบริการทั้งอำเภอ · แผงไม่มีคำว่า "รับผิดชอบ"
  3. "ล้างการเลือก" กลับเป็นทั้งอำเภอทุกส่วนที่ตามตำบลที่เลือก (แผง แผนที่ `<select>` ตาราง และพีระมิด)
  4. บล็อก `tile.openstreetmap.org` และ `/geo/song-tambon.geojson` → `<select>` ยังเลือกตำบลได้ และแผงเปลี่ยนตาม
  5. polygon ใช้คีย์บอร์ดได้และมีชื่อที่อ่านได้ด้วย screen reader เหมือนเดิม
  6. `npm run dc:check` (แก้ให้ตรงกับ `<select>` แทนปุ่มตำบล) ผ่าน และ `npm run dc:budget` ผ่าน
  7. LCP ของหน้าแรกวัดบนเครื่องเทียบกับ `main` ตาม SPEC §9.6 ผ่าน และบันทึกค่ากลางใน PR
  8. `npm run lint`, `npm test` และ `npm run build` ผ่าน

### F34 เปรียบเทียบประชากรรายตำบล: กราฟแท่งและตาราง

- **ทำ:** ส่วนเปรียบเทียบตาม SPEC §9.2 แทนตารางประชากรรายตำบลและรายการแบบกดขยายเดิม · กราฟแท่งแนวนอนวาดด้วย SVG หรือ HTML ไม่เพิ่มไลบรารี · segmented control กราฟ ↔ ตาราง และตัวเรียง · กดแท่งหรือแถวแล้วตั้งตำบลที่เลือกของ F33 · `dc:check` เทียบตัวเลขข้างแท่งกับตารางด้วย
- **ขึ้นกับ:** F33
- **ตรวจรับ:**
  1. กราฟและตารางแสดงยอดรายตำบลที่รวมส่วนเทศบาลแล้ว (ปี 2568: บ้านหนุน 7,399 คน 3,499 บ้าน · บ้านกลาง 6,686 คน 3,335 บ้าน · แถวรวมทั้งอำเภอ 46,527 คน 20,101 บ้าน) และตารางมี `<caption>`
  2. ค่าเริ่มต้นเป็นกราฟเรียงตามรหัสตำบล · เรียงตามจำนวนประชากรได้ เตาปูน · ห้วยหม้าย · บ้านหนุน · บ้านกลาง · หัวเมือง · สะเอียบ · ทุ่งน้าว · แดนชุมพล (ปี 2568) · กราฟกับตารางแสดงทีละแบบ
  3. กดแท่ง แถว `<select>` หรือ polygon แล้วทุกส่วนเลือกตำบลเดียวกัน ส่วนที่เลือกเด่นขึ้นในกราฟและตาราง และ "ล้างการเลือก" กลับเป็นทั้งอำเภอ
  4. ตัวสลับและตัวเรียงบอกสถานะด้วย `aria-pressed` หรือเทียบเท่า และใช้คีย์บอร์ดได้
  5. ที่ 320px ตารางเลื่อนแนวนอนภายในกรอบของมันพร้อมข้อความบอกว่าเลื่อนได้ หน้าไม่ scroll แนวนอน
  6. `npm run dc:check` (แก้ให้ตรงกับกราฟและตารางใหม่) ผ่าน และล้ม (exit 1 พร้อมชื่อพื้นที่) เมื่อจงใจให้ตัวเลขข้างแท่งของตำบลหนึ่งไม่ตรงกับตาราง แล้วคืนโค้ดกลับ
  7. `npm run dc:budget`, `npm run lint`, `npm test` และ `npm run build` ผ่าน
  8. LCP ของหน้าแรกวัดบนเครื่องเทียบกับ `main` ตาม SPEC §9.6 ผ่าน และบันทึกค่ากลางใน PR

### F35 โครงสร้างประชากร: พีระมิดและสรุปอายุ 60 ปีขึ้นไป

- **ทำ:** ส่วนโครงสร้างประชากรตาม SPEC §9.2 แทนพีระมิด SVG เดิม: แถวช่วงอายุเป็น `<button>` ตัวเลขชายหญิงข้างแท่ง สรุปอายุ 60 ปีขึ้นไป และป้ายขอบเขตที่อ่านตำบลที่เลือกของ F33 · ตัวเลขทั้งหมดจาก `HomePopulation` ที่คำนวณแล้ว (SCHEMA §9, §11.3) ไม่คำนวณใหม่ใน component · `dc:check` เทียบผลรวมของแถวช่วงอายุใหม่
- **ขึ้นกับ:** F33
- **ตรวจรับ:**
  1. ทั้งอำเภอปี 2568: 17 ช่วงอายุ อายุ 60 ปีขึ้นไป 13,487 คน ร้อยละ 29.09 ของ 46,362 คนที่แยกอายุได้ และบอกว่าไม่รวม 165 คน (ไม่ใช่สัญชาติไทย 81 · ทะเบียนบ้านกลาง 75 · ระหว่างการย้าย 9)
  2. ตัวเลขชาย/หญิงของทุกช่วงอายุมองเห็นโดยไม่ hover ที่ทุกความกว้างตั้งแต่ 320px และเป็นสีข้อความ ไม่ใช่สีแท่ง
  3. เลือกตำบลจากส่วนใดก็ได้แล้วพีระมิด สรุป และป้ายขอบเขตเปลี่ยนเป็นของตำบลนั้น ล้างการเลือกแล้วกลับเป็นทั้งอำเภอ
  4. แถวช่วงอายุเลือกได้ด้วยคีย์บอร์ดและการแตะ แสดงยอดรวมกับร้อยละในที่เดียวกันโดยไม่เปิด modal และชื่อสำหรับ screen reader บอกช่วงอายุ ชาย หญิง และขอบเขต
  5. ปีล่าสุดไม่มีแถวอายุ (`population.json` ที่ไม่มีแถวอายุวางทับแล้ว `npx next build`) → ไม่มีส่วนนี้ ส่วนอื่นยังอยู่
  6. `npm run dc:check` (แก้ให้ตรงกับพีระมิดใหม่) ผ่าน: ผลรวมแถวช่วงอายุ + ประชากรที่ไม่แยกอายุ = ประชากรทั้งหมดในแผง ของอำเภอและทุกตำบล · `npm run dc:budget` ผ่าน
  7. `npm run lint`, `npm test` และ `npm run build` ผ่าน
  8. LCP ของหน้าแรกวัดบนเครื่องเทียบกับ `main` ตาม SPEC §9.6 ผ่าน และบันทึกค่ากลางใน PR

### F36 รายงานตามหัวข้อและที่มาของข้อมูลบนหน้าแรก

- **ทำ:** สองส่วนท้ายของหน้าแรกตาม SPEC §9.2 · icon จาก `lucide-react` (import ทีละตัว) หนึ่งตัวต่อหัวข้อ เลือกตาม `cat_id` และหัวข้อที่ไม่มีใน map ได้ icon กลาง · ที่มาของข้อมูลแบบกระชับครบทุกบรรทัดของ SPEC §9.2
- **ขึ้นกับ:** F32 (ย้ายวันที่ข้อมูล HDC เข้าส่วนที่มาแล้ว)
- **ตรวจรับ:**
  1. ทุกแถวลิงก์ไป `/reports?cat={cat_id}` ของหัวข้อที่มีอยู่จริงใน `catalog.json` และจำนวนรายงานตรงกับคลังรายงาน · ไม่มีเลข 01–06 และไม่มี emoji
  2. แต่ละแถวเป็น `<a>` เดียว ไม่มีปุ่มซ้อน เป้ากดสูงอย่างน้อย 44px มี hover และ focus-visible · "ดูรายงานทั้งหมด" เป็นลิงก์ข้อความ
  3. หัวข้อที่ไม่มีใน map ของ icon (แก้ `catalog.json` ด้วยมือแล้ว `npx next build`) ได้ icon กลาง และ build ไม่ล้ม
  4. ที่มาของข้อมูลมี HDC Open Data พร้อมวันที่ข้อมูลล่าสุด ประชากรจากกรมการปกครอง ขอบเขตตำบล MOPH GIS พร้อมวันที่ดาวน์โหลด OpenStreetMap และเวลาที่ build · วันที่ข้อมูล HDC ปรากฏครั้งเดียวบนหน้า
  5. ไม่มีข้อมูลประชากร → ที่มาของข้อมูลไม่มีบรรทัดประชากร
  6. `npm run dc:check` และ `npm run dc:budget` ผ่าน
  7. `npm run lint`, `npm test` และ `npm run build` ผ่าน

### F37 ตรวจรับหน้าแรกตาม V7.6 บนเว็บจริง

- **ทำ:** หลังใบอื่นของ Track G merge แล้ว ตรวจหน้าแรกทั้งหน้าบน https://songhealth-dc.pages.dev/ และบันทึกผลใน issue: LCP ตาม SPEC §9.6 · ภาพหน้าจอ 5 ความกว้าง · เช็กลิสต์ข้อที่ใช้กับเราจาก design.md §9 (ไม่รวมข้อตำบลที่รับผิดชอบและหมู่บ้าน) · เทียบตัวเลขทั้งหน้ากับ `population.json` ของ build ที่ขึ้นเว็บ · งานตรวจและบันทึก ไม่แก้โค้ด สิ่งที่ไม่ผ่านเปิดเป็น issue ใหม่
- **ขึ้นกับ:** F32, F34, F35, F36
- **ตรวจรับ:**
  1. LCP มือถือ < 2.5 วินาที ตามคำสั่งใน SPEC §9.6 (บันทึกค่าทั้ง 3 รอบ)
  2. ภาพหน้าจอที่ 320, 390, 768, 1440 และ 1920px แนบใน issue และไม่มี horizontal overflow
  3. เช็กลิสต์ทุกข้อมีผล ผ่าน / ไม่ผ่าน / ไม่เกี่ยว พร้อมเหตุผล ข้อที่ดูด้วยตา (เช่น ไม่มีกรอบซ้อนหรือป้ายตกแต่ง) มีภาพประกอบ
  4. ตัวเลขทุกส่วน (ภาพรวมประชากร แผงตำบล ส่วนเปรียบเทียบ พีระมิด) ตรงกับ `population.json` และเลือกตำบลจากแผนที่ `<select>` กราฟ และตารางแล้วทุกส่วนตรงกัน
  5. โค้ดของหน้าแรก (`src/app/(dc)/page.tsx` และ component ที่หน้าแรกใช้) ไม่มีชื่อสีเก่าของ R6 ตามรายการใน SPEC §9.1 (`dc-canvas` เป็นชื่อใหม่ด้วย จึงไม่นับ)
  6. ข้อที่ไม่ผ่านมี issue ติดตาม หรือ issue นี้ปิดเมื่อผ่านทุกข้อ หลังปิดใบนี้รัน `/retro` ของ Track G

---

## งานที่รอเฟส 2 (ไม่ทำตอนนี้)

- รายชื่อหมู่บ้านในแผงตำบล (ไฟล์ `stat_m` ของ stat.bora)
- แนวโน้มประชากรหลายปีบนหน้าเว็บ (ชีตเก็บทุกปีอยู่แล้ว SCHEMA §2.6)
- ความเคลื่อนไหวประชากร (ตาย ย้ายเข้า ย้ายออก): ยังไม่เจอไฟล์ static ต้องใช้ API ไปรวมเป็นยอดรายปี จึงค่อยตัดสินภายหลัง
- ออกแบบ `/reports` และ `/reports/{id}` ใหม่ด้วย token ของ V7.6 แล้วลบชื่อสีเก่าของ R6 (ขั้นหดของ ADR-0012, SPEC §9.1)
- รายชื่อหน่วยบริการ → ตำบลและหมู่บ้านที่รับผิดชอบ (drawer ของ design.md §5.4) เมื่อมีข้อมูลตำบลที่รับผิดชอบที่ตรวจแล้ว
- รายงานชนิด `workload`
- แสดงคอลัมน์ผลแยกย่อยที่ SCHEMA §4.5 มีความหมายแล้ว เช่น 9 ด้านของ `s_aged9` (ไม่รวมผลงานรายไตรมาสของ `s_dm_screen`/`s_ht_screen` #169)
- ปุ่มรีเฟรชแค็ตตาล็อกบนหน้า `/sync`
- `/sync` แสดงวันที่อัปเดตล่าสุดของปีที่เลือก (ตอนนี้มาจากชีตปีปัจจุบันเสมอ ต้องให้ GAS ส่ง `sync_status` รายปีมาด้วย) จากรีวิว F11
- ย้าย PA มาอ่าน snapshot
- ทดลองดึง MOPH ด้วย Cloudflare Pages Function
- การแบ่งหน้า `offset` ของ `report_data` เมื่อมีตารางเกิน 5,000 แถว
- การยืนยันตัวตนฝั่ง server (D5) ถ้าความเสี่ยงเปลี่ยน เช่น เริ่มมีข้อมูลที่ไม่ใช่สาธารณะ
