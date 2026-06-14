import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet, Search } from "lucide-react";
import type { GtfsRoute, GtfsData } from "@/lib/gtfs-parser";
import { getTripNumber } from "@/lib/gtfs-parser";
import type { EnrichedTrip } from "./VisualizationStep";
import { exportTripsXLSX } from "@/lib/gtfs-export";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: GtfsRoute;
  trips: EnrichedTrip[];
  gtfsData: GtfsData;
  holidayServices: Set<string>;
}

export function ExcelExportDialog({
  open,
  onOpenChange,
  route,
  trips,
  gtfsData,
  holidayServices,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(trips.map((t) => t.trip.trip_id))
  );
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((et) => {
      const num = getTripNumber(et.trip).toLowerCase();
      return (
        num.includes(q) ||
        et.firstStop.name.toLowerCase().includes(q) ||
        et.lastStop.name.toLowerCase().includes(q) ||
        et.firstStop.time.includes(q) ||
        et.lastStop.time.includes(q)
      );
    });
  }, [trips, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((et) => selected.has(et.trip.trip_id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allFilteredSelected) {
        for (const et of filtered) n.delete(et.trip.trip_id);
      } else {
        for (const et of filtered) n.add(et.trip.trip_id);
      }
      return n;
    });
  };

  const handleExport = async () => {
    const toExport = trips.filter((et) => selected.has(et.trip.trip_id));
    if (toExport.length === 0) return;
    setBusy(true);
    const id = toast.loading(`Export Excel en cours…`);
    try {
      await exportTripsXLSX(route, toExport, gtfsData, holidayServices);
      toast.success(`Export Excel réussi — ${toExport.length} horaires`, { id });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'export Excel", {
        id,
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Export Excel — Ligne {route.route_short_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (numéro, gare, heure)…"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <button
            onClick={toggleAllFiltered}
            className="rounded border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
          <span className="text-xs text-muted-foreground">
            {selected.size} / {trips.length}
          </span>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="w-8 px-2 py-1.5"></th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  N° train
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  Départ
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  Heure
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  Arrivée
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  Heure
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((et) => {
                const id = et.trip.trip_id;
                const num = getTripNumber(et.trip);
                return (
                  <tr
                    key={id}
                    className="cursor-pointer border-b border-border/50 hover:bg-muted/40"
                    onClick={() => toggle(id)}
                  >
                    <td className="px-2 py-1">
                      <Checkbox
                        checked={selected.has(id)}
                        onCheckedChange={() => toggle(id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-2 py-1 font-[family-name:var(--font-mono)] font-semibold text-foreground">
                      {num || "—"}
                    </td>
                    <td className="px-2 py-1 text-foreground">{et.firstStop.name}</td>
                    <td className="px-2 py-1 text-foreground">{et.firstStop.time}</td>
                    <td className="px-2 py-1 text-foreground">{et.lastStop.name}</td>
                    <td className="px-2 py-1 text-foreground">{et.lastStop.time}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                    Aucun horaire ne correspond à la recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={busy || selected.size === 0}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Exporter {selected.size} horaire{selected.size > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
