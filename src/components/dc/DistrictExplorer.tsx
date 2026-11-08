"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { flushSync, preconnect } from "react-dom";
import { formatCount } from "@/lib/dc/format";
import type { DcCatalog, HomePopulation, PopulationTotals } from "@/lib/dc/types";
import PopulationPyramid from "./PopulationPyramid";
import PopulationTable from "./PopulationTable";

type Area = DcCatalog["areas"][number];
type Hospital = DcCatalog["hospitals"][number];

// Leaflet needs the browser, so the map is left out of the page's HTML and
// its JavaScript, and loads after it (CODING_STANDARDS §4). Next.js accepts
// ssr: false only in a client component, hence this wrapper.
const DistrictMap = dynamic(() => import("./DistrictMap"), { ssr: false });

const TILE_SERVER = "https://tile.openstreetmap.org";

/**
 * The map and ตำบล picker of the home page (SPEC §9.2): pick a ตำบล on the
 * map or with its button to see its หน่วยบริการ, from hospitals.tambon_id
 * in catalog.json, and ดูภาพรวมอำเภอ for the whole อำเภอ. The buttons work
 * without the map, as when its tiles or boundaries cannot load. With
 * population, the panel shows the population of what is picked, and the
 * ประชากรรายตำบล table below, labelled with source, picks a ตำบล too. Under
 * the table, the population pyramid is of what is picked, when the year has
 * age rows. Without population, the page is as in phase 1.
 */
export default function DistrictExplorer({
  areas,
  hospitals,
  population,
  source,
}: {
  areas: Area[];
  hospitals: Hospital[];
  population: HomePopulation | null;
  source: string;
}) {
  // A map tile is the largest paint on a phone (LCP, SPEC §9.6): the page's
  // <head> opens the tile server's connection before Leaflet has loaded.
  preconnect(TILE_SERVER);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "failed">("loading");
  const heading = useRef<HTMLHeadingElement>(null);
  const area = areas.find((a) => a.id === selected);
  const areaHospitals = hospitals.filter((h) => h.tambon_id === selected);
  const title = area ? `ตำบล${area.name_th}` : "ภาพรวมอำเภอสอง";
  // The population of what the panel shows: the ตำบล picked, or the อำเภอ.
  const panelPopulation = area ? population?.areas.find((a) => a.key === area.id) : population?.district;

  // ดูข้อมูล in the table, far below the panel: pick the ตำบล, then bring the
  // panel's heading into view and focus it, as R6 does. The panel is drawn
  // first, so the scroll lands where it ends up.
  function showInPanel(id: string) {
    flushSync(() => setSelected(id));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.current?.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
    heading.current?.focus({ preventScroll: true });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1.48fr)_minmax(300px,0.83fr)] lg:gap-5">
      <section aria-labelledby="map-title" className="min-w-0 overflow-hidden rounded-[10px] border border-dc-border bg-white">
        <div className="flex flex-col gap-2 border-b border-dc-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            <h2 id="map-title" className="font-prompt text-lg font-semibold text-dc-navy">
              แผนที่เขตการปกครองอำเภอสอง
            </h2>
            <p className="text-xs text-dc-muted">ขอบเขตรายตำบลจาก MOPH GIS บนแผนที่ OpenStreetMap</p>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="min-h-10 self-start rounded-md border border-dc-border bg-white px-3 text-xs font-bold whitespace-nowrap text-dc-blue hover:bg-dc-blue-light"
          >
            <span aria-hidden="true">↺</span> ดูภาพรวมอำเภอ
          </button>
        </div>
        <div className="relative h-[345px] sm:h-[410px] lg:h-[500px]">
          <DistrictMap
            areas={areas}
            tileServer={TILE_SERVER}
            selected={selected}
            onSelect={setSelected}
            onLoad={(ok) => setMapStatus(ok ? "ready" : "failed")}
          />
          {mapStatus !== "ready" && (
            <p role="status" className="absolute inset-0 z-10 flex items-center justify-center bg-dc-canvas px-5 text-center text-dc-muted">
              {mapStatus === "loading" ? "กำลังโหลดแผนที่…" : "โหลดขอบเขตตำบลไม่สำเร็จ เลือกตำบลจากรายชื่อได้"}
            </p>
          )}
        </div>
      </section>

      <aside aria-labelledby="area-title" className="flex min-w-0 flex-col rounded-[10px] border border-dc-border bg-white">
        <div className="border-b border-dc-border px-4 pt-4 pb-3 sm:px-5">
          <h2 id="area-title" className="font-prompt text-lg font-semibold text-dc-navy">
            เลือกตำบล
          </h2>
          <p className="text-xs text-dc-muted">เลือกชื่อตำบล หรือคลิกพื้นที่บนแผนที่</p>
        </div>
        <div role="group" aria-label="ตำบลในอำเภอสอง" className="grid grid-cols-2 gap-1.5 p-2.5 sm:grid-cols-4 md:grid-cols-1 lg:grid-cols-2">
          {areas.map((a, i) => {
            const on = a.id === selected;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(a.id)}
                className={`flex min-h-11 min-w-0 items-center justify-between gap-1.5 rounded-[5px] border px-2.5 text-left text-[13px] ${
                  on
                    ? "border-dc-teal bg-dc-teal/10 font-bold text-dc-navy shadow-[inset_3px_0_0_var(--color-dc-teal)]"
                    : "border-dc-border/60 text-dc-ink hover:bg-dc-blue-light"
                }`}
              >
                <span className="min-w-0">
                  <span aria-hidden="true" className="mr-1.5 text-[11px] font-bold text-dc-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {a.name_th}
                </span>
                <span aria-hidden="true" className="text-dc-muted">
                  ›
                </span>
              </button>
            );
          })}
        </div>
        <div className="m-3.5 mt-auto rounded-[7px] border border-t-[3px] border-dc-border border-t-dc-teal bg-dc-blue-light/60 px-4 py-3.5">
          <p className="text-[11px] font-bold text-dc-teal">ข้อมูลพื้นที่ที่เลือก</p>
          <h3 ref={heading} tabIndex={-1} className="font-prompt text-lg font-semibold text-dc-navy">
            {title}
          </h3>
          {area ? (
            <>
              <p className="text-xs text-dc-muted">
                รหัสตำบล {area.id} · หน่วยบริการ {areaHospitals.length} แห่ง
              </p>
              {panelPopulation && <PopulationRows totals={panelPopulation.totals} />}
              {areaHospitals.length > 0 ? (
                <ul className="mt-2.5">
                  {areaHospitals.map((h) => (
                    <li key={h.hospcode} className="flex justify-between gap-3 border-t border-dc-border py-1.5 text-[13px]">
                      <span className="font-semibold text-dc-ink">{h.hospname}</span>
                      <span className="text-xs text-dc-muted tabular-nums">รหัส {h.hospcode}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2.5 border-t border-dc-border pt-2 text-xs text-dc-muted">ไม่พบหน่วยบริการของตำบลนี้</p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-dc-muted">
                {areas.length} ตำบล · หน่วยบริการ {hospitals.length} แห่ง
              </p>
              {panelPopulation && <PopulationRows totals={panelPopulation.totals} />}
              <p className="mt-2.5 border-t border-dc-border pt-2 text-xs text-dc-muted">เลือกตำบลเพื่อดูรายชื่อหน่วยบริการ</p>
            </>
          )}
          <p role="status" className="sr-only">
            {area ? `เลือก${title}` : title}
            {panelPopulation && ` ประชากร ${formatCount(panelPopulation.totals.total)} คน`}
            {area && ` หน่วยบริการ ${areaHospitals.length} แห่ง`}
          </p>
        </div>
      </aside>

      {population && (
        <div className="md:col-span-2">
          <PopulationTable
            population={population}
            source={source}
            selected={selected}
            pickable={(id) => areas.some((a) => a.id === id)}
            onView={showInPanel}
          />
        </div>
      )}
      {panelPopulation?.age && (
        <div className="md:col-span-2">
          <PopulationPyramid areaName={title} age={panelPopulation.age} source={source} />
        </div>
      )}
    </div>
  );
}

// ประชากรทั้งหมด, ชาย / หญิง and จำนวนบ้าน of the area the panel shows, as R6's panel has them.
function PopulationRows({ totals }: { totals: PopulationTotals }) {
  const rows = [
    ["ประชากรทั้งหมด", `${formatCount(totals.total)} คน`],
    ["ชาย / หญิง", `${formatCount(totals.male)} / ${formatCount(totals.female)}`],
    ["จำนวนบ้าน", `${formatCount(totals.house)} บ้าน`],
  ];
  return (
    <dl className="mt-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-2.5 border-t border-dc-border py-1.5 text-xs text-dc-muted">
          <dt>{label}</dt>
          <dd className="font-prompt text-[15px] font-semibold whitespace-nowrap text-dc-navy tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
