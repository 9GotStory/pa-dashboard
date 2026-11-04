"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { preconnect, preload } from "react-dom";
import type { DcCatalog } from "@/lib/dc/types";

type Area = DcCatalog["areas"][number];
type Hospital = DcCatalog["hospitals"][number];

// Leaflet needs the browser, so the map is left out of the page's HTML and
// its JavaScript, and loads after it (CODING_STANDARDS §4). Next.js accepts
// ssr: false only in a client component, hence this wrapper.
const DistrictMap = dynamic(() => import("./DistrictMap"), { ssr: false });

/**
 * The map and ตำบล picker of the home page (SPEC §9.2): pick a ตำบล on the
 * map or with its button to see its หน่วยบริการ, from hospitals.tambon_id
 * in catalog.json; pick it again, or ดูภาพรวมอำเภอ, for the whole อำเภอ. The
 * buttons work without the map, as when its tiles or boundaries cannot load.
 */
export default function DistrictExplorer({ areas, hospitals }: { areas: Area[]; hospitals: Hospital[] }) {
  // A map tile is the largest paint on a phone (LCP, SPEC §9.6). The page's
  // <head> starts the boundaries' download and the tile server's connection,
  // so neither waits for Leaflet; the map's fetch takes the preloaded file.
  preload("/geo/song-tambon.geojson", { as: "fetch", crossOrigin: "anonymous" });
  preconnect("https://tile.openstreetmap.org");
  const [selected, setSelected] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "failed">("loading");
  const toggle = (id: string) => setSelected((current) => (current === id ? null : id));
  const area = areas.find((a) => a.id === selected);
  const units = hospitals.filter((h) => h.tambon_id === selected);

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
          <DistrictMap areas={areas} selected={selected} onSelect={toggle} onLoad={(ok) => setMapStatus(ok ? "ready" : "failed")} />
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
                onClick={() => toggle(a.id)}
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
          <h3 className="font-prompt text-lg font-semibold text-dc-navy">{area ? `ตำบล${area.name_th}` : "ภาพรวมอำเภอสอง"}</h3>
          {area ? (
            <>
              <p className="text-xs text-dc-muted">
                รหัสตำบล {area.id} · หน่วยบริการ {units.length} แห่ง
              </p>
              {units.length > 0 ? (
                <ul className="mt-2.5">
                  {units.map((h) => (
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
              <p className="mt-2.5 border-t border-dc-border pt-2 text-xs text-dc-muted">เลือกตำบลเพื่อดูรายชื่อหน่วยบริการ</p>
            </>
          )}
          <p role="status" className="sr-only">
            {area ? `เลือกตำบล${area.name_th} หน่วยบริการ ${units.length} แห่ง` : "ภาพรวมอำเภอสอง"}
          </p>
        </div>
      </aside>
    </div>
  );
}
