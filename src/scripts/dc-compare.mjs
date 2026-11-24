// The comparison of this branch's report pages with main's (#309), for a
// ticket that changes src/components/dc/ or src/lib/dc/ (docs/agents/
// page-checks.md). Opens every /reports/{id} of either build and
// /reports/population, then each URL given, on the branch's out/ as it is
// (after npx next build) and on main's build that dc-lcp.mjs keeps in
// .dc-lcp/main/ (dc-main-build.mjs), at 1280 px wide with the map tiles
// blocked, once the page has loaded its data. It compares the innerText of
// <main>, the HTML of <main> with what changes though the code does not taken
// out (normalizeHtml: the ids of useId, the names of chunks, and the comments
// <!--$--> and <!--/$--> around a Suspense boundary), and the file name and
// content of the CSV that ดาวน์โหลด CSV gives; no screenshots. Prints a line
// a page, same, differs with the first lines that differ of each part, only
// on branch or only on main.
// When main's build is not of main's SHA, this public/data/ and node_modules/
// it builds main and the branch again, as dc-lcp.mjs does, in a clean working
// tree; with uncommitted files it stops. Exits as diff does: 0 when every
// page is the same, 1 when one is not, 2 when it cannot run, as when out/data/
// is not main's build's snapshot, or a URL given is on neither side. Not for
// CI. The pages are opened with playwright-core in the installed Google
// Chrome, as dc-check.mjs does (CODING_STANDARDS §3).
// Usage: npm run dc:compare [-- <url> ...], such as
//   npm run dc:compare -- "/reports/population?area=540603"
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { MAIN_BUILD, buildMain, git, hasMainBuild, mainBuildKey, run, snapshotHash } from "./dc-main-build.mjs";
import { serve } from "./dc-serve.mjs";

const MAIN_OUT = path.join(MAIN_BUILD, "out");
// A desktop's width, with the panels side by side.
const WIDTH = 1280;
// How long a page may take to load its data once the network is idle, in ms.
const LOAD_TIMEOUT = 20_000;
// Every status a report page shows while it loads begins with it
// (ReportLoader, TablePicker, PopulationResults).
const LOADING = "กำลังโหลด";
// An id of React 19.2.3's useId: _R_…_ in a hydrated tree, with H and a
// counter for a component's second id, and _r_…_ in one the browser rendered
// alone. A component added above shifts every id below it.
const USE_ID = /_[Rr]_[0-9a-v]+(?:H[0-9a-v]+)?_/g;
// A file of next build under /_next/static/: a chunk named by its content's
// hash, or a path under the build's id.
const STATIC_FILE = /(\/_next\/static\/)[^"'\s)\\]+/g;

// The comments around a Suspense boundary, <!--$--> before it and <!--/$-->
// after (#374). One build's page came with them at one opening and without
// them at the next, and two builds of the same page code, their 22 report
// pages compared in two rounds, had the same <main> on 12 and 16 pages with
// them in, on all 22 both rounds with them out. <!--$?--> and <!--$!--> are
// not matched: the HTML next build writes has them, <!--$?--> ahead of the
// status a report page shows while it loads, and no <main> of the 22 had one
// once loaded, so one that shows is a page in another state. The <!--/$-->
// that closes it goes all the same.
const SUSPENSE_COMMENT = /<!--\/?\$-->/g;

// HTML with what changes though the code does not taken out: from build to
// build, the ids of useId and the names of chunks; from one opening to the
// next, the comments around a Suspense boundary. Each class stays, as a
// changed class is a changed look, and so does every other comment, <!-- -->
// among them.
export function normalizeHtml(html) {
  return html.replace(USE_ID, "«id»").replace(STATIC_FILE, "$1«chunk»").replace(SUSPENSE_COMMENT, "");
}

// The URL paths of the pages under /reports/ in an out/: every /reports/{id}
// and /reports/population.
function reportPages(out) {
  return fs
    .readdirSync(path.join(out, "reports"))
    .filter((file) => file.endsWith(".html"))
    .map((file) => `/reports/${file.replace(/\.html$/, "")}`);
}

// The parts of a page compared, each as lines: the innerText of <main>, its
// HTML normalized one tag a line, and the CSV's file name then its lines.
const PARTS = [
  ["text", (side) => side.text.split("\n")],
  ["HTML", (side) => normalizeHtml(side.html).replaceAll("><", ">\n<").split("\n")],
  ["CSV", (side) => (side.csv ? [side.csv.name, ...side.csv.text.split("\r\n")] : ["(no CSV)"])],
];

// The lines of a part shown of each side, short enough to paste in a PR's
// Evidence.
const SHOWN_LINES = 5;

// The first lines that differ between main's lines and the branch's, as a
// short diff: from the first line not the same to the last, main's with -
// and the branch's with +, up to SHOWN_LINES a side and how many more.
function diffLines(name, main, branch) {
  let start = 0;
  while (start < main.length && start < branch.length && main[start] === branch[start]) start++;
  let end = 0;
  while (end < main.length - start && end < branch.length - start && main.at(-1 - end) === branch.at(-1 - end)) end++;
  const side = (sign, lines) => {
    const changed = lines.slice(start, lines.length - end);
    const more = changed.length - SHOWN_LINES;
    return [
      ...changed.slice(0, SHOWN_LINES).map((line) => `  ${sign} ${line}`),
      ...(more > 0 ? [`  ${sign} … ${more} more`] : []),
    ];
  };
  return [`  ${name}, line ${start + 1}:`, ...side("-", main), ...side("+", branch)];
}

// A page's verdict, and the lines that say it: branch and main are what each
// side shows, null when it has no such page.
export function comparePage(url, branch, main) {
  if (!main || !branch) {
    const verdict = main ? "only on main" : branch ? "only on branch" : "on neither side";
    return { url, verdict, lines: [`${url}: ${verdict}`] };
  }
  const differ = PARTS.map(([name, lines]) => [name, lines(main), lines(branch)]).filter(
    ([, a, b]) => a.join("\n") !== b.join("\n"),
  );
  if (differ.length === 0) return { url, verdict: "same", lines: [`${url}: same`] };
  return {
    url,
    verdict: "differs",
    lines: [
      `${url}: differs at ${differ.map(([name]) => name).join(", ")}`,
      ...differ.flatMap(([name, a, b]) => diffLines(name, a, b)),
    ],
  };
}

// The exit code of the run, as diff's: 0 when every page is the same, 1 when
// one is not, and 2 when a URL asked is on neither side, as the run cannot
// say what it was asked.
export function exitCode(results) {
  if (results.some(({ verdict }) => verdict === "on neither side")) return 2;
  return results.every(({ verdict }) => verdict === "same") ? 0 : 1;
}

// The pages to open on both sides: every report page of either build, in
// order, then each URL asked that is not one of them.
export function pagesToOpen(branchOut, mainOut, asked) {
  const built = [...new Set([...reportPages(branchOut), ...reportPages(mainOut)])].sort();
  return [...new Set([...built, ...asked])];
}

function die(message) {
  console.error(`dc-compare: ${message}`);
  process.exit(2);
}

// What a page shows once loaded, as comparePage reads it, or null for a 404.
async function readPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 800 } });
  try {
    await page.route(
      (u) => u.hostname === "tile.openstreetmap.org",
      (route) => route.abort(),
    );
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (response.status() === 404) return null;
    await page.waitForFunction((loading) => !document.querySelector("main").innerText.includes(loading), LOADING, {
      timeout: LOAD_TIMEOUT,
    });
    const { text, html } = await page.evaluate(() => {
      const main = document.querySelector("main");
      return { text: main.innerText, html: main.outerHTML };
    });
    const button = page.getByRole("button", { name: "ดาวน์โหลด CSV", exact: true });
    let csv = null;
    if ((await button.count()) > 0 && (await button.isEnabled())) {
      const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
      csv = { name: download.suggestedFilename(), text: fs.readFileSync(await download.path(), "utf8") };
    }
    return { text, html, csv };
  } finally {
    await page.close();
  }
}

if (import.meta.main) {
  const asked = process.argv.slice(2);
  const bad = asked.find((url) => !url.startsWith("/"));
  if (bad) die(`${bad}: a URL is a path from the site's root, such as "/reports/population?area=540603"`);
  if (!fs.existsSync("public/data")) die("public/data/ is missing: run npm run snapshot first");
  if (!fs.existsSync("node_modules/.package-lock.json"))
    die("node_modules/.package-lock.json is missing: run npm ci first");
  const headSha = git("rev-parse", "--short", "HEAD");
  const mainSha = git("rev-parse", "--short", "main");
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  // A detached HEAD goes back to its commit.
  const start = branch === "HEAD" ? headSha : branch;
  // Ctrl-C reaches the build running too; exiting checks out start again
  // when it stopped on main (buildMain).
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => process.exit(128 + os.constants.signals[signal]));

  try {
    const key = mainBuildKey();
    if (hasMainBuild(key)) {
      console.log(`dc-compare: reusing main's build of ${mainSha} in ${MAIN_BUILD}/`);
    } else if (git("status", "--porcelain")) {
      die(
        `${MAIN_BUILD}/ holds no build of main ${mainSha} from this public/data/ and node_modules/, and the working tree is not clean: commit or stash first, as main is built in it`,
      );
    } else {
      buildMain({ name: "dc-compare", key, mainSha, start });
      console.log(`dc-compare: building ${start} (${headSha})`);
      run("npx", ["next", "build"], { stdio: "inherit" });
    }
  } catch (error) {
    die(error.message);
  }
  if (!fs.existsSync("out/reports") || !fs.existsSync("out/data"))
    die("out/ lacks /reports/ or /data/: run npx next build first");
  if (snapshotHash("out/data") !== snapshotHash(path.join(MAIN_OUT, "data"))) {
    die(
      `out/data/ is not the snapshot of main's build in ${MAIN_OUT}/data/, so a difference could come from the data, not the code: run npx next build again`,
    );
  }

  const pages = pagesToOpen("out", MAIN_OUT, asked);
  const servers = [await serve("out"), await serve(MAIN_OUT)];
  const [branchOrigin, mainOrigin] = servers.map((server) => `http://127.0.0.1:${server.address().port}`);
  const results = [];
  let browser;
  // The page being opened, which an error names
  let opening = "";
  try {
    browser = await chromium.launch({ channel: "chrome" });
    for (const url of pages) {
      opening = `${url} on the branch: `;
      const branch = await readPage(browser, branchOrigin + url);
      opening = `${url} on main: `;
      const result = comparePage(url, branch, await readPage(browser, mainOrigin + url));
      console.log(result.lines.join("\n"));
      results.push(result);
    }
  } catch (error) {
    // Playwright messages end in a multi-line call log; the first line names the failure.
    die(opening + error.message.split("\n")[0]);
  } finally {
    await browser?.close();
    servers.forEach((server) => server.close());
  }
  const counts = Object.entries(Object.groupBy(results, ({ verdict }) => verdict)).map(
    ([verdict, group]) => `${group.length} ${verdict}`,
  );
  const uncommitted = git("status", "--porcelain") ? " with uncommitted changes" : "";
  console.log(
    `\ndc-compare: main ${mainSha} vs out/ of ${start} ${headSha}${uncommitted}: ${results.length} page(s), ${counts.join(", ")}`,
  );
  process.exitCode = exitCode(results);
}
