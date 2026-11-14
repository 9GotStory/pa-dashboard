// The local LCP comparison with main that SPEC §9.6 asks of a ticket changing
// a page's top or JavaScript (#277). Builds the local main, then this branch
// (npx next build, both from the same public/data/), serves the two out/ on
// free ports, runs Lighthouse 3 rounds per page with one run of each side per
// round, swapping which side goes first, and prints each page's medians.
// main's build is kept in .dc-lcp/main/ (#294) and reused while main's SHA,
// the snapshot and node_modules/.package-lock.json are those it was built
// from. After both builds it runs this branch's dc-budget.mjs on each side
// and prints both outputs in the summary; they do not change the exit code,
// as CI checks dc:budget. The Lighthouse JSON of the last run is in
// .dc-lcp/local/. Exits 1 when a branch median is over 10% slower than
// main's. Ends on the branch it started from, with out/ and .next/ from the
// branch's build, so dc:check and dc:budget can follow. Not for CI, whose
// runners are too noisy. Lighthouse and serve run through npx; neither is a
// dependency.
// With --live (#295) it builds nothing and needs neither git nor public/data/:
// it runs Lighthouse 3 rounds on the live site, each round every page, their
// order swapped round by round, and prints each page's runs, median and LCP
// elements, with built_at of the live meta.json before and after. The JSON is
// in .dc-lcp/live/. Exits 1 when a median is not under 2.5 s, or when
// built_at changed, as a deploy landed mid-measurement.
// Usage: npm run dc:lcp [-- [--live] <page> ...]   (default /)
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROUNDS = 3;
// In the repo and gitignored, so a reboot keeps them, unlike a temp dir:
// main's build, and the Lighthouse JSON of the last run, emptied each run.
const MAIN_BUILD = ".dc-lcp/main";
const LIGHTHOUSE_JSON = ".dc-lcp/local";
const LIVE_JSON = ".dc-lcp/live";
const LIVE_SITE = "https://songhealth-dc.pages.dev";
// The one file of .next/ that dc-budget.mjs reads besides out/; the whole
// .next/ is about 189 MB.
const LOADABLE_MANIFEST = ".next/server/app/(dc)/reports/[id]/page/react-loadable-manifest.json";
// SPEC §9.6's command. Blocking the map tiles changes nothing on a page
// without the map.
const LIGHTHOUSE = [
  "lighthouse@13.5.0",
  "--only-categories=performance",
  "--throttling-method=devtools",
  "--blocked-url-patterns=*tile.openstreetmap.org*",
  "--chrome-flags=--headless=new",
  "--output=json",
  "--quiet",
];

// Lighthouse 13 has no largest-contentful-paint-element audit; the element is
// the node item inside lcp-breakdown-insight.
export function readLcp(report) {
  const node = report.audits["lcp-breakdown-insight"].details.items.find((item) => item.type === "node");
  return { ms: report.audits["largest-contentful-paint"].numericValue, element: `${node.snippet} ${node.nodeLabel}` };
}

// The median of an odd number of runs, so the element shown is the one of a
// real run.
export function medianRun(runs) {
  return runs.toSorted((a, b) => a.ms - b.ms)[(runs.length - 1) / 2];
}

// SPEC §9.6: the branch's median may be at most 10% slower than main's.
// Multiplying instead of dividing keeps exactly 10% exact.
export function tooSlow(branchMs, mainMs) {
  return branchMs * 10 > mainMs * 11;
}

// SPEC §9.6: a page's median on the live site must be under 2.5 s (#295).
const LIVE_BUDGET_MS = 2500;
export function overLiveBudget(ms) {
  return ms >= LIVE_BUDGET_MS;
}

// The pages in round's order: as given in odd rounds, reversed in even ones.
export function roundOrder(pages, round) {
  return round % 2 ? pages : pages.toReversed();
}

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

// The hash of a directory's files: each relative path, sorted, then the hash
// of its content, so a renamed file or a moved boundary between two files
// changes it too.
export function snapshotHash(dir) {
  const files = fs
    .readdirSync(dir, { recursive: true })
    .filter((file) => fs.statSync(path.join(dir, file)).isFile())
    .map((file) => file.split(path.sep).join("/"))
    .sort();
  return sha256(files.map((file) => `${file}\0${sha256(fs.readFileSync(path.join(dir, file)))}\n`).join(""));
}

// Whether built-from.json names the build that key describes: main's SHA,
// the snapshot's hash and the hash of node_modules/.package-lock.json. A
// file cut short names none, so main is built again.
export function sameBuild(file, key) {
  if (!fs.existsSync(file)) return false;
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return false;
  }
  return saved.main === key.main && saved.snapshot === key.snapshot && saved.packages === key.packages;
}

function run(command, args, options) {
  const { status, stdout } = spawnSync(command, args, { encoding: "utf8", ...options });
  if (status !== 0) throw new Error(`${[command, ...args].join(" ")} failed`);
  return stdout?.trim();
}

function git(...args) {
  return run("git", args, { stdio: ["ignore", "pipe", "inherit"] });
}

function die(message) {
  console.error(`dc-lcp: ${message}`);
  process.exit(1);
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const servers = [];

async function serve(dir) {
  const port = await freePort();
  // Its own process group, so killing -pid stops npx and the serve it starts.
  // Unref'd: the exit handler stops it.
  const server = spawn("npx", ["serve@latest", dir, "-l", String(port), "-n", "-L", "--no-port-switching"], {
    detached: true,
    stdio: ["ignore", "ignore", "inherit"],
  });
  server.unref();
  servers.push(server);
  const url = `http://localhost:${port}`;
  for (const deadline = Date.now() + 120_000; Date.now() < deadline;) {
    if (server.exitCode !== null) throw new Error(`serve ${dir} exited with code ${server.exitCode}`);
    try {
      await fetch(url, { signal: AbortSignal.timeout(5000) });
      return url;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`serve ${dir} did not answer on ${url} within 2 minutes`);
}

// The output of this branch's dc-budget.mjs run in dir, so both sides are
// counted the same way, with its error when it fails.
function budget(dir) {
  const { stdout, stderr } = spawnSync(process.execPath, [path.join(import.meta.dirname, "dc-budget.mjs")], {
    cwd: dir,
    encoding: "utf8",
  });
  return (stdout + stderr).trim();
}

function lighthouse(url, file) {
  run("npx", [...LIGHTHOUSE, `--output-path=${file}`, url], { stdio: ["ignore", "ignore", "inherit"] });
  return readLcp(JSON.parse(fs.readFileSync(file, "utf8")));
}

const jsonFile = (dir, page, ...parts) => path.join(dir, `${[page.replace(/[^\w-]+/g, "_"), ...parts].join("-")}.json`);
const loadAverage = (values) => values.map((value) => value.toFixed(2)).join(" ");

function pagesFrom(args) {
  const pages = args.length ? args : ["/"];
  const bad = pages.find((page) => !page.startsWith("/"));
  if (bad) die(`${bad}: a page is a path from the site's root, such as / or /reports`);
  return pages;
}

async function liveBuiltAt() {
  const response = await fetch(`${LIVE_SITE}/data/meta.json`);
  if (!response.ok) throw new Error(`${LIVE_SITE}/data/meta.json answered ${response.status}`);
  return (await response.json()).built_at;
}

async function measureLive(pages) {
  fs.rmSync(LIVE_JSON, { recursive: true, force: true });
  fs.mkdirSync(LIVE_JSON, { recursive: true });
  try {
    const builtBefore = await liveBuiltAt();
    const loadBefore = os.loadavg();
    const runs = Object.fromEntries(pages.map((page) => [page, []]));
    for (let round = 1; round <= ROUNDS; round++) {
      for (const page of roundOrder(pages, round)) {
        const lcp = lighthouse(LIVE_SITE + page, jsonFile(LIVE_JSON, page, round));
        console.log(`dc-lcp: ${page} round ${round} ${Math.round(lcp.ms)} ms`);
        runs[page].push(lcp);
      }
    }
    const loadAfter = os.loadavg();
    const builtAfter = await liveBuiltAt();

    console.log(
      `\nLCP on ${LIVE_SITE}, ${ROUNDS} rounds · built_at ${builtBefore} before, ${builtAfter} after · load average ${loadAverage(loadBefore)} before, ${loadAverage(loadAfter)} after`,
    );
    let fail = false;
    for (const page of pages) {
      const median = medianRun(runs[page]).ms;
      const over = overLiveBudget(median);
      fail ||= over;
      const rounds = runs[page].map(({ ms }) => Math.round(ms)).join(" · ");
      console.log(
        `${page}: ${rounds} ms · median ${Math.round(median)} ms · ${over ? "FAIL: not under" : "pass: under"} ${LIVE_BUDGET_MS} ms`,
      );
      runs[page].forEach(({ element }, i) => console.log(`  round ${i + 1} LCP element: ${element}`));
    }
    if (builtAfter !== builtBefore) {
      console.error("dc-lcp: built_at changed while measuring, as a deploy landed: run again");
      fail = true;
    }
    if (fail) process.exitCode = 1;
  } catch (error) {
    console.error(`dc-lcp: ${error.message}`);
    process.exitCode = 1;
  } finally {
    console.log(`Lighthouse JSON: ${LIVE_JSON}/`);
  }
}

if (import.meta.main && process.argv[2] === "--live") {
  await measureLive(pagesFrom(process.argv.slice(3)));
} else if (import.meta.main) {
  const pages = pagesFrom(process.argv.slice(2));

  if (git("status", "--porcelain")) die("the working tree is not clean: commit or stash first, as main is built in it");
  const headSha = git("rev-parse", "--short", "HEAD");
  const mainSha = git("rev-parse", "--short", "main");
  if (headSha === mainSha) die("HEAD is main's commit: run this on a branch to compare it with main");
  if (!fs.existsSync("public/data")) die("public/data/ is missing: run npm run snapshot first");
  if (!fs.existsSync("node_modules/.package-lock.json"))
    die("node_modules/.package-lock.json is missing: run npm ci first");
  const behind = spawnSync("git", ["rev-list", "--count", "main..origin/main"], { encoding: "utf8" }).stdout?.trim();
  if (behind && behind !== "0") {
    console.warn(`dc-lcp: warning: main is ${behind} commits behind origin/main; pull main to compare with the latest`);
  }
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  // A detached HEAD goes back to its commit.
  const start = branch === "HEAD" ? headSha : branch;

  let onMain = false;
  process.on("exit", () => {
    for (const server of servers) {
      try {
        process.kill(-server.pid);
      } catch {
        // Its group has ended already.
      }
    }
    if (onMain && spawnSync("git", ["checkout", "--quiet", start], { stdio: "inherit" }).status !== 0) {
      console.error(`dc-lcp: could not check out ${start} again: run git checkout ${start}`);
    }
  });
  // Ctrl-C reaches the build or Lighthouse running too. A signal sent to this
  // process alone is handled once that child has finished.
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => process.exit(128 + os.constants.signals[signal]));

  const key = {
    main: git("rev-parse", "main"),
    snapshot: snapshotHash("public/data"),
    packages: sha256(fs.readFileSync("node_modules/.package-lock.json")),
  };
  const builtFrom = path.join(MAIN_BUILD, "built-from.json");
  fs.rmSync(LIGHTHOUSE_JSON, { recursive: true, force: true });
  fs.mkdirSync(LIGHTHOUSE_JSON, { recursive: true });
  try {
    if (sameBuild(builtFrom, key)) {
      console.log(`dc-lcp: reusing main's build of ${mainSha} in ${MAIN_BUILD}/`);
    } else {
      fs.rmSync(MAIN_BUILD, { recursive: true, force: true });
      // main is built in this working tree: a git worktree of main with
      // node_modules symlinked does not build, as Turbopack refuses files
      // outside the worktree's root.
      console.log(`dc-lcp: building main (${mainSha})`);
      git("checkout", "--quiet", "main");
      onMain = true;
      run("npx", ["next", "build"], { stdio: "inherit" });
      fs.cpSync("out", path.join(MAIN_BUILD, "out"), { recursive: true });
      fs.cpSync(LOADABLE_MANIFEST, path.join(MAIN_BUILD, LOADABLE_MANIFEST));
      // Last, so a copy cut short is built again next time.
      fs.writeFileSync(builtFrom, `${JSON.stringify(key, null, 2)}\n`);
      // When the branch's build fails, no out/ of main is left for dc:check.
      fs.rmSync("out", { recursive: true });
      git("checkout", "--quiet", start);
      onMain = false;
    }
    console.log(`dc-lcp: building ${start} (${headSha})`);
    run("npx", ["next", "build"], { stdio: "inherit" });
    const budgets = [
      [`main ${mainSha}`, budget(MAIN_BUILD)],
      [`${start} ${headSha}`, budget(".")],
    ];

    const urls = { main: await serve(path.join(MAIN_BUILD, "out")), branch: await serve("out") };
    const loadBefore = os.loadavg();
    const results = [];
    for (const page of pages) {
      const runs = { main: [], branch: [] };
      for (let round = 1; round <= ROUNDS; round++) {
        for (const side of round % 2 ? ["main", "branch"] : ["branch", "main"]) {
          const lcp = lighthouse(urls[side] + page, jsonFile(LIGHTHOUSE_JSON, page, side, round));
          console.log(`dc-lcp: ${page} round ${round} ${side} ${Math.round(lcp.ms)} ms`);
          runs[side].push(lcp);
        }
      }
      const main = medianRun(runs.main);
      const branch = medianRun(runs.branch);
      results.push({ page, main, branch, slow: tooSlow(branch.ms, main.ms) });
    }

    console.log(
      `\nLCP, median of ${ROUNDS}: main ${mainSha} vs ${start} ${headSha} · load average ${loadAverage(loadBefore)} before, ${loadAverage(os.loadavg())} after`,
    );
    for (const { page, main, branch, slow } of results) {
      const diff = ((branch.ms - main.ms) / main.ms) * 100;
      const verdict = slow ? "FAIL: over 10% slower than main" : "pass";
      console.log(
        `${page}: main ${Math.round(main.ms)} ms · branch ${Math.round(branch.ms)} ms (${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%) · ${verdict}`,
      );
      console.log(`  main LCP element: ${main.element}`);
      console.log(`  branch LCP element: ${branch.element}`);
    }
    for (const [label, output] of budgets) console.log(`dc:budget ${label}\n${output.replace(/^/gm, "  ")}`);
    if (results.some(({ slow }) => slow)) process.exitCode = 1;
  } catch (error) {
    console.error(`dc-lcp: ${error.message}`);
    process.exitCode = 1;
  } finally {
    console.log(`Lighthouse JSON: ${LIGHTHOUSE_JSON}/`);
  }
}
