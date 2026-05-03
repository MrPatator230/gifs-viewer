import { useState, useMemo } from "react";
import type { GtfsRoute, GtfsTrip, GtfsData } from "@/lib/gtfs-parser";
import type { EnrichedTrip } from "./VisualizationStep";
import { getRouteColor } from "@/lib/gtfs-parser";
import { Clock, ArrowLeftRight, FileDown, FileText, CalendarDays } from "lucide-react";
import { buildExportMeta } from "@/lib/gtfs-export";
import { ExportPreviewDialog } from "./ExportPreviewDialog";

interface Props {
  trips: EnrichedTrip[];
  selectedRoute: GtfsRoute | null;
  selectedTrip: GtfsTrip | null;
  onSelectTrip: (trip: GtfsTrip) => void;
  gtfsData: GtfsData;
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOLIDAY_KEY = "Fériés";

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function frenchHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);
  const ascension = new Date(easter); ascension.setDate(easter.getDate() + 39);
  const pentecostMonday = new Date(easter); pentecostMonday.setDate(easter.getDate() + 50);
  return new Set([
    fmtDate(new Date(year, 0, 1)),
    fmtDate(easterMonday),
    fmtDate(new Date(year, 4, 1)),
    fmtDate(new Date(year, 4, 8)),
    fmtDate(ascension),
    fmtDate(pentecostMonday),
    fmtDate(new Date(year, 6, 14)),
    fmtDate(new Date(year, 7, 15)),
    fmtDate(new Date(year, 10, 1)),
    fmtDate(new Date(year, 10, 11)),
    fmtDate(new Date(year, 11, 25)),
  ]);
}

export function TripsColumn({ trips, selectedRoute, selectedTrip, onSelectTrip, gtfsData }: Props) {
  const [directionFilter, setDirectionFilter] = useState<string | null>(null);
  const [dayFilters, setDayFilters] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | null>(null);

  const directions = useMemo(() => {
    const dirs = new Set(trips.map((t) => t.trip.direction_id).filter(Boolean));
    return Array.from(dirs).sort();
  }, [trips]);

  const holidayServices = useMemo(() => {
    const years = new Set<number>();
    for (const cd of gtfsData.calendarDates) {
      if (cd.date?.length === 8) years.add(Number(cd.date.slice(0, 4)));
    }
    for (const c of gtfsData.calendar) {
      if (c.start_date?.length === 8) years.add(Number(c.start_date.slice(0, 4)));
      if (c.end_date?.length === 8) years.add(Number(c.end_date.slice(0, 4)));
    }
    const holidays = new Set<string>();
    for (const y of years) for (const h of frenchHolidays(y)) holidays.add(h);

    const result = new Set<string>();
    for (const cd of gtfsData.calendarDates) {
      if (cd.exception_type === "1" && holidays.has(cd.date)) result.add(cd.service_id);
    }
    const removedByService = new Map<string, Set<string>>();
    for (const cd of gtfsData.calendarDates) {
      if (cd.exception_type === "2") {
        let s = removedByService.get(cd.service_id);
        if (!s) { s = new Set(); removedByService.set(cd.service_id, s); }
        s.add(cd.date);
      }
    }
    for (const c of gtfsData.calendar) {
      if (result.has(c.service_id)) continue;
      const dayActive = [c.sunday, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday].map((v) => v === "1");
      const removed = removedByService.get(c.service_id);
      for (const h of holidays) {
        if (h < c.start_date || h > c.end_date) continue;
        if (removed?.has(h)) continue;
        const d = new Date(Number(h.slice(0, 4)), Number(h.slice(4, 6)) - 1, Number(h.slice(6, 8)));
        if (dayActive[d.getDay()]) { result.add(c.service_id); break; }
      }
    }
    return result;
  }, [gtfsData.calendar, gtfsData.calendarDates]);

  const filteredTrips = useMemo(() => {
    let r = trips;
    if (directionFilter !== null) r = r.filter((t) => t.trip.direction_id === directionFilter);
    if (dayFilters.size > 0) {
      r = r.filter((et) => {
        for (const f of dayFilters) {
          if (f === HOLIDAY_KEY) {
            if (holidayServices.has(et.trip.service_id)) return true;
          } else if (et.days[f]) {
            return true;
          }
        }
        return false;
      });
    }
    return r;
  }, [trips, directionFilter, dayFilters, holidayServices]);

  const toggleDay = (d: string) => {
    setDayFilters((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d); else n.add(d);
      return n;
    });
  };

  const exportMeta = useMemo(
    () => buildExportMeta(gtfsData, trips, filteredTrips, directionFilter),
    [gtfsData, trips, filteredTrips, directionFilter]
  );

  if (!selectedRoute) {
    return (
      <div className="flex flex-1 items-center justify-center border-r border-border">
        <div className="text-center text-muted-foreground">
          <Clock className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sélectionnez une ligne</p>
        </div>
      </div>
    );
  }

  const routeColor = getRouteColor(selectedRoute);

  return (
    <div className="flex flex-1 flex-col border-r border-border">
      <div className="border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-foreground">
            Horaires — {selectedRoute.route_short_name} ({filteredTrips.length})
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExportFormat("csv")}
              disabled={filteredTrips.length === 0}
              title={`Exporter ${filteredTrips.length} horaires en CSV`}
              className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <FileDown className="h-3 w-3" />
              CSV
            </button>
            <button
              onClick={() => setExportFormat("pdf")}
              disabled={filteredTrips.length === 0}
              title={`Exporter ${filteredTrips.length} horaires en PDF`}
              className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <FileText className="h-3 w-3" />
              PDF
            </button>
          </div>
        </div>
        {directions.length > 1 && (
          <div className="mt-2 flex items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => setDirectionFilter(null)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                directionFilter === null
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Toutes
            </button>
            {directions.map((dir) => (
              <button
                key={dir}
                onClick={() => setDirectionFilter(dir)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  directionFilter === dir
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {dir === "0" ? "Aller" : dir === "1" ? "Retour" : `Dir ${dir}`}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          {DAY_LABELS.map((day) => {
            const active = dayFilters.has(day);
            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {day}
              </button>
            );
          })}
          <button
            onClick={() => toggleDay(HOLIDAY_KEY)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              dayFilters.has(HOLIDAY_KEY)
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Jours Fériés
          </button>
          {dayFilters.size > 0 && (
            <button
              onClick={() => setDayFilters(new Set())}
              className="ml-1 rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredTrips.map((et) => {
          const isSelected = selectedTrip?.trip_id === et.trip.trip_id;
          return (
            <button
              key={et.trip.trip_id}
              onClick={() => onSelectTrip(et.trip)}
              className={`flex w-full flex-col gap-2 border-b border-border px-4 py-3 text-left transition-colors ${
                isSelected ? "bg-primary/10" : "hover:bg-card"
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: routeColor }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {et.firstStop.name}{" "}
                    <span className="text-primary">({et.firstStop.time})</span>
                    {" > "}
                    {et.lastStop.name}{" "}
                    <span className="text-primary">({et.lastStop.time})</span>
                  </p>
                </div>
                {et.trip.trip_short_name && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-muted-foreground">
                    {et.trip.trip_short_name}
                  </span>
                )}
              </div>
              <div className="flex gap-1 pl-4">
                {DAY_LABELS.map((day) => (
                  <span
                    key={day}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      et.days[day]
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {exportFormat && (
        <ExportPreviewDialog
          open={exportFormat !== null}
          onOpenChange={(o) => !o && setExportFormat(null)}
          format={exportFormat}
          route={selectedRoute}
          trips={filteredTrips}
          meta={exportMeta}
        />
      )}
    </div>
  );
}
