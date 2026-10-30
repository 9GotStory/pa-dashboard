# CODING_STANDARDS — Song Health Data Center

มาตรฐานที่ `/code-review` ใช้เทียบ diff ร่วมกับ `CLAUDE.md` (แนวปฏิบัติทั่วไป) และ `GLOSSARY.md` (คำศัพท์) ข้อใดขัดกับ ADR ใน `docs/adr/` ให้ ADR ชนะ

## 1. ขอบเขตที่ห้ามแตะ

- ไฟล์ PA เดิมห้ามแก้ (รายการนี้คือรายการทางการ ที่อื่นอ้างมาที่นี่): ทุกไฟล์ที่มีอยู่ก่อนใต้ `src/components/` และ `src/lib/` (ไฟล์ใหม่ใน `src/components/dc/` และ `src/lib/dc/` ไม่นับ) และ `src/app/sync/page.tsx` นอกเหนือจากที่ SPEC §12.1 ระบุ · ย้ายไฟล์ตาม SPEC §4 ได้ แต่เนื้อหาต้องเหมือนเดิม
- ใน `src/scripts/รหัส.js` แก้ได้เฉพาะจุดที่ SPEC §12.4 ระบุ โค้ดใหม่ของ Data Center อยู่ใน `src/scripts/dc-*.js`
- ไม่แก้ชีต `kpi_registry`, `kpi_master`, `kpi_epi` และไม่เปลี่ยนคีย์ cache `PA_DASHBOARD_CACHE_V4`
- branch `develop` ไม่แตะ (ADR-0001)

## 2. GAS (`src/scripts/*.js` ที่ถูก push)

- ทุกไฟล์อยู่ใน global scope เดียวกัน ใช้ชื่อฟังก์ชันตามที่ SPEC/SCHEMA/FEATURES ระบุ (`getYearWindow`, `sheetNameFor`, `saveTableYear`, `readHdcTopics`, `readHdcReports`, `sanitizeHdcId`, `dcCleanName`, `requestRebuild`, `getPaUnits`, `getSyncUnits`) ฟังก์ชันช่วยที่เอกสารไม่ได้ตั้งชื่อให้ขึ้นต้นด้วย `dc` เพื่อไม่ชนกับของเดิมใน `รหัส.js`
- ห้าม `require`/`import`/`process`: ไฟล์ node และเทสต์ต้องอยู่ใน `.claspignore` (SCHEMA §10)
- script lock ถือโดย handler เท่านั้น (`doPost` ครั้งเดียวก่อนแยก action, `doGet` สำหรับ `catalog`/`report`, `syncAllData`, `rebuildWebsiteMenu`) ด้วย `tryLock(30000)` และปล่อยใน `finally` · ฟังก์ชันภายใน (`saveTableYear`, ตัวบันทึกของ `save_catalog`, `requestRebuild`) ไม่เรียก `LockService` และระบุใน comment ว่า caller must hold the lock (SCHEMA §3) · กฎนี้ใช้กับโค้ดใหม่ `readSettings`/`readKpiMasterConfig` เดิมไม่แก้
- ชื่อชีตประกอบจาก `sheetNameFor()` เท่านั้น ชื่อตารางที่เขียนได้ต้องอยู่ใน `getSyncUnits()` และ `source_table` ต้องขึ้นต้นด้วย `s_`
- ค่าที่รับจากภายนอก (`cat_id`, `opendata_id`, ชื่อตาราง, ปี) ต้องผ่าน `sanitizeHdcId`/`sanitizeToken`/regex ที่ SCHEMA ระบุ ก่อนใช้เป็นชื่อชีตหรือ key · `sanitizeHdcId` ไม่แปลงตัวพิมพ์ รหัส HDC ใช้ตัวพิมพ์ตามจริงทุกที่ (SCHEMA §3) · ชื่อจาก HDC (`report_name`, `category_name`, `main_report_name`) ผ่าน `dcCleanName` ก่อนเขียนชีต
- response: สำเร็จ = JSON ตามสัญญาใน SCHEMA §3 ผิดพลาด = `createJsonError("…")` ใช้ข้อความตามที่ SCHEMA ระบุ (เช่น `Year outside window`) เพราะ client และเทสต์เทียบข้อความ
- log: `logToSheet` เฉพาะเหตุการณ์ที่คนต้องเห็น (บันทึกสำเร็จ/ล้ม, ย้ายปี, rebuild) ส่วน log ที่เกิดได้ทุกนาทีใช้ `Logger.log`
- ไม่มีความลับในโค้ด ค่าตั้งนอกโค้ดอยู่ในชีต `settings` (SCHEMA §2.1)
- ตัวอ่านชีตใหม่อ่านคอลัมน์ตามชื่อ header (trim + ตัวพิมพ์เล็ก) ไม่อ่านตามตำแหน่ง
- `BATCH_ALL` และการคำนวณของ PA ใน `รหัส.js` ไม่เปลี่ยนผลลัพธ์ (F04 ตรวจด้วยการเทียบ response ก่อน/หลัง)

## 3. สคริปต์ node (`src/scripts/*.js`, `*.mjs` ที่ไม่ push)

- ไม่มี dependency นอก Node 24 built-in (`fetch`, `fs`, `node:test`)
- ค่าตั้งผ่าน env หรือ argument ไม่ hardcode URL · `sync-moph-to-gas.js` คง fallback ของ GAS URL ที่มีอยู่เดิม ส่วนสคริปต์ใหม่ (`hdc-catalog.js refresh`, `build-snapshot.mjs`) บังคับ `NEXT_PUBLIC_GAS_SCRIPT_URL` ไม่มี fallback
- ล้มด้วย exit code ไม่ใช่ 0 พร้อมข้อความบอกวิธีแก้ ไม่ล้มเงียบ ไม่เขียนไฟล์ครึ่งเดียว (เขียนไฟล์ชั่วคราวแล้วค่อยย้าย หรือเขียนทั้งหมดหลังตรวจครบ)
- เรียก MOPH ตามกติกา SPEC §7.1 (เว้นช่วง, retry 429/5xx, `limit = 5000`, ส่ง `total`) · `hdc-catalog.js` ไม่เรียก MOPH เลย อ่านไฟล์ export แค็ตตาล็อก (SCHEMA §5.5) · ห้ามสคริปต์ใดส่ง `User-Agent` หรือ header อื่นปลอมเป็นเบราว์เซอร์ (ADR-0010) · snippet ที่รันในเบราว์เซอร์อยู่ใน `tools/` ไม่ใช่ `src/scripts/`

## 4. Frontend (`src/app/(dc)/`, `src/components/dc/`, `src/lib/dc/`)

- TypeScript strict ไม่ใช้ `any` type ทั้งหมดมาจาก `src/lib/dc/types.ts` (= SCHEMA §9)
- server component อ่านไฟล์ผ่าน `src/lib/dc/snapshot.ts` เท่านั้น client component ไม่ `import` `fs` และไม่เรียก GAS
- `src/lib/dc/values.ts` เป็นฟังก์ชันล้วน: ไม่ import React, ไม่แตะ DOM/`window`, ไม่ `fetch`
- `'use client'` เฉพาะ component ที่มี state/effect/เบราว์เซอร์ API · Leaflet โหลดผ่าน `next/dynamic` ใน client wrapper เท่านั้น
- ไม่เพิ่ม dependency นอกจาก `leaflet@1.9.4` (dependencies) กับ `tsx`, `@types/leaflet` (devDependencies) · กราฟเป็น SVG เขียนเอง
- ข้อความบนหน้าเป็นภาษาไทย ใช้คำตาม `GLOSSARY.md` ไม่มีคำว่า "จำลอง"/"ตัวอย่าง"
- ไม่ import จากไฟล์ PA (ไฟล์ที่มีอยู่ก่อนใต้ `src/lib/` และ `src/components/`) ยกเว้น root layout ที่ใช้ `src/lib/fonts.ts` อยู่แล้ว · ฟังก์ชันที่ต้องให้ผลเหมือน PA (`formatPct`, `formatThaiDate`) อยู่ใน `src/lib/dc/format.ts`
- ร้อยละแสดงผ่าน `formatPct` ของ `src/lib/dc/format.ts` (2 ตำแหน่ง) เทียบเกณฑ์ด้วยค่าก่อนปัด · เป้าหมาย 0 แสดง "—" ไม่ใช่ 0%
- หน้าใน `(dc)` ต้องไม่มี network request ไป `script.google.com`
- การเข้าถึง: ทุก control มี label, ตารางมี `<caption>`, กราฟ SVG มี `role="img"` + `aria-label`, focus ย้ายไปหัวข้อเมื่อเปลี่ยนหน้าแบบ R6
- URL state: ตัวกรองของหน้ารายงานอยู่ใน query ตาม `ReportQuery` และตั้ง `dynamicParams = false`

## 5. เทสต์และ seam ที่ตกลงกัน

เขียนเทสต์ที่ seam เหล่านี้เท่านั้น (ตาม `/tdd`) ค่าที่คาดหวังต้องมาจากแหล่งอิสระ (ตัวเลขจากชีตจริง, ตัวอย่างใน SCHEMA) ไม่ใช่คำนวณซ้ำด้วยสูตรเดียวกับโค้ด

| seam | วิธีทดสอบ | จับอะไรได้ / ไม่ได้ |
|---|---|---|
| ฟังก์ชัน GAS ระดับ handler (`doGet`/`doPost` ต่อ action, `handleDiag` ต่อ setup) และ `saveTableYear`, `getYearWindow`, `sheetNameFor`, `requestRebuild` | โหลดไฟล์ GAS ใน `node:vm` พร้อม stub ของ `SpreadsheetApp` (ชีตในหน่วยความจำ), `PropertiesService`, `UrlFetchApp`, `LockService` (นับการถือและปล่อย lock), `CacheService` ใน `src/scripts/test/` ไฟล์เทสต์ชื่อ `*.test.js` รันด้วย `npm test` | จับ logic ทั้งหมดของ GAS ได้ · ไม่จับพฤติกรรมจริงของ Sheets API และโควตา |
| `src/lib/dc/values.ts` และ `format.ts` (ทุกฟังก์ชัน export) | `node:test` ผ่าน `tsx --test src/lib/dc/*.test.ts` (อยู่ใน `npm test` ตั้งแต่ F15) ด้วย header จริงของ 18 ตารางและแถวตัวอย่าง | จับการตรวจกลุ่มคอลัมน์ การรวมค่า และการจัดรูปแบบ · ไม่จับการแสดงผล |
| `src/scripts/build-snapshot.mjs` | รันกับ stub HTTP server ที่ตอบ `catalog`/`report` ปลอม (สำเร็จ, error, `Busy` แล้วสำเร็จ, `Busy` ตลอด, แถวไม่ครบ, ไฟล์ใหญ่) | จับการล้มดัง ๆ และโครงไฟล์ · ไม่จับ GAS จริง |
| หน้าเว็บ | ตรวจด้วยมือตามเกณฑ์ใน FEATURES (`npx serve out`, DevTools, Lighthouse) | ไม่มี e2e อัตโนมัติในเฟส 1 |

- CI รัน `npm test` แล้ว `npm run build` บน Node 24 ทุก PR ต้องผ่านทั้งสอง
- ไม่ mock ภายในโมดูลของตัวเอง (anti-pattern ของ `/tdd`) mock เฉพาะขอบเขตภายนอก (GAS services, HTTP)

## 6. Git และ PR

- branch ต่อ ticket: `feat/F##-<slug>` จาก `main` · PR เข้า `main` · merge แบบ squash
- commit message: `feat:`/`fix:`/`docs:`/`chore:` + สรุปสั้น (ตามประวัติเดิมของ repo)
- PR body ตามเทมเพลต `/pr` (Summary, Evidence, Merge Danger) ระบุ `Closes #<issue>` และผลเทสต์/ภาพหน้าจอเป็น Evidence
- ห้าม force-push branch ที่มีคนอื่นดึงไปแล้ว และห้าม push ตรงเข้า `main`
- ไม่ commit `public/data/` และไฟล์ที่มีความลับ
