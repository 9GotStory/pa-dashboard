"use client";

import React, { useState } from 'react';
import { KPISummary } from '@/lib/types';
import { KPICard } from './KPICard';
import { KPIDetailModal } from './KPIDetailModal';

interface KPICardListProps {
  data: KPISummary[];
  hospitalMap?: Record<string, { name: string; tambon_id: string }>;
  tambonMap?: Record<string, string>;
}

export default function KPICardList({ data, hospitalMap = {}, tambonMap = {} }: KPICardListProps) {
  // Modal State (Duplicated from Table, but simpler for Mobile)
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    facilityName: string;
    data: any[];
    targetValue: number;
    tableName: string;
  }>({
    isOpen: false,
    title: '',
    facilityName: '',
    data: [],
    targetValue: 0,
    tableName: ''
  });

  const openDrillDown = (kpi: KPISummary) => {
      // For Mobile Card click, we might want to show the "Overall District" breakdown or logic?
      // Wait, the original drill-down was "Facility Specific".
      // If user clicks a KPI Card (which represents the WHOLE DISTRICT average), 
      // they probably want to see the "Ranking of all Facilities" for that KPI.
      
      // However, the current modal is designed to show "Villages for ONE Facility".
      // Let's adapt: If card clicked => Show breakdown by Hospital???
      // Actually, standard dashboards usually let you drill from "District KPI" -> "List of Hospitals".
      
      // BUT current backend data structure for `breakdown` is { hospcode: { target, result } }.
      // So we can show a list of hospitals easily!
      
      // Let's implement a specific MOBILE VIEW interaction:
      // Clicking the card doesn't open the Village modal (that's too deep).
      // It should probably do nothing for now OR show a simple "Hospital Ranking" (future).
      // User request was just "Mobile Card View" to replace table.
      
      // Actually, let's keep it simple. If they click, maybe they want to see the metadata?
      // For now, let's make it clickable but maybe just show a Toast or "Coming Soon" for drilldown?
      // OR, re-use logic: "Overall District" isn't a facility.
      
      // wait, let's re-read implementation plan. "Interaction: Tap card to open Drill-down Modal."
      // OK, I'll pass the *District Total* data? No, that doesn't make sense.
      // Re-reading `KPITable`: drill-down is triggered by clicking a *Facility Cell*.
      // In Mobile Card, we are seeing the *District Summary*.
      // So logically, clicking it should show *Per-Facility Breakdown*.
      
      // Current `KPIDetailModal` expects `data: MophReportData[]`.
      // The `KPISummary.data` contains ALL rows for that KPI.
      // So if we pass `kpi.data` to the modal, it will show ALL villages in the district.
      // That works!
      
      setModalState({
         isOpen: true,
         title: kpi.title,
         facilityName: 'ภาพรวมอำเภอ', // "District Overview"
         data: kpi.data, // All raw data for this KPI
         targetValue: kpi.targetValue || 80,
         tableName: kpi.tableName
      });
  };

  return (
    <>
      <div className="flex flex-col gap-3 pb-8">
        {data.map((kpi, index) => (
          <KPICard 
            key={index} 
            kpi={kpi} 
            onClick={() => openDrillDown(kpi)}
          />
        ))}
      </div>

      <KPIDetailModal 
         isOpen={modalState.isOpen}
         onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
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
