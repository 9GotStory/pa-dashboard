/**
 * MOPH Data Sync Script
 * 1. Syncs data from MOPH API to Google Sheets
 * 2. Serve Optimized JSON for Frontend (Calculated Values)
 */

const CONFIG = {
  YEAR: "2569",
  PROVINCE: "54", // Phrae
  API_URL: "https://opendata.moph.go.th/api/report_data",
  KPIS: [
    { table: "s_kpi_anc12", sheet: "s_kpi_anc12" },
    { table: "s_anc5", sheet: "s_anc5" },
    { table: "s_kpi_food", sheet: "s_kpi_food" },
    { table: "s_childdev_specialpp", sheet: "s_childdev_specialpp" },
    { table: "s_kpi_childdev2", sheet: "s_kpi_childdev2" },
    { table: "s_aged9", sheet: "s_aged9" },
    { table: "s_dm_screen", sheet: "s_dm_screen" },
    { table: "s_ht_screen", sheet: "s_ht_screen" },
    { table: "s_ncd_screen_repleate1", sheet: "s_ncd_screen_repleate1" },
    { table: "s_ncd_screen_repleate2", sheet: "s_ncd_screen_repleate2" },
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
      return;
    }

    const jsonText = response.getContentText();
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (parseErr) {
      Logger.log("Error: Invalid JSON for " + tableName);
      return;
    }

    if (!Array.isArray(data)) {
      Logger.log("Error: API response is not an array for " + tableName);
      return;
    }

    if (data.length === 0) {
      Logger.log(
        "Warning: API returned 0 records for " +
          tableName +
          ". Keeping old data.",
      );
      return;
    }

    const firstItem = data[0];
    if (
      typeof firstItem !== "object" ||
      firstItem === null ||
      Object.keys(firstItem).length === 0
    ) {
      Logger.log("Error: Invalid record format for " + tableName);
      return;
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

    sheet
      .getRange(1, headers.length + 2)
      .setValue("Last Updated: " + new Date());
    Logger.log(
      "Success: Synced " + rowsFormatted.length + " rows for " + tableName,
    );
  } catch (e) {
    Logger.log("Critical Error syncing " + tableName + ": " + e.toString());
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
    return createJsonOutput(result);
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

  // 2. Child Development Special (Multi-Age Sum)
  if (tableName === "s_childdev_specialpp") {
    const ages = ["9", "18", "30", "42", "60"];
    ages.forEach(function (age) {
      t += Number(item["result_" + age] || 0); // Denom: Screened
      r += Number(item["1b260_1_" + age] || 0); // Num: Normal 1
      r += Number(item["1b260_2_" + age] || 0); // Num: Normal 2
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

  if (tMain > 0) {
    t = tMain;
    r = rMain > 0 ? rMain : getQuarterSum(item, "result");
    if (r === 0 && rMain > 0) r = rMain; // Fallback
  } else {
    // Sum quarters
    t = getQuarterSum(item, "target");
    r = getQuarterSum(item, "result");
  }

  return { t: t, r: r };
}

function getQuarterSum(item, prefix) {
  let sum = 0;
  for (let i = 1; i <= 4; i++) {
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
