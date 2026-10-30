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
