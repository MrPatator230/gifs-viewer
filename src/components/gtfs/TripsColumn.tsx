import type { GtfsRoute, GtfsTrip } from "@/lib/gtfs-parser";
import type { EnrichedTrip } from "./VisualizationStep";
import { getRouteColor } from "@/lib/gtfs-parser";
import { Clock } from "lucide-react";

interface Props {
  trips: EnrichedTrip[];
  selectedRoute: GtfsRoute | null;
  selectedTrip: GtfsTrip | null;
  onSelectTrip: (trip: GtfsTrip) => void;
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function TripsColumn({ trips, selectedRoute, selectedTrip, onSelectTrip }: Props) {
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
        <h2 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-foreground">
          Horaires — {selectedRoute.route_short_name} ({trips.length})
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trips.map((et) => {
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
    </div>
  );
}
