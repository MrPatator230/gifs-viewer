import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface StopPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  arrival: string;
  departure: string;
  sequence: number;
}

interface Props {
  stops: StopPoint[];
  routeColor: string;
}

export function StopsMap({ stops, routeColor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([46.5, 2.5], 6);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear previous layers (markers + lines)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    if (stops.length === 0) return;

    const latlngs: L.LatLngTuple[] = stops.map((s) => [s.lat, s.lon]);

    L.polyline(latlngs, {
      color: routeColor,
      weight: 4,
      opacity: 0.8,
    }).addTo(map);

    stops.forEach((s, i) => {
      const isFirst = i === 0;
      const isLast = i === stops.length - 1;
      const size = isFirst || isLast ? 14 : 10;
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${isFirst || isLast ? routeColor : "#fff"};
          border:2px solid ${routeColor};
          box-shadow:0 0 4px rgba(0,0,0,0.5);
        "></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      L.marker([s.lat, s.lon], { icon })
        .bindPopup(
          `<strong>${s.name}</strong><br/>${s.arrival}${
            s.arrival !== s.departure ? ` → ${s.departure}` : ""
          }<br/><span style="opacity:0.7">#${String(s.sequence).padStart(2, "0")}</span>`
        )
        .addTo(map);
    });

    map.fitBounds(L.latLngBounds(latlngs), { padding: [20, 20] });
  }, [stops, routeColor]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="h-64 w-full rounded-md border border-border" />;
}
