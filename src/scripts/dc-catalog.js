/**
 * Data Center: the report catalog, hdc_topics and hdc_reports (SCHEMA §2.2,
 * §2.3, §3.1, §3.4).
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
 *
 * An error is logged to system_logs and rethrown, so handleDiag still
 * answers "error: …": a run that stops part way leaves sheets half made, and
 * the response may not be kept (#145).
 */
function dcSetupDatacenter() {
  try {
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
  } catch (e) {
    logToSheet("ERROR", "setup=datacenter failed", String(e));
    throw e;
  }
}

// The phase 1 seed (SCHEMA §6): 21 reports, each enabled = TRUE with
// report_type = coverage.
// [opendata_id, subgroup, order, goal, col_target, col_result]
const DC_SEED_REPORTS = [
  // อนามัยแม่และเด็ก
  ["1c1b8e24aff59258a806f122e264031e", "", 10, 75, "", ""], // s_kpi_anc12
  ["bd63b8d99f7054560fcf9c3b96f39c13", "", 20, 75, "", ""], // s_anc5
  ["1b60d68b1cb5b003fcba38a4a0e4027b", "", 30, 87, "", ""], // s_kpi_childdev4
  ["684e99dc7538c8b1a97f19f91a100f08", "", 40, 20, "", ""], // s_kpi_childdev2
  // การเฝ้าระวังด้านส่งเสริมสุขภาพและอนามัยสิ่งแวดล้อม
  ["4164a7c49fcb2b8c3ccca67dcdf28bd0", "", 10, 50, "", ""], // s_kpi_food
  // การคัดกรอง
  ["aa86b13e8cb60cae6c3216b7e3e5f151", "", 10, 80, "", ""], // s_aged9
  // ข้อมูลเพื่อตอบสนอง Service Plan สาขาโรคไม่ติดต่อ (NCD DM,HT,CVD)
  ["626c89f6b8d9f7ed90c72c719775eb07", "", 10, 90, "", ""], // s_dm_screen
  ["9702fa28cd2ec73ecc6af89d14f46874", "", 20, 90, "", ""], // s_ht_screen
  ["e9e461e793e8258f47d46d6956f12832", "", 30, 70, "", ""], // s_ncd_screen_repleate1
  ["b57439ff27302ade8c38d1dd189644a4", "", 40, 80, "", ""], // s_ht_screen_follow
  // ข้อมูลเพื่อตอบสนอง Service Plan สาขาสุขภาพช่องปาก
  ["abt2t2k4z4xeqzytwbave", "", 10, 80, "b", "a"], // s_dental_0_5_cavity_free
  ["e07a6ff3cd63d34a759be4bff5c1a4c6", "", 20, 25, "", ""], // s_kpi_dental28
  ["1fb6b46f1d1fd42362f97072f4b3b653", "", 30, 50, "", ""], // s_kpi_dental33
  // การสร้างเสริมภูมิคุ้มกันโรค
  ["c88658f4d09acb8c76e6c06ffb58ebaf", "กลุ่มอายุ 1 ปี", 10, 90, "", ""], // s_epi1
  ["28dd2c7955ce926456240b2ff0100bde", "กลุ่มอายุ 1 ปี", 11, 90, "", ""], // s_epi_complete
  ["71e49e4b61aafee17761601c506d5f85", "กลุ่มอายุ 2 ปี", 20, 90, "", ""], // s_epi2
  ["35f4a8d465e6e1edc05f3d8ab658c551", "กลุ่มอายุ 2 ปี", 21, 90, "", ""], // s_epi_complete
  ["267ce09f2a704eb7783997e25d1f18ba", "กลุ่มอายุ 3 ปี", 30, 90, "", ""], // s_epi3
  ["d1fe173d08e959397adf34b1d77e88d7", "กลุ่มอายุ 3 ปี", 31, 90, "", ""], // s_epi_complete
  ["c47283d3c2c1e6528ddcf88c254f21b3", "กลุ่มอายุ 5 ปี", 50, 90, "", ""], // s_epi5
  ["f033ab37c30201f73f142449d037028d", "กลุ่มอายุ 5 ปี", 51, 90, "", ""], // s_epi_complete
];

/**
 * setup=dc_seed (SCHEMA §3.6): write the admin columns of DC_SEED_REPORTS
 * into the hdc_reports row with the same opendata_id. No row is added and no
 * other column changes, so it can be re-run; a seed report with no row yet
 * (its topic not refreshed) is listed in not_found.
 *
 * Like setup=datacenter, it runs without the script lock (diag is not a lock
 * holder, SCHEMA §3). Run it after a refresh, not during one: both rewrite
 * hdc_reports, so one could undo the other.
 *
 * An error is logged to system_logs and rethrown, as in dcSetupDatacenter.
 */
function dcSetupSeed() {
  try {
    const table = dcReadTable(DC_HDC_REPORTS_SHEET, DC_HDC_REPORTS_HEADERS);
    const c = table.col;
    // Null prototype: an id such as "constructor" must not hit
    // Object.prototype.
    const rowById = Object.create(null);
    table.rows.forEach(function (row) {
      const id = sanitizeHdcId(row[c.opendata_id]);
      if (id && !rowById[id]) rowById[id] = row;
    });
    const notFound = [];
    DC_SEED_REPORTS.forEach(function (seed) {
      const id = seed[0];
      const row = rowById[id];
      if (!row) {
        notFound.push(id);
        return;
      }
      row[c.enabled] = true;
      row[c.report_type] = "coverage";
      row[c.subgroup] = seed[1];
      row[c.order] = seed[2];
      row[c.goal] = seed[3];
      row[c.col_target] = seed[4];
      row[c.col_result] = seed[5];
    });
    dcWriteTable(table, DC_CATALOG_TEXT_COLUMNS);
    return { applied: DC_SEED_REPORTS.length - notFound.length, not_found: notFound };
  } catch (e) {
    logToSheet("ERROR", "setup=dc_seed failed", String(e));
    throw e;
  }
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
      goal: dcGoal(row.goal),
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
 * GET ?action=catalog (SCHEMA §3.1): GasCatalog (SCHEMA §9), unsorted (the
 * prebuild script sorts it). The sheets it reads are read directly, with no
 * cache: only the build and the admin scripts call it, and a report ticked in
 * hdc_reports must show on the next call.
 *
 * The caller must hold the script lock (doGet), so no sheet is read while
 * saveTableYear rewrites it: this function never calls LockService
 * (SCHEMA §3). settings is the one the caller read before taking the lock.
 */
function dcGetCatalog(settings) {
  const window = getYearWindow(settings);
  return {
    meta: {
      current_year: settings.current_year,
      years: window,
      district_code: settings.district_code,
      generated_at: new Date().toISOString(),
    },
    areas: dcSheetRecords("tambon_master", ["id", "name_th", "district_id"]).filter(function (row) {
      return String(row.district_id).trim() === settings.district_code;
    }).map(function (row) {
      return { id: String(row.id).trim(), name_th: String(row.name_th) };
    }),
    hospitals: dcSheetRecords("hospitals", ["hospcode", "hospname", "tambon_id"]).map(function (row) {
      return {
        hospcode: String(row.hospcode).trim(),
        hospname: String(row.hospname),
        tambon_id: String(row.tambon_id).trim(),
      };
    }),
    topics: readHdcTopics(),
    reports: dcCatalogReports(window, dcReadSyncStatus()),
  };
}

/**
 * รายงานที่ใช้งาน as the catalog lists them (SCHEMA §3.1): readHdcReports()
 * with measure_goals from kpi_epi and years from the given sync_status rows
 * (dcReadSyncStatus) inside the window, oldest first. ?action=report answers
 * the same DcReport.
 */
function dcCatalogReports(window, status) {
  const goalRows = dcSheetRecords("kpi_epi", ["source_sheet", "value_prefix", "target"]);
  return readHdcReports().map(function (report) {
    // A kpi_epi target that is not a valid เกณฑ์ (blank included) is left
    // out, so the report's own goal applies to that รายการ (SCHEMA §3.1).
    // Null prototype: a value_prefix such as "__proto__" must not hit
    // Object.prototype.
    const goals = Object.create(null);
    goalRows.forEach(function (row) {
      const prefix = sanitizeToken(row.value_prefix);
      const goal = dcGoal(row.target);
      if (sanitizeToken(row.source_sheet) === report.source_table && prefix !== null && goal !== null) {
        goals[prefix] = goal;
      }
    });
    report.measure_goals = goals;
    // The window is oldest first, so the years are too.
    report.years = [];
    window.forEach(function (year) {
      const row = dcFindSyncStatus(status, report.source_table, year);
      if (row) {
        report.years.push({
          b_year: row.b_year,
          row_count: row.row_count,
          max_date_com: row.max_date_com,
          synced_at: row.synced_at.toISOString(),
        });
      }
    });
    return report;
  });
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
 * A เกณฑ์ cell (hdc_reports goal, kpi_epi target; SCHEMA §2.3, §3.1): a number
 * 0–100, else null (blank included).
 */
function dcGoal(v) {
  const goal = String(v).trim() === "" ? NaN : Number(v);
  return goal >= 0 && goal <= 100 ? goal : null;
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
