import JSZip from "jszip";
import Papa from "papaparse";

export interface GtfsRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_color: string;
  route_text_color: string;
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
}

export interface GtfsStop {
  stop_id: string;
  stop_name: string;
  stop_lat?: string;
  stop_lon?: string;
  platform_code?: string;
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

  const [routesCSV, tripsCSV, stopTimesCSV, stopsCSV, calendarCSV, calDatesCSV] =
    await Promise.all([
      read("routes.txt"),
      read("trips.txt"),
      read("stop_times.txt"),
      read("stops.txt"),
      read("calendar.txt"),
      read("calendar_dates.txt"),
    ]);

  return {
    routes: routesCSV ? parseCSV<GtfsRoute>(routesCSV) : [],
    trips: tripsCSV ? parseCSV<GtfsTrip>(tripsCSV) : [],
    stopTimes: stopTimesCSV ? parseCSV<GtfsStopTime>(stopTimesCSV) : [],
    stops: stopsCSV ? parseCSV<GtfsStop>(stopsCSV) : [],
    calendar: calendarCSV ? parseCSV<GtfsCalendar>(calendarCSV) : [],
    calendarDates: calDatesCSV ? parseCSV<GtfsCalendarDate>(calDatesCSV) : [],
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
