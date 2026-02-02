import React from 'react';
import { MophReportData } from '@/lib/types';
import { calculateKPIValue } from '@/lib/kpi-utils';

interface KPIDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  facilityName: string;
  data: MophReportData[];
  targetValue: number;
  tableName: string;
  tambonMap?: Record<string, string>;
}

export const KPIDetailModal: React.FC<KPIDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  facilityName,
  data,
  targetValue,
  tableName,
  tambonMap = {}
}) => {
  if (!isOpen) return null;

  // Helper to format numbers with commas
  const fmt = (n: number | undefined) => (n || 0).toLocaleString();
  
  // Helper to safely calc pct
  const calcPct = (t: number, r: number) => t > 0 ? (r / t) * 100 : 0;

  // Helper to get Tambon Name
  // Helper to get Tambon Name
  const getTambonName = (areacode: string) => {
     if (!areacode || areacode.length < 6) return '-';
     const tambonId = areacode.substring(0, 6);
     return tambonMap[tambonId] || '';
  };

  const totalT = data.reduce((acc, item) => acc + calculateKPIValue(item, tableName).t, 0);
  const totalR = data.reduce((acc, item) => acc + calculateKPIValue(item, tableName).r, 0);

  // Get Data Date
  const lastUpdated = data.length > 0 && data[0].date_com ? data[0].date_com : '';

  // Date formatter
  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      
      // Handle YYYYMMDDHHmm format (e.g., "202602021245")
      // If we pass this directly to new Date(), it parses as ms since epoch -> 1976!
      let d = new Date(dateStr);
      
      const str = String(dateStr).trim();
      if (/^\d{12}$/.test(str)) {
         const year = parseInt(str.substring(0, 4));
         const month = parseInt(str.substring(4, 6)) - 1; // 0-indexed
         const day = parseInt(str.substring(6, 8));
         const hour = parseInt(str.substring(8, 10));
         const minute = parseInt(str.substring(10, 12));
         d = new Date(year, month, day, hour, minute);
      } else if (!isNaN(Number(dateStr)) && Number(dateStr) > 20000000) {
         // Fallback if it's strictly a large number input (though regex covers standard case)
      }
      
      // Explicitly request ONLY date parts
      return d.toLocaleDateString('th-TH', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{facilityName}</h3>
            <p className="text-sm text-slate-500 truncate max-w-2xl">{title}</p>
            {lastUpdated && (
               <p className="text-xs text-slate-400 mt-1">
                 ข้อมูลล่าสุด: {formatDate(lastUpdated)}
               </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body (Table) */}
        <div className="p-0 max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-6 py-3 border-b text-left">Sub-district (Tambon)</th>
                <th className="px-6 py-3 border-b text-right">Target</th>
                <th className="px-6 py-3 border-b text-right">Result</th>
                <th className="px-6 py-3 border-b text-center">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item, idx) => {
                const { t, r } = calculateKPIValue(item, tableName);

                const pct = calcPct(t, r);
                const isPass = pct >= targetValue;
                const isRaw = t === 0;
                const tambonName = getTambonName(item.areacode as string);
                
                // Extract Moo (Village No) - last 2 digits
                let moo = '';
                if (item.areacode && item.areacode.length === 8) {
                   const m = parseInt(item.areacode.substring(6, 8));
                   moo = ` หมู่ ${m}`;
                }

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-700">
                       {tambonName !== '-' ? `ต.${tambonName}${moo}` : '-'}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-600">{fmt(t)}</td>
                    <td className="px-6 py-3 text-right text-slate-800 font-medium">{fmt(r)}</td>
                    <td className="px-6 py-3 text-center">
                      {!isRaw ? (
                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                          isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {pct.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">(N/A)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                    No detailed records found for this facility.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
           <span>Total Villages: {data.length}</span>
           <span>Sum Target: {fmt(totalT)} | Sum Result: {fmt(totalR)}</span>
        </div>
      </div>
    </div>
  );
};
