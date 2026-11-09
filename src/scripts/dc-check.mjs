// Data Center page check (CODING_STANDARDS §4–5, FEATURES F16). After
// npm run build, opens every built page of /, /reports and /reports/[id] in
// out/ at 360 px wide and exits 1, naming the page, when a page breaks a rule
// that shows on the rendered page. The home page is opened wide as well, and
// the check exits 1, naming the area, when its population figures disagree
// (SPEC §9.2). The pages are opened with playwright-core in the installed
// Google Chrome, the one dependency CODING_STANDARDS §3 allows a node script.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";

const OUT = path.resolve("out");
const WIDTH = 360;
// Wide enough for the ประชากรรายตำบล table and its ดูข้อมูล buttons: at 360 px
// the table is hidden and the buttons are in closed cards (SPEC §9.2).
const POPULATION_WIDTH = 1280;
// The อำเภอ as the panel and the pyramid name it before any ตำบล is picked.
const DISTRICT = "ภาพรวมอำเภอสอง";
// The ช่วงอายุ of a pyramid (SCHEMA §11.3).
const AGE_BANDS = 17;
// How long a ตำบล's ดูข้อมูล may take to show on the pyramid, in ms. The first
// click may land before the page has hydrated.
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
    if (svg.getAttribute("role") !== "img" || !svg.getAttribute("aria-label")?.trim()) {
      found.push(`svg without aria-hidden="true" or role="img" + aria-label: ${snippet(svg)}`);
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

// What the population rules compare, as the home page shows it (SPEC §9.2): a
// figure the page does not have is null, a list it does not have is empty.
// Runs inside the page, so it uses nothing from this module.
function shownPopulation() {
  const count = (text) => {
    const digits = text?.trim().match(/^[\d,]+/)?.[0];
    return digits ? Number(digits.replaceAll(",", "")) : null;
  };
  const listed = (scope, label) =>
    count([...document.querySelectorAll(`${scope} dt`)].find((dt) => dt.textContent.trim() === label)?.nextElementSibling?.textContent);
  const table = [...document.querySelectorAll("table")].find((t) => t.caption?.textContent.includes("ประชากรรายตำบล"));
  const columns = [...(table?.tHead?.rows[0]?.cells ?? [])].map((cell) => cell.textContent.trim());
  const tambons = [...(table?.tBodies[0]?.rows ?? [])];
  const districtRow = [...(table?.tFoot?.rows ?? [])].find((row) => row.textContent.includes("รวมทั้งอำเภอ"));
  const pyramid = document.querySelector('svg[role="img"][aria-label^="พีระมิดประชากร "]');
  return {
    figures: [["ประชากรทั้งหมด", "รวม (คน)"], ["ประชากรชาย", "ชาย (คน)"], ["ประชากรหญิง", "หญิง (คน)"]].map(([label, column]) => {
      const at = columns.indexOf(column);
      return {
        label,
        column,
        summary: listed('section[aria-label="สรุปประชากรและการปกครอง"]', label),
        district: count(districtRow?.cells[at]?.textContent),
        tambons: tambons.map((row) => count(row.cells[at]?.textContent)),
      };
    }),
    pickable: tambons.filter((row) => row.querySelector("button")).map((row) => row.querySelector("th").textContent.trim()),
    panel: listed('aside[aria-labelledby="area-title"]', "ประชากรทั้งหมด"),
    bands: [...(pyramid?.getAttribute("aria-label") ?? "").matchAll(/ชาย ([\d,]+) หญิง ([\d,]+)/g)].flatMap((m) => [count(m[1]), count(m[2])]),
    unsplit: count(pyramid?.closest("section")?.textContent.match(/ไม่รวมประชากรที่ไม่แยกอายุ ([\d,]+) คน/)?.[1]),
  };
}

// [] when the two figures are the same number, else the problem, naming area.
function differ(area, nameA, a, nameB, b) {
  if (a !== null && a === b) return [];
  const shown = (n) => (n === null ? "not on the page" : n.toLocaleString("en-US"));
  return [`${area}: ${nameA} ${shown(a)} ≠ ${nameB} ${shown(b)}`];
}

// Rule ก: the summary, the รวมทั้งอำเภอ row and the sum of the ตำบล rows.
function totalsProblems(figures) {
  return figures.flatMap(({ label, column, summary, district, tambons }) => {
    const sum = tambons.length > 0 && !tambons.includes(null) ? tambons.reduce((a, b) => a + b) : null;
    return [
      ...differ(DISTRICT, `summary ${label}`, summary, `รวมทั้งอำเภอ ${column}`, district),
      ...differ(DISTRICT, `รวมทั้งอำเภอ ${column}`, district, `sum of the ตำบล rows ${column}`, sum),
    ];
  });
}

// Rule ข: ชาย and หญิง of every ช่วงอายุ on the pyramid, plus the
// ประชากรที่ไม่แยกอายุ, are the area's ประชากรทั้งหมด in the panel.
function pyramidProblems(area, { bands, unsplit, panel }) {
  if (bands.length !== AGE_BANDS * 2) return [`${area}: the pyramid shows ${bands.length / 2} of ${AGE_BANDS} ช่วงอายุ`];
  const counted = unsplit === null ? null : bands.reduce((a, b) => a + b) + unsplit;
  return differ(area, "pyramid + ประชากรที่ไม่แยกอายุ", counted, "ประชากรทั้งหมด in the panel", panel);
}

// Picks a ตำบล with its ดูข้อมูล button and waits for the pyramid to name it,
// false if it never does. A click before the page has hydrated does nothing,
// so this clicks until the pick shows; picking the ตำบล on show changes nothing.
async function pickTambon(page, area) {
  const button = page.getByRole("button", { name: `ดูข้อมูล ${area}`, exact: true });
  const pyramid = page.locator(`svg[role="img"][aria-label^="พีระมิดประชากร ${area} "]`);
  const deadline = Date.now() + PICK_TIMEOUT;
  while (Date.now() < deadline) {
    await button.click();
    if (await pyramid.waitFor({ timeout: 500 }).then(() => true, () => false)) return true;
  }
  return false;
}

// The population rules of the home page (SPEC §9.2), on a wide page of its
// own: rule ก, and rule ข when the year shown has age rows.
async function checkPopulation(browser, url, hasAge) {
  const problems = [];
  let area = DISTRICT;
  // Reduced motion, so a scroll or the map's move does not hold up the next click.
  const page = await browser.newPage({ viewport: { width: POPULATION_WIDTH, height: 800 }, reducedMotion: "reduce" });
  try {
    // pageerror but not console: picking a ตำบล loads new map tiles, and each
    // tile that fails is a console error. Aborted, so these rules never depend
    // on the tile server.
    page.on("pageerror", (err) => problems.push(`${area}: error: ${err.message}`));
    await page.route(
      (u) => u.hostname === "tile.openstreetmap.org",
      (route) => route.abort(),
    );
    await page.goto(url, { waitUntil: "networkidle" });
    const district = await page.evaluate(shownPopulation);
    problems.push(...totalsProblems(district.figures));
    if (hasAge) {
      problems.push(...pyramidProblems(area, district));
      if (district.pickable.length === 0) problems.push(`${area}: no ดูข้อมูล button in the ตำบล table`);
      for (const name of district.pickable) {
        area = `ตำบล${name}`;
        if (await pickTambon(page, area)) problems.push(...pyramidProblems(area, await page.evaluate(shownPopulation)));
        else problems.push(`${area}: the pyramid does not show it after its ดูข้อมูล button`);
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
const server = await serveOut();
const origin = `http://127.0.0.1:${server.address().port}`;
const problems = [];
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
  for (const urlPath of urlPaths) {
    for (const problem of await checkPage(browser, origin + urlPath)) problems.push(`${urlPath}: ${problem}`);
  }
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
const population = !shownYear ? "no population data, so no population rules" : hasAge ? "population rules ก and ข pass" : "population rule ก passes";
console.log(`dc-check: ${urlPaths.length} page(s) pass at ${WIDTH} px wide; ${population}`);
