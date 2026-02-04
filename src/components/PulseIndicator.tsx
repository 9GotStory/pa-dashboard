import React from 'react';
// Actually, sticking to simple Tailwind group-hover for now to avoid dev dependency issues if shadcn isn't fully setup.

export default function PulseIndicator({ lastUpdated }: { lastUpdated: string }) {
  return (
    <div className="group relative flex items-center">
      <span className="relative flex h-3 w-3 mr-2 cursor-help">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
      </span>
      
      {/* Tooltip */}
      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-max bg-slate-800 text-white text-xs rounded px-2 py-1 shadow-lg z-50">
         System Online • Last Sync: {lastUpdated}
         <div className="absolute left-1 top-full border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  );
}
