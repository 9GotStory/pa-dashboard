import type { PopulationChange } from "./types";

// The change of one value, for รายงานประชากร and for การเปลี่ยนแปลงจากปีก่อน of
// the report pages. A file of its own: from population-report.ts, values.ts
// would carry that whole data layer to /reports and every report page (SPEC
// §9.6).

/** From old to new (SCHEMA §11.5): no ร้อยละ when old is 0 */
export function changeOf(oldValue: number, newValue: number): PopulationChange {
  const count = newValue - oldValue;
  return { count, pct: oldValue === 0 ? null : (count / oldValue) * 100 };
}
