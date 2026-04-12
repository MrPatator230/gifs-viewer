import type { GtfsFileInfo } from "@/lib/gtfs-parser";
import { FileText, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmStepProps {
  files: GtfsFileInfo[];
  onToggleFile: (name: string) => void;
  onConfirm: () => void;
  loading: boolean;
}

export function ConfirmStep({ files, onToggleFile, onConfirm, loading }: ConfirmStepProps) {
  const requiredFiles = ["routes.txt", "trips.txt", "stop_times.txt", "stops.txt"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
            Fichiers détectés
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirmez les fichiers à importer depuis le GTFS
          </p>
        </div>

        <div className="space-y-2">
          {files.map((f) => {
            const isRequired = requiredFiles.includes(f.name);
            return (
              <button
                key={f.name}
                onClick={() => !isRequired && onToggleFile(f.name)}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  f.selected
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card opacity-50"
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    f.selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground"
                  }`}
                >
                  {f.selected && <Check className="h-3 w-3" />}
                </div>
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-[family-name:var(--font-mono)] text-sm text-foreground">
                  {f.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {f.rowCount.toLocaleString()} lignes
                </span>
                {isRequired && (
                  <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">
                    requis
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            size="lg"
          >
            {loading ? "Import en cours…" : "Importer et visualiser"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
