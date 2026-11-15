// Opens the /sync page in next dev against the GAS of the test harness, so an
// upload can be tried in a browser without touching production (SPEC §12.1).
// next dev gets the harness's URL and a throwaway PIN through process.env,
// which beats .env.local (Next.js docs, Environment Variable Load Order). The
// sheets live in memory and start afresh on every run, and with no
// deploy_hook_url a rebuild only answers "Deploy hook not configured".
// Usage: npm run dc:sync-local [-- <port>]   (default 3217)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PA_SHEETS } from "./test/fixtures/batch-all-sheets.js";
import { loadGas, startGas } from "./test/gas-harness.js";

const port = process.argv[2] ?? "3217";
// The PIN field of /sync takes 4 characters.
const PIN = "4321";

// /sync reads district_code from the site's own catalog.json (SPEC §12.1).
if (!fs.existsSync(path.resolve("public/data/catalog.json"))) {
  console.error("dc-sync-local: public/data/catalog.json is missing: run npm run snapshot first");
  process.exit(1);
}

// s_kpi_anc12 has a data date in 2569 (the current year) and in 2568, so
// picking a year on /sync changes its date, and any other year shows that
// sync_status has no row of it (SPEC §12.1).
const SYNC_STATUS = [
  ["table", "b_year", "sheet", "row_count", "max_date_com", "synced_at"],
  ["s_kpi_anc12", "2569", "s_kpi_anc12", 3, "202610290915", new Date("2026-10-29T03:00:00Z")],
  ["s_kpi_anc12", "2568", "s_kpi_anc12_y2568", 3, "202509301200", new Date("2025-10-01T03:00:00Z")],
];

const sheets = { ...PA_SHEETS, sync_status: SYNC_STATUS };
const { url } = await startGas(null, loadGas({ sheets }), ({ action, kind, yymm }) => {
  console.log(`dc-sync-local: POST ${[action, kind, yymm].filter(Boolean).join(" ")}`);
});
console.log(
  `dc-sync-local: open http://localhost:${port}/sync with PIN ${PIN}; GAS harness at ${url}; Ctrl-C or kill ${process.pid} stops both`,
);

const next = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "dev", "-p", port], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_GAS_SCRIPT_URL: url, NEXT_PUBLIC_SYNC_PIN_CODE: PIN },
});
// Ctrl-C in a terminal reaches next dev by itself; a signal sent to this
// process alone does not. Either way this process ends when next dev has.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => next.kill(signal));
next.on("exit", (code) => process.exit(code ?? 1));
// An exception in the harness ends this process without a signal.
process.on("exit", () => next.kill());
