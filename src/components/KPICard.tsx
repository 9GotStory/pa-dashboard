import React from 'react';

interface KPICardProps {
  title: string;
  target: number;
  result: number;
  percentage: number;
  colorClass: string;
}

export default function KPICard({ title, target, result, percentage, colorClass }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 hover:shadow-lg transition-shadow duration-200">
      <h3 className="text-lg font-semibold text-slate-700 mb-2 min-h-[56px]">{title}</h3>
      
      <div className="flex items-end justify-between mb-4">
        <div>
          <span className={`text-4xl font-bold ${colorClass}`}>{percentage}%</span>
          <span className="text-slate-400 text-sm ml-2">Achievement</span>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Target</span>
          <span className="font-medium text-slate-700">{target.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Result</span>
          <span className="font-medium text-slate-700">{result.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${colorClass.replace('text-', 'bg-')}`} 
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
