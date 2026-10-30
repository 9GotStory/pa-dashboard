import assert from "node:assert/strict";
import test from "node:test";
import { loadGas } from "./gas-harness.js";

// FEATURES F07 / SCHEMA §3.7.
const HOOK = "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/5b1f0c2e-9a7d-4e1b";

function settings(deployHookUrl) {
  return [
    ["current_quarter", "current_year", "province_code", "district_code", "deploy_hook_url"],
    [4, 2569, 54, 5406, deployHookUrl],
  ];
}

// s_x is a sync unit through a kpi_master source_sheet, as in storage.test.js.
const KPI_MASTER = [
  ["table_name", "source_sheet"],
  ["s_x_kpi", "s_x"],
];

function load({ hook = HOOK, fetch = () => ({ code: 200, body: { success: true } }) } = {}) {
  return loadGas({ sheets: { settings: settings(hook), kpi_master: KPI_MASTER }, fetch });
}

function post(h, body) {
  return JSON.parse(h.gas.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}

test("deploy_hook_url empty → error Deploy hook not configured, the hook is not called", () => {
  const h = load({ hook: "" });

  const res = post(h, { action: "rebuild", reason: "test" });

  assert.deepEqual(res, { status: "error", message: "Deploy hook not configured" });
  assert.equal(h.fetches.length, 0);
});

test("5 rebuilds in one day succeed (remaining_today 4 → 0); the 6th → Rebuild quota exceeded, the hook is not called", () => {
  const h = load();
  h.clock.now = Date.parse("2026-10-30T10:00:00+07:00");

  const five = Array.from({ length: 5 }, () => post(h, { action: "rebuild", reason: "test" }));
  const sixth = post(h, { action: "rebuild", reason: "test" });

  assert.deepEqual(five, [4, 3, 2, 1, 0].map((n) => ({ status: "success", remaining_today: n })));
  assert.deepEqual(sixth, { status: "error", message: "Rebuild quota exceeded for today (5/5)" });
  assert.equal(h.fetches.length, 5);
  assert.ok(h.fetches.every((f) => f.url === HOOK && f.method === "post"));
});

test("the next day (from midnight Asia/Bangkok) the count starts again and the previous day's key is deleted", () => {
  const h = load();
  h.clock.now = Date.parse("2026-10-30T10:00:00+07:00");
  for (let i = 0; i < 5; i++) post(h, { action: "rebuild", reason: "test" });

  // Still 30 Oct in UTC, already 31 Oct 00:30 in Bangkok.
  h.clock.now = Date.parse("2026-10-30T17:30:00Z");
  const res = post(h, { action: "rebuild", reason: "test" });

  assert.deepEqual(res, { status: "success", remaining_today: 4 });
  assert.deepEqual([...h.properties.keys()], ["rebuild_count_2026-10-31"]);
});

test("hook answers 500 → error with the status, not counted against the quota", () => {
  let code = 500;
  const h = load({ fetch: () => ({ code, body: { success: false } }) });

  const failed = post(h, { action: "rebuild", reason: "test" });
  code = 200;
  const next = post(h, { action: "rebuild", reason: "test" });

  assert.equal(failed.status, "error");
  assert.match(failed.message, /\b500\b/);
  assert.deepEqual(next, { status: "success", remaining_today: 4 });
});

// The hook URL starts a build by itself (no quota), and system_logs is
// readable through diag, so it must not appear in the response or the log.
test("hook request throws (no connection) → error without the hook URL in the response or system_logs, not counted", () => {
  let fail = true;
  const h = load({
    fetch: (url) => {
      if (fail) throw new Error("Address unavailable: " + url);
      return { code: 200, body: { success: true } };
    },
  });

  const failed = post(h, { action: "rebuild", reason: "test" });
  fail = false;
  const next = post(h, { action: "rebuild", reason: "test" });

  assert.equal(failed.status, "error");
  assert.ok(!failed.message.includes(HOOK), failed.message);
  assert.ok(!JSON.stringify(h.sheet("system_logs")).includes(HOOK));
  assert.deepEqual(next, { status: "success", remaining_today: 4 });
});

test("a successful rebuild logs INFO Rebuild requested ({reason}) to system_logs", () => {
  const h = load();

  post(h, { action: "rebuild", reason: "sync page" });

  const logged = h.sheet("system_logs").slice(1).map((row) => [row[1], row[2]]);
  assert.deepEqual(logged, [["INFO", "Rebuild requested (sync page)"]]);
});

// readSettings/readKpiMasterConfig (PA code, not changed) take the lock
// themselves on a cache miss (SCHEMA §3). Warm both caches first so the
// counters only see the lock taken by the code under test.
function warmCachesAndResetLock(h) {
  h.gas.readSettings();
  h.gas.readKpiMasterConfig();
  h.lock.tryLock = 0;
  h.lock.releaseLock = 0;
}

test("POST rebuild takes the script lock once and releases it; requestRebuild alone never calls tryLock", () => {
  const h = load();
  warmCachesAndResetLock(h);

  assert.equal(post(h, { action: "rebuild", reason: "test" }).status, "success");
  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });

  assert.equal(h.gas.requestRebuild("test").status, "success");
  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

// MOPH and the hook behind one UrlFetchApp: s_x answers with sxRows, every
// other sync unit with an empty envelope (not saved).
function syncFetch(sxRows) {
  return (url, payload) => {
    if (url === HOOK) return { code: 200, body: { success: true } };
    const rows = payload.tableName === "s_x" ? sxRows : [];
    return { code: 201, body: { data: rows, total: String(rows.length) } };
  };
}

const SX_ROWS = ["54060101", "54060201", "54010101"].map((areacode) => ({
  hospcode: "10678",
  areacode,
  date_com: "202610300930",
  b_year: "2569",
  target: 10,
  result: 8,
}));

test("syncAllData that saved a table → one rebuild at the end, logged as Rebuild requested (daily sync), under its one lock", () => {
  const h = load({ fetch: syncFetch(SX_ROWS) });
  warmCachesAndResetLock(h);

  h.gas.syncAllData();

  assert.equal(h.fetches.filter((f) => f.url === HOOK).length, 1);
  assert.equal(h.fetches.at(-1).url, HOOK);
  const logged = h.sheet("system_logs").slice(1).map((row) => [row[1], row[2]]);
  assert.deepEqual(logged.at(-1), ["INFO", "Rebuild requested (daily sync)"]);
  assert.deepEqual({ ...h.lock }, { tryLock: 1, releaseLock: 1, nested: 0 });
});

test("syncAllData that saved no table → the hook is not called", () => {
  const h = load({ fetch: syncFetch([]) });

  h.gas.syncAllData();

  assert.equal(h.fetches.filter((f) => f.url === HOOK).length, 0);
  assert.ok(h.fetches.length > 0, "expected MOPH fetches");
});

// The function onOpen binds to the "Rebuild Website" menu item, called the
// way Apps Script calls a menu function: by name, without arguments.
function rebuildMenuItem(h) {
  h.gas.onOpen();
  const item = h.menus.flatMap((menu) => menu.items).find((i) => i.caption === "Rebuild Website");
  assert.ok(item, "onOpen has no Rebuild Website item");
  assert.equal(typeof h.gas[item.functionName], "function", item.functionName + " is not a function");
  return () => h.gas[item.functionName]();
}

test("menu Rebuild Website with cold caches: one rebuild, the lock never nested and released, remaining shown in a toast", () => {
  const h = load();
  const runMenu = rebuildMenuItem(h);

  runMenu();

  assert.equal(h.fetches.length, 1);
  assert.equal(h.lock.nested, 0);
  assert.equal(h.lock.releaseLock, h.lock.tryLock);
  assert.match(h.toasts.at(-1).message, /\b4\b/);
});

test("menu Rebuild Website when it fails → the error message in a toast", () => {
  const h = load({ hook: "" });
  const runMenu = rebuildMenuItem(h);

  runMenu();

  assert.equal(h.fetches.length, 0);
  assert.match(h.toasts.at(-1).message, /Deploy hook not configured/);
});
