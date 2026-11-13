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
- script lock ถือโดย handler เท่านั้น (`doPost` ครั้งเดียวก่อนแยก action, `doGet` สำหรับ `catalog`/`report`/`registry_population`, `syncAllData`, `rebuildWebsiteMenu`) ด้วย `tryLock(30000)` และปล่อยใน `finally` · ฟังก์ชันภายใน (`saveTableYear`, ตัวบันทึกของ `save_catalog` และ `save_registry_population`, `requestRebuild`) ไม่เรียก `LockService` และระบุใน comment ว่า caller must hold the lock (SCHEMA §3) · กฎนี้ใช้กับโค้ดใหม่ `readSettings`/`readKpiMasterConfig` เดิมไม่แก้ handler จึงเรียกสองฟังก์ชันนี้ก่อนถือ lock และ `syncAllData` ส่งค่าที่อ่านไว้ต่อให้ฟังก์ชันภายใน (SCHEMA §3)
- ชื่อชีตประกอบจาก `sheetNameFor()` เท่านั้น ชื่อตารางที่เขียนได้ต้องอยู่ใน `getSyncUnits()` และ `source_table` ต้องขึ้นต้นด้วย `s_` · ชีตประชากรสามชีต (`registry_population`, `registry_population_age`, `registry_population_village`) เป็นชื่อคงที่ในโค้ด เลือกจาก `kind` ไม่รับชื่อชีตจากคำขอ (SCHEMA §3.8)
- ค่าที่รับจากภายนอก (`cat_id`, `opendata_id`, ชื่อตาราง, ปี) ต้องผ่าน `sanitizeHdcId`/`sanitizeToken`/regex ที่ SCHEMA ระบุ ก่อนใช้เป็นชื่อชีตหรือ key · `sanitizeHdcId` ไม่แปลงตัวพิมพ์ รหัส HDC ใช้ตัวพิมพ์ตามจริงทุกที่ (SCHEMA §3) · ชื่อจาก HDC (`report_name`, `category_name`, `main_report_name`) ผ่าน `dcCleanName` ก่อนเขียนชีต
- response: สำเร็จ = JSON ตามสัญญาใน SCHEMA §3 ผิดพลาด = `createJsonError("…")` ใช้ข้อความตามที่ SCHEMA ระบุ (เช่น `Year outside window`) เพราะ client และเทสต์เทียบข้อความ
- log: `logToSheet` เฉพาะเหตุการณ์ที่คนต้องเห็น (บันทึกสำเร็จ/ล้ม, ย้ายปี, rebuild) ส่วน log ที่เกิดได้ทุกนาทีใช้ `Logger.log`
- ไม่มีความลับในโค้ด ค่าตั้งนอกโค้ดอยู่ในชีต `settings` (SCHEMA §2.1)
- ตัวอ่านชีตใหม่อ่านคอลัมน์ตามชื่อ header (trim + ตัวพิมพ์เล็ก) ไม่อ่านตามตำแหน่ง
- `BATCH_ALL` และการคำนวณของ PA ใน `รหัส.js` ไม่เปลี่ยนผลลัพธ์ (F04 ตรวจด้วยการเทียบ response ก่อน/หลัง)

## 3. สคริปต์ node (`src/scripts/*.js`, `*.mjs` ที่ไม่ push)

- ไม่มี dependency นอก Node 24 built-in (`fetch`, `fs`, `node:test`) ยกเว้น `pa-check.mjs` และ `dc-check.mjs` (F16) ใช้ `playwright-core` (devDependency) เปิดหน้าเว็บใน Google Chrome ที่ติดตั้งในเครื่อง (ผู้ใช้อนุญาต `pa-check.mjs` 30 ต.ค. 2569 และ `dc-check.mjs` 31 ต.ค. 2569)
- ค่าตั้งผ่าน env หรือ argument ไม่ hardcode URL · `sync-moph-to-gas.js` คง fallback ของ GAS URL ที่มีอยู่เดิม ส่วนสคริปต์ใหม่ (`hdc-catalog.js refresh`, `build-snapshot.mjs`) บังคับ `NEXT_PUBLIC_GAS_SCRIPT_URL` ไม่มี fallback
- ล้มด้วย exit code ไม่ใช่ 0 พร้อมข้อความบอกวิธีแก้ ไม่ล้มเงียบ ไม่เขียนไฟล์ครึ่งเดียว (เขียนไฟล์ชั่วคราวแล้วค่อยย้าย หรือเขียนทั้งหมดหลังตรวจครบ)
- เรียก MOPH ตามกติกา SPEC §7.1 (เว้นช่วง, retry 429/5xx, `limit = 5000`, ส่ง `total`) · `hdc-catalog.js` ไม่เรียก MOPH เลย อ่านไฟล์ export แค็ตตาล็อก (SCHEMA §5.5) · ห้ามสคริปต์ใดส่ง `User-Agent` หรือ header อื่นปลอมเป็นเบราว์เซอร์ (ADR-0010) · snippet ที่รันในเบราว์เซอร์อยู่ใน `tools/` ไม่ใช่ `src/scripts/`

## 4. Frontend (`src/app/(dc)/`, `src/components/dc/`, `src/lib/dc/`)

- TypeScript strict ไม่ใช้ `any` type ทั้งหมดมาจาก `src/lib/dc/types.ts` (= SCHEMA §9 · ESLint ตรวจ export type นอกไฟล์นี้)
- server component อ่านไฟล์ผ่าน `src/lib/dc/snapshot.ts` เท่านั้น client component ไม่ `import` `fs` และไม่เรียก GAS (ESLint ตรวจ `fs` · `dc:check` ตรวจ request ไป GAS) ยกเว้น `RegistryPopulationUpload.tsx` ซึ่งวางในหน้า `/sync` ไม่ใช่หน้าของ `(dc)` และเรียก GAS ตาม SPEC §12.1
- `src/lib/dc/values.ts` และ `population.ts` เป็นฟังก์ชันล้วน: ไม่ import React, ไม่แตะ DOM/`window`, ไม่ `fetch` · component ใน `src/components/dc/` ไม่ import `population.ts` ซึ่งมีตัวอ่านไฟล์ของ `/sync` (งบ JS, SPEC §9.6) ยกเว้น `RegistryPopulationUpload.tsx` (ESLint ตรวจ)
- `'use client'` เฉพาะ component ที่มี state/effect/เบราว์เซอร์ API · Leaflet โหลดผ่าน `next/dynamic` ใน client wrapper เท่านั้น
- ไม่เพิ่ม dependency นอกจาก `leaflet@1.9.4` (dependencies) กับ `tsx`, `@types/leaflet` (devDependencies) · กราฟเป็น SVG หรือ HTML เขียนเอง · icon ใช้ `lucide-react` ที่มีอยู่แล้ว import ทีละตัว ไม่ใช้ emoji
- ข้อความบนหน้าเป็นภาษาไทย ยกเว้นเหตุผลจาก GAS หรือเบราว์เซอร์ที่ส่วนอัปโหลดในหน้า `/sync` แสดงต่อท้ายตามที่ได้รับ เพราะข้อความของ GAS เป็นภาษาอังกฤษตามตาราง SCHEMA §3.8 ไม่แปลในหน้าเว็บ · ใช้คำตาม `GLOSSARY.md` ไม่มีคำว่า "จำลอง"/"ตัวอย่าง"
- สีใช้ token `dc-*` ใน `globals.css` กับ `white` ไม่ใช้ `brand-*` ของ PA หรือสีสำเร็จรูปของ Tailwind (`slate-*` ฯลฯ) · ใช้ token ชื่อตามความหมายของ V7.6 (SPEC §9.1) ชื่อเก่าของ R6 (`dc-blue`, `dc-navy` ฯลฯ) ลบไปแล้วในขั้นหด (F63, ADR-0012, ADR-0015) ไม่เพิ่มกลับ · ไม่มี CSS เขียนเองเพิ่มนอกจาก token ใน `@theme` · ข้อความใช้ `font-dc` ที่ layout ของ `(dc)` ตั้งไว้ หัวเรื่องใช้ `font-prompt` ไม่ใช้ `font-sans` (ได้ฟอนต์ของเครื่อง SPEC §11)
- ไม่ import จากไฟล์ PA (ไฟล์ที่มีอยู่ก่อนใต้ `src/lib/` และ `src/components/` · ESLint ตรวจ) · ฟังก์ชันที่ต้องให้ผลเหมือน PA (`formatPct`, `formatThaiDate`) อยู่ใน `src/lib/dc/format.ts` และฟอนต์อยู่ใน `src/lib/dc/fonts.ts`
- ร้อยละแสดงผ่าน `formatPct` ของ `src/lib/dc/format.ts` (2 ตำแหน่ง) เทียบเกณฑ์ด้วยค่าก่อนปัด · เป้าหมาย 0 แสดง "—" ไม่ใช่ 0%
- หน้าใน `(dc)` ต้องไม่มี network request ไป `script.google.com`
- การเข้าถึง: ทุก control มี label, ตารางมี `<caption>`, กราฟ SVG มี `role="img"` + `aria-label` ส่วน SVG ที่มีปุ่มข้างใน (ตำบลบนแผนที่) เป็น `role="group"` + `aria-label` และกราฟที่กดได้ (แท่งของส่วนเปรียบเทียบ แถวช่วงอายุ) เป็น `<button>` ที่ชื่อบอกค่าและ SVG ข้างในเป็น `aria-hidden`, focus ย้ายไปหัวข้อเมื่อเปลี่ยนหน้าแบบ R6
- URL state: ตัวกรองของหน้ารายงานอยู่ใน query ตาม `ReportQuery` และตั้ง `dynamicParams = false`
- หน้ารายตาราง (ADR-0015): สูตรและกติกาที่ทุกหน้าต้องเหมือนกันอยู่ที่เดียว (`values.ts`, ชิ้นส่วนร่วมใน `src/components/dc/report/`) การเขียนซ้ำคือ finding · layout, markup และ map/switch ต่อหน้าที่หน้าพี่น้องคล้ายกันซ้ำได้ ไม่ใช่ finding

## 5. เทสต์และ seam ที่ตกลงกัน

เขียนเทสต์ที่ seam เหล่านี้เท่านั้น (ตาม `/tdd`) ค่าที่คาดหวังต้องมาจากแหล่งอิสระ (ตัวเลขจากชีตจริง, ตัวอย่างใน SCHEMA) ไม่ใช่คำนวณซ้ำด้วยสูตรเดียวกับโค้ด

| seam | วิธีทดสอบ | จับอะไรได้ / ไม่ได้ |
|---|---|---|
| ฟังก์ชัน GAS ระดับ handler (`doGet`/`doPost` ต่อ action, `handleDiag` ต่อ setup) และ `saveTableYear`, `getYearWindow`, `sheetNameFor`, `requestRebuild` | โหลดไฟล์ GAS ใน `node:vm` พร้อม stub ของ `SpreadsheetApp` (ชีตในหน่วยความจำ), `PropertiesService`, `UrlFetchApp`, `LockService` (นับการถือและปล่อย lock), `CacheService` ใน `src/scripts/test/` ไฟล์เทสต์ชื่อ `*.test.js` รันด้วย `npm test` | จับ logic ทั้งหมดของ GAS ได้ · ไม่จับพฤติกรรมจริงของ Sheets API และโควตา |
| `src/lib/dc/values.ts`, `format.ts`, `csv.ts`, `population.ts` และชั้นข้อมูลของหน้ารายตาราง `src/lib/dc/tables/{หน้า}.ts` และรายการตารางที่มีหน้า `src/lib/dc/tables/index.ts` (ทุกฟังก์ชัน export) | `node:test` ผ่าน `tsx --test src/lib/dc/*.test.ts src/lib/dc/tables/*.test.ts` (อยู่ใน `npm test` ตั้งแต่ F15 และ `tables/` ตั้งแต่ F52) ด้วย header จริงของ 18 ตารางและแถวตัวอย่าง · `population.ts` ใช้ fixture ที่ตัดจากไฟล์จริงของ stat.bora (SCHEMA §11) · ชั้นข้อมูลใช้ fixture ที่ตัดจาก snapshot จริงใน `src/lib/dc/fixtures/` ค่าคาดหวังจาก SCHEMA §4.6 | จับการตรวจกลุ่มคอลัมน์ การรวมค่า การจัดรูปแบบ การอ่าน ตรวจ และคำนวณประชากร และค่าทุกตัวที่หน้ารายตารางแสดง และตั้งแต่ F62 รายงานที่รอวิเคราะห์ที่ catalog ของเว็บตัดออกกับคำเตือนของมัน · ไม่จับการแสดงผล และส่วนอัปโหลดในหน้า `/sync` ซึ่งตรวจด้วยมือ |
| `src/scripts/build-snapshot.mjs` | รันกับ stub HTTP server ที่ตอบ `catalog`/`report`/`registry_population` ปลอม (สำเร็จ, error, `Busy` แล้วสำเร็จ, `Busy` ตลอด, แถวไม่ครบ, ไฟล์ใหญ่, ยังไม่มีข้อมูลประชากร) | จับการล้มดัง ๆ และโครงไฟล์ · ไม่จับ GAS จริง |
| `src/scripts/hdc-catalog.js` (`find`, `refresh`) | รันเป็น child process แบบที่ผู้ดูแลรัน กับไฟล์ export แค็ตตาล็อกที่ทำจาก fixture · `refresh` คุยกับ HTTP server ในเครื่องที่ส่งทุกคำขอให้ `doGet`/`doPost` ของ GAS จริงใน harness `node:vm` ข้างบน | จับลำดับหัวข้อ body ของ `save_catalog` การข้ามหัวข้อ exit code และข้อความ รวมถึงสิ่งที่ GAS เขียนลงชีต · ไม่จับ redirect ของ Apps Script และเครือข่ายจริง |
| `src/scripts/sync-moph-to-gas.js` | รันเป็น child process แบบที่ผู้ดูแลรัน คุยกับ HTTP server ในเครื่อง 2 ตัว: GAS ที่ส่งทุกคำขอให้ `doGet`/`doPost` จริงใน harness `node:vm` ข้างบน และ stub ของ `report_data` (แถว + `total`, 429/5xx) · เทสต์ตั้ง `NEXT_PUBLIC_GAS_SCRIPT_URL` และ `MOPH_URL` ทุกครั้ง จึงไม่หลุดไป GAS จริงผ่าน fallback และตั้ง `SYNC_WAIT_SCALE=0` ให้ไม่ต้องรอช่วงเว้น | จับปีที่ sync (ค่าเริ่มต้น, `--year`, `--backfill`), `limit` ที่ขอ, การหยุดตารางเมื่อได้แถวน้อยกว่า `total`, retry, `--force` กับ `Stale data`, ผลของ `rebuild` ในบรรทัดสุดท้าย, exit code และสิ่งที่ GAS เขียนลงชีต (`sync_status`, ชีตปีย้อนหลัง) · ไม่จับ MOPH จริง (`limit = 5000` ได้ครบ `total` หรือไม่), การเว้นช่วงกับ WAF จริง และ redirect ของ Apps Script |
| `.claude/hooks/thai-reply.mjs` (Stop hook) | รันเป็น child process แบบที่ Claude Code รัน: hook input ทาง stdin กับ transcript ในไฟล์ชั่วคราวที่ลอกรูปแบบ entry จาก transcript จริง (ข้อความที่ผู้ใช้พิมพ์, skill ที่โหลดกลาง turn, รายงานของ subagent, task notification) | จับการหาจุดเริ่ม turn และการตัดสินว่าเป็นภาษาอังกฤษ · ไม่จับรูปแบบ transcript ที่เปลี่ยนในรุ่นใหม่ของ Claude Code (ไม่มีเอกสาร) |
| หน้าเว็บ | หน้าใน `(dc)`: `npm run dc:check` (F16, CI) หลัง `npm run build` เปิดทุกหน้าของ `out/` ที่กว้าง 360px ด้วย `playwright-core` และเปิดหน้าแรกอีกที่ 320, 390, 768, 1440 และ 1920px (F31) และตั้งแต่ F40 เปิด `/reports` ที่ความกว้างเดียวกันด้วย · `npm run dc:budget` (CI) อ่านไฟล์ใน `out/` · หน้า PA: `pa:snapshot` แล้ว `pa:compare` (docs/agents/gas-deploy.md) · เกณฑ์อื่นใน FEATURES ตรวจด้วยมือ (`npx serve out`, DevTools, Lighthouse) | `dc:check` จับกฎ §4 ที่เห็นได้บนหน้าที่ render แล้ว: request ไป `script.google.com`, control ที่ไม่มี label, ตารางที่ไม่มี `<caption>`, กราฟ SVG ที่ไม่มี `role="img"` + `aria-label` (SVG ที่มีปุ่มข้างใน เช่นตำบลบนแผนที่ ต้องเป็น `role="group"` + `aria-label`), scroll แนวนอนระดับหน้า (หน้าแรก ตั้งแต่ F40 `/reports` และตั้งแต่ F52 รายงานแรกของทุกตารางใน `src/lib/dc/tables/index.ts` ตรวจทุกความกว้างข้างต้นและล้มพร้อมความกว้างนั้น), ตั้งแต่ F52 รายงานที่เบราว์เซอร์โหลด chunk ของหน้าตารางอื่น (หน้าของแต่ละตารางมี `data-table-page` ที่ root ซึ่ง `dc:check` หาในไฟล์ JavaScript ที่รายงานขอ) ล้มพร้อม `opendata_id` และชื่อหน้า, ตั้งแต่ F40 HTML ของ `/reports` ที่ build ออกมา (ก่อนรัน JavaScript) ไม่มีลิงก์ `/reports/{opendata_id}` ของรายงานใดใน `catalog.json` ของ build นั้นที่ตารางต้นทางมีหน้า, คำว่า "จำลอง"/"ตัวอย่าง" และ error ในหน้า · ตั้งแต่ F62 รายงานที่รอวิเคราะห์ใน `catalog.json` ของ build (ตารางต้นทางไม่อยู่ใน `src/lib/dc/tables/index.ts`) `dc:check` เตือนพร้อมชื่อรายงานและตารางต้นทาง ไม่ล้ม · บนหน้าแรก `dc:check` เปิดอีกหน้าที่จอกว้าง แล้วเทียบตัวเลขประชากรที่หน้าแสดงกันเอง ตามที่ `population.json` ของ build นั้นบอกว่ามีข้อมูล และล้มพร้อมชื่อพื้นที่ กฎแต่ละข้อ (ยอดรวม กราฟ พีระมิด) อธิบายไว้ที่ฟังก์ชันของมันใน `src/scripts/dc-check.mjs` กฎที่เพิ่มก็อธิบายไว้ที่ฟังก์ชันของมัน · `dc:budget` จับ JavaScript ของ `/`, `/reports` และตั้งแต่ F52 ทุก `/reports/{id}` (ไม่รวม chunk ของหน้าตารางที่ `next/dynamic` โหลด ตามรายการใน `react-loadable-manifest.json` ที่ `next build` เขียนใน `.next/` ซึ่งไม่อยู่ในเอกสาร Next.js ถ้าไม่มีไฟล์นี้ `dc:budget` ล้ม) ที่เกินงบ SPEC §9.6 และ font preload บนหน้า Data Center · ไม่จับว่าตัวเลขตรงกับต้นทางหรือคำนวณถูกตาม SCHEMA และไม่จับความเร็ว · ไม่มี e2e ใน CI ในเฟส 1 |

- CI รัน `npm run lint`, `npm test`, `npm run build` แล้ว `npm run dc:budget` และ `npm run dc:check` บน Node 24 ทุก PR ต้องผ่านทั้งหมด
- format เป็นของ Prettier (devDependency `prettier` pin เวอร์ชัน ผู้ใช้อนุญาต 13 พ.ย. 2569) ค่า default ทั้งหมดยกเว้น `printWidth: 120` ใน `.prettierrc.json` · ตรวจทั้ง repo ยกเว้นไฟล์ใน `.gitignore` และ `.prettierignore` (ไฟล์ PA ตาม §1 และสคริปต์ PA เดิม, fixture, Markdown และ JSON) ไฟล์ใหม่จึงถูกตรวจทันที · `npm run format` เขียนแก้ ส่วน `npm run lint` ตรวจด้วย `prettier --check .` จึงล้มใน CI เมื่อ format ไม่ตรง reviewer ไม่ต้องทักเรื่อง format
- ไม่ mock ภายในโมดูลของตัวเอง (anti-pattern ของ `/tdd`) mock เฉพาะขอบเขตภายนอก (GAS services, HTTP)

## 6. Git และ PR

- branch ต่อ ticket: `feat/F##-<slug>` จาก `main` · PR เข้า `main` · merge แบบ squash
- หลัง squash merge ลบ branch ของ PR นั้นทั้ง local และ origin: `git checkout main && git pull --ff-only` → `git branch -D <branch>` (ต้องลบตามชื่อ เพราะ squash merge ทำให้ `git branch --merged` มองไม่เห็น) → `git push origin --delete <branch>` → `git fetch --prune` · ลบเฉพาะ branch ของ PR ที่ merge แล้ว
- commit message: `feat:`/`fix:`/`docs:`/`chore:` + สรุปสั้น (ตามประวัติเดิมของ repo)
- PR body ตามเทมเพลต `/pr` (Summary, Evidence, Merge Danger) ระบุ `Closes #<issue>` และผลเทสต์/ภาพหน้าจอเป็น Evidence
- ห้าม force-push branch ที่มีคนอื่นดึงไปแล้ว และห้าม push ตรงเข้า `main`
- ไม่ commit `public/data/` และไฟล์ที่มีความลับ
