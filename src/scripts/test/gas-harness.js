// Loads the GAS project (dc-*.js + รหัส.js) into one node:vm context, the way
// Apps Script runs every file in a single global scope, with in-memory stubs
// for the Google services it touches. Not a test file: `npm test` only picks
// up *.test.js.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SCRIPTS_DIR = path.resolve(import.meta.dirname, "..");

// A new sheet in Google Sheets has 1000 rows; a sheet seeded by a test gets
// at least that many too, like a real sheet with blank rows below its data.
const DEFAULT_MAX_ROWS = 1000;

// dc-*.js load before รหัส.js, so a dc file that reads CONFIG (or anything
// else from รหัส.js) at top level fails here instead of only in Apps Script.
function gasFiles() {
  const dcFiles = fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => /^dc-.*\.js$/.test(f))
    .sort();
  return [...dcFiles, "รหัส.js"];
}

/**
 * One sheet: a grid of cell values plus a row count (getMaxRows) that can be
 * larger than the data, as in Sheets. Values are stored as given (no
 * string → number coercion).
 */
function fakeSheet(name, values) {
  let cells = values.map((row) => [...row]);
  let maxRows = Math.max(DEFAULT_MAX_ROWS, cells.length);

  const lastRow = () => {
    for (let r = cells.length; r > 0; r--) {
      if ((cells[r - 1] || []).some((v) => v !== "" && v != null)) return r;
    }
    return 0;
  };
  const lastColumn = () =>
    cells.reduce((max, row) => {
      for (let c = row.length; c > max; c--) {
        if (row[c - 1] !== "" && row[c - 1] != null) return c;
      }
      return max;
    }, 0);

  const range = (row, col, numRows = 1, numCols = 1) => {
    if (row < 1 || col < 1 || numRows < 1 || numCols < 1) {
      throw new Error(`${name}: invalid range (${row}, ${col}, ${numRows}, ${numCols})`);
    }
    // The Apps Script docs do not promise that a range past getMaxRows()
    // grows the sheet, so the stub refuses it: code must insertRowsAfter.
    if (row + numRows - 1 > maxRows) {
      throw new Error(`${name}: range rows ${row}..${row + numRows - 1} outside the sheet's ${maxRows} rows`);
    }
    const r = {
      getValues: () =>
        Array.from({ length: numRows }, (_, r) =>
          Array.from({ length: numCols }, (_, c) => {
            const v = (cells[row - 1 + r] || [])[col - 1 + c];
            return v == null ? "" : v;
          }),
        ),
      setValues: (matrix) => {
        if (matrix.length !== numRows || matrix.some((r) => r.length !== numCols)) {
          throw new Error(`${name}: setValues data does not match the range dimensions`);
        }
        matrix.forEach((r, i) => {
          const target = (cells[row - 1 + i] ||= []);
          r.forEach((v, j) => {
            target[col - 1 + j] = v;
          });
        });
        for (let i = 0; i < cells.length; i++) cells[i] ||= [];
        return r;
      },
      setNumberFormat: () => r,
      setFontWeight: () => r,
      // Apps Script: "Sets the value of all cells in the range to false."
      insertCheckboxes: () =>
        r.setValues(Array.from({ length: numRows }, () => Array.from({ length: numCols }, () => false))),
    };
    return r;
  };

  return {
    getDataRange: () => range(1, 1, Math.max(lastRow(), 1), Math.max(lastColumn(), 1)),
    getRange: range,
    getLastRow: lastRow,
    getLastColumn: lastColumn,
    getMaxRows: () => maxRows,
    clear: () => {
      cells = [];
    },
    appendRow: (row) => {
      cells[lastRow()] = [...row];
      for (let i = 0; i < cells.length; i++) cells[i] ||= [];
      maxRows = Math.max(maxRows, cells.length);
    },
    insertRowsAfter: (afterPosition, howMany) => {
      if (afterPosition < 1 || afterPosition > maxRows || howMany < 1) {
        throw new Error(`${name}: insertRowsAfter(${afterPosition}, ${howMany}) outside 1..${maxRows}`);
      }
      cells.splice(afterPosition, 0, ...Array.from({ length: howMany }, () => []));
      maxRows += howMany;
    },
    deleteRows: (start, howMany) => {
      if (start < 1 || howMany < 1 || start + howMany - 1 > maxRows) {
        throw new Error(`${name}: deleteRows(${start}, ${howMany}) outside 1..${maxRows}`);
      }
      if (howMany >= maxRows) throw new Error(`${name}: cannot delete every row`);
      cells.splice(start - 1, howMany);
      maxRows -= howMany;
    },
    setFrozenRows: () => {},
  };
}

/**
 * @param {{
 *   sheets?: Record<string, unknown[][]>,
 *   fetch?: (url: string, payload: any) => { code: number, body: unknown },
 * }} [options]
 *   sheets: sheet name → 2D array of cell values (row 1 = header).
 *   fetch: answers UrlFetchApp.fetch; gets the parsed JSON payload
 *     (undefined if the request has none), returns the status code and a
 *     body (JSON-encoded unless it is a string). It may throw, like a fetch
 *     that fails to connect.
 * @returns {{
 *   gas: any,
 *   logs: string[],
 *   lock: { tryLock: number, releaseLock: number, nested: number },
 *   fetches: { url: string, method: string | undefined, payload: any }[],
 *   properties: Map<string, string>,
 *   clock: { now: number },
 *   toasts: { message: string, title: string | undefined }[],
 *   menus: { name: string, items: { caption: string, functionName: string }[] }[],
 *   sheet: (name: string) => unknown[][] | null,
 *   maxRows: (name: string) => number | null,
 *   sheetNames: () => string[],
 *   reads: (name: string) => number,
 * }}
 *   gas: the GAS global scope (top-level functions are properties of it).
 *   logs: every Logger.log message, in order.
 *   lock: how many times the script lock was taken and released, and how
 *     many tryLock calls came while it was already held.
 *   fetches: every UrlFetchApp.fetch call, in order.
 *   properties: the script properties (PropertiesService) store.
 *   clock: the time `new Date()` and `Date.now()` return in GAS, in ms since
 *     the epoch; the real time at load until a test sets it.
 *   toasts: every Spreadsheet.toast, in order.
 *   menus: every menu added to the spreadsheet UI (onOpen).
 *   sheet: a sheet's current data range (null if the sheet does not exist).
 *   maxRows: a sheet's row count including blank rows below the data.
 *   reads: how many times the code looked a sheet up by name
 *     (getSheetByName), whether or not it exists.
 */
export function loadGas({ sheets = {}, fetch } = {}) {
  const logs = [];
  const cache = new Map();
  // nested: tryLock calls made while the lock was already held. Apps Script
  // does not say what that returns, and the inner releaseLock would drop the
  // outer holder's lock (SCHEMA §3), so tests expect 0.
  const lock = { tryLock: 0, releaseLock: 0, nested: 0 };
  let held = false;
  const fetches = [];
  const properties = new Map();
  const toasts = [];
  const menus = [];
  const clock = { now: Date.now() };
  class ClockDate extends Date {
    constructor(...args) {
      if (args.length) super(...args);
      else super(clock.now);
    }
    static now() {
      return clock.now;
    }
  }
  const reads = new Map();
  const book = new Map(Object.entries(sheets).map(([name, values]) => [name, fakeSheet(name, values)]));

  const spreadsheet = {
    getSheetByName: (name) => {
      reads.set(name, (reads.get(name) || 0) + 1);
      return book.get(name) || null;
    },
    insertSheet: (name) => {
      if (book.has(name)) throw new Error(`A sheet with the name "${name}" already exists`);
      const sheet = fakeSheet(name, []);
      book.set(name, sheet);
      return sheet;
    },
    toast: (message, title) => {
      toasts.push({ message: String(message), title });
    },
  };

  const ui = {
    createMenu: (name) => {
      const menu = { name, items: [] };
      const builder = {
        addItem: (caption, functionName) => {
          menu.items.push({ caption, functionName });
          return builder;
        },
        addSeparator: () => builder,
        addToUi: () => {
          menus.push(menu);
        },
      };
      return builder;
    },
  };

  const gas = vm.createContext({
    Logger: { log: (msg) => logs.push(String(msg)) },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, getUi: () => ui },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => (cache.has(key) ? cache.get(key) : null),
        put: (key, value) => cache.set(key, value),
        remove: (key) => cache.delete(key),
        removeAll: (keys) => keys.forEach((k) => cache.delete(k)),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          lock.tryLock++;
          if (held) lock.nested++;
          held = true;
          return true;
        },
        releaseLock: () => {
          lock.releaseLock++;
          held = false;
        },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => {
        const store = {
          // Apps Script: null if no such key exists.
          getProperty: (key) => (properties.has(key) ? properties.get(key) : null),
          setProperty: (key, value) => {
            properties.set(key, String(value));
            return store;
          },
          deleteProperty: (key) => {
            properties.delete(key);
            return store;
          },
          getKeys: () => [...properties.keys()],
        };
        return store;
      },
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        const payload = options.payload === undefined ? undefined : JSON.parse(options.payload);
        fetches.push({ url, method: options.method, payload });
        if (!fetch) throw new Error("UrlFetchApp.fetch called without a fetch stub");
        const { code, body } = fetch(url, payload);
        const text = typeof body === "string" ? body : JSON.stringify(body);
        return { getResponseCode: () => code, getContentText: () => text };
      },
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (content) => ({
        setMimeType() {
          return this;
        },
        getContent: () => content,
      }),
    },
    Utilities: {
      sleep: () => {},
      // Only the pattern the code uses; any other fails loudly instead of
      // being formatted wrong.
      formatDate: (date, timeZone, format) => {
        if (format !== "yyyy-MM-dd") throw new Error(`Utilities.formatDate stub: unsupported format ${format}`);
        // en-CA formats a date as YYYY-MM-DD.
        return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
      },
    },
    Date: ClockDate,
  });

  for (const file of gasFiles()) {
    const code = fs.readFileSync(path.join(SCRIPTS_DIR, file), "utf8");
    vm.runInContext(code, gas, { filename: file });
  }

  return {
    gas,
    logs,
    lock,
    fetches,
    properties,
    clock,
    toasts,
    menus,
    sheet: (name) => (book.has(name) ? book.get(name).getDataRange().getValues() : null),
    maxRows: (name) => (book.has(name) ? book.get(name).getMaxRows() : null),
    sheetNames: () => [...book.keys()],
    reads: (name) => reads.get(name) || 0,
  };
}
