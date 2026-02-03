export interface KPIValue {
  t: number;
  r: number;
}

/**
 * Standardized KPI Calculation Logic
 * Central brain for interpreting MOPH API data columns.
 */
export function calculateKPIValue(item: any, tableName: string): KPIValue {
  let t = 0;
  let r = 0;

  // 1. Dental A/B Pattern (Target=B, Result=A)
  if (tableName === 's_dental_0_5_cavity_free') {
      t = Number(item.b || 0); 
      r = Number(item.a || 0);
      return { t, r };
  }

  // 2. Dental 65+ (Count only, Target from Config)
  if (tableName === 's_kpi_dental33') {
      // API has no target column (or it's 0), we rely on master config for % target.
      // But for "Count", we consider target=0 implies raw count display.
      // Result is in 'result'. breakdown is in result01..12
      t = 0; // Will be handled by isRawCount logic if totalTarget=0
      r = Number(item.result || 0);
      return { t, r };
  }
  
  // 3. Aged 9 Aspects (Exception: Do NOT sum results)
  if (tableName === 's_aged9') {
      t = Number(item.target || 0);
      r = Number(item.result || 0);
      return { t, r };
  }

  // 4. Standard & Quarterly Sum Logic
  // Try main 'target'/'result' first. If target > 0, use it.
  const tMain = Number(item.target || 0);
  const rMain = Number(item.result || 0);

  if (tMain > 0) {
      t = tMain;
      // If result is 0 but we have quarterly results, use them?
      // Usually if target is main, result is main.
      // But let's be safe: if rMain > 0 use it.
      if (rMain > 0) {
          r = rMain;
      } else {
         // Try summing quarters just in case
         r = getQuarterlySum(item, 'result');
         // If sum is 0, revert to rMain (0)
         if (r === 0) r = rMain;
      }
  } else {
      // If main target is 0/missing, try summing quarters
      t = getQuarterlySum(item, 'target');
      r = getQuarterlySum(item, 'result');
      
      // If still 0, maybe it really is 0 or data missing.
  }

  return { t, r };
}

/**
 * Helper to sum variations of quarterly columns
 * Looks for: {prefix}1..4, {prefix}q1..q4, {prefix}1q1..1q4
 */
function getQuarterlySum(item: any, prefix: string): number {
  let sum = 0;
  for (let i = 1; i <= 4; i++) {
     const s = String(i);
     // Variations found in schema analysis:
     // target1, target2...
     // targetq1, targetq2...
     // target1q1, target1q2... (found in child_specialpp)
     const val = Number(
        item[`${prefix}${s}`] || 
        item[`${prefix}q${s}`] || 
        item[`${prefix}1q${s}`] || 
        0
     );
     sum += val;
  }
  return sum;
}

/**
 * Helper to calculate percentage safely
 */
export function calculatePercentage(t: number, r: number): number {
  return t > 0 ? (r / t) * 100 : 0;
}
