// A build error if a client component imports this file, as
// src/lib/dc/snapshot.ts; Next.js handles server-only itself, no package needed.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PaSnapshot } from "./process";
import { closedYearOf } from "./years";

// The snapshot of PA that build-snapshot.mjs writes before next build
// (SCHEMA §7), for /pa to read at build time (SPEC §4).
const PA_JSON = path.join(process.cwd(), "public", "data", "pa.json");
// The files of PA ปีที่ปิดแล้ว, committed in the repo (SCHEMA §7).
const PA_YEARS = path.join(process.cwd(), "data", "pa-years");

export function readPaSnapshot(): PaSnapshot {
  if (!fs.existsSync(PA_JSON)) throw new Error(`${PA_JSON} is missing: run npm run snapshot first (SPEC §6.2)`);
  return JSON.parse(fs.readFileSync(PA_JSON, "utf8")) as PaSnapshot;
}

/** Every file of data/pa-years/ with its year; no folder (git keeps no empty one) is none (SPEC §4) */
export function readClosedPaYears(): { year: string; snapshot: PaSnapshot }[] {
  if (!fs.existsSync(PA_YEARS)) return [];
  return fs
    .readdirSync(PA_YEARS)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const snapshot = JSON.parse(fs.readFileSync(path.join(PA_YEARS, name), "utf8")) as PaSnapshot;
      return { year: closedYearOf(name, snapshot), snapshot };
    });
}
