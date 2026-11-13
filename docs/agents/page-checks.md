# Page checks by hand

Use this for a FEATURES acceptance check that `dc:check` does not cover: a Playwright script of your own against `out/` or the live site, or the local LCP comparison with `main` that SPEC §9.6 asks of a ticket changing the home page. A Playwright script of your own is not committed; its output, like `dc:lcp`'s, goes in the PR's Evidence or the issue's record.

## A Playwright script in the scratchpad

- Start from `.wizard/f42/check.mjs`, F42's live check of `/reports` (counts against `catalog.json`, search, history, focus, contrast, overflow): `SHOTS=.wizard/<ticket>/shots node .wizard/f42/check.mjs <result.json> <catalog.json>`, with `BASE=<url>` for a local build.
- A script outside the repo cannot resolve `playwright-core` by name: ESM looks for `node_modules` beside the script. Import it by path: `import { chromium } from "<repo>/node_modules/playwright-core/index.mjs"`, and launch with `{ channel: "chrome" }` as `dc-check.mjs` does.
- Serve `out/` with `npx serve@latest out -l <port>` started in the background, wait until it answers (`until curl -s -o /dev/null localhost:<port>; do sleep 1; done`) before the first `page.goto`, and stop it by its PID: `kill $(ss -ltnp | grep ":<port> " | grep -o 'pid=[0-9]*' | cut -d= -f2)`. A hook denies `pkill -f`.
- Block the map tiles (`page.route((u) => u.hostname === "tile.openstreetmap.org", (r) => r.abort())`) so the check does not depend on the tile server.
- To try a build without population data, set `years` to `[]` in a copy of `public/data/population.json`, `npx next build`, check, then put the copy back and build again.

## Against the reference design

A ticket that changes how a page looks: screenshot the reference HTML in `docs/reference/` (`page.goto("file://<repo>/docs/reference/…")`) and the build at the same width and state (picked, searched, empty), and Read each pair side by side before `code-review`. The reviewer gets only the diff: a `first:` variant that matched nothing (F40) and an underscore clipped by an input of fixed height (F41) showed up only this way.

## LCP against `main` (SPEC §9.6)

`npm run dc:lcp -- <page> ...` (default `/`), for example `npm run dc:lcp -- / /reports/c88658f4d09acb8c76e6c06ffb58ebaf`.

- Run it on the branch with everything committed and `public/data/` in place; it stops before building otherwise, or when HEAD is `main`. It builds the local `main`, so pull `main` when it warns that `main` is behind `origin/main`.
- It ends on the branch it started from, with `out/` and `.next/` from the branch's build: `dc:check` and `dc:budget` can run next.
- One line per Lighthouse run comes first. The block after the blank line goes in the PR's Evidence: both SHAs, the load average before and after (this machine is shared: under a high or changing load, run again), and per page both medians, the difference, pass or FAIL by SPEC §9.6's 10%, and the LCP element of each side's median run.
- It exits 1 when a page fails. The last line names the temp directory that keeps every run's Lighthouse JSON.
- It does not measure the live site: < 2.5 s is checked there, below.

## On the live site

- Wait for the deploy of the last merge: `gh api repos/9GotStory/pa-dashboard/commits/main/check-runs --jq '.check_runs[] | select(.name == "Cloudflare Pages") | .status + " " + .conclusion'` reads `completed success`. Before that, `built_at` is the previous build's both before and after the check.
- Name the build you checked: read `built_at` in `https://songhealth-dc.pages.dev/data/meta.json` before and after. A merge to `main`, docs-only included, redeploys Cloudflare Pages, and a redeploy can land mid-measurement; when `built_at` changed, check again.
- `gh` cannot upload images, so the user drags screenshots into the issue comment by hand. Write a placeholder per image in the comment (`[ภาพ <name>.png]`) and save the files in `.wizard/<ticket>/` (gitignored, kept across reboots), not the scratchpad, which `/tmp` loses on reboot.

`dc:budget` reads `./out` and, since F52, the build's `.next/server/app/(dc)/reports/[id]/page/react-loadable-manifest.json`. When no merge since the last PR changed client JavaScript, that PR's After figure is `main`'s: `gh pr view <n> --json body --jq .body | grep -F dc:budget` (`-F`: a Thai pattern with `.{0,n}` exceeds ugrep's limits). Otherwise run it from a directory whose `out` and `.next` link to `main`'s copies of the same build: `ln -s <main-out> <dir>/out && ln -s <main-next> <dir>/.next && cd <dir> && node <repo>/src/scripts/dc-budget.mjs`.
