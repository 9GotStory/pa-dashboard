# Song Health Data Center — รายงานสุขภาพ V1.4 Final QA

**วันที่:** 10 พฤศจิกายน 2569  
**Scope:** Standalone HTML Prototype · Chromium/Playwright · Tailwind CSS v4 compiled  
**Result:** **PASS (local prototype)** · **Next.js v16 / Production integration NOT TESTED**

## Verified

| Test | Result |
|---|---|
| HDC official `main_report_name` / `category_name` unchanged in Sidebar, Mobile, Results Heading | PASS |
| No hard-coded abbreviated topic aliases (`shortNames`) | PASS |
| Catalog reference 2 main categories, 6 topics, 21 unique report IDs | PASS |
| Default listing 21 reports at widths 320, 390, 768, 1440, 1920px | PASS |
| No horizontal overflow at all five widths | PASS |
| No JavaScript page errors in tested interactions | PASS |
| Full vaccine topic selected in sidebar → correct official heading and 8 reports | PASS |
| Full NCD long heading on Desktop, very long topic heading on Mobile | PASS · no overflow |
| Hidden source codes not shown as report rows | PASS |
| `s_epi_complete` search → 4 matches + one compact metadata-match explanation | PASS |
| Thai `เบาหวาน` search + `<mark>` highlights → 2 matches | PASS |
| Category + incompatible search → contextual empty state, `ค้นหาทุกหัวข้อ` → 2 matches | PASS |
| Clear/reset restores 21 results | PASS |
| Search injection text cannot create an image/script element | PASS |
| Explicit `catalog_status=removed` flag → restrained status text, entry remains visible | PASS using synthetic flag in isolated QA copy; **no synthetic record in deliverable** |
| No-JavaScript mode still shows initial 21 links / 6 topic sections | PASS |
| Sidebar links reach 44px minimum height | PASS |
| `prefers-reduced-motion: reduce` disables row transitions | PASS |
| Mobile menu opens and closes on Escape | PASS |
| Desktop Hero height 214px | PASS |

## Unverified / integration gates

1. **Next.js v16 App Router**, Server Component, actual Snapshot read, build/static export and Cloudflare deployment were NOT run. The shipped HTML is a prototype, not a Next.js app.
2. **Browser Back/Forward on HTTP staging origin** could not be tested: sandbox Chromium blocks `http://127.0.0.1` navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Prototype `popstate` logic exists but real integration is pending.
3. Destination URLs follow the original `opendata_id` from the repository fixture but have not all been opened against Production in this QA.
4. No complete screen-reader audit (NVDA/VoiceOver), third-party accessibility automation suite, performance audit, or current production metadata verification performed.
5. The reference catalog comes from the **4 November 2026 Fixture**, not live `public/data/catalog.json`. All counts are therefore fixture-backed until staging uses verified actual catalog.
6. The approved UX direction removes 10/20 pagination and the latest-year column from the listing. Before implementation, update `SPEC.md` §9.3 through the project's normal approval process and preserve useful behavior for historic query links with `page` and `size`.

**Verdict:** V1.4 prototype is ready for Product Owner's **final visual review** and subsequent controlled engineering handoff. **No repository or Production changes were made.**
