import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";
import type { GtfsRoute } from "@/lib/gtfs-parser";
import type { EnrichedTrip } from "./VisualizationStep";
import {
  EXPORT_HEADERS,
  buildExportRows,
  exportTripsCSV,
  exportTripsPDF,
  type ExportMeta,
} from "@/lib/gtfs-export";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: "csv" | "pdf";
  route: GtfsRoute;
  trips: EnrichedTrip[];
  meta: ExportMeta;
}

const PREVIEW_ROWS = 50;

export function ExportPreviewDialog({ open, onOpenChange, format, route, trips, meta }: Props) {
  const [busy, setBusy] = useState(false);
  const rows = buildExportRows(trips);
  const previewRows = rows.slice(0, PREVIEW_ROWS);

  const handleDownload = async () => {
    setBusy(true);
    const id = toast.loading(
      `Génération du fichier ${format.toUpperCase()} en cours…`
    );
    try {
      if (format === "csv") {
        await exportTripsCSV(route, trips, meta);
      } else {
        await exportTripsPDF(route, trips, meta);
      }
      toast.success(
        `Export ${format.toUpperCase()} réussi — ${trips.length} horaires`,
        { id }
      );
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(`Échec de l'export ${format.toUpperCase()}`, {
        id,
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const dirLabel =
    meta.directionFilter === null
      ? "Toutes"
      : meta.directionFilter === "0"
        ? "Aller"
        : meta.directionFilter === "1"
          ? "Retour"
          : meta.directionFilter;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Aperçu de l'export {format.toUpperCase()} — Ligne {route.route_short_name}
          </DialogTitle>
        </DialogHeader>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <div>
            <span className="text-muted-foreground">Fichier : </span>
            <span className="text-foreground">{meta.fileName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Filtre direction : </span>
            <span className="text-foreground">{dirLabel}</span>
          </div>
          {meta.feedPublisher && (
            <div>
              <span className="text-muted-foreground">Éditeur : </span>
              <span className="text-foreground">{meta.feedPublisher}</span>
            </div>
          )}
          {meta.feedVersion && (
            <div>
              <span className="text-muted-foreground">Version : </span>
              <span className="text-foreground">{meta.feedVersion}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Service : </span>
            <span className="text-foreground">
              {meta.serviceStart || "—"} → {meta.serviceEnd || "—"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Horaires : </span>
            <span className="text-foreground">
              {meta.filteredCount} / {meta.totalCount}
            </span>
          </div>
        </div>

        {/* Table preview */}
        <div className="max-h-[50vh] overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {EXPORT_HEADERS.map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-2 py-1.5 text-left font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1 text-foreground">
                      {cell || (j >= 6 ? "·" : "")}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={EXPORT_HEADERS.length} className="px-2 py-4 text-center text-muted-foreground">
                    Aucun horaire à exporter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > PREVIEW_ROWS && (
          <p className="text-[11px] text-muted-foreground">
            Aperçu des {PREVIEW_ROWS} premières lignes — {rows.length} lignes
            seront exportées au total.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={handleDownload} disabled={busy || rows.length === 0}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Télécharger {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
