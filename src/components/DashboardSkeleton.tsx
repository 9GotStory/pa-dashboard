import React from 'react';

export default function DashboardSkeleton() {
  return (
    <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
      {/* Header Skeleton */}
      <div className="p-4 bg-slate-100 border-b border-slate-200">
        <div className="h-6 bg-slate-200 rounded w-1/4"></div>
      </div>
      
      {/* Table Skeleton */}
      <div className="p-4 space-y-4">
        {/* Rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4">
             <div className="h-4 bg-slate-200 rounded w-1/3"></div>
             <div className="h-4 bg-slate-200 rounded w-1/6"></div>
             <div className="h-4 bg-slate-200 rounded w-1/6"></div>
             <div className="h-4 bg-slate-200 rounded w-1/6"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
