"use client";

import { RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { preconnect } from "react-dom";
import { formatCount } from "@/lib/dc/format";
import type { DcCatalog, HomePopulation, PopulationTotals } from "@/lib/dc/types";
import PopulationComparison from "./PopulationComparison";
import PopulationPyramid from "./PopulationPyramid";

type Area = DcCatalog["areas"][number];
type Hospital = DcCatalog["hospitals"][number];

// Leaflet needs the browser, so the map is left out of the page's HTML and
// its JavaScript, and loads after it (CODING_STANDARDS §4). Next.js accepts
// ssr: false only in a client component, hence this wrapper.
const DistrictMap = dynamic(() => import("./DistrictMap"), { ssr: false });

const TILE_SERVER = "https://tile.openstreetmap.org";

/**
 * The ข้อมูลพื้นที่ section of the home page (SPEC §9.2) and the parts below
 * it that follow the ตำบลที่เลือก: the one value of the page, an areas[].id
 * or null for the whole อำเภอ, set on the map, in เลือกตำบล or with a bar or
 * a row of the เปรียบเทียบประชากรรายตำบล section, and back to null with
 * ล้างการเลือก.
 * เลือกตำบล works without the map, as when its tiles or boundaries cannot
 * load. The panel shows the population of what is picked and, for a ตำบล,
 * the หน่วยบริการ located in it (its ตำบลที่ตั้ง, hospitals.tambon_id in
 * catalog.json); for the อำเภอ, only how many there are. With population,
 * the comparison, labelled with source, comes next, then the โครงสร้างประชากร
 * of what is picked when the year has age rows. Without population, the
 * panel has no population rows and neither follows. A pick from the
 * comparison stays where it is: its bar or row shows the pick.
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
  const area = areas.find((a) => a.id === selected);
  const areaHospitals = hospitals.filter((h) => h.tambon_id === selected);
  const title = area ? `ตำบล${area.name_th}` : "ภาพรวมอำเภอสอง";
  // What the pyramid names: the ตำบล picked, or the อำเภอ as เลือกตำบล names it.
  const scope = area ? title : "ทั้งอำเภอสอง";
  // The population of what the panel shows: the ตำบล picked, or the อำเภอ.
  const panelPopulation = area ? population?.areas.find((a) => a.key === area.id) : population?.district;

  return (
    <div className="flex flex-col gap-5">
      <section id="area" aria-labelledby="area-title" className="min-w-0">
        <h2 id="area-title" className="font-prompt text-lg font-semibold text-dc-brand-deep">
          สำรวจข้อมูลในพื้นที่
        </h2>
        <p className="text-xs text-dc-text-secondary">เลือกตำบลจากแผนที่หรือรายการ เพื่อดูประชากรและหน่วยบริการที่ตั้งอยู่ในตำบลนั้น</p>
        <div className="mt-3 grid overflow-hidden rounded-[10px] border border-dc-border-subtle bg-dc-surface lg:grid-cols-[minmax(0,1.48fr)_minmax(300px,0.83fr)]">
          <div className="relative h-[345px] min-w-0 border-b border-dc-border-subtle sm:h-[410px] lg:h-[500px] lg:border-r lg:border-b-0">
            <DistrictMap
              areas={areas}
              tileServer={TILE_SERVER}
              selected={selected}
              onSelect={setSelected}
              onLoad={(ok) => setMapStatus(ok ? "ready" : "failed")}
            />
            {mapStatus !== "ready" && (
              <p role="status" className="absolute inset-0 z-10 flex items-center justify-center bg-dc-canvas px-5 text-center text-dc-text-secondary">
                {mapStatus === "loading" ? "กำลังโหลดแผนที่…" : "โหลดขอบเขตตำบลไม่สำเร็จ เลือกตำบลจากรายการได้"}
              </p>
            )}
          </div>

          <div className="flex min-w-0 flex-col px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="area-select" className="font-prompt font-semibold text-dc-brand-deep">
                เลือกตำบล
              </label>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-dc-brand-primary hover:underline"
              >
                <RotateCcw className="size-3.5" />
                ล้างการเลือก
              </button>
            </div>
            <select
              id="area-select"
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value || null)}
              className="min-h-11 w-full rounded-md border border-dc-border-subtle bg-dc-canvas px-3 text-sm font-semibold text-dc-brand-deep"
            >
              <option value="">ทั้งอำเภอสอง</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name_th}
                </option>
              ))}
            </select>

            <div className="mt-5">
              <h3 className="font-prompt text-lg font-semibold text-dc-brand-deep">
                {title}
              </h3>
              {area ? (
                <>
                  <p className="text-xs text-dc-text-secondary">รหัสตำบล {area.id}</p>
                  {panelPopulation && <PopulationRows totals={panelPopulation.totals} />}
                  <h4 className="mt-4 text-xs font-bold text-dc-brand-deep">
                    หน่วยบริการที่ตั้งอยู่ใน{title} {areaHospitals.length} แห่ง
                  </h4>
                  {areaHospitals.length > 0 ? (
                    <ul className="mt-1">
                      {areaHospitals.map((h) => (
                        <li
                          key={h.hospcode}
                          className="flex justify-between gap-3 border-t border-dc-border-subtle py-2 text-[13px] first:border-t-0"
                        >
                          <span className="font-semibold text-dc-brand-deep">{h.hospname}</span>
                          <span className="text-xs whitespace-nowrap text-dc-text-secondary tabular-nums">รหัส {h.hospcode}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-dc-text-secondary">ไม่มีหน่วยบริการที่ตั้งอยู่ในตำบลนี้</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-dc-text-secondary">
                    {areas.length} ตำบล · หน่วยบริการ {hospitals.length} แห่ง
                  </p>
                  {panelPopulation && <PopulationRows totals={panelPopulation.totals} />}
                  <p className="mt-4 text-xs text-dc-text-secondary">เลือกตำบลเพื่อดูหน่วยบริการที่ตั้งอยู่ในตำบลนั้น</p>
                </>
              )}
              <p role="status" className="sr-only">
                {area ? `เลือก${title}` : title}
                {panelPopulation && ` ประชากร ${formatCount(panelPopulation.totals.total)} คน`}
                {area && ` หน่วยบริการที่ตั้งอยู่ในตำบล ${areaHospitals.length} แห่ง`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {population && (
        <PopulationComparison
          population={population}
          source={source}
          selected={selected}
          pickable={(id) => areas.some((a) => a.id === id)}
          onPick={setSelected}
        />
      )}
      {panelPopulation?.age && (
        <PopulationPyramid
          scope={scope}
          age={panelPopulation.age}
          source={source}
          onClear={() => setSelected(null)}
        />
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
        <div key={label} className="flex items-baseline justify-between gap-2.5 border-t border-dc-border-subtle py-1.5 text-xs text-dc-text-secondary">
          <dt>{label}</dt>
          <dd className="font-prompt text-[15px] font-semibold whitespace-nowrap text-dc-brand-deep tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
