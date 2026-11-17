// A build error if a client component imports this file, as
// src/lib/dc/snapshot.ts; Next.js handles server-only itself, no package needed.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PaSnapshot } from "./process";
import { closedYearOf, paYearLinks, type PaYearLink } from "./years";

// The snapshot of PA that build-snapshot.mjs writes before next build
// (SCHEMA §7), for /pa to read at build time (SPEC §4).
const PA_JSON = path.join(process.cwd(), "public", "data", "pa.json");
// The files of PA ปีที่ปิดแล้ว, committed in the repo (SCHEMA §7).
const PA_YEARS = path.join(process.cwd(), "data", "pa-years");

export function readPaSnapshot(): PaSnapshot {
  if (!fs.existsSync(PA_JSON)) throw new Error(`${PA_JSON} is missing: run npm run snapshot first (SPEC §6.2)`);
  return JSON.parse(fs.readFileSync(PA_JSON, "utf8")) as PaSnapshot;
}

/**
 * Every file of data/pa-years/ with its year; no folder (git keeps no empty
 * one) is none (SPEC §4). Any file not named {ปี}.json fails the build with
 * its name (SCHEMA §7).
 */
export function readClosedPaYears(): { year: string; snapshot: PaSnapshot }[] {
  if (!fs.existsSync(PA_YEARS)) return [];
  return fs.readdirSync(PA_YEARS).map((name) => {
    let snapshot: PaSnapshot;
    try {
      snapshot = JSON.parse(fs.readFileSync(path.join(PA_YEARS, name), "utf8")) as PaSnapshot;
    } catch (err) {
      throw new Error(`data/pa-years/${name}: ${(err as Error).message}`);
    }
    return { year: closedYearOf(name, snapshot), snapshot };
  });
}

/** The year row of the PA header: pa.json's current year and every closed year (SPEC §4) */
export function readPaYearLinks(): PaYearLink[] {
  return paYearLinks(
    readPaSnapshot().BATCH_ALL.meta?.current_year ?? "",
    readClosedPaYears().map((closed) => closed.year),
  );
}
