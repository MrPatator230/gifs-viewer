import { useMemo, useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import type { GtfsData, GtfsRoute, GtfsTrip, GtfsStopTime } from "@/lib/gtfs-parser";
import { formatTime, getRouteColor } from "@/lib/gtfs-parser";

interface SearchEntry {
  trip: GtfsTrip;
  route: GtfsRoute;
  routeColor: string;
  firstStopName: string;
  lastStopName: string;
  firstTime: string;
  lastTime: string;
  haystack: string;
}

interface Props {
  data: GtfsData;
  stopsMap: Map<string, { name: string }>;
  stopTimesByTrip: Map<string, GtfsStopTime[]>;
  onSelect: (route: GtfsRoute, trip: GtfsTrip) => void;
}

export function TripSearch({ data, stopsMap, stopTimesByTrip, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const routesById = useMemo(() => {
    const m = new Map<string, GtfsRoute>();
    for (const r of data.routes) m.set(r.route_id, r);
    return m;
  }, [data.routes]);

  const entries = useMemo<SearchEntry[]>(() => {
    const list: SearchEntry[] = [];
    for (const trip of data.trips) {
      const route = routesById.get(trip.route_id);
      if (!route) continue;
      const sts = stopTimesByTrip.get(trip.trip_id);
      if (!sts || sts.length === 0) continue;
      const first = sts[0];
      const last = sts[sts.length - 1];
      const firstStopName = stopsMap.get(first.stop_id)?.name || first.stop_id;
      const lastStopName = stopsMap.get(last.stop_id)?.name || last.stop_id;
      const firstTime = formatTime(first.departure_time);
      const lastTime = formatTime(last.arrival_time);
      const haystack = [
        trip.trip_short_name,
        trip.trip_headsign,
        trip.trip_id,
        route.route_short_name,
        route.route_long_name,
        firstStopName,
        lastStopName,
        firstTime,
        lastTime,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      list.push({
        trip,
        route,
        routeColor: getRouteColor(route),
        firstStopName,
        lastStopName,
        firstTime,
        lastTime,
        haystack,
      });
    }
    return list;
  }, [data.trips, routesById, stopTimesByTrip, stopsMap]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/);
    const matched: SearchEntry[] = [];
    for (const e of entries) {
      if (tokens.every((t) => e.haystack.includes(t))) {
        matched.push(e);
        if (matched.length >= 50) break;
      }
    }
    return matched;
  }, [entries, query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelect = (entry: SearchEntry) => {
    onSelect(entry.route, entry.trip);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-72">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un horaire…"
          className="w-full rounded-md border border-border bg-card py-1.5 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">Aucun horaire trouvé</p>
          ) : (
            results.map((r) => (
              <button
                key={r.trip.trip_id}
                onClick={() => handleSelect(r)}
                className="flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: r.routeColor }}
                  >
                    {r.route.route_short_name}
                  </span>
                  {r.trip.trip_short_name && (
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground">
                      {r.trip.trip_short_name}
                    </span>
                  )}
                  <span className="ml-auto font-[family-name:var(--font-mono)] text-[10px] text-primary">
                    {r.firstTime} → {r.lastTime}
                  </span>
                </div>
                <p className="truncate text-xs text-foreground">
                  {r.firstStopName} → {r.lastStopName}
                </p>
                {r.trip.trip_headsign && (
                  <p className="truncate text-[10px] text-muted-foreground">{r.trip.trip_headsign}</p>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
