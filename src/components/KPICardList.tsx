"use client";

import { useState } from "react";
import { KPISummary, MophReportData } from "@/lib/types";
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

  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    facilityName: string;
    data: MophReportData[];
    targetValue: number;
  }>({
    isOpen: false,
    title: "",
    facilityName: "",
    data: [],
    targetValue: 0,
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
        tambonMap={tambonMap}
      />
    </>
  );
}
