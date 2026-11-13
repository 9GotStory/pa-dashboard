import { formatCount, formatPct } from "@/lib/dc/format";
import type { PopulationChange } from "@/lib/dc/types";

// The words the รายงานประชากร sections share.

/**
 * A change as shown (SPEC §9.4.1): signed + or −, never color alone, with
 * its unit when there is one, and "—" for a ร้อยละ from 0
 */
export function changeText({ count, pct }: PopulationChange, unit?: string): string {
  const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
  const pctPart = pct === null ? "—" : `${sign(pct)}${formatPct(Math.abs(pct))}%`;
  return `${sign(count)}${formatCount(Math.abs(count))}${unit ? ` ${unit}` : ""} (${pctPart})`;
}
