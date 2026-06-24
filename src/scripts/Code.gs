/**
 * MOPH Data Sync Script
 * 1. Syncs data from MOPH API to Google Sheets
 * 2. Serve Optimized JSON for Frontend (Calculated Values)
 */

const CONFIG = {
  YEAR: "2569",
  PROVINCE: "54",
  API_URL: "https://opendata.moph.go.th/api/report_data",
  CURRENT_QUARTER: 2, // Adjust this to control how many quarters are summed (1-4)
  KPIS: [
    { table: "s_kpi_anc12", sheet: "s_kpi_anc12" },
    { table: "s_anc5", sheet: "s_anc5" },
    { table: "s_kpi_food", sheet: "s_kpi_food" },
    { table: "s_childdev_specialpp", sheet: "s_childdev_specialpp" },
    { table: "s_kpi_childdev2", sheet: "s_kpi_childdev2", isQuarterly: true },
    { table: "s_aged9", sheet: "s_aged9" },
    { table: "s_dm_screen", sheet: "s_dm_screen" },
    { table: "s_ht_screen", sheet: "s_ht_screen" },
    {
      table: "s_ncd_screen_repleate1",
      sheet: "s_ncd_screen_repleate1",
      isQuarterly: true,
    },
    {
      table: "s_ncd_screen_repleate2",
      sheet: "s_ncd_screen_repleate2",
      isQuarterly: true,
    },
    { table: "s_dental_0_5_cavity_free", sheet: "s_dental_0_5_cavity_free" },
    { table: "s_kpi_dental28", sheet: "s_kpi_dental28" },
    { table: "s_kpi_dental33", sheet: "s_kpi_dental33" },
  ],
};

/**
 * Parsing helpers for sheet cells, which may arrive as boolean (checkbox),
 * string ("TRUE"), or number (1). Used at the GAS layer so the frontend
 * receives clean typed values via meta.kpi_config.
 */
function parseBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return /^(true|yes|y|1)$/i.test(String(v || "").trim());
}

function parsePositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

// Cache TTL in seconds. Short enough that settings/kpi_master edits appear
// within a minute; long enough to dedupe Sheets API calls across concurrent
// doGet requests. Bump the cache keys below whenever the shape of the
// cached payload changes (e.g. adding a new setting field).
const SETTINGS_CACHE_KEY = "settings_v2";
const KPI_MASTER_CACHE_KEY = "kpi_master_v1";
const CONFIG_CACHE_TTL_SECONDS = 60;

/**
 * Settings schema — single source of truth for what settings exist, their
 * validation rules, and defaults. To add a new setting:
 *   1. Add an entry here with type/default (and optionally min/max/pattern).
 *   2. Add a column with the same name to the `settings` sheet (row 1 header,
 *      row 2 value). Missing column is fine — the default is used.
 * That's it — readSettings() iterates this schema automatically.
 *
 * Supported types: "int" (min/max inclusive), "string" (pattern = RegExp).
 */
const SETTINGS_SCHEMA = {
  current_quarter: {
    type: "int",
    min: 1,
    max: 4,
    default: CONFIG.CURRENT_QUARTER,
    description: "Quarter ปัจจุบัน (1-4) สำหรับ sum quarterly KPIs",
  },
  current_year: {
    type: "string",
    pattern: /^\d{4}$/,
    default: CONFIG.YEAR,
    description: "ปี พ.ศ. สำหรับ query MOPH API (เช่น 2569)",
  },
  province_code: {
    type: "string",
    pattern: /^\d{2}$/,
    default: CONFIG.PROVINCE,
    description: "รหัสจังหวัด (2 หลัก)",
  },
};

/**
 * Validate a raw cell value against a schema rule.
 * Returns { value, valid }:
 *   - valid=true:  value passed validation (possibly coerced, e.g. "3" → 3)
 *   - valid=false: value was rejected; caller should use rule.default instead
 * Empty/blank values are treated as "use default" with valid=true (not an
 * error), so users can leave a column blank intentionally.
 */
function validateSetting(raw, rule) {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { value: rule.default, valid: true };
  }
  if (rule.type === "int") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { value: rule.default, valid: false };
    const i = Math.floor(n);
    if (rule.min !== undefined && i < rule.min) return { value: rule.default, valid: false };
    if (rule.max !== undefined && i > rule.max) return { value: rule.default, valid: false };
    return { value: i, valid: true };
  }
  if (rule.type === "string") {
    const s = String(raw).trim();
    if (rule.pattern && !rule.pattern.test(s)) return { value: rule.default, valid: false };
    return { value: s, valid: true };
  }
  return { value: rule.default, valid: false };
}

/**
 * Read the `settings` tab into an object (cached for ~60s).
 *
 * Layout follows the same convention as other sheets (e.g. `kpi_master`):
 *   - Row 1: headers (each column is a setting key — must match a key in
 *     SETTINGS_SCHEMA; unknown headers are ignored)
 *   - Row 2: values (first data row holds current settings)
 *
 * Example sheet (current_year, province_code are optional — defaults apply):
 *   | current_quarter | current_year | province_code |
 *   | 3               | 2569         | 54            |
 *
 * Validation per SETTINGS_SCHEMA. Invalid values fall back to the schema
 * default and a warning is logged. To add a setting, see SETTINGS_SCHEMA.
 */
function readSettings() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get(SETTINGS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    Logger.log("readSettings: cache read failed: " + e);
  }

  // Cache miss: acquire a script lock to prevent a stampede of concurrent
  // rebuilds hammering the Sheets API. While waiting, another process may
  // have already rebuilt the cache — re-check after acquiring the lock.
  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(30000);
  } catch (e) {
    Logger.log("readSettings: tryLock error: " + e);
  }

  try {
    // Double-check: another process may have just rebuilt the cache while
    // we were waiting for the lock.
    if (hasLock) {
      try {
        const cached = cache.get(SETTINGS_CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch (e) {
        Logger.log("readSettings: cache re-read failed: " + e);
      }
    }

    // Start from schema defaults so every key always exists on the output,
    // even if the sheet is missing columns.
    const out = {};
    Object.keys(SETTINGS_SCHEMA).forEach(function (key) {
      out[key] = SETTINGS_SCHEMA[key].default;
    });

    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("settings");
      if (!sheet) return out;
      const values = sheet.getDataRange().getValues();
      if (values.length < 2) {
        Logger.log("readSettings: settings sheet has no data row");
        return out;
      }
      const headers = values[0];
      const dataRow = values[1];
      headers.forEach(function (header, i) {
        const key = String(header || "").trim();
        const rule = SETTINGS_SCHEMA[key];
        if (!rule) return; // unknown header — silently ignore
        const result = validateSetting(dataRow[i], rule);
        out[key] = result.value;
        if (!result.valid) {
          Logger.log(
            "readSettings: " + key + " has invalid value '" + dataRow[i] +
            "', using default '" + rule.default + "'",
          );
        }
      });
    } catch (err) {
      Logger.log("readSettings failed: " + err);
    }

    try {
      cache.put(SETTINGS_CACHE_KEY, JSON.stringify(out), CONFIG_CACHE_TTL_SECONDS);
    } catch (e) {
      Logger.log("readSettings: cache write failed: " + e);
    }
    return out;
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {
        Logger.log("readSettings: releaseLock error: " + e);
      }
    }
  }
}

/**
 * Read `kpi_master` into {table_name: {isQuarterly}} (cached ~60s).
 * Single source of truth for per-KPI config. Missing column/cell → null
 * (consumer falls back to CONFIG.KPIS).
 *
 * The `target_months` field was removed — the frontend now derives the target
 * period directly from `is_quarterly` + `current_quarter` so the period badge
 * and the Target column always show the same N months.
 */
function readKpiMasterConfig() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get(KPI_MASTER_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    Logger.log("readKpiMasterConfig: cache read failed: " + e);
  }

  // Cache miss: lock to prevent concurrent rebuilds (same pattern as
  // readSettings). Re-check cache after acquiring the lock.
  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(30000);
  } catch (e) {
    Logger.log("readKpiMasterConfig: tryLock error: " + e);
  }

  try {
    if (hasLock) {
      try {
        const cached = cache.get(KPI_MASTER_CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch (e) {
        Logger.log("readKpiMasterConfig: cache re-read failed: " + e);
      }
    }

    const map = {};
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("kpi_master");
      if (!sheet) return map;
      const values = sheet.getDataRange().getValues();
      if (values.length < 2) return map;
      const headers = values[0].map(function (h) {
        return String(h || "").trim().toLowerCase();
      });
      const idxTable = headers.indexOf("table_name");
      const idxQuarterly = headers.indexOf("is_quarterly");
      if (idxTable < 0) return map;
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const table = String(row[idxTable] || "").trim();
        if (!table) continue;
        map[table] = {
          isQuarterly: idxQuarterly >= 0 ? parseBool(row[idxQuarterly]) : null,
        };
      }
    } catch (err) {
      Logger.log("readKpiMasterConfig failed: " + err);
    }

    try {
      cache.put(KPI_MASTER_CACHE_KEY, JSON.stringify(map), CONFIG_CACHE_TTL_SECONDS);
    } catch (e) {
      Logger.log("readKpiMasterConfig: cache write failed: " + e);
    }
    return map;
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {
        Logger.log("readKpiMasterConfig: releaseLock error: " + e);
      }
    }
  }
}

/**
 * Invalidate cached settings/kpi_master so the next read hits the sheet.
 * Call this after editing settings or kpi_master directly (e.g. via a menu).
 */
function clearConfigCache() {
  const cache = CacheService.getScriptCache();
  try {
    cache.removeAll([SETTINGS_CACHE_KEY, KPI_MASTER_CACHE_KEY]);
    Logger.log("clearConfigCache: invalidated " + SETTINGS_CACHE_KEY + ", " + KPI_MASTER_CACHE_KEY);
  } catch (e) {
    Logger.log("clearConfigCache failed: " + e);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("PA Dashboard")
    .addItem("Sync All Data Now", "syncAllData")
    .addItem("Test API Connection", "testConnection")
    .addItem("Clear Config Cache", "clearConfigCache")
    .addToUi();
}

function syncAllData() {
  // Acquire a script lock to prevent overlapping syncs (e.g. manual run
  // colliding with the daily trigger). If another sync is running, bail
  // out gracefully instead of racing on sheet.clear()/setValues().
  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(30000);
  } catch (e) {
    Logger.log("syncAllData: tryLock error: " + e.toString());
  }
  if (!hasLock) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Another sync is already running. Try again in a minute.",
      "Sync Skipped",
    );
    return;
  }

  try {
    // Pull runtime config from the settings sheet (year, province may be
    // changed without redeploying). Falls back to CONFIG defaults on errors.
    const settings = readSettings();

    // Build all requests up front so UrlFetchApp.fetchAll can fire them in
    // parallel — much faster than sequential fetch() calls for 13 KPIs.
    const requests = CONFIG.KPIS.map(function (kpi) {
      const payload = {
        tableName: kpi.table,
        year: settings.current_year,
        province: settings.province_code,
        type: "json",
      };
      return {
        url: CONFIG.API_URL,
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      };
    });

    let responses;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch (e) {
      Logger.log("syncAllData: fetchAll failed: " + e.toString());
      logToSheet("ERROR", "Sync fetchAll failed", e.toString());
      SpreadsheetApp.getActiveSpreadsheet().toast("Sync failed: " + e.toString(), "Error");
      return;
    }

    let okCount = 0;
    responses.forEach(function (response, i) {
      const kpi = CONFIG.KPIS[i];
      const code = response.getResponseCode();
      if (code !== 200 && code !== 201) {
        Logger.log("Error: API returned status " + code + " for " + kpi.table);
        logToSheet("ERROR", "API Error " + kpi.table, "Status: " + code);
        return;
      }
      let data;
      try {
        data = JSON.parse(response.getContentText());
      } catch (parseErr) {
        Logger.log("Error: Invalid JSON for " + kpi.table);
        logToSheet("ERROR", "JSON Parse Error " + kpi.table, "Invalid JSON format");
        return;
      }
      if (saveDataToSheet(kpi.table, data, kpi.sheet)) okCount++;
    });

    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Synced " + okCount + "/" + CONFIG.KPIS.length + " KPIs",
      "Sync Completed",
    );
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      Logger.log("syncAllData: releaseLock error: " + e.toString());
    }
  }
}

function testConnection() {
  try {
    const settings = readSettings();
    const tableName = "s_kpi_anc12";
    Logger.log("Testing connection to: " + CONFIG.API_URL);

    const payload = {
      tableName: tableName,
      year: settings.current_year,
      province: settings.province_code,
      type: "json",
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(CONFIG.API_URL, options);
    Logger.log("Response Code: " + response.getResponseCode());
    Logger.log(
      "Response Body (First 500 chars): " +
        response.getContentText().substring(0, 500),
    );
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "API responded with status " + response.getResponseCode(),
      "Connection OK",
    );
  } catch (e) {
    Logger.log("testConnection failed: " + e.toString());
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Connection failed: " + e.toString(),
      "Error",
    );
  }
}

function saveDataToSheet(tableName, data, sheetName) {
  if (!Array.isArray(data)) {
    Logger.log("Error: API response is not an array for " + tableName);
    logToSheet(
      "ERROR",
      `Data Format Error ${tableName}`,
      "Response is not an array",
    );
    return false;
  }

  if (data.length === 0) {
    Logger.log(
      "Warning: API returned 0 records for " +
        tableName +
        ". Keeping old data.",
    );
    logToSheet("WARNING", `Empty Data ${tableName}`, "0 records found");
    return false;
  }

  const firstItem = data[0];
  if (
    typeof firstItem !== "object" ||
    firstItem === null ||
    Object.keys(firstItem).length === 0
  ) {
    Logger.log("Error: Invalid record format for " + tableName);
    logToSheet(
      "ERROR",
      `Record Format Error ${tableName}`,
      "First item is invalid",
    );
    return false;
  }

  const headers = Object.keys(firstItem);
  const textColumns = ["id", "hospcode", "areacode", "vhid"];

  const rowsFormatted = data.map((item) =>
    headers.map((key) => {
      const val = item[key];
      if (textColumns.includes(key)) {
        return val !== null && val !== undefined ? String(val) : "";
      }
      return val || "";
    }),
  );

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  textColumns.forEach((colName) => {
    const colIndex = headers.indexOf(colName);
    if (colIndex > -1) {
      sheet
        .getRange(2, colIndex + 1, Math.max(rowsFormatted.length, 1), 1)
        .setNumberFormat("@");
    }
  });

  if (rowsFormatted.length > 0) {
    sheet
      .getRange(2, 1, rowsFormatted.length, headers.length)
      .setValues(rowsFormatted);
  }

  // Note: previously wrote "Last Updated: <date>" at (1, headers.length + 2)
  // but that polluted the data range read by getProcessedDataForSheet()
  // (extra header column with empty values in every row). lastUpdatedMap in
  // doGet's BATCH_ALL response is the authoritative source for freshness.

  Logger.log(
    "Success: Synced " + rowsFormatted.length + " rows for " + tableName,
  );
  logToSheet("SUCCESS", `Synced ${tableName}`, `${rowsFormatted.length} rows`);
  return true;
}

/**
 * SYSTEM LOGGING
 * Logs events to 'system_logs' sheet.
 * Auto-rotates to keep only the last 500 logs.
 */
function logToSheet(type, message, details = "") {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = "system_logs";
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(["Timestamp", "Type", "Message", "Details"]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
    }

    const timestamp = new Date();
    sheet.appendRow([timestamp, type, message, details]);

    // Format Timestamp Column if new
    if (sheet.getLastRow() === 2) {
      sheet
        .getRange(2, 1, sheet.getMaxRows() - 1, 1)
        .setNumberFormat("yyyy-mm-dd hh:mm:ss");
    }

    // Auto-Cleanup (Keep last 500 rows)
    const maxLogs = 500;
    const lastRow = sheet.getLastRow();
    if (lastRow > maxLogs + 1) {
      // +1 for header
      const rowsToDelete = lastRow - (maxLogs + 1);
      if (rowsToDelete > 0) {
        // Delete from top (after header)
        sheet.deleteRows(2, rowsToDelete);
      }
    }
  } catch (e) {
    Logger.log("Failed to write log: " + e.toString());
  }
}

const MASTER_SHEETS = ["hospitals", "tambon_master", "kpi_master"];

/**
 * OPTIMIZED API Endpoint
 * Calculates KPI values on server-side and returns only minimal data.
 * SUPPORTS: Single sheet fetch OR 'BATCH_ALL' for everything.
 *
 * Security: only MASTER_SHEETS, BATCH_ALL, and sheets listed in CONFIG.KPIS
 * are readable. Any other `sheet` value is rejected so internal sheets
 * (settings, system_logs, …) cannot be exposed via the public endpoint.
 */
function doGet(e) {
  const sheetName = e.parameter.sheet;

  // 0. Safety Check
  if (!sheetName) return createJsonError('Missing "sheet" parameter');

  // 1. Handle Master Sheets (Pass-through) first — avoids unnecessary Sheets
  // service reads for these requests (best practice: minimize service calls).
  if (MASTER_SHEETS.includes(sheetName)) {
    return serveRawSheet(sheetName);
  }

  // 2. Whitelist remaining names: BATCH_ALL or a known KPI sheet.
  //    Prevents leaking settings/system_logs/other internal sheets.
  const isBatch = sheetName === "BATCH_ALL";
  if (!isBatch) {
    const knownKpiSheet = CONFIG.KPIS.some((k) => k.sheet === sheetName);
    if (!knownKpiSheet) {
      return createJsonError("Unknown or forbidden sheet: " + sheetName);
    }
  }

  // Resolve config from sheets only when data processing is needed
  // (BATCH_ALL or a single data sheet). Falls back to CONFIG defaults.
  const settings = readSettings();
  const kpiCfg = readKpiMasterConfig();

  // Reuse a single SpreadsheetApp instance for every sheet read below.
  // This avoids 13 redundant getActiveSpreadsheet() calls in BATCH_ALL.
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 3. BATCH MODE (Turbo)
  if (isBatch) {
    const result = {};
    const lastUpdatedMap = {};

    CONFIG.KPIS.forEach((kpi) => {
      const rows = getProcessedDataForSheet(ss, kpi.sheet, settings.current_quarter, kpiCfg);
      result[kpi.table] = rows;

      // Extract date_com from the first available row as the "Last Updated" for this KPI
      lastUpdatedMap[kpi.table] = null;
      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].date_com) {
            lastUpdatedMap[kpi.table] = rows[i].date_com;
            break;
          }
        }
      }
    });

    // Merge CONFIG.KPIS with sheet overrides so every KPI is represented and
    // the frontend gets clean {table, sheet, isQuarterly} values.
    // Including `sheet` here lets the sync page avoid duplicating CONFIG.KPIS.
    // The frontend derives target_months from isQuarterly + current_quarter
    // (annual=12, quarterly=currentQuarter×3) so it's not emitted here.
    const kpiConfigOut = CONFIG.KPIS.map((kpi) => {
      const sheetCfg = kpiCfg[kpi.table] || {};
      const isQuarterly =
        sheetCfg.isQuarterly === null || sheetCfg.isQuarterly === undefined
          ? !!kpi.isQuarterly
          : sheetCfg.isQuarterly === true;
      return {
        table: kpi.table,
        sheet: kpi.sheet,
        isQuarterly: isQuarterly,
      };
    });

    // Wrap with Metadata. Exposing current_year/province_code means the
    // frontend sync page can pull them from BATCH_ALL instead of hardcoding.
    const response = {
      data: result,
      meta: {
        current_quarter: settings.current_quarter,
        current_year: settings.current_year,
        province_code: settings.province_code,
        kpi_config: kpiConfigOut,
        lastUpdatedMap: lastUpdatedMap,
      },
    };
    return createJsonOutput(response);
  }

  // 4. Single Sheet Mode (Backward Compatible)
  const rows = getProcessedDataForSheet(ss, sheetName, settings.current_quarter, kpiCfg);
  return createJsonOutput(rows);
}

// Helper: Get Processed Data for a single sheet.
// `ss` is passed in so callers can reuse one SpreadsheetApp instance across
// many reads (BATCH_ALL) — minimizing service calls per GAS best practice.
function getProcessedDataForSheet(ss, sheetName, currentQuarter, kpiCfg) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];

  const headers = data[0];
  const rows = data.slice(1);

  // LOGIC PROCESSOR
  return rows.map((row) => {
    const item = {};
    headers.forEach((h, i) => {
      const key = h ? h.toString() : "col_" + i;
      item[key] = row[i];
    });

    const values = calculateKPIOnServer(item, sheetName, currentQuarter, kpiCfg);

    return {
      hospcode: item["hospcode"] || "",
      areacode: item["areacode"] || "",
      date_com: item["date_com"] || "",
      b_year: item["b_year"] || "",
      target: values.t,
      result: values.r,
    };
  });
}

// Helper: Serve raw sheet for master data
function serveRawSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return createJsonOutput([]);

  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return createJsonOutput([]);

  const headers = data[0];
  const rows = data.slice(1);
  const json = rows.map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
  return createJsonOutput(json);
}

/**
 * POST endpoint — used by the frontend Sync page (src/app/sync/page.tsx)
 * to push MOPH data into Google Sheets. The browser calls this with
 * Content-Type: text/plain to keep it a CORS "simple request" (GAS Web
 * Apps do not handle OPTIONS preflight).
 *
 * Expected body: { action: "save_kpi_data", tableName, sheetName?, data: [] }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonError("Missing request body");
    }
    const json = JSON.parse(e.postData.contents);
    if (json.action !== "save_kpi_data") {
      return createJsonError("Unknown action: " + json.action);
    }

    const tableName = String(json.tableName || "").trim();
    const data = json.data;

    // Whitelist tableName against CONFIG.KPIS so an attacker (or buggy
    // client) cannot write to arbitrary sheets like settings/system_logs.
    const kpi = CONFIG.KPIS.find((k) => k.table === tableName);
    if (!kpi) {
      logToSheet("ERROR", "doPost rejected unknown table", tableName);
      return createJsonError("Unknown table: " + tableName);
    }
    // sheetName is always derived from CONFIG — caller cannot override.
    // This guarantees a tableName can only write to its own sheet.
    const sheetName = kpi.sheet;

    // Serialize writes with a script lock so two concurrent syncs cannot
    // race on sheet.clear()/setValues() (same reason syncAllData locks).
    const lock = LockService.getScriptLock();
    let hasLock = false;
    try {
      hasLock = lock.tryLock(30000);
    } catch (lockErr) {
      Logger.log("doPost: tryLock error: " + lockErr.toString());
    }
    if (!hasLock) {
      return createJsonError("Server busy — another sync is running. Try again shortly.");
    }

    try {
      const success = saveDataToSheet(tableName, data, sheetName);
      if (success) {
        return createJsonOutput({
          status: "success",
          count: Array.isArray(data) ? data.length : 0,
        });
      }
      return createJsonError("Failed to save data. Check system_logs for details.");
    } finally {
      try {
        lock.releaseLock();
      } catch (releaseErr) {
        Logger.log("doPost: releaseLock error: " + releaseErr.toString());
      }
    }
  } catch (e) {
    logToSheet("ERROR", "doPost Critical", e.toString());
    return createJsonError(e.toString());
  }
}

// Helper: Create JSON Output
function createJsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function createJsonError(msg) {
  return createJsonOutput({ status: "error", message: msg });
}

/**
 * CORE LOGIC ENGINE (Moved from Frontend)
 */
function calculateKPIOnServer(item, tableName, currentQuarter, kpiCfg) {
  let t = 0;
  let r = 0;

  // 1. Dental A/B Pattern (Target=B, Result=A)
  if (tableName === "s_dental_0_5_cavity_free") {
    t = Number(item["b"] || 0);
    r = Number(item["a"] || 0);
    return { t: t, r: r };
  }
  // 2. Child Development Special PP (Sum by Age Groups: 9, 18, 30, 42, 60 months)
  if (tableName === "s_childdev_specialpp") {
    const ageGroups = [9, 18, 30, 42, 60];
    ageGroups.forEach((age) => {
      t += Number(item[`target_${age}`] || 0);
      r += Number(item[`result_${age}`] || 0);
    });
    return { t: t, r: r };
  }

  // 3. Aged 9 (No Quarter Sum)
  if (tableName === "s_aged9") {
    t = Number(item["target"] || 0);
    r = Number(item["result"] || 0);
    return { t: t, r: r };
  }

  // 4. Standard Logic (Auto Quarter Sum)
  // Try main target first
  const tMain = Number(item["target"] || 0);
  const rMain = Number(item["result"] || 0);

  // Resolve isQuarterly: prefer the kpi_master sheet value, fall back to CONFIG.KPIS.
  const sheetCfg = kpiCfg ? kpiCfg[tableName] : null;
  let forceQuarterly;
  if (sheetCfg && sheetCfg.isQuarterly !== null && sheetCfg.isQuarterly !== undefined) {
    forceQuarterly = sheetCfg.isQuarterly === true;
  } else {
    const kpiConfig = CONFIG.KPIS.find((k) => k.table === tableName);
    forceQuarterly = kpiConfig ? !!kpiConfig.isQuarterly : false;
  }

  if (tMain > 0 && !forceQuarterly) {
    // Annual target exists and KPI is not quarterly:
    // Prefer the annual result; fall back to quarter sum only when annual is missing/zero.
    t = tMain;
    r = rMain > 0 ? rMain : getQuarterSum(item, "result", currentQuarter);
  } else {
    // Sum quarters (If Force Quarterly OR No Annual Target)
    t = getQuarterSum(item, "target", currentQuarter);
    r = getQuarterSum(item, "result", currentQuarter);
  }

  return { t: t, r: r };
}

function getQuarterSum(item, prefix, currentQuarter) {
  let sum = 0;
  // Use the resolved quarter (from settings sheet) to limit the sum.
  const q = currentQuarter || CONFIG.CURRENT_QUARTER;
  for (let i = 1; i <= q; i++) {
    // Supported column naming patterns observed in MOPH data:
    //   target1, target2, target3, target4   (most common)
    //   targetq1, targetq2, targetq3, targetq4
    const v1 = item[prefix + i];
    const v2 = item[prefix + "q" + i];
    sum += Number(v1 || v2 || 0);
  }
  return sum;
}

function createDailyTrigger() {
  const triggerName = "syncAllData";

  // Idempotency: skip if a trigger for this handler already exists.
  const existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === triggerName;
  });
  if (existing.length > 0) {
    Logger.log(
      "createDailyTrigger: " + existing.length + " trigger(s) for '" +
      triggerName + "' already exist. Skipping.",
    );
    return;
  }

  ScriptApp.newTrigger(triggerName)
    .timeBased()
    .everyDays(1)
    .atHour(14)
    .create();
  Logger.log("createDailyTrigger: daily trigger for '" + triggerName + "' created.");
}
