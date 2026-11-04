// Data Center page check (CODING_STANDARDS §4–5, FEATURES F16). After
// npm run build, opens every built page of /, /reports and /reports/[id] in
// out/ at 360 px wide and exits 1, naming the page, when a page breaks a rule
// that shows on the rendered page. The pages are opened with playwright-core
// in the installed Google Chrome, the one dependency CODING_STANDARDS §3
// allows a node script.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";

const OUT = path.resolve("out");
const WIDTH = 360;
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

const urlPaths = dcPages();
const server = await serveOut();
const origin = `http://127.0.0.1:${server.address().port}`;
const problems = [];
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
  for (const urlPath of urlPaths) {
    for (const problem of await checkPage(browser, origin + urlPath)) problems.push(`${urlPath}: ${problem}`);
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
  fail(`${problems.length} problem(s) on ${urlPaths.length} page(s) checked; the rules are in CODING_STANDARDS §4`);
}
console.log(`dc-check: ${urlPaths.length} page(s) pass at ${WIDTH} px wide`);
