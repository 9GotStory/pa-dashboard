# Page checks by hand

Use this for a FEATURES acceptance check that `dc:check` does not cover: a Playwright script of your own against `out/`, or the local LCP comparison with `main` that SPEC §9.6 asks of a ticket changing the home page. The script itself is not committed; its output goes in the PR's Evidence.

## A Playwright script in the scratchpad

- A script outside the repo cannot resolve `playwright-core` by name: ESM looks for `node_modules` beside the script. Import it by path: `import { chromium } from "<repo>/node_modules/playwright-core/index.mjs"`, and launch with `{ channel: "chrome" }` as `dc-check.mjs` does.
- Serve `out/` with `npx serve@latest out -l <port>` started in the background, and stop it by its PID: `kill $(ss -ltnp | grep ":<port> " | grep -o 'pid=[0-9]*' | cut -d= -f2)`. A hook denies `pkill -f`.
- Block the map tiles (`page.route((u) => u.hostname === "tile.openstreetmap.org", (r) => r.abort())`) so the check does not depend on the tile server.
- To try a build without population data, set `years` to `[]` in a copy of `public/data/population.json`, `npx next build`, check, then put the copy back and build again.

## LCP against `main` (SPEC §9.6)

1. Commit the branch. Build it from the snapshot (`npx next build`) and copy `out/` to the scratchpad.
2. `git checkout main`, `npx next build`, copy `out/` to the scratchpad, `git checkout -` back. Both builds then read the same `public/data/`.
   - A `git worktree` of `main` with `node_modules` symlinked from the repo does not build: Turbopack refuses files outside the worktree's root.
3. Serve the two copies on two ports and run the SPEC §9.6 Lighthouse command against each, alternating `main` and branch, 3 runs each. Add `--output=json --output-path=<file> --quiet` to read the result:
   - LCP in ms: `audits["largest-contentful-paint"].numericValue`.
   - The LCP element: Lighthouse 13 has no `largest-contentful-paint-element` audit; the element's `nodeLabel` and `snippet` are inside `audits["lcp-breakdown-insight"].details`.
4. Record both medians and the LCP element of each in the PR. Note the load average: this machine is shared.

`dc:budget` reads `./out` only. When no merge since the last PR changed client JavaScript, that PR's After figure is `main`'s: `gh pr view <n> --json body --jq .body | grep -F dc:budget` (`-F`: a Thai pattern with `.{0,n}` exceeds ugrep's limits). Otherwise run it from a directory whose `out` links to `main`'s copy: `ln -s <main-out> <dir>/out && cd <dir> && node <repo>/src/scripts/dc-budget.mjs`.
