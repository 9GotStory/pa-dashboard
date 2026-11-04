"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { DcCatalog } from "@/lib/dc/types";

type Area = DcCatalog["areas"][number];
/** The properties of a ตำบล in public/geo/song-tambon.geojson that the map uses (SCHEMA §8) */
type Boundary = { ADMIN_ID3: string };
type Drawn = { map: L.Map; paths: Map<string, L.Polygon>; bounds: L.LatLngBounds };

// R6's map: every ตำบล in dc-blue and the selected one in dc-teal. The colours
// are classes on each path, switched by data-selected; Leaflet sets the line
// widths and fill opacities.
const PATH = "fill-dc-blue stroke-dc-blue data-selected:fill-dc-teal data-selected:stroke-dc-teal";
const PLAIN: L.PathOptions = { weight: 1.9, fillOpacity: 0.25 };
const HOVER: L.PathOptions = { weight: 2.7, fillOpacity: 0.42 };
const SELECTED: L.PathOptions = { weight: 3.5, fillOpacity: 0.55 };

/**
 * The map of the home page (SPEC §9.2): the ตำบล of
 * public/geo/song-tambon.geojson over OpenStreetMap tiles, named from
 * catalog.json's areas. A click on a ตำบล picks it and leaves the view where
 * it is; a pick from elsewhere moves the map to that ตำบล, or to the whole
 * อำเภอ when none is picked, as in R6. onLoad says whether the boundaries
 * loaded. Leaflet needs the browser, so DistrictExplorer loads this file on
 * its own, after the page.
 */
export default function DistrictMap({
  areas,
  selected,
  onSelect,
  onLoad,
}: {
  areas: Area[];
  selected: string | null;
  onSelect: (id: string) => void;
  onLoad: (ok: boolean) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const fromMap = useRef(false);
  const pick = useEffectEvent((id: string) => {
    fromMap.current = true;
    onSelect(id);
  });
  const hover = useEffectEvent((id: string, path: L.Polygon, over: boolean) => {
    if (id !== selected) path.setStyle(over ? HOVER : PLAIN);
  });
  const loaded = useEffectEvent((ok: boolean) => onLoad(ok));

  useEffect(() => {
    const map = L.map(box.current!, { zoomControl: false, scrollWheelZoom: false });
    L.control.zoom({ position: "bottomright", zoomInTitle: "ขยายแผนที่", zoomOutTitle: "ย่อแผนที่" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    // The boundaries draw what the ตำบล buttons offer, so screen readers skip them.
    map.getPane("overlayPane")?.setAttribute("aria-hidden", "true");
    let live = true;
    fetch("/geo/song-tambon.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`/geo/song-tambon.geojson: HTTP ${res.status}`);
        return res.json() as Promise<GeoJSON.FeatureCollection<GeoJSON.Geometry, Boundary>>;
      })
      .then((data) => {
        if (!live) return;
        const names = new Map(areas.map((a) => [a.id, a.name_th]));
        const paths = new Map<string, L.Polygon>();
        const layer = L.geoJSON<Boundary>(data, {
          filter: (feature) => names.has(feature.properties.ADMIN_ID3),
          style: () => ({ ...PLAIN, className: PATH }),
          onEachFeature: (feature, layer) => {
            const id = feature.properties.ADMIN_ID3;
            const path = layer as L.Polygon;
            paths.set(id, path);
            path.bindTooltip(`ตำบล${names.get(id)}`, { sticky: true, direction: "top" });
            path.on({
              click: () => pick(id),
              mouseover: () => hover(id, path, true),
              mouseout: () => hover(id, path, false),
            });
          },
        }).addTo(map);
        setDrawn({ map, paths, bounds: layer.getBounds() });
        loaded(true);
      })
      .catch(() => {
        if (live) loaded(false);
      });
    return () => {
      live = false;
      map.remove();
    };
  }, [areas]);

  useEffect(() => {
    if (!drawn) return;
    for (const [id, path] of drawn.paths) {
      path.getElement()?.toggleAttribute("data-selected", id === selected);
      path.setStyle(id === selected ? SELECTED : PLAIN);
    }
    const area = selected ? drawn.paths.get(selected) : undefined;
    area?.bringToFront();
    if (fromMap.current) {
      fromMap.current = false;
      return;
    }
    drawn.map.fitBounds(area?.getBounds() ?? drawn.bounds, {
      padding: [24, 24],
      maxZoom: area ? 12 : 11,
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, [drawn, selected]);

  // Leaflet's own stylesheet is not in a cascade layer, so it beats the
  // utilities its classes clash with unless they are marked important (!).
  return (
    <div
      ref={box}
      role="region"
      aria-label="แผนที่ขอบเขตตำบลอำเภอสอง เลือกตำบลด้วยปุ่มรายชื่อตำบลได้"
      className="isolate h-full bg-dc-canvas! font-dc!"
    />
  );
}
