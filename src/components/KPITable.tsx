'use client';

import React, { useState, useMemo } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  flexRender,
  createColumnHelper,
  type Row,
} from '@tanstack/react-table';
import { KPISummary } from '@/lib/types';
import { KPIDetailModal } from './KPIDetailModal';
import { exportToExcel } from '@/lib/excel-export';
import { ExternalLink, Calendar, CalendarClock, FileSpreadsheet } from "lucide-react";

interface KPITableProps {
  data: KPISummary[];
  hospitalMap?: Record<string, { name: string; tambon_id: string }>;
  tambonMap?: Record<string, string>;
}

export default function KPITable({ data, hospitalMap = {}, tambonMap = {} }: KPITableProps) {
  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    facilityName: string;
    data: any[];
    targetValue: number;
    tableName: string;
  }>({
    isOpen: false,
    title: '',
    facilityName: '',
    data: [],
    targetValue: 0,
    tableName: ''
  });

  // Extract facility keys and sort by Tambon ID
  const facilityKeys = useMemo(() => {
    const allKeys = new Set<string>();
    data.forEach(kpi => {
      if (kpi.breakdown) {
        Object.keys(kpi.breakdown).forEach(k => allKeys.add(k));
      }
    });
    
    return Array.from(allKeys).sort((a, b) => {
       const hA = hospitalMap[a];
       const hB = hospitalMap[b];
       
       // Sort by Tambon ID first
       if (hA?.tambon_id && hB?.tambon_id) {
          if (hA.tambon_id !== hB.tambon_id) {
             return hA.tambon_id.localeCompare(hB.tambon_id);
          }
       }
       
       // Then by Code (numeric value if possible)
       return a.localeCompare(b);
    });
  }, [data, hospitalMap]);

  const openDrillDown = (kpi: KPISummary, facilityKey: string) => {
      const facilityRawData = kpi.data.filter(d => (d.hospcode === facilityKey) || (d.areacode === facilityKey));
      const facilityInfo = hospitalMap[facilityKey];
      const facilityName = facilityInfo ? facilityInfo.name : facilityKey;
      
      setModalState({
         isOpen: true,
         title: kpi.title,
         facilityName: facilityName,
         data: facilityRawData,
         targetValue: kpi.targetValue || 80,
         tableName: kpi.tableName
      });
  };

  // Helper to format percentage
  const formatPct = (val: number) => val.toFixed(2);

  const columnHelper = createColumnHelper<KPISummary>();

  const columns = useMemo(() => {
    return [
      columnHelper.display({
        id: 'index',
        header: '#',
        cell: info => info.row.index + 1,
        meta: {
          className: "md:sticky left-0 z-20 px-3 py-4 border-b border-r border-slate-200 text-center bg-white group-hover:bg-brand-50/10 w-[50px] font-medium text-slate-400 text-xs transition-colors",
          headerClassName: "md:sticky left-0 z-30 px-3 py-3 border-b border-r border-slate-200 w-[50px] text-center bg-slate-50 font-bold text-slate-500 uppercase text-xs tracking-wider"
        }
      }),
      columnHelper.accessor('title', {
        header: 'ตัวชี้วัด',
        cell: info => {
           const title = info.getValue();
           const link = info.row.original.link;
           const period = info.row.original.period; // "สะสม 6 เดือน (Q2)" or "รายปี"
           
           // Determine Badge Color
           const isQuarter = period && period.includes("(Q");
           const badgeStyle = isQuarter 
              ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20" 
              : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/20";

           return (
             <div className="min-w-[200px] py-1">
                <div className="flex items-center flex-wrap gap-2">
                   {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-1.5 font-medium text-slate-700 hover:text-blue-600 transition-colors">
                        <span className="group-hover:underline">{title}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </a>
                   ) : (
                      <span className="font-medium text-slate-700 block">{title}</span>
                   )}
                   
                   {/* DATA PERIOD BADGE */}
                   {period && (
                      <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${badgeStyle}`}>
                         {isQuarter ? <CalendarClock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                         {period}
                      </span>
                   )}
                </div>
             </div>
           );
        },
        meta: {
          className: "md:sticky left-[50px] z-20 px-4 py-4 border-b border-r border-slate-200 font-medium bg-white group-hover:bg-brand-50/10 w-[200px] min-w-[200px] md:w-[300px] md:min-w-[300px] text-slate-700 transition-colors",
          headerClassName: "md:sticky left-[50px] z-30 px-4 py-3 border-b border-r border-slate-200 w-[200px] min-w-[200px] md:w-[300px] md:min-w-[300px] bg-slate-50 font-bold text-slate-600 uppercase text-xs tracking-wider text-left"
        }
      }),
      columnHelper.accessor('percentage', {
        id: 'result',
        header: 'Result (%)',
        cell: info => {
          const kpi = info.row.original;
          const isRawCount = kpi.totalTarget === 0;

          return (
             <div className="w-full h-full flex flex-col items-center justify-center">
                <span>{isRawCount ? kpi.totalResult.toLocaleString() : formatPct(info.getValue())}</span>
                {isRawCount && <span className="text-[10px] text-slate-400 font-normal">(Count)</span>}
             </div>
          );
        },
        meta: {
           getHeaderClassName: () => "md:sticky left-[350px] z-30 px-3 py-3 border-b border-r border-slate-200 w-[100px] min-w-[100px] text-center bg-slate-50 font-bold text-slate-700 text-xs uppercase tracking-wider",
           getCellClassName: (row: Row<KPISummary>) => {
             const kpi = row.original;
             const targetVal = kpi.targetValue || 80;
             const isRawCount = kpi.totalTarget === 0;
             
             if (isRawCount) {
                return "md:sticky left-[350px] z-20 px-3 py-4 border-b border-r border-slate-200 text-center font-bold w-[100px] min-w-[100px] bg-slate-50/50 text-slate-600 group-hover:bg-slate-100 transition-colors";
             }

             const totalPass = kpi.percentage >= targetVal;
             return `md:sticky left-[350px] z-20 px-3 py-4 border-b border-r border-slate-200 text-center font-bold w-[100px] min-w-[100px] transition-colors ${
                totalPass ? 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 group-hover:bg-rose-100'
             }`;
           }
        }
      }),
      // Dynamic Facility Columns
      ...facilityKeys.map(key => 
        columnHelper.accessor(row => row.breakdown?.[key], {
          id: key,
          header: () => (
             <div className="relative h-[160px] w-full">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full flex justify-center pb-3">
                   <div className="-rotate-45 w-48 text-left origin-bottom-left transform translate-x-4 -translate-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 block truncate transition-colors">
                        {hospitalMap[key]?.name || key}
                      </span>
                   </div>
                </div>
             </div>
          ),
          cell: info => {
             const facilityData = info.getValue();
             const kpi = info.row.original;
             
             if (!facilityData) return '-';

             const isRawCount = kpi.totalTarget === 0;
             // If facility specific target is 0 logic
             
             return (
               <div 
                 onClick={() => openDrillDown(kpi, key)}
                 className="w-full h-full flex items-center justify-center cursor-pointer min-h-[24px]"
               >
                 {isRawCount ? facilityData.result.toLocaleString() : (facilityData.target === 0 ? '-' : formatPct(facilityData.percentage))}
               </div>
             );
          },
          meta: {
            headerClassName: "px-1 py-1 border-b border-r border-slate-200 text-center relative h-[160px] min-w-[45px] w-[45px] align-bottom bg-white hover:bg-slate-50 transition-colors",
            getCellClassName: (row: Row<KPISummary>) => {
               const kpi = row.original;
               const targetVal = kpi.targetValue || 80;
               const facilityData = kpi.breakdown?.[key];
               const isRawCount = kpi.totalTarget === 0;
               
               if (!facilityData) {
                 return "px-1 py-1 border-b border-r border-slate-200 text-center bg-slate-50/50 text-slate-300 text-[10px]";
               }
               
               if (isRawCount) {
                  return "px-1 py-1 border-b border-r border-slate-200 text-center text-xs font-semibold whitespace-nowrap transition-colors bg-white text-slate-600 hover:bg-slate-200 cursor-pointer";
               }
               
               if (facilityData.target === 0) {
                 return "px-1 py-1 border-b border-r border-slate-200 text-center bg-slate-50/50 text-slate-300 text-[10px]";
               }
               
               const fPass = facilityData.percentage >= targetVal;
               return `px-1 py-1 border-b border-r border-slate-200 text-center text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  fPass ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-50 text-rose-700 hover:bg-rose-200'
               }`;
            }
          }
        })
      ),
      columnHelper.accessor('targetValue', {
         id: 'target',
         header: () => (
           <div className="flex flex-col items-center leading-tight">
             <span>Target</span>
             <span className="text-[10px] font-normal opacity-80">(6 เดือน)</span>
           </div>
         ),
         cell: info => `≥ ${info.getValue() || 80}`,
         meta: {
            className: "md:sticky right-0 z-10 px-3 py-4 border-b border-l border-slate-200 text-center text-xs w-24 min-w-[90px] font-bold text-amber-700 bg-amber-50 group-hover:bg-amber-100 transition-colors",
            headerClassName: "md:sticky right-0 z-20 px-3 py-3 border-b border-l border-slate-200 w-24 text-center min-w-[90px] bg-slate-50 font-bold text-amber-800 uppercase text-xs tracking-wider"
         }
      })
    ];
  }, [facilityKeys, hospitalMap]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
     try {
       setIsExporting(true);
       await exportToExcel(data, hospitalMap, facilityKeys);
     } catch (err) {
       console.error("Export failed", err);
       alert("Export failed. Please try again.");
     } finally {
       setIsExporting(false);
     }
  };

  return (
    <>
      <div className="overflow-x-auto shadow-sm shadow-slate-200/50 rounded-xl max-w-full border border-slate-200 bg-white mb-10">
         {/* Table Actions Header */}
         <div className="px-5 py-4 bg-white border-none flex justify-between items-center sticky left-0 z-10 w-full mb-1">
            <div>
               <h3 className="font-bold text-slate-800 font-prompt text-lg">KPI Performance</h3>
               <p className="text-xs text-slate-400 font-medium mt-0.5 uppercase tracking-wide">Detailed Breakdown</p>
            </div>
            <button 
               onClick={handleExport}
               disabled={isExporting}
               className={`flex items-center gap-2 px-4 py-2 text-white text-xs md:text-sm font-semibold rounded-lg shadow-sm shadow-brand-500/20 transition-all active:scale-95 font-prompt ${
                  isExporting ? 'bg-slate-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'
               }`}
            >
               {isExporting ? (
                  <>
                    <svg className="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden md:inline">Exporting...</span>
                  </>
               ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="hidden md:inline">Export Excel</span>
                  </>
               )}
            </button>
         </div>

        <table className="w-full text-sm text-left text-slate-700 border-separate border-spacing-0">
          <thead className="text-xs text-slate-800 uppercase bg-slate-100">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                   const meta: any = header.column.columnDef.meta || {};
                   const className = meta.getHeaderClassName ? meta.getHeaderClassName() : meta.headerClassName;
                   
                   return (
                    <th key={header.id} className={className}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="bg-white hover:bg-brand-50/10 transition-colors group border-b border-slate-50 last:border-none">
                {row.getVisibleCells().map(cell => {
                   const meta: any = cell.column.columnDef.meta || {};
                   const className = meta.getCellClassName ? meta.getCellClassName(row) : meta.className;
                   
                   return (
                    <td key={cell.id} className={className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <KPIDetailModal 
         isOpen={modalState.isOpen}
         onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
         title={modalState.title}
         facilityName={modalState.facilityName}
         data={modalState.data}
         targetValue={modalState.targetValue}
         tableName={modalState.tableName}
         tambonMap={tambonMap}
      />
    </>
  );
}
