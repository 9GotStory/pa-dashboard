# GAS deploy and production checks

GAS and the PA-Data spreadsheet are production for PA too (CLAUDE.md). Use this for a GAS deploy, a diag setup, or any other write to production. Start it in a fresh session: a deploy and its checks need their own context.

## Setup, once per machine

`.env.local` (ignored by git) holds what `npm run pa:snapshot` and `npm run gas:diag` read:

```
NEXT_PUBLIC_GAS_SCRIPT_URL=<the web app URL in src/lib/useKPIData.ts>
DIAG_PIN=<CONFIG.DIAG_PIN in src/scripts/รหัส.js; public, ADR-0005>
PA_URL=https://songhealth-dc.pages.dev/pa
```

`pa:snapshot` opens the PA page with Playwright in the installed Google Chrome (`channel: "chrome"`), so the machine needs Google Chrome.

clasp is a devDependency pinned in package.json, so `npm ci` installs it and `npm run gas:push`, `gas:deploy` and `gas:sync` use it under any Node version. Sign in once with `npx clasp login`.

## Deploy

1. `npm run pa:snapshot -- before`: BATCH_ALL and the PA page (default and EPI tabs: every KPI cell's label, the page text, a screenshot) into `.pa-check/before/`.
2. `npm run gas:sync` from `main`: pushes, then redeploys the existing deployment as a new version.
3. `npm run pa:snapshot -- after`, then `npm run pa:compare -- before after`. Exit 0 means PA shows the same. Rows that `saveTableYear` narrowed to the district and the current year count as unchanged, and so do rows that differ only in a newer `date_com` (to the minute), with PA's อัปเดตล่าสุด line once one did. Any other change prints max `date_com` before and after: a newer one is new MOPH data, the same one is a code change.
4. When the deploy changes `syncAllData`, read `system_logs` after the next daily run (14:00–15:00), then `npm run pa:snapshot -- after-sync` and `npm run pa:compare -- before after-sync`: the run gives every row a newer `date_com`, which the compare passes over. `logToSheet` keeps the newest 500 rows at the bottom (rows 2–501 once full), so read the tail: `system_logs!A440:D501` through the Google Sheets MCP, or `npm run gas:diag -- logs=60`.

Roll back with `npx clasp redeploy <deploymentId> -V <previous version>` (`npx clasp deployments` lists them), then push the previous code: whether triggers run the deployed version or HEAD is not documented.

## Changing `current_year`

Changing `settings.current_year` moves PA and the Data Center to the new year at once (SPEC §7, row เปลี่ยนปีงบ). First confirm HDC has rows for the new year, or the prebuild fails. The PA registry (`kpi_master`, `kpi_epi`) is one sheet for every year, so freeze PA's closed year before the switch (ADR-0017): skip it and the old year's targets are gone for good. Run it through `/wizard`; the user makes every write to the sheet.

1. The user sets `settings.current_quarter = 4`.
2. The user syncs the old year one last time (`/sync`, or `run=sync` through `gas:diag`). The sync's rebuild puts it on the site.
3. Open `/pa` on the live site: every quarterly KPI reads สะสม 12 เดือน (Q4), or its `target_months`.
4. `npm run pa:snapshot -- freeze-{year}`: the picture of PA before the freeze, kept for the closed-year compare.
5. Freeze, GET only: `npm run snapshot`, then copy `public/data/pa.json` to `data/pa-years/{year}.json` (SCHEMA §7) and open a PR into `main`. Merge it before step 6. Steps 3–5 write nothing to production and do not wait on the `/pa/{year}` page (F85).
6. The user sets `current_year` to the new year and `current_quarter = 1`.
7. The user syncs the new year at once from `/sync`, not with `run=sync` and not by waiting for the daily trigger: in the switch to 2570 `run=sync` answered 500 twice after the archive created new `_y` sheets (#326), and #342 looks for the cause. Until the sync, the current-year sheets still hold the old year's rows, and `BATCH_ALL` shows them as the new year.

Once `/pa/{year}` is live, `npm run pa:snapshot -- closed-{year}` with `PA_URL` set to that page, then `npm run pa:compare -- freeze-{year} closed-{year}`. It exits 1 by design: `data` holds the new year's `BATCH_ALL`, and the year badge and year links shift the text lines. Read the cell lines instead: both tabs must show 0 cells that differ.

## Diag setups

`setup=…` and `run=sync` write to production, so the ask rules in `.claude/settings.json` stop the agent's call at a prompt, as for the other production writes CLAUDE.md lists. The user runs them with the `!` prefix, which puts the output in the conversation:

```
! npm run gas:diag -- setup=datacenter
```

It prints every result, a caught `"error: …"` included, and exits 1 when anything failed. Without `setup=` or `run=` it only reads (triggers, the MOPH probe, `recentLogs`; `logs=N` for more rows), so the agent runs that itself. Check what a write did read-only, through the Google Sheets MCP on PA-Data.
