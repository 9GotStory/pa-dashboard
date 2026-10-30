// Loads the GAS project (dc-*.js + รหัส.js) into one node:vm context, the way
// Apps Script runs every file in a single global scope, with in-memory stubs
// for the Google services it touches. Not a test file: `npm test` only picks
// up *.test.js.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SCRIPTS_DIR = path.resolve(import.meta.dirname, "..");

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
 * @param {{ sheets?: Record<string, unknown[][]> }} [options]
 *   sheets: sheet name → 2D array of cell values (row 1 = header).
 * @returns {{ gas: any, logs: string[] }}
 *   gas: the GAS global scope (top-level functions are properties of it).
 *   logs: every Logger.log message, in order.
 */
export function loadGas({ sheets = {} } = {}) {
  const logs = [];
  const cache = new Map();

  const gas = vm.createContext({
    Logger: { log: (msg) => logs.push(String(msg)) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => {
          if (!(name in sheets)) return null;
          return {
            getDataRange: () => ({
              getValues: () => sheets[name].map((row) => [...row]),
            }),
          };
        },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => (cache.has(key) ? cache.get(key) : null),
        put: (key, value) => cache.set(key, value),
        removeAll: (keys) => keys.forEach((k) => cache.delete(k)),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
    },
  });

  for (const file of gasFiles()) {
    const code = fs.readFileSync(path.join(SCRIPTS_DIR, file), "utf8");
    vm.runInContext(code, gas, { filename: file });
  }
  return { gas, logs };
}
