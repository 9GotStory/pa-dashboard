// Data Center page check (CODING_STANDARDS §4–5, FEATURES F16). After
// npm run build, opens every built page of /, /reports and /reports/[id] in
// out/ at 360 px wide and exits 1, naming the page, when a page breaks a rule
// that shows on the rendered page. The home page and /reports are opened at
// V7.6's review widths as well, and the check exits 1, naming the width, when
// one scrolls sideways at one (SPEC §9.1). /reports as built, before any
// JavaScript runs, must link every report of the build's catalog.json, and
// the check exits 1 naming each one it lacks (SPEC §9.3). The home page is
// opened wide once more, and the check exits 1, naming the area, when its
// population figures disagree, the figures by the bars of the ตำบล chart
// among them (SPEC §9.2). The pages are opened with playwright-core in the
// installed Google Chrome, the one dependency CODING_STANDARDS §3 allows a
// node script.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";

const OUT = path.resolve("out");
const WIDTH = 360;
// The widths V7.6 reviews the home page at (design.md §3.3), and V1.4 /reports.
const REVIEW_WIDTHS = [320, 390, 768, 1440, 1920];
// The width the population rules read the home page at: a desktop's, with
// the map and the panel side by side.
const POPULATION_WIDTH = 1280;
// The อำเภอ as the panel names it before any ตำบล is picked.
const DISTRICT = "ภาพรวมอำเภอสอง";
// The label of the home page's ตำบล <select> (SPEC §9.2).
const PICKER = "เลือกตำบล";
// The ช่วงอายุ of a pyramid (SCHEMA §11.3).
const AGE_BANDS = 17;
// How long a ตำบล picked in เลือกตำบล may take to show on the pyramid, in ms.
// The first pick may land before the page has hydrated.
const PICK_TIMEOUT = 15_000;
// Roles a person operates; each needs a label (CODING_STANDARDS §4). The
// CamelCase ones are Chrome's own roles for native date, time and colour
// inputs and <summary>.
const CONTROL_ROLES = new Set([
  "button", "link", "textbox", "searchbox", "combobox", "listbox", "checkbox",
  "radio", "switch", "slider", "spinbutton", "tab", "menuitem", "menuitemcheckbox",
  "menuitemradio", "Date", "DateTime", "InputTime", "ColorWell", "DisclosureTriangle",
]);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function fail(message) {
  console.error(`dc-check: ${message}`);
  process.exit(1);
}

// URL paths of the (dc) pages in out/: /, /reports and /reports/{id}. A build
// always has all three, since the prebuild fails with no active report.
function dcPages() {
  const reports = path.join(OUT, "reports");
  const ids = fs.existsSync(reports) ? fs.readdirSync(reports).filter((f) => f.endsWith(".html")).sort() : [];
  if (!fs.existsSync(path.join(OUT, "index.html")) || !fs.existsSync(path.join(OUT, "reports.html")) || ids.length === 0) {
    fail("out/ lacks /, /reports or any /reports/{id} page: run npm run build first");
  }
  return ["/", "/reports", ...ids.map((f) => `/reports/${f.replace(/\.html$/, "")}`)];
}

// The year the home page shows (SPEC §9.2): the last one of this build's
// population.json, undefined when it has none.
function populationYearShown() {
  const file = path.join(OUT, "data", "population.json");
  if (!fs.existsSync(file)) fail("out/ lacks data/population.json: run npm run build first");
  return JSON.parse(fs.readFileSync(file, "utf8")).years.at(-1);
}

// Serves out/ the way the static host does: /reports is reports.html.
function serveOut() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const tries = urlPath.endsWith("/") ? [urlPath + "index.html"] : [urlPath, urlPath + ".html"];
    const file = tries
      .map((p) => path.join(OUT, p))
      .find((f) => f.startsWith(OUT + path.sep) && fs.statSync(f, { throwIfNoEntry: false })?.isFile());
    if (!file) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// The rules that the DOM shows. Runs inside the page, so it uses nothing from
// this module.
function domRules() {
  const found = [];
  const snippet = (el) => el.outerHTML.slice(0, 80);
  for (const table of document.querySelectorAll("table")) {
    if (!table.caption?.textContent.trim()) found.push(`table without a <caption>: ${snippet(table)}`);
  }
  for (const svg of document.querySelectorAll("svg")) {
    // Hidden by itself or an ancestor, or part of an outer svg: nothing to name.
    if (svg.closest('[aria-hidden="true"]') || svg.parentElement?.closest("svg")) continue;
    // One that holds buttons, as the map's ตำบล are (SPEC §9.2), is a group of
    // them, not a picture whose parts a screen reader skips.
    const role = svg.querySelector('[role="button"]') ? "group" : "img";
    if (svg.getAttribute("role") !== role || !svg.getAttribute("aria-label")?.trim()) {
      found.push(`svg without aria-hidden="true" or role="${role}" + aria-label: ${snippet(svg)}`);
    }
  }
  // A wide table scrolls inside its own box (SPEC §9.1), never the page.
  const { scrollWidth, clientWidth } = document.documentElement;
  if (scrollWidth > clientWidth) found.push(`page scrolls sideways: ${scrollWidth}px wide at ${clientWidth}px`);
  // Every number comes from HDC (SPEC §9.1), so no wording of R6's mock data,
  // in any text of the page, shown at 360 px or not, or in the attributes a
  // screen reader reads.
  const body = document.body.cloneNode(true);
  body.querySelectorAll("script, style, template, noscript").forEach((el) => el.remove());
  const attrs = ["aria-label", "alt", "title", "placeholder"];
  const text = [
    document.title,
    body.textContent,
    ...[...document.querySelectorAll(attrs.map((a) => `[${a}]`).join(","))].flatMap((el) => attrs.map((a) => el.getAttribute(a) ?? "")),
  ].join("\n");
  for (const word of ["จำลอง", "ตัวอย่าง"]) {
    const at = text.indexOf(word);
    if (at >= 0) found.push(`word "${word}" in "${text.slice(Math.max(0, at - 20), at + word.length + 20).replace(/\s+/g, " ").trim()}"`);
  }
  return found;
}

// Controls whose name, as Chrome computes it for screen readers, is empty or
// comes from a placeholder alone, which goes once the field has text.
async function unlabelledControls(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const found = [];
  for (const node of nodes) {
    if (node.ignored || !CONTROL_ROLES.has(node.role?.value)) continue;
    const source = node.name?.sources?.find((s) => !s.superseded && s.value?.value);
    if (node.name?.value?.trim() && source?.attribute !== "placeholder") continue;
    const { outerHTML } = await cdp.send("DOM.getOuterHTML", { backendNodeId: node.backendDOMNodeId });
    found.push(`${node.role.value} without a label: ${outerHTML.slice(0, 80)}`);
  }
  await cdp.detach();
  return found;
}

async function checkPage(browser, url) {
  const problems = [];
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 800 } });
  try {
    page.on("pageerror", (err) => problems.push(`error: ${err.message}`));
    page.on("console", (msg) => msg.type() === "error" && problems.push(`error: ${msg.text()}`));
    // Aborted, so a page that breaks the rule never reaches the production GAS.
    await page.route(
      (u) => u.hostname === "script.google.com",
      (route) => {
        problems.push(`request to script.google.com: ${route.request().url()}`);
        return route.abort();
      },
    );
    await page.goto(url, { waitUntil: "networkidle" });
    problems.push(...(await page.evaluate(domRules)), ...(await unlabelledControls(page)));
  } finally {
    await page.close();
  }
  return problems;
}

// Aborts the map's tile requests, so a check never depends on the tile server.
function blockTiles(page) {
  return page.route(
    (u) => u.hostname === "tile.openstreetmap.org",
    (route) => route.abort(),
  );
}

// The widths of REVIEW_WIDTHS at which a page scrolls sideways, as problems
// naming the width; domRules checks the same at WIDTH.
async function overflowProblems(browser, url) {
  const problems = [];
  const page = await browser.newPage();
  try {
    await blockTiles(page);
    for (const width of REVIEW_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(url, { waitUntil: "networkidle" });
      const { scrollWidth, clientWidth } = await page.evaluate(() => {
        const { scrollWidth, clientWidth } = document.documentElement;
        return { scrollWidth, clientWidth };
      });
      if (scrollWidth > clientWidth) problems.push(`page scrolls sideways at ${width}px wide: ${scrollWidth}px wide at ${clientWidth}px`);
    }
  } finally {
    await page.close();
  }
  return problems;
}

// The reports of this build's catalog.json that out/reports.html, as built,
// has no /reports/{opendata_id} link to, as problems naming the report: the
// static HTML lists every report, and the browser filters it once loaded
// (SPEC §9.3), so a page whose list needs JavaScript fails here.
function missingReportLinks() {
  const file = path.join(OUT, "data", "catalog.json");
  if (!fs.existsSync(file)) fail("out/ lacks data/catalog.json: run npm run build first");
  const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
  const html = fs.readFileSync(path.join(OUT, "reports.html"), "utf8");
  const linked = new Set([...html.matchAll(/href="\/reports\/([^"?#/]+)"/g)].map((m) => m[1]));
  return catalog.mains
    .flatMap((m) => m.topics.flatMap((t) => t.groups.flatMap((g) => g.reports)))
    .filter((r) => !linked.has(r.opendata_id))
    .map((r) => `no link to /reports/${r.opendata_id} in the HTML as built, before JavaScript runs`);
}

// What the population rules compare, as the home page shows it (SPEC §9.2): a
// figure the page does not have is null, a list it does not have is empty.
// Runs inside the page, so it uses nothing from this module; picker is PICKER.
function shownPopulation(picker) {
  const parseCount = (text) => {
    const digits = text?.trim().match(/^[\d,]+/)?.[0];
    return digits ? Number(digits.replaceAll(",", "")) : null;
  };
  const listedCount = (scope, label) =>
    parseCount([...document.querySelectorAll(`${scope} dt`)].find((dt) => dt.textContent.trim() === label)?.nextElementSibling?.textContent);
  // The table and the chart of the ตำบล are both on the page, one of them hidden (SPEC §9.2).
  const table = [...document.querySelectorAll("table")].find((t) => t.caption?.textContent.includes("ประชากรรายตำบล"));
  const chart = document.querySelector('[role="group"][aria-label^="กราฟประชากรรายตำบล"]');
  const columns = [...(table?.tHead?.rows[0]?.cells ?? [])].map((cell) => cell.textContent.trim());
  const tambons = [...(table?.tBodies[0]?.rows ?? [])];
  const districtRow = [...(table?.tFoot?.rows ?? [])].find((row) => row.textContent.includes("รวมทั้งอำเภอ"));
  // The ช่วงอายุ rows: a button each, its ชาย figure second and its หญิง figure fourth.
  const pyramid = document.querySelector('[role="group"][aria-label^="พีระมิดประชากร "]');
  const select = [...document.querySelectorAll("select")].find((s) => s.labels[0]?.textContent.trim() === picker);
  return {
    figures: [["ประชากรทั้งหมด", "รวม (คน)"], ["ประชากรชาย", "ชาย (คน)"], ["ประชากรหญิง", "หญิง (คน)"]].map(([label, column]) => {
      const at = columns.indexOf(column);
      return {
        label,
        column,
        overview: listedCount('section[aria-labelledby="overview-title"]', label),
        district: parseCount(districtRow?.cells[at]?.textContent),
        tambons: tambons.map((row) => parseCount(row.cells[at]?.textContent)),
      };
    }),
    tambonNames: tambons.map((row) => row.cells[0]?.textContent.trim()),
    bars: [...(chart?.querySelectorAll("button") ?? [])].map((bar) => ({
      name: bar.firstElementChild?.textContent.trim(),
      count: parseCount(bar.lastElementChild?.textContent),
    })),
    pickable: [...(select?.options ?? [])].filter((option) => option.value).map((option) => option.textContent.trim()),
    panel: listedCount('section[aria-labelledby="area-title"]', "ประชากรทั้งหมด"),
    bands: [...(pyramid?.querySelectorAll("button") ?? [])].flatMap((row) => [parseCount(row.children[1]?.textContent), parseCount(row.children[3]?.textContent)]),
    unsplit: parseCount(pyramid?.closest("section")?.textContent.match(/ไม่รวมประชากรที่ไม่แยกอายุ ([\d,]+) คน/)?.[1]),
  };
}

// [] when the two figures are the same number, else the problem, naming area.
function mismatchProblems(area, nameA, a, nameB, b) {
  if (a !== null && a === b) return [];
  const shown = (n) => (n === null ? "not on the page" : n.toLocaleString("en-US"));
  return [`${area}: ${nameA} ${shown(a)} ≠ ${nameB} ${shown(b)}`];
}

// The totals rule: the ภาพรวมประชากร, the รวมทั้งอำเภอ row and the sum of the ตำบล rows agree.
function totalsProblems(figures) {
  return figures.flatMap(({ label, column, overview, district, tambons }) => {
    const sum = tambons.length > 0 && !tambons.includes(null) ? tambons.reduce((a, b) => a + b) : null;
    return [
      ...mismatchProblems(DISTRICT, `ภาพรวมประชากร ${label}`, overview, `รวมทั้งอำเภอ ${column}`, district),
      ...mismatchProblems(DISTRICT, `รวมทั้งอำเภอ ${column}`, district, `sum of the ตำบล rows ${column}`, sum),
    ];
  });
}

// The chart rule: the figure by each ตำบล's bar is its รวม (คน) in the
// table, and every ตำบล of the table has a bar.
function chartProblems({ figures, tambonNames, bars }) {
  if (bars.length === 0) return [`${DISTRICT}: no bars in the ตำบล chart`];
  const totals = figures.find((f) => f.column === "รวม (คน)").tambons;
  const inTable = new Map(tambonNames.map((name, i) => [name, totals[i]]));
  const charted = new Set(bars.map((bar) => bar.name));
  return [
    ...bars.flatMap(({ name, count }) =>
      mismatchProblems(`ตำบล${name}`, "the figure by its bar", count, "รวม (คน) in the table", inTable.get(name) ?? null),
    ),
    ...tambonNames.filter((name) => !charted.has(name)).map((name) => `ตำบล${name}: no bar in the ตำบล chart`),
  ];
}

// The pyramid rule: ชาย and หญิง of every ช่วงอายุ on the pyramid, plus the
// ประชากรที่ไม่แยกอายุ, are the area's ประชากรทั้งหมด in the panel.
function pyramidProblems(area, { bands, unsplit, panel }) {
  if (bands.length !== AGE_BANDS * 2) return [`${area}: the pyramid shows ${bands.length / 2} of ${AGE_BANDS} ช่วงอายุ`];
  const counted = unsplit === null || bands.includes(null) ? null : bands.reduce((a, b) => a + b) + unsplit;
  return mismatchProblems(area, "pyramid + ประชากรที่ไม่แยกอายุ", counted, "ประชากรทั้งหมด in the panel", panel);
}

// Picks a ตำบล by its name in เลือกตำบล and waits for the pyramid to name
// it, false if it never does. A pick before the page has hydrated does
// nothing, and one that fails costs only this try, so this picks until the
// pick shows; picking the ตำบล on show changes nothing.
async function pickTambon(page, name) {
  const select = page.getByLabel(PICKER, { exact: true });
  const pyramid = page.locator(`[role="group"][aria-label^="พีระมิดประชากร ตำบล${name} "]`);
  const deadline = Date.now() + PICK_TIMEOUT;
  while (Date.now() < deadline) {
    const shown = await select
      .selectOption({ label: name }, { timeout: 1000 })
      .then(() => pyramid.waitFor({ timeout: 500 }))
      .then(
        () => true,
        () => false,
      );
    if (shown) return true;
  }
  return false;
}

// The population rules of the home page (SPEC §9.2), on a wide page of its
// own: the totals rule, and the pyramid rule when the year shown has age rows.
async function checkPopulation(browser, url, hasAge) {
  const problems = [];
  let area = DISTRICT;
  // Reduced motion, so the map's move does not hold up the next pick.
  const page = await browser.newPage({ viewport: { width: POPULATION_WIDTH, height: 800 }, reducedMotion: "reduce" });
  try {
    // pageerror but not console: picking a ตำบล loads new map tiles, and each
    // tile that fails is a console error.
    page.on("pageerror", (err) => problems.push(`${area}: error: ${err.message}`));
    await blockTiles(page);
    await page.goto(url, { waitUntil: "networkidle" });
    const district = await page.evaluate(shownPopulation, PICKER);
    problems.push(...totalsProblems(district.figures), ...chartProblems(district));
    if (hasAge) {
      problems.push(...pyramidProblems(area, district));
      if (district.pickable.length === 0) problems.push(`${area}: no ตำบล to pick in ${PICKER}`);
      for (const name of district.pickable) {
        area = `ตำบล${name}`;
        if (await pickTambon(page, name)) problems.push(...pyramidProblems(area, await page.evaluate(shownPopulation, PICKER)));
        else problems.push(`${area}: the pyramid does not show it after picking it in ${PICKER}`);
      }
    }
  } finally {
    await page.close();
  }
  return problems;
}

const urlPaths = dcPages();
const shownYear = populationYearShown();
const hasAge = shownYear?.age.length > 0;
const unlinked = missingReportLinks();
const server = await serveOut();
const origin = `http://127.0.0.1:${server.address().port}`;
const problems = [];
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
  for (const urlPath of urlPaths) {
    for (const problem of await checkPage(browser, origin + urlPath)) problems.push(`${urlPath}: ${problem}`);
  }
  for (const urlPath of ["/", "/reports"]) {
    for (const problem of await overflowProblems(browser, origin + urlPath)) problems.push(`${urlPath}: ${problem}`);
  }
  for (const problem of unlinked) problems.push(`/reports: ${problem}`);
  if (shownYear) {
    for (const problem of await checkPopulation(browser, origin + "/", hasAge)) problems.push(`/: ${problem}`);
  }
} catch (err) {
  // Playwright messages end in a multi-line call log; the first line names the failure.
  fail(err.message.split("\n")[0]);
} finally {
  await browser?.close();
  server.close();
}
if (problems.length > 0) {
  problems.forEach((problem) => console.error(`dc-check: ${problem}`));
  fail(`${problems.length} problem(s) on ${urlPaths.length} page(s) checked; the rules are in CODING_STANDARDS §4–5`);
}
const populationResult = !shownYear
  ? "no population data, so no population rules"
  : hasAge
    ? "population totals, the ตำบล chart and pyramids agree"
    : "population totals and the ตำบล chart agree";
console.log(
  `dc-check: ${urlPaths.length} page(s) pass at ${WIDTH} px wide; / and /reports do not scroll sideways at ${REVIEW_WIDTHS.join(", ")} px; /reports links every report before JavaScript runs; ${populationResult}`,
);
