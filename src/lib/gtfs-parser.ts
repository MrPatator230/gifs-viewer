import JSZip from "jszip";
import Papa from "papaparse";

export interface GtfsAgency {
  agency_id?: string;
  agency_name?: string;
}

export interface GtfsRoute {
  route_id: string;
  agency_id?: string;
  route_short_name: string;
  route_long_name: string;
  route_color: string;
  route_text_color: string;
  route_type?: string;
  route_desc?: string;
}

/** Maps a GTFS route_type code to a human-readable vehicle type label. */
export function getRouteTypeLabel(route: GtfsRoute): string {
  const t = route.route_type?.trim();
  const map: Record<string, string> = {
    "0": "Tramway",
    "1": "Métro",
    "2": "Train",
    "3": "Bus",
    "4": "Ferry",
    "5": "Téléphérique",
    "6": "Téléphérique urbain",
    "7": "Funiculaire",
    "11": "Trolleybus",
    "12": "Monorail",
    // Extended GTFS route types
    "100": "Train ferroviaire",
    "101": "Train grande vitesse (TGV)",
    "102": "Train longue distance (Intercités)",
    "103": "Train régional (TER)",
    "105": "Train de nuit",
    "106": "Train régional (TER)",
    "109": "Train suburbain (Transilien)",
    "400": "Métro",
    "700": "Bus",
    "900": "Tramway",
    "1000": "Transport fluvial",
  };
  if (t && map[t]) return map[t];
  if (t) return `Type ${t}`;
  return "";
}

/**
 * Returns the commercial train brand for a route (TER, TGV, MOBIGO, liO…).
 * French feeds expose it via route_desc, the agency name, or the route's
 * long name. Falls back to the generic route_type label.
 */
export function getTrainBrand(
  route: GtfsRoute,
  agencies: GtfsAgency[]
): string {
  const BRAND_KEYWORDS = [
    "TGV", "INOUI", "OUIGO", "TER", "INTERCITÉS", "INTERCITES",
    "TRANSILIEN", "RER", "EUROSTAR", "THALYS", "LYRIA", "MOBIGO",
    "LIO", "FLUO", "ALEOP", "NOMAD", "REMI", "ZOU", "BREIZHGO",
    "CARS RÉGION", "TRAIN",
  ];

  const sources: string[] = [];
  if (route.route_desc?.trim()) sources.push(route.route_desc.trim());
  const agency = agencies.find(
    (a) => a.agency_id && a.agency_id === route.agency_id
  ) ?? (agencies.length === 1 ? agencies[0] : undefined);
  if (agency?.agency_name?.trim()) sources.push(agency.agency_name.trim());
  if (route.route_long_name?.trim()) sources.push(route.route_long_name.trim());

  for (const src of sources) {
    const upper = src.toUpperCase();
    for (const kw of BRAND_KEYWORDS) {
      const idx = upper.indexOf(kw);
      if (idx === -1) continue;
      // Extract the keyword plus a short following qualifier (e.g. "TER BFC")
      const rest = src.slice(idx, idx + kw.length + 24).split(/[,;\-–—(]/)[0].trim();
      // Normalize case: keep known acronyms uppercased
      const normalized = rest
        .split(/\s+/)
        .map((w) => {
          const wu = w.toUpperCase();
          if (BRAND_KEYWORDS.includes(wu)) return wu === "LIO" ? "liO" : wu;
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(" ");
      if (normalized) return normalized;
    }
  }

  // Fallback: generic vehicle type from route_type
  return getRouteTypeLabel(route);
}

export interface GtfsTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string;
  trip_short_name: string;
  direction_id: string;
  trip_desc?: string;
  trip_note?: string;
}

export interface GtfsFeedInfo {
  feed_publisher_name?: string;
  feed_publisher_url?: string;
  feed_lang?: string;
  feed_start_date?: string;
  feed_end_date?: string;
  feed_version?: string;
}

export interface GtfsStopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
  stop_headsign?: string;
  pickup_type?: string;
  drop_off_type?: string;
  platform?: string;
  platform_code?: string;
  track?: string;
}

export interface GtfsStop {
  stop_id: string;
  stop_name: string;
  stop_lat?: string;
  stop_lon?: string;
  platform_code?: string;
  parent_station?: string;
  location_type?: string;
}

export function getStopPlatform(
  st: { platform?: string; platform_code?: string; track?: string; stop_headsign?: string },
  stop?: { platform_code?: string }
): string {
  return (
    st.platform_code?.trim() ||
    st.platform?.trim() ||
    st.track?.trim() ||
    stop?.platform_code?.trim() ||
    ""
  );
}

export interface GtfsCalendar {
  service_id: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  start_date: string;
  end_date: string;
}

export interface GtfsCalendarDate {
  service_id: string;
  date: string;
  exception_type: string;
}

export interface GtfsFileInfo {
  name: string;
  rowCount: number;
  selected: boolean;
}

export interface GtfsData {
  routes: GtfsRoute[];
  agencies: GtfsAgency[];
  trips: GtfsTrip[];
  stopTimes: GtfsStopTime[];
  stops: GtfsStop[];
  calendar: GtfsCalendar[];
  calendarDates: GtfsCalendarDate[];
  feedInfo: GtfsFeedInfo | null;
  fileName: string;
}

function parseCSV<T>(content: string): T[] {
  const result = Papa.parse<T>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data;
}

export async function listGtfsFiles(file: File): Promise<GtfsFileInfo[]> {
  const zip = await JSZip.loadAsync(file);
  const files: GtfsFileInfo[] = [];

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !name.endsWith(".txt")) continue;
    const content = await entry.async("string");
    const lines = content.trim().split("\n");
    files.push({
      name: name.replace(/^.*\//, ""),
      rowCount: Math.max(0, lines.length - 1),
      selected: true,
    });
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function parseGtfsZip(file: File): Promise<GtfsData> {
  const zip = await JSZip.loadAsync(file);

  async function read(filename: string): Promise<string | null> {
    // Try root and nested
    const entry =
      zip.file(filename) ||
      Object.values(zip.files).find((f) => f.name.endsWith("/" + filename));
    if (!entry) return null;
    return entry.async("string");
  }

  const [routesCSV, tripsCSV, stopTimesCSV, stopsCSV, calendarCSV, calDatesCSV, feedCSV, agencyCSV] =
    await Promise.all([
      read("routes.txt"),
      read("trips.txt"),
      read("stop_times.txt"),
      read("stops.txt"),
      read("calendar.txt"),
      read("calendar_dates.txt"),
      read("feed_info.txt"),
      read("agency.txt"),
    ]);

  const feedRows = feedCSV ? parseCSV<GtfsFeedInfo>(feedCSV) : [];

  return {
    routes: routesCSV ? parseCSV<GtfsRoute>(routesCSV) : [],
    agencies: agencyCSV ? parseCSV<GtfsAgency>(agencyCSV) : [],
    trips: tripsCSV ? parseCSV<GtfsTrip>(tripsCSV) : [],
    stopTimes: stopTimesCSV ? parseCSV<GtfsStopTime>(stopTimesCSV) : [],
    stops: stopsCSV ? parseCSV<GtfsStop>(stopsCSV) : [],
    calendar: calendarCSV ? parseCSV<GtfsCalendar>(calendarCSV) : [],
    calendarDates: calDatesCSV ? parseCSV<GtfsCalendarDate>(calDatesCSV) : [],
    feedInfo: feedRows[0] ?? null,
    fileName: file.name,
  };
}

export function formatTime(time: string): string {
  if (!time) return "";
  const parts = time.split(":");
  if (parts.length < 2) return time;
  const h = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  return `${h}h${m}`;
}

export function getRouteColor(route: GtfsRoute): string {
  if (route.route_color && route.route_color !== "") {
    const c = route.route_color.replace("#", "");
    return `#${c}`;
  }
  return "#3b82f6";
}

export function getRouteTextColor(route: GtfsRoute): string {
  if (route.route_text_color && route.route_text_color !== "") {
    const c = route.route_text_color.replace("#", "");
    return `#${c}`;
  }
  return "#ffffff";
}

export function getTripComment(trip: GtfsTrip): string {
  const desc = trip.trip_desc?.trim();
  if (desc) return desc;
  const note = trip.trip_note?.trim();
  if (note) return note;
  const headsign = trip.trip_headsign?.trim();
  if (headsign) return headsign;
  return "";
}

/**
 * Returns the train number for a trip. Prefers trip_short_name; otherwise
 * extracts the first contiguous digit run from the comment (trip_desc /
 * trip_note / trip_headsign), which is where SNCF-style feeds expose it.
 */
export function getTripNumber(trip: GtfsTrip): string {
  const sn = trip.trip_short_name?.trim();
  if (sn) return sn;
  const desc = trip.trip_desc?.trim();
  const note = trip.trip_note?.trim();
  const headsign = trip.trip_headsign?.trim();
  for (const src of [desc, note, headsign]) {
    if (!src) continue;
    const m = src.match(/\d{2,6}/);
    if (m) return m[0];
  }
  return "";
}

export function getServiceDays(
  serviceId: string,
  calendar: GtfsCalendar[],
  calendarDates: GtfsCalendarDate[]
): Record<string, boolean> {
  const cal = calendar.find((c) => c.service_id === serviceId);

  // Base days from calendar.txt
  const days: Record<string, boolean> = {
    Lun: cal?.monday === "1",
    Mar: cal?.tuesday === "1",
    Mer: cal?.wednesday === "1",
    Jeu: cal?.thursday === "1",
    Ven: cal?.friday === "1",
    Sam: cal?.saturday === "1",
    Dim: cal?.sunday === "1",
  };

  // If no calendar entry, infer days from calendar_dates (exception_type=1 = added)
  if (!cal) {
    const added = calendarDates.filter(
      (cd) => cd.service_id === serviceId && cd.exception_type === "1"
    );
    const dayIndexMap = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    for (const cd of added) {
      const d = new Date(
        Number(cd.date.slice(0, 4)),
        Number(cd.date.slice(4, 6)) - 1,
        Number(cd.date.slice(6, 8))
      );
      const label = dayIndexMap[d.getDay()];
      if (label) days[label] = true;
    }
  }

  return days;
}

export function getServiceDates(
  serviceId: string,
  calendar: GtfsCalendar[],
  calendarDates: GtfsCalendarDate[]
): { start: string; end: string; addedDates: string[]; removedDates: string[] } {
  const cal = calendar.find((c) => c.service_id === serviceId);
  const added = calendarDates
    .filter((cd) => cd.service_id === serviceId && cd.exception_type === "1")
    .map((cd) => cd.date);
  const removed = calendarDates
    .filter((cd) => cd.service_id === serviceId && cd.exception_type === "2")
    .map((cd) => cd.date);
  return {
    start: cal?.start_date || "",
    end: cal?.end_date || "",
    addedDates: added,
    removedDates: removed,
  };
}
