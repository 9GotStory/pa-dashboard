import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { KPISummary } from './types';

// Color Constants (ARGB format for ExcelJS)
const COLORS = {
  HEADER_BG: 'FFF1F5F9', // slate-100
  PASS_BG: 'FFD1FAE5',   // emerald-100
  PASS_TEXT: 'FF047857', // emerald-700
  FAIL_BG: 'FFFFE4E6',   // rose-100
  FAIL_TEXT: 'FFBE123C', // rose-700
  TARGET_BG: 'FFFFFBEB', // amber-50
  TARGET_TEXT: 'FF78350F', // amber-900
  BORDER: 'FFCBD5E1',    // slate-300
};

export async function exportToExcel(
  data: KPISummary[],
  hospitalMap: Record<string, { name: string; tambon_id: string }>,
  facilityKeys: string[]
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('PA Dashboard 2569');

  // --- 1. Define Columns ---
  // Static columns
  const columns = [
    { header: '#', key: 'index', width: 5 },
    { header: 'ตัวชี้วัด (Indicator)', key: 'title', width: 40 },
    { header: 'Target (6 เดือน)', key: 'target', width: 15 },
    { header: 'Result (%)', key: 'result', width: 15 },
  ];

  // Dynamic Facility Columns
  facilityKeys.forEach(key => {
    const hospName = hospitalMap[key]?.name || key;
    columns.push({ header: hospName, key: key, width: 12 });
  });

  sheet.columns = columns;

  // --- 2. Style Header Row ---
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.font = { bold: true, size: 12, name: 'Sarabun' }; // Fallback font
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.HEADER_BG },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.BORDER } },
      left: { style: 'thin', color: { argb: COLORS.BORDER } },
      bottom: { style: 'thin', color: { argb: COLORS.BORDER } },
      right: { style: 'thin', color: { argb: COLORS.BORDER } },
    };
  });

  // --- 3. Add Data Rows ---
  data.forEach((kpi, index) => {
    const isRawCount = kpi.totalTarget === 0;
    const targetVal = kpi.targetValue || 80;
    
    const rowValues: any = {
      index: index + 1,
      title: kpi.title,
      target: `≥ ${targetVal}`,
      result: isRawCount ? kpi.totalResult : parseFloat(kpi.percentage.toFixed(2)),
    };

    // Fill Facility Data
    facilityKeys.forEach(key => {
       const breakdown = kpi.breakdown?.[key];
       if (!breakdown) { // No data
          rowValues[key] = '-';
       } else if (isRawCount) { // Count only
          rowValues[key] = breakdown.result; 
       } else if (breakdown.target === 0) { // Target is 0 -> usually means N/A or special case
          rowValues[key] = '-';
       } else { // Normal %
          rowValues[key] = parseFloat(breakdown.percentage.toFixed(2));
       }
    });

    const row = sheet.addRow(rowValues);
    row.height = 24;

    // --- 4. Apply Row Styling ---
    
    // Title Column (Wrap Text)
    const titleCell = row.getCell('title');
    titleCell.alignment = { vertical: 'middle', wrapText: true };

    // Result Column (Total)
    const resultCell = row.getCell('result');
    resultCell.alignment = { vertical: 'middle', horizontal: 'center' };
    
    if (!isRawCount) {
       const isPass = kpi.percentage >= targetVal;
       resultCell.fill = {
         type: 'pattern',
         pattern: 'solid',
         fgColor: { argb: isPass ? COLORS.PASS_BG : COLORS.FAIL_BG }
       };
       resultCell.font = {
         color: { argb: isPass ? COLORS.PASS_TEXT : COLORS.FAIL_TEXT },
         bold: true
       };
    }

    // Facility Columns Styling
    facilityKeys.forEach(key => {
       const cell = row.getCell(key);
       cell.alignment = { vertical: 'middle', horizontal: 'center' };
       
       const breakdown = kpi.breakdown?.[key];
       if (breakdown && !isRawCount && breakdown.target > 0) {
          const isPass = breakdown.percentage >= targetVal;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isPass ? COLORS.PASS_BG : COLORS.FAIL_BG }
          };
          cell.font = {
            color: { argb: isPass ? COLORS.PASS_TEXT : COLORS.FAIL_TEXT }
          };
       }
    });

    // Apply Borders to all cells in row
    row.eachCell((cell) => {
       cell.border = {
        top: { style: 'thin', color: { argb: COLORS.BORDER } },
        left: { style: 'thin', color: { argb: COLORS.BORDER } },
        bottom: { style: 'thin', color: { argb: COLORS.BORDER } },
        right: { style: 'thin', color: { argb: COLORS.BORDER } },
      };
    });
  });

  // --- 5. Write Buffer & Save ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // File Name: pa-dashboard-YYYY-MM-DD.xlsx
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `pa-dashboard-${dateStr}.xlsx`);
}
