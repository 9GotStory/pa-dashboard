// Call the live GAS diag endpoint (handleDiag in รหัส.js) and print its
// answer. setup=… and run=sync write to production, so the user runs those
// (docs/agents/gas-deploy.md); without them it only reads (triggers, the MOPH
// probe, recent system_logs).
//
// Usage: npm run gas:diag -- [key=value ...]   e.g. setup=dc_seed, logs=30
// Env (.env.local): NEXT_PUBLIC_GAS_SCRIPT_URL, DIAG_PIN.
// Exits 1 when the call fails or any setup result is an error, so a failed
// setup is never silent.

const url = process.env.NEXT_PUBLIC_GAS_SCRIPT_URL;
const pin = process.env.DIAG_PIN;
if (!url || !pin) {
  console.error("gas-diag: set NEXT_PUBLIC_GAS_SCRIPT_URL and DIAG_PIN in .env.local (docs/agents/gas-deploy.md)");
  process.exit(1);
}
const params = new URLSearchParams({ action: "diag", pin });
for (const arg of process.argv.slice(2)) {
  const eq = arg.indexOf("=");
  if (eq < 1) {
    console.error(`gas-diag: expected key=value, got "${arg}"`);
    process.exit(1);
  }
  params.set(arg.slice(0, eq), arg.slice(eq + 1));
}

let res;
try {
  res = await fetch(`${url}?${params}`);
} catch (err) {
  // The message leaves the URL out: it carries the PIN.
  console.error(`gas-diag: request failed: ${err.cause?.code || err.message}`);
  process.exit(1);
}
const body = await res.text();
let out;
try {
  out = JSON.parse(body);
} catch {
  console.error(`gas-diag: HTTP ${res.status}, not JSON:\n${body.slice(0, 600)}`);
  process.exit(1);
}
if (out.status === "error") {
  console.error(`gas-diag: ${out.message}`);
  process.exit(1);
}

// What handleDiag returns for setup=…, setup=drop_rows and run=sync: a
// result, or "error: …" ({ ok: false } for run=sync) when it threw.
const results = Object.keys(out).filter((key) => key.startsWith("setup") || key === "dropRows" || key === "forcedSync");
if (results.length === 0) {
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
let failed = false;
for (const key of results) {
  const value = out[key];
  if ((typeof value === "string" && value.startsWith("error:")) || value?.ok === false) failed = true;
  console.log(`${key}: ${JSON.stringify(value)}`);
}
process.exit(failed ? 1 : 0);
