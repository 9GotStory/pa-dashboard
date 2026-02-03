import { Suspense } from 'react';
import { fetchBatchReports, fetchHospitalMap, fetchKPIMaster, fetchTambonMap, fetchMophReport } from "@/lib/moph-api";
import KPITable from "@/components/KPITable";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { KPIMaster } from "@/lib/types";

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
  let overallData = [];
  
  if (kpiConfig.length > 0) {
      // 1 Request (Batch)
      overallData = await fetchBatchReports(kpiConfig);
  } else {
     // Fallback
      const anc12Data = await fetchMophReport('s_kpi_anc12', '1. ร้อยละหญิงตั้งครรภ์ได้รับการฝากครรภ์ครั้งแรกก่อนหรือเท่ากับ 12 สัปดาห์');
      anc12Data.targetValue = 73; 
      const foodData = await fetchMophReport('s_kpi_food', '2. ร้อยละของเด็กแรกเกิด - ต่ำกว่า 6 เดือน กินนมแม่อย่างเดียว');
      foodData.targetValue = 50; 
      const childData = await fetchMophReport('s_childdev_specialpp', '3. ร้อยละของเด็กอายุ 0-5 ปี มีพัฒนาการสมวัย');
      childData.targetValue = 86;
      overallData = [anc12Data, foodData, childData];
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
            day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
          });
      }
      return 'N/A';
    } catch { return 'N/A'; }
  };

  return (
    <>
      <div className="flex justify-end -mt-10 mb-4 px-1">
         <div className="text-xs text-slate-500 bg-white/50 px-2 py-1 rounded">
            Data Date: {formatDate(maxDateStr)}
         </div>
      </div>

      <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-100 border-b border-slate-200">
             <h2 className="font-semibold text-slate-700 font-prompt">PP & P Excellence</h2>
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
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* APP SHELL (Static Header) - Renders Instantly */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[60px]">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 font-prompt">PA Dashboard - 2569</h1>
            <p className="text-slate-500 mt-1">คณะกรรมการประสานงานสาธารณสุขระดับอำเภอสอง</p>
          </div>
        </div>

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
