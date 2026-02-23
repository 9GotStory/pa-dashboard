"use client";

import { useState, useMemo } from "react";
import { CalendarClock } from "lucide-react";
import KPITable from "@/components/KPITable";
import KPICardList from "@/components/KPICardList";
import KPISummaryStats from "@/components/KPISummaryStats";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import DashboardFilter from "@/components/DashboardFilter";

import DataStatusNotifier from "@/components/DataStatusNotifier";
import { useKPIData } from "@/lib/useKPIData";
import { KPIMaster } from "@/lib/types";

export default function Home() {
  const {
    data,
    hospitalMap,
    tambonMap,
    kpiMasterList,
    isLoading,
    error,
    lastUpdated,
  } = useKPIData();

  // Multi-Checkbox Filter States
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [selectedKPIs, setSelectedKPIs] = useState<string[]>([]);

  // Filter Data based on Selected KPIs
  const filteredData = useMemo(() => {
    if (selectedKPIs.length === 0) return data;
    return data.filter((kpi) => selectedKPIs.includes(kpi.tableName));
  }, [data, selectedKPIs]);

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

  // Create a fallback KPI list if kpiMasterList is not available directly from useKPIData yet
  // Extracting from 'data' is a safe fallback.
  const dynamicKPIList: KPIMaster[] =
    kpiMasterList && kpiMasterList.length > 0
      ? kpiMasterList
      : data.map((d) => ({
          table_name: d.tableName,
          title: d.title,
          target: d.targetValue,
          order: 0,
        }));

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

        {/* MULTI-CHECKBOX FILTER */}
        <DashboardFilter
          hospitalMap={hospitalMap}
          kpiList={dynamicKPIList}
          selectedFacilities={selectedFacilities}
          selectedKPIs={selectedKPIs}
          onFacilitiesChange={setSelectedFacilities}
          onKPIsChange={setSelectedKPIs}
        />

        {/* 2. SUMMARY STATS (Inverted Pyramid Level 1) */}
        <KPISummaryStats
          data={filteredData}
          selectedFacilities={selectedFacilities}
        />

        {/* 3. DETAILED REPORT (Inverted Pyramid Level 2) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 md:overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <KPITable
              data={filteredData}
              hospitalMap={hospitalMap}
              tambonMap={tambonMap}
              selectedFacilities={selectedFacilities}
            />
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-4 bg-slate-50/50">
            <KPICardList
              data={filteredData}
              hospitalMap={hospitalMap}
              tambonMap={tambonMap}
              selectedFacilities={selectedFacilities}
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
