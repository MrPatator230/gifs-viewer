import { useState, useMemo } from "react";
import type { GtfsRoute, GtfsTrip, GtfsData } from "@/lib/gtfs-parser";
import type { EnrichedTrip } from "./VisualizationStep";
import { getRouteColor } from "@/lib/gtfs-parser";
import { Clock, ArrowLeftRight, FileDown, FileText } from "lucide-react";
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

export function TripsColumn({ trips, selectedRoute, selectedTrip, onSelectTrip, gtfsData }: Props) {
  const [directionFilter, setDirectionFilter] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | null>(null);

  const directions = useMemo(() => {
    const dirs = new Set(trips.map((t) => t.trip.direction_id).filter(Boolean));
    return Array.from(dirs).sort();
  }, [trips]);

  const filteredTrips = useMemo(() => {
    if (directionFilter === null) return trips;
    return trips.filter((t) => t.trip.direction_id === directionFilter);
  }, [trips, directionFilter]);

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
