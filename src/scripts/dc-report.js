/**
 * Data Center: one report's raw rows by year (SCHEMA §3.2).
 *
 * Shares the Apps Script global scope with รหัส.js, dc-storage.js and
 * dc-catalog.js. Read those only inside functions, never at top level: file
 * load order is not guaranteed.
 */

/**
 * GET ?action=report&id= (SCHEMA §3.2): GasReport (SCHEMA §9), the report as
 * ?action=catalog lists it plus one block ปี per year of its years, oldest
 * first. A block is read from the sheet sync_status names: its header, the
 * district's rows kept to the report's id (every one if the sheet has no id
 * column), their latest date_com ("" if none), and for the prebuild script's
 * check sheet_rows (the district's rows before the id filter) and
 * expected_rows (sync_status.row_count). No cache: only the build calls it.
 *
 * The caller must hold the script lock (doGet), so no sheet is read while
 * saveTableYear rewrites it: this function never calls LockService
 * (SCHEMA §3). settings is the one the caller read before taking the lock.
 *
 * Returns the GasReport or { status: "error", message }: Unknown report for
 * an id that is not a รายงานที่ใช้งาน, Shared table without id column when a
 * sheet cannot tell the table's รายงานที่ใช้งาน apart.
 */
function dcGetReport(idRaw, settings) {
  const id = sanitizeHdcId(idRaw);
  const status = dcReadSyncStatus();
  const reports = dcCatalogReports(getYearWindow(settings), status);
  const report = reports.filter(function (r) {
    return r.opendata_id === id;
  })[0];
  if (!report) return { status: "error", message: "Unknown report" };
  // Without an id column, a sheet's rows cannot be told apart by report.
  const shared = reports.filter(function (r) {
    return r.source_table === report.source_table;
  }).length > 1;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const years = [];
  // report.years is oldest first, so the blocks are too.
  for (let i = 0; i < report.years.length; i++) {
    const year = report.years[i];
    const sheetName = dcFindSyncStatus(status, report.source_table, year.b_year).sheet;
    const sheet = ss.getSheetByName(sheetName);
    // A sheet deleted by hand: the year is left out, and system_logs tells
    // the admin, since only report.years still shows it.
    if (!sheet) {
      logToSheet("WARNING", "Report year skipped " + report.source_table + " " + year.b_year,
        "sheet " + sheetName + " not found (report " + id + ")");
      continue;
    }
    const values = sheet.getDataRange().getValues();
    const names = values[0].map(dcHeaderName);
    const iArea = names.indexOf("areacode");
    const iId = names.indexOf("id");
    const iDate = names.indexOf("date_com");
    if (iId === -1 && shared) return { status: "error", message: "Shared table without id column" };
    const inDistrict = values.slice(1).filter(function (row) {
      return iArea > -1 && dcInDistrict(row[iArea], settings);
    });
    // Exact id, case kept, whatever the number of reports on the table: an
    // id that does not match the catalog shows as 0 rows rather than mixing
    // in another report's rows.
    const rows = iId === -1 ? inDistrict : inDistrict.filter(function (row) {
      return String(row[iId]) === id;
    });
    years.push({
      b_year: year.b_year,
      headers: values[0].map(String),
      rows: rows,
      max_date_com: dcMaxDateCom(rows.map(function (row) {
        return iDate > -1 ? row[iDate] : "";
      })),
      sheet_rows: inDistrict.length,
      expected_rows: year.row_count,
    });
  }
  return { report: report, years: years };
}
