import fs from "node:fs";
import path from "node:path";
import type { DcCatalog, SnapshotMeta } from "./types";

// The snapshot that build-snapshot.mjs writes before next build (SCHEMA §7),
// for server components to read at build time. Client components never
// import this file (CODING_STANDARDS §4).
const DIR = path.join(process.cwd(), "public", "data");

function read<T>(file: string): T {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) throw new Error(`${full} is missing: run npm run snapshot first (SPEC §6.2)`);
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

export function readMeta(): SnapshotMeta {
  return read<SnapshotMeta>("meta.json");
}

export function readCatalog(): DcCatalog {
  return read<DcCatalog>("catalog.json");
}
