import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import type { GtfsFileInfo, GtfsData } from "@/lib/gtfs-parser";
import { listGtfsFiles, parseGtfsZip } from "@/lib/gtfs-parser";
import { ImportStep } from "@/components/gtfs/ImportStep";
import { ConfirmStep } from "@/components/gtfs/ConfirmStep";
import { VisualizationStep } from "@/components/gtfs/VisualizationStep";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GTFS Viewer — Visualisation de données transport" },
      {
        name: "description",
        content:
          "Importez et visualisez les données GTFS : lignes, horaires, arrêts et calendriers de circulation.",
      },
    ],
  }),
});

type Step = "import" | "confirm" | "visualize";

function Index() {
  const [step, setStep] = useState<Step>("import");
  const [file, setFile] = useState<File | null>(null);
  const [fileInfos, setFileInfos] = useState<GtfsFileInfo[]>([]);
  const [gtfsData, setGtfsData] = useState<GtfsData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileSelected = useCallback(async (f: File) => {
    setFile(f);
    setLoading(true);
    try {
      const infos = await listGtfsFiles(f);
      setFileInfos(infos);
      setStep("confirm");
    } catch (err) {
      console.error("Error reading GTFS zip:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleFile = useCallback((name: string) => {
    setFileInfos((prev) =>
      prev.map((f) => (f.name === name ? { ...f, selected: !f.selected } : f))
    );
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const data = await parseGtfsZip(file);
      setGtfsData(data);
      setStep("visualize");
    } catch (err) {
      console.error("Error parsing GTFS:", err);
    } finally {
      setLoading(false);
    }
  }, [file]);

  if (step === "confirm") {
    return (
      <ConfirmStep
        files={fileInfos}
        onToggleFile={handleToggleFile}
        onConfirm={handleConfirm}
        loading={loading}
      />
    );
  }

  if (step === "visualize" && gtfsData) {
    return <VisualizationStep data={gtfsData} />;
  }

  return <ImportStep onFileSelected={handleFileSelected} loading={loading} />;
}
