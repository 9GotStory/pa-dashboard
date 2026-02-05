import { Suspense } from 'react';
import { CalendarClock } from "lucide-react";
import { fetchBatchReports, fetchHospitalMap, fetchKPIMaster, fetchTambonMap } from "@/lib/moph-api";
import KPITable from "@/components/KPITable";
import KPICardList from "@/components/KPICardList";
import KPISummaryStats from "@/components/KPISummaryStats";
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
      
      {/* 1. HEADER & META ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4 mb-8">
         <div>
            <h1 className="text-2xl font-bold text-brand-700 font-prompt tracking-tight">PA Dashboard</h1>
            <p className="text-slate-500 text-sm font-medium mt-0.5">คณะกรรมการประสานงานสาธารณสุขระดับอำเภอสอง</p>
         </div>
         
         <div className="flex items-center gap-3">
             <PulseIndicator lastUpdated={formattedDate} />
             <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-600 font-prompt">{formattedDate}</span>
             </div>
         </div>
      </div>

      {/* 2. SUMMARY STATS (Inverted Pyramid Level 1) */}
      <KPISummaryStats data={overallData} />

      {/* 3. DETAILED REPORT (Inverted Pyramid Level 2) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* Desktop Table View */}
          <div className="hidden md:block">
             <KPITable data={overallData} hospitalMap={hospitalMap} tambonMap={tambonMap} />
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-4 bg-slate-50/50">
             <KPICardList data={overallData} hospitalMap={hospitalMap} tambonMap={tambonMap} />
          </div>
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
      <div className="w-[98%] max-w-none mx-auto px-2 md:px-4 pb-12">
        
        {/* HEADER REMOVED - Moved to Content Flow */}

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
