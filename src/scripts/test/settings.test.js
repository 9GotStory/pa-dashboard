import assert from "node:assert/strict";
import test from "node:test";
import { loadGas } from "./gas-harness.js";

// The settings sheet as it is in production before F01 (read 30 Oct 2569):
// no new columns.
const SETTINGS_BEFORE_F01 = [
  ["current_quarter", "current_year", "province_code"],
  [4, 2569, 54],
];

function settingsSheet(extra) {
  const [header, values] = SETTINGS_BEFORE_F01;
  return [
    [...header, ...Object.keys(extra)],
    [...values, ...Object.values(extra)],
  ];
}

test("settings sheet without the new columns → district_code 5406, deploy_hook_url empty", () => {
  const { gas, logs } = loadGas({ sheets: { settings: SETTINGS_BEFORE_F01 } });

  const settings = gas.readSettings();

  assert.equal(settings.district_code, "5406");
  assert.equal(settings.deploy_hook_url, "");
  // readSettings catches its own errors and returns defaults, so "no error"
  // means nothing was logged.
  assert.deepEqual(logs, []);
});

test("district_code that is not 4 digits → default 5406 and a log line", () => {
  const { gas, logs } = loadGas({ sheets: { settings: settingsSheet({ district_code: 55 }) } });

  const settings = gas.readSettings();

  assert.equal(settings.district_code, "5406");
  assert.ok(
    logs.some((line) => line.includes("district_code has invalid value")),
    "expected a Logger.log line about district_code, got:\n" + logs.join("\n"),
  );
});

test("district_code of another province (5501) is accepted: no cross-field check", () => {
  const { gas } = loadGas({ sheets: { settings: settingsSheet({ district_code: 5501 }) } });

  assert.equal(gas.readSettings().district_code, "5501");
});

test("deploy_hook_url that is not a Cloudflare Deploy Hook → treated as empty", () => {
  const { gas, logs } = loadGas({
    sheets: { settings: settingsSheet({ deploy_hook_url: "https://example.com/hook" }) },
  });

  assert.equal(gas.readSettings().deploy_hook_url, "");
  assert.ok(
    logs.some((line) => line.includes("deploy_hook_url has invalid value")),
    "expected a Logger.log line about deploy_hook_url, got:\n" + logs.join("\n"),
  );
});

test("deploy_hook_url that is a Cloudflare Deploy Hook is kept", () => {
  const url = "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/5b1f0c2e-9a7d-4e1b";
  const { gas } = loadGas({ sheets: { settings: settingsSheet({ deploy_hook_url: url }) } });

  assert.equal(gas.readSettings().deploy_hook_url, url);
});

test("current_year 2569 → window is 2565…2569 as strings, oldest first", () => {
  const { gas } = loadGas({ sheets: { settings: SETTINGS_BEFORE_F01 } });

  const window = gas.getYearWindow(gas.readSettings());

  // Spread: arrays from the vm context have another realm's Array.prototype.
  assert.deepEqual([...window], ["2565", "2566", "2567", "2568", "2569"]);
});

test("sheetNameFor: current year → table name, other year → {table}_y{YYYY}", () => {
  const { gas } = loadGas({ sheets: { settings: SETTINGS_BEFORE_F01 } });
  const settings = gas.readSettings();

  assert.equal(gas.sheetNameFor("s_epi1", "2569", settings), "s_epi1");
  assert.equal(gas.sheetNameFor("s_epi1", "2567", settings), "s_epi1_y2567");
});

test("sheetNameFor without settings reads current_year from the settings sheet", () => {
  const { gas } = loadGas({
    sheets: {
      settings: [
        ["current_quarter", "current_year", "province_code"],
        [1, 2570, 54],
      ],
    },
  });

  assert.equal(gas.sheetNameFor("s_epi1", "2570"), "s_epi1");
  assert.equal(gas.sheetNameFor("s_epi1", "2569"), "s_epi1_y2569");
});

test("sheetNameFor compares the year as a string: a numeric cell value 2569 is still the current year", () => {
  const { gas } = loadGas({ sheets: { settings: SETTINGS_BEFORE_F01 } });
  const settings = gas.readSettings();

  assert.equal(gas.sheetNameFor("s_epi1", 2569, settings), "s_epi1");
  assert.equal(gas.sheetNameFor("s_epi1", 2567, settings), "s_epi1_y2567");
});
