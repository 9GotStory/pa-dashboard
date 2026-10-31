import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { loadGas, startGas } from "./gas-harness.js";

// FEATURES F09: sync-moph-to-gas.js run as a child process, the way the admin
// runs it. GAS is a local HTTP server that hands each request to the real
// doGet/doPost in the harness, MOPH a local stub of report_data
// (CODING_STANDARDS §5).

const SCRIPT = path.resolve(import.meta.dirname, "../sync-moph-to-gas.js");

// One table's report_data rows for a year: 3 in อำเภอ 5406, 2 in 5401.
function mophRows(year, dateCom = "202610290900") {
  return [
    ["10953", "54060101"],
    ["10954", "54060203"],
    ["10955", "54060805"],
    ["10668", "54010101"],
    ["10669", "54010302"],
  ].map(([hospcode, areacode]) => ({ hospcode, areacode, date_com: dateCom, b_year: year, target: 10, result: 8 }));
}

// A report_data reply the way MOPH sends it: the rows in an envelope whose
// total is a string (SCHEMA §5.3).
function envelope(rows, total = rows.length) {
  return { data: rows, total: String(total), limit: 5000, offset: 0 };
}

// MOPH report_data on a local port, closed when the test ends. answer(body)
// is the reply to one request, { status, body }; status defaults to 201, what
// MOPH answers (SCHEMA §5). requests: every request body, parsed, in order.
async function startMoph(t, answer) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push(body);
    const { status = 201, body: reply } = answer(body);
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(reply));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}/api/report_data`, requests };
}

const HOOK = "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/5b1f0c2e-9a7d-4e1b";

// GAS and MOPH for one test. PA-Data has only settings, so BATCH_ALL lists the
// PA units of CONFIG.KPIS (s_kpi_dental33 among them) and the window
// 2565–2569. answer: MOPH's reply to each request. hook: settings.deploy_hook_url,
// a Deploy Hook that answers 200.
async function start(t, answer, { hook = "" } = {}) {
  const h = loadGas({
    sheets: {
      settings: [
        ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
        [4, 2569, 54, 5406, hook],
      ],
    },
    fetch: () => ({ code: 200, body: { success: true } }),
  });
  return { h, gas: await startGas(t, h), moph: await startMoph(t, answer) };
}

// Run the script against the local GAS and MOPH only: both URLs are always
// set, so its fallback to the production GAS URL is never used, and
// SYNC_WAIT_SCALE=0 skips its pauses. None of the caller's own env.
function run({ gas, moph }, args) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      { env: { NEXT_PUBLIC_GAS_SCRIPT_URL: gas.url, MOPH_URL: moph.url, SYNC_WAIT_SCALE: "0" } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
}

// sync_status as [table, b_year, sheet, row_count] rows.
function syncStatus(h) {
  const [header, ...rows] = h.sheet("sync_status");
  return rows.map((row) => ["table", "b_year", "sheet", "row_count"].map((name) => row[header.indexOf(name)]));
}

// The last line the script printed.
function lastLine(stdout) {
  return stdout.trimEnd().split("\n").at(-1);
}

test("no --year → the current year: MOPH asked for 2569 with limit 5000, the district rows saved, the log shows fetched/total and received/count", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year)) }));

  const res = await run(env, ["--only", "s_kpi_dental33", "--no-rebuild"]);

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(env.moph.requests, [
    { tableName: "s_kpi_dental33", year: "2569", province: "54", type: "json", limit: 5000 },
  ]);
  assert.deepEqual(syncStatus(env.h), [["s_kpi_dental33", "2569", "s_kpi_dental33", 3]]);
  assert.match(res.stdout, /✓ s_kpi_dental33 2569 → s_kpi_dental33: fetched 5 of total 5, received 5, count 3\n/);
  assert.deepEqual(
    env.gas.posts.map((p) => p.action),
    ["save_kpi_data"],
  );
});

test("--year 2567 --year 2568 → MOPH asked for each year, each saved to its _y sheet with a sync_status row; the current-year sheet untouched", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year)) }));

  const res = await run(env, ["--year", "2567", "--year", "2568", "--only", "s_kpi_dental33", "--no-rebuild"]);

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(
    env.moph.requests.map((r) => r.year),
    ["2567", "2568"],
  );
  assert.deepEqual(syncStatus(env.h), [
    ["s_kpi_dental33", "2567", "s_kpi_dental33_y2567", 3],
    ["s_kpi_dental33", "2568", "s_kpi_dental33_y2568", 3],
  ]);
  assert.equal(env.h.sheet("s_kpi_dental33"), null);
});

test("--backfill → every year of the window, oldest first: 2565–2568 to their _y sheets, 2569 to the current-year sheet", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year)) }));

  const res = await run(env, ["--backfill", "--only", "s_kpi_dental33", "--no-rebuild"]);

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(
    env.moph.requests.map((r) => r.year),
    ["2565", "2566", "2567", "2568", "2569"],
  );
  assert.deepEqual(
    syncStatus(env.h).map(([, year, sheet]) => [year, sheet]),
    [
      ["2565", "s_kpi_dental33_y2565"],
      ["2566", "s_kpi_dental33_y2566"],
      ["2567", "s_kpi_dental33_y2567"],
      ["2568", "s_kpi_dental33_y2568"],
      ["2569", "s_kpi_dental33"],
    ],
  );
});

test("--year 2564 (outside the window 2565–2569) → exit 1 before any MOPH request, naming the window", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year)) }));

  const res = await run(env, ["--year", "2564", "--only", "s_kpi_dental33", "--no-rebuild"]);

  assert.equal(res.code, 1);
  assert.match(res.stderr, /outside the window 2565–2569: 2564/);
  assert.deepEqual(env.moph.requests, []);
});

test("--backfill with --year → exit 1 before any MOPH request", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year)) }));

  const res = await run(env, ["--backfill", "--year", "2568", "--only", "s_kpi_dental33", "--no-rebuild"]);

  assert.equal(res.code, 1);
  assert.match(res.stderr, /--backfill/);
  assert.deepEqual(env.moph.requests, []);
});

test("MOPH sends fewer rows than total → that table stops with a message and is not sent to GAS, the other table is saved, exit 1", async (t) => {
  const env = await start(t, (body) => ({
    body: envelope(mophRows(body.year), body.tableName === "s_kpi_dental33" ? 9 : 5),
  }));

  const res = await run(env, ["--only", "s_kpi_dental28", "--only", "s_kpi_dental33", "--no-rebuild"]);

  assert.equal(res.code, 1);
  assert.match(res.stderr, /✗ s_kpi_dental33 2569: MOPH sent 5 of total 9 rows/);
  assert.deepEqual(
    env.gas.posts.map((p) => p.tableName),
    ["s_kpi_dental28"],
  );
  assert.deepEqual(syncStatus(env.h), [["s_kpi_dental28", "2569", "s_kpi_dental28", 3]]);
});

test("MOPH answers 429, then 503 → retried, saved on the third try", async (t) => {
  const replies = [{ status: 429, body: { message: "Too Many Requests" } }, { status: 503, body: {} }];
  const env = await start(t, (body) => replies.shift() ?? { body: envelope(mophRows(body.year)) });

  const res = await run(env, ["--only", "s_kpi_dental33", "--no-rebuild"]);

  assert.equal(res.code, 0, res.stderr);
  assert.equal(env.moph.requests.length, 3);
  assert.deepEqual(syncStatus(env.h), [["s_kpi_dental33", "2569", "s_kpi_dental33", 3]]);
});

test("MOPH data older than what GAS has → Stale data, not saved, exit 1; again with --force → saved", async (t) => {
  let dateCom = "202610301200";
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year, dateCom)) }));
  const args = ["--only", "s_kpi_dental33", "--no-rebuild"];
  assert.equal((await run(env, args)).code, 0);
  dateCom = "202610290900";

  const stale = await run(env, args);
  const forced = await run(env, [...args, "--force"]);

  assert.equal(stale.code, 1);
  assert.match(stale.stderr, /✗ s_kpi_dental33 2569: Stale data: existing 202610301200 > incoming 202610290900/);
  assert.equal(forced.code, 0, forced.stderr);
  const [header, ...rows] = env.h.sheet("s_kpi_dental33");
  assert.deepEqual(
    rows.map((row) => row[header.indexOf("date_com")]),
    ["202610290900", "202610290900", "202610290900"],
  );
});

test("a table saved, no --no-rebuild → one POST rebuild after the saves; the last line says it was requested and how many are left today", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year)) }), { hook: HOOK });

  const res = await run(env, ["--only", "s_kpi_dental33"]);

  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(
    env.gas.posts.map((p) => p.action),
    ["save_kpi_data", "rebuild"],
  );
  assert.equal(lastLine(res.stdout), "Rebuild requested, 4 left today");
});

test("today's 5 rebuilds already used → the last line says the quota is reached, and the sync still exits 0", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year)) }), { hook: HOOK });
  // Five rebuilds earlier today, from the spreadsheet menu or another run.
  for (let i = 0; i < 5; i++) {
    env.h.gas.doPost({ postData: { contents: JSON.stringify({ action: "rebuild", reason: "earlier" }) } });
  }

  const res = await run(env, ["--only", "s_kpi_dental33"]);

  assert.equal(res.code, 0, res.stderr);
  assert.equal(lastLine(res.stdout), "Rebuild not requested: Rebuild quota exceeded for today (5/5)");
});

test("deploy_hook_url empty → the last line says the Deploy Hook is not configured", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year)) }));

  const res = await run(env, ["--only", "s_kpi_dental33"]);

  assert.equal(res.code, 0, res.stderr);
  assert.equal(lastLine(res.stdout), "Rebuild not requested: Deploy hook not configured");
});

test("no table saved (MOPH answers 500 every time) → no POST rebuild", async (t) => {
  const env = await start(t, () => ({ status: 500, body: {} }), { hook: HOOK });

  const res = await run(env, ["--only", "s_kpi_dental33"]);

  assert.equal(res.code, 1);
  assert.deepEqual(env.gas.posts, []);
});

test("a mistyped flag (--no-rebiuld) → exit 1 with the usage, before reading BATCH_ALL or asking MOPH", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(mophRows(body.year)) }));

  const res = await run(env, ["--only", "s_kpi_dental33", "--no-rebiuld"]);

  assert.equal(res.code, 1);
  assert.match(res.stderr, /--no-rebiuld[\s\S]*usage: node src\/scripts\/sync-moph-to-gas\.js/);
  assert.deepEqual(env.moph.requests, []);
  assert.deepEqual(env.gas.posts, []);
});

test("MOPH replies with a bare array (no total, SCHEMA §5.3) → saved, and the log says there was no total to check", async (t) => {
  const env = await start(t, (body) => ({ body: mophRows(body.year) }));

  const res = await run(env, ["--only", "s_kpi_dental33", "--no-rebuild"]);

  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /✓ s_kpi_dental33 2569 → s_kpi_dental33: fetched 5 \(MOPH sent no total\), received 5, count 3\n/);
});

test("--backfill where HDC has no 2565 rows → 2565 is no data, not a failure: the other years saved, exit 0", async (t) => {
  const env = await start(t, (body) => ({ body: envelope(body.year === "2565" ? [] : mophRows(body.year)) }));

  const res = await run(env, ["--backfill", "--only", "s_kpi_dental33", "--no-rebuild"]);

  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /– s_kpi_dental33 2565: no data in HDC\n/);
  assert.match(res.stdout, /Done\. Success: 4, No data: 1, Failed: 0\n/);
  assert.deepEqual(
    syncStatus(env.h).map(([, year]) => year),
    ["2566", "2567", "2568", "2569"],
  );
});
