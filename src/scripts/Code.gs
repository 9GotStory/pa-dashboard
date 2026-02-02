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
    { table: "s_kpi_child_specialpp", sheet: "s_kpi_child_specialpp" }, // 4
    { table: "s_kpi_childdev2", sheet: "s_kpi_childdev2" }, // 5
    { table: "s_aged9", sheet: "s_aged9" }, // 6
    { table: "s_dm_screen", sheet: "s_dm_screen" }, // 7
    { table: "s_ht_screen", sheet: "s_ht_screen" }, // 8
    { table: "s_ncd_screen_repleate1", sheet: "s_ncd_screen_repleate1" }, // 9
    { table: "s_ncd_screen_repleate2", sheet: "s_ncd_screen_repleate2" }, // 10
    { table: "s_dental_0_5_cavity_free", sheet: "s_dental_0_5_cavity_free" }, // 11
    { table: "s_kpi_dental28", sheet: "s_kpi_dental28" }, // 12
    { table: "s_dental_65", sheet: "s_dental_65" }, // 13
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
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.API_URL, options);
    const data = JSON.parse(response.getContentText());

    if (!Array.isArray(data) || data.length === 0) {
      Logger.log("No data found for " + tableName);
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // Prepare Headers from first object keys
    // Ensure 'hospcode', 'areacode', 'target', 'result' etc. are present
    const headers = Object.keys(data[0]);

    // Clear old data
    sheet.clear();

    // Write Headers
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Force Text Format for ID columns BEFORE writing data
    const textColumns = ["id", "hospcode", "areacode"];
    textColumns.forEach((colName) => {
      const colIndex = headers.indexOf(colName);
      if (colIndex > -1) {
        // +1 because Sheet columns are 1-based, and +1 for header row (start at row 2)
        sheet
          .getRange(2, colIndex + 1, Math.max(data.length, 1), 1)
          .setNumberFormat("@");
      }
    });

    // Write Data with explicit string conversion for text columns
    const rowsFormatted = data.map((item) =>
      headers.map((key) => {
        const val = item[key];
        if (textColumns.includes(key)) {
          return val !== null && val !== undefined ? String(val) : "";
        }
        return val || "";
      }),
    );

    // Batch write
    if (rowsFormatted.length > 0) {
      sheet
        .getRange(2, 1, rowsFormatted.length, headers.length)
        .setValues(rowsFormatted);
    }

    // Add Timestamp
    sheet
      .getRange(1, headers.length + 2)
      .setValue("Last Updated: " + new Date());
  } catch (e) {
    Logger.log("Error syncing " + tableName + ": " + e.toString());
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
    .atHour(6) // Run at 6 AM
    .create();
}
