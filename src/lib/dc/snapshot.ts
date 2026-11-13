// A build error if a client component imports this file (CODING_STANDARDS §4);
// Next.js handles server-only itself, no package needed.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { awaitingWarnings, shownCatalog } from "./tables";
import type { DcCatalog, PopulationReportData, PopulationSnapshot, SnapshotMeta } from "./types";

// The snapshot that build-snapshot.mjs writes before next build (SCHEMA §7),
// for server components to read at build time.
const DIR = path.join(process.cwd(), "public", "data");

function read<T>(file: string): T {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) throw new Error(`${full} is missing: run npm run snapshot first (SPEC §6.2)`);
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

export function readMeta(): SnapshotMeta {
  return read<SnapshotMeta>("meta.json");
}

/** catalog.json as the site shows it, without the รายงานที่รอวิเคราะห์ (SPEC §5.2) */
export function readCatalog(): DcCatalog {
  return shownCatalog(read<DcCatalog>("catalog.json"));
}

/** The warnings of the รายงานที่รอวิเคราะห์ that readCatalog leaves out */
export function readAwaitingWarnings(): string[] {
  return awaitingWarnings(read<DcCatalog>("catalog.json"));
}

export function readPopulation(): PopulationSnapshot {
  return read<PopulationSnapshot>("population.json");
}

/** reports/population.json, the data of รายงานประชากร (SCHEMA §7) */
export function readPopulationReport(): PopulationReportData {
  return read<PopulationReportData>("reports/population.json");
}
