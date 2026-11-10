# Song Health Data Center — V7.6 Final Polish

## Intent
A final restraint pass over V7.5: less UI chrome, fewer nested borders, fewer pill-like buttons, same functionality.

## Visual rules
- A filled button marks the primary action only. Secondary actions are plain text links.
- Use boundary containers for **sections or data modules**, not every row.
- List items should be recognizable clickable rows by hover/focus and a chevron, not raised button cards.
- Keep semantic hierarchy via headings/spacing/typography. Remove decorative English section numbers and repeated helper labels.
- The map and population graph remain distinct visual modules, but nested boxes have been flattened.
- The pyramid still shows numbers beside both male and female bars; its scope follows selection.

## Preserved interactions
- Map polygon, select input, and population table/chart select a tambon.
- Selection synchronizes contextual responsible-facility list and population pyramid.
- Service directory shows villages by responsible tambon using expandable groups.
- Reset returns to district overview; Escape closes service drawer.
- The report directory still links to real report pages.

## Data integrity
- Population totals and tambon stats are from the previous prototype's source.
- District pyramid is still demonstrative age-by-sex data, distributed over 46,362 categorized residents; district-level 60+ summary remains 13,487 (29.09%).
- Village catchments and tambon-level pyramid distribution are mockups for UX only. Do not publish them as official.
- The map boundary is illustrative, not genuine GIS.

## Implementation notes for Claude Code
- Carry Tailwind v4 token classes into existing React/Astro source, not the compiled prototype HTML as a production codebase.
- Use semantic buttons only for actions and links for navigation.
- Replace mocked facility-to-village records with verified HCODE / administrative village IDs.
- Test reduced-motion, focus traps, chart button accessibility, chart selection, and responsive at 320–1920px.
