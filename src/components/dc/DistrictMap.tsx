"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { AreaBoundary, DcCatalog } from "@/lib/dc/types";

type Area = DcCatalog["areas"][number];
type Drawn = { map: L.Map; paths: Map<string, L.Polygon>; bounds: L.LatLngBounds };

// V7.6's map: every ตำบล in dc-brand-accent and the selected one in
// dc-brand-primary, outlined in dc-brand-deep. The colours are classes on each
// path, switched by data-selected; Leaflet sets the line widths and fill
// opacities.
const PATH =
  "fill-dc-brand-accent stroke-dc-brand-primary data-selected:fill-dc-brand-primary data-selected:stroke-dc-brand-deep";
const PLAIN: L.PathOptions = { weight: 1.9, fillOpacity: 0.25 };
const HOVER: L.PathOptions = { weight: 2.7, fillOpacity: 0.42 };
const SELECTED: L.PathOptions = { weight: 3.5, fillOpacity: 0.55 };

/**
 * The map of the home page (SPEC §9.2): the ตำบล of
 * public/geo/song-tambon.geojson over OpenStreetMap tiles from tileServer,
 * named from catalog.json's areas. Each ตำบล is a button named for it, in
 * the tab order, that Enter or Space picks as a click does (design.md §8). A
 * pick on the map leaves the view where it is; a pick from elsewhere moves
 * the map to that ตำบล, or to the whole อำเภอ when none is picked, as in R6.
 * onLoad says whether the boundaries loaded. Leaflet needs the browser, so
 * DistrictExplorer loads this file on its own, after the page.
 */
export default function DistrictMap({
  areas,
  tileServer,
  selected,
  onSelect,
  onLoad,
}: {
  areas: Area[];
  tileServer: string;
  selected: string | null;
  onSelect: (id: string) => void;
  onLoad: (ok: boolean) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const fromMap = useRef(false);
  const pick = useEffectEvent((id: string) => {
    // The ตำบล on show already: no change, so no effect run to clear the flag
    if (id === selected) return;
    fromMap.current = true;
    onSelect(id);
  });
  const hover = useEffectEvent((id: string, path: L.Polygon, over: boolean) => {
    if (id !== selected) path.setStyle(over ? HOVER : PLAIN);
  });
  const loaded = useEffectEvent(onLoad);

  useEffect(() => {
    const map = L.map(box.current!, { zoomControl: false, scrollWheelZoom: false });
    L.control.zoom({ position: "bottomright", zoomInTitle: "ขยายแผนที่", zoomOutTitle: "ย่อแผนที่" }).addTo(map);
    L.tileLayer(`${tileServer}/{z}/{x}/{y}.png`, {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    let ignore = false;
    fetch("/geo/song-tambon.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`/geo/song-tambon.geojson: HTTP ${res.status}`);
        return res.json() as Promise<GeoJSON.FeatureCollection<GeoJSON.Geometry, AreaBoundary>>;
      })
      // A failed load shows its message; an error while drawing is a bug and stays uncaught.
      .then(
        (data) => {
          if (ignore) return;
          const names = new Map(areas.map((a) => [a.id, a.name_th]));
          const paths = new Map<string, L.Polygon>();
          const boundaries = L.geoJSON<AreaBoundary>(data, {
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
                // The path's element exists once the map has a view, after this.
                add: () => {
                  const el = path.getElement() as SVGPathElement;
                  el.setAttribute("tabindex", "0");
                  el.setAttribute("role", "button");
                  el.setAttribute("aria-label", `ตำบล${names.get(id)}`);
                  // The svg holds the ตำบล buttons, so it is a named group, not a picture.
                  el.ownerSVGElement!.setAttribute("role", "group");
                  el.ownerSVGElement!.setAttribute("aria-label", "ตำบลในอำเภอสอง");
                },
                keydown: ({ originalEvent: e }: L.LeafletKeyboardEvent) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  // Space would scroll the page
                  e.preventDefault();
                  pick(id);
                },
              });
            },
          }).addTo(map);
          setDrawn({ map, paths, bounds: boundaries.getBounds() });
          loaded(true);
        },
        () => {
          if (!ignore) loaded(false);
        },
      );
    return () => {
      ignore = true;
      map.remove();
    };
  }, [areas, tileServer]);

  useEffect(() => {
    if (!drawn) return;
    const area = selected ? drawn.paths.get(selected) : undefined;
    // The view first: the paths have elements to mark only once the map has one.
    if (fromMap.current) fromMap.current = false;
    else {
      drawn.map.fitBounds(area?.getBounds() ?? drawn.bounds, {
        padding: [24, 24],
        maxZoom: area ? 12 : 11,
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
    }
    for (const [id, path] of drawn.paths) {
      const el = path.getElement()!;
      el.toggleAttribute("data-selected", id === selected);
      el.setAttribute("aria-pressed", String(id === selected));
      path.setStyle(id === selected ? SELECTED : PLAIN);
    }
  }, [drawn, selected]);

  // Leaflet's own stylesheet is not in a cascade layer, so it beats the
  // utilities its classes clash with unless they are marked important (!).
  return (
    <div
      ref={box}
      role="region"
      aria-label="แผนที่ขอบเขตตำบลอำเภอสอง"
      className="isolate h-full bg-dc-canvas! font-dc!"
    />
  );
}
