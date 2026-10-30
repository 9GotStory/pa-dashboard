// PA regression check around a GAS deploy or a production write: PA must
// show the same numbers before and after (docs/agents/gas-deploy.md).
//
//   snapshot <name>  save BATCH_ALL and the PA page (default tab and EPI tab:
//                    every KPI cell's aria-label, the <main> text, a
//                    full-page screenshot) under .pa-check/<name>/
//   compare <a> <b>  exit 0 when PA is unchanged from snapshot a to b
//
// Env (.env.local): NEXT_PUBLIC_GAS_SCRIPT_URL (BATCH_ALL) and PA_URL (the PA
// page). The page is read through the DevTools Protocol of the installed
// Chrome (CHROME_PATH, default google-chrome), so no dependency is needed
// (CODING_STANDARDS §3).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = ".pa-check";
const TABS = { main: "", epi: "?cat=" + encodeURIComponent("สร้างเสริมภูมิคุ้มกันโรค") };
// One per KPI cell: a KPI's target/result at one hospital.
const CELL = '[aria-label^="รายละเอียด"]';

function fail(message) {
  console.error(`pa-check: ${message}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A DevTools Protocol client over Node's built-in WebSocket.
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let nextId = 0;
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      const call = pending.get(msg.id);
      if (!call) return;
      pending.delete(msg.id);
      if (msg.error) call.reject(new Error(`${call.method}: ${msg.error.message}`));
      else call.resolve(msg.result);
    });
    ws.addEventListener("error", () => reject(new Error("cannot connect to Chrome's DevTools")));
    ws.addEventListener("open", () =>
      resolve({
        send(method, params = {}, sessionId) {
          const id = ++nextId;
          ws.send(JSON.stringify({ id, method, params, sessionId }));
          return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej, method }));
        },
        close: () => ws.close(),
      }),
    );
  });
}

async function launchChrome(userDir) {
  const args = [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${userDir}`,
    "--no-first-run", "--no-default-browser-check", "about:blank",
  ];
  const chrome = spawn(process.env.CHROME_PATH || "google-chrome", args, { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = "";
    chrome.stderr.on("data", (chunk) => {
      stderr += chunk;
      const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    chrome.on("error", (err) => reject(new Error(`cannot start Chrome (${err.code}); set CHROME_PATH`)));
    chrome.on("exit", (code) => reject(new Error(`Chrome exited with ${code}: ${stderr.slice(-300)}`)));
  });
  return { chrome, wsUrl };
}

async function capturePage(paUrl) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-check-"));
  let chrome;
  try {
    const launched = await launchChrome(userDir);
    chrome = launched.chrome;
    const cdp = await connect(launched.wsUrl);
    const tabs = {};
    for (const [tab, query] of Object.entries(TABS)) {
      const url = paUrl + query;
      // A new target per tab, so the previous page's cells cannot end the wait.
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      const page = (method, params) => cdp.send(method, params, sessionId);
      const evaluate = async (expression) => {
        const { result, exceptionDetails } = await page("Runtime.evaluate", { expression, returnByValue: true });
        if (exceptionDetails) throw new Error(exceptionDetails.text);
        return result.value;
      };
      await page("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await page("Page.navigate", { url });
      const cells = `document.querySelectorAll(${JSON.stringify(CELL)})`;
      const deadline = Date.now() + 180000;
      while (!(await evaluate(`${cells}.length > 0`).catch(() => false))) {
        if (Date.now() > deadline) throw new Error(`no KPI cell on ${url} after 180 s`);
        await sleep(500);
      }
      await sleep(2000);
      const labels = await evaluate(`[...${cells}].map((e) => e.getAttribute("aria-label"))`);
      const text = await evaluate(`document.querySelector("main").innerText`);
      const { cssContentSize } = await page("Page.getLayoutMetrics");
      const { data } = await page("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
      });
      tabs[tab] = { url, labels, text, png: Buffer.from(data, "base64") };
      await cdp.send("Target.closeTarget", { targetId });
    }
    cdp.close();
    return tabs;
  } finally {
    if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
      const exited = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill();
      await exited;
    }
    fs.rmSync(userDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

async function snapshot(name) {
  const gasUrl = process.env.NEXT_PUBLIC_GAS_SCRIPT_URL;
  const paUrl = process.env.PA_URL;
  if (!gasUrl || !paUrl) fail("set NEXT_PUBLIC_GAS_SCRIPT_URL and PA_URL in .env.local (docs/agents/gas-deploy.md)");
  // The request PA's page makes (src/lib/useKPIData.ts).
  const res = await fetch(`${gasUrl}?sheet=BATCH_ALL`);
  const batch = await res.json().catch(() => null);
  if (!batch?.data || !batch?.meta) fail(`BATCH_ALL answered HTTP ${res.status} without data and meta`);
  const tabs = await capturePage(paUrl);

  // Written only once everything is in hand, so no snapshot is half done.
  const out = path.join(DIR, name);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "batch-all.json"), JSON.stringify(batch));
  const page = {};
  for (const [tab, { png, ...rest }] of Object.entries(tabs)) {
    fs.writeFileSync(path.join(out, `${tab}.png`), png);
    page[tab] = rest;
  }
  fs.writeFileSync(path.join(out, "page.json"), JSON.stringify(page, null, 2));
  const counts = Object.entries(page).map(([tab, p]) => `${tab} ${p.labels.length} cells`).join(", ");
  console.log(`pa-check: saved ${out} (${counts}, BATCH_ALL ${Object.keys(batch.data).length} keys)`);
}

function load(name) {
  const dir = path.join(DIR, name);
  if (!fs.existsSync(path.join(dir, "page.json"))) fail(`no snapshot ${dir}; run npm run pa:snapshot -- ${name}`);
  return {
    batch: JSON.parse(fs.readFileSync(path.join(dir, "batch-all.json"), "utf8")),
    page: JSON.parse(fs.readFileSync(path.join(dir, "page.json"), "utf8")),
  };
}

// Rows as sorted key-sorted JSON, so row and key order do not matter.
const rowSet = (rows) => rows.map((row) => JSON.stringify(Object.keys(row).sort().map((k) => [k, row[k]]))).sort();
const sameRows = (x, y) => JSON.stringify(rowSet(x)) === JSON.stringify(rowSet(y));
const maxDateCom = (rows) => rows.reduce((max, row) => (String(row.date_com ?? "") > max ? String(row.date_com) : max), "");
const indexes = (n) => Array.from({ length: n }, (_, i) => i);

function compare(a, b) {
  const before = load(a);
  const after = load(b);
  let changed = 0;

  for (const tab of Object.keys(TABS)) {
    const x = before.page[tab];
    const y = after.page[tab];
    const cellDiffs = indexes(Math.max(x.labels.length, y.labels.length)).filter((i) => x.labels[i] !== y.labels[i]);
    const xs = x.text.split("\n");
    const ys = y.text.split("\n");
    const lineDiffs = indexes(Math.max(xs.length, ys.length)).filter((i) => xs[i] !== ys[i]);
    console.log(`page ${tab}: ${x.labels.length} → ${y.labels.length} cells, ${cellDiffs.length} differ; ${lineDiffs.length} text lines differ`);
    cellDiffs.slice(0, 5).forEach((i) => console.log(`  cell ${x.labels[i]} → ${y.labels[i]}`));
    lineDiffs.slice(0, 5).forEach((i) => console.log(`  line ${i + 1}: ${xs[i]} → ${ys[i]}`));
    if (cellDiffs.length > 0 || lineDiffs.length > 0) changed++;
  }

  // A BATCH_ALL key is also unchanged when "after" holds the "before" rows
  // narrowed the way saveTableYear stores them: to the district (the areacode
  // prefixes left in "after") and the current year.
  const year = String(after.batch.meta.current_year);
  const keys = [...new Set([...Object.keys(before.batch.data), ...Object.keys(after.batch.data)])];
  let identical = 0;
  for (const key of keys) {
    const x = before.batch.data[key] || [];
    const y = after.batch.data[key] || [];
    if (JSON.stringify(x) === JSON.stringify(y)) {
      identical++;
      continue;
    }
    const districts = new Set(y.map((row) => String(row.areacode).slice(0, 4)));
    const narrowed = x.filter((row) => districts.has(String(row.areacode).slice(0, 4)) && String(row.b_year) === year);
    if (y.length > 0 && sameRows(narrowed, y)) {
      console.log(`data ${key}: ${x.length} → ${y.length} rows, the same rows narrowed to ${[...districts].join(",")} / ${year}`);
    } else {
      changed++;
      console.log(`data ${key}: ${x.length} → ${y.length} rows, CHANGED; max date_com ${maxDateCom(x)} → ${maxDateCom(y)}`);
    }
  }
  console.log(`data: ${identical}/${keys.length} keys identical`);
  for (const key of new Set([...Object.keys(before.batch.meta), ...Object.keys(after.batch.meta)])) {
    const x = JSON.stringify(before.batch.meta[key]);
    const y = JSON.stringify(after.batch.meta[key]);
    if (x !== y) console.log(`meta ${key}: ${String(x).slice(0, 100)} → ${String(y).slice(0, 100)} (shown, not judged)`);
  }

  if (changed > 0) {
    fail(`${changed} difference(s). A newer max date_com means MOPH sent new data; the same date_com means the code changed what PA gets.`);
  }
  console.log("pa-check: PA unchanged");
}

const checkName = (name) => (/^[\w.-]+$/.test(name) ? name : fail(`snapshot name "${name}": letters, digits, . _ - only`));
const [command, ...args] = process.argv.slice(2);
try {
  if (command === "snapshot" && args.length === 1) await snapshot(checkName(args[0]));
  else if (command === "compare" && args.length === 2) compare(checkName(args[0]), checkName(args[1]));
  else fail("usage: pa-check.mjs snapshot <name> | compare <before> <after>");
} catch (err) {
  fail(err.message);
}
