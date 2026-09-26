"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

type Pt = { lat: number; lng: number };
export type MapData = {
  origin: Pt & { city: string };
  destination: Pt & { city: string };
  current: Pt & { progress: number; source: string };
  route: Pt[];
  events: { id: number; label: string; lat: number | null; lng: number | null; location: string | null }[];
  delivered: boolean;
};

const pin = (bg: string, label: string) =>
  `<div style="display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;background:${bg};color:#fff;font-size:14px;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.3)">${label}</div>`;

/** Interactive OpenStreetMap view of the shipment (Leaflet, loaded client-side only). */
export function TrackingMap({ data }: { data: MapData }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map.current);
      }
      layer.current?.remove();
      const g = L.layerGroup().addTo(map.current);
      layer.current = g;
      const icon = (bg: string, label: string) => L.divIcon({ html: pin(bg, label), className: "", iconSize: [30, 30], iconAnchor: [15, 15] });

      const route = data.route.map((p) => [p.lat, p.lng] as [number, number]);
      const doneIdx = Math.round((data.current.progress / 100) * (route.length - 1));
      L.polyline(route, { color: "#94a3b8", weight: 4, dashArray: "6 8" }).addTo(g);
      if (doneIdx > 0) L.polyline(route.slice(0, doneIdx + 1), { color: "#117e48", weight: 5 }).addTo(g);

      data.events.filter((e) => e.lat !== null && e.lng !== null).forEach((e) => {
        L.circleMarker([e.lat!, e.lng!], { radius: 5, color: "#fff", weight: 2, fillColor: "#d9a514", fillOpacity: 1 }).bindTooltip(`${e.label}${e.location ? ` · ${e.location}` : ""}`).addTo(g);
      });
      L.marker([data.origin.lat, data.origin.lng], { icon: icon("#0b5030", "🌾") }).bindPopup(`<b>Farm</b><br>${data.origin.city}`).addTo(g);
      L.marker([data.destination.lat, data.destination.lng], { icon: icon("#0369a1", "🏁") }).bindPopup(`<b>Destination</b><br>${data.destination.city}`).addTo(g);
      if (!data.delivered) {
        L.marker([data.current.lat, data.current.lng], { icon: icon("#d97706", "🚚"), zIndexOffset: 1000 })
          .bindPopup(`<b>Truck</b><br>${data.current.progress}% of route · ${data.current.source === "gps" ? "live GPS" : data.current.source === "simulated" ? "estimated position" : "at origin"}`)
          .addTo(g);
      }
      map.current.fitBounds(L.latLngBounds(route).pad(0.25));
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => () => {
    map.current?.remove();
    map.current = null;
  }, []);

  return <div ref={el} className="h-[380px] w-full overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-white/10" role="region" aria-label="Shipment map" />;
}
