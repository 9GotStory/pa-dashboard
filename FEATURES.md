# FEATURES — Song Health Data Center เฟส 1

> สถานะ: ร่าง v0.5 · 29 ต.ค. 2569 · คู่กับ [SPEC.md](SPEC.md) v0.5 และ [SCHEMA.md](SCHEMA.md) v0.5 · คำศัพท์ตาม [GLOSSARY.md](GLOSSARY.md)
> รายการงานเรียงตามลำดับที่ต้องทำ แต่ละข้อมีเกณฑ์ตรวจรับที่ทดสอบได้ งานจะถือว่าเสร็จเมื่อผ่านเกณฑ์ ไม่ใช่เมื่อเขียนโค้ดเสร็จ
> ต้นแบบหน้าจอ R6 อยู่ที่ `docs/reference/song-health-data-center-review-03-epi-real-response-r6.html`

## กติกา

### ขั้นตอนทำงาน (workflow ของ [mattpocock/skills](https://github.com/mattpocock/skills))

- ติดตั้งครั้งเดียว: เปิด plugin "Skills For Real Engineers" (`claude plugin install mattpocock-skills@claude-plugins-official`) แล้วรัน `/setup-matt-pocock-skills` เลือก GitHub Issues เป็น tracker และ label ค่าเริ่มต้น สคริปต์จะเขียน `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md` และส่วน `## Agent skills` ใน `CLAUDE.md`
- เอกสารชุดนี้ (SPEC/SCHEMA/FEATURES + GLOSSARY + ADR) คือผลของขั้น `/grill-with-docs` แล้ว ขั้นต่อไปคือ `/to-spec` → spec issue 1 ใบที่สรุปเป้าหมายและข้อตัดสินใจ (อ้าง ADR ไม่ใส่ path ไฟล์) → `/to-tickets` → issue ต่อ F## ตามหัวข้อด้านล่าง เป็น sub-issue ของ spec issue โดยใส่ "ขึ้นกับ" เป็น blocking relationship ของ GitHub · label ตามค่าเริ่มต้นของ skill คือ `ready-for-agent` ทุกใบ ยกเว้นงานคนทำ (F12, F21, F22) ใช้ `ready-for-human` · ใบที่หยิบได้คือใบที่ blocker ปิดหมดแล้ว (frontier)
- ยังไม่สร้าง issue จนกว่าจะสั่ง · เมื่อสร้างแล้ว issue คือแหล่งความจริงของสถานะงาน ไฟล์นี้คือแหล่งความจริงของเกณฑ์ตรวจรับ ถ้าสองที่ขัดกันให้แก้ไฟล์นี้ก่อนแล้วอัปเดต issue
- ต่อ ticket: `/implement` ซึ่งเรียก `tdd` และ `code-review` เองตอนจบ (ไม่ต้องสั่งซ้ำ) โดย `tdd` เขียนเทสต์เฉพาะ seam ที่ตกลงใน CODING_STANDARDS §5 และ `code-review` เทียบ `CODING_STANDARDS.md` → `pr` (body มี Summary, Evidence, Merge Danger และ `Closes #<issue>`) · ขั้นที่ต้องมีคนทำเอง (F12 รันกับชีตจริง, F21 ตั้ง Cloudflare, F22 เปิด Pages ใหม่) ใช้ `/wizard` นำทีละขั้นและบันทึกผลใน issue
- หลังปิด Track แต่ละชุดรัน `/retro` และนำสิ่งที่เรียนรู้มาแก้ไฟล์นี้หรือ ADR ไม่ใช่จำไว้เฉย ๆ
- งานทั้งหมดเป็นรูป expand–contract: Track A–C ขยาย (GAS รับทั้งแบบเก่าและใหม่, ชีตเพิ่ม, snapshot เพิ่ม) · Track D ย้ายผู้ใช้ (เว็บอ่าน snapshot, PA ไป `/pa`) · Track E หด (GitHub Pages เหลือ stub) จึงอย่ารวม ticket ข้าม Track เป็นใบเดียว

### กติกาโค้ด

- แตก branch จาก `main` ทีละ ticket (`feat/F01-settings-window` …) แล้ว PR เข้า `main` ส่วน `develop` (Backend v2) ไม่ใช้แล้ว ไม่ต้องแตะ (ADR-0001)
- GAS deploy ด้วย `npm run gas:sync` เมื่อ ticket ฝั่ง GAS ผ่านเกณฑ์ (รวม deploy หลายข้อพร้อมกันได้) เป็น version ใหม่ของ deployment เดิม URL ไม่เปลี่ยน
- โค้ด GAS ของ Data Center อยู่ในไฟล์ใหม่ `src/scripts/dc-*.js` (SPEC §12.4) และทุก ticket ฝั่ง GAS ต้องมีเทสต์ใน `src/scripts/test/` ที่โหลดไฟล์ GAS ด้วย `node:vm` พร้อม stub (รันด้วย `npm test` ซึ่ง F01 ตั้งไว้) · ไฟล์ที่ไม่ใช่ GAS ใต้ `src/scripts/` ต้องอยู่ใน `.claspignore` (SCHEMA §10)
- ห้ามแก้ไฟล์ PA เดิม (รายการทางการใน CODING_STANDARDS §1: ไฟล์ที่มีอยู่ก่อนใต้ `src/components/` และ `src/lib/`) ยกเว้นย้ายไฟล์ใน F13 · ใน `รหัส.js` แก้เฉพาะจุดที่ SPEC §12.4 ระบุ
- ทุก PR ต้อง `npm test` และ `npm run build` ผ่าน (CI รันทั้งสองตั้งแต่ F01 บน Node 24 · ตั้งแต่ F14 ci.yml รัน prebuild จริง จึงต้องส่ง `NEXT_PUBLIC_GAS_SCRIPT_URL` จาก GitHub secrets เข้า build step และ prebuild จะล้มถ้ายังไม่มีรายงานที่ใช้งานพร้อมข้อมูลปีปัจจุบัน F14 จึงต้องรอ F12)
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
| F01 | ตั้งค่า `district_code`, `deploy_hook_url` และ window ปี | — | |
| F02 | บันทึกข้อมูลตามปี เฉพาะอำเภอ | F01 | |
| F03 | ชีตแค็ตตาล็อกและ `save_catalog` | F01 | |
| F04 | `BATCH_ALL`: `meta.years` และ PA/DC units | F02, F03 | |
| F05 | `GET ?action=catalog` | F03 | |
| F06 | `GET ?action=report&id=` | F02, F03 | |
| F07 | `POST rebuild` | F01 | |
| F08 | `setup=dc_seed` (โค้ด) | F03 | |
| F09 | `sync-moph-to-gas.js` | F02, F04, F07 | |
| F10 | `hdc-catalog.js` | F03, F05 | |
| F11 | หน้า `/sync` | F02, F04, F07 | |
| F12 | Backfill 5 ปีและตรวจตัวเลข (คนทำ, `/wizard`) | F06, F08, F09, F10 | |
| F13 | ย้าย PA ไป `/pa` และตัด `basePath` | — | |
| F14 | prebuild snapshot | F12 (และ F05, F06 ผ่าน F12) | |
| F15 | ชั้นคำนวณ `src/lib/dc/` | F01 | |
| F16 | โครงหน้าและธีม | F13, F14 | |
| F17 | ไฟล์ขอบเขตตำบล | — | |
| F18 | หน้าแรก `/` | F14, F16, F17 | |
| F19 | คลังรายงาน `/reports` | F14, F16 | |
| F20 | หน้ารายงาน `/reports/[id]` | F14, F15, F16 | |
| F21 | Cloudflare Pages + Deploy Hook (คนทำ, `/wizard`) | F12, F18, F19, F20 | |
| F22 | หน้า stub บน GitHub Pages (คนทำ, `/wizard`) | F21 | |

---

## Track A — GAS

### F01 ตั้งค่า `district_code`, `deploy_hook_url` และ window ปี

- **ทำ:** ใน `รหัส.js` (ตามรายการ SPEC §12.4): เพิ่ม `district_code` (ต้องขึ้นต้นด้วย `province_code`) และ `deploy_hook_url` ใน `SETTINGS_SCHEMA` · `CONFIG.DISTRICT = "5406"`, `CONFIG.HISTORY_YEARS = 5` · bump `SETTINGS_CACHE_KEY` เป็น `settings_v3` · สร้าง `dc-storage.js` ใส่ `getYearWindow(settings)` และ `sheetNameFor(table, year, settings?)` (F02 เติม `saveTableYear` ในไฟล์เดียวกัน) · เพิ่ม `**/test/**`, `**/hdc-catalog.js`, `**/*.mjs` ใน `.claspignore` (SCHEMA §10) และวาง harness เทสต์ตัวแรกไว้ใน `src/scripts/test/` · `package.json` เพิ่ม `"test": "node --test \"src/scripts/test/**/*.test.js\""` (รูป glob ใช้ได้ตั้งแต่ Node 22 ส่วนรูปโฟลเดอร์ `node --test src/scripts/test/` ใช้ได้แค่ Node 20 ซึ่งหมดอายุ 30 เม.ย. 2569) · `ci.yml` เปลี่ยน `node-version` เป็น `"24"` และเพิ่มขั้น `npm test` ก่อน `npm run build`
- **ตรวจรับ (เทสต์ใน `src/scripts/test/settings.test.js`):**
  1. `settings` ไม่มีคอลัมน์ใหม่ → `district_code = "5406"`, `deploy_hook_url = ""` โดยไม่ error
  2. `district_code = 5501` (ไม่ตรงจังหวัด) → ใช้ค่าเริ่มต้น และมี `Logger.log` ว่า `district_code has invalid value`
  3. `deploy_hook_url` ที่ไม่ใช่ URL ของ Cloudflare → ถือเป็นว่าง
  4. `current_year = 2569` → window = `["2565","2566","2567","2568","2569"]`
  5. `sheetNameFor("s_epi1", "2569", settings)` = `s_epi1` · `sheetNameFor("s_epi1", "2567", settings)` = `s_epi1_y2567`
  6. `npx clasp push --dry-run` (หรือ `clasp status`) แสดงเฉพาะ `รหัส.js`, `dc-*.js`, `appsscript.json` ไม่มีไฟล์เทสต์หรือสคริปต์ node
  7. `npm test` บน Node 24 รันเฉพาะไฟล์ `*.test.js` (ไฟล์ stub ใน `src/scripts/test/` ไม่ถูกนับเป็นเทสต์) และ CI ของ PR นี้แสดงขั้น `npm test` ผ่าน

### F02 บันทึกข้อมูลตามปี เฉพาะอำเภอ (`dc-storage.js`)

- **ทำ:** `saveTableYear(tableName, year, rows, { total, force })` ตาม SCHEMA §3.3 ขั้น 1–10 รวมการย้ายปีอัตโนมัติพร้อมเงื่อนไขไม่ทับข้อมูลใหม่กว่า (SCHEMA §2.5) และ `sync_status` (สร้างชีตเองถ้ายังไม่มี) · `save_kpi_data` ใน `doPost` เรียกฟังก์ชันนี้ · `syncAllData` เรียกฟังก์ชันนี้แทน `saveDataToSheet` เดิม (`saveDataToSheet` เดิมคงไว้แต่ไม่มีใครเรียก ระบุใน comment) · `fetchMophForKpi` ส่ง `limit = 5000` และคืน `total`
- **ตรวจรับ (เทสต์ด้วย stub ของ SpreadsheetApp ที่จำลองชีตในหน่วยความจำ):**
  1. บันทึกปี 2569 (= current_year) 700 แถวทั้งจังหวัด → ชีต `s_x` มีเฉพาะแถว `5406` · response `received = 700`, `count` = จำนวนแถวอำเภอ, `sheet = "s_x"`, `archived = []` · `sync_status` มีแถว (`s_x`, 2569, sheet `s_x`)
  2. บันทึกปี 2568 → ชีต `s_x_y2568` ถูกสร้าง ชีต `s_x` ไม่เปลี่ยน · `sync_status` มี 2 แถว
  3. บันทึกปี 2568 ซ้ำด้วยข้อมูลใหม่ (date_com ใหม่กว่า) → `s_x_y2568` ถูกแทนที่ทั้งชีต
  4. ย้ายปีอัตโนมัติ: `s_x` มีแถว b_year 2569 อยู่ แล้ว `current_year` เปลี่ยนเป็น 2570 และบันทึกปี 2570 → แถว 2569 ไปอยู่ `s_x_y2569`, `s_x` มีแต่ 2570, response `archived = ["2569"]`, `sync_status` ของ 2569 ชี้ sheet `s_x_y2569`
  4b. เหมือนข้อ 4 แต่ก่อนหน้านั้นมีการ sync ปี 2569 ซ้ำลง `s_x_y2569` ด้วย `date_com` ใหม่กว่า → `s_x_y2569` ไม่ถูกทับ แถวเก่าใน `s_x` ถูกทิ้ง และ `archived = []`
  5. `year = 2560` (นอก window) → error `Year outside window` ไม่แก้ชีต
  6. `total = 2444` แต่ส่งมา 1000 แถว → error `Incomplete data` ไม่แก้ชีต
  7. payload ไม่มี `areacode` → error `No areacode column`
  8. ส่งข้อมูลที่ `date_com` เก่ากว่าที่มี → error `Stale data` · ส่งซ้ำพร้อม `force: true` → บันทึก
  9. header ของปี 2568 ต่างจาก 2569 → แต่ละชีตมี header ของตัวเอง ไม่มีคอลัมน์ว่างปน
  10. หลังเขียน ชีตมีจำนวนแถว = ข้อมูล + 1 (ไม่เหลือแถวว่าง 1,000 แถว)
  11. ไม่มีชีต `sync_status` มาก่อน → ถูกสร้างพร้อม header ในการบันทึกครั้งแรก

### F03 ชีตแค็ตตาล็อกและ `save_catalog` (`dc-catalog.js`)

- **ทำ:** `setup=datacenter` สร้าง `hdc_topics`, `hdc_reports`, `sync_status` + คอลัมน์ `district_code`, `deploy_hook_url` ใน `settings` · `readHdcTopics()`/`readHdcReports()` พร้อม validation และนิยาม "รายงานที่ใช้งาน" · `save_catalog` ตาม SCHEMA §3.4 · `sanitizeHdcId`
- **ตรวจรับ (ใช้ไฟล์ response จริงของหัวข้อวัคซีน 46 แถวเป็น fixture):**
  1. `setup=datacenter` รัน 2 ครั้ง → ครั้งสองตอบ `created: []`, `settings_columns_added: []` และไม่ลบข้อมูลที่มี
  2. `save_catalog` ครั้งแรก → `added: 34, updated: 0, removed: 0, skipped: 0` และทุกแถว `enabled = FALSE`
  3. ติ๊ก `enabled` 1 แถว ใส่ `subgroup` แล้วส่งซ้ำ → `updated: 34` และค่าที่ติ๊กไม่หาย
  4. ส่งรายการที่ตัด 1 รายงานออก → แถวนั้น `catalog_status = removed` แถวยังอยู่
  5. ส่ง `cat_id` ที่ไม่อยู่ใน `hdc_topics` → error `Topic not in hdc_topics`
  6. ส่ง `reports: []` → error `Empty report list` และไม่มีแถวถูกตั้ง `removed`
  7. รายงานที่ `source_table` ไม่ขึ้นต้นด้วย `s_` → นับใน `skipped` ไม่ถูกเพิ่ม


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
  3. `id` ที่ไม่เปิด หรือไม่มี → error `Unknown report`
  4. `id` ที่ผ่านรูปแบบแต่ยังไม่มีข้อมูล → `years: []`
  5. ตารางที่มี 2 ปีในชีต `s_x` และ `s_x_y2568` → ได้ 2 block header ของใครของมัน และ `sheet_rows = expected_rows` ทั้งสอง
  6. stub ให้ lock ถูกถืออยู่ → ตอบ error `Busy` ไม่ตอบข้อมูลครึ่งเดียว

### F07 `POST rebuild` และการเรียกจาก `syncAllData` (`dc-rebuild.js`)

- **ทำ:** ตาม SCHEMA §3.7 · `syncAllData` เรียก `requestRebuild("daily sync")` ตอนจบถ้า `okCount > 0` · เมนู `onOpen` เพิ่ม "Rebuild Website"
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

### F10 `src/scripts/hdc-catalog.js` (ใหม่)

- **ทำ:** `find <table…>`, `refresh [--cat <cat_id>]` ตาม SPEC §12.3 · อ่าน `NEXT_PUBLIC_GAS_SCRIPT_URL` จาก env เท่านั้น ไม่มี fallback
- **ตรวจรับ:**
  0. รันโดยไม่ตั้ง env → exit 1 พร้อมข้อความบอกชื่อ env
  1. `find` กับ 18 ตาราง → พิมพ์ `cat_id`/`category_name`/`opendata_id`/`report_name` ครบทุกตาราง และ `opendata_id` ตรงกับ SCHEMA §6 (ถ้าไม่ตรง ต้องแก้ SCHEMA ก่อนทำ F08)
  2. `refresh` หลังใส่หัวข้อใน `hdc_topics` → สรุปต่อหัวข้อ `added/updated/removed/skipped` และ `hdc_topics.report_count` ถูกเติม
  3. ได้ 429 จาก MOPH → รอแล้วลองใหม่ ไม่ล้มทั้งคำสั่ง

### F11 หน้า `/sync`

- **ทำ:** ตัวเลือกปีจาก `meta.years` ของ `BATCH_ALL` (เพิ่มใน F04) · ส่ง `year`, `total` และ `limit = 5000` · retry เมื่อ MOPH ตอบ 429/5xx (ของเดิม retry เฉพาะ network error) · ถ้า GAS ตอบ `Stale data` แสดงเป็น warning (การบันทึกทับใช้สคริปต์ node `--force`) · POST `rebuild` ตอนจบถ้ามีตารางสำเร็จ และแสดงผล · login ด้วย PIN คงเดิม
- **ตรวจรับ:**
  1. เลือกปี 2568 แล้ว sync 1 ตาราง → `sync_status` มีแถวปีนั้น
  2. ไม่เลือกปี → ค่าเริ่มต้นเป็น `current_year` และผลเหมือน sync แบบเดิม
  3. sync เสร็จ → log แสดงผล `rebuild` และ Cloudflare เริ่ม build (ตรวจได้หลัง F21)

---

## Track C — ข้อมูล

### F12 Backfill 5 ปีและตรวจตัวเลข

- **ทำ:** ตามขั้น 3–8 ใน SPEC §13: `find` → ใส่ `hdc_topics` → `refresh` → `dc_seed` → `--backfill --no-rebuild` → sync ปีปัจจุบัน → `verify-all.js`
- **ตรวจรับ:**
  1. `sync_status` มีครบ 18 ตาราง × ทุกปีที่ HDC มีข้อมูลใน window (บางตารางอาจไม่มีปีเก่า ให้บันทึกไว้ว่าตารางไหนเริ่มปีไหน) และมีชีต `_y` ตรงกับ `sync_status.sheet`
  2. `verify-all.js` ในวันเดียวกับ sync: KPI แบบรายปีและ EPI ตรงกับ `/pa` (สคริปต์ใช้ปี 2569 คงที่และรวม 4 ไตรมาสเสมอ KPI รายไตรมาสจึงไม่ต้องตรง ถ้า `current_year` เปลี่ยนแล้ว แก้ค่าในสคริปต์ก่อน)
  3. ค่ารายปีระดับอำเภอจาก `?action=report` ของ KPI แบบรายปี (เช่น `s_dm_screen`) คำนวณด้วยมือหรือสคริปต์แล้วตรงกับ PA

---

## Track D — Frontend

### F13 ย้าย PA ไป `/pa` และตัด `basePath`

- **ทำ:** ย้าย `src/app/page.tsx` → `src/app/pa/page.tsx`, `loading.tsx` → `pa/loading.tsx`, เพิ่ม `pa/layout.tsx` (metadata เดิม) · `src/app/(dc)/page.tsx` ใหม่เป็นหน้าชั่วคราว (ชื่อระบบ + ลิงก์ไป `/pa`) จนกว่า F18 · ลบ `basePath`/`isProd` ใน `next.config.ts` · metadata root เป็นของ Data Center · `deploy.yml` เหลือ trigger `workflow_dispatch` เท่านั้น (หยุด deploy อัตโนมัติขึ้น GitHub Pages จนกว่า F22 เพราะ build ไม่มี `basePath` แล้ว) · `package.json` เปลี่ยน `start` จาก `next start` เป็น `npx serve@latest out` (Next.js 16 ไม่ให้ใช้ `next start` กับ `output: 'export'`)
- **ตรวจรับ:**
  1. `npm run build` ผ่าน และ `out/pa.html` มีอยู่
  2. `grep -r "/pa-dashboard" out/` ไม่พบ
  3. `npm start` แล้วเปิด `/pa` และ `/pa?cat=สร้างเสริมภูมิคุ้มกันโรค` → หน้าตาและตัวเลขเหมือน production ปัจจุบัน แท็บเปิดถูก
  4. `git diff --stat` ไม่มีไฟล์ใน `src/components` หรือ `src/lib` เปลี่ยน (นอกจาก rename)
  5. หลัง merge ไม่มี workflow run ของ `deploy.yml` เกิดขึ้นเอง และ `https://9gotstory.github.io/pa-dashboard/` ยังเป็น PA เวอร์ชันก่อนหน้า

### F14 prebuild snapshot (`src/scripts/build-snapshot.mjs`)

- **ทำ:** ตาม SPEC §6.2 และ SCHEMA §7: ดึง catalog + report ทุกตัว → เรียงตาม SPEC §5.4 และตัดกลุ่ม/หัวข้อ/หมวดว่าง → ตรวจความครบ (`sheet_rows = expected_rows`, ปีปัจจุบันมีแถว) → เขียน `public/data/meta.json`, `catalog.json`, `reports/{id}.json` → ตรวจขนาด → ล้มดัง ๆ · ต้องมี env `NEXT_PUBLIC_GAS_SCRIPT_URL` ไม่มี URL สำรอง · `package.json`: `"prebuild": "node src/scripts/build-snapshot.mjs"`, `"snapshot": "node src/scripts/build-snapshot.mjs"` · `.gitignore` เพิ่ม `public/data/` · `ci.yml` ส่ง `NEXT_PUBLIC_GAS_SCRIPT_URL` จาก secrets เข้า build step · `src/lib/dc/snapshot.ts` (อ่านไฟล์ด้วย `fs` สำหรับ server component)
- **ขึ้นกับ:** F12 (prebuild ล้มถ้าไม่มีรายงานที่ใช้งานพร้อมข้อมูลปีปัจจุบัน จึงต้องมี seed + sync แล้ว) ซึ่งครอบ F05, F06
- **ตรวจรับ:**
  1. `npm run snapshot` → ไฟล์ครบตามจำนวนรายงานที่ใช้งาน และ `catalog.json` เรียงหัวข้อวัคซีนเป็น กลุ่มอายุ 1 → 2 → 3 → 5 ปี โดยในกลุ่ม `s_epi1` มาก่อน fully immunized
  2. ไม่ตั้ง env → exit 1 ทันที · ชี้ env ไป URL ที่ตอบ error → exit 1 และไม่เขียนไฟล์ใด ๆ (ไม่มีไฟล์ครึ่ง ๆ กลาง ๆ)
  3. จำลองรายงานหนึ่งตัวดึงไม่ได้ หรือ block ที่ `sheet_rows ≠ expected_rows` (ใช้ stub server) → exit 1
  4. ขนาดไฟล์ทุกไฟล์ไม่เกิน SPEC §6.1 (เกิน = exit 1, ถึง 80% = เตือน) และ script พิมพ์ไฟล์ที่ใหญ่ที่สุด
  5. `npm run build` รัน prebuild เองและผ่าน · `git status` ไม่เห็น `public/data/` · CI ของ PR นี้ผ่านโดยใช้ secret

### F15 ชั้นคำนวณ (`src/lib/dc/types.ts`, `values.ts`, `client.ts`)

- **ทำ:** type ตาม SCHEMA §9 · `values.ts` ตาม SCHEMA §4 ทั้งหมด ทำงานบน `DcYearBlock` (ตรวจกลุ่มคอลัมน์ต่อ block, measure, เป้าหมาย/ผลงานต่อแถว, รวม, จัดกลุ่มพื้นที่/หน่วย, แนวโน้ม, ผ่านเกณฑ์, วันที่ข้อมูล) · `client.ts` โหลด `/data/reports/{id}.json` พร้อม cache ในหน่วยความจำ · เทสต์ `values.test.ts` ด้วย `node:test` รันผ่าน `npx tsx --test src/lib/dc/values.test.ts` และต่อท้ายสคริปต์ `npm test` ด้วย `&& tsx --test src/lib/dc/values.test.ts` ให้ CI รันด้วย (devDependencies ใหม่มี 2 ตัวทั้งโปรเจกต์: `tsx` ที่นี่ และ `@types/leaflet` ใน F18)
- **ตรวจรับ (เทสต์):**
  1. header จริงของทั้ง 18 ตาราง (ตาม SCHEMA §4.1) → ตรวจพบกลุ่มคอลัมน์ตรงตารางนั้นทุกตัว และ `s_dm_screen`/`s_aged9` ไม่ถูกมองเป็นรายไตรมาส
  2. `s_epi1` → measure 20 รายการ `s_epi2` → 6 รายการ และ `dtp_hb3` แสดงเป็น `DTP-HB3`
  3. แถว 3 แถว target 10/20/0 result 5/10/0 → `T=30, R=15, pct=50` และแถว target 0 ทั้งหมด → `pct = null`
  4. `OVERRIDE` (`b`/`a`) ชนะ `ANNUAL` และ `M_B` ของ measure ที่เลือกชนะ `ANNUAL`
  5. `pct = 89.999` กับ `goal = 90` → ไม่ผ่าน (เทียบก่อนปัด)
  6. 2 block ปีที่ header ต่างกัน → แนวโน้มได้ค่าของแต่ละปีถูกต้อง และ measure ที่ไม่มีในปีหนึ่งได้ `null` ไม่ใช่ 0

### F16 โครงหน้าและธีม Data Center

- **ทำ:** `src/components/dc/Masthead.tsx` (masthead + เมนู หน้าแรก · คลังรายงาน · PA Dashboard) · `Footer.tsx` (อ่าน `meta.json` ตอน build) · token สีจาก R6 ใน `globals.css` ภายใต้ `@theme` (ชื่อ `--color-dc-*` ไม่ชนกับ `brand-*` ของ PA) · route group `src/app/(dc)/layout.tsx` ห่อเฉพาะ `/`, `/reports`, `/reports/[id]` ส่วน `/pa` และ `/sync` อยู่นอก group
- **ขึ้นกับ:** F13, F14 (footer อ่าน `meta.json` ผ่าน `snapshot.ts` ของ F14)
- **ตรวจรับ:**
  1. `/pa` และ `/sync` ไม่มี masthead ของ Data Center และ class ของ PA ไม่เปลี่ยน
  2. `/`, `/reports`, `/reports/{id}` มี masthead และ footer แสดงผลได้ที่ความกว้าง 360px โดยไม่มี scroll แนวนอนระดับหน้า (ตารางเลื่อนได้ภายในกรอบของตัวเองตาม SPEC §9.1)
  3. footer แสดงเวลาที่ build ตรงกับ `meta.json`

### F17 ไฟล์ขอบเขตตำบล

- **ทำ:** ดาวน์โหลดตาม SCHEMA §8 เก็บ `public/geo/song-tambon.geojson` + บันทึกวันที่และ URL ที่ใช้ใน `public/geo/README.md`
- **ตรวจรับ:**
  1. 8 features และ `ADMIN_ID3` = `540601`–`540608` ครบ ไม่ซ้ำ
  2. ไฟล์ < 500 KB
  3. วาดบน Leaflet แล้วรูปร่างอยู่ในกรอบอำเภอสอง (ไม่มี polygon หลุดไปจังหวัดอื่น)

### F18 หน้าแรก `/`

- **ทำ:** ตาม SPEC §9.2 · หน้าเป็น server component อ่าน `catalog.json`/`meta.json` ตอน build แล้วส่ง `areas`/`hospitals` เป็น props ให้ `src/components/dc/DistrictExplorer.tsx` (`'use client'`) ซึ่งเป็นตัวเรียก `next/dynamic(() => import('./DistrictMap'), { ssr: false })` (Next.js ไม่ให้ใช้ `ssr: false` ใน server component โดยตรง) · `DistrictMap.tsx` ใช้ Leaflet อ่าน `/geo/song-tambon.geojson` · เพิ่ม `leaflet@1.9.4` เป็น dependency และ `@types/leaflet` เป็น devDependency · เลือกตำบล (คลิกแผนที่หรือปุ่ม) แสดงรายชื่อหน่วยบริการ · การ์ดหัวข้อ · วันที่ข้อมูลล่าสุด · ที่มาของข้อมูล
- **ขึ้นกับ:** F14, F16, F17
- **ตรวจรับ:**
  1. แผนที่แสดง 8 ตำบลเป็นสีและชื่อตรง `areas` คลิกตำบลแล้วแผงด้านข้างเปลี่ยนตาม
  2. ตำบลบ้านหนุน (`540601`) แสดงหน่วยบริการตามค่า `tambon_id` ในชีต `hospitals` ณ วันทดสอบ (ข้อมูล 29 ต.ค. 2569 คือ "บ้านหนุน" และ "สอง" — ถ้า รพ.สอง ควรอยู่ตำบลอื่น ให้แก้ที่ชีต ไม่ใช่ที่โค้ด)
  3. การ์ดหัวข้อมีจำนวนรายงานเท่ากับใน `catalog.json` และลิงก์ไป `/reports?cat=…`
  4. ไม่มีคำว่า "จำลอง" หรือ "ตัวอย่าง" ในหน้า
  5. บล็อก `tile.openstreetmap.org` → หน้ายังใช้งานได้ เลือกตำบลด้วยปุ่มได้
  6. หน้าแรกไม่มี network request ไปที่ `script.google.com` เลย (ดูใน DevTools)
  7. Lighthouse mobile: LCP < 2.5 วินาที และ JS ของหน้า (ไม่รวม chunk ของ Leaflet) < 150 KB gzip

### F19 คลังรายงาน `/reports`

- **ทำ:** ตาม SPEC §9.3 · server component ส่ง `catalog.json` ให้ client component กรอง/ค้นหา/แบ่งหน้า · สถานะใน URL (`main`, `cat`, `q`, `page`) · ห่อ `useSearchParams` ด้วย `<Suspense>`
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

## งานที่รอเฟส 2 (ไม่ทำตอนนี้)

- ประชากรบนหน้าแรก (หัวข้อ "ประชากร" `ac4eed1b…`)
- รายงานชนิด `workload`
- ชื่อคอลัมน์ผลแยกย่อย (SCHEMA §4.5) หลังตรวจ `report_schema`
- ปุ่มรีเฟรชแค็ตตาล็อกบนหน้า `/sync`
- ย้าย PA มาอ่าน snapshot
- ทดลองดึง MOPH ด้วย Cloudflare Pages Function
- การแบ่งหน้า `offset` ของ `report_data` เมื่อมีตารางเกิน 5,000 แถว
- การยืนยันตัวตนฝั่ง server (D5) ถ้าความเสี่ยงเปลี่ยน เช่น เริ่มมีข้อมูลที่ไม่ใช่สาธารณะ
