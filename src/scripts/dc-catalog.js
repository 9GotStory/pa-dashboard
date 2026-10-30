/**
 * Data Center: the report catalog, hdc_topics and hdc_reports (SCHEMA §2.2,
 * §2.3, §3.4).
 *
 * Shares the Apps Script global scope with รหัส.js and dc-storage.js. Read
 * those only inside functions, never at top level: file load order is not
 * guaranteed.
 */

const DC_HDC_TOPICS_SHEET = "hdc_topics";
const DC_HDC_TOPICS_HEADERS = [
  "cat_id", "order", "category_name", "main_report_id", "main_report_name", "report_count", "last_refreshed_at",
];
const DC_HDC_REPORTS_SHEET = "hdc_reports";
const DC_HDC_REPORTS_HEADERS = [
  "opendata_id", "report_name", "source_table", "enabled", "subgroup", "order", "report_type", "goal",
  "col_target", "col_result", "cat_id", "category_name", "main_report_id", "main_report_name",
  "catalog_status", "last_seen_at",
];
const DC_SETTINGS_COLUMNS = ["district_code", "deploy_hook_url"];

/**
 * setup=datacenter (SCHEMA §3.6): create hdc_topics, hdc_reports and
 * sync_status with their header if missing, and append the district_code and
 * deploy_hook_url headers to settings if missing. Only missing sheets and
 * headers are added, so it can be re-run.
 */
function dcSetupDatacenter() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];
  [
    [DC_HDC_TOPICS_SHEET, DC_HDC_TOPICS_HEADERS],
    [DC_HDC_REPORTS_SHEET, DC_HDC_REPORTS_HEADERS],
    [DC_SYNC_STATUS_SHEET, DC_SYNC_STATUS_HEADERS],
  ].forEach(function (sheetAndHeaders) {
    const name = sheetAndHeaders[0];
    const headers = sheetAndHeaders[1];
    if (ss.getSheetByName(name)) return;
    ss.insertSheet(name).getRange(1, 1, 1, headers.length).setValues([headers]);
    created.push(name);
  });

  // settings is read by trimmed header (readSettings); a blank value below a
  // new header reads as its default.
  const settings = ss.getSheetByName("settings");
  const lastColumn = settings.getLastColumn();
  const existing = lastColumn > 0
    ? settings.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (h) {
      return String(h || "").trim();
    })
    : [];
  const added = DC_SETTINGS_COLUMNS.filter(function (name) {
    return existing.indexOf(name) === -1;
  });
  if (added.length > 0) settings.getRange(1, lastColumn + 1, 1, added.length).setValues([added]);

  return { created: created, settings_columns_added: added };
}

// Columns of hdc_reports that come from the catalog API (SCHEMA §3.4 step 5).
const DC_CATALOG_API_COLUMNS = [
  "report_name", "source_table", "cat_id", "category_name", "main_report_id", "main_report_name",
];
// Ids written as plain text so Sheets never turns one into a number.
const DC_CATALOG_TEXT_COLUMNS = ["opendata_id", "cat_id", "main_report_id"];
// A source_table becomes a writable sheet name, so it must not collide with a
// system sheet (SCHEMA §2.3).
const DC_SOURCE_TABLE_PATTERN = /^s_[a-z0-9_]+$/;

/**
 * hdc_topics rows whose cat_id passes sanitizeHdcId, as DcTopic (SCHEMA §9),
 * read by header name. [] if the sheet does not exist yet.
 */
function readHdcTopics() {
  return dcSheetRecords(DC_HDC_TOPICS_SHEET, DC_HDC_TOPICS_HEADERS).map(function (row) {
    return {
      cat_id: sanitizeHdcId(row.cat_id),
      category_name: String(row.category_name),
      main_report_id: String(row.main_report_id).trim(),
      main_report_name: String(row.main_report_name),
      order: parsePositiveInt(row.order),
    };
  }).filter(function (topic) {
    return topic.cat_id !== null;
  });
}

/**
 * รายงานที่ใช้งาน (SCHEMA §2.3) in sheet order, read by header name: rows with
 * enabled = TRUE, whose cat_id is in hdc_topics and whose opendata_id and
 * source_table pass their patterns. An enabled row of a listed topic that
 * fails a pattern is skipped with a WARNING (Logger.log: this runs on every
 * sync units cache miss, CODING_STANDARDS §2). Returned as DcReport (SCHEMA §9)
 * without measure_goals/years; an admin value of the wrong type reads as
 * null, and col_target/col_result only as a pair. [] if hdc_reports does not
 * exist yet.
 */
function readHdcReports() {
  // Null prototype: an id such as "constructor" must not hit Object.prototype.
  const topicIds = Object.create(null);
  readHdcTopics().forEach(function (topic) {
    topicIds[topic.cat_id] = true;
  });
  const invalid = [];
  const reports = [];
  dcSheetRecords(DC_HDC_REPORTS_SHEET, DC_HDC_REPORTS_HEADERS).forEach(function (row) {
    const catId = sanitizeHdcId(row.cat_id);
    if (!parseBool(row.enabled) || catId === null || !topicIds[catId]) return;
    const id = sanitizeHdcId(row.opendata_id);
    const sourceTable = dcSourceTable(row.source_table);
    if (id === null || sourceTable === null) {
      invalid.push(String(row.opendata_id) + " / " + String(row.source_table));
      return;
    }
    const type = String(row.report_type).trim().toLowerCase();
    const goal = String(row.goal).trim() === "" ? NaN : Number(row.goal);
    const colTarget = sanitizeToken(row.col_target);
    const colResult = sanitizeToken(row.col_result);
    const paired = colTarget !== null && colResult !== null;
    reports.push({
      opendata_id: id,
      report_name: String(row.report_name),
      source_table: sourceTable,
      cat_id: catId,
      main_report_id: String(row.main_report_id).trim(),
      subgroup: String(row.subgroup).trim(),
      order: parsePositiveInt(row.order),
      report_type: type === "coverage" || type === "workload" ? type : null,
      goal: goal >= 0 && goal <= 100 ? goal : null,
      col_target: paired ? colTarget : null,
      col_result: paired ? colResult : null,
      catalog_status: String(row.catalog_status).trim() === "removed" ? "removed" : "active",
    });
  });
  if (invalid.length > 0) {
    Logger.log("WARNING readHdcReports: skipped enabled rows with an invalid opendata_id or source_table: " +
      invalid.join(", "));
  }
  return reports;
}

/**
 * save_catalog (SCHEMA §3.4): merge one topic's reports from the catalog API
 * into hdc_reports and update its hdc_topics row. Only the API columns are
 * written on an existing row; a new row gets enabled = FALSE (opt-in,
 * ADR-0008).
 *
 * The caller must hold the script lock (doPost): this function never calls
 * LockService (SCHEMA §3).
 *
 * Returns { status: "success", added, updated, removed, skipped } or
 * { status: "error", message }.
 */
function dcSaveCatalog(catIdRaw, categoryName, reports) {
  const catId = sanitizeHdcId(catIdRaw);
  const known = catId !== null && readHdcTopics().some(function (topic) {
    return topic.cat_id === catId;
  });
  if (!known) return dcRejectCatalog(catId, "Topic not in hdc_topics");
  // An empty list is what a failed catalog fetch looks like: refuse it rather
  // than set the whole topic to removed (step 2).
  if (!Array.isArray(reports) || reports.length === 0) return dcRejectCatalog(catId, "Empty report list");

  // Steps 3–4: keep rows of this topic whose opendata_id and source_table
  // pass their patterns, the first of each opendata_id. A duplicate is not
  // counted as skipped.
  // Null-prototype maps: an id such as "constructor" must not hit
  // Object.prototype.
  const kept = [];
  const seen = Object.create(null);
  let skipped = 0;
  reports.forEach(function (r) {
    const id = sanitizeHdcId(r.opendata_id);
    const sourceTable = dcSourceTable(r.source_table);
    if (id === null || sourceTable === null || sanitizeHdcId(r.cat_id) !== catId) {
      skipped++;
      return;
    }
    if (seen[id]) return;
    seen[id] = true;
    kept.push({
      opendata_id: id,
      report_name: dcCleanName(r.report_name),
      source_table: sourceTable,
      cat_id: catId,
      category_name: dcCleanName(r.category_name),
      main_report_id: String(r.main_report_id || "").trim(),
      main_report_name: dcCleanName(r.main_report_name),
    });
  });
  // Nothing passing the patterns means the response changed shape (e.g. a
  // new id format), not that every report was removed: refuse it like an
  // empty list.
  if (kept.length === 0) return dcRejectCatalog(catId, "No valid reports");

  const now = new Date();
  const reportsTable = dcReadTable(DC_HDC_REPORTS_SHEET, DC_HDC_REPORTS_HEADERS);
  const c = reportsTable.col;
  const rowById = Object.create(null);
  reportsTable.rows.forEach(function (row) {
    const id = sanitizeHdcId(row[c.opendata_id]);
    if (id && !rowById[id]) rowById[id] = row;
  });
  const existingRows = reportsTable.rows.length;
  let added = 0;
  let updated = 0;
  const inOtherTopic = [];
  kept.forEach(function (report) {
    let row = rowById[report.opendata_id];
    if (row) {
      // The first topic to list a report keeps it (step 5).
      const owner = String(row[c.cat_id]).trim();
      if (owner !== "" && owner !== catId) {
        skipped++;
        inOtherTopic.push(report.opendata_id + " (" + owner + ")");
        return;
      }
      updated++;
    } else {
      row = reportsTable.header.map(function () {
        return "";
      });
      row[c.enabled] = false;
      row[c.opendata_id] = report.opendata_id;
      reportsTable.rows.push(row);
      added++;
    }
    DC_CATALOG_API_COLUMNS.forEach(function (name) {
      row[c[name]] = report[name];
    });
    row[c.catalog_status] = "active";
    row[c.last_seen_at] = now;
  });

  // Step 6: this topic's active rows that the API no longer lists.
  let removed = 0;
  reportsTable.rows.forEach(function (row) {
    if (String(row[c.cat_id]).trim() === catId && !seen[sanitizeHdcId(row[c.opendata_id])] &&
      String(row[c.catalog_status]).trim() === "active") {
      row[c.catalog_status] = "removed";
      removed++;
    }
  });

  const topicsTable = dcReadTable(DC_HDC_TOPICS_SHEET, DC_HDC_TOPICS_HEADERS);
  const t = topicsTable.col;
  const topicRow = topicsTable.rows.filter(function (row) {
    return sanitizeHdcId(row[t.cat_id]) === catId;
  })[0];
  // Step 7.
  const first = kept[0];
  topicRow[t.category_name] = dcCleanName(categoryName) || first.category_name;
  topicRow[t.main_report_id] = first.main_report_id;
  topicRow[t.main_report_name] = first.main_report_name;
  topicRow[t.report_count] = kept.length;
  topicRow[t.last_refreshed_at] = now;

  dcWriteTable(reportsTable, DC_CATALOG_TEXT_COLUMNS);
  // insertCheckboxes sets every cell it covers to FALSE, so only new rows.
  if (added > 0) reportsTable.sheet.getRange(existingRows + 2, c.enabled + 1, added, 1).insertCheckboxes();
  dcWriteTable(topicsTable, DC_CATALOG_TEXT_COLUMNS);
  // A source_table may have changed, so the cached DC units are stale.
  try {
    CacheService.getScriptCache().remove(DC_UNITS_CACHE_KEY);
  } catch (e) {
    Logger.log("dcSaveCatalog: cache remove failed: " + e);
  }

  if (inOtherTopic.length > 0) {
    logToSheet("INFO", "Catalog " + catId + " reports kept in another topic", inOtherTopic.join(", "));
  }
  logToSheet("SUCCESS", "Saved catalog " + catId,
    "added " + added + ", updated " + updated + ", removed " + removed + ", skipped " + skipped);
  return { status: "success", added: added, updated: updated, removed: removed, skipped: skipped };
}

/**
 * Log a rejected save_catalog to system_logs and return the error response.
 * Nothing has been written yet. catId is the sanitized one (or null), so no
 * raw request text reaches the sheet.
 */
function dcRejectCatalog(catId, message) {
  logToSheet("ERROR", "Catalog rejected " + (catId || "(invalid cat_id)"), message);
  return { status: "error", message: message };
}

/** Trim + `^[A-Za-z0-9_-]{8,64}$`, case kept (SCHEMA §3). null if it fails. */
function sanitizeHdcId(v) {
  const s = String(v || "").trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}

/**
 * Trim + DC_SOURCE_TABLE_PATTERN, for a source_table from the API or the
 * sheet. null if it fails (including null from the API, SCHEMA §5.2).
 */
function dcSourceTable(v) {
  const s = String(v || "").trim();
  return DC_SOURCE_TABLE_PATTERN.test(s) ? s : null;
}

/**
 * A name from HDC as plain text (SCHEMA §3): strip HTML tags → collapse every
 * run of whitespace (tab, newline included) to one space → trim. A tag is `<`
 * or `</` followed by a letter, so names like "LDL < 100 mg/dl" or
 * "eGFR<5 ml/min" keep their `<`. HTML entities are not decoded (none in
 * the catalog, §5.2).
 */
function dcCleanName(v) {
  return String(v || "").replace(/<\/?[A-Za-z][^<>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** A header cell as a lookup name: trim + lowercase (SCHEMA §1). */
function dcHeaderName(h) {
  return String(h || "").trim().toLowerCase();
}

/**
 * A sheet's data rows as objects with the given keys, read by header name;
 * a missing column reads as "". [] if the sheet does not exist.
 */
function dcSheetRecords(sheetName, keys) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(dcHeaderName);
  return values.slice(1).map(function (row) {
    const out = {};
    keys.forEach(function (key) {
      const i = header.indexOf(key);
      out[key] = i > -1 ? row[i] : "";
    });
    return out;
  });
}

/**
 * A sheet for a read-modify-write that keeps every column, including ones
 * the admin added: { sheet, header, rows, col }. header is row 1 as written
 * plus any of `columns` it lacks, appended; col maps each of `columns` to its
 * 0-based index; rows are padded to the header. The sheet is created if
 * missing.
 */
function dcReadTable(sheetName, columns) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const values = sheet.getLastRow() > 0 ? sheet.getDataRange().getValues() : [[]];
  const header = values[0].slice();
  const names = header.map(dcHeaderName);
  const col = {};
  columns.forEach(function (name) {
    if (names.indexOf(name) === -1) {
      header.push(name);
      names.push(name);
    }
    col[name] = names.indexOf(name);
  });
  const rows = values.slice(1).map(function (row) {
    return header.map(function (_, i) {
      return i < row.length ? row[i] : "";
    });
  });
  return { sheet: sheet, header: header, rows: rows, col: col };
}

/**
 * Write a dcReadTable result back over the same cells, without clear(): the
 * admin's checkboxes and formats stay, and rows are only ever added, so no
 * old row is left below. textColumns are set to plain text first.
 */
function dcWriteTable(table, textColumns) {
  const sheet = table.sheet;
  const missingRows = table.rows.length + 1 - sheet.getMaxRows();
  if (missingRows > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missingRows);
  sheet.getRange(1, 1, 1, table.header.length).setValues([table.header]);
  if (table.rows.length === 0) return;
  textColumns.forEach(function (name) {
    if (table.col[name] !== undefined) {
      sheet.getRange(2, table.col[name] + 1, table.rows.length, 1).setNumberFormat("@");
    }
  });
  sheet.getRange(2, 1, table.rows.length, table.header.length).setValues(table.rows);
}
