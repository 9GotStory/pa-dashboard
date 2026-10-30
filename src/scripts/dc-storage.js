/**
 * Data Center: multi-year storage (SCHEMA §2.5, SPEC §7).
 *
 * Shares the Apps Script global scope with รหัส.js (CONFIG, readSettings).
 * Read those only inside functions, never at top level: file load order
 * is not guaranteed.
 */

/**
 * The year window: CONFIG.HISTORY_YEARS years ending at settings.current_year,
 * oldest first, as strings (b_year is always compared as a string).
 * e.g. current_year "2569" → ["2565", "2566", "2567", "2568", "2569"]
 */
function getYearWindow(settings) {
  const last = Number(settings.current_year);
  const years = [];
  for (let i = CONFIG.HISTORY_YEARS - 1; i >= 0; i--) {
    years.push(String(last - i));
  }
  return years;
}

/**
 * The sheet that holds (table, year): the table name itself for current_year,
 * `{table}_y{YYYY}` for any other year. Every sheet name comes from here.
 * settings defaults to readSettings(). The year is compared as a string, so a
 * numeric cell value (2569) still matches current_year ("2569").
 */
function sheetNameFor(table, year, settings) {
  const s = settings || readSettings();
  return String(year) === s.current_year ? table : table + "_y" + year;
}

// DC unit table names in CacheService, CONFIG_CACHE_TTL_SECONDS like
// kpi_master (SCHEMA §3.5). clearConfigCache and save_catalog remove it.
const DC_UNITS_CACHE_KEY = "dc_units_v1";

/**
 * Sync units (SPEC §8) = PA units ∪ DC units: what syncAllData fetches, what
 * doPost accepts and what BATCH_ALL lists in meta.kpi_config. A DC unit is a
 * source_table of a รายงานที่ใช้งาน that is not already a PA unit; it comes
 * after the PA units, in hdc_reports order.
 */
function getSyncUnits(kpiCfg) {
  const units = getPaUnits(kpiCfg);
  const tables = units.map(function (unit) {
    return unit.table;
  });
  dcUnitTables().forEach(function (table) {
    if (tables.indexOf(table) > -1) return;
    tables.push(table);
    units.push({ table: table, sheet: table, isQuarterly: false, limit: null });
  });
  return units;
}

/**
 * The distinct source_table of รายงานที่ใช้งาน ([] before hdc_reports exists),
 * cached under DC_UNITS_CACHE_KEY: every BATCH_ALL from PA needs it, and
 * readHdcReports reads 2 sheets.
 */
function dcUnitTables() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get(DC_UNITS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    Logger.log("dcUnitTables: cache read failed: " + e);
  }
  const tables = [];
  readHdcReports().forEach(function (report) {
    if (tables.indexOf(report.source_table) === -1) tables.push(report.source_table);
  });
  try {
    cache.put(DC_UNITS_CACHE_KEY, JSON.stringify(tables), CONFIG_CACHE_TTL_SECONDS);
  } catch (e) {
    Logger.log("dcUnitTables: cache write failed: " + e);
  }
  return tables;
}

const DC_SYNC_STATUS_SHEET = "sync_status";
const DC_SYNC_STATUS_HEADERS = ["table", "b_year", "sheet", "row_count", "max_date_com", "synced_at"];
// Columns written as plain text so Sheets keeps leading zeros (เดิม).
const DC_TEXT_COLUMNS = ["id", "hospcode", "areacode", "vhid"];
// sync_status keeps these as strings (SCHEMA §2.4) instead of Sheets numbers.
const DC_SYNC_STATUS_TEXT_COLUMNS = ["b_year", "max_date_com"];

/**
 * Save one (table, year) from MOPH rows: SCHEMA §3.3 steps 1–10.
 * Keeps only rows of settings.district_code, replaces the whole sheet
 * sheetNameFor(tableName, year) and upserts sync_status.
 *
 * The caller must hold the script lock (doPost / syncAllData): this function
 * never calls LockService (SCHEMA §3).
 *
 * options: { total, force, settings, kpiCfg }. settings and kpiCfg default to
 * readSettings() and readKpiMasterConfig(), which take the lock themselves on
 * a cache miss; syncAllData outlives their 60 s cache, so it passes the ones
 * it read before taking the lock (SCHEMA §3).
 *
 * Returns the save_kpi_data response: { status: "success", year, sheet,
 * received, count, archived } or { status: "error", message }.
 */
function saveTableYear(tableName, year, rows, options) {
  const opts = options || {};
  const settings = opts.settings || readSettings();
  const y = year === undefined || year === null || year === "" ? settings.current_year : String(year).trim();
  // Only sync units are writable, so a caller cannot overwrite settings,
  // system_logs or any other sheet.
  const isSyncUnit = getSyncUnits(opts.kpiCfg || readKpiMasterConfig()).some(function (unit) {
    return unit.table === tableName;
  });
  if (!isSyncUnit) {
    return dcRejectSave("ERROR", tableName, y, "Unknown table: " + tableName);
  }
  if (!/^\d{4}$/.test(y) || getYearWindow(settings).indexOf(y) === -1) {
    return dcRejectSave("ERROR", tableName, y, "Year outside window");
  }

  // MOPH wraps rows in an envelope {"data": [...]}; older responses were a
  // bare array (เดิม).
  if (rows && !Array.isArray(rows) && Array.isArray(rows.data)) rows = rows.data;
  if (!Array.isArray(rows)) {
    return dcRejectSave("ERROR", tableName, y, "Data is not an array");
  }
  // total may arrive as a string (SCHEMA §5.3); a non-numeric one is ignored.
  if (opts.total !== undefined && opts.total !== null && rows.length < Number(opts.total)) {
    return dcRejectSave("ERROR", tableName, y, "Incomplete data", rows.length + " of " + opts.total + " rows");
  }
  if (rows.length === 0) {
    return dcRejectSave("WARNING", tableName, y, "Empty data", "0 rows, keeping the existing sheet");
  }
  if (!(rows[0] && typeof rows[0] === "object" && "areacode" in rows[0])) {
    return dcRejectSave("ERROR", tableName, y, "No areacode column");
  }

  const inDistrict = rows.filter(function (row) {
    return dcInDistrict(row.areacode, settings);
  });
  if (inDistrict.length === 0) {
    return dcRejectSave("WARNING", tableName, y, "No rows for district " + settings.district_code,
      "keeping the existing sheet");
  }

  // b_year is compared as a string; a row without it belongs to the year sent.
  const kept = [];
  inDistrict.forEach(function (row) {
    if (row.b_year === undefined || row.b_year === null || row.b_year === "") {
      kept.push(Object.assign({}, row, { b_year: y }));
    } else if (String(row.b_year) === y) {
      kept.push(row);
    }
  });
  if (kept.length < inDistrict.length) {
    logToSheet("WARNING", "Dropped rows " + tableName + " " + y,
      (inDistrict.length - kept.length) + " rows with b_year other than " + y);
  }
  if (kept.length === 0) {
    return dcRejectSave("WARNING", tableName, y, "No rows for year " + y, "keeping the existing sheet");
  }

  const maxDateCom = dcMaxDateCom(kept.map(function (row) {
    return row.date_com;
  }));
  if (opts.force !== true) {
    const existing = dcFindSyncStatus(dcReadSyncStatus(), tableName, y);
    if (existing && existing.max_date_com > maxDateCom) {
      return dcRejectSave("ERROR", tableName, y,
        "Stale data: existing " + existing.max_date_com + " > incoming " + maxDateCom);
    }
  }

  const archived = y === settings.current_year ? dcArchiveOldYears(tableName, y, settings) : [];

  const headers = [];
  kept.forEach(function (row) {
    Object.keys(row).forEach(function (key) {
      if (headers.indexOf(key) === -1) headers.push(key);
    });
  });
  const values = kept.map(function (row) {
    return headers.map(function (key) {
      const val = row[key];
      if (DC_TEXT_COLUMNS.indexOf(key) > -1) {
        return val !== null && val !== undefined ? String(val) : "";
      }
      return val || "";
    });
  });

  const sheetName = sheetNameFor(tableName, y, settings);
  dcWriteSheet(sheetName, headers, values, DC_TEXT_COLUMNS);
  dcUpsertSyncStatus(tableName, y, sheetName, kept.length, maxDateCom, getYearWindow(settings));

  Logger.log("Success: Synced " + kept.length + " rows for " + tableName + " " + y + " to " + sheetName);
  logToSheet("SUCCESS", "Synced " + tableName + " " + y, kept.length + " rows");
  return { status: "success", year: y, sheet: sheetName, received: rows.length, count: kept.length, archived: archived };
}

/**
 * Archive (SCHEMA §2.5): before the current-year sheet is replaced, move its
 * rows of other years to their `{table}_y{Z}` sheets, with the sheet's own
 * header. Rows outside the district or the window are dropped with a WARNING.
 * A year whose `_y` sheet already holds data at least as new (by sync_status)
 * is not overwritten; its rows are just dropped. Returns the years moved.
 * The caller must hold the script lock.
 */
function dcArchiveOldYears(tableName, year, settings) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetNameFor(tableName, year, settings));
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const names = header.map(function (h) {
    return String(h || "").trim().toLowerCase();
  });
  const iYear = names.indexOf("b_year");
  if (iYear === -1) return [];
  const others = values.slice(1).filter(function (row) {
    return String(row[iYear]) !== year;
  });
  if (others.length === 0) return [];

  // The sheet may still hold province-wide rows written before Data Center.
  const iArea = names.indexOf("areacode");
  const byYear = {};
  let outsideDistrict = 0;
  others.forEach(function (row) {
    if (iArea === -1 || !dcInDistrict(row[iArea], settings)) {
      outsideDistrict++;
      return;
    }
    const z = String(row[iYear]);
    (byYear[z] = byYear[z] || []).push(row);
  });
  if (outsideDistrict > 0) {
    logToSheet("WARNING", "Archive dropped rows " + tableName,
      outsideDistrict + " rows outside district " + settings.district_code);
  }

  const window = getYearWindow(settings);
  const iDate = names.indexOf("date_com");
  const status = dcReadSyncStatus();
  const archived = [];
  Object.keys(byYear).sort().forEach(function (z) {
    const rows = byYear[z];
    if (window.indexOf(z) === -1) {
      logToSheet("WARNING", "Archive dropped rows " + tableName, rows.length + " rows of " + z + " outside the window");
      return;
    }
    const target = sheetNameFor(tableName, z, settings);
    const maxDateCom = dcMaxDateCom(rows.map(function (row) {
      return iDate > -1 ? row[iDate] : "";
    }));
    const existing = dcFindSyncStatus(status, tableName, z);
    if (existing && existing.sheet === target && existing.max_date_com >= maxDateCom) {
      Logger.log("Archive: " + target + " already has " + existing.max_date_com + " >= " + maxDateCom + ", not overwritten");
      return;
    }
    dcWriteSheet(target, header, rows, DC_TEXT_COLUMNS);
    dcUpsertSyncStatus(tableName, z, target, rows.length, maxDateCom, window);
    logToSheet("SUCCESS", "Archived " + tableName + " " + z, rows.length + " rows to " + target);
    archived.push(z);
  });
  return archived;
}

/** areacode starts with settings.district_code (SCHEMA §2.5 "แถวที่เก็บ"). */
function dcInDistrict(areacode, settings) {
  return String(areacode).indexOf(settings.district_code) === 0;
}

/**
 * Log a rejected save to system_logs (syncAllData has no other way to show
 * it) and return the error response. Nothing has been written yet.
 */
function dcRejectSave(type, tableName, year, message, details) {
  logToSheet(type, "Save rejected " + tableName + " " + year, message + (details ? ": " + details : ""));
  return { status: "error", message: message };
}

/**
 * Largest date_com as a string ("" if none). Compared as strings: within a
 * table date_com has one length (12 digits, or 14 with seconds in s_epi1),
 * and a 14-digit value only extends the 12-digit prefix, so string order is
 * time order.
 */
function dcMaxDateCom(dateComs) {
  return dateComs.reduce(function (max, v) {
    const s = v === null || v === undefined ? "" : String(v);
    return s > max ? s : max;
  }, "");
}

/**
 * Replace a whole sheet: clear → header → plain-text format for textColumns →
 * values → delete the blank rows below the data (SCHEMA §2.5). values has
 * ≥ 1 row.
 * The sheet is sized to exactly the data, so it is grown first when the new
 * data is longer (getRange past getMaxRows() is not documented to grow it).
 */
function dcWriteSheet(sheetName, headers, values, textColumns) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clear();
  const missingRows = values.length + 1 - sheet.getMaxRows();
  if (missingRows > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missingRows);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  textColumns.forEach(function (col) {
    const i = headers.indexOf(col);
    if (i > -1) sheet.getRange(2, i + 1, values.length, 1).setNumberFormat("@");
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  const blankRows = sheet.getMaxRows() - (values.length + 1);
  if (blankRows > 0) sheet.deleteRows(values.length + 2, blankRows);
}

/**
 * sync_status rows as objects, read by header name (trim + lowercase).
 * [] if the sheet does not exist yet.
 */
function dcReadSyncStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DC_SYNC_STATUS_SHEET);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(function (h) {
    return String(h || "").trim().toLowerCase();
  });
  return values.slice(1).map(function (row) {
    const out = {};
    DC_SYNC_STATUS_HEADERS.forEach(function (key) {
      const i = header.indexOf(key);
      out[key] = i > -1 ? row[i] : "";
    });
    out.b_year = String(out.b_year);
    out.max_date_com = String(out.max_date_com);
    return out;
  }).filter(function (row) {
    return row.table !== "";
  });
}

/** The sync_status row of (table, year), or null. */
function dcFindSyncStatus(statusRows, table, year) {
  for (let i = 0; i < statusRows.length; i++) {
    if (statusRows[i].table === table && statusRows[i].b_year === year) return statusRows[i];
  }
  return null;
}

/**
 * Upsert sync_status (table, year) and delete the table's rows outside the
 * window (SCHEMA §2.4). GAS is its only writer, so the sheet is rewritten
 * whole in DC_SYNC_STATUS_HEADERS order; it is created here if missing.
 * The caller must hold the script lock.
 */
function dcUpsertSyncStatus(table, year, sheetName, rowCount, maxDateCom, window) {
  const entry = {
    table: table,
    b_year: year,
    sheet: sheetName,
    row_count: rowCount,
    max_date_com: maxDateCom,
    synced_at: new Date(),
  };
  const rows = dcReadSyncStatus().filter(function (row) {
    return row.table !== table || (row.b_year !== year && window.indexOf(row.b_year) > -1);
  });
  rows.push(entry);
  dcWriteSheet(DC_SYNC_STATUS_SHEET, DC_SYNC_STATUS_HEADERS, rows.map(function (row) {
    return DC_SYNC_STATUS_HEADERS.map(function (key) {
      return row[key];
    });
  }), DC_SYNC_STATUS_TEXT_COLUMNS);
}
