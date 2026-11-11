# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project

Song Health Data Center (สสอ.สอง) and PA Dashboard (คปสอ.สอง): a Next.js 16 static export on top of a Google Apps Script (GAS) web app and Google Sheets, fed by HDC Open Data. Production is Cloudflare Pages at `https://songhealth-dc.pages.dev`: the Data Center at `/`, PA at `/pa`. GitHub Pages serves only the stub in `legacy-redirect/`, which forwards old PA links. Phases 1 and 2 were built as tickets F01–F29 in FEATURES.md; Track G (F30–F37) redesigned the home page per V7.6. Read README.md for the overview.

## Commands

- `npm ci` · `npm run dev` (http://localhost:3000) · `npm run lint`
- `npm run build` writes the static site to `out/`. Its prebuild reads the live GAS (GET, about 2.5 minutes); `npx next build` rebuilds from the snapshot already in `public/data/`. After a build, `npm run dc:check` and `npm run dc:budget` check the Data Center pages. Preview with `npx serve@latest out`; `next start` does not work with `output: 'export'`. An acceptance check by hand (a Playwright script of your own, the LCP comparison with `main`, a check on the live site): docs/agents/page-checks.md.
- `npm test` runs the GAS tests in `src/scripts/test/` and the Data Center tests in `src/lib/dc/`.
- To try `/sync` in a browser, run `npm run dc:sync-local [-- <port>]`: `next dev` on port 3217 against the GAS of the test harness, in memory, and it prints the URL and PIN. `npm run dev` reads the production GAS URL from `.env.local`, so a save there is a POST to production.
- `next build` downloads Google Fonts (Prompt, Sarabun) through `next/font/google`. If a build fails while fetching fonts, the network is blocked; it is not a code bug.

## Hard rules

- PA Dashboard files are frozen: the canonical list is CODING_STANDARDS.md §1. `src/scripts/รหัส.js` changes only at the points listed in SPEC.md §12.4.
- New code goes in `src/app/(dc)/`, `src/components/dc/`, `src/lib/dc/` and `src/scripts/dc-*.js`. GAS files run in one global scope with no `require`/`import`; every node-only file under `src/scripts/` must be listed in `.claspignore`.
- Production is shared with PA. Unless the user asks in this session, never run `npm run gas:push`, `gas:deploy` or `gas:sync`, `npm run gas:diag` with `setup=` or `run=`, `src/scripts/sync-moph-to-gas.js`, `hdc-catalog.js refresh`, a `rebuild`, or any POST to the live GAS URL. When asked to deploy GAS, follow docs/agents/gas-deploy.md: deploy from `main` and redeploy the existing deployment (`npm run gas:sync`); never create a new deployment, because PA hardcodes the web app URL in `src/lib/useKPIData.ts`.
- Git: one branch per ticket (`feat/F##-<slug>`) from `main`, PR into `main`, never push to `main`. Never commit `public/data/` or `.env*`.
- Write to the user, and write PR bodies and issues, in Thai; code, comments and commit messages are English. Website UI text is Thai. The spreadsheet's admin menu and toasts are English, matching PA's existing ones (#137). Use the terms in GLOSSARY.md in code, tests, issues and commit messages.
- Read a library's docs before writing code against it or answering an API question about it; don't ask first, and don't rely on memory. Next.js: `node_modules/next/dist/docs/`, which ships with the installed version. React 19.2, Tailwind CSS 4, clasp 3, Leaflet 1.9: the Context7 MCP tools.

## Docs map

Read these on demand. Don't `@`-import them: imports load into every session at start, and SPEC and SCHEMA are long.

- SPEC.md: design of phases 1–2 · SCHEMA.md: sheets, GAS contracts, calculation rules, TS types · FEATURES.md: tickets F01–F37, acceptance checks, workflow rules
- GLOSSARY.md: domain terms · docs/adr/: decisions and why · CODING_STANDARDS.md: what code review checks
- docs/reference/song-health-data-center-review-03-epi-real-response-r6.html: R6 UI mockup (its numbers are fake)
- docs/reference/v7-6/: V7.6 visual and UX baseline for redesigning Data Center pages. SPEC §9.1–9.2 is the contract; design.md and the HTML are the look reference (mock data), not production source
- docs/reference/reports-v1-4/: V1.4 visual and UX baseline for `/reports` (ADR-0013). SPEC §9.3 is the contract; the handoff and the HTML are the look reference (fixture data), not production source

## Agent skills

### Issue tracker

GitHub Issues on `9GotStory/pa-dashboard`, via the `gh` CLI. See `docs/agents/issue-tracker.md`. A ticket's parent spec issue is history: SPEC, SCHEMA and FEATURES hold the current rules.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Workflow

Per ticket: the user runs `/implement #<issue>` (it calls `tdd` and `code-review`; keep what the PR will quote in a scratchpad file as it happens) → write the PR body with `pr` and docs/agents/pr-body.md → squash merge → delete the branch (CODING_STANDARDS.md §6) → recommend the next frontier ticket → the user runs `/clear` before the next ticket. `ready-for-human` tickets go through `wizard`. When a Track's last ticket merges, prompt the user to run `/retro`. Full rules: FEATURES.md "กติกา".
