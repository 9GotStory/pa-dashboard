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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
          className: "md:sticky left-0 z-20 bg-slate-50 min-w-[50px] w-[50px] text-center font-medium text-slate-500 text-xs border-r border-slate-200",
          headerClassName: "md:sticky left-0 z-30 bg-slate-100 w-[50px] text-center border-r border-slate-200"
        }
      }),
      columnHelper.accessor('title', {
        header: 'ตัวชี้วัด',
        cell: info => {
           const title = info.getValue();
           const link = info.row.original.link;
           const period = info.row.original.period; // "สะสม 6 เดือน (Q2)" or "รายปี"
           
           return (
             <div className="min-w-[350px] md:min-w-[400px] py-1.5 pr-4">
                <div className="flex items-start flex-col gap-1.5">
                   {/* KPI Title */}
                   <div className="flex items-start gap-2">
                     {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-slate-800 hover:text-blue-700 hover:underline font-medium text-sm leading-relaxed group transition-all block">
                           {title} <ExternalLink className="w-3.5 h-3.5 inline text-slate-400 group-hover:text-blue-500 ml-1 transform translate-y-[-1px] transition-colors" />
                        </a>
                     ) : (
                        <span className="text-slate-800 font-medium text-sm leading-relaxed block">{title}</span>
                     )}
                   </div>
                   
                   {/* DATA PERIOD BADGE */}
                   {period && (
                      <span className="text-[11px] font-semibold text-slate-700 bg-slate-200/80 border border-slate-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap">
                         <CalendarClock className="w-3.5 h-3.5 text-slate-600" />
                         {period}
                      </span>
                   )}
                </div>
             </div>
           );
        },
        meta: {
          className: "md:sticky left-[50px] z-20 bg-slate-50 w-[350px] min-w-[350px] md:w-[450px] md:min-w-[450px] text-left align-top shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-200 px-4 py-3",
          headerClassName: "md:sticky left-[50px] z-30 bg-slate-100 w-[350px] min-w-[350px] md:w-[450px] md:min-w-[450px] text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-200 px-4"
        }
      }),
      columnHelper.accessor('percentage', {
        id: 'result',
        header: 'ผลงาน (%)',
        cell: info => {
          const kpi = info.row.original;
          const isRawCount = kpi.totalTarget === 0;

          return (
             <div className="w-full text-center">
                <span className="font-bold text-sm tracking-tight hidden md:inline">
                  {isRawCount ? kpi.totalResult.toLocaleString() : formatPct(info.getValue())}
                </span>
                <span className="md:hidden font-bold text-sm">
                  {isRawCount ? kpi.totalResult.toLocaleString() : formatPct(info.getValue())}%
                </span>
             </div>
          );
        },
        meta: {
           getHeaderClassName: () => "md:sticky left-[400px] md:left-[500px] z-30 bg-white w-[80px] min-w-[80px] text-center border-r border-slate-100",
           getCellClassName: (row: Row<KPISummary>) => {
             const kpi = row.original;
             const targetVal = kpi.targetValue || 80;
             const isRawCount = kpi.totalTarget === 0;
             
             if (isRawCount) {
                return "md:sticky left-[400px] md:left-[500px] z-20 bg-slate-100/50 text-center font-medium text-slate-600 border-r border-slate-200";
             }

             const totalPass = kpi.percentage >= targetVal;
             // Soft Background Heatmap Logic
             return `md:sticky left-[400px] md:left-[500px] z-20 text-center font-bold border-r border-slate-200 ${
                totalPass 
                  ? 'bg-emerald-100 text-emerald-900' 
                  : 'bg-rose-100 text-rose-900'
             }`;
           }
        }
      }),
      // Dynamic Facility Columns
      ...facilityKeys.map(key => 
        columnHelper.accessor(row => row.breakdown?.[key], {
          id: key,
          header: () => (
             <div className="text-[11px] font-medium text-slate-500 truncate max-w-[70px]" title={hospitalMap[key]?.name}>
                {hospitalMap[key]?.name?.replace('โรงพยาบาลส่งเสริมสุขภาพตำบล', 'รพ.สต.') || key}
             </div>
          ),
          cell: info => {
             const facilityData = info.getValue();
             const kpi = info.row.original;
             
             if (!facilityData) return <span className="text-slate-300">-</span>;

             const isRawCount = kpi.totalTarget === 0;
             
             return (
               <div 
                 onClick={() => openDrillDown(kpi, key)}
                 className="w-full h-full flex items-center justify-center cursor-pointer min-h-[50px]"
               >
                 {isRawCount 
                    ? <span className="text-xs text-slate-600 font-medium">{facilityData.result.toLocaleString()}</span>
                    : (facilityData.target === 0 
                        ? <span className="text-slate-300">-</span>
                        : <span className="text-xs font-bold">{formatPct(facilityData.percentage)}</span>)
                 }
               </div>
             );
          },
          meta: {
            headerClassName: "px-2 py-3 text-center min-w-[70px] w-[70px] bg-white border-b border-slate-100",
            getCellClassName: (row: Row<KPISummary>) => {
               const kpi = row.original;
               const targetVal = kpi.targetValue || 80;
               const facilityData = kpi.breakdown?.[key];
               const isRawCount = kpi.totalTarget === 0;
               
               // No Data / Empty -> Gray
               if (!facilityData || facilityData.target === 0) {
                 return "p-0 text-center bg-slate-50"; 
               }
               
               if (isRawCount) {
                  return "p-0 text-center bg-white hover:bg-slate-100 cursor-pointer transition-colors";
               }
               
               const fPass = facilityData.percentage >= targetVal;
               
               // Soft Heatmap Logic
               // Pass: Emerald-100, Fail: Rose-100
               // Hover effects to darken slightly
               return `p-0 text-center cursor-pointer transition-colors ${
                  fPass 
                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900' 
                    : 'bg-rose-100 hover:bg-rose-200 text-rose-900'
               }`;
            }
          }
        })
      ),
      columnHelper.accessor('targetValue', {
         id: 'target',
         header: () => (
           <div className="flex flex-col items-center leading-tight">
             <span>Goal</span>
           </div>
         ),
         cell: info => `≥ ${info.getValue() || 80}`,
         meta: {
            // DISTINCT TARGET COLUMN -- SOLID BG
            className: "md:sticky right-0 z-10 bg-amber-50 text-center text-xs w-[70px] min-w-[70px] font-bold text-amber-700 border-l border-amber-200/50",
            headerClassName: "md:sticky right-0 z-20 bg-amber-50 w-[70px] text-center min-w-[70px] text-amber-800 border-l border-amber-200/50"
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
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
         {/* Table Actions Header */}
         <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center sticky left-0 z-10 w-full">
            <div>
               <h3 className="font-bold text-slate-800 font-prompt text-lg">Detailed Breakdown</h3>
               <p className="text-slate-500 text-xs">Performance by District & KPI</p>
            </div>
            <button 
               onClick={handleExport}
               disabled={isExporting}
               className={`flex items-center gap-1.5 px-3 py-1.5 text-slate-600 bg-white border border-slate-200 text-xs font-medium rounded-lg shadow-sm transition-all hover:bg-slate-50 active:scale-95 font-prompt ${
                  isExporting ? 'opacity-50 cursor-not-allowed' : ''
               }`}
            >
               {isExporting ? (
                  <>
                    <span className="hidden md:inline">Exporting...</span>
                  </>
               ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden md:inline">Export Excel</span>
                  </>
               )}
            </button>
         </div>

         <div className="relative w-full overflow-auto">
            <Table className="w-full text-sm text-left border-collapse">
               <TableHeader className="bg-slate-50 sticky top-0 z-40 shadow-sm">
                 {table.getHeaderGroups().map(headerGroup => (
                   <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-slate-200">
                     {headerGroup.headers.map(header => {
                        const meta: any = header.column.columnDef.meta || {};
                        const className = meta.getHeaderClassName ? meta.getHeaderClassName() : meta.headerClassName;
                        
                        return (
                         <TableHead key={header.id} className={cn("h-10 text-xs font-semibold text-slate-500 uppercase tracking-wide", className)}>
                           {header.isPlaceholder
                             ? null
                             : flexRender(
                                 header.column.columnDef.header,
                                 header.getContext()
                               )}
                         </TableHead>
                       );
                     })}
                   </TableRow>
                 ))}
               </TableHeader>
               <TableBody>
                 {table.getRowModel().rows.map(row => (
                   <TableRow key={row.id} className="bg-white hover:bg-slate-50 border-b border-slate-100 transition-colors">
                     {row.getVisibleCells().map(cell => {
                        const meta: any = cell.column.columnDef.meta || {};
                        const className = meta.getCellClassName ? meta.getCellClassName(row) : meta.className;
                        
                        return (
                         <TableCell key={cell.id} className={cn("p-0 min-h-[50px]", className)}>
                           {flexRender(cell.column.columnDef.cell, cell.getContext())}
                         </TableCell>
                       );
                     })}
                   </TableRow>
                 ))}
               </TableBody>
            </Table>
         </div>
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
