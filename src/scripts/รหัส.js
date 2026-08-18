/**
 * MOPH Data Sync Script
 * 1. Syncs data from MOPH API to Google Sheets
 * 2. Serve Optimized JSON for Frontend (Calculated Values)
 */

const CONFIG = {
  YEAR: "2569",
  PROVINCE: "54",
  API_URL: "https://opendata.moph.go.th/api/report_data",
  // PIN for the ?action=diag diagnostic endpoint. Change this to something
  // of your own — it guards trigger info + MOPH probes + system_logs reads.
  DIAG_PIN: "diag-5406-2026",
  CURRENT_QUARTER: 2, // Adjust this to control how many quarters are summed (1-4)
  KPIS: [
    { table: "s_kpi_anc12", sheet: "s_kpi_anc12" },
    { table: "s_anc5", sheet: "s_anc5" },
    { table: "s_kpi_food", sheet: "s_kpi_food" },
    { table: "s_kpi_childdev4", sheet: "s_kpi_childdev4", isQuarterly: true },
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
      table: "s_ht_screen_follow",
      sheet: "s_ht_screen_follow",
      isQuarterly: true,
    },
    { table: "s_dental_0_5_cavity_free", sheet: "s_dental_0_5_cavity_free" },
    { table: "s_kpi_dental28", sheet: "s_kpi_dental28" },
    { table: "s_kpi_dental33", sheet: "s_kpi_dental33" },
    // EPI (สร้างเสริมภูมิคุ้มกันโรค). s_epi1 (1 ปี) is NOT here — it is
    // discovered from kpi_master `source_sheet` via getSyncUnits(), proving
    // the config-only path for future tables. These four are in CONFIG only
    // because s_epi_complete needs `limit`.
    // `limit`: MOPH silently truncates responses at 1000 rows; s_epi_complete
    // has ~2.4k rows for a province, so request a higher page size.
    { table: "s_epi2", sheet: "s_epi2" },
    { table: "s_epi3", sheet: "s_epi3" },
    { table: "s_epi5", sheet: "s_epi5" },
    { table: "s_epi_complete", sheet: "s_epi_complete", limit: 5000 },
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
// Bumped v3 → v4: registry now merges TWO sheets (kpi_master + kpi_epi).
const KPI_MASTER_CACHE_KEY = "kpi_master_v4";
// Manifest of registry tabs (kpi_registry sheet). v1.
const KPI_REGISTRY_CACHE_KEY = "kpi_registry_v1";
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
 * Read `kpi_master` into {table_name: {isQuarterly, targetMonths, effectiveQuarter}}
 * (cached ~60s). Single source of truth for per-KPI config. Missing column/cell
 * → null (consumer falls back to CONFIG.KPIS / global settings).
 *
 * Fields:
 *   - is_quarterly       (bool):  force quarterly sum for this KPI
 *   - target_months      (1-12):  overrides the DISPLAY period ("สะสม N เดือน"
 *                                 badge + Target column). null → derive from
 *                                 is_quarterly + current_quarter.
 *   - effective_quarter  (1-4):   overrides how many quarters are SUMMED for
 *                                 this KPI (independent of target_months, since
 *                                 MOPH stores quarterly columns — the real sum
 *                                 is always N×3 months). null → use the global
 *                                 current_quarter from `settings`.
 *
 * Why target_months and effective_quarter are separate: some KPIs (e.g.
 * s_kpi_childdev4, s_kpi_childdev2) have a service window like
 * Oct–May (8 months) but the data only comes in quarter columns, so the real
 * sum is 9 months (Q1+Q2+Q3) while the reported period is "8 เดือน".
 */
/**
 * Manifest of KPI registry tabs — the single place that enumerates "one tab
 * per category" (kpi_master, kpi_epi, future groups). Read from the
 * `kpi_registry` sheet (columns: sheet_name, category, category_order).
 * Falls back to the built-in default pair when the sheet is missing, so the
 * system keeps working before the manifest is seeded. Adding a future group
 * = create its tab (copy the kpi_epi pattern) + one manifest row — no code.
 */
function readRegistry() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get(KPI_REGISTRY_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    Logger.log("readRegistry: cache read failed: " + e);
  }

  const fallback = [
    { sheet: "kpi_master", category: "ตัวชี้วัดพื้นฐาน", categoryOrder: 1 },
    { sheet: "kpi_epi", category: "สร้างเสริมภูมิคุ้มกันโรค", categoryOrder: 2 },
  ];

  let out = null;
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("kpi_registry");
    if (sheet) {
      const values = sheet.getDataRange().getValues();
      if (values.length >= 2) {
        const headers = values[0].map(function (h) {
          return String(h || "").trim().toLowerCase();
        });
        const idxSheet = headers.indexOf("sheet_name");
        const idxCategory = headers.indexOf("category");
        const idxOrder = headers.indexOf("category_order");
        if (idxSheet >= 0 && idxCategory >= 0) {
          const seen = {};
          const rows = [];
          for (let i = 1; i < values.length; i++) {
            const name = sanitizeToken(values[i][idxSheet]);
            const category = String(values[i][idxCategory] || "").trim();
            if (!name || !category || seen[name]) continue;
            seen[name] = true;
            const orderRule = { type: "int", min: 1, max: 99, default: 99 };
            rows.push({
              sheet: name,
              category: category,
              categoryOrder: idxOrder >= 0
                ? validateSetting(values[i][idxOrder], orderRule).value
                : 99,
            });
          }
          if (rows.length > 0) out = rows;
        }
      }
    }
  } catch (err) {
    Logger.log("readRegistry failed: " + err);
  }

  if (!out) out = fallback;
  try {
    cache.put(KPI_REGISTRY_CACHE_KEY, JSON.stringify(out), CONFIG_CACHE_TTL_SECONDS);
  } catch (e) {
    Logger.log("readRegistry: cache write failed: " + e);
  }
  return out;
}

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
      // Registry spans the tabs listed in kpi_registry (readRegistry):
      // kpi_master (ตัวชี้วัดพื้นฐาน), kpi_epi (สร้างเสริมภูมิคุ้มกันโรค), and
      // future group tabs. Reduced column sets are fine — the parser
      // tolerates missing columns. A table_name present in TWO tabs is a
      // config error: keep the first occurrence and log a warning.
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      readRegistry().forEach(function (entry) {
        const sheetName = entry.sheet;
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return;
        const values = sheet.getDataRange().getValues();
        if (values.length < 2) return;
        const headers = values[0].map(function (h) {
          return String(h || "").trim().toLowerCase();
        });
        const idxTable = headers.indexOf("table_name");
        const idxQuarterly = headers.indexOf("is_quarterly");
        const idxTargetMonths = headers.indexOf("target_months");
        const idxEffQuarter = headers.indexOf("effective_quarter");
        const idxSourceSheet = headers.indexOf("source_sheet");
        const idxValuePrefix = headers.indexOf("value_prefix");
        const idxSourceId = headers.indexOf("source_id");
        if (idxTable < 0) return;
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          const table = String(row[idxTable] || "").trim();
          if (!table) continue;
          if (map[table]) {
            Logger.log(
              "readKpiMasterConfig: duplicate table_name '" + table +
                "' in " + sheetName + " (already defined) — skipping",
            );
            continue;
          }
          // Reuse validateSetting (the same helper used for the `settings`
          // sheet) so int-range validation is uniform across both config
          // sources. Missing column or out-of-range → null (fall back to default).
          const tmRule = { type: "int", min: 1, max: 12, default: null };
          const eqRule = { type: "int", min: 1, max: 4, default: null };
          map[table] = {
            isQuarterly: idxQuarterly >= 0 ? parseBool(row[idxQuarterly]) : null,
            targetMonths:
              idxTargetMonths >= 0
                ? validateSetting(row[idxTargetMonths], tmRule).value
                : null,
            effectiveQuarter:
              idxEffQuarter >= 0
                ? validateSetting(row[idxEffQuarter], eqRule).value
                : null,
            // Virtual KPI wiring (EPI). source_sheet = raw MOPH sheet to read;
            // value_prefix = vaccine column prefix (e.g. "dtp4" → dtp4_01..12);
            // source_id = row `id` filter (s_epi_complete packs 4 age cohorts
            // in one table, distinguished by the HDC report GUID).
            sourceSheet: idxSourceSheet >= 0 ? sanitizeToken(row[idxSourceSheet]) : null,
            valuePrefix: idxValuePrefix >= 0 ? sanitizeToken(row[idxValuePrefix]) : null,
            sourceId: idxSourceId >= 0 ? sanitizeGuid(row[idxSourceId]) : null,
          };
        }
      });
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
    cache.removeAll([SETTINGS_CACHE_KEY, KPI_MASTER_CACHE_KEY, KPI_REGISTRY_CACHE_KEY]);
    Logger.log(
      "clearConfigCache: invalidated " + SETTINGS_CACHE_KEY + ", " +
        KPI_MASTER_CACHE_KEY + ", " + KPI_REGISTRY_CACHE_KEY,
    );
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

/**
 * Trim + validate a sheet/table/token identifier from kpi_master. Returns
 * null for anything unexpected so a typo in the sheet degrades to "feature
 * off" instead of writing/fetching an arbitrary name.
 */
function sanitizeToken(v) {
  const s = String(v || "").trim();
  return /^[a-z0-9_]+$/i.test(s) ? s : null;
}

/** Same, for HDC report GUIDs (hex, 32 chars). */
function sanitizeGuid(v) {
  const s = String(v || "").trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(s) ? s : null;
}

/**
 * Sync units = CONFIG.KPIS ∪ source_sheet values from kpi_master. This is
 * the single source of truth for: what syncAllData fetches, what doGet
 * serves, what doPost accepts, and what meta.kpi_config advertises. Adding
 * a brand-new MOPH table later (e.g. กลุ่มอายุอื่น) is therefore a
 * kpi_master-row-only change — no redeploy.
 */
function getSyncUnits(kpiCfg) {
  const units = CONFIG.KPIS.map(function (k) {
    return {
      table: k.table,
      sheet: k.sheet,
      isQuarterly: !!k.isQuarterly,
      limit: k.limit || null,
    };
  });
  const seen = {};
  units.forEach(function (u) {
    seen[u.table] = true;
  });
  Object.keys(kpiCfg || {}).forEach(function (table) {
    const src = kpiCfg[table].sourceSheet;
    if (!src || seen[src]) return;
    seen[src] = true;
    units.push({ table: src, sheet: src, isQuarterly: false, limit: null });
  });
  return units;
}

/**
 * Virtual KPIs derived from kpi_master: one output KPI per row that has a
 * source_sheet plus a selector — value_prefix (per-vaccine columns, e.g.
 * dtp4 → dtp4_01..dtp4_12) or source_id (row filter by HDC report GUID,
 * s_epi_complete's 4 age cohorts). Returns [] until the sheet is edited.
 */
function getVirtualKpis(kpiCfg) {
  const out = [];
  Object.keys(kpiCfg || {}).forEach(function (table) {
    const cfg = kpiCfg[table];
    if (!cfg.sourceSheet) return;
    if (cfg.valuePrefix) {
      out.push({
        table: table,
        sourceSheet: cfg.sourceSheet,
        valuePrefix: cfg.valuePrefix,
        sourceId: null,
      });
    } else if (cfg.sourceId) {
      out.push({
        table: table,
        sourceSheet: cfg.sourceSheet,
        valuePrefix: null,
        sourceId: cfg.sourceId,
      });
    }
  });
  return out;
}

/**
 * Sum a birth-month column family across all 12 months. MOPH uses two
 * verified naming patterns: targets have no underscore (target01..target12)
 * while vaccine results do (dtp4_01..dtp4_12) — accept both, like
 * getQuarterSum tolerates the quarter column variants.
 */
function getAnnualSum(item, prefix) {
  let sum = 0;
  for (let m = 1; m <= 12; m++) {
    const mm = m < 10 ? "0" + m : String(m);
    sum += Number(item[prefix + mm] || item[prefix + "_" + mm] || 0);
  }
  return sum;
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
    // Log it too — a toast alone is invisible unless someone is watching
    // the spreadsheet, which hid skipped syncs in the past.
    logToSheet("WARNING", "Sync skipped", "Another sync holds the lock");
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
    // Sync units = CONFIG.KPIS ∪ kpi_master source_sheet values, so tables
    // registered only in the sheet (e.g. s_epi1) sync without a redeploy.
    const units = getSyncUnits(readKpiMasterConfig());

    // Fetch SEQUENTIALLY with spacing — NOT UrlFetchApp.fetchAll. MOPH's
    // rate limiter returns 429 when all 13 requests arrive as one burst
    // (system_logs shows whole KPI batches failing with "Status: 429" on
    // burst days). A 1.5–2.5s randomized gap per KPI plus per-request
    // retry/backoff keeps every table green; total runtime stays ~1–2 min,
    // far under the 6-minute trigger quota.
    let okCount = 0;
    units.forEach(function (kpi) {
      const data = fetchMophForKpi(kpi, settings);
      if (data !== null && saveDataToSheet(kpi.table, data, kpi.sheet, kpi.limit)) okCount++;
      Utilities.sleep(1500 + Math.floor(Math.random() * 1000));
    });

    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Synced " + okCount + "/" + units.length + " KPIs",
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

/**
 * Fetch one KPI from the MOPH API with retry/backoff on 429/5xx.
 * Returns the parsed JSON (array or envelope — saveDataToSheet unwraps),
 * or null after logging the failure. Called sequentially by syncAllData.
 */
function fetchMophForKpi(kpi, settings) {
  // `limit` is only sent when the unit declares one: MOPH silently truncates
  // at 1000 rows, and only large tables (s_epi_complete, ~2.4k rows) need it.
  // Tables without it keep a byte-identical payload to before this existed.
  const payload = {
    tableName: kpi.table,
    year: settings.current_year,
    province: settings.province_code,
    type: "json",
  };
  if (kpi.limit && Number(kpi.limit) > 0) {
    payload.limit = Number(kpi.limit);
  }
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true,
  };

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response;
    try {
      response = UrlFetchApp.fetch(CONFIG.API_URL, options);
    } catch (err) {
      Logger.log("Error: fetch threw for " + kpi.table + ": " + err.toString());
      logToSheet("ERROR", "Fetch Error " + kpi.table, String(err));
      return null;
    }

    const code = response.getResponseCode();
    if (code === 200 || code === 201) {
      try {
        return JSON.parse(response.getContentText());
      } catch (parseErr) {
        Logger.log("Error: Invalid JSON for " + kpi.table);
        logToSheet("ERROR", "JSON Parse Error " + kpi.table, "Invalid JSON format");
        return null;
      }
    }

    // 429 (rate limit) / 5xx — back off and retry before giving up.
    if (attempt < maxAttempts) {
      Logger.log("Retrying " + kpi.table + " (status " + code + ", attempt " + attempt + ")");
      Utilities.sleep(5000 * attempt);
      continue;
    }
    Logger.log("Error: API returned status " + code + " for " + kpi.table);
    logToSheet("ERROR", "API Error " + kpi.table, "Status: " + code);
    return null;
  }
  return null;
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

    // Parse and report the effective row count so shape regressions (e.g.
    // the envelope change from a bare array to {"data": [...]}) are visible
    // at a glance from the execution log.
    try {
      const json = JSON.parse(response.getContentText());
      const rows = Array.isArray(json) ? json : json && json.data;
      Logger.log("Parsed rows: " + (Array.isArray(rows) ? rows.length : "N/A — unexpected shape"));
    } catch (parseErr) {
      Logger.log("testConnection: could not parse response as JSON");
    }

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

function saveDataToSheet(tableName, data, sheetName, capLimit) {
  // MOPH now wraps rows in an envelope {"data": [...]}. Older responses were
  // a bare array — unwrap either shape before validating. Doing it here
  // covers both callers: syncAllData (server-side fetch) and doPost
  // (browser-pushed payload).
  if (data && !Array.isArray(data) && Array.isArray(data.data)) {
    data = data.data;
  }
  if (!Array.isArray(data)) {
    Logger.log("Error: API response is not an array for " + tableName);
    logToSheet(
      "ERROR",
      `Data Format Error ${tableName}`,
      "Response is not an array",
    );
    return false;
  }

  // Truncation tripwire: MOPH caps responses at 1000 rows unless the unit
  // declares a larger `limit`. Landing exactly on the cap almost always
  // means silent data loss, so leave a breadcrumb in system_logs.
  const cap = capLimit && Number(capLimit) > 0 ? Number(capLimit) : 1000;
  if (data.length === cap) {
    logToSheet(
      "WARNING",
      `Possible Truncation ${tableName}`,
      data.length + " rows == page cap " + cap + " — raise the unit's limit if total is larger",
    );
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

// kpi_epi is a second KPI-registry tab (immunization). Same raw passthrough
// as kpi_master — the frontend merges both with per-sheet category defaults.
const MASTER_SHEETS = ["hospitals", "tambon_master", "kpi_master", "kpi_epi"];

/**
 * OPTIMIZED API Endpoint
 * Calculates KPI values on server-side and returns only minimal data.
 * SUPPORTS: Single sheet fetch OR 'BATCH_ALL' for everything.
 *
 * Security: only MASTER_SHEETS, BATCH_ALL, and sheets listed in the sync units
 * are readable. Any other `sheet` value is rejected so internal sheets
 * (settings, system_logs, …) cannot be exposed via the public endpoint.
 */
function doGet(e) {
  // Diagnostic endpoint (?action=diag&pin=...): inspect triggers, probe the
  // MOPH API from GAS egress, and read recent system_logs. Exists because
  // the daily trigger's failures are otherwise invisible — no linked GCP
  // project for clasp logs, and system_logs is not on the sheet whitelist.
  if (e.parameter.action === "diag") {
    return handleDiag(e);
  }

  const sheetName = e.parameter.sheet;

  // 0. Safety Check
  if (!sheetName) return createJsonError('Missing "sheet" parameter');

  // 1. Handle Master Sheets (Pass-through) first — avoids unnecessary Sheets
  // service reads for these requests (best practice: minimize service calls).
  // Registry tabs (kpi_master, kpi_epi, future groups) + the manifest sheet
  // itself are all passthrough-readable; the list comes from kpi_registry.
  const registry = readRegistry();
  const masterSheets = MASTER_SHEETS.concat(["kpi_registry"]).concat(
    registry.map(function (r) {
      return r.sheet;
    }),
  );
  if (masterSheets.includes(sheetName)) {
    return serveRawSheet(sheetName);
  }

  // 2. Whitelist remaining names: BATCH_ALL or a known sync-unit sheet.
  //    Prevents leaking settings/system_logs/other internal sheets. Units
  //    include kpi_master-declared source sheets (e.g. s_epi1), so newly
  //    registered tables are servable without a redeploy.
  const isBatch = sheetName === "BATCH_ALL";

  // Resolve config from sheets only when data processing is needed
  // (BATCH_ALL or a single data sheet). Falls back to CONFIG defaults.
  const settings = readSettings();
  const kpiCfg = readKpiMasterConfig();
  const units = getSyncUnits(kpiCfg);

  if (!isBatch) {
    const knownKpiSheet = units.some((k) => k.sheet === sheetName);
    if (!knownKpiSheet) {
      return createJsonError("Unknown or forbidden sheet: " + sheetName);
    }
  }

  // Reuse a single SpreadsheetApp instance for every sheet read below.
  // This avoids redundant getActiveSpreadsheet() calls in BATCH_ALL.
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 3. BATCH MODE (Turbo)
  if (isBatch) {
    const result = {};
    const lastUpdatedMap = {};

    const stampLastUpdated = function (table, rows) {
      lastUpdatedMap[table] = null;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].date_com) {
          lastUpdatedMap[table] = rows[i].date_com;
          break;
        }
      }
    };

    // One sheet READ per unit, then process it once for the unit itself and
    // once per virtual KPI that shares it (s_epi2 feeds 7 output tables).
    const virtualsBySource = {};
    getVirtualKpis(kpiCfg).forEach(function (v) {
      (virtualsBySource[v.sourceSheet] = virtualsBySource[v.sourceSheet] || []).push(v);
    });

    units.forEach(function (kpi) {
      const matrix = readSheetMatrix(ss, kpi.sheet);
      if (!matrix) {
        // Source sheet missing (e.g. registered in kpi_master but never
        // synced yet): emit empty arrays for the unit AND its virtuals so
        // the response shape stays stable.
        result[kpi.table] = [];
        lastUpdatedMap[kpi.table] = null;
        (virtualsBySource[kpi.sheet] || []).forEach(function (v) {
          result[v.table] = [];
          lastUpdatedMap[v.table] = null;
        });
      } else {
        const rows = processSheetRows(
          matrix.headers, matrix.rows, kpi.table,
          settings.current_quarter, kpiCfg, null, null,
        );
        result[kpi.table] = rows;
        stampLastUpdated(kpi.table, rows);
        (virtualsBySource[kpi.sheet] || []).forEach(function (v) {
          const vRows = processSheetRows(
            matrix.headers, matrix.rows, v.table,
            settings.current_quarter, kpiCfg, v.valuePrefix, v.sourceId,
          );
          result[v.table] = vRows;
          stampLastUpdated(v.table, vRows);
        });
      }
    });

    // Sync units only — the frontend's sync page and sync-moph-to-gas.js
    // drive off this list; virtual KPIs are computed here and must never be
    // fetched from MOPH or POSTed back. `limit` tells clients which tables
    // need a larger page size (MOPH truncates at 1000 rows silently).
    const kpiConfigOut = units.map((kpi) => {
      const sheetCfg = kpiCfg[kpi.table] || {};
      const isQuarterly =
        sheetCfg.isQuarterly === null || sheetCfg.isQuarterly === undefined
          ? !!kpi.isQuarterly
          : sheetCfg.isQuarterly === true;
      return {
        table: kpi.table,
        sheet: kpi.sheet,
        isQuarterly: isQuarterly,
        target_months: sheetCfg.targetMonths ?? null,
        effective_quarter: sheetCfg.effectiveQuarter ?? null,
        limit: kpi.limit ?? null,
      };
    });

    // Wrap with Metadata. Exposing current_year/province_code means the
    // frontend sync page can pull them from BATCH_ALL instead of hardcoding.
    // `registry` tells the frontend which KPI-registry tabs to fetch raw and
    // each one's category default — adding a group is manifest-only.
    const response = {
      data: result,
      meta: {
        current_quarter: settings.current_quarter,
        current_year: settings.current_year,
        province_code: settings.province_code,
        kpi_config: kpiConfigOut,
        registry: registry,
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
// Kept as the read+process convenience wrapper for single-sheet mode.
function getProcessedDataForSheet(ss, sheetName, currentQuarter, kpiCfg) {
  const matrix = readSheetMatrix(ss, sheetName);
  if (!matrix) return [];
  return processSheetRows(
    matrix.headers, matrix.rows, sheetName,
    currentQuarter, kpiCfg, null, null,
  );
}

// One physical sheet read → { headers, rows }. BATCH_ALL calls this once per
// unit and reuses the matrix for the unit + every virtual KPI on that source.
function readSheetMatrix(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return null;

  return { headers: data[0], rows: data.slice(1) };
}

// LOGIC PROCESSOR over an already-read matrix.
// valuePrefix: EPI per-vaccine virtual KPI (e.g. "dtp4" → sum dtp4_01..12).
// sourceId: keep only rows whose `id` matches the HDC report GUID — used to
// split s_epi_complete's 4 age cohorts into separate virtual KPIs.
function processSheetRows(headers, rows, tableName, currentQuarter, kpiCfg, valuePrefix, sourceId) {
  return rows
    .filter(function (row) {
      if (!sourceId) return true;
      const item = {};
      headers.forEach(function (h, i) {
        item[h] = row[i];
      });
      return String(item["id"] || "").trim().toLowerCase() === sourceId;
    })
    .map((row) => {
      const item = {};
      headers.forEach((h, i) => {
        const key = h ? h.toString() : "col_" + i;
        item[key] = row[i];
      });

      const values = calculateKPIOnServer(item, tableName, currentQuarter, kpiCfg, valuePrefix);

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
/**
 * Diagnostic endpoint — answers "why doesn't the server-side sync work?"
 * from inside GAS. Query params:
 *   pin           (required) must match CONFIG.DIAG_PIN
 *   setup=trigger (optional) create the daily syncAllData trigger if missing
 *   run=sync      (optional) force a full server-side syncAllData() now
 *   logs=N        (optional) number of system_logs rows to return (default 15, max 200)
 */
function handleDiag(e) {
  if (String(e.parameter.pin || "") !== CONFIG.DIAG_PIN) {
    return createJsonError("Invalid or missing PIN");
  }

  const out = { time: new Date().toISOString() };

  // 1. Triggers actually registered on this project
  try {
    out.triggers = ScriptApp.getProjectTriggers().map(function (t) {
      return {
        handler: t.getHandlerFunction(),
        eventType: String(t.getEventType()),
      };
    });
  } catch (err) {
    out.triggers = { error: String(err) };
  }

  // Optional one-shot: ensure the daily trigger exists
  if (e.parameter.setup === "trigger") {
    try {
      const has = ScriptApp.getProjectTriggers().some(function (t) {
        return t.getHandlerFunction() === "syncAllData";
      });
      out.setupTrigger = has ? "already exists" : (createDailyTrigger(), "created");
    } catch (err) {
      out.setupTrigger = "error: " + String(err);
    }
  }

  // Optional one-time split: move EPI rows into their own kpi_epi tab and
  // restore kpi_master to its original column set. Idempotent.
  if (e.parameter.setup === "epi_split" || e.parameter.setup === "epi_rows") {
    try {
      out.setupEpiSplit = setupEpiSplit();
    } catch (err) {
      out.setupEpiSplit = "error: " + String(err);
    }
  }

  // Optional: seed the kpi_registry manifest sheet (headers + the current
  // two tabs). Idempotent — existing manifest rows are never modified.
  if (e.parameter.setup === "registry") {
    try {
      out.setupRegistry = setupRegistrySheet();
    } catch (err) {
      out.setupRegistry = "error: " + String(err);
    }
  }

  // Optional admin: drop KPI registry rows by table_name across all
  // registry tabs — e.g. remove retired/misconfigured KPIs without opening
  // the sheet. Token-sanitized; unknown names are reported, not fatal.
  // Usage: &setup=drop_rows&tables=s_epi1__pcv1,s_epi2__pcv4
  if (e.parameter.setup === "drop_rows") {
    try {
      out.dropRows = dropRegistryRows(String(e.parameter.tables || ""));
    } catch (err) {
      out.dropRows = "error: " + String(err);
    }
  }

  // Optional: force a full server-side sync now — proves the exact code path
  // the daily trigger executes, without waiting for the next 14:00 run.
  if (e.parameter.run === "sync") {
    const started = new Date();
    try {
      syncAllData();
      out.forcedSync = { ok: true, seconds: (new Date() - started) / 1000 };
    } catch (err) {
      out.forcedSync = { ok: false, error: String(err) };
    }
  }

  // 2. Probe MOPH two ways: exactly like syncAllData does (plain), and with
  //    browser-like headers. Reveals WAF/UA filtering on Google egress IPs.
  const settings = readSettings();
  const payload = JSON.stringify({
    tableName: "s_kpi_anc12",
    year: settings.current_year,
    province: settings.province_code,
    type: "json",
  });

  function probe(options) {
    try {
      const res = UrlFetchApp.fetch(CONFIG.API_URL, options);
      const body = res.getContentText();
      let parsed = "not-json";
      try {
        const json = JSON.parse(body);
        parsed = Array.isArray(json)
          ? "array:" + json.length
          : json && Array.isArray(json.data)
            ? "envelope:" + json.data.length
            : "json-other";
      } catch (parseErr) {
        parsed = "not-json";
      }
      return {
        status: res.getResponseCode(),
        parsed: parsed,
        bodyStart: body.substring(0, 200),
      };
    } catch (err) {
      return { error: String(err) };
    }
  }

  const base = {
    method: "post",
    contentType: "application/json",
    payload: payload,
    muteHttpExceptions: true,
    followRedirects: true,
  };
  out.mophPlain = probe(base);
  out.mophBrowserHeaders = probe(
    Object.assign({}, base, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
    }),
  );

  // 3. Recent sync history from system_logs (configurable depth)
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("system_logs");
    if (!sheet) {
      out.recentLogs = "no system_logs sheet";
    } else {
      const depth = Math.min(200, Math.max(1, Number(e.parameter.logs) || 15));
      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      out.recentLogs = values
        .slice(Math.max(1, values.length - depth))
        .map(function (row) {
          const obj = {};
          headers.forEach(function (h, i) {
            obj[h] = row[i];
          });
          return obj;
        });
    }
  } catch (err) {
    out.recentLogs = { error: String(err) };
  }

  return createJsonOutput(out);
}

/**
 * Idempotent split of the KPI registry into two tabs:
 *   kpi_master — ตัวชี้วัดพื้นฐาน (original 8 columns; the 6 grouping/virtual
 *                columns added by the pre-split bootstrap are removed again)
 *   kpi_epi    — สร้างเสริมภูมิคุ้มกันโรค (reduced schema: table_name, title,
 *                target, order, link, subgroup, source_sheet, value_prefix,
 *                source_id — category/category_order come from per-sheet
 *                defaults in the frontend, not columns)
 * Steps: ensure kpi_epi + headers → move any EPI rows from kpi_master →
 * append missing spec rows to kpi_epi → trim kpi_master back to its original
 * columns → clear config cache. Re-running is a no-op. Invoked via
 * ?action=diag&pin=...&setup=epi_split.
 */
function setupEpiSplit() {
  const CAT_EPI = "สร้างเสริมภูมิคุ้มกันโรค";
  const EPI_COLS = [
    "table_name", "title", "target", "order", "link",
    "subgroup", "source_sheet", "value_prefix", "source_id",
  ];
  // kpi_master's original column set (before the temporary grouping columns).
  const MASTER_COLS = [
    "table_name", "title", "target", "order", "link",
    "is_quarterly", "target_months", "effective_quarter",
  ];
  // Columns to strip from kpi_master once EPI rows moved out.
  const STRIP_COLS = [
    "category", "subgroup", "category_order",
    "source_sheet", "value_prefix", "source_id",
  ];

  // (table_name, title, order, subgroup, source_sheet, value_prefix, source_id)
  // GUIDs = s_epi_complete row ids, proven to map to age cohorts 1/2/3/5 ปี.
  const rows = [
    ["s_epi1__bcg", "เด็กครบ 1 ปี ได้รับวัคซีน BCG", 100, "กลุ่มอายุ 1 ปี", "s_epi1", "bcg", ""],
    ["s_epi1__dtp1", "เด็กครบ 1 ปี ได้รับวัคซีน DTP1", 101, "กลุ่มอายุ 1 ปี", "s_epi1", "dtp1", ""],
    ["s_epi1__dtp2", "เด็กครบ 1 ปี ได้รับวัคซีน DTP2", 102, "กลุ่มอายุ 1 ปี", "s_epi1", "dtp2", ""],
    ["s_epi1__dtp_hb3", "เด็กครบ 1 ปี ได้รับวัคซีน DTP-HB3", 103, "กลุ่มอายุ 1 ปี", "s_epi1", "dtp_hb3", ""],
    ["s_epi1__hbv", "เด็กครบ 1 ปี ได้รับวัคซีน HBV", 104, "กลุ่มอายุ 1 ปี", "s_epi1", "hbv", ""],
    ["s_epi1__hbv2", "เด็กครบ 1 ปี ได้รับวัคซีน HBV2", 105, "กลุ่มอายุ 1 ปี", "s_epi1", "hbv2", ""],
    ["s_epi1__hbv3", "เด็กครบ 1 ปี ได้รับวัคซีน HBV3", 106, "กลุ่มอายุ 1 ปี", "s_epi1", "hbv3", ""],
    ["s_epi1__hbv4", "เด็กครบ 1 ปี ได้รับวัคซีน HBV4", 107, "กลุ่มอายุ 1 ปี", "s_epi1", "hbv4", ""],
    ["s_epi1__hib1", "เด็กครบ 1 ปี ได้รับวัคซีน Hib1", 108, "กลุ่มอายุ 1 ปี", "s_epi1", "hib1", ""],
    ["s_epi1__hib2", "เด็กครบ 1 ปี ได้รับวัคซีน Hib2", 109, "กลุ่มอายุ 1 ปี", "s_epi1", "hib2", ""],
    ["s_epi1__hib3", "เด็กครบ 1 ปี ได้รับวัคซีน Hib3", 110, "กลุ่มอายุ 1 ปี", "s_epi1", "hib3", ""],
    ["s_epi1__ipv", "เด็กครบ 1 ปี ได้รับวัคซีน IPV", 111, "กลุ่มอายุ 1 ปี", "s_epi1", "ipv", ""],
    ["s_epi1__ipv1", "เด็กครบ 1 ปี ได้รับวัคซีน IPV1", 112, "กลุ่มอายุ 1 ปี", "s_epi1", "ipv1", ""],
    ["s_epi1__mmr", "เด็กครบ 1 ปี ได้รับวัคซีน MMR", 113, "กลุ่มอายุ 1 ปี", "s_epi1", "mmr", ""],
    ["s_epi1__opv3", "เด็กครบ 1 ปี ได้รับวัคซีน OPV3", 114, "กลุ่มอายุ 1 ปี", "s_epi1", "opv3", ""],
    ["s_epi1__pcv1", "เด็กครบ 1 ปี ได้รับวัคซีน PCV1", 115, "กลุ่มอายุ 1 ปี", "s_epi1", "pcv1", ""],
    ["s_epi1__pcv2", "เด็กครบ 1 ปี ได้รับวัคซีน PCV2", 116, "กลุ่มอายุ 1 ปี", "s_epi1", "pcv2", ""],
    ["s_epi1__pcv3", "เด็กครบ 1 ปี ได้รับวัคซีน PCV3", 117, "กลุ่มอายุ 1 ปี", "s_epi1", "pcv3", ""],
    ["s_epi1__rota", "เด็กครบ 1 ปี ได้รับวัคซีน Rota", 118, "กลุ่มอายุ 1 ปี", "s_epi1", "rota", ""],
    ["s_epi1__rota1", "เด็กครบ 1 ปี ได้รับวัคซีน Rota1", 119, "กลุ่มอายุ 1 ปี", "s_epi1", "rota1", ""],
    ["s_epi_complete__1y", "เด็กครบ 1 ปี ได้รับวัคซีนครบตามเกณฑ์ (fully immunized)", 120, "กลุ่มอายุ 1 ปี", "s_epi_complete", "", "28dd2c7955ce926456240b2ff0100bde"],
    ["s_epi2__dtp4", "เด็กครบ 2 ปี ได้รับวัคซีน DTP4", 121, "กลุ่มอายุ 2 ปี", "s_epi2", "dtp4", ""],
    ["s_epi2__opv4", "เด็กครบ 2 ปี ได้รับวัคซีน OPV4", 122, "กลุ่มอายุ 2 ปี", "s_epi2", "opv4", ""],
    ["s_epi2__mmr1", "เด็กครบ 2 ปี ได้รับวัคซีน MMR เข็มที่ 1", 123, "กลุ่มอายุ 2 ปี", "s_epi2", "mmr1", ""],
    ["s_epi2__mmr2", "เด็กครบ 2 ปี ได้รับวัคซีน MMR เข็มที่ 2", 124, "กลุ่มอายุ 2 ปี", "s_epi2", "mmr2", ""],
    ["s_epi2__je2", "เด็กครบ 2 ปี ได้รับวัคซีน JE2", 125, "กลุ่มอายุ 2 ปี", "s_epi2", "je2", ""],
    ["s_epi2__pcv4", "เด็กครบ 2 ปี ได้รับวัคซีน PCV4", 126, "กลุ่มอายุ 2 ปี", "s_epi2", "pcv4", ""],
    ["s_epi_complete__2y", "เด็กครบ 2 ปี ได้รับวัคซีนครบตามเกณฑ์ (fully immunized)", 127, "กลุ่มอายุ 2 ปี", "s_epi_complete", "", "35f4a8d465e6e1edc05f3d8ab658c551"],
    ["s_epi3__je3", "เด็กครบ 3 ปี ได้รับวัคซีน JE3", 128, "กลุ่มอายุ 3 ปี", "s_epi3", "je3", ""],
    ["s_epi3__mmr2", "เด็กครบ 3 ปี ได้รับวัคซีน MMR เข็มที่ 2", 129, "กลุ่มอายุ 3 ปี", "s_epi3", "mmr2", ""],
    ["s_epi_complete__3y", "เด็กครบ 3 ปี ได้รับวัคซีนครบตามเกณฑ์ (fully immunized)", 130, "กลุ่มอายุ 3 ปี", "s_epi_complete", "", "d1fe173d08e959397adf34b1d77e88d7"],
    ["s_epi5__dtp5", "เด็กครบ 5 ปี ได้รับวัคซีน DTP5", 131, "กลุ่มอายุ 5 ปี", "s_epi5", "dtp5", ""],
    ["s_epi5__opv5", "เด็กครบ 5 ปี ได้รับวัคซีน OPV5", 132, "กลุ่มอายุ 5 ปี", "s_epi5", "opv5", ""],
    ["s_epi_complete__5y", "เด็กครบ 5 ปี ได้รับวัคซีนครบตามเกณฑ์ (fully immunized)", 133, "กลุ่มอายุ 5 ปี", "s_epi_complete", "", "f033ab37c30201f73f142449d037028d"],
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- kpi_epi: ensure sheet + headers ---
  let epiSheet = ss.getSheetByName("kpi_epi");
  const sheetCreated = !epiSheet;
  if (!epiSheet) epiSheet = ss.insertSheet("kpi_epi");
  const epiValues = epiSheet.getDataRange().getValues();
  const epiHeaders = (epiValues[0] || []).map(function (h) {
    return String(h || "").trim().toLowerCase();
  });
  if (epiHeaders.filter(String).length === 0) {
    epiSheet.getRange(1, 1, 1, EPI_COLS.length).setValues([EPI_COLS]).setFontWeight("bold");
  }

  const epiCol = {};
  EPI_COLS.forEach(function (h) {
    epiCol[h] = EPI_COLS.indexOf(h);
  });

  // --- Move EPI rows out of kpi_master (if the pre-split state is present) ---
  const master = ss.getSheetByName("kpi_master");
  if (!master) return "no kpi_master sheet";
  const mValues = master.getDataRange().getValues();
  const mHeaders = mValues[0].map(function (h) {
    return String(h || "").trim().toLowerCase();
  });
  const mIdx = function (h) {
    return mHeaders.indexOf(h);
  };
  const idxCategory = mIdx("category");
  const idxSourceSheet = mIdx("source_sheet");

  let moved = 0;
  if (idxCategory >= 0 || idxSourceSheet >= 0) {
    const keepRows = [mValues[0]];
    for (let r = 1; r < mValues.length; r++) {
      const row = mValues[r];
      const isEpi =
        (idxCategory >= 0 && String(row[idxCategory] || "").trim() === CAT_EPI) ||
        (idxSourceSheet >= 0 && String(row[idxSourceSheet] || "").trim() !== "");
      if (!isEpi) {
        keepRows.push(row);
        continue;
      }
      // Rewrite into kpi_epi's reduced schema.
      const out = new Array(EPI_COLS.length).fill("");
      out[epiCol.table_name] = String(row[mIdx("table_name")] || "").trim();
      out[epiCol.title] = row[mIdx("title")] || "";
      out[epiCol.target] = row[mIdx("target")] || 95;
      out[epiCol.order] = row[mIdx("order")] || 999;
      out[epiCol.subgroup] = idxCategory >= 0 ? row[mIdx("subgroup")] || "" : "";
      out[epiCol.source_sheet] = idxSourceSheet >= 0 ? row[idxSourceSheet] || "" : "";
      out[epiCol.value_prefix] = row[mIdx("value_prefix")] || "";
      out[epiCol.source_id] = String(row[mIdx("source_id")] || "").trim();
      epiSheet.appendRow(out);
      moved++;
    }
    if (moved > 0) {
      master.clearContents();
      master
        .getRange(1, 1, keepRows.length, mHeaders.length)
        .setValues(keepRows);
      master.getRange(1, 1, 1, mHeaders.length).setFontWeight("bold");
    }
  }

  // --- Append any spec rows not present in kpi_epi ---
  const existing = {};
  epiSheet.getDataRange().getValues().forEach(function (row, i) {
    if (i === 0) return;
    existing[String(row[epiCol.table_name] || "").trim()] = true;
  });
  let appended = 0;
  rows.forEach(function (spec) {
    if (existing[spec[0]]) return;
    const out = new Array(EPI_COLS.length).fill("");
    out[epiCol.table_name] = spec[0];
    out[epiCol.title] = spec[1];
    out[epiCol.target] = 95;
    out[epiCol.order] = spec[2];
    out[epiCol.subgroup] = spec[3];
    out[epiCol.source_sheet] = spec[4];
    out[epiCol.value_prefix] = spec[5];
    out[epiCol.source_id] = spec[6];
    epiSheet.appendRow(out);
    appended++;
  });

  // --- Trim kpi_master back to its original columns (right to left) ---
  let trimmed = 0;
  const currentHeaders = master.getDataRange().getValues()[0].map(function (h) {
    return String(h || "").trim().toLowerCase();
  });
  STRIP_COLS.forEach(function (col) {
    const idx = currentHeaders.indexOf(col);
    if (idx >= 0) {
      master.deleteColumn(idx + 1);
      currentHeaders.splice(idx, 1);
      trimmed++;
    }
  });

  clearConfigCache();
  return {
    kpi_epi_created: sheetCreated,
    rows_moved_from_master: moved,
    rows_appended_to_epi: appended,
    master_columns_trimmed: trimmed,
  };
}

/**
 * Seed the kpi_registry manifest (headers + the two existing tabs). Run once
 * via ?action=diag&pin=...&setup=registry; afterwards manage rows in the
 * sheet directly — one row per category tab. Idempotent.
 */
function setupRegistrySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("kpi_registry");
  const created = !sheet;
  if (!sheet) sheet = ss.insertSheet("kpi_registry");
  const values = sheet.getDataRange().getValues();
  if ((values.length < 2) && values[0].filter(String).length === 0) {
    sheet.clearContents();
    sheet.getRange(1, 1, 3, 3).setValues([
      ["sheet_name", "category", "category_order"],
      ["kpi_master", "ตัวชี้วัดพื้นฐาน", 1],
      ["kpi_epi", "สร้างเสริมภูมิคุ้มกันโรค", 2],
    ]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  }
  clearConfigCache();
  return { sheet_created: created, rows: Math.max(0, sheet.getLastRow() - 1) };
}

/**
 * Delete KPI registry rows whose table_name is in the comma-separated
 * `tables` list, across every registry tab. Sanitized to identifier tokens.
 * Returns per-sheet deletion counts plus names that were not found.
 */
function dropRegistryRows(tablesParam) {
  const targets = tablesParam
    .split(",")
    .map(function (s) {
      return sanitizeToken(s);
    })
    .filter(function (s) {
      return s && s.length > 0;
    });
  if (targets.length === 0) return { error: "no valid table names given" };
  const wanted = {};
  targets.forEach(function (t) {
    wanted[t] = true;
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = { deleted: {}, deleted_names: [], not_found: [] };
  readRegistry().forEach(function (entry) {
    const sheet = ss.getSheetByName(entry.sheet);
    if (!sheet) return;
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return;
    const headers = values[0].map(function (h) {
      return String(h || "").trim().toLowerCase();
    });
    const idxTable = headers.indexOf("table_name");
    if (idxTable < 0) return;

    const keep = [values[0]];
    let deleted = 0;
    for (let i = 1; i < values.length; i++) {
      const name = String(values[i][idxTable] || "").trim();
      if (wanted[name]) {
        deleted++;
        result.deleted_names.push(name);
        continue;
      }
      keep.push(values[i]);
    }
    if (deleted > 0) {
      sheet.clearContents();
      sheet
        .getRange(1, 1, keep.length, headers.length)
        .setValues(keep);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      result.deleted[entry.sheet] = deleted;
    }
  });

  // Names that were requested but existed nowhere.
  result.not_found = targets.filter(function (t) {
    return result.deleted_names.indexOf(t) < 0;
  });
  delete result.deleted_names;

  clearConfigCache();
  return result;
}

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

    // Whitelist tableName against the sync units (CONFIG.KPIS ∪ kpi_master
    // source_sheet values) so an attacker (or buggy client) cannot write to
    // arbitrary sheets like settings/system_logs.
    const kpi = getSyncUnits(readKpiMasterConfig()).find((k) => k.table === tableName);
    if (!kpi) {
      logToSheet("ERROR", "doPost rejected unknown table", tableName);
      return createJsonError("Unknown table: " + tableName);
    }
    // sheetName is always derived from the unit — caller cannot override.
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
      const success = saveDataToSheet(tableName, data, sheetName, kpi.limit);
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
function calculateKPIOnServer(item, tableName, currentQuarter, kpiCfg, valuePrefix) {
  let t = 0;
  let r = 0;

  // 0a. EPI per-vaccine virtual KPI: targets and results live in birth-month
  // column families (target01..12 / dtp4_01..12) — annual sums, no quarter
  // logic. Short-circuits everything below by design.
  if (valuePrefix) {
    t = getAnnualSum(item, "target");
    r = getAnnualSum(item, valuePrefix);
    return { t: t, r: r };
  }
  // 0b. EPI fully-immunized virtual KPI: kpi_master rows carrying source_id
  // are GUID-filtered views of s_epi_complete (one per age cohort — rows are
  // pre-filtered in processSheetRows). Its aggregate target/result columns
  // already hold the annual figures, so read them directly.
  const virtualCfg = kpiCfg ? kpiCfg[tableName] : null;
  if (virtualCfg && virtualCfg.sourceId) {
    t = Number(item["target"] || 0);
    r = Number(item["result"] || 0);
    return { t: t, r: r };
  }

  // 1. Dental A/B Pattern (Target=B, Result=A)
  if (tableName === "s_dental_0_5_cavity_free") {
    t = Number(item["b"] || 0);
    r = Number(item["a"] || 0);
    return { t: t, r: r };
  }
  // 2. Aged 9 (No Quarter Sum)
  if (tableName === "s_aged9") {
    t = Number(item["target"] || 0);
    r = Number(item["result"] || 0);
    return { t: t, r: r };
  }

  // 3. Standard Logic (Auto Quarter Sum)
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

  // Resolve effective_quarter: per-KPI override of how many quarters to sum.
  // Falls back to the global current_quarter from `settings` when not set.
  // This is independent of target_months (display) — see readKpiMasterConfig.
  const effectiveQuarter =
    sheetCfg && sheetCfg.effectiveQuarter
      ? sheetCfg.effectiveQuarter
      : currentQuarter;

  if (tMain > 0 && !forceQuarterly) {
    // Annual target exists and KPI is not quarterly:
    // Prefer the annual result; fall back to quarter sum only when annual is missing/zero.
    t = tMain;
    r = rMain > 0 ? rMain : getQuarterSum(item, "result", effectiveQuarter);
  } else {
    // Sum quarters (If Force Quarterly OR No Annual Target)
    t = getQuarterSum(item, "target", effectiveQuarter);
    r = getQuarterSum(item, "result", effectiveQuarter);
  }

  return { t: t, r: r };
}

function getQuarterSum(item, prefix, currentQuarter) {
  let sum = 0;
  // Use the resolved quarter (from settings sheet) to limit the sum.
  const q = currentQuarter || CONFIG.CURRENT_QUARTER;
  for (let i = 1; i <= q; i++) {
    // Supported column naming patterns observed in MOPH data:
    //   target1, target2, target3, target4   (most common — s_kpi_childdev2 etc.)
    //   targetq1, targetq2, targetq3, targetq4 (s_ncd_screen_repleate1 etc.)
    //   t_q1, r_q1, ...                       (s_ht_screen_follow — newer convention)
    // The 3rd pattern uses the prefix's first letter + '_q' + i.
    const v1 = item[prefix + i];
    const v2 = item[prefix + "q" + i];
    const v3 = item[prefix.charAt(0) + "_q" + i];
    sum += Number(v1 || v2 || v3 || 0);
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
