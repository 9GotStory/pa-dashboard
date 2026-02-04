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
          className: "md:sticky left-0 z-20 px-1 py-1 border border-slate-300 text-center bg-blue-100 w-[40px] font-bold text-slate-700 text-xs",
          headerClassName: "md:sticky left-0 z-30 px-1 py-2 border border-slate-400 w-[40px] text-center bg-blue-300 font-bold text-slate-800 text-xs"
        }
      }),
      columnHelper.accessor('title', {
        header: 'ตัวชี้วัด',
        cell: info => {
           const title = info.getValue();
           const link = info.row.original.link;
           const period = info.row.original.period; // "สะสม 6 เดือน (Q2)" or "รายปี"
           
           return (
             <div className="min-w-[250px] py-1 px-1">
                <div className="flex items-start flex-col gap-1">
                   {/* KPI Title */}
                   <div className="flex items-center gap-1">
                     {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-slate-900 hover:text-blue-700 font-medium leading-tight text-xs group">
                           {title} <ExternalLink className="w-3 h-3 inline opacity-50 group-hover:opacity-100" />
                        </a>
                     ) : (
                        <span className="text-slate-900 font-medium leading-tight text-xs">{title}</span>
                     )}
                   </div>
                   
                   {/* DATA PERIOD BADGE */}
                   {period && (
                      <span className="text-[10px] text-slate-500 font-normal">
                         ({period})
                      </span>
                   )}
                </div>
             </div>
           );
        },
        meta: {
          className: "md:sticky left-[40px] z-20 px-1 py-1 border border-slate-300 bg-white hover:bg-slate-50 w-[250px] min-w-[250px] md:w-[350px] md:min-w-[350px] text-left align-middle",
          headerClassName: "md:sticky left-[40px] z-30 px-2 py-2 border border-slate-400 w-[250px] min-w-[250px] md:w-[350px] md:min-w-[350px] bg-blue-300 font-bold text-slate-900 text-center text-xs"
        }
      }),
      columnHelper.accessor('percentage', {
        id: 'result',
        header: 'ผลงาน คปสอ. (ร้อยละ)',
        cell: info => {
          const kpi = info.row.original;
          const isRawCount = kpi.totalTarget === 0;

          return (
             <div className="w-full h-full flex items-center justify-center font-bold text-xs">
                <span>{isRawCount ? kpi.totalResult.toLocaleString() : formatPct(info.getValue())}</span>
             </div>
          );
        },
        meta: {
           getHeaderClassName: () => "md:sticky left-[390px] z-30 px-1 py-2 border border-slate-400 w-[80px] min-w-[80px] text-center bg-blue-300 font-bold text-slate-900 text-xs",
           getCellClassName: (row: Row<KPISummary>) => {
             const kpi = row.original;
             const targetVal = kpi.targetValue || 80;
             const isRawCount = kpi.totalTarget === 0;
             
             if (isRawCount) {
                return "md:sticky left-[390px] z-20 px-1 py-1 border border-slate-300 text-center font-bold w-[80px] min-w-[80px] bg-sky-100 text-slate-800";
             }

             const totalPass = kpi.percentage >= targetVal;
             // Full Cell Color Logic
             return `md:sticky left-[390px] z-20 px-1 py-1 border border-slate-300 text-center font-bold w-[80px] min-w-[80px] ${
                totalPass ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'
             }`;
           }
        }
      }),
      // Dynamic Facility Columns
      ...facilityKeys.map(key => 
        columnHelper.accessor(row => row.breakdown?.[key], {
          id: key,
          header: () => (
             <div className="text-xs">{hospitalMap[key]?.name || key}</div>
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
                 className="w-full h-full flex items-center justify-center cursor-pointer min-h-[24px] text-xs"
               >
                 {isRawCount ? facilityData.result.toLocaleString() : (facilityData.target === 0 ? '-' : formatPct(facilityData.percentage))}
               </div>
             );
          },
          meta: {
            headerClassName: "px-1 py-2 border border-slate-400 text-center min-w-[70px] w-[70px] bg-blue-200 font-bold text-slate-900 text-[11px] break-words whitespace-normal align-middle leading-tight",
            getCellClassName: (row: Row<KPISummary>) => {
               const kpi = row.original;
               const targetVal = kpi.targetValue || 80;
               const facilityData = kpi.breakdown?.[key];
               const isRawCount = kpi.totalTarget === 0;
               
               if (!facilityData) {
                 return "px-1 py-1 border border-slate-300 text-center bg-gray-100 text-gray-400 text-[10px]";
               }
               
               if (isRawCount) {
                  return "px-1 py-1 border border-slate-300 text-center text-xs font-semibold whitespace-nowrap bg-sky-50 text-slate-700 hover:bg-sky-100 cursor-pointer";
               }
               
               if (facilityData.target === 0) {
                 return "px-1 py-1 border border-slate-300 text-center bg-gray-100 text-gray-400 text-[10px]";
               }
               
               const fPass = facilityData.percentage >= targetVal;
               return `px-1 py-1 border border-slate-300 text-center text-xs font-semibold whitespace-nowrap cursor-pointer hover:brightness-95 transition-all ${
                  fPass ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'
               }`;
            }
          }
        })
      ),
      columnHelper.accessor('targetValue', {
         id: 'target',
         header: () => (
           <div className="flex flex-col items-center leading-tight">
             <span>เป้าหมาย</span>
           </div>
         ),
         cell: info => `≥ ${info.getValue() || 80}`,
         meta: {
            className: "md:sticky right-0 z-10 px-1 py-1 border border-slate-300 text-center text-xs w-[80px] min-w-[80px] font-bold text-slate-800 bg-white",
            headerClassName: "md:sticky right-0 z-20 px-1 py-2 border border-slate-400 w-[80px] text-center min-w-[80px] bg-blue-300 font-bold text-slate-900 text-xs"
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
      <div className="overflow-x-auto shadow-sm rounded-none max-w-full border border-slate-400 bg-white mb-10 w-full">
         {/* Table Actions Header */}
         <div className="px-4 py-2 bg-slate-50 border-b border-slate-300 flex justify-between items-center sticky left-0 z-10 w-full mb-0">
            <div>
               <h3 className="font-bold text-slate-800 font-prompt text-sm">KPI Performance Table</h3>
            </div>
            <button 
               onClick={handleExport}
               disabled={isExporting}
               className={`flex items-center gap-1.5 px-3 py-1 text-white text-xs font-semibold rounded shadow-sm transition-all active:scale-95 font-prompt ${
                  isExporting ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
               }`}
            >
               {isExporting ? (
                  <>
                    <span className="hidden md:inline">Exporting...</span>
                  </>
               ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Export Excel</span>
                  </>
               )}
            </button>
         </div>

         {/* Use Shadcn-style Table Components */}
         <Table className="w-full text-sm text-left border-collapse">
            <TableHeader className="bg-blue-200">
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                  {headerGroup.headers.map(header => {
                     const meta: any = header.column.columnDef.meta || {};
                     const className = meta.getHeaderClassName ? meta.getHeaderClassName() : meta.headerClassName;
                     
                     return (
                      <TableHead key={header.id} className={className}>
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
                <TableRow key={row.id} className="bg-white hover:bg-transparent border-none">
                  {row.getVisibleCells().map(cell => {
                     const meta: any = cell.column.columnDef.meta || {};
                     const className = meta.getCellClassName ? meta.getCellClassName(row) : meta.className;
                     
                     return (
                      <TableCell key={cell.id} className={className}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
         </Table>
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
