// Data Center budget check (SPEC §9.6, CODING_STANDARDS §5). CI runs it after
// npm run build. It exits 1, naming the page, when the JavaScript that the
// home page, the report library, รายงานประชากร or a report page loads is over budget,
// or holds Motion's feature set (ADR-0018), or
// when a Data Center page, /pa or a /pa/{year} preloads font files, which held
// back each page's LCP (SPEC §4), or when /pa or a /pa/{year} hides its
// content behind Suspense (#338).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT = path.resolve("out");
// SPEC's KB is 1024 bytes, as build-snapshot.mjs counts it.
const KB = 1024;
// The pages §9.6 budgets, by the gzip (zlib's default level) of the scripts
// their HTML loads: 170 KB since Track O brought in Motion (ADR-0018, F90).
// Leaflet and Motion's feature set load later through a dynamic import, so
// they are in no <script> or preload of the HTML and do not count.
// /reports/population (Track K) loads its เปรียบเทียบ and age sections with
// next/dynamic once its data is in (F70): its HTML neither runs nor preloads
// their chunks, so every script the HTML loads counts.
const POPULATION_PAGE = "/reports/population";
const JS_BUDGET = { "/": 170 * KB, "/reports": 170 * KB, [POPULATION_PAGE]: 170 * KB };
// Each /reports/{id} (SPEC §9.6, since F52), without the chunks of the table
// pages that src/components/dc/tables/TablePicker.tsx loads with next/dynamic.
const REPORT_BUDGET = 170 * KB;
// Words of Motion's feature set (domAnimation) that its m components and
// LazyMotion lack: the names of its animation's orchestration options, which
// minifying keeps. Motion 14.14.0 has them in the one chunk that
// src/components/dc/MotionRoot.tsx imports (F90).
const FEATURE_WORDS = ["staggerChildren", "beforeChildren"];
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

// The (dc) pages in out/, as dc-check.mjs lists them: /, /reports and every
// page under /reports/, /reports/population (SPEC §4) among them.
function dcPages() {
  const reports = path.join(OUT, "reports");
  const ids = fs.existsSync(reports)
    ? fs
        .readdirSync(reports)
        .filter((f) => f.endsWith(".html"))
        .sort()
    : [];
  if (
    !fs.existsSync(path.join(OUT, "index.html")) ||
    !fs.existsSync(path.join(OUT, "reports.html")) ||
    ids.length === 0
  ) {
    fail("out/ lacks /, /reports or any /reports/{id} page: run npm run build first");
  }
  return ["/", "/reports", ...ids.map((f) => `/reports/${f.replace(/\.html$/, "")}`)];
}

// /pa and every /pa/{year} in out/ (SPEC §4). /sync keeps PA's fonts, so it is not here.
function paPages() {
  if (!fs.existsSync(path.join(OUT, "pa.html"))) fail("out/ lacks /pa: run npm run build first");
  const years = path.join(OUT, "pa");
  const closed = fs.existsSync(years)
    ? fs
        .readdirSync(years)
        .filter((f) => f.endsWith(".html"))
        .sort()
    : [];
  return ["/pa", ...closed.map((f) => `/pa/${f.replace(/\.html$/, "")}`)];
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
    fail(
      `${path.relative(".", LOADABLE_MANIFEST)} is missing: run npm run build first, or find where this version of Next.js lists next/dynamic chunks`,
    );
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
  const largest = files
    .sort((a, b) => b.gzip - a.gzip)
    .slice(0, 3)
    .map((f) => `${f.src} ${kb(f.gzip)}`);
  return [`${page} is over the JavaScript budget of SPEC §9.6; the largest files: ${largest.join(", ")}`];
}

const pages = dcPages();
const problems = [];

for (const [page, budget] of Object.entries(JS_BUDGET)) {
  const files = loaded(page);
  console.log(
    `dc-budget: ${page} loads ${kb(sum(files))} of JavaScript (gzip, ${files.length} files) of ${kb(budget)}`,
  );
  problems.push(...overBudget(page, files, budget));
}

const chunks = tablePageChunks();
const reports = pages
  .filter((page) => page.startsWith("/reports/") && page !== POPULATION_PAGE)
  .map((page) => ({ page, files: loaded(page, chunks) }));
const most = reports.reduce((a, b) => (sum(b.files) > sum(a.files) ? b : a));
console.log(
  `dc-budget: each of ${reports.length} /reports/{id} loads at most ${kb(sum(most.files))} of JavaScript ` +
    `(gzip, ${most.page}) of ${kb(REPORT_BUDGET)}, without the table pages' chunks`,
);
for (const { page, files } of reports) problems.push(...overBudget(page, files, REPORT_BUDGET));

// Motion's feature set loads with a dynamic import, outside the budget
// (ADR-0018): no script that a Data Center page's HTML loads may hold it. A
// build with no file of it means the words above no longer find it, which
// would make this check pass on anything.
const STATIC = path.join(OUT, "_next/static");
const holdsFeatures = (file) => {
  const text = fs.readFileSync(file, "utf8");
  return FEATURE_WORDS.every((word) => text.includes(word));
};
const featureFiles = fs
  .readdirSync(STATIC, { recursive: true })
  .filter((f) => f.endsWith(".js") && holdsFeatures(path.join(STATIC, f)));
const featurePages = pages.filter((page) => scriptsOf(htmlOf(page)).some((src) => holdsFeatures(path.join(OUT, src))));
console.log(
  `dc-budget: Motion's feature set is in ${featureFiles.length} file(s); ` +
    `${featurePages.length} of ${pages.length} Data Center pages load it from their HTML`,
);
if (featureFiles.length === 0) {
  problems.push(
    `no file in out/_next/static holds ${FEATURE_WORDS.join(" and ")}: find words of this Motion version's domAnimation ` +
      "that its m and LazyMotion lack, and set FEATURE_WORDS in src/scripts/dc-budget.mjs",
  );
}
if (featurePages.length > 0) {
  problems.push(
    `${featurePages.slice(0, 3).join(", ")}${featurePages.length > 3 ? " and more" : ""} load Motion's feature set from their HTML: ` +
      "import domAnimation only in src/components/dc/motion-features.ts, which MotionRoot loads with a dynamic import, " +
      "and render m, never the full motion component (ADR-0018)",
  );
}

const pa = paPages();
const fontPages = [...pages, ...pa];
const preloading = fontPages.filter((page) =>
  /<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="font")[^>]*>/.test(htmlOf(page)),
);
console.log(`dc-budget: ${preloading.length} of ${fontPages.length} Data Center and /pa pages preload font files`);
if (preloading.length > 0) {
  problems.push(
    `${preloading.slice(0, 3).join(", ")}${preloading.length > 3 ? " and more" : ""} preload font files: ` +
      "the (dc) and /pa layouts set src/lib/dc/fonts.ts, which preloads none, and PA's fonts belong in the /sync layout only (SPEC §4)",
  );
}

// A loading.tsx wraps the page in Suspense: its HTML then holds the built
// table in <div hidden id="S:0"> until the browser parses $RC( far below (#338).
const suspended = pa.filter((page) => /\bhidden id="S:|\$RC\(/.test(htmlOf(page)));
console.log(`dc-budget: ${suspended.length} of ${pa.length} /pa pages hide their content behind Suspense`);
if (suspended.length > 0) {
  problems.push(
    `${suspended.slice(0, 3).join(", ")}${suspended.length > 3 ? " and more" : ""} hide their content behind Suspense: ` +
      "delete the loading.tsx in src/app/, src/app/pa/ or below, or the <Suspense> around the page; " +
      "static export does not support loading.tsx, and it held back /pa's LCP (SPEC §4)",
  );
}

if (problems.length > 0) fail(problems.join("\n  "));
console.log("dc-budget: pass");
