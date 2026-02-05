import React from 'react';
import { KPISummary } from '@/lib/types';
import { Target, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

interface KPISummaryStatsProps {
  data: KPISummary[];
}

export default function KPISummaryStats({ data }: KPISummaryStatsProps) {
  const total = data.length;
  const passed = data.filter(kpi => {
     const target = kpi.targetValue || 80;
     return kpi.percentage >= target;
  }).length;
  const failed = total - passed;
  const successRate = total > 0 ? (passed / total) * 100 : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {/* 1. Total Indicators */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
         <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <Target className="w-5 h-5" />
         </div>
         <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">ตัวชี้วัดทั้งหมด</p>
            <p className="text-2xl font-bold text-slate-800 font-prompt">{total}</p>
         </div>
      </div>

      {/* 2. Success Rate */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
         <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <TrendingUp className="w-5 h-5" />
         </div>
         <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">อัตราผ่านเกณฑ์</p>
            <p className="text-2xl font-bold text-indigo-700 font-prompt">{successRate.toFixed(1)}%</p>
         </div>
      </div>

      {/* 3. Passed */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
         <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
         </div>
         <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">ผ่านเกณฑ์</p>
            <p className="text-2xl font-bold text-emerald-700 font-prompt">{passed}</p>
         </div>
      </div>

      {/* 4. Failed */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
         <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertCircle className="w-5 h-5" />
         </div>
         <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">ต้องปรับปรุง</p>
            <p className="text-2xl font-bold text-rose-700 font-prompt">{failed}</p>
         </div>
      </div>
    </div>
  );
}
