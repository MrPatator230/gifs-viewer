import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GtfsRoute } from "./gtfs-parser";
import type { EnrichedTrip } from "@/components/gtfs/VisualizationStep";

const DAY_KEYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportTripsCSV(route: GtfsRoute, trips: EnrichedTrip[]) {
  const headers = [
    "N° train",
    "Direction",
    "Départ",
    "Heure départ",
    "Arrivée",
    "Heure arrivée",
    ...DAY_KEYS,
  ];
  const rows = trips.map((et) => [
    et.trip.trip_short_name || "",
    et.trip.direction_id === "0" ? "Aller" : et.trip.direction_id === "1" ? "Retour" : et.trip.direction_id || "",
    et.firstStop.name,
    et.firstStop.time,
    et.lastStop.name,
    et.lastStop.time,
    ...DAY_KEYS.map((d) => (et.days[d] ? "X" : "")),
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map(csvEscape).join(";"))
    .join("\n");
  const name = (route.route_short_name || route.route_id).replace(/[^\w-]+/g, "_");
  downloadBlob("\ufeff" + csv, `horaires_${name}.csv`, "text/csv;charset=utf-8");
}

export function exportTripsPDF(route: GtfsRoute, trips: EnrichedTrip[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  const title = `Horaires — ${route.route_short_name || ""} ${route.route_long_name || ""}`.trim();
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(`${trips.length} horaires`, 14, 20);

  autoTable(doc, {
    startY: 25,
    head: [[
      "N° train",
      "Direction",
      "Départ",
      "Heure",
      "Arrivée",
      "Heure",
      ...DAY_KEYS,
    ]],
    body: trips.map((et) => [
      et.trip.trip_short_name || "",
      et.trip.direction_id === "0" ? "Aller" : et.trip.direction_id === "1" ? "Retour" : et.trip.direction_id || "",
      et.firstStop.name,
      et.firstStop.time,
      et.lastStop.name,
      et.lastStop.time,
      ...DAY_KEYS.map((d) => (et.days[d] ? "●" : "—")),
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  const name = (route.route_short_name || route.route_id).replace(/[^\w-]+/g, "_");
  doc.save(`horaires_${name}.pdf`);
}
