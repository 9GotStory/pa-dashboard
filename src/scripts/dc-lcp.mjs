// The local LCP comparison with main that SPEC §9.6 asks of a ticket changing
// a page's top or JavaScript (#277). Builds the local main, then this branch
// (npx next build, both from the same public/data/), serves the two out/ on
// free ports, runs Lighthouse 3 rounds per page with one run of each side per
// round, swapping which side goes first, and prints each page's medians.
// Exits 1 when a branch median is over 10% slower than main's. Ends on the
// branch it started from, with out/ and .next/ from the branch's build, so
// dc:check and dc:budget can follow. Not for CI, whose runners are too noisy.
// Lighthouse and serve run through npx; neither is a dependency.
// Usage: npm run dc:lcp [-- <page> ...]   (default /)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROUNDS = 3;
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
      await fetch(url);
      return url;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`serve ${dir} did not answer on ${url} within 2 minutes`);
}

function lighthouse(url, file) {
  run("npx", [...LIGHTHOUSE, `--output-path=${file}`, url], { stdio: ["ignore", "ignore", "inherit"] });
  return readLcp(JSON.parse(fs.readFileSync(file, "utf8")));
}

if (import.meta.main) {
  const pages = process.argv.length > 2 ? process.argv.slice(2) : ["/"];

  if (git("status", "--porcelain")) die("the working tree is not clean: commit or stash first, as main is built in it");
  const headSha = git("rev-parse", "--short", "HEAD");
  const mainSha = git("rev-parse", "--short", "main");
  if (headSha === mainSha) die("HEAD is main's commit: run this on a branch to compare it with main");
  if (!fs.existsSync("public/data")) die("public/data/ is missing: run npm run snapshot first");
  const behind = spawnSync("git", ["rev-list", "--count", "main..origin/main"], { encoding: "utf8" }).stdout?.trim();
  if (behind && behind !== "0") {
    console.warn(`dc-lcp: warning: main is ${behind} commits behind origin/main; pull main to compare with the latest`);
  }
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  // A detached HEAD goes back to its commit.
  const start = branch === "HEAD" ? headSha : branch;

  let away = false;
  process.on("exit", () => {
    for (const server of servers) if (server.exitCode === null) process.kill(-server.pid);
    if (away && spawnSync("git", ["checkout", "--quiet", start], { stdio: "inherit" }).status !== 0) {
      console.error(`dc-lcp: could not check out ${start} again: run git checkout ${start}`);
    }
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => process.exit(128 + os.constants.signals[signal]));

  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dc-lcp-"));
    // main is built in this working tree: a git worktree of main with
    // node_modules symlinked does not build, as Turbopack refuses files
    // outside the worktree's root.
    console.log(`dc-lcp: building main (${mainSha})`);
    git("checkout", "--quiet", "main");
    away = true;
    run("npx", ["next", "build"], { stdio: "inherit" });
    const mainOut = path.join(tmp, "main-out");
    fs.cpSync("out", mainOut, { recursive: true });
    git("checkout", "--quiet", start);
    away = false;
    console.log(`dc-lcp: building ${start} (${headSha})`);
    run("npx", ["next", "build"], { stdio: "inherit" });

    const urls = { main: await serve(mainOut), branch: await serve("out") };
    const loadBefore = os.loadavg();
    const results = [];
    for (const page of pages) {
      const runs = { main: [], branch: [] };
      for (let round = 1; round <= ROUNDS; round++) {
        for (const side of round % 2 ? ["main", "branch"] : ["branch", "main"]) {
          const file = path.join(tmp, `${page.replace(/[^\w-]+/g, "_")}-${side}-${round}.json`);
          const lcp = lighthouse(urls[side] + page, file);
          console.log(`dc-lcp: ${page} round ${round} ${side} ${Math.round(lcp.ms)} ms`);
          runs[side].push(lcp);
        }
      }
      results.push({ page, main: medianRun(runs.main), branch: medianRun(runs.branch) });
    }

    const load = (values) => values.map((value) => value.toFixed(2)).join(" ");
    console.log(
      `\nLCP, median of ${ROUNDS}: main ${mainSha} vs ${start} ${headSha} · load average ${load(loadBefore)} before, ${load(os.loadavg())} after`,
    );
    for (const { page, main, branch } of results) {
      const diff = ((branch.ms - main.ms) / main.ms) * 100;
      const verdict = tooSlow(branch.ms, main.ms) ? "FAIL: over 10% slower than main" : "pass";
      console.log(
        `${page}: main ${Math.round(main.ms)} ms · branch ${Math.round(branch.ms)} ms (${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%) · ${verdict}`,
      );
      console.log(`  main LCP element: ${main.element}`);
      console.log(`  branch LCP element: ${branch.element}`);
    }
    console.log(`Lighthouse JSON: ${tmp}`);
    if (results.some(({ main, branch }) => tooSlow(branch.ms, main.ms))) process.exitCode = 1;
  } catch (error) {
    console.error(`dc-lcp: ${error.message}`);
    process.exitCode = 1;
  }
}
