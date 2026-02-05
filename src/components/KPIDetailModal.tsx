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
        className="absolute inset-0 bg-neutral-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200
        w-[95vw] max-h-[90vh] 
        md:w-full md:max-w-4xl 
        landscape:max-h-[95vh] landscape:w-[90vw] lg:landscape:max-w-5xl">
        
        {/* Header */}
        <div className="bg-white border-b border-neutral-100 px-4 py-4 md:px-6 md:py-5 flex items-center justify-between shrink-0">
          <div className="overflow-hidden mr-4">
            <h3 className="text-base md:text-lg font-bold text-neutral-800 truncate">{facilityName}</h3>
            <p className="text-xs md:text-sm text-neutral-500 truncate">{title}</p>
            {lastUpdated && (
               <p className="text-[10px] md:text-xs text-neutral-400 mt-0.5">
                 ข้อมูลล่าสุด: {formatDate(lastUpdated)}
               </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 md:p-2 hover:bg-neutral-200 rounded-full transition-colors text-neutral-500 hover:text-neutral-700 shrink-0"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body (Table) */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white">
          <table className="w-full text-sm text-left relative">
            <thead className="bg-neutral-50/95 backdrop-blur text-neutral-500 font-semibold sticky top-0 shadow-sm z-10 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 md:px-6 md:py-3 border-b text-left whitespace-nowrap">Sub-district</th>
                <th className="px-2 py-2 md:px-6 md:py-3 border-b text-right whitespace-nowrap">Target</th>
                <th className="px-2 py-2 md:px-6 md:py-3 border-b text-right whitespace-nowrap">Result</th>
                <th className="px-2 py-2 md:px-6 md:py-3 border-b text-center whitespace-nowrap">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
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
                   moo = ` ม.${m}`;
                }

                return (
                  <tr key={idx} className="hover:bg-brand-50/10 transition-colors border-b border-neutral-50 last:border-none">
                    <td className="px-3 py-2 md:px-6 md:py-3 font-medium text-neutral-700 truncate max-w-[120px] md:max-w-none">
                       {tambonName !== '-' ? `ต.${tambonName}${moo}` : '-'}
                    </td>
                    <td className="px-2 py-2 md:px-6 md:py-3 text-right text-neutral-600">{fmt(t)}</td>
                    <td className="px-2 py-2 md:px-6 md:py-3 text-right text-neutral-800 font-medium">{fmt(r)}</td>
                    <td className="px-2 py-2 md:px-6 md:py-3 text-center">
                      {!isRaw ? (
                        <span className={`inline-block px-1.5 py-0.5 md:px-2 md:py-1 rounded text-xs font-bold whitespace-nowrap ring-1 ring-inset ${
                          isPass ? 'bg-success-50 text-success-700 ring-success-600/20' : 'bg-error-50 text-error-700 ring-error-600/20'
                        }`}>
                          {pct.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-neutral-400 text-xs">(N/A)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 md:px-6 md:py-12 text-center text-neutral-400 italic">
                    No detailed records found for this facility.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="bg-neutral-50 px-4 py-2 md:px-6 md:py-3 border-t border-neutral-200 text-xs text-neutral-500 flex justify-between shrink-0">
           <span>Total: {data.length}</span>
           <span>T: {fmt(totalT)} | R: {fmt(totalR)}</span>
        </div>
      </div>
    </div>
  );
};
