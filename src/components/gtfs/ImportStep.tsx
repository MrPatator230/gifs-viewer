import { useCallback, useState } from "react";
import { Upload, FileArchive } from "lucide-react";

interface ImportStepProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
}

export function ImportStep({ onFileSelected, loading }: ImportStepProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
            <FileArchive className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
            GTFS Viewer
          </h1>
          <p className="mt-2 text-muted-foreground">
            Importez un fichier GTFS (.zip) pour visualiser les données de transport
          </p>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all ${
            dragOver
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-card"
          }`}
        >
          <Upload
            className={`mb-4 h-10 w-10 transition-colors ${
              dragOver ? "text-primary" : "text-muted-foreground group-hover:text-primary"
            }`}
          />
          {loading ? (
            <p className="text-foreground">Analyse en cours…</p>
          ) : fileName ? (
            <p className="text-foreground font-medium">{fileName}</p>
          ) : (
            <>
              <p className="text-foreground font-medium">
                Glissez votre fichier GTFS ici
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                ou cliquez pour parcourir
              </p>
            </>
          )}
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}
