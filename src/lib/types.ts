export interface MophReportData {
  id: string;
  hospcode: string;
  areacode: string;
  date_com: string;
  b_year: string;
  
  // Standard fields
  target?: number | string;
  result?: number | string;

  // Quarterly fields
  targetq1?: number | string;
  result1q1?: number | string;
  targetq2?: number | string;
  result1q2?: number | string;
  targetq3?: number | string;
  result1q3?: number | string;
  targetq4?: number | string;
  result1q4?: number | string;

  // Catch-all
  [key: string]: any;
}

export type KPIReportType = 
  | 's_kpi_anc12' 
  | 's_anc5'
  | 's_kpi_food' 
  | 's_kpi_child_specialpp'
  | 's_kpi_childdev2'
  | 's_aged9_w'
  | 's_dm_screen'
  | 's_ht_screen'
  | 's_ncd_screen_repleate1'
  | 's_ncd_screen_repleate2'
  | 's_dental_0_5_cavity_free'
  | 's_kpi_dental28'
  | 's_kpi_dental33';

export interface KPISummary {
  title: string;
  tableName: KPIReportType;
  totalTarget: number;
  totalResult: number;
  percentage: number;
  data: MophReportData[];
  breakdown: Record<string, { target: number; result: number; percentage: number }>;
  targetValue: number; // The goal (e.g. 70%)
}

export interface KPIMaster {
  table_name: string;
  title: string;
  target: number;
  order: number;
}
