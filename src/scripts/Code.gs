/**
 * MOPH Data Sync Script
 * Syncs specific KPIs from MOPH Open Data API to Google Sheets
 */

const CONFIG = {
  YEAR: "2569",
  PROVINCE: "54", // Phrae
  API_URL: "https://opendata.moph.go.th/api/report_data",
  KPIS: [
    { table: "s_kpi_anc12", sheet: "s_kpi_anc12" }, // 1
    { table: "s_anc5", sheet: "s_anc5" }, // 2
    { table: "s_kpi_food", sheet: "s_kpi_food" }, // 3
    { table: "s_childdev_specialpp", sheet: "s_childdev_specialpp" }, // 4
    { table: "s_kpi_childdev2", sheet: "s_kpi_childdev2" }, // 5
    { table: "s_aged9", sheet: "s_aged9" }, // 6
    { table: "s_dm_screen", sheet: "s_dm_screen" }, // 7
    { table: "s_ht_screen", sheet: "s_ht_screen" }, // 8
    { table: "s_ncd_screen_repleate1", sheet: "s_ncd_screen_repleate1" }, // 9
    { table: "s_ncd_screen_repleate2", sheet: "s_ncd_screen_repleate2" }, // 10
    { table: "s_dental_0_5_cavity_free", sheet: "s_dental_0_5_cavity_free" }, // 11
    { table: "s_kpi_dental28", sheet: "s_kpi_dental28" }, // 12
    { table: "s_kpi_dental33", sheet: "s_kpi_dental33" }, // 13
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
    // 1. Fetch Data
    const response = UrlFetchApp.fetch(CONFIG.API_URL, options);
    const responseCode = response.getResponseCode();

    // Check HTTP Status
    // Check HTTP Status (Allow 200 OK and 201 Created)
    if (responseCode !== 200 && responseCode !== 201) {
      Logger.log(
        "Error: API returned status " + responseCode + " for " + tableName,
      );
      return; // ABORT: Do not touch sheet
    }

    const jsonText = response.getContentText();
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (parseErr) {
      Logger.log("Error: Invalid JSON for " + tableName);
      return; // ABORT
    }

    // 2. Validate Data Structure
    if (!Array.isArray(data)) {
      Logger.log("Error: API response is not an array for " + tableName);
      return; // ABORT
    }

    if (data.length === 0) {
      Logger.log(
        "Warning: API returned 0 records for " +
          tableName +
          ". Keeping old data.",
      );
      return; // ABORT: Safety choice - if API returns empty, better to show old data than blank?
      // Or strictly user might WANT to see empty if it's truly empty?
      // User request implies "prevention of lost data if fetch fails".
      // Returning 0 records is techincally a successful fetch, but suspicious for MOPH data.
      // Let's assume 0 records means 'something is wrong' for now to be safe.
    }

    // Check first item for integrity
    const firstItem = data[0];
    if (
      typeof firstItem !== "object" ||
      firstItem === null ||
      Object.keys(firstItem).length === 0
    ) {
      Logger.log("Error: Invalid record format for " + tableName);
      return; // ABORT
    }

    // 3. Prepare Data in Memory (Formatting)
    // Prepare Headers
    const headers = Object.keys(firstItem);

    // Force Text Format for ID columns
    const textColumns = ["id", "hospcode", "areacode", "vhid"];

    const rowsFormatted = data.map((item) =>
      headers.map((key) => {
        const val = item[key];
        // Convert ID-like columns to string explicitly to prevent scientific notation in CSV/Excel later
        if (textColumns.includes(key)) {
          return val !== null && val !== undefined ? String(val) : "";
        }
        return val || "";
      }),
    );

    // 4. Write to Sheet (Critical Section)
    // Only reach here if everything above succeeded
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // Clear content but preserve formatting if possible, actually clear() is safest for clean slate
    sheet.clear();

    // Write Headers
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Set Text Formatting for ID columns
    textColumns.forEach((colName) => {
      const colIndex = headers.indexOf(colName);
      if (colIndex > -1) {
        // Apply text format to the entire column range that will be written
        sheet
          .getRange(2, colIndex + 1, Math.max(rowsFormatted.length, 1), 1)
          .setNumberFormat("@");
      }
    });

    // Write Data
    if (rowsFormatted.length > 0) {
      sheet
        .getRange(2, 1, rowsFormatted.length, headers.length)
        .setValues(rowsFormatted);
    }

    // Add Timestamp to indicate successful sync
    sheet
      .getRange(1, headers.length + 2)
      .setValue("Last Updated: " + new Date());

    Logger.log(
      "Success: Synced " + rowsFormatted.length + " rows for " + tableName,
    );
  } catch (e) {
    Logger.log("Critical Error syncing " + tableName + ": " + e.toString());
    // Do nothing else - sheet remains untouched
  }
}

/**
 * API Endpoint (doGet)
 * Serves data from Sheets as JSON
 * Usage: <SCRIPT_URL>?sheet=s_kpi_anc12
 */
function doGet(e) {
  const sheetName = e.parameter.sheet;

  if (!sheetName) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: 'Missing "sheet" parameter',
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: "Sheet not found: " + sheetName,
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(
      ContentService.MimeType.JSON,
    );
  }

  const headers = data[0];
  const rows = data.slice(1);

  const json = rows.map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      // Handle potential duplicate headers or empty headers by appending index
      const key = header ? header.toString() : "col_" + index;
      obj[key] = row[index];
    });
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(json)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/**
 * Setup Trigger:
 * Run this function once manually to set up the daily trigger.
 */
function createDailyTrigger() {
  ScriptApp.newTrigger("syncAllData")
    .timeBased()
    .everyDays(1)
    .atHour(14) // Run at 2 PM (After 12:51 PM update)
    .create();
}
