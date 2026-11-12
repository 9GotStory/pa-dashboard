// Data Center budget check (SPEC §9.6, CODING_STANDARDS §5). CI runs it after
// npm run build. It exits 1, naming the page, when the JavaScript that the
// home page, the report library or a report page loads is over budget, or
// when a Data Center page preloads font files, which held back each page's
// LCP (SPEC §4).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT = path.resolve("out");
// SPEC's KB is 1024 bytes, as build-snapshot.mjs counts it.
const KB = 1024;
// The pages §9.6 budgets, by the gzip (zlib's default level) of the scripts
// their HTML loads. Leaflet loads later through a dynamic import, so it is in
// no <script> or preload of the HTML and does not count.
const JS_BUDGET = { "/": 150 * KB, "/reports": 150 * KB };
// Each /reports/{id} (SPEC §9.6, since F52), without the chunks of the table
// pages that src/components/dc/tables/TablePicker.tsx loads with next/dynamic.
const REPORT_BUDGET = 150 * KB;
// Where next build lists the files of each next/dynamic import of
// /reports/[id], as paths under _next/. Not in the Next.js docs: when a
// version stops writing it, this check fails rather than count those chunks.
const LOADABLE_MANIFEST = path.resolve(".next/server/app/(dc)/reports/[id]/page/react-loadable-manifest.json");

function fail(message) {
  console.error(`dc-budget: ${message}`);
  process.exit(1);
}

const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;
const sum = (files) => files.reduce((total, f) => total + f.gzip, 0);
const htmlOf = (page) => fs.readFileSync(path.join(OUT, page === "/" ? "index.html" : `${page}.html`), "utf8");

// The (dc) pages in out/, as dc-check.mjs lists them: /, /reports and /reports/{id}.
function dcPages() {
  const reports = path.join(OUT, "reports");
  const ids = fs.existsSync(reports) ? fs.readdirSync(reports).filter((f) => f.endsWith(".html")).sort() : [];
  if (!fs.existsSync(path.join(OUT, "index.html")) || !fs.existsSync(path.join(OUT, "reports.html")) || ids.length === 0) {
    fail("out/ lacks /, /reports or any /reports/{id} page: run npm run build first");
  }
  return ["/", "/reports", ...ids.map((f) => `/reports/${f.replace(/\.html$/, "")}`)];
}

// The <script src> files of the page's HTML, without the noModule polyfill, which modern browsers skip
function scriptTagsOf(html) {
  const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].filter(([tag]) => !/\bnomodule\b/i.test(tag));
  return tags.map(([, src]) => src.split("?")[0]);
}

// Each script file the page's HTML loads, once: <script src> and <link rel="preload" as="script">.
function scriptsOf(html) {
  const preloads = [...html.matchAll(/<link\b(?=[^>]*\bas="script")[^>]*\bhref="([^"]+)"[^>]*>/g)];
  return [...new Set([...scriptTagsOf(html), ...preloads.map(([, src]) => src.split("?")[0])])];
}

// The script files of the table pages' chunks, as the HTML names them
function tablePageChunks() {
  if (!fs.existsSync(LOADABLE_MANIFEST)) {
    fail(`${path.relative(".", LOADABLE_MANIFEST)} is missing: run npm run build first, or find where this version of Next.js lists next/dynamic chunks`);
  }
  const manifest = JSON.parse(fs.readFileSync(LOADABLE_MANIFEST, "utf8"));
  return new Set(Object.values(manifest).flatMap((entry) => entry.files.map((file) => `/_next/${file}`)));
}

// The gzip size of each script the page's HTML loads, but those of skip that
// it only preloads: a file of skip that the HTML runs as a <script src> is
// not a chunk next/dynamic loads, and counts.
function loaded(page, skip = new Set()) {
  const html = htmlOf(page);
  const run = new Set(scriptTagsOf(html));
  return scriptsOf(html)
    .filter((src) => run.has(src) || !skip.has(src))
    .map((src) => ({ src, gzip: zlib.gzipSync(fs.readFileSync(path.join(OUT, src))).length }));
}

// [] when the files are within budget, else the problem, naming the page and its largest files
function overBudget(page, files, budget) {
  if (sum(files) <= budget) return [];
  const largest = files.sort((a, b) => b.gzip - a.gzip).slice(0, 3).map((f) => `${f.src} ${kb(f.gzip)}`);
  return [`${page} is over the JavaScript budget of SPEC §9.6; the largest files: ${largest.join(", ")}`];
}

const pages = dcPages();
const problems = [];

for (const [page, budget] of Object.entries(JS_BUDGET)) {
  const files = loaded(page);
  console.log(`dc-budget: ${page} loads ${kb(sum(files))} of JavaScript (gzip, ${files.length} files) of ${kb(budget)}`);
  problems.push(...overBudget(page, files, budget));
}

const chunks = tablePageChunks();
const reports = pages.filter((page) => page.startsWith("/reports/")).map((page) => ({ page, files: loaded(page, chunks) }));
const most = reports.reduce((a, b) => (sum(b.files) > sum(a.files) ? b : a));
console.log(
  `dc-budget: each of ${reports.length} /reports/{id} loads at most ${kb(sum(most.files))} of JavaScript ` +
    `(gzip, ${most.page}) of ${kb(REPORT_BUDGET)}, without the table pages' chunks`,
);
for (const { page, files } of reports) problems.push(...overBudget(page, files, REPORT_BUDGET));

const preloading = pages.filter((page) => /<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="font")[^>]*>/.test(htmlOf(page)));
console.log(`dc-budget: ${preloading.length} of ${pages.length} Data Center pages preload font files`);
if (preloading.length > 0) {
  problems.push(
    `${preloading.slice(0, 3).join(", ")}${preloading.length > 3 ? " and more" : ""} preload font files: ` +
      "the (dc) layout sets src/lib/dc/fonts.ts, which preloads none, and PA's fonts belong in the /pa and /sync layouts (SPEC §4)",
  );
}

if (problems.length > 0) fail(problems.join("\n  "));
console.log("dc-budget: pass");
