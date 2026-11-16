// PA regression check around a GAS deploy or a production write: PA must
// show the same numbers before and after (docs/agents/gas-deploy.md).
//
//   snapshot <name>  save BATCH_ALL and the PA page (default tab and EPI tab:
//                    every KPI cell's aria-label, the <main> text, a
//                    full-page screenshot) under .pa-check/<name>/
//   compare <a> <b>  exit 0 when PA is unchanged from snapshot a to b
//
// Env (.env.local): NEXT_PUBLIC_GAS_SCRIPT_URL (BATCH_ALL) and PA_URL (the PA
// page). The page is opened with playwright-core in the installed Google
// Chrome, the one dependency CODING_STANDARDS §3 allows a node script.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const DIR = ".pa-check";
const TABS = { main: "", epi: "?cat=" + encodeURIComponent("สร้างเสริมภูมิคุ้มกันโรค") };
// One per KPI cell: a KPI's target/result at one hospital.
const CELL = '[aria-label^="รายละเอียด"]';

function fail(message) {
  console.error(`pa-check: ${message}`);
  process.exit(1);
}

async function capturePage(paUrl) {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const tabs = {};
    for (const [tab, query] of Object.entries(TABS)) {
      const url = paUrl + query;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const cells = page.locator(CELL);
      await cells
        .first()
        .waitFor({ timeout: 180000 })
        .catch(() => {
          throw new Error(
            `no KPI cell on ${url} within 3 min: check that it opens in Chrome and GAS answers BATCH_ALL, then rerun`,
          );
        });
      // Cells appear once BATCH_ALL is in; let the rest of the render finish.
      await page.waitForTimeout(2000);
      const labels = await cells.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
      const text = await page.locator("main").innerText();
      const png = await page.screenshot({ fullPage: true });
      tabs[tab] = { url, labels, text, png };
    }
    return tabs;
  } finally {
    await browser.close();
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
  const counts = Object.entries(page)
    .map(([tab, p]) => `${tab} ${p.labels.length} cells`)
    .join(", ");
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
const rowSet = (rows) =>
  rows
    .map((row) =>
      JSON.stringify(
        Object.keys(row)
          .sort()
          .map((k) => [k, row[k]]),
      ),
    )
    .sort();
const sameRows = (x, y) => JSON.stringify(rowSet(x)) === JSON.stringify(rowSet(y));
// A daily sync gives every row a newer date_com from MOPH, values or not.
const withoutDateCom = (rows) => rows.map((row) => ({ ...row, date_com: undefined }));
const maxDateCom = (rows) =>
  rows.reduce((max, row) => (String(row.date_com ?? "") > max ? String(row.date_com) : max), "");
const indexes = (n) => Array.from({ length: n }, (_, i) => i);
// PA's line with the newest date_com (src/app/pa/page.tsx).
const DATE_LINE = /^อัปเดตล่าสุด/;

// The lines compare prints and the count of differences, from two snapshots
// as load() reads them; 0 differences means PA shows the same.
export function compareSnapshots(before, after) {
  const lines = [];
  let changed = 0;

  // A BATCH_ALL key is also unchanged when "after" holds the "before" rows
  // narrowed the way saveTableYear stores them: to the district (the areacode
  // prefixes left in "after") and the current year; and, across a daily sync,
  // when only date_com moved.
  const year = String(after.batch.meta.current_year);
  const keys = [...new Set([...Object.keys(before.batch.data), ...Object.keys(after.batch.data)])];
  let identical = 0;
  let dateComMoved = false;
  for (const key of keys) {
    const x = before.batch.data[key] || [];
    const y = after.batch.data[key] || [];
    if (JSON.stringify(x) === JSON.stringify(y)) {
      identical++;
      continue;
    }
    const districts = new Set(y.map((row) => String(row.areacode).slice(0, 4)));
    const narrowed = x.filter((row) => districts.has(String(row.areacode).slice(0, 4)) && String(row.b_year) === year);
    const rows = `data ${key}: ${x.length} → ${y.length} rows`;
    const narrowing = `narrowed to ${[...districts].join(",")} / ${year}`;
    const dates = `date_com ${maxDateCom(x)} → ${maxDateCom(y)}`;
    if (maxDateCom(x) !== maxDateCom(y)) dateComMoved = true;
    if (y.length > 0 && sameRows(narrowed, y)) {
      lines.push(`${rows}, the same rows ${narrowing}`);
    } else if (y.length > 0 && sameRows(withoutDateCom(narrowed), withoutDateCom(y))) {
      lines.push(`${rows}, the same rows ${narrowing} apart from max ${dates}`);
    } else {
      changed++;
      lines.push(`${rows}, CHANGED; max ${dates}`);
    }
  }
  lines.push(`data: ${identical}/${keys.length} keys identical`);

  for (const tab of Object.keys(TABS)) {
    const x = before.page[tab];
    const y = after.page[tab];
    const cellDiffs = indexes(Math.max(x.labels.length, y.labels.length)).filter((i) => x.labels[i] !== y.labels[i]);
    const xs = x.text.split("\n");
    const ys = y.text.split("\n");
    const lineDiffs = indexes(Math.max(xs.length, ys.length)).filter((i) => xs[i] !== ys[i]);
    // The อัปเดตล่าสุด line follows date_com, so it moves with a sync.
    const judged = lineDiffs.filter((i) => !(dateComMoved && DATE_LINE.test(xs[i]) && DATE_LINE.test(ys[i])));
    lines.push(
      `page ${tab}: ${x.labels.length} → ${y.labels.length} cells, ${cellDiffs.length} differ; ${lineDiffs.length} text lines differ`,
    );
    cellDiffs.slice(0, 5).forEach((i) => lines.push(`  cell ${x.labels[i]} → ${y.labels[i]}`));
    lineDiffs
      .slice(0, 5)
      .forEach((i) =>
        lines.push(`  line ${i + 1}: ${xs[i]} → ${ys[i]}${judged.includes(i) ? "" : " (date_com moved, not judged)"}`),
      );
    if (cellDiffs.length > 0 || judged.length > 0) changed++;
  }

  for (const key of new Set([...Object.keys(before.batch.meta), ...Object.keys(after.batch.meta)])) {
    const x = JSON.stringify(before.batch.meta[key]);
    const y = JSON.stringify(after.batch.meta[key]);
    if (x !== y) lines.push(`meta ${key}: ${String(x).slice(0, 100)} → ${String(y).slice(0, 100)} (shown, not judged)`);
  }
  return { lines, changed };
}

function compare(a, b) {
  const { lines, changed } = compareSnapshots(load(a), load(b));
  lines.forEach((line) => console.log(line));
  if (changed > 0) {
    fail(
      `${changed} difference(s). A newer max date_com means MOPH sent new data; the same date_com means the code changed what PA gets.`,
    );
  }
  console.log("pa-check: PA unchanged");
}

const checkName = (name) =>
  /^[\w.-]+$/.test(name) ? name : fail(`snapshot name "${name}": letters, digits, . _ - only`);
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === "snapshot" && args.length === 1) await snapshot(checkName(args[0]));
    else if (command === "compare" && args.length === 2) compare(checkName(args[0]), checkName(args[1]));
    else fail("usage: pa-check.mjs snapshot <name> | compare <before> <after>");
  } catch (err) {
    // Playwright messages end in a multi-line call log; the first line names the failure.
    fail(err.message.split("\n")[0]);
  }
}
