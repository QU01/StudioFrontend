"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadFile, type UploadResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

type Status = "idle" | "uploading" | "success" | "error";

interface FileDropzoneProps {
  onSuccess?: (result: UploadResponse, csvText: string) => void;
}

export function FileDropzone({ onSuccess }: FileDropzoneProps = {}) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setStatus("uploading");
    setError(null);
    setResult(null);
    try {
      // Read text content client-side for text formats — fast, reliable, no extra round-trip
      const isTextFormat = file.name.endsWith(".csv") || file.name.endsWith(".json");
      const csvText = isTextFormat ? await file.text() : "";

      const data = await uploadFile(file);
      setResult(data);
      setStatus("success");
      toast.success(`${data.filename} loaded — ${data.rows.toLocaleString()} rows`);
      onSuccess?.(data, csvText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  }, [onSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/octet-stream": [".parquet"],
      "application/json": [".json"],
    },
    maxFiles: 1,
    multiple: false,
    disabled: status === "uploading",
  });

  return (
    <div className="w-full max-w-xl space-y-4">
      {/* Animated gradient border wrapper */}
      <div
        className={cn(
          "rounded-2xl p-[1px] transition-all duration-300",
          isDragActive ? "gradient-border-animated" : ""
        )}
        style={
          isDragActive
            ? { boxShadow: "0 0 40px var(--glow-electric), 0 0 80px var(--glow-cyan)" }
            : { background: "var(--border)" }
        }
      >
        <div
          {...getRootProps()}
          className={cn(
            "flex flex-col items-center justify-center rounded-[15px] p-14 transition-all duration-300 cursor-pointer select-none",
            status === "uploading" && "pointer-events-none opacity-60"
          )}
          style={{
            backgroundColor: isDragActive
              ? "color-mix(in oklch, var(--electric) 6%, var(--surface-1))"
              : "var(--surface-1)",
          }}
        >
          <input {...getInputProps()} />

          {/* Icon area */}
          <div className="mb-5 flex flex-col items-center">
            {status === "uploading" && (
              <Loader2 className="h-14 w-14 animate-spin" style={{ color: "var(--electric)" }} />
            )}
            {status === "idle" && (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300"
                style={{
                  backgroundColor: isDragActive
                    ? "color-mix(in oklch, var(--electric) 20%, transparent)"
                    : "color-mix(in oklch, var(--electric) 10%, transparent)",
                  border: "1px solid color-mix(in oklch, var(--electric) 20%, transparent)",
                  boxShadow: isDragActive ? "0 0 24px var(--glow-electric)" : "0 0 12px var(--glow-subtle)",
                }}
              >
                <Upload
                  className="h-7 w-7 transition-transform duration-300"
                  style={{
                    color: "var(--electric)",
                    transform: isDragActive ? "translateY(-2px)" : "none",
                  }}
                />
              </div>
            )}
            {status === "success" && (
              <CheckCircle2 className="h-14 w-14" style={{ color: "oklch(0.72 0.19 155)" }} />
            )}
            {status === "error" && (
              <AlertCircle className="h-14 w-14 text-destructive" />
            )}
          </div>

          <p className="mb-2 text-sm font-semibold">
            {isDragActive
              ? "Release to upload"
              : status === "uploading"
              ? "Uploading..."
              : "Drag & drop your dataset here"}
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            {status === "idle" && !isDragActive && "or click to browse files from your computer"}
            {isDragActive && "We'll process it automatically"}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">.csv</Badge>
            <span className="text-xs text-muted-foreground">·</span>
            <Badge variant="secondary" className="text-xs font-mono">.xlsx</Badge>
            <span className="text-xs text-muted-foreground">·</span>
            <Badge variant="secondary" className="text-xs font-mono">.parquet</Badge>
            <span className="text-xs text-muted-foreground">·</span>
            <Badge variant="secondary" className="text-xs font-mono">.json</Badge>
          </div>
        </div>
      </div>

      {/* Success result card */}
      {status === "success" && result && (
        <div
          className="animate-fade-in-up overflow-hidden rounded-xl"
          style={{
            backgroundColor: "var(--surface-1)",
            border: "1px solid var(--border)",
            boxShadow: "0 0 20px var(--glow-subtle), 0 4px 24px oklch(0 0 0 / 0.3)",
          }}
        >
          {/* Gradient top stripe */}
          <div
            className="h-[3px] w-full"
            style={{
              background: "linear-gradient(to right, var(--electric), var(--cyan), var(--electric-bright), var(--cyan), var(--electric))",
            }}
          />
          <div className="p-5">
            {/* File info */}
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: "color-mix(in oklch, var(--electric) 10%, transparent)",
                  border: "1px solid color-mix(in oklch, var(--electric) 20%, transparent)",
                }}
              >
                <FileSpreadsheet className="h-4 w-4" style={{ color: "var(--electric)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold">{result.filename}</p>
                <p className="text-xs text-muted-foreground">Dataset loaded successfully</p>
              </div>
              <div className="ml-auto">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: "color-mix(in oklch, oklch(0.72 0.19 155) 12%, transparent)",
                    color: "oklch(0.72 0.19 155)",
                    border: "1px solid color-mix(in oklch, oklch(0.72 0.19 155) 25%, transparent)",
                  }}
                >
                  Ready
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                value={result.rows.toLocaleString()}
                label="Rows"
                color="var(--electric)"
              />
              <StatCard
                value={String(result.columns)}
                label="Columns"
                color="var(--cyan)"
              />
              <StatCard
                value={String(
                  Object.values(result.dtypes).filter(
                    (d) => d.includes("float") || d.includes("int")
                  ).length
                )}
                label="Numeric"
                color="var(--electric-bright)"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {status === "error" && error && (
        <div
          className="animate-fade-in-up rounded-xl px-4 py-3 text-sm"
          style={{
            backgroundColor: "color-mix(in oklch, var(--destructive) 8%, transparent)",
            border: "1px solid color-mix(in oklch, var(--destructive) 20%, transparent)",
            color: "var(--destructive)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div
      className="rounded-lg p-3 text-center"
      style={{
        backgroundColor: "var(--surface-2)",
        border: `1px solid color-mix(in oklch, ${color} 15%, transparent)`,
      }}
    >
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
