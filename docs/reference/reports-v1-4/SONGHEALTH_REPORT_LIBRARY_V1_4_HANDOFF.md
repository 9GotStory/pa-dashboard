# Song Health Data Center — รายงานสุขภาพ V1.4 Final Design Handoff

**สถานะ:** FINAL DESIGN PROTOTYPE · รอ PO ตรวจรับ · **ไม่ใช่การอนุมัติ Production**  
**วันที่:** 10 พฤศจิกายน 2569  
**หน้าที่เกี่ยวข้อง:** `/reports` (คง URL เดิม)  
**Visual Baseline:** `songhealth_home_v7_6_final_polish.html` และ `design.md` V7.6  
**Repository เป้าหมายเมื่อ PO อนุมัติให้พัฒนา:** `9GotStory/pa-dashboard` · ห้ามแก้ไข Push, Merge, Deploy โดยไม่อนุมัติ

## 1. Final PO Design Decisions

1. ชื่อหน้าในเมนู/H1/title เป็น **รายงานสุขภาพ** เท่านั้น; URL `/reports` และเส้นทาง `/reports/{opendata_id}` ไม่เปลี่ยน
2. **ชื่อจาก HDC ต้องแสดงตามแหล่งข้อมูล** ไม่สร้าง `shortNames` หรือชื่อทางเลือก: หมวด `main_report_name`, หัวข้อ `category_name`, รายงาน `report_name`. ใช้ชื่อทางการเหมือนกันทั้ง Desktop Sidebar, Mobile Select, และ Results Heading
3. `subgroup` มาจากระบบที่จัดกลุ่มอยู่แล้วและต้องคงไว้ เช่น กลุ่มอายุ 1/2/3/5 ปีสำหรับรายงานวัคซีน; อย่าตีความว่าเป็นชื่อจาก HDC โดยตรง
4. `source_table`/`opendata_id` เก็บไว้เพื่อรองรับ Search และ Route แต่ **ไม่แสดงเป็นป้ายใต้ชื่อรายงาน**
5. ยึด Less UI, Better Experience: Compact Hero, Editorial Directory, ตัวอักษรปกติในแถว, Header หัวข้อกึ่งหนา, Sidebar แยกชั้นด้วยการเยื้อง, Spacing และ Divider บาง ๆ
6. Live Search + `<mark>` highlight, contextual empty-state และ Search All; hover background + subtle arrow, focus-visible, reduced motion
7. หน้ารวมเสนอให้แสดงทุกแถวต่อเนื่องตามหมวดโดยไม่เพิ่ม Sort/Carousel/Featured/การ์ดตัวชี้วัด; **ก่อนนำไปใช้จริงต้องอัปเดต SPEC §9.3 และกำหนดนโยบายเมื่อจำนวนรายการเติบโต**
8. **Next.js v16 ใช้เฉพาะ Frontend** (App Router + TypeScript), Tailwind CSS v4, Lucide. รักษา Backend GAS/Sheets และ Build-Time Snapshot architecture เดิม

## 2. HDC catalog mapping

| HDC/source field | UI behavior |
|---|---|
| `main_report_id`, `main_report_name` | อ้างอิง ID สำหรับ filter, แสดงชื่อหมวดตามจริง |
| `cat_id`, `category_name` | อ้างอิง ID สำหรับ filter, แสดงชื่อหัวข้อจาก HDC ทุกจุด |
| `report_name` | ชื่อแถวรายการ, ไม่แทนที่ด้วย label ประดิษฐ์ |
| `opendata_id` | `/reports/{opendata_id}` ตรงตามตัวพิมพ์เดิม |
| `source_table` | ค้นหาได้ภายในระบบ แต่ไม่แสดงใน list |
| `subgroup` | แสดงเป็นหัวข้อย่อยเมื่อมีค่า |
| `catalog_status = "removed"` | **แสดง** ข้อความรอง “HDC ไม่แสดงรายงานนี้แล้ว”; ไม่ตัดรายงานออก |
| `years`, `max_date_com`, `synced_at` | ให้แสดงปี/วันที่จริงตาม metadata ที่ยืนยันแล้วเท่านั้น; ห้ามนำวันที่ fixture มาแทน |

**ขอบเขตตัวต้นแบบ:** อ้างอิง Catalog Fixture `src/lib/dc/fixtures/catalog-20261104.ts` ที่ตรวจพบใน Repository เดิม ณ วันที่ 4 พ.ย. 2569 มี **2 หมวด, 6 หัวข้อ, 21 รายงาน** ตัวเลขนี้ไม่ใช่การยืนยัน Production Snapshot ล่าสุด และ **ไม่ควรแสดงวันที่ fixture ในหน้าจอผู้ใช้งานจริง**. Fixture ไม่มีสถานะ `removed` ให้ทดสอบกับระเบียนจริง จึงทดสอบการแสดงสถานะโดยการจำลอง flag เฉพาะใน QA และ **ไม่ใส่ข้อมูลปลอมเข้าไฟล์ส่งมอบ**.

### HDC official category names preserved in V1.4

**หมวด ส่งเสริมป้องกัน**
- อนามัยแม่และเด็ก
- การสร้างเสริมภูมิคุ้มกันโรค
- การเฝ้าระวังด้านส่งเสริมสุขภาพและอนามัยสิ่งแวดล้อม
- การคัดกรอง

**หมวด ข้อมูลตอบสนอง Service Plan**
- ข้อมูลเพื่อตอบสนอง Service Plan สาขาโรคไม่ติดต่อ (NCD DM,HT,CVD)
- ข้อมูลเพื่อตอบสนอง Service Plan สาขาสุขภาพช่องปาก

ชื่อทั้งหมดด้านบนมาจาก Fixture ที่ตรวจใน Repository; เมื่อพัฒนา ให้ใช้ `readCatalog().mains` จาก Snapshot จริงเป็น Single Source of Truth โดยตรง

## 3. Proposed Next.js v16 frontend component outline

```text
ReportsPage (Server Component · App Router)
├─ Existing Masthead (shared)
├─ CompactReportsHero (Server Component)
├─ ReportDirectoryShell (Server Component from readCatalog())
│  ├─ InitialCatalogList (server-rendered, accessible report links)
│  └─ ReportDiscovery (client enhancement)
│     ├─ SearchField
│     ├─ OfficialHdcCategoryNav (desktop)
│     ├─ OfficialHdcCategorySelect (mobile)
│     ├─ ResultsHeading / count
│     ├─ ReportTopicSection / Subgroup / LinkRow
│     └─ EmptySearchRecovery
└─ Existing Footer
```

Reuse the actual application components and existing routes rather than copying the standalone HTML wholesale. Avoid a new Next.js backend and avoid bespoke/pure CSS. In the standalone V1.4, Tailwind CSS v4 is **precompiled** into the HTML `<style>` for one-file opening; the `.source.html` includes a marker for compiling again.

**Search text safety:** React should render segmented text and `<mark>` via safe elements, not `dangerouslySetInnerHTML`; never interpolate an unescaped query or untrusted catalog fields into HTML.

**Initial HTML:** V1.4 includes the 21 static listing rows in HTML so content is available before JavaScript / with JS disabled (demonstrates an App Router server-rendering target). Real Next.js should server render from the **current snapshot**, not embed this fixture.

## 4. Navigation, filtering and URL contract

- `cat` overrides `main` if both query keys exist; one chosen topic OR one parent category at a time
- Search is AND with the category; it searches canonical name, subgroup, report name, source_table and opendata_id
- Clicking an official category changes selected state and focuses the Results Heading; Space/Enter keyboard support via real anchors and native Select
- `ค้นหาทุกหัวข้อ` clears `main`/`cat` but preserves `q`; `แสดงรายงานทั้งหมด` clears both search and category
- Only show **one** small informational note when matches are found solely through hidden technical metadata, not per-row status pills
- `catalog_status=removed`: render only on explicit flag, never infer it from missing value
- Keep shared URL params `?main`, `?cat`, `?q`; account for legacy `?page`, `?size` gracefully when changing SPEC, and verify Back/Forward/refresh in a real Next.js 16 staging environment
- Do not change any report destination ID or the existing detail-page content

## 5. Acceptance checks for implementation / release gate

- [ ] Snapshot source is verified, count reflects latest catalog (fixture counts are not hard-coded)
- [ ] HDC official labels from catalog only, unchanged in Desktop / Mobile / Results; long labels wrap and remain readable at 320px
- [ ] Removed reports are visible with restrained status text; no fake active statuses
- [ ] Existing URL filters and detail links work; old `page`/`size` links still yield useful lists
- [ ] Initial report rows are available in server-rendered HTML; no empty-JS-first results flash
- [ ] Search Thai, technical metadata, subgroup, highlight, no-result and search-all work
- [ ] Keyboard focus, screen-reader names and target heights support accessibility; check WCAG AA and reduced-motion
- [ ] Responsive 320/390/768/1440/1920px and intermediate widths; no page-level overflow
- [ ] No source ID exposed as badge; no extra frames/buttons/UI library; no new CSS styling layer
- [ ] Test Next.js 16 local/staging origin Back/Forward/refresh, links, SSG/static export, and actual production metadata (not covered by standalone QA)
- [ ] Get explicit PO authorization before changing Repo SPEC, PR/Merge, or Production

## 6. Files and QA scope

- `songhealth_report_library_v1_4.html` — runnable standalone HTML with Tailwind v4 compiled
- `songhealth_report_library_v1_4.source.html` — editable prototype source with Tailwind placeholder
- `songhealth_reports_desktop_v1_4.png` / `songhealth_reports_mobile_v1_4.png` — first-fold previews
- `songhealth_reports_desktop_full_v1_4.png` / `songhealth_reports_mobile_full_v1_4.png` — full page previews
- `SONGHEALTH_REPORT_LIBRARY_V1_4_QA.md`, `.json` — full list of checks and limitations
- `songhealth_report_catalog_reference.json` — annotated reference fixture, **not verified live production data**

**Final design status:** V1.4 meets the approved prototype UX direction. **Next.js integration QA and Production release approval remain separate gates.**
