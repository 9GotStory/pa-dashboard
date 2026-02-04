import { Suspense } from 'react';
import { CalendarClock } from "lucide-react";
import { fetchBatchReports, fetchHospitalMap, fetchKPIMaster, fetchTambonMap } from "@/lib/moph-api";
import KPITable from "@/components/KPITable";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import PulseIndicator from "@/components/PulseIndicator";
import DataStatusNotifier from "@/components/DataStatusNotifier";
import { KPIMaster, KPISummary, MophReportData } from "@/lib/types";

// Async Component for the Data-Heavy part
async function DashboardContent({ 
  kpiConfig, 
  hospitalMap, 
  tambonMap 
}: { 
  kpiConfig: KPIMaster[], 
  hospitalMap: any, 
  tambonMap: any 
}) {
  let overallData: KPISummary[] = [];
  
  if (kpiConfig.length > 0) {
      // 1 Request (Batch)
      overallData = await fetchBatchReports(kpiConfig);
  } else {
     // No KPI Config - Return empty (Grid will show "No Data" state)
     overallData = [];
  }

  // Calculate Date
  let maxDateStr = '';
  overallData.forEach(r => {
     if (r.data && r.data.length > 0) {
        r.data.forEach(d => {
           if (d.date_com && d.date_com > maxDateStr) maxDateStr = d.date_com;
        });
     }
  });

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return 'N/A';
      if (/^\d{12}$/.test(String(dateStr))) {
          const str = String(dateStr);
          const d = new Date(
            parseInt(str.substring(0, 4)),
            parseInt(str.substring(4, 6)) - 1,
            parseInt(str.substring(6, 8)),
            parseInt(str.substring(8, 10)),
            parseInt(str.substring(10, 12))
          );
          return d.toLocaleDateString('th-TH', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
          }) + ' น.';
      }
      return 'N/A';
    } catch { return 'N/A'; }
  };
  
  const formattedDate = formatDate(maxDateStr);
  
  return (
    <>
      <DataStatusNotifier recordCount={overallData.length} />
      
      <div className="flex justify-end -mt-10 mb-4 px-1 items-center gap-2">
         {/* Pulse Indicator now sits here next to date */}
         <PulseIndicator lastUpdated={formattedDate} />
         <div className="flex items-center gap-1.5 bg-white/50 px-2.5 py-1 rounded-full border border-slate-100 shadow-sm">
            <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-600 font-prompt">{formattedDate}</span>
         </div>
      </div>

       <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
           <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700 font-prompt text-lg flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-500 rounded-full inline-block"></span>
                PP & P Excellence
              </h2>
           </div>
          <KPITable data={overallData} hospitalMap={hospitalMap} tambonMap={tambonMap} />
      </div>
    </>
  );
}

export default async function Home() {
  // Parallel fetch of LIGHTWEIGHT config
  const [kpiConfig, hospitalMap, tambonMap] = await Promise.all([
     fetchKPIMaster(),
     fetchHospitalMap(),
     fetchTambonMap()
  ]);

  return (
    <main className="min-h-screen bg-slate-50/50 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pb-12">
        
        {/* APP SHELL (Static Header) - Sticky & Glassmorphism */}
        <header className="sticky top-0 z-40 -mx-4 px-4 md:-mx-8 md:px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm mb-8 transition-all">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-7xl mx-auto">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-brand-700 font-prompt tracking-tight">PA Dashboard</h1>
              <p className="text-slate-500 text-sm font-medium mt-0.5">คณะกรรมการประสานงานสาธารณสุขระดับอำเภอสอง</p>
            </div>
          </div>
        </header>

        {/* ASYNC CONTENT (Streaming) */}
        <Suspense fallback={<DashboardSkeleton />}>
           <DashboardContent 
              kpiConfig={kpiConfig} 
              hospitalMap={hospitalMap} 
              tambonMap={tambonMap} 
           />
        </Suspense>

      </div>
    </main>
  );
}
