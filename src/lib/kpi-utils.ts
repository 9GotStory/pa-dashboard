import type { KPISummary, MophReportData } from "./types";

export interface KPIValue {
  t: number;
  r: number;
}

/**
 * Read the pre-calculated `target` and `result` fields that Code.gs emits
 * (see calculateKPIOnServer in src/scripts/Code.gs). The frontend no longer
 * does any KPI-specific math — the server is the single source of truth.
 */
export function calculateKPIValue(item: MophReportData): KPIValue {
  const t = Number(item.target ?? 0);
  const r = Number(item.result ?? 0);

  return { t, r };
}

/**
 * Compute aggregate target/result/percentage for a KPI, scoped to the
 * selected facilities (or full totals when none selected). Shared by the
 * table, card, and summary-stats views so they never drift apart.
 */
export function computeAggregate(
  kpi: KPISummary,
  selectedFacilities: string[] = [],
): { totalTarget: number; totalResult: number; percentage: number } {
  if (selectedFacilities.length === 0) {
    return {
      totalTarget: kpi.totalTarget,
      totalResult: kpi.totalResult,
      percentage: kpi.percentage,
    };
  }

  const breakdown = kpi.breakdown ?? {};
  let selTarget = 0;
  let selResult = 0;
  for (const f of selectedFacilities) {
    const entry = breakdown[f];
    if (!entry) continue;
    selTarget += entry.target;
    selResult += entry.result;
  }

  // Raw-count KPIs (totalTarget === 0) only track results.
  if (kpi.totalTarget === 0) {
    return {
      totalTarget: 0,
      totalResult: selResult,
      percentage: selResult > 0 ? 100 : 0,
    };
  }

  return {
    totalTarget: selTarget,
    totalResult: selResult,
    percentage: selTarget > 0 ? (selResult / selTarget) * 100 : 0,
  };
}
