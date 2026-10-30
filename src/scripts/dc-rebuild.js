/**
 * Data Center: rebuild (SCHEMA §3.7, SPEC §6.3). Asks Cloudflare Pages to
 * build the site again through the Deploy Hook in settings.deploy_hook_url.
 *
 * Shares the Apps Script global scope with รหัส.js (CONFIG, readSettings).
 * Read those only inside functions, never at top level: file load order
 * is not guaranteed.
 */

// POST rebuild has no authentication (ADR-0005), so a daily cap keeps anyone
// from spending the Cloudflare build quota (500 a month, SPEC §6.3).
const DC_REBUILD_DAILY_LIMIT = 5;
// Script property per day: rebuild_count_{YYYY-MM-DD}, Asia/Bangkok day.
const DC_REBUILD_COUNT_PREFIX = "rebuild_count_";

/**
 * POST rebuild, syncAllData and the "Rebuild Website" menu: call the
 * Deploy Hook, at most DC_REBUILD_DAILY_LIMIT times a day.
 *
 * The caller must hold the script lock (doPost / syncAllData /
 * rebuildWebsiteMenu): the lock is what stops two requests from both passing
 * at 4/5. This function never calls LockService (SCHEMA §3). settings
 * defaults to readSettings(); syncAllData passes the one it read before
 * taking the lock, since it outlives the 60 s settings cache.
 *
 * Returns { status: "success", remaining_today } or { status: "error", message }.
 */
function requestRebuild(reason, settings) {
  const hook = (settings || readSettings()).deploy_hook_url;
  if (!hook) {
    Logger.log("requestRebuild: deploy_hook_url is empty, rebuild is off");
    return { status: "error", message: "Deploy hook not configured" };
  }

  const props = PropertiesService.getScriptProperties();
  const todayKey = DC_REBUILD_COUNT_PREFIX + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  props.getKeys().forEach(function (key) {
    if (key.indexOf(DC_REBUILD_COUNT_PREFIX) === 0 && key !== todayKey) props.deleteProperty(key);
  });
  const count = Number(props.getProperty(todayKey)) || 0;
  if (count >= DC_REBUILD_DAILY_LIMIT) {
    return {
      status: "error",
      message: "Rebuild quota exceeded for today (" + DC_REBUILD_DAILY_LIMIT + "/" + DC_REBUILD_DAILY_LIMIT + ")",
    };
  }

  let code;
  try {
    code = UrlFetchApp.fetch(hook, { method: "post", muteHttpExceptions: true }).getResponseCode();
  } catch (e) {
    // The error text can contain the hook URL, which starts a build without
    // this quota, so it goes only to Logger.log, never the response or
    // system_logs (readable through diag).
    Logger.log("requestRebuild: fetch failed: " + e);
    logToSheet("ERROR", "Rebuild failed", "Deploy hook request failed");
    return { status: "error", message: "Deploy hook request failed" };
  }
  if (code < 200 || code >= 300) {
    logToSheet("ERROR", "Rebuild failed", "Deploy hook returned status " + code);
    return { status: "error", message: "Deploy hook returned status " + code };
  }
  props.setProperty(todayKey, String(count + 1));
  logToSheet("INFO", "Rebuild requested (" + String(reason || "") + ")");
  return { status: "success", remaining_today: DC_REBUILD_DAILY_LIMIT - count - 1 };
}

/**
 * Menu "Rebuild Website" (onOpen), for after editing hdc_reports: requestRebuild
 * under the script lock, the result shown as a toast. No arguments: a menu
 * item calls its function by name with nothing useful to pass.
 */
function rebuildWebsiteMenu() {
  // readSettings takes and releases the lock itself on a cache miss. Fill the
  // cache before taking the lock below, so it does not release this
  // function's lock early (SCHEMA §3, same as doPost).
  readSettings();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(30000);
  } catch (e) {
    Logger.log("rebuildWebsiteMenu: tryLock error: " + e);
  }
  if (!hasLock) {
    ss.toast("Another sync is running. Try again in a minute.", "Rebuild Website");
    return;
  }

  try {
    const res = requestRebuild("menu");
    ss.toast(
      res.status === "success" ? "Rebuild requested. " + res.remaining_today + " left today." : res.message,
      "Rebuild Website",
    );
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      Logger.log("rebuildWebsiteMenu: releaseLock error: " + e);
    }
  }
}
