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

// ============================================================
// Excel (.xlsx) export — matches the user's app import format
// ============================================================
import * as XLSX from "xlsx";
import { getTripNumber } from "./gtfs-parser";

export const XLSX_HEADERS = [
  "id",
  "numero_train",
  "type_train",
  "type_train_id",
  "gare_depart_id",
  "gare_depart_nom",
  "heure_depart",
  "gare_arrivee_id",
  "gare_arrivee_nom",
  "heure_arrivee",
  "circule_lundi",
  "circule_mardi",
  "circule_mercredi",
  "circule_jeudi",
  "circule_vendredi",
  "circule_samedi",
  "circule_dimanche",
  "circule_jours_feries",
  "circule_dimanches_feries",
  "jours_personnalises",
  "jours_personnalises_groupes",
  "jours_circulation",
  "jours_non_circulation",
  "materiel_roulant_id",
  "ligne_id",
  "ligne_nom",
  "service_annuel_id",
  "service_annuel_nom",
  "est_substitution",
  "motif_substitution",
  "actif",
  "created_at",
  "updated_at",
  "deleted_at",
  "gares_desservies",
  "composition_train",
  "substitution_disponible",
  "region_id",
];

function toHms(t?: string): string | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length < 2) return t;
  const h = parts[0].padStart(2, "0");
  const m = (parts[1] || "00").padStart(2, "0");
  const s = (parts[2] || "00").padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function gtfsToIso(d: string): string {
  if (!d || d.length !== 8) return d || "";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function isoAddDay(iso: string): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

const WEEKDAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/**
 * Build the `jours_personnalises` list from calendar_dates exceptions.
 * Only keeps dates deviating from the weekly pattern and collapses
 * consecutive same-type dates into a { debut, fin, circule } period.
 */
export function buildJoursPersonnalises(
  serviceId: string,
  calendarDates: { service_id: string; date: string; exception_type: string }[],
  weeklyDays: Record<string, boolean>
): Array<{ date: string; circule: boolean } | { debut: string; fin: string; circule: boolean }> {
  const items = calendarDates
    .filter((cd) => cd.service_id === serviceId)
    .map((cd) => {
      const iso = gtfsToIso(cd.date);
      const dt = new Date(iso + "T00:00:00Z");
      const weekday = WEEKDAY_LABELS[dt.getUTCDay()];
      const normallyRuns = !!weeklyDays[weekday];
      const circule = cd.exception_type === "1";
      return { iso, circule, exceptional: circule !== normallyRuns };
    })
    .filter((x) => x.exceptional)
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const out: Array<{ date: string; circule: boolean } | { debut: string; fin: string; circule: boolean }> = [];
  let i = 0;
  while (i < items.length) {
    let j = i;
    while (
      j + 1 < items.length &&
      items[j + 1].circule === items[i].circule &&
      isoAddDay(items[j].iso) === items[j + 1].iso
    ) {
      j++;
    }
    if (j > i) {
      out.push({ debut: items[i].iso, fin: items[j].iso, circule: items[i].circule });
    } else {
      out.push({ date: items[i].iso, circule: items[i].circule });
    }
    i = j + 1;
  }
  return out;
}

/**
 * Same as buildJoursPersonnalises but always returns grouped periods
 * ({debut, fin, circule}), even for a single day (debut === fin).
 */
export function buildJoursPersonnalisesGroupes(
  serviceId: string,
  calendarDates: { service_id: string; date: string; exception_type: string }[],
  weeklyDays: Record<string, boolean>
): Array<{ debut: string; fin: string; circule: boolean }> {
  const items = calendarDates
    .filter((cd) => cd.service_id === serviceId)
    .map((cd) => {
      const iso = gtfsToIso(cd.date);
      const dt = new Date(iso + "T00:00:00Z");
      const weekday = WEEKDAY_LABELS[dt.getUTCDay()];
      const normallyRuns = !!weeklyDays[weekday];
      const circule = cd.exception_type === "1";
      return { iso, circule, exceptional: circule !== normallyRuns };
    })
    .filter((x) => x.exceptional)
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const out: Array<{ debut: string; fin: string; circule: boolean }> = [];
  let i = 0;
  while (i < items.length) {
    let j = i;
    while (
      j + 1 < items.length &&
      items[j + 1].circule === items[i].circule &&
      isoAddDay(items[j].iso) === items[j + 1].iso
    ) {
      j++;
    }
    out.push({ debut: items[i].iso, fin: items[j].iso, circule: items[i].circule });
    i = j + 1;
  }
  return out;
}

/**
 * Compute every actual running date (ISO YYYY-MM-DD) for a service_id by
 * combining calendar.txt (weekly pattern + validity window) and
 * calendar_dates.txt (added = 1, removed = 2).
 */
export function buildJoursCirculation(
  serviceId: string,
  calendar: GtfsCalendar[],
  calendarDates: { service_id: string; date: string; exception_type: string }[]
): string[] {
  const set = new Set<string>();
  const cal = calendar.find((c) => c.service_id === serviceId);
  if (cal && cal.start_date && cal.end_date) {
    const weekly = [
      cal.sunday, cal.monday, cal.tuesday, cal.wednesday,
      cal.thursday, cal.friday, cal.saturday,
    ].map((v) => v === "1");
    let cur = gtfsToIso(cal.start_date);
    const end = gtfsToIso(cal.end_date);
    while (cur && cur <= end) {
      const dow = new Date(cur + "T00:00:00Z").getUTCDay();
      if (weekly[dow]) set.add(cur);
      cur = isoAddDay(cur);
    }
  }
  for (const cd of calendarDates) {
    if (cd.service_id !== serviceId) continue;
    const iso = gtfsToIso(cd.date);
    if (cd.exception_type === "1") set.add(iso);
    else if (cd.exception_type === "2") set.delete(iso);
  }
  return Array.from(set).sort();
}

export interface XlsxRowInput {
  et: EnrichedTrip;
  route: GtfsRoute;
  isHoliday: boolean;
  gtfsData: GtfsData;
}

export function buildXlsxRow({ et, route, isHoliday, gtfsData }: XlsxRowInput) {
  const trip = et.trip;



  const sts = gtfsData.stopTimes
    .filter((st) => st.trip_id === trip.trip_id)
    .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  const stopsById = new Map(gtfsData.stops.map((s) => [s.stop_id, s]));

  const gares = sts.map((st, i) => {
    const stop = stopsById.get(st.stop_id);
    const theoretical = getStopPlatform(st, stop) || null;
    return {
      ordre: i,
      gare_nom: stop?.stop_name || st.stop_id,
      heure_depart: i === sts.length - 1 ? null : toHms(st.departure_time),
      heure_arrivee: i === 0 ? null : toHms(st.arrival_time),
      quai: theoretical,
      quai_reel: null,
    };
  });

  // Days come from EnrichedTrip.days (covers calendar.txt AND calendar_dates-only services)
  const d = et.days || {};
  const lun = !!d.Lun;
  const mar = !!d.Mar;
  const mer = !!d.Mer;
  const jeu = !!d.Jeu;
  const ven = !!d.Ven;
  const sam = !!d.Sam;
  const dim = !!d.Dim;

  return {
    id: "",
    numero_train: getTripNumber(trip) || "",
    type_train: route.route_short_name || route.route_long_name || "",
    type_train_id: "",
    gare_depart_id: "",
    gare_depart_nom: et.firstStop.name,
    heure_depart: toHms(sts[0]?.departure_time) || "",
    gare_arrivee_id: "",
    gare_arrivee_nom: et.lastStop.name,
    heure_arrivee: toHms(sts[sts.length - 1]?.arrival_time) || "",
    circule_lundi: lun,
    circule_mardi: mar,
    circule_mercredi: mer,
    circule_jeudi: jeu,
    circule_vendredi: ven,
    circule_samedi: sam,
    circule_dimanche: dim,
    circule_jours_feries: isHoliday,
    circule_dimanches_feries: isHoliday && dim,

    jours_personnalises: JSON.stringify(
      buildJoursPersonnalises(trip.service_id, gtfsData.calendarDates, d)
    ),
    jours_personnalises_groupes: JSON.stringify(
      buildJoursPersonnalisesGroupes(trip.service_id, gtfsData.calendarDates, d)
    ),
    jours_circulation: JSON.stringify(
      buildJoursCirculation(trip.service_id, gtfsData.calendar, gtfsData.calendarDates)
    ),
    jours_non_circulation: "[]",
    materiel_roulant_id: "",
    ligne_id: route.route_id || "",
    ligne_nom: route.route_long_name || route.route_short_name || "",
    service_annuel_id: "",
    service_annuel_nom: "",
    est_substitution: false,
    motif_substitution: "",
    actif: true,
    created_at: "",
    updated_at: "",
    deleted_at: "",
    gares_desservies: JSON.stringify(gares),
    composition_train: "",
    substitution_disponible: false,
    region_id: "",
  };
}

export async function exportTripsXLSX(
  route: GtfsRoute,
  trips: EnrichedTrip[],
  gtfsData: GtfsData,
  holidayServices: Set<string>
): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));

  const rows = trips.map((et) =>
    buildXlsxRow({
      et,
      route,
      isHoliday: holidayServices.has(et.trip.service_id),
      gtfsData,
    })
  );

  const ws = XLSX.utils.json_to_sheet(rows, { header: XLSX_HEADERS });

  // Column widths for readability
  ws["!cols"] = XLSX_HEADERS.map((h) => {
    if (h === "gares_desservies") return { wch: 60 };
    if (h === "jours_circulation") return { wch: 60 };
    if (h === "jours_personnalises" || h === "jours_personnalises_groupes") return { wch: 40 };
    if (h.startsWith("circule_")) return { wch: 14 };
    if (h.startsWith("gare_")) return { wch: 22 };
    if (h.startsWith("heure_")) return { wch: 10 };
    return { wch: 16 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Horaires");

  // -------- Sheet "Contrôle" : diagnostic des jours de circulation --------
  const controlHeaders = [
    "trip_id",
    "numero_train",
    "service_id",
    "gare_depart_nom",
    "heure_depart",
    "gare_arrivee_nom",
    "heure_arrivee",
    "circule_lundi",
    "circule_mardi",
    "circule_mercredi",
    "circule_jeudi",
    "circule_vendredi",
    "circule_samedi",
    "circule_dimanche",
    "circule_jours_feries",
    "circule_dimanches_feries",
    "nb_jours_actifs",
    "source_jours",
  ];
  const controlRows = trips.map((et, i) => {
    const row = rows[i];
    const hasCal = !!gtfsData.calendar.find((c) => c.service_id === et.trip.service_id);
    const hasCalDates = gtfsData.calendarDates.some((cd) => cd.service_id === et.trip.service_id);
    const dayFlags = [
      row.circule_lundi, row.circule_mardi, row.circule_mercredi, row.circule_jeudi,
      row.circule_vendredi, row.circule_samedi, row.circule_dimanche,
    ];
    const nbActifs = dayFlags.filter(Boolean).length;
    const source = hasCal && hasCalDates
      ? "calendar + calendar_dates"
      : hasCal
        ? "calendar.txt"
        : hasCalDates
          ? "calendar_dates.txt"
          : "AUCUNE";
    return {
      trip_id: et.trip.trip_id,
      numero_train: row.numero_train,
      service_id: et.trip.service_id,
      gare_depart_nom: row.gare_depart_nom,
      heure_depart: row.heure_depart,
      gare_arrivee_nom: row.gare_arrivee_nom,
      heure_arrivee: row.heure_arrivee,
      circule_lundi: row.circule_lundi,
      circule_mardi: row.circule_mardi,
      circule_mercredi: row.circule_mercredi,
      circule_jeudi: row.circule_jeudi,
      circule_vendredi: row.circule_vendredi,
      circule_samedi: row.circule_samedi,
      circule_dimanche: row.circule_dimanche,
      circule_jours_feries: row.circule_jours_feries,
      circule_dimanches_feries: row.circule_dimanches_feries,
      nb_jours_actifs: nbActifs,
      source_jours: source,
    };
  });
  const wsCtrl = XLSX.utils.json_to_sheet(controlRows, { header: controlHeaders });
  wsCtrl["!cols"] = controlHeaders.map((h) => {
    if (h === "source_jours") return { wch: 26 };
    if (h.startsWith("circule_")) return { wch: 14 };
    if (h.startsWith("gare_")) return { wch: 22 };
    if (h.startsWith("heure_")) return { wch: 10 };
    if (h === "nb_jours_actifs") return { wch: 14 };
    return { wch: 18 };
  });
  wsCtrl["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsCtrl, "Contrôle");


  const name = (route.route_short_name || route.route_id).replace(/[^\w-]+/g, "_");
  XLSX.writeFile(wb, `horaires_${name}.xlsx`);
}
