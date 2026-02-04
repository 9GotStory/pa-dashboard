import React from 'react';
import { KPISummary } from '@/lib/types';
import { ExternalLink, Calendar, CalendarClock, ChevronRight } from "lucide-react";

interface KPICardProps {
  kpi: KPISummary;
  onClick: (kpi: KPISummary) => void;
}

export const KPICard: React.FC<KPICardProps> = ({ kpi, onClick }) => {
  const isRawCount = kpi.totalTarget === 0;
  const targetVal = kpi.targetValue || 80;
  const isPass = kpi.percentage >= targetVal;
  
  const period = kpi.period;
  const isQuarter = period && period.includes("(Q");

  return (
    <div 
      onClick={() => onClick(kpi)}
      className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm active:scale-[0.99] transition-transform cursor-pointer"
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex-1">
           <div className="flex items-start gap-2">
              <h3 className="text-sm font-semibold text-slate-800 font-prompt leading-tight line-clamp-2">
                {kpi.title}
              </h3>
              {kpi.link && <ExternalLink className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />}
           </div>
           {/* Period Badge */}
           {period && (
              <div className="flex items-center gap-1.5 mt-2">
                 {isQuarter ? (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20">
                       <CalendarClock className="w-3 h-3" />
                       {period}
                    </span>
                 ) : (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/20">
                       <Calendar className="w-3 h-3" />
                       {period}
                    </span>
                 )}
              </div>
           )}
        </div>
        
        {/* Pass/Fail Indicator Icon */}
        <div className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${isPass ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      </div>

      {/* Main Stats */}
      <div className="flex items-end justify-between border-t border-slate-50 pt-3">
         <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Performance</p>
            <div className="flex items-baseline gap-1.5">
               <span className={`text-2xl font-bold font-prompt ${isPass ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isRawCount ? kpi.totalResult.toLocaleString() : kpi.percentage.toFixed(2)}
               </span>
               {!isRawCount && <span className="text-xs text-slate-500 font-medium">%</span>}
            </div>
         </div>
         
         <div className="text-right">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Target ≥ {targetVal}</p>
            <div className="text-xs text-slate-600 mt-0.5 font-medium flex items-center justify-end gap-1">
               <span>R: {kpi.totalResult.toLocaleString()}</span>
               <span className="text-slate-300">/</span>
               <span>T: {kpi.totalTarget.toLocaleString()}</span>
            </div>
         </div>
      </div>
    </div>
  );
};
