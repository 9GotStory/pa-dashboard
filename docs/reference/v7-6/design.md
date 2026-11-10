# Song Health Data Center — Design System & UX Specification

> **Version:** 7.6 — Final Polish baseline  
> **Status:** Approved visual/UX reference for implementation; **not** production data approval  
> **Updated:** 10 November 2026  
> **Scope:** Homepage of **Song Health Data Center** (`songhealth-dc.pages.dev`), Amphoe Song, Phrae  
> **Visual reference:** `songhealth_home_v7_6_final_polish.html`  
> **Companion documents:** `V7_6_FINAL_POLISH_HANDOFF.md`, `V7_6_QA_RESULTS.md`

## 1. Purpose and non-negotiable decisions

The product is a **district health information portal**, not a performance-scorecard dashboard. The homepage helps residents and health personnel understand population, geographic coverage, health service networks, age structure, and available reports without being forced through a sequence of modal dialogs.

### Design principles (priority order)

1. **Information first.** Clear hierarchy, readable values, and grounded context take precedence over decoration.
2. **Less UI chrome.** Reduce borders, card nesting, badges, decorative labels, and permanently visible buttons.
3. **Overview → explore → detail.** Show essentials in place; reveal further information only when genuinely useful.
4. **One area selection, consistent context.** A selected tambon influences geographic context, related facilities, population comparison, and population pyramid together.
5. **Different questions, different views.** Population comparison and age pyramid are distinct analytical tools. Neither should replace the other.
6. **Never misrepresent prototypes as official data.** Coverage hierarchy, schematic polygons, and age-by-sex values must remain clearly labeled mocks until replaced and verified.
7. **Accessible by default.** Every interactive feature works with keyboard and touch; essential numbers cannot be hover-only.

**Terminology:** Avoid **“KPI”** for basic population and area counts. Use *ภาพรวมประชากร*, *ข้อมูลพื้นฐานพื้นที่*, *สถิติประชากร*, and *โครงสร้างประชากร*. Reserve KPI for measured performance **against a target**.

**Technology constraints:** Use **Tailwind CSS v4** utilities and its native theme/token configuration; **do not create a separate handwritten/pure-CSS styling layer**. Prefer **Lucide icons or the existing consistent SVG icon library**. Do not use emoji as UI icons. Integrate with the existing application architecture rather than rewriting it from the standalone prototype.

## 2. Information architecture

The homepage contains exactly these primary content modules, in this order:

| Order | Module | Primary purpose | Primary interaction |
|---|---|---|---|
| 1 | Header + Hero | Introduce the data center and point to area exploration | One filled CTA; secondary plain link |
| 2 | Population Overview | Summarize district-wide population and administrative area | Mostly read-only; no meaningless click-through |
| 3 | Geographic Explorer | Select among 8 tambons; understand geographic and service context | Map polygon, native dropdown; contextual facility list |
| 4 | Population Comparison | Compare the 8 tambons by population / household counts | Chart by default; optional table and sort |
| 5 | Population Pyramid | Compare male/female counts by five-year age group | Visible labels; select age row; responds to selected tambon |
| 6 | Report Directory | Navigate to six existing report categories | Direct semantic links, no modal duplicates |
| 7 | Sources + Footer | Give provenance and limitations | Outbound links only if relevant |

The header keeps the existing destinations: หน้าแรก, ข้อมูลพื้นที่, โครงสร้างประชากร, คลังรายงาน, PA Dashboard. Keep the PA Dashboard as a **separate destination**, not as an excuse to fill the homepage with indicators.

Do not add new sections or duplicate demographics/date references in the Hero, map, and chart simply to make the page look fuller.

## 3. Visual foundation

### 3.1 Color tokens

The following colors are anchored in V7.6. Name them semantically within Tailwind v4 and avoid scattering arbitrary new shades throughout components.

| Token / use | Reference color | Notes |
|---|---|---|
| `brand-deep` | `#153d32` | Strong headings / deep brand text |
| `brand-primary` | `#155f4b` | Main primary action and selected context |
| `brand-accent` | `#198467` | Links, highlights, focus accents |
| `brand-dark-surface` | `#174e42` | Hero art / elderly summary when appropriate |
| `canvas` | `#f8f9f6` | Overall page background |
| `surface` | `#ffffff` | Content modules; avoid excessive nesting |
| `surface-muted` | `#eef3ed` | Section alternation, geographic context |
| `border-subtle` | `#e0e8df` | Sparse module boundaries and separators |
| `text-secondary` | `#6a8073` | Explanatory copy / metadata |
| `pyramid-male` | `#3d92a0` | Male population bars and labels |
| `pyramid-female` | `#cb8795` | Female population bars and labels |
| `highlight-soft` | `#e8f5e9` | Selected tambon / selected list row |

Rules:

- Green is the product identity; blue-green and muted rose are **data encodings** for the population pyramid, not extra CTA colors.
- Use dark backgrounds for **one intentional focal module**, not every card.
- Prefer whitespace, type contrast, and soft background changes over outlines to create grouping.
- Subtle borders should never form a visible outline around each line of text.
- Maintain WCAG AA contrast for text and functional controls; adjust token values when needed after measurement.

### 3.2 Typography

Use the application's existing Thai-capable sans-serif font stack consistently; do not introduce a competing decorative typeface or a full-font migration solely for this redesign. Preserve Thai readability and natural line breaks.

| Role | Desktop guidance | Mobile guidance |
|---|---|---|
| Hero statement | ~56–64px, bold | ~36–44px, bold, no forced long lines |
| Section heading | ~28–35px, bold | ~24–28px, bold |
| Major statistic | ~40–58px, tabular numbers | ~32–44px |
| Content heading | ~16–20px, bold | ~15–18px |
| Normal body | ~13–16px | ~13–15px |
| Secondary metadata | ~11–12px | ~11–12px; ensure contrast |
| Chart/bar labels | ~11–12px, tabular numbers | ~10–12px; remain visible |

Use `font-semibold`/`font-bold` selectively. Numerical values should use `tabular-nums`. Prefer Thai labels over ornamental English uppercase microheadings. Preserve English only when it contributes to navigation/product identity.

### 3.3 Layout and spacing

- Page max content width: **1320px**; centered using Tailwind responsive horizontal padding.
- Use a **4/8px spacing rhythm** (8 / 12 / 16 / 24 / 32 / 48 / 64px for common gaps).
- Hero is intentionally a single combined composition; avoid placing other floating statistic cards inside it.
- A module may have **one outer boundary**. Avoid inner card-on-card-on-card patterns.
- Alternate section backgrounds to establish page rhythm; do not add a colored panel around every statistic.
- Corner radii: use moderate radius for controls and larger radius only on major surfaces; resist indiscriminate `rounded-full`.
- A divider belongs between sections/rows **only when needed**; use one understated line rather than separate boxes.
- Do not make every label a pill/badge. A small status badge is warranted for **Mockup / รอยืนยัน** only where it changes the trust level of the data.
- Responsive review widths: **320, 390, 768, 1440, 1920px**; support intermediate widths too. Layout breakpoints should match content needs, not device brand names.

## 4. Control and border policy — critical V7.6 decision

The previous design was excessively button- and border-heavy. These rules are **acceptance criteria**, not optional styling suggestions.

| Situation | Use | Avoid |
|---|---|---|
| Hero primary navigation | **One filled button** “สำรวจข้อมูลพื้นที่” | Multiple competing filled buttons |
| Hero secondary navigation | Plain text link with icon/underline on focus/hover | Another filled/outlined pill |
| Read-only statistic | Typography and subtle group spacing | Wrapping the entire metric in an interactive-looking card |
| Select tambon | Native `<select>` plus clickable map polygons | Adding separate button chips for every tambon |
| Facility list in selected area | Flat rows, faint divider, chevron/hover/focus affordance | Raised rounded button card for each facility |
| Browse service detail | One contextual drawer on explicit user action | A new modal for every small number or label |
| Switch table ↔ chart | One compact segmented control | Two giant full-width CTAs |
| Age pyramid row | Lightweight clickable row with visible values, selected styling | A bordered tile around each age bar |
| Report destination | Semantic `<a>` list row | Button + modal + extra navigate button |
| Reset filter | Low-emphasis text button | Additional prominent green button |

**Heuristic:** Before adding any border or button, ask: “Does it identify a meaningful group or action that users cannot otherwise recognize?” If not, remove it. Keep clear **hover, focus-visible, selected, disabled, and loading** states for genuine controls, so a minimal UI remains discoverable.

## 5. Section-by-section implementation contract

### 5.1 Hero

- Keep the editorial positioning: **“มองเห็นพื้นที่ เข้าใจสุขภาพ.”**
- Left: one headline, concise description, **one primary action**, optional secondary text link.
- Right: abstract district-inspired visual with restrained lines/dots. **Not an official geographic boundary** and **not another full map**.
- No giant `5406` numerals, repeated province population statistics, or stacked decorative status cards.
- On mobile, **reduce Hero art height substantially** so the Overview begins without unnecessary scrolling. Keep headline and first action visible early.

### 5.2 Population Overview

- Show total **46,527**, male **22,475**, female **24,052**, administrative area **8 tambons** as reference values from the approved prototype. Reconfirm the dataset when implementing against the live system.
- Show the source/date reference **once** near the population overview (current prototype: **31 December 2025 / 31 ธันวาคม 2568**, Department of Provincial Administration).
- Do **not** call these KPI.
- Prefer an integrated horizontal stats strip on desktop; on small screens stack in a sensible reading order with minimal separators.
- These values are not generic CTA buttons; detailed exploration happens in the following sections.

### 5.3 Geographic Explorer and selected tambon

The map is the geographical entry point. Its selected state is the **shared page context**.

- Default: district overview, no tambon selected.
- User selects a tambon using a **map polygon**, **dropdown**, or a **row/mark in Population Comparison**.
- Selection updates map highlight, dropdown value, population comparison emphasis, **related service list**, and **Population Pyramid**.
- Selected-area panel shows tambon name, total / male / female / household counts, then **the related facility list**.
- Facility rows show name and appropriately brief supporting details. On click: open Service Explorer with selected facility and matching responsibility context.
- “ล้างการเลือก” restores **district** scope everywhere. Do not create separate conflicting reset states per section.
- When no area is selected, show a helpful district overview; **do not display all 17 service rows inside this panel**. Instead use a quiet link to open the service directory.
- Mockup schematic map may be used in documentation/prototypes only. Production requires verified **MOPH GIS / licensed map data** and a usable dropdown fallback if map assets fail to load.

### 5.4 Service Explorer and service responsibility hierarchy

**Hierarchy:** `หน่วยบริการ → ตำบลที่รับผิดชอบ → หมู่บ้านที่รับผิดชอบ`.

- Directory: search by facility name and location or responsibility terms. Filter by category and tambon.
- **Distinct concepts** in data and UI:
  - `locatedTambon`: where the service facility is physically situated.
  - `responsibleTambons[]`: areas for which it provides assigned coverage.
  - `villages[]`: official villages and their `moo` numbers under each covered tambon.
- **Never derive coverage from the facility address or name.** A facility may cover more than one tambon.
- If opened from a selected tambon, filter by **responsibility**, not merely physical location; preselect the tapped facility when applicable.
- Drawer on desktop; mobile detail view in the same drawer, with a clear back action. Keep width moderate and prevent unrelated page scroll.
- Coverage view: summary count (if available) → expandable tambon groups → flat numbered-village rows. Do **not** show the same count in header, filter badge, list item, and detail panel simultaneously.
- All current `facility → tambon → village` assignments in the prototype are **Mockup**. Display a visible, contextual warning and do not label them as official or “ตรวจสอบแล้ว”.
- Distinguish **no verified data** from **zero assigned villages**. If unavailable, say “รอยืนยันข้อมูลเขตรับผิดชอบ”.
- For production use verified HCODE, administrative tambon IDs, village IDs, and appropriate source/version timestamps.

### 5.5 Population Comparison

- Exactly 8 tambons in the data table/graph, based on the live dataset.
- Default view: **horizontal bar chart**. Secondary view: table. Keep both but never show both simultaneously.
- Support sorting where it helps (e.g., total population, households); maintain deterministic ordering.
- Selecting a bar/row changes the **same selected tambon state** as the map.
- Show values directly alongside chart marks where feasible; hover tooltip is supplemental, not required for understanding.
- On mobile, when the table cannot fit, allow **horizontal scroll with an explicit hint**, instead of shrinking numbers to illegibility.

### 5.6 Interactive Population Pyramid

- Age bands in **5-year groups** (e.g. 0–4 to 85+), male mirrored to the left and female to the right.
- **Display numeric male/female counts for every age band at rest.** Tooltips may add precision/metadata; they must not hide the primary figures.
- Tap/click/focus an age row to reveal the combined count and percent for the **current data scope**; no secondary modal.
- Default scope: **district**. Choosing a tambon anywhere above causes the pyramid and its elderly summary to update **to that tambon**; reset restores district scope.
- Show an unobtrusive scope label, e.g., “ทั้งอำเภอสอง” or “ตำบลเตาปูน”, with a low-emphasis reset. Do not add a large new filter box if context is already visible.
- On desktop, pyramid and elderly 60+ summary may sit side by side; on mobile, they stack in reading order.
- The confirmed district summary from the reference prototype is **60+ = 13,487 of 46,362 age-categorized residents = 29.09%**. There are **165** people not categorized by age; hence this denominator differs from total population **46,527**. Be explicit about the denominator.
- The **age-by-sex bars** and **tambon-specific age distributions** in the existing prototype are **simulated**. When real age-by-sex data is not available for the selected tambon, show a proper **data-unavailable state**; **never silently manufacture a plausible pyramid** in production.
- For implementation, derive elderly totals and proportions from the **same verified age-group dataset** within the selected scope, or use explicitly supplied authoritative aggregates. Do not mix mock bars with verified summary cards without a visible data-status distinction.
- Avoid a color-only legend: label both sexes with text and ensure accessibility names include age and counts.

### 5.7 Report Directory and sources

- Keep the **six existing categories and their real destinations**; do not invent categories or counts.
- Present categories as a structured list/grid of simple rows, using a single small icon and a clear title. Each category links directly to its actual page.
- Avoid nested CTA controls such as “open → view details → go to report” when a direct link suffices.
- Sources/footer show the data authority, reference date, and caveats in compact form; they are not independent promotional cards.

## 6. Interaction state model

Maintain **one source of truth** for area selection, ideally an official `tambonCode` (not a displayed Thai name). Suggested state:

```ts
type SelectedTambonCode = string | null;

type HomeViewState = {
  selectedTambonCode: SelectedTambonCode; // null = district scope
  comparisonView: 'chart' | 'table';
  comparisonSort: 'default' | 'population' | 'households';
  activeAgeBand: string | null;
  serviceDrawer: {
    open: boolean;
    facilityCode: string | null;
    responsibleTambonCode: SelectedTambonCode;
  };
};
```

Behavior table:

| Event | Geographic panel | Service panel | Pyramid |
|---|---|---|---|
| Initial load | District overview | Closed; no area filter | District scope |
| Select tambon | Show selected-area counts | Show related facilities inline | Switch to that tambon |
| Click related facility | Preserve selected area | Open drawer; select facility & responsible area | Preserve selected scope |
| Switch comparison chart/table | Preserve selection | No change | No change |
| Select age band | No change | No change | Show inline detail for band |
| Reset tambon | District overview | Clear responsibility filter on next open | Back to district scope |
| Close drawer / Escape | No change | Close and restore focus | No change |

Use meaningful empty, loading, error, and unavailable states. Do not reset selected context just because a detail drawer closes. If filters produce no services, show “ไม่พบหน่วยบริการตามเงื่อนไข” without implying no services exist in the actual tambon.

## 7. Data model and provenance

The visual prototype demonstrates structure; it is **not a master database**. Before production, map fields to authoritative records and verify freshness, licensing, and completeness. Show only **approved aggregate/public data** in the homepage; do not expose individual patient records, personal identifiers, or internal-only service data.

```ts
type DataStatus = 'verified' | 'mock' | 'pending' | 'unavailable';

type PopulationArea = {
  tambonCode: string;          // official code
  tambonName: string;
  populationMale: number;
  populationFemale: number;
  populationTotal: number;
  households: number;
  asOf: string;                // YYYY-MM-DD
  sourceName: string;
  status: DataStatus;
};

type AgeSexCount = {
  tambonCode: string | null;   // null = entire district
  ageStart: number;
  ageEnd: number | null;       // open-ended last band
  male: number;
  female: number;
  asOf: string;
  sourceName: string;
  status: DataStatus;
};

type ServiceCoverage = {
  tambonCode: string;
  tambonName: string;
  villages: Array<{
    villageCode: string;       // official village identifier
    moo: number;               // local village number
    villageName: string;
  }>;
};

type HealthFacility = {
  hcode: string;
  name: string;
  category: 'hospital' | 'phc' | 'community';
  locatedTambonCode: string | null;
  locatedVillageCode: string | null;
  coverage: ServiceCoverage[];
  status: DataStatus;          // coverages may need separate provenance
};
```

### Provenance rules

- **Population summary** numbers in V7.6 are prototype reference values sourced from the existing page; validate against the actual dataset before release.
- **Age-by-sex group detail:** prototype/mock unless supplied by verified source. District 60+ reference is documented above.
- **Tambon-specific age pyramid:** mock; do not publish proportional estimates as observed demographic facts.
- **Facility responsibility and village assignments:** mock. Names and mock village numbers in the prototype are **not verified assignments**, and must not become production records by copy/paste.
- **Map polygons:** illustrative in the prototype; use actual spatial boundaries for production.
- **Facility locations:** partially sourced; do not infer full location metadata for entries without verified records.
- Make data status visible where it materially changes interpretation; avoid cluttering every row with repeated disclaimer badges.

## 8. Responsive and accessibility acceptance

### Responsive

- **320–390px:** single-column reading flow; compressed Hero; map with usable select fallback; pyramid values remain legible; no full-width fixed drawer exceeding viewport.
- **768px:** responsive table/graph controls and comfortable chart width; preserve side-by-side only if labels remain readable.
- **1024px+:** map + context panel; pyramid + elderly summary can use two columns.
- **1440–1920px:** centered content, max width respected; avoid huge whitespace inside charts and avoid excessively stretched bars.
- **All widths:** no page-level horizontal overflow; only the explicitly scrollable table may scroll horizontally.

### Accessibility and behavior

- Use semantic `<button>` for actions and `<a>` for navigation. Do not attach click handlers to static metric labels.
- Map regions need keyboard focus, accessible names and Enter/Space activation; provide equivalent dropdown.
- All age rows have accessible names including **age band, male, female, scope**; show numbers visually too.
- `aria-pressed` / selected state is updated consistently in chart, map, and view toggle where appropriate.
- Drawer uses `role="dialog"`, accessible title, trapped focus when open, focus restoration on close, and Escape support.
- Touch hit targets aim for **44×44px** where feasible, even when the visible list row is stylistically minimal.
- Use `focus-visible` affordances; support `prefers-reduced-motion` for all scrolling and animation.
- Expose asynchronous state changes via accessible live regions only where helpful; avoid noisy announcements.
- Provide clear source/denominator descriptions for important statistical calculations.

## 9. Engineering handoff for Claude Code

1. **Inspect the existing repository and its real application components** before coding. The V7.6 HTML is a visual and interaction reference, **not** a drop-in production replacement.
2. Implement styles using **Tailwind CSS v4** and existing tokens/components. Do not layer bespoke handwritten CSS on top or introduce a second CSS framework. Compiled CSS embedded in the HTML is **build output**, not design source.
3. Preserve existing routes, APIs, report IDs/slugs, GIS integration points, SEO metadata, and authentication boundaries as applicable.
4. Create reusable components around domain concepts, not around arbitrary colored boxes: `Hero`, `PopulationOverview`, `AreaExplorer`, `TambonContext`, `FacilityDirectory`, `FacilityDetail`, `PopulationComparison`, `PopulationPyramid`, `ReportDirectory`.
5. Centralize `selectedTambonCode` and derive dependent views. Do not duplicate selection state in uncoordinated components.
6. Replace all mock data only through verified mappings with source and timestamp; keep appropriate loading/unknown/empty states instead of fallback fake values.
7. Do not add new KPI widgets, decorative badges, duplicate text labels, or extra CTA buttons unless there is a new explicitly approved requirement.
8. Test keyboard/touch interactions, mobile layout, source/status display, and data consistency before pull request review.

### Suggested QA checklist

- [ ] Hero has only one prominent filled CTA; secondary navigation is an ordinary link.
- [ ] No excess nested card borders, repeated divider outlines, or badge decoration.
- [ ] District totals, source date, and denominator are correct and not unnecessarily repeated.
- [ ] All 8 tambons are selectable via dropdown and map/graph and share the same state.
- [ ] Selected tambon shows **responsible** facilities, not merely facilities **located** there.
- [ ] Clicking a facility opens correctly scoped coverage detail; mobile back/Escape/focus work.
- [ ] Service coverage is verified before public display; mock assignments never silently leak.
- [ ] Pyramid shows male/female numbers without hover; age rows can be selected by keyboard/touch.
- [ ] Changing tambon updates the age pyramid and elderly summary only from matching verified data; unavailable data is clearly marked.
- [ ] Reset restores district scope across geographic overview, facilities, and pyramid.
- [ ] Report category links lead to existing reports; no fake or dead links.
- [ ] No console errors or unexpected horizontal overflow at 320, 390, 768, 1440 and 1920px.
- [ ] Reduced-motion, contrast, and focus-visible states are verified.
- [ ] No individual health records or personal identifiers appear in frontend responses, source files, or demo fixtures.
- [ ] No emoji icons, no `javascript:` links, and no extra styling framework.

## 10. Explicit out-of-scope items

- Rebuilding the whole Song Health platform or redesigning unrelated products.
- Turning the homepage into a health performance KPI dashboard.
- Adding more charts, pages, fancy widgets or modal dialogs just for visual novelty.
- Publishing generated/demo village names, coverage assignments, or age-group numbers as factual records.
- Using the illustrative eight-zone polygon drawing as official Song District geometry.
- Changing the backend/data contract without confirming actual integration needs.

---

**Final design decision:** V7.6 is the **approved visual direction**: **less chrome, strong typography, clear data hierarchy, and interactions available only where they add value**. Any implementation change that adds visual clutter or fabricates data conflicts with this spec and should be reviewed before merging.
