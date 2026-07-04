"use client";

import { useState, useEffect } from "react";
import { FileDropzone } from "./file-dropzone";
import { DataExplorer } from "./DataExplorer";
import type { UploadResponse, ProfileResponse, PreviewResponse, DemoDataset } from "@/lib/api";
import { fetchProfile, fetchPreview, fetchDemoDatasets, loadDemoDataset, loadSavedDataset, fetchDatasetAsCsv } from "@/lib/api";
import { DJANGO_API_BASE, fetchWithAuth } from "@/lib/auth";
import { agentDataLoaded } from "@/lib/agent-events";
import { Loader2, Zap, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Phase = "upload" | "loading" | "explorer" | "error";

const DEMO_COLORS: Record<string, { accent: string; bg: string }> = {
  iris:    { accent: "var(--cyan)",     bg: "rgba(92,200,232,0.08)" },
  wine:    { accent: "var(--magenta)",  bg: "rgba(226,62,192,0.08)" },
  titanic: { accent: "var(--electric)", bg: "rgba(58,160,255,0.08)" },
};

interface SavedDataset {
  id: number;
  name: string;
  description: string | null;
  file_path: string;
  csv_data: string | null;
  rows: number;
  columns: number;
  created_at: string;
}

export function DataView() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [demos, setDemos] = useState<DemoDataset[]>([]);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const [savedDatasets, setSavedDatasets] = useState<SavedDataset[]>([]);
  const [loadingSavedId, setLoadingSavedId] = useState<number | null>(null);

  useEffect(() => {
    fetchDemoDatasets().then(setDemos).catch(() => {});
    fetchSavedDatasets();
  }, []);

  async function fetchSavedDatasets() {
    try {
      const res = await fetchWithAuth(`${DJANGO_API_BASE}/datasets/`);
      if (res.ok) {
        const data: SavedDataset[] = await res.json();
        // newest first, deduplicated by name
        const seen = new Set<string>();
        const deduped = data
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .filter((d) => { if (seen.has(d.name)) return false; seen.add(d.name); return true; });
        setSavedDatasets(deduped);
      }
    } catch {
      // Not logged in or server down — silently skip
    }
  }

  async function loadData() {
    setPhase("loading");
    setErrorMsg(null);
    try {
      const [previewData, profileData] = await Promise.all([
        fetchPreview(),
        fetchProfile(),
      ]);
      setPreview(previewData);
      setProfile(profileData);
      setPhase("explorer");
      agentDataLoaded({ filename: profileData.filename, rows: profileData.rows, columns: profileData.columns.length });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load dataset");
      setPhase("error");
    }
  }

  async function registerDatasetInDjango(
    name: string,
    description: string,
    rows: number,
    columns: number,
    csvText: string = "",
  ) {
    try {
      // If a record with this name already exists, update it (PATCH) rather than creating a duplicate
      const existing = savedDatasets.find((d) => d.name === name);
      let res: Response;
      if (existing) {
        res = await fetchWithAuth(`${DJANGO_API_BASE}/datasets/${existing.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ description, csv_data: csvText, rows, columns }),
        });
      } else {
        res = await fetchWithAuth(`${DJANGO_API_BASE}/datasets/`, {
          method: "POST",
          body: JSON.stringify({ name, description, file_path: name, csv_data: csvText, rows, columns }),
        });
      }
      if (!res.ok) {
        const body = await res.text().catch(() => res.status.toString());
        console.error("Dataset registration failed:", res.status, body);
        toast.error(`Could not save dataset record (${res.status})`);
        return;
      }
      fetchSavedDatasets();
    } catch (err) {
      console.error("Dataset registration error:", err);
      toast.error("Network error saving dataset record");
    }
  }

  async function handleSuccess(result: UploadResponse, clientCsvText: string) {
    await loadData();

    // For CSV/JSON we already have the text from the client; for xlsx/parquet fall back to FastAPI export
    let csvText = clientCsvText;
    if (!csvText) {
      csvText = await fetchDatasetAsCsv();
    }

    await registerDatasetInDjango(
      result.filename,
      `${result.rows} rows · ${result.columns} columns`,
      result.rows,
      result.columns,
      csvText,
    );
  }

  async function handleLoadDemo(name: string) {
    setLoadingDemo(name);
    try {
      await loadDemoDataset(name);
      await loadData();
      const demo = demos.find((d) => d.name === name);
      // Demo datasets don't need CSV stored — they can always reload from FastAPI built-ins
      await registerDatasetInDjango(
        `${name}.csv`,
        `${demo?.rows ?? 0} rows · ${demo?.columns ?? 0} columns`,
        demo?.rows ?? 0,
        demo?.columns ?? 0,
        "",
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load demo dataset");
      setPhase("error");
    } finally {
      setLoadingDemo(null);
    }
  }

  async function handleLoadSaved(dataset: SavedDataset) {
    setLoadingSavedId(dataset.id);
    try {
      // Demo datasets reload directly from FastAPI's built-in data — no Django fetch needed
      const demoName = dataset.name.replace(".csv", "");
      if (demos.some((d) => d.name === demoName)) {
        toast.info(`Loading ${dataset.name}…`);
        await loadDemoDataset(demoName);
        await loadData();
        return;
      }

      // Fetch the detail record from Django (csv_data is excluded from the list endpoint)
      toast.info(`Fetching ${dataset.name}…`);
      const res = await fetchWithAuth(`${DJANGO_API_BASE}/datasets/${dataset.id}/`);
      if (!res.ok) {
        toast.error(`Django returned ${res.status} — are you logged in?`);
        return;
      }
      const detail: SavedDataset = await res.json();

      if (!detail.csv_data) {
        toast.error("No stored data — please re-upload the file.");
        return;
      }

      // Reconstruct the file and send to FastAPI via the existing upload endpoint
      toast.info("Sending to backend…");
      await loadSavedDataset(detail.csv_data, detail.name);
      await loadData();
      toast.success(`${detail.name} loaded!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load dataset";
      toast.error(msg);
    } finally {
      setLoadingSavedId(null);
    }
  }

  async function handleDeleteSaved(id: number) {
    if (!window.confirm("Remove this dataset record?")) return;
    try {
      const res = await fetchWithAuth(`${DJANGO_API_BASE}/datasets/${id}/`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setSavedDatasets((prev) => prev.filter((d) => d.id !== id));
        toast.success("Removed");
      } else {
        toast.error("Failed to remove");
      }
    } catch {
      toast.error("Error removing dataset");
    }
  }

  if (phase === "upload" || phase === "error") {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 gap-6 overflow-y-auto">

        {/* ── My Saved Datasets ── */}
        {savedDatasets.length > 0 && (
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Database size={14} style={{ color: "var(--ink-dim)" }} />
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ fontFamily: "var(--quasar-font-mono)", color: "var(--ink-dim)" }}
              >
                My Saved Datasets
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {savedDatasets.map((d) => {
                const isLoading = loadingSavedId === d.id;
                const isDemoDataset = demos.some((demo) => demo.name === d.name.replace(".csv", ""));
                const canReload = isDemoDataset || d.rows > 0;
                return (
                  <div key={d.id} className="relative group">
                    <button
                      onClick={() => handleLoadSaved(d)}
                      disabled={!canReload || loadingSavedId !== null}
                      className="w-full text-left rounded-xl p-4 border transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: "var(--surface-2)",
                        borderColor: "var(--surface-3)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[13px] font-semibold truncate max-w-[110px]"
                          style={{ color: "var(--ink-primary)" }}
                        >
                          {d.name}
                        </span>
                        {isLoading ? (
                          <Loader2 size={13} className="animate-spin shrink-0" style={{ color: "var(--electric)" }} />
                        ) : (
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0"
                            style={{
                              fontFamily: "var(--quasar-font-mono)",
                              color: canReload ? "var(--electric)" : "var(--ink-dim)",
                              borderColor: canReload ? "rgba(58,160,255,0.3)" : "var(--surface-3)",
                            }}
                          >
                            {canReload ? "load" : "no data"}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-snug mb-3" style={{ color: "var(--ink-muted)" }}>
                        {d.description ?? d.file_path}
                      </p>
                      <div className="flex gap-3 text-[10px]" style={{ color: "var(--ink-dim)", fontFamily: "var(--quasar-font-mono)" }}>
                        {d.rows > 0 && <span>{d.rows.toLocaleString()} rows</span>}
                        {d.columns > 0 && <span>{d.columns} cols</span>}
                        <span style={{ opacity: 0.6 }}>
                          {new Date(d.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                    {/* Delete button — appears on hover */}
                    <button
                      onClick={() => handleDeleteSaved(d.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 p-1 rounded"
                      title="Remove from saved"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Demo Datasets ── */}
        {demos.length > 0 && (
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} style={{ color: "var(--electric)" }} />
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ fontFamily: "var(--quasar-font-mono)", color: "var(--ink-dim)" }}
              >
                Quick Start — Demo Datasets
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {demos.map((d) => {
                const colors = DEMO_COLORS[d.name] ?? { accent: "#007bff", bg: "rgba(0,123,255,0.08)" };
                const isLoading = loadingDemo === d.name;
                return (
                  <button
                    key={d.name}
                    onClick={() => handleLoadDemo(d.name)}
                    disabled={loadingDemo !== null}
                    className="text-left rounded-xl p-4 border transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: colors.bg,
                      borderColor: `color-mix(in srgb, ${colors.accent} 30%, transparent)`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold" style={{ color: colors.accent }}>
                        {d.label}
                      </span>
                      {isLoading ? (
                        <Loader2 size={13} className="animate-spin" style={{ color: colors.accent }} />
                      ) : (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                          style={{
                            color: colors.accent,
                            borderColor: `color-mix(in srgb, ${colors.accent} 40%, transparent)`,
                          }}
                        >
                          {d.task}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-snug mb-3" style={{ color: "var(--ink-muted)" }}>{d.description}</p>
                    <div className="flex gap-3 text-[10px]" style={{ color: "var(--ink-dim)", fontFamily: "var(--quasar-font-mono)" }}>
                      <span>{d.rows} rows</span>
                      <span>{d.columns} cols</span>
                      <span style={{ opacity: 0.5 }}>target: <span style={{ color: "var(--ink-muted)" }}>{d.target}</span></span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <FileDropzone onSuccess={handleSuccess} />

        {phase === "error" && errorMsg && (
          <div
            className="rounded-xl px-4 py-3 text-sm max-w-xl w-full"
            style={{
              backgroundColor: "color-mix(in oklch, var(--destructive) 8%, transparent)",
              border: "1px solid color-mix(in oklch, var(--destructive) 20%, transparent)",
              color: "var(--destructive)",
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3" style={{ color: "var(--ink-muted)" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--electric)" }} />
          <span className="text-sm" style={{ fontFamily: "var(--quasar-font-mono)" }}>Profiling dataset…</span>
        </div>
      </div>
    );
  }

  if (phase === "explorer" && preview && profile) {
    return <DataExplorer preview={preview} profile={profile} />;
  }

  return null;
}
