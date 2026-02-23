"use client";

import React, { useState } from "react";
import { KPISummary } from "@/lib/types";
import { KPICard } from "./KPICard";
import { KPIDetailModal } from "./KPIDetailModal";

interface KPICardListProps {
  data: KPISummary[];
  hospitalMap?: Record<string, { name: string; tambon_id: string }>;
  tambonMap?: Record<string, string>;
  selectedFacilities?: string[];
}

export default function KPICardList({
  data,
  hospitalMap = {},
  tambonMap = {},
  selectedFacilities = [],
}: KPICardListProps) {
  // Helper to get Hospital Name
  const getFacilityName = (code: string) => {
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
    let modalData = kpi.data;
    let modalTitle = "ภาพรวมอำเภอ";

    if (selectedFacilities.length > 0) {
      // Filter raw data for these facilities
      modalData = kpi.data.filter((row) =>
        selectedFacilities.includes(row.hospcode),
      );
      if (selectedFacilities.length === 1) {
        modalTitle = getFacilityName(selectedFacilities[0]);
      } else {
        modalTitle = `ข้อมูล ${selectedFacilities.length} หน่วยบริการ`;
      }
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
      <div className="flex flex-col gap-3 pb-8">
        {data.map((kpi, index) => (
          <KPICard
            key={index}
            kpi={kpi}
            hospitalMap={hospitalMap}
            selectedFacilities={selectedFacilities}
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
