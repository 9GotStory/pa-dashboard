# Fixtures of the data layer

Use this when a test of `src/lib/dc/` needs rows of a report: a ticket whose acceptance check names a snapshot date, a column a fixture does not have yet, or expected values SCHEMA does not list. Scripts named here live in `.wizard/` (gitignored, kept across reboots), like those of page-checks.md.

## Shape

- A fixture of report rows is a file in `src/lib/dc/fixtures/` named for the day the snapshot was built, such as `reports-annual-20261113.ts`. Prettier skips the folder.
- Each export is `{ report, headers, years }`: `report` as `reports/{id}.json` gives it, `years` keyed by ปีงบประมาณ. Rows are cut to the columns the tests read and list only their cells that are not `""` (HDC keeps 0 as `""`, SCHEMA §4.6.1). `headers` keeps the real order of the columns kept.
- A test turns it back into `DcReportData` with a `snapshot()` of its own, each row in header order with `""` for a cell left out (`src/lib/dc/tables/annual.test.ts`).
- The header comment names the snapshot by its build date and `meta.json` `latest_date_com`, and the SCHEMA figures the fixture gives. `latest_date_com` names the data: a build of another day with the same `latest_date_com` is the same snapshot (F75 compared one: the same rows).

## A snapshot date in the acceptance check

An existing fixture serves when every block ปี it holds has the same rows as that snapshot's `public/data/reports/{id}.json`, on the columns the fixture keeps. Compare them with `.wizard/f75/compare-fixture.mts` (change its import; the id comes from the fixture); rows in another order are the same rows. Say which fixture was used, and why, in the PR's "ต่างจาก issue" line (F74, F75).

## A column the fixture lacks

Add it from the snapshot rather than cutting the fixture again: `.wizard/f75/add-total.mjs` (change its fixture file, id, column and the export that ends the fixture's rows) matches each row by year, hospcode and areacode (one row each in every block, check it first), and writes the cell where it is not `""`. Then put the column into `headers` at its real place by hand, add the snapshot it came from to the header comment, and compare again with the column included.

## Expected values

- SCHEMA §4.6 lists the district's figures. Figures by ตำบล or by หน่วยบริการ come from summing the snapshot's rows with a script apart from the code (`.wizard/f75/sums.mjs`), and the test's comment says so (CODING_STANDARDS §5).
- A case the snapshot does not have, such as a ตำบล whose `total` is 0 or a year the district has no ผลงาน, is a changed copy inside the test (`food2568Without` in `annual.test.ts`), not an edit of the fixture file.
