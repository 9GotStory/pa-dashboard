"use client";

import { CalendarClock } from "lucide-react";
import KPITable from "@/components/KPITable";
import KPICardList from "@/components/KPICardList";
import KPISummaryStats from "@/components/KPISummaryStats";
import DashboardSkeleton from "@/components/DashboardSkeleton";

import DataStatusNotifier from "@/components/DataStatusNotifier";
import { useKPIData } from "@/lib/useKPIData";

export default function Home() {
  const { data, hospitalMap, tambonMap, isLoading, error, lastUpdated } =
    useKPIData();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50/50 font-[family-name:var(--font-geist-sans)]">
        <div className="w-[98%] max-w-none mx-auto px-2 md:px-4 pb-12">
          <DashboardSkeleton />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50/50 font-[family-name:var(--font-geist-sans)]">
        <div className="w-[98%] max-w-none mx-auto px-2 md:px-4 pb-12">
          <div className="mt-20 text-center">
            <p className="text-error-600 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              ลองใหม่
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 font-[family-name:var(--font-geist-sans)]">
      <div className="w-[98%] max-w-none mx-auto px-2 md:px-4 pb-12">
        <DataStatusNotifier recordCount={data.length} />

        {/* 1. HEADER & META ACTIONS */}
        <div className="mt-6 mb-8 text-center md:text-left">
          <div>
            <h1 className="text-2xl font-bold text-brand-700 font-prompt tracking-tight">
              PA Dashboard
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-0.5">
              คณะกรรมการประสานงานสาธารณสุขระดับอำเภอสอง
            </p>
          </div>
        </div>

        {/* 2. SUMMARY STATS (Inverted Pyramid Level 1) */}
        <KPISummaryStats data={data} />

        {/* 3. DETAILED REPORT (Inverted Pyramid Level 2) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <KPITable
              data={data}
              hospitalMap={hospitalMap}
              tambonMap={tambonMap}
            />
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-4 bg-slate-50/50">
            <KPICardList
              data={data}
              hospitalMap={hospitalMap}
              tambonMap={tambonMap}
            />
          </div>
        </div>

        {/* 4. FOOTER META (Moved from Top) */}
        <div className="mt-8 flex justify-center items-center gap-3 pb-8 opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5 bg-white/50 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm backdrop-blur-sm">
            <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 font-prompt">
              อัปเดตล่าสุด: {lastUpdated || "N/A"}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
