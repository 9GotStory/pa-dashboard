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

Song Health Data Center (สสอ.สอง) and PA Dashboard (คปสอ.สอง): a Next.js 16 static export on top of a Google Apps Script (GAS) web app and Google Sheets, fed by HDC Open Data. Production today is PA on GitHub Pages; phase 1 (Data Center at `/`, PA at `/pa`, Cloudflare Pages) is planned as tickets F01–F22 in FEATURES.md. Read README.md for the overview.

## Commands

- `npm ci` · `npm run dev` (http://localhost:3000) · `npm run lint`
- `npm run build` writes the static site to `out/`; preview it with `npx serve@latest out`. `next start` does not work with `output: 'export'`.
- `npm test` runs the GAS tests in `src/scripts/test/` (added in F01; F15 adds the `values.ts` tests).
- `next build` downloads Google Fonts (Prompt, Sarabun) through `next/font/google`. If a build fails while fetching fonts, the network is blocked; it is not a code bug.

## Hard rules

- PA Dashboard files are frozen: the canonical list is CODING_STANDARDS.md §1. `src/scripts/รหัส.js` changes only at the points listed in SPEC.md §12.4.
- New code goes in `src/app/(dc)/`, `src/components/dc/`, `src/lib/dc/` and `src/scripts/dc-*.js`. GAS files run in one global scope with no `require`/`import`; every node-only file under `src/scripts/` must be listed in `.claspignore`.
- Production is shared with PA. Unless the user asks in this session, never run `npm run gas:push`, `gas:deploy` or `gas:sync`, `src/scripts/sync-moph-to-gas.js`, `hdc-catalog.js refresh`, a `rebuild`, or any POST to the live GAS URL. When asked to deploy GAS, deploy from `main` and redeploy the existing deployment (`npm run gas:deploy`); never create a new deployment, because PA hardcodes the web app URL in `src/lib/useKPIData.ts`.
- Git: one branch per ticket (`feat/F##-<slug>`) from `main`, PR into `main`, never push to `main`. Never commit `public/data/` or `.env*`.
- UI text is Thai. Use the terms in GLOSSARY.md in code, tests, issues and commit messages.
- Use the Context7 MCP tools to fetch current docs before writing code against a library or answering a library API question (Next.js 16.1, React 19.2, Tailwind CSS 4, clasp 3, Leaflet 1.9). Don't ask first, and don't rely on memory.

## Docs map

Read these on demand. Don't `@`-import them: imports load into every session at start, and SPEC and SCHEMA are long.

- SPEC.md: phase 1 design · SCHEMA.md: sheets, GAS contracts, calculation rules, TS types · FEATURES.md: tickets F01–F22, acceptance checks, workflow rules
- GLOSSARY.md: domain terms · docs/adr/: decisions and why · CODING_STANDARDS.md: what code review checks
- docs/reference/song-health-data-center-review-03-epi-real-response-r6.html: R6 UI mockup (its numbers are fake)

## Agent skills

### Issue tracker

GitHub Issues on `9GotStory/pa-dashboard`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
