import { useState, useMemo } from "react";
import type { GtfsRoute } from "@/lib/gtfs-parser";
import { getRouteColor, getRouteTextColor } from "@/lib/gtfs-parser";
import { Search } from "lucide-react";

interface Props {
  routes: GtfsRoute[];
  selectedRoute: GtfsRoute | null;
  onSelectRoute: (route: GtfsRoute) => void;
}

export function RoutesColumn({ routes, selectedRoute, onSelectRoute }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return routes;
    const q = search.toLowerCase();
    return routes.filter(
      (r) =>
        r.route_short_name?.toLowerCase().includes(q) ||
        r.route_long_name?.toLowerCase().includes(q)
    );
  }, [routes, search]);

  return (
    <div className="flex w-80 shrink-0 flex-col border-r border-border">
      <div className="border-b border-border p-3">
        <h2 className="mb-2 font-[family-name:var(--font-heading)] text-sm font-semibold text-foreground">
          Lignes ({routes.length})
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une ligne…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-input px-3 py-2 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((route) => {
          const isSelected = selectedRoute?.route_id === route.route_id;
          const color = getRouteColor(route);
          const textColor = getRouteTextColor(route);
          return (
            <button
              key={route.route_id}
              onClick={() => onSelectRoute(route)}
              className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors ${
                isSelected ? "bg-primary/10" : "hover:bg-card"
              }`}
            >
              <span
                className="shrink-0 rounded-md px-2 py-1 text-xs font-bold"
                style={{ backgroundColor: color, color: textColor }}
              >
                {route.route_short_name || "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {route.route_long_name || route.route_id}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
