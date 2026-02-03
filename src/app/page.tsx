import { fetchMophReport, fetchHospitalMap, fetchKPIMaster, fetchTambonMap } from "@/lib/moph-api";
import KPITable from "@/components/KPITable";
import { KPIReportType } from "@/lib/types";

 

export default async function Home() {
  // 1. Fetch Configuration & Hospital Map AND Reports in parallel?
  // No, we need config first to know what to fetch.
  
  const [kpiConfig, hospitalMap, tambonMap] = await Promise.all([
     fetchKPIMaster(),
     fetchHospitalMap(),
     fetchTambonMap()
  ]);

  // 2. Fetch Reports based on Config
  // If config is empty (sheet not created yet?), fallback to hardcoded defaults or show empty?
  // Let's fallback to current defaults if empty for safety during transition
  let overallData = [];

  if (kpiConfig.length > 0) {
     const reportPromises = kpiConfig.map(async (kpi) => {
        const data = await fetchMophReport(kpi.table_name as KPIReportType, kpi.title);
        data.targetValue = kpi.target;
        data.link = kpi.link;
        return data;
     });
     overallData = await Promise.all(reportPromises);
  } else {
    // Fallback Code (Delete later once confirmed working)
    const anc12Data = await fetchMophReport('s_kpi_anc12', '1. ร้อยละหญิงตั้งครรภ์ได้รับการฝากครรภ์ครั้งแรกก่อนหรือเท่ากับ 12 สัปดาห์');
    anc12Data.targetValue = 73; 

    const foodData = await fetchMophReport('s_kpi_food', '2. ร้อยละของเด็กแรกเกิด - ต่ำกว่า 6 เดือน กินนมแม่อย่างเดียว');
    foodData.targetValue = 50; 

    const childData = await fetchMophReport('s_kpi_child_specialpp', '3. ร้อยละของเด็กอายุ 0-5 ปี มีพัฒนาการสมวัย');
    childData.targetValue = 86;

    overallData = [anc12Data, foodData, childData];
  }

  // Calculate Max Data Date
  let maxDateStr = '';
  overallData.forEach(r => {
     if (r.data && r.data.length > 0) {
        r.data.forEach(d => {
           if (d.date_com && d.date_com > maxDateStr) {
              maxDateStr = d.date_com;
           }
        });
     }
  });

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return 'N/A';
      
      let d = new Date();
      const str = String(dateStr).trim();
      
      // Handle YYYYMMDDHHmm or YYYYMMDD
      if (/^\d{8,}$/.test(str)) {
         const year = parseInt(str.substring(0, 4));
         const month = parseInt(str.substring(4, 6)) - 1; 
         const day = parseInt(str.substring(6, 8));
         // Optional time
         const hour = str.length >= 10 ? parseInt(str.substring(8, 10)) : 0;
         const minute = str.length >= 12 ? parseInt(str.substring(10, 12)) : 0;
         d = new Date(year, month, day, hour, minute);
      } else {
         // Fallback try standard parse
         const parsed = new Date(dateStr);
         if (!isNaN(parsed.getTime())) d = parsed;
      }
      
      return d.toLocaleDateString('th-TH', { 
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const lastUpdated = maxDateStr ? formatDate(maxDateStr) : 'N/A';

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">PA Dashboard - 2569</h1>
            <p className="text-slate-500 mt-1">คณะกรรมการประสานงานสาธารณสุขระดับอำเภอสอง</p>
          </div>
          <div className="text-xs text-slate-500">
            Data Date: {lastUpdated}
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-4 bg-slate-100 border-b border-slate-200">
                <h2 className="font-semibold text-slate-700">PP & P Excellence</h2>
             </div>
             <KPITable data={overallData} hospitalMap={hospitalMap} tambonMap={tambonMap} />
        </div>

      </div>
    </main>
  );
}
