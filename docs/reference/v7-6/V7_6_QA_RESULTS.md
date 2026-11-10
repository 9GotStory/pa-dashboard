# Song Health V7.6 — Final QA

## Tested
- Headless Chromium via Playwright at 320, 390, 768, 1440, and 1920 px.
- Selected tambon from geographic dropdown: related service list and pyramid sync.
- Clicked facility name: detail drawer opens with responsible tambon and mock village list.
- Directory filter is based on *responsible* tambon, not only facility location.
- Selected a map polygon: facility list and age pyramid update.
- Reset selection: district overview and pyramid restored.
- Open and Escape close the service dialog.
- No page-level horizontal overflow or unhandled JavaScript page errors in this test suite.

## Visual review
- Full-page desktop and mobile screenshots taken.
- Reduced repeated borders, nested cards, pill buttons, ornamental English eyebrows, and duplicated warnings.
- Kept one clear main CTA, plain secondary links, accessible row hover/focus patterns, and contextual service details.
- Reduced the mobile Hero illustration's height; the district summary/pyramid remain legible.
- District 60+ number shown as 13,487 / 29.09% over 46,362 residents categorized by age.

## Not covered / production caveats
- This is a standalone visual prototype, not deployed production code.
- Village assignments and responsibility hierarchy are sample data.
- Tambon-level population pyramid values are simulated; the age-by-sex bars are prototype data.
- GIS shapes are schematic, not official geographic boundaries.
- Before public release verify HCODE, mapped villages, GIS, source dates, mobile keyboard / screen reader usage, and backend integration.
