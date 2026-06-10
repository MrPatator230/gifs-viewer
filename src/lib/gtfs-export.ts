import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GtfsRoute, GtfsData, GtfsCalendar } from "./gtfs-parser";
import { getStopPlatform } from "./gtfs-parser";
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
  meta: ExportMeta,
  data: GtfsData,
  holidayServices: Set<string>
): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  // Index stop_times by trip & stops by id
  const stopTimesByTrip = new Map<string, typeof data.stopTimes>();
  for (const st of data.stopTimes) {
    let arr = stopTimesByTrip.get(st.trip_id);
    if (!arr) { arr = []; stopTimesByTrip.set(st.trip_id, arr); }
    arr.push(st);
  }
  for (const arr of stopTimesByTrip.values()) {
    arr.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  }
  const stopsById = new Map(data.stops.map((s) => [s.stop_id, s]));

  function fmtT(t: string): string {
    if (!t) return "";
    const [h, m] = t.split(":");
    return `${h?.padStart(2, "0")}h${(m || "").padStart(2, "0")}`;
  }

  trips.forEach((et, idx) => {
    if (idx > 0) doc.addPage();

    const trip = et.trip;
    let y = 16;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const dirLabel = trip.direction_id === "0" ? "Aller" : trip.direction_id === "1" ? "Retour" : trip.direction_id || "—";
    doc.text(
      `Ligne ${route.route_short_name || ""} — Train ${trip.trip_short_name || trip.trip_id}`,
      marginX, y
    );
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (route.route_long_name) {
      doc.text(route.route_long_name, marginX, y);
      y += 5;
    }
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(
      `Direction : ${dirLabel}   ·   ${et.firstStop.name} (${et.firstStop.time}) → ${et.lastStop.name} (${et.lastStop.time})`,
      marginX, y
    );
    y += 4;
    if (trip.trip_headsign) {
      doc.text(`Destination : ${trip.trip_headsign}`, marginX, y);
      y += 4;
    }
    doc.setTextColor(0);
    y += 2;

    // Days of circulation badges
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Jours de circulation", marginX, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const badgeW = 14;
    const badgeH = 7;
    DAY_KEYS.forEach((d, i) => {
      const x = marginX + i * (badgeW + 2);
      const active = et.days[d];
      doc.setFillColor(active ? 37 : 235, active ? 99 : 235, active ? 235 : 235);
      doc.setDrawColor(200);
      doc.roundedRect(x, y, badgeW, badgeH, 1, 1, "FD");
      doc.setTextColor(active ? 255 : 110);
      doc.text(d, x + badgeW / 2, y + 4.8, { align: "center" });
    });
    // Holiday badge
    const hx = marginX + 7 * (badgeW + 2) + 4;
    const isHoliday = holidayServices.has(trip.service_id);
    doc.setFillColor(isHoliday ? 217 : 235, isHoliday ? 119 : 235, isHoliday ? 6 : 235);
    doc.setDrawColor(200);
    doc.roundedRect(hx, y, badgeW + 14, badgeH, 1, 1, "FD");
    doc.setTextColor(isHoliday ? 255 : 110);
    doc.text(isHoliday ? "Fériés ✓" : "Fériés ✗", hx + (badgeW + 14) / 2, y + 4.8, { align: "center" });
    doc.setTextColor(0);
    y += badgeH + 6;

    // Service period
    const cal = data.calendar.find((c) => c.service_id === trip.service_id);
    if (cal) {
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(
        `Période de service : ${formatGtfsDate(cal.start_date)} → ${formatGtfsDate(cal.end_date)}   ·   service_id : ${trip.service_id}`,
        marginX, y
      );
      doc.setTextColor(0);
      y += 5;
    }

    // Comment
    const comment = (trip.trip_desc || trip.trip_note || "").trim();
    if (comment) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      const lines = doc.splitTextToSize(`« ${comment} »`, pageWidth - marginX * 2);
      doc.text(lines, marginX, y);
      y += lines.length * 4 + 2;
      doc.setFont("helvetica", "normal");
    }

    // Itinerary table
    const sts = stopTimesByTrip.get(trip.trip_id) || [];
    const body = sts.map((st, i) => {
      const stop = stopsById.get(st.stop_id);
      const arr = fmtT(st.arrival_time);
      const dep = fmtT(st.departure_time);
      return [
        String(i + 1).padStart(2, "0"),
        stop?.stop_name || st.stop_id,
        arr,
        dep,
        getStopPlatform(st, stop),
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX, bottom: 18 },
      head: [["#", "Arrêt", "Arrivée", "Départ", "Voie"]],
      body,
      styles: { fontSize: 8.5, cellPadding: 1.6 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
      },
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(
      `${meta.fileName}${meta.feedVersion ? " · v" + meta.feedVersion : ""}   ·   ${idx + 1} / ${trips.length}`,
      pageWidth / 2, pageHeight - 8, { align: "center" }
    );
    doc.setTextColor(0);
  });

  const name = (route.route_short_name || route.route_id).replace(/[^\w-]+/g, "_");
  doc.save(`horaires_${name}.pdf`);
}
