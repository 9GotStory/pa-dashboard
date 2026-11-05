// Data Center budget check (SPEC §9.6, CODING_STANDARDS §5). CI runs it after
// npm run build. It exits 1, naming the page, when the JavaScript that the
// home page or the report library loads is over budget, or when a Data Center
// page preloads font files, which held back each page's LCP (SPEC §4).
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

function fail(message) {
  console.error(`dc-budget: ${message}`);
  process.exit(1);
}

const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;
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

// Each script file the page's HTML loads, once: <script src> (not the noModule
// polyfill, which modern browsers skip) and <link rel="preload" as="script">.
function scriptsOf(html) {
  const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].filter(([tag]) => !/\bnomodule\b/i.test(tag));
  const preloads = [...html.matchAll(/<link\b(?=[^>]*\bas="script")[^>]*\bhref="([^"]+)"[^>]*>/g)];
  return [...new Set([...tags, ...preloads].map(([, src]) => src.split("?")[0]))];
}

const pages = dcPages();
const problems = [];

for (const [page, budget] of Object.entries(JS_BUDGET)) {
  const files = scriptsOf(htmlOf(page)).map((src) => ({ src, gzip: zlib.gzipSync(fs.readFileSync(path.join(OUT, src))).length }));
  const total = files.reduce((sum, f) => sum + f.gzip, 0);
  console.log(`dc-budget: ${page} loads ${kb(total)} of JavaScript (gzip, ${files.length} files) of ${kb(budget)}`);
  if (total > budget) {
    const largest = files.sort((a, b) => b.gzip - a.gzip).slice(0, 3).map((f) => `${f.src} ${kb(f.gzip)}`);
    problems.push(`${page} is over the JavaScript budget of SPEC §9.6; the largest files: ${largest.join(", ")}`);
  }
}

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
