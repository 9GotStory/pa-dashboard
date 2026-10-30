// Find and refresh HDC catalog topics from a catalog export (SCHEMA §5.5):
// the file tools/hdc-catalog-export.js downloads in the browser. The catalog
// API answers 403 to scripts, so this script never calls MOPH (ADR-0010).
//
//   node src/scripts/hdc-catalog.js find --from <file> <table> [...]
//     the topic and report of each source table, from the file alone
//   node src/scripts/hdc-catalog.js refresh --from <file> [--cat <cat_id>]
//     save_catalog for each topic of hdc_topics (or the one given) from the
//     file; needs NEXT_PUBLIC_GAS_SCRIPT_URL, with no fallback (SPEC §12.3)

// Not require(), which lint forbids, nor import, which makes node warn that
// this .js file is not a module (package.json has no "type").
const fs = process.getBuiltinModule("node:fs");
const { parseArgs } = process.getBuiltinModule("node:util");

const USAGE =
  "usage: node src/scripts/hdc-catalog.js find --from <file> <table> [...]\n" +
  "       node src/scripts/hdc-catalog.js refresh --from <file> [--cat <cat_id>]";

function fail(message) {
  console.error(`hdc-catalog: ${message}`);
  process.exit(1);
}

// The catalog export in file, checked before anything is sent (SCHEMA §5.5).
function readExport(file) {
  if (!file) fail(`--from <file> is missing\n${USAGE}`);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    fail(`cannot read ${file}: ${err.message}`);
  }
  let exported = null;
  try {
    exported = JSON.parse(text);
  } catch {
    // Not JSON: refused below like any other file without exported_at.
  }
  const reports = exported?.reports;
  if (!exported?.exported_at || !reports || typeof reports !== "object" || Array.isArray(reports)) {
    fail(
      `${file} is not a catalog export (no exported_at or reports, SCHEMA §5.5); ` +
        "export one with tools/hdc-catalog-export.js",
    );
  }
  return exported;
}

// A name from HDC the way save_catalog writes it to the sheet (dcCleanName
// in dc-catalog.js), which also keeps tabs and line breaks out of find's
// tab-separated lines.
function cleanName(v) {
  return String(v || "").replace(/<\/?[A-Za-z][^<>]*>/g, "").replace(/\s+/g, " ").trim();
}

// One tab-separated line per report of each table, under a header row. The
// API can list a report twice in a topic: the first row is the one
// save_catalog keeps (SCHEMA §3.4 step 4).
function find(file, tables) {
  const exported = readExport(file);
  console.log(["source_table", "cat_id", "category_name", "opendata_id", "report_name"].join("\t"));
  const missing = [];
  for (const table of tables) {
    const printed = new Set();
    for (const [catId, reports] of Object.entries(exported.reports)) {
      for (const r of reports) {
        if (r.source_table !== table || printed.has(catId + " " + r.opendata_id)) continue;
        printed.add(catId + " " + r.opendata_id);
        console.log([table, catId, cleanName(r.category_name), r.opendata_id, cleanName(r.report_name)].join("\t"));
      }
    }
    if (printed.size === 0) missing.push(table);
  }
  // Even a table found may also be in a topic that failed, so always say so.
  const failed = (exported.errors || []).map((e) => `${e.cat_id} (status ${e.status})`);
  if (failed.length > 0) {
    console.error(
      `hdc-catalog: the export failed to get ${failed.join(", ")}, so these topics were not searched; ` +
        "run tools/hdc-catalog-export.js again",
    );
  }
  if (missing.length > 0) {
    console.error(`hdc-catalog: in no topic of ${file}: ${missing.join(", ")}; check the source_table names`);
    process.exitCode = 1;
  }
}

// A GAS web app call: its JSON answer. Throws the reason when GAS cannot be
// reached, answers something other than JSON or answers an error.
async function callGas(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new Error(`cannot reach GAS (${err.cause?.code || err.message}); check NEXT_PUBLIC_GAS_SCRIPT_URL`);
  }
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      `GAS answered HTTP ${res.status}, not JSON; check NEXT_PUBLIC_GAS_SCRIPT_URL is the web app's /exec URL: ` +
        text.slice(0, 200),
    );
  }
  if (body.status === "error") {
    // Busy: another run held the script lock past GAS's wait (SCHEMA §3).
    const hint = body.message === "Busy" ? "; another run holds the script lock, try again in a minute" : "";
    throw new Error(`GAS answered: ${body.message}${hint}`);
  }
  return body;
}

// save_catalog for each topic of hdc_topics, top row first: the first topic
// to save a report keeps it (SPEC §5.3). catId: only that topic.
async function refresh(file, catId) {
  const url = process.env.NEXT_PUBLIC_GAS_SCRIPT_URL;
  if (!url) {
    fail(
      "refresh needs NEXT_PUBLIC_GAS_SCRIPT_URL (the GAS web app URL), e.g. " +
        "node --env-file=.env.local src/scripts/hdc-catalog.js refresh --from <file>",
    );
  }
  const exported = readExport(file);
  const topicNames = new Map((exported.categories || []).map((c) => [c.cat_id, c.category_name]));
  const failedToGet = new Map((exported.errors || []).map((e) => [e.cat_id, e.status]));
  let topics;
  try {
    ({ topics } = await callGas(`${url}?action=catalog`));
  } catch (err) {
    fail(`cannot read hdc_topics (?action=catalog): ${err.message}`);
  }
  if (!Array.isArray(topics)) {
    fail(
      "cannot read hdc_topics (?action=catalog): GAS answered with no topics; " +
        "check NEXT_PUBLIC_GAS_SCRIPT_URL is this project's web app",
    );
  }
  if (catId) topics = topics.filter((topic) => topic.cat_id === catId);
  if (topics.length === 0) {
    fail(
      `${catId ? `${catId} is not in hdc_topics` : "hdc_topics has no topics"}; ` +
        "type the cat_id and order of each topic into it first (SPEC §13 step 3)",
    );
  }
  console.log(`Catalog export of ${exported.exported_at}, ${topics.length} topics in hdc_topics`);
  let notRefreshed = 0;
  for (const [i, topic] of topics.entries()) {
    const name = topicNames.get(topic.cat_id);
    const label = `[${i + 1}/${topics.length}] ${topic.cat_id} ${cleanName(name || topic.category_name)}`.trimEnd();
    const reports = exported.reports[topic.cat_id];
    // Not a topic the export failed to get, whatever rows the file has for
    // it (SCHEMA §5.5), and never an empty list: to GAS that reads as every
    // report removed, and it refuses one (SCHEMA §3.4 step 2).
    if (failedToGet.has(topic.cat_id) || !Array.isArray(reports) || reports.length === 0) {
      const why = failedToGet.has(topic.cat_id)
        ? `the export failed to get it (status ${failedToGet.get(topic.cat_id)}); run tools/hdc-catalog-export.js again`
        : "the export has no reports for it; check its cat_id in hdc_topics";
      console.error(`${label}: not refreshed, ${why}`);
      notRefreshed++;
      continue;
    }
    let saved;
    try {
      saved = await callGas(url, {
        method: "POST",
        // GAS takes a JSON body as text/plain (SCHEMA §3).
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "save_catalog",
          cat_id: topic.cat_id,
          category_name: name,
          reports,
        }),
      });
    } catch (err) {
      console.error(`${label}: not refreshed, ${err.message}`);
      notRefreshed++;
      continue;
    }
    console.log(
      `${label}: added ${saved.added}, updated ${saved.updated}, removed ${saved.removed}, skipped ${saved.skipped}`,
    );
  }
  if (notRefreshed > 0) {
    console.error(`hdc-catalog: ${notRefreshed} of ${topics.length} topics not refreshed`);
    process.exitCode = 1;
  }
}

let args;
try {
  args = parseArgs({ options: { from: { type: "string" }, cat: { type: "string" } }, allowPositionals: true });
} catch (err) {
  fail(`${err.message}\n${USAGE}`);
}
const [command, ...rest] = args.positionals;
// A cat_id after refresh without --cat must not refresh every topic.
if (command === "find" && rest.length > 0) find(args.values.from, rest);
else if (command === "refresh" && rest.length === 0) refresh(args.values.from, args.values.cat);
else fail(USAGE);
