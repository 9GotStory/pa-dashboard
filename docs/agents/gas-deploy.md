# GAS deploy and production checks

GAS and the PA-Data spreadsheet are production for PA too (CLAUDE.md). Use this for a GAS deploy, a diag setup, or any other write to production. Start it in a fresh session: a deploy and its checks need their own context.

## Setup, once per machine

`.env.local` (ignored by git) holds what `npm run pa:snapshot` and `npm run gas:diag` read:

```
NEXT_PUBLIC_GAS_SCRIPT_URL=<the web app URL in src/lib/useKPIData.ts>
DIAG_PIN=<CONFIG.DIAG_PIN in src/scripts/รหัส.js; public, ADR-0005>
PA_URL=https://9gotstory.github.io/pa-dashboard/
```

`pa:snapshot` opens the PA page with Playwright in the installed Google Chrome (`channel: "chrome"`), so the machine needs Google Chrome.

clasp is a devDependency pinned in package.json, so `npm ci` installs it and `npm run gas:push`, `gas:deploy` and `gas:sync` use it under any Node version. Sign in once with `npx clasp login`.

## Deploy

1. `npm run pa:snapshot -- before`: BATCH_ALL and the PA page (default and EPI tabs: every KPI cell's label, the page text, a screenshot) into `.pa-check/before/`.
2. `npm run gas:sync` from `main`: pushes, then redeploys the existing deployment as a new version.
3. `npm run pa:snapshot -- after`, then `npm run pa:compare -- before after`. Exit 0 means PA shows the same. Rows that `saveTableYear` narrowed to the district and the current year count as unchanged. Any other change prints max `date_com` before and after: a newer one is new MOPH data, the same one is a code change.
4. When the deploy changes `syncAllData`, read `system_logs` after the next daily run (14:00–15:00) and compare again. `logToSheet` keeps the newest 500 rows at the bottom (rows 2–501 once full), so read the tail: `system_logs!A440:D501` through the Google Sheets MCP, or `npm run gas:diag -- logs=60`.

Roll back with `npx clasp redeploy <deploymentId> -V <previous version>` (`npx clasp deployments` lists them), then push the previous code: whether triggers run the deployed version or HEAD is not documented.

## Diag setups

`setup=…` and `run=sync` write to production, so the ask rules in `.claude/settings.json` stop the agent's call at a prompt, as for the other production writes CLAUDE.md lists. The user runs them with the `!` prefix, which puts the output in the conversation:

```
! npm run gas:diag -- setup=datacenter
```

It prints every result, a caught `"error: …"` included, and exits 1 when anything failed. Without `setup=` or `run=` it only reads (triggers, the MOPH probe, `recentLogs`; `logs=N` for more rows), so the agent runs that itself. Check what a write did read-only, through the Google Sheets MCP on PA-Data.
