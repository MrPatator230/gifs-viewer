import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GtfsRoute, GtfsData, GtfsCalendar } from "./gtfs-parser";
import type { EnrichedTrip } from "@/components/gtfs/VisualizationStep";

export const DAY_KEYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export interface ExportMeta {
  fileName: string;
  feedPublisher?: string;
  feedVersion?: string;
  serviceStart?: string;
  serviceEnd?: string;
  directionFilter: string | null;
  totalCount: number;
  filteredCount: number;
}

export const EXPORT_HEADERS = [
  "N° train",
  "Direction",
  "Départ",
  "Heure départ",
  "Arrivée",
  "Heure arrivée",
  ...DAY_KEYS,
];

export function buildExportRows(trips: EnrichedTrip[]): string[][] {
  return trips.map((et) => [
    et.trip.trip_short_name || "",
    et.trip.direction_id === "0"
      ? "Aller"
      : et.trip.direction_id === "1"
        ? "Retour"
        : et.trip.direction_id || "",
    et.firstStop.name,
    et.firstStop.time,
    et.lastStop.name,
    et.lastStop.time,
    ...DAY_KEYS.map((d) => (et.days[d] ? "X" : "")),
  ]);
}

export function buildExportMeta(
  data: GtfsData,
  trips: EnrichedTrip[],
  filteredTrips: EnrichedTrip[],
  directionFilter: string | null
): ExportMeta {
  const serviceDates = data.calendar.reduce<{ start?: string; end?: string }>(
    (acc, c: GtfsCalendar) => {
      if (!acc.start || c.start_date < acc.start) acc.start = c.start_date;
      if (!acc.end || c.end_date > acc.end) acc.end = c.end_date;
      return acc;
    },
    {}
  );

  return {
    fileName: data.fileName,
    feedPublisher: data.feedInfo?.feed_publisher_name,
    feedVersion: data.feedInfo?.feed_version,
    serviceStart: data.feedInfo?.feed_start_date || serviceDates.start,
    serviceEnd: data.feedInfo?.feed_end_date || serviceDates.end,
    directionFilter,
    totalCount: trips.length,
    filteredCount: filteredTrips.length,
  };
}

function formatGtfsDate(d?: string): string {
  if (!d || d.length !== 8) return d || "—";
  return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
}

function metaLines(route: GtfsRoute, meta: ExportMeta): string[] {
  const dirLabel =
    meta.directionFilter === null
      ? "Toutes"
      : meta.directionFilter === "0"
        ? "Aller"
        : meta.directionFilter === "1"
          ? "Retour"
          : meta.directionFilter;
  return [
    `Ligne : ${route.route_short_name || ""} ${route.route_long_name || ""}`.trim(),
    `Fichier GTFS : ${meta.fileName}`,
    meta.feedPublisher ? `Éditeur : ${meta.feedPublisher}` : "",
    meta.feedVersion ? `Version : ${meta.feedVersion}` : "",
    `Période de service : ${formatGtfsDate(meta.serviceStart)} → ${formatGtfsDate(meta.serviceEnd)}`,
    `Filtre direction : ${dirLabel}`,
    `Horaires exportés : ${meta.filteredCount} / ${meta.totalCount}`,
    `Date d'export : ${new Date().toLocaleString("fr-FR")}`,
  ].filter(Boolean);
}

function csvEscape(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(content: string | Uint8Array, filename: string, mime: string) {
  const blob = new Blob([content as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportTripsCSV(
  route: GtfsRoute,
  trips: EnrichedTrip[],
  meta: ExportMeta
): Promise<void> {
  // Run as microtask so UI stays responsive on big datasets
  await new Promise((r) => setTimeout(r, 0));

  const lines: string[] = [];
  // Metadata header as CSV comment lines
  for (const ln of metaLines(route, meta)) {
    lines.push("# " + ln);
  }
  lines.push("");
  lines.push(EXPORT_HEADERS.map(csvEscape).join(";"));
  for (const row of buildExportRows(trips)) {
    lines.push(row.map(csvEscape).join(";"));
  }
  const csv = "\ufeff" + lines.join("\n");
  const name = (route.route_short_name || route.route_id).replace(/[^\w-]+/g, "_");
  downloadBlob(csv, `horaires_${name}.csv`, "text/csv;charset=utf-8");
}

export async function exportTripsPDF(
  route: GtfsRoute,
  trips: EnrichedTrip[],
  meta: ExportMeta
): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));

  const doc = new jsPDF({ orientation: "landscape" });
  const title = `Horaires — ${route.route_short_name || ""} ${route.route_long_name || ""}`.trim();
  doc.setFontSize(14);
  doc.text(title, 14, 14);

  doc.setFontSize(8);
  let y = 20;
  for (const ln of metaLines(route, meta).slice(1)) {
    doc.text(ln, 14, y);
    y += 4;
  }

  autoTable(doc, {
    startY: y + 3,
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
      et.trip.direction_id === "0"
        ? "Aller"
        : et.trip.direction_id === "1"
          ? "Retour"
          : et.trip.direction_id || "",
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
