"use client";

import React, { useState } from "react";
import { KPISummary } from "@/lib/types";
import { KPICard } from "./KPICard";
import { KPIDetailModal } from "./KPIDetailModal";

interface KPICardListProps {
  data: KPISummary[];
  hospitalMap?: Record<string, { name: string; tambon_id: string }>;
  tambonMap?: Record<string, string>;
}

export default function KPICardList({
  data,
  hospitalMap = {},
  tambonMap = {},
}: KPICardListProps) {
  // State for Facility Filter
  const [selectedFacility, setSelectedFacility] = useState<string>("all");

  // Helper to get Hospital Name
  const getFacilityName = (code: string) => {
    if (code === "all") return "ภาพรวมทั้งอำเภอ";
    return hospitalMap[code]?.name || code;
  };

  // Filtered Data Logic
  // We don't filter the *list of KPIs* (they remain the same).
  // We filter the *stats inside each KPI*.
  // But KPICard currently takes the whole `kpi` object.
  // We need to pass a `displayStat` prop to override if needed.

  // Sorted Facility List for Dropdown (by code or name)
  const facilities = Object.entries(hospitalMap).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );

  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    facilityName: string;
    data: any[];
    targetValue: number;
    tableName: string;
  }>({
    isOpen: false,
    title: "",
    facilityName: "",
    data: [],
    targetValue: 0,
    tableName: "",
  });

  const openDrillDown = (kpi: KPISummary) => {
    // If Global Filter is ALL -> Show District Overview (All Data)
    // If Global Filter is Specific -> Show Data for that Facility (Wait, modal expects Array of Records)

    let modalData = kpi.data;
    let modalTitle = "ภาพรวมอำเภอ";

    if (selectedFacility !== "all") {
      // Filter raw data for this facility
      modalData = kpi.data.filter((row) => row.hospcode === selectedFacility);
      modalTitle = getFacilityName(selectedFacility);
    }

    setModalState({
      isOpen: true,
      title: kpi.title,
      facilityName: modalTitle,
      data: modalData,
      targetValue: kpi.targetValue || 80,
      tableName: kpi.tableName,
    });
  };

  return (
    <>
      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur shadow-sm border-b border-slate-200 px-4 py-3 -mx-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-700 whitespace-nowrap">
            เลือกหน่วยบริการ:
          </span>
          <select
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block w-full p-2"
          >
            <option value="all">ภาพรวมทั้งอำเภอ</option>
            {facilities.map(([code, info]) => (
              <option key={code} value={code}>
                {info.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 pb-8">
        {data.map((kpi, index) => (
          <KPICard
            key={index}
            kpi={kpi}
            hospitalMap={hospitalMap}
            selectedFacility={selectedFacility}
            onClick={() => openDrillDown(kpi)}
          />
        ))}
      </div>

      <KPIDetailModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        facilityName={modalState.facilityName}
        data={modalState.data}
        targetValue={modalState.targetValue}
        tableName={modalState.tableName}
        tambonMap={tambonMap}
      />
    </>
  );
}
