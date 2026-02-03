export interface KPIValue {
  t: number;
  r: number;
}

/**
 * Standardized KPI Calculation Logic
 * Now simplified because Server (GAS) does all the heavy lifting!
 */
export function calculateKPIValue(item: any, tableName: string): KPIValue {
  // Server now returns pre-calculated 'target' and 'result'
  // We just trust it.
  const t = Number(item.target || 0);
  const r = Number(item.result || 0);

  return { t, r };
}

/**
 * Helper to calculate percentage safely
 */
export function calculatePercentage(t: number, r: number): number {
  return t > 0 ? (r / t) * 100 : 0;
}
