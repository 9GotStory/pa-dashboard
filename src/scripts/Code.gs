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

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("PA Dashboard")
    .addItem("Sync All Data Now", "syncAllData")
    .addToUi();
}

function syncAllData() {
  CONFIG.KPIS.forEach((kpi) => {
    fetchAndSave(kpi.table, kpi.sheet);
  });
  SpreadsheetApp.getActive().toast("Sync Completed!", "Success");
}

function testConnection() {
  const tableName = "s_kpi_anc12";
  Logger.log("Testing connection to: " + CONFIG.API_URL);

  const payload = {
    tableName: tableName,
    year: CONFIG.YEAR,
    province: CONFIG.PROVINCE,
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
}

function testChildDevCalculation() {
  // Sample Data from API (s_kpi_childdev4)
  const sampleItem = {
    target1: 23,
    result1: 3,
    target2: 28,
    result2: 0,
    target3: 16,
    result3: 0,
    target4: 24,
    result4: 0,
  };

  Logger.log("Testing Calculation Logic for s_kpi_childdev4...");
  const result = calculateKPIOnServer(sampleItem, "s_kpi_childdev4");
  Logger.log("Input: " + JSON.stringify(sampleItem));
  Logger.log("Calculated Output: " + JSON.stringify(result));

  // Expected: Q1(23)+Q2(28) = 51. Result: Q1(3)+Q2(0) = 3.
  if (result.t === 51 && result.r === 3) {
    Logger.log("✅ Logic is CORRECT (Q1+Q2 Only)");
  } else {
    Logger.log("❌ Logic is WRONG. Expected t=51, r=3. Got t=" + result.t);
  }
}

function logKPIStructures() {
  Logger.log("🔍 INSPECTING KPI COLUMNS...");
  CONFIG.KPIS.forEach((kpi) => {
    try {
      const payload = {
        tableName: kpi.table,
        year: CONFIG.YEAR,
        province: CONFIG.PROVINCE,
        type: "json",
      };
      const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      };
      const res = UrlFetchApp.fetch(CONFIG.API_URL, options);
      const data = JSON.parse(res.getContentText());

      if (Array.isArray(data) && data.length > 0) {
        const keys = Object.keys(data[0]);
        // Check for relevant columns
        const hasTargetAnnual = keys.includes("target");
        const hasQuarterly = keys.some(
          (k) => k.startsWith("target1") || k.includes("result1"),
        );

        let status = "❓ Unknown";
        if (hasTargetAnnual && !hasQuarterly) status = "📅 ANNUAL Only";
        if (!hasTargetAnnual && hasQuarterly) status = "📊 QUARTERLY Only";
        if (hasTargetAnnual && hasQuarterly) status = "⚠️ HYBRID (Has both)";

        Logger.log(
          `[${kpi.table}] -> ${status} | Keys: ${keys.slice(0, 10).join(", ")}...`,
        );
      } else {
        Logger.log(`[${kpi.table}] -> ❌ No Data or Error`);
      }
    } catch (e) {
      Logger.log(`[${kpi.table}] -> ❌ Exception: ${e.message}`);
    }
  });
  Logger.log("✅ Inspection Complete");
}

function fetchAndSave(tableName, sheetName) {
  const payload = {
    tableName: tableName,
    year: CONFIG.YEAR,
    province: CONFIG.PROVINCE,
    type: "json",
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.API_URL, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200 && responseCode !== 201) {
      Logger.log(
        "Error: API returned status " + responseCode + " for " + tableName,
      );
      logToSheet("ERROR", `API Error ${tableName}`, `Status: ${responseCode}`);
      return;
    }

    const jsonText = response.getContentText();
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (parseErr) {
      Logger.log("Error: Invalid JSON for " + tableName);
      logToSheet(
        "ERROR",
        `Start JSON Parse Error ${tableName}`,
        "Invalid JSON format",
      );
      return;
    }

    saveDataToSheet(tableName, data, sheetName);
  } catch (e) {
    const errorMsg = e.toString();
    Logger.log("Critical Error syncing " + tableName + ": " + errorMsg);
    logToSheet("ERROR", `Failed ${tableName}`, errorMsg);
  }
}

function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents);
    const action = json.action;

    if (action === "save_kpi_data") {
      const { tableName, data } = json;
      // Resolve sheetName from CONFIG if not provided
      let sheetName = json.sheetName;
      if (!sheetName) {
        const kpi = CONFIG.KPIS.find((k) => k.table === tableName);
        if (kpi) sheetName = kpi.sheet;
      }

      if (!sheetName) {
        logToSheet(
          "ERROR",
          `Start Sync Error ${tableName}`,
          "Unknown Sheet Name",
        );
        return createJsonError("Unknown sheet for table: " + tableName);
      }

      const success = saveDataToSheet(tableName, data, sheetName);
      if (success) {
        return createJsonOutput({ status: "success", count: data.length });
      } else {
        return createJsonError(
          "Failed to save data. Check system_logs for details.",
        );
      }
    }

    return createJsonError("Unknown action: " + action);
  } catch (e) {
    logToSheet("ERROR", "doPost Critical", e.toString());
    return createJsonError(e.toString());
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

  sheet.getRange(1, headers.length + 2).setValue("Last Updated: " + new Date());

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

/**
 * OPTIMIZED API Endpoint
 * Calculates KPI values on server-side and returns only minimal data.
 * SUPPORTS: Single sheet fetch OR 'BATCH_ALL' for everything.
 */
function doGet(e) {
  const sheetName = e.parameter.sheet;

  // 0. Safety Check
  if (!sheetName) return createJsonError('Missing "sheet" parameter');

  // 1. BATCH MODE (Turbo)
  if (sheetName === "BATCH_ALL") {
    const result = {};
    CONFIG.KPIS.forEach((kpi) => {
      const rows = getProcessedDataForSheet(kpi.sheet);
      result[kpi.table] = rows;
    });

    // Wrap with Metadata
    const response = {
      data: result,
      meta: {
        current_quarter: CONFIG.CURRENT_QUARTER,
        kpi_config: CONFIG.KPIS,
      },
    };
    return createJsonOutput(response);
  }

  // 2. Handle Master Sheets (Pass-through)
  if (["hospitals", "tambon_master", "kpi_master"].includes(sheetName)) {
    return serveRawSheet(sheetName);
  }

  // 3. Single Sheet Mode (Backward Compatible)
  const rows = getProcessedDataForSheet(sheetName);
  return createJsonOutput(rows);
}

// Helper: Get Processed Data for a single sheet
function getProcessedDataForSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

    const values = calculateKPIOnServer(item, sheetName);

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
function calculateKPIOnServer(item, tableName) {
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

  // Check if forced Quarterly by Config
  const kpiConfig = CONFIG.KPIS.find((k) => k.table === tableName);
  const forceQuarterly = kpiConfig ? kpiConfig.isQuarterly : false;

  if (tMain > 0 && !forceQuarterly) {
    t = tMain;
    r = rMain > 0 ? rMain : getQuarterSum(item, "result");
    if (r === 0 && rMain > 0) r = rMain; // Fallback
  } else {
    // Sum quarters (If Force Quarterly OR No Annual Target)
    t = getQuarterSum(item, "target");
    r = getQuarterSum(item, "result");
  }

  return { t: t, r: r };
}

function getQuarterSum(item, prefix) {
  let sum = 0;
  // Use CONFIG.CURRENT_QUARTER to limit the sum
  for (let i = 1; i <= CONFIG.CURRENT_QUARTER; i++) {
    // Try various patterns: target1, targetq1, target1q1
    const v1 = item[prefix + i];
    const v2 = item[prefix + "q" + i];
    const v3 = item[prefix + "1q" + i];
    sum += Number(v1 || v2 || v3 || 0);
  }
  return sum;
}

function createDailyTrigger() {
  ScriptApp.newTrigger("syncAllData")
    .timeBased()
    .everyDays(1)
    .atHour(14)
    .create();
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
