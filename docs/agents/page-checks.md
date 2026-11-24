# Page checks by hand

Use this for a FEATURES acceptance check that `dc:check` does not cover: a Playwright script of your own against `out/` or the live site, the report pages against `main` (`dc:compare`), or the LCP checks of SPEC §9.6: the local comparison with `main` that a ticket changing a page's top or JavaScript runs, and < 2.5 s on the live site. A Playwright script of your own is not committed; its output, like `dc:lcp`'s, goes in the PR's Evidence or the issue's record.

## A Playwright script in the scratchpad

- Start from `.wizard/f42/check.mjs`, F42's live check of `/reports` (counts against `catalog.json`, search, history, focus, contrast, overflow): `SHOTS=.wizard/<ticket>/shots node .wizard/f42/check.mjs <result.json> <catalog.json>`, with `BASE=<url>` for a local build.
- For a `/reports/{id}` page, start from `.wizard/f75/check.mjs`. It has `open()` that can change the `reports/{id}.json` the page reads (`page.route`) for a case the snapshot lacks, `apply()` for the filters, `csv()` that reads the download, and a second server `MAIN` on `.dc-lcp/main/out` for a case of the ticket's own that needs `main`'s page beside the branch's. Pages outside the ticket go through `dc:compare` (below).
- For the รีเฟรชแค็ตตาล็อก button on `dc:sync-local`, start from `.wizard/f78/check.mjs`: `ROUTE=1 node .wizard/f78/check.mjs <out dir>` logs in with the PIN, presses the button, and writes `result.json` (requests, MOPH's answers, console, page text) and `catalog-section.png`. The catalog API refuses CORS from `http://localhost` (F78, 15 Nov 2569): without `ROUTE=1` every topic ends skipped with "Failed to fetch" after its retries, about 36 s each. `ROUTE=1` answers `by-category-id` with `page.route`, CORS allowed: the vaccine topic from `src/scripts/test/fixtures/hdc-catalog-20261030-subset.json`, the surveillance topic with `[]`, and the screening topic goes on to the real API. So `ROUTE=1` ends "บันทึก 1 · ข้าม 2" (F78: 34 rows saved): one save, one empty answer, one refused. A click against the real API is a check on the live site.
- A script outside the repo cannot resolve `playwright-core` by name: ESM looks for `node_modules` beside the script. Import it by path: `import { chromium } from "<repo>/node_modules/playwright-core/index.mjs"`, and launch with `{ channel: "chrome" }` as `dc-check.mjs` does.
- Serve `out/` with `npx serve@latest out -l <port>` started in the background, wait until it answers (`until curl -s -o /dev/null localhost:<port>; do sleep 1; done`) before the first `page.goto`, and stop it by its PID: `kill $(ss -ltnp | grep ":<port> " | grep -o 'pid=[0-9]*' | cut -d= -f2)`. A hook denies `pkill -f`.
- Read shows an image at most 2000 px tall, so a full-page shot at 320 px (4,000–12,000 px) arrives too narrow to read. Shoot a section with `page.locator(…).screenshot()`, or crop with `sharp`, which comes with `next`: `import sharp from "<repo>/node_modules/sharp/dist/index.mjs"`, then `sharp(src).extract({ left, top, width, height }).toFile(dst)`. This machine has no PIL or ImageMagick.
- Block the map tiles (`page.route((u) => u.hostname === "tile.openstreetmap.org", (r) => r.abort())`) so the check does not depend on the tile server.
- Write the script with Write and run it with `node <file>`: inline heredoc scripts broke on backticks (F92), and Claude Code's check denied one (F89).
- A state that passes faster than an eye can follow, such as the grey blocks while a report loads, is checked by holding its data back: `page.route("**/data/reports/*.json", async (r) => { await new Promise((s) => setTimeout(s, 6000)); await r.continue(); })`, then sample the element. `.wizard/f99/skeleton.mjs` samples the blocks' opacity, once more on a context with `reducedMotion: "reduce"`; the user checking by eye saw them too briefly (F99).
- To try a build without population data, set `years` to `[]` in a copy of `public/data/population.json`, `npx next build`, check, then put the copy back and build again.

## Report pages against `main`: `dc:compare`

A ticket that touches `src/components/dc/` or `src/lib/dc/` runs `npm run dc:compare [-- <url> ...]` after `npx next build`, before `code-review`, for example `npm run dc:compare -- "/reports/population?area=540603"`. The reviewer gets only the diff: in F75 a change to `Cards` changed the markup of panels on other report pages, and only the Spec reviewer's reading of the diff caught it.

- It opens every `/reports/{id}` of the branch's build and of `main`'s, `/reports/population` without a query, then each URL given, at 1280 px with the map tiles blocked, once the network is idle and `<main>` shows no `กำลังโหลด`. Per page it compares the `innerText` of `<main>`, the HTML of `<main>` with the ids of `useId`, the names of chunks and the comments `<!--$-->` and `<!--/$-->` around a Suspense boundary taken out (every `class` kept, as a changed class is a changed look; every id of `useId` reads `«id»`, so a `for` or `aria-*` pointed at another element does not show; one build's page came with those comments at one opening and without them at the next (#374), while `<!--$?-->`, `<!--$!-->` and `<!-- -->` stay), and the file name and content of the CSV that ดาวน์โหลด CSV gives. It compares no screenshots, and only the state each URL opens in: a page whose change shows after a click (a sort, a รายละเอียด) goes in as a URL with its query, such as `?measure=`.
- The branch's side is `out/` as it is, uncommitted changes included. `main`'s side is the build `dc:lcp` keeps in `.dc-lcp/main/`, reused while `built-from.json` matches. Otherwise, in a clean working tree, it builds `main` and then the branch as `dc:lcp` does, ending on the branch with its `out/` and `.next/`; with uncommitted files it exits 2 saying to commit or stash first. A run on an uncommitted change therefore needs `main`'s build in place: run it once with the tree clean first.
- It exits 2 when `out/data/` is not the snapshot of `main`'s build, as a difference would come from the data: `npx next build` again.
- The output: a line a page. `same`; `differs at` the parts that differ (`text`, `HTML`, `CSV`), each followed by the line it starts at and up to 5 lines a side, `-` for `main`'s and `+` for the branch's, then `… n more`; `only on branch` or `only on main` for a page one build lacks; `on neither side` for a URL given that neither build has. The last line names `main`'s SHA, the branch's, `with uncommitted changes` when there are, and the count of each verdict. It exits 0 when every page is `same`, 1 when one is not, and 2 when it cannot run or a URL given is on neither side.
- Read each page that is not `same` against the ticket: a difference the ticket asks for is the change; any other is a finding. Nothing is passed in as an intended difference.
- Evidence: the last line, and every page that is not `same` with its lines.

## Colour pairs against WCAG AA: `dc:contrast`

`npm run dc:contrast -- [--base <url>] [--width <px> ...] <path> ...` measures each colour pair (คู่สี, GLOSSARY) of the text a page shows: its colour and the colour painted under it, read from the rendered page. A ticket that changes a colour or a ground runs it before `code-review` on the pages it touches; #377 and F98 wrote their own measure five times outside the repo, and both missed pairs in states they did not open.

- Without `--base` it serves `out/` (after a build); with it, it opens a server already running, such as `npm run dc:sync-local`'s (`--base http://localhost:3217 /sync`) or the live site. It sends only GET and HEAD (`next/link`'s prefetch) and aborts any other request, printing a line for each. Widths default to 360 and 1280 px; `--width` replaces them, once a width. Map tiles are blocked, and a page is read once `<main>` (or the body) shows no `กำลังโหลด`, as `dc:compare` waits.
- What it measures: each text node, labels in an SVG (their `fill`), what a `<select>` shows and the placeholder of an empty field. The ground is what paints under the text at 3 points across each of its first 3 boxes, through `document.elementsFromPoint`, down to the first opaque layer: the backgrounds of HTML elements and the fills of SVG shapes, siblings and elements placed on their own included, translucent ones composited, an `opacity` applied to its element as a whole. A translucent layer over the text (a veil) is composited over both colours; an opaque one or a picture covers the text at that point. A stroke is a line, not a ground: a chart's line through a label does not count, and the white stroke round a label's figures does not help it. A text's pair is its lowest ratio of those points. Text that does not show is left out: `sr-only`, clipped by an overflow, off the screen, or covered at every point. It measures no graphics (bars, the progress bar, focus rings).
- The output: a summary line (texts measured, pairs, how many below AA and how many of those disabled, unmeasurable rows), then a line a page that did not open or a request aborted, then a pair a line: unmeasurable rows first, then from nearest the threshold. Each line: `FAIL` or `ok` by the unrounded ratio, the ratio and the threshold (4.5, or 3 for large text: 24 px, or 18.66 px at weight 700), the kind (`text`, `svg`, `select`, `placeholder`), `disabled` for a control that cannot be used (`aria-disabled="true"`, `:disabled`, the text and label of either), the two colours, `×` the count of texts, up to 3 texts and up to 4 pages with their width. `UNMEASURABLE` names the element whose ground is a picture or a gradient; nothing is guessed. A plain `<pattern>` (the Hero's dots) is read: only its shapes paint.
- It exits 0 when no pair is below AA, 1 when a pair that is not `disabled` is or a row is unmeasurable, 2 when it cannot run (no `out/`, a page that does not open).
- Evidence: the summary line, every `FAIL` and `UNMEASURABLE` line, and the lines of the pairs the ticket changed.

### A state after a click

`dc:contrast` logs in to nothing and presses nothing. A state behind a PIN or a click is a Playwright script of the ticket's own, in the scratchpad, that imports the measure by path and calls it on its own `page`:

```js
import { chromium } from "<repo>/node_modules/playwright-core/index.mjs";
import { exitCode, formatPairs, groupPairs, measurePage, summaryLine } from "<repo>/src/scripts/dc-contrast.mjs";
// … open the page, put it in the state …
const rows = await measurePage(page, "/sync unlocked 1280px"); // the label of the page column
const pairs = groupPairs(rows);
console.log([summaryLine(rows, pairs), ...formatPairs(pairs)].join("\n"));
process.exitCode = exitCode(pairs, []);
```

`measurePage` reads the page as it is, scrolls it to reach each text and scrolls it back; call it once per state and concatenate the rows before `groupPairs`. For `/sync` start from `.wizard/377/scripts/measure.mjs`, #377's script on `dc:sync-local`: it opens the login, the list at each age of the data date, a past year, `sync_status` cut, the config cut (error) and held (loading). Its own measure predates this one: swap its `measure` for `measurePage`. `/sync`'s files are frozen apart from colour classes, so its state script is not committed.

Before measuring, go through the states the change can show; each of these was missed once:

- every level of a colour that depends on the data, with the page's clock (`page.clock.setFixedTime`) or a fixture set so each level shows (F98 saw one of the data date's three)
- hover and focus of each control the ticket touched (`locator.hover()`, `locator.focus()`)
- a control that cannot be used
- loading (hold the data back with `page.route`, as above), error (abort it), and while working (#377's log lines during a sync)
- an empty state, such as a console with no line yet
- graphics that need 3:1 against what is next to them (a bar, the progress bar's fill, an icon that carries meaning): measured by hand, from the colours' values, as `dc:contrast` does not judge shapes

## PA against production: `pa:compare`

`npm run pa:snapshot` reads `PA_URL` from `.env.local`, and a `PA_URL` set on the command wins, so a local build is snapshotted with `PA_URL=http://localhost:<port>/pa npm run pa:snapshot -- <name>`. Both sides of a compare are taken the same day: the daily sync (14:00–15:00) brings new MOPH data, which `pa:compare` reports as CHANGED.

- A ticket that touches `/pa`: `npm run pa:snapshot -- <ticket>-prod` against production, then `npm run build`, serve `out/`, snapshot the branch and `npm run pa:compare -- <ticket>-prod <ticket>-branch`. The full build, as its prebuild writes the day's `public/data/pa.json`: after `npx next build` on an older one, the branch's อัปเดตล่าสุด line was the day before production's, which counts as a change (F97).
- A Track's PA before and after, on the live site: snapshot production, and a build of the commit before the Track the same day. Build it in a worktree in the scratchpad: `git worktree add --detach <dir> <sha>`, copy `.env.local` in, `npm ci && npm run build` there, serve its `out/`, snapshot with `PA_URL`, compare, then stop the server and `git worktree remove --force <dir>`. A snapshot of production kept from before the Track crosses a daily sync: F99's showed 39 keys CHANGED, all new MOPH data, and the same-day build showed PA unchanged.

## Against the reference design

A ticket that changes how a page looks: screenshot the reference HTML in `docs/reference/` (`page.goto("file://<repo>/docs/reference/…")`) and the build at the same width and state (picked, searched, empty), and Read each pair side by side before `code-review`. The reviewer gets only the diff: a `first:` variant that matched nothing (F40) and an underscore clipped by an input of fixed height (F41) showed up only this way.

## LCP against `main` (SPEC §9.6)

`npm run dc:lcp -- <page> ...` (default `/`), for example `npm run dc:lcp -- / /reports/c88658f4d09acb8c76e6c06ffb58ebaf`.

- Run it once, on the commit the PR will carry: after the review's fixes and the user's decisions are committed. Run it with `run_in_background`: a run takes 4–10 minutes, and a foreground call stops at 10 (F89). Each run builds the branch and runs Lighthouse 6 times, and the PR quotes the last run alone (F74 and F75 each ran it 3 times). While working, `npx next build && npm run dc:budget` against `main`'s figures catches a JavaScript change in seconds; F74's early run caught `/reports` growing by its `dc:budget` block, not its LCP.
- Run it on the branch with everything committed and `public/data/` in place; it stops before building otherwise, or when HEAD is `main`. It builds the local `main`, so pull `main` when it warns that `main` is behind `origin/main`.
- It keeps `main`'s build in `.dc-lcp/main/` (gitignored): `out/`, the `react-loadable-manifest.json` that `dc:budget` reads at its place under `.next/`, and `built-from.json`. While `main`'s SHA, the hash of `public/data/` and the hash of `node_modules/.package-lock.json` match `built-from.json`, it prints that it reuses `main`'s build of that SHA and builds only the branch; otherwise it builds `main` again. When the branch's build fails, `main`'s is kept.
- It ends on the branch it started from, with `out/` and `.next/` from the branch's build: `dc:check` and `dc:budget` can run next.
- One line per Lighthouse run comes first. The block after the blank line goes in the PR's Evidence: both SHAs, the load average before and after (this machine is shared: under a high or changing load, run again), and per page both medians, the difference, pass or FAIL by SPEC §9.6's 10%, and the LCP element of each side's median run. Then two `dc:budget` blocks, `main <sha>` and `<branch> <sha>`: the branch's `dc-budget.mjs` run on `main`'s build and on the branch's, so both are counted the same way. A side that fails, such as a page `main` does not have yet, shows its error; neither changes the exit code.
- It exits 1 when a page fails. The last line names `.dc-lcp/local/`, which keeps every Lighthouse JSON of the last run.
- For < 2.5 s on the live site, add `--live`: below.

## On the live site

- Wait for the deploy of the last merge: `gh api repos/9GotStory/pa-dashboard/commits/main/check-runs --jq '.check_runs[] | select(.name == "Cloudflare Pages") | .status + " " + .conclusion'` reads `completed success`. Before that, `built_at` is the previous build's both before and after the check.
- Name the build you checked: read `built_at` in `https://songhealth-dc.pages.dev/data/meta.json` before and after. A merge to `main`, docs-only included, redeploys Cloudflare Pages, and a redeploy can land mid-measurement; when `built_at` changed, check again.
- LCP (SPEC §9.6): `npm run dc:lcp -- --live <page> ...` (default `/` and `/pa`, since F84), for example `npm run dc:lcp -- --live / /reports/population`. It builds nothing and needs neither a clean tree nor `public/data/`. It runs the same Lighthouse command, tiles blocked on every page, 3 rounds, each round every page, the order swapped round by round, one line per run. The block after the blank line goes in the record: `built_at` and the load average before and after, and per page the 3 runs, the median, pass or FAIL by < 2500 ms, and the LCP element of each round. It reads `built_at` itself and exits 1 when it changed, saying to run again, or when a page fails. The last line names `.dc-lcp/live/`, emptied each run, which keeps every Lighthouse JSON; `.dc-lcp/main/` and `.dc-lcp/local/` are left alone.
- Save screenshots in `.wizard/<ticket>/` and upload them as in "Screenshots on GitHub" below.

`dc:budget` reads `./out` and, since F52, the build's `.next/server/app/(dc)/reports/[id]/page/react-loadable-manifest.json`. When no merge since the last PR changed client JavaScript, that PR's After figure is `main`'s: `gh pr view <n> --json body --jq .body | grep -F dc:budget` (`-F`: a Thai pattern with `.{0,n}` exceeds ugrep's limits). Otherwise run `npm run dc:lcp`, whose summary has `main`'s figure, or, after one, run it on the build it kept: `cd .dc-lcp/main && node ../../src/scripts/dc-budget.mjs`.

## Screenshots on GitHub

Save screenshots in `.wizard/<ticket>/shots/` (gitignored, kept across reboots), not the scratchpad, which `/tmp` loses on reboot, and write a placeholder per image in the issue record or the PR body (`[ภาพ <name>.png]`). `gh` cannot upload images. With the user's go-ahead and Chrome open, upload them through Claude in Chrome on the issue's or the PR's page (F71, F99); otherwise the user drags them into the comment by hand:

1. GitHub's file input is hidden from `file_upload`. Inject one with `javascript_tool` (`<input type="file" multiple id="claude-upload">`, `position:fixed;top:0;left:0;z-index:99999`), `find` it, and `file_upload` every path into it in one call (under 10 MB a call: 17 files, 8.3 MB in F71).
2. Paste them into the new-comment textarea: `const dt = new DataTransfer(); for (const f of input.files) dt.items.add(f); textarea.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }))`. Poll the textarea until it holds one `user-attachments/assets/<id>` per file and no `Uploading`.
3. Return the images as a compact list, one `<alt> <asset id>` a line, and check it has one line per file: `javascript_tool` cuts a long result, and F99 lost two ids that way, returned as whole `<img>` tags in the call that also cleared the textarea. Then, in a call of its own, clear the textarea without posting (the `HTMLTextAreaElement.prototype` `value` setter, then an `input` event) and remove the injected input.
4. Replace the placeholders with `![<alt>](https://github.com/user-attachments/assets/<id>)` and post the record or the body, or PATCH it: `gh api -X PATCH repos/9GotStory/pa-dashboard/issues/comments/<id> -F body=@<file>`, `gh pr edit <n> --body-file <file>`. Every image answers 404 until a saved comment or body holds it, and for a few seconds after; then check each with `curl -s -o /dev/null -w '%{http_code}' -L <url>` until all answer 200.
