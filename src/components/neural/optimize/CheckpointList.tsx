"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Save, FolderOpen, Trash2, RefreshCw, HardDrive } from "lucide-react";
import {
  listNNCheckpoints,
  saveNNCheckpoint,
  loadNNCheckpoint,
  deleteNNCheckpoint,
  type NNCheckpoint,
} from "@/lib/api";

interface CheckpointListProps {
  onLoaded?: () => void;
  onCheckpointLoaded?: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function CheckpointList({ onLoaded, onCheckpointLoaded }: CheckpointListProps) {
  const [checkpoints, setCheckpoints] = useState<NNCheckpoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loadingFilename, setLoadingFilename] = useState<string | null>(null);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listNNCheckpoints();
      setCheckpoints(data.checkpoints);
    } catch {
      setCheckpoints([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = useCallback(async () => {
    const name = saveName.trim() || `checkpoint-${Date.now()}`;
    setIsSaving(true);
    try {
      await saveNNCheckpoint(name);
      toast.success(`Checkpoint "${name}" saved`);
      setSaveName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [saveName, refresh]);

  const handleLoad = useCallback(async (filename: string) => {
    setLoadingFilename(filename);
    try {
      await loadNNCheckpoint(filename);
      toast.success("Checkpoint loaded successfully");
      onLoaded?.();
      onCheckpointLoaded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoadingFilename(null);
    }
  }, [onLoaded]);

  const handleDelete = useCallback(async (filename: string) => {
    setDeletingFilename(filename);
    try {
      await deleteNNCheckpoint(filename);
      toast.success("Checkpoint deleted");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingFilename(null);
    }
  }, [refresh]);

  return (
    <div className="p-4 space-y-5">
      {/* ── Title ── */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          <HardDrive size={16} style={{ color: "#22c55e" }} />
        </div>
        <div>
          <div className="text-[12px] font-semibold text-white/80">Checkpoints</div>
          <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">
            Snapshot the current model before destructive operations.
            Checkpoints persist across server restarts.
          </p>
        </div>
      </div>

      {/* ── Save form ── */}
      <div
        className="rounded-xl p-3 space-y-2"
        style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}
      >
        <label className="text-[9px] font-bold uppercase tracking-widest text-[#22c55e]/50">
          Save Current Model
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isSaving && handleSave()}
            placeholder="checkpoint name…"
            className="flex-1 rounded-lg px-3 py-2 text-[11px] font-mono text-white/70 placeholder-white/20 focus:outline-none transition-colors"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 active:scale-95"
            style={{
              background: "rgba(34,197,94,0.18)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#86efac",
              boxShadow: isSaving ? "none" : "0 0 10px rgba(34,197,94,0.1)",
            }}
          >
            <Save size={12} />
            {isSaving ? "…" : "Save"}
          </button>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 transition-all hover:bg-white/5 disabled:opacity-50"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
            title="Refresh list"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── List ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 gap-2">
          <RefreshCw size={14} className="animate-spin text-white/25" />
          <p className="text-white/25 text-xs">Loading checkpoints…</p>
        </div>
      )}

      {!isLoading && checkpoints.length === 0 && (
        <div
          className="rounded-xl p-6 text-center space-y-2"
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px dashed rgba(255,255,255,0.07)",
          }}
        >
          <HardDrive size={24} className="mx-auto" style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-white/25 text-[11px] font-medium">No checkpoints yet</p>
          <p className="text-white/15 text-[10px]">Save one before pruning or quantizing.</p>
        </div>
      )}

      <div className="space-y-2">
        {checkpoints.map((cp) => (
          <div
            key={cp.filename}
            className="rounded-xl p-3.5 space-y-3 relative overflow-hidden transition-all hover:border-white/12"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-white/80 truncate">{cp.name}</div>
                <div className="text-[9.5px] text-white/30 mt-0.5 font-mono">{formatDate(cp.timestamp)}</div>
              </div>
              {cp.val_acc != null && (
                <span
                  className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg shrink-0"
                  style={{
                    background: "rgba(34,197,94,0.12)",
                    color: "#4ade80",
                    border: "1px solid rgba(34,197,94,0.2)",
                  }}
                >
                  {cp.val_acc.toFixed(1)}%
                </span>
              )}
            </div>

            {/* Meta pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[9px] px-2 py-0.5 rounded-md font-mono"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
              >
                {formatBytes(cp.size_bytes)}
              </span>
              {cp.n_features != null && (
                <span
                  className="text-[9px] px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
                >
                  {cp.n_features} features
                </span>
              )}
              {cp.n_classes != null && (
                <span
                  className="text-[9px] px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
                >
                  {cp.n_classes} classes
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleLoad(cp.filename)}
                disabled={loadingFilename === cp.filename}
                className="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-semibold transition-all disabled:opacity-50 active:scale-95"
                style={{
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.22)",
                  color: "#93c5fd",
                }}
              >
                {loadingFilename === cp.filename ? (
                  <>
                    <span
                      className="w-3 h-3 border border-t-transparent border-[#93c5fd] rounded-full animate-spin"
                    />
                    Loading…
                  </>
                ) : (
                  <>
                    <FolderOpen size={11} />
                    Load
                  </>
                )}
              </button>
              <button
                onClick={() => handleDelete(cp.filename)}
                disabled={deletingFilename === cp.filename}
                className="py-2 px-3 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 hover:bg-red-500/10 active:scale-95"
                style={{
                  border: "1px solid rgba(239,68,68,0.15)",
                  color: "rgba(239,68,68,0.5)",
                }}
                title="Delete checkpoint"
              >
                {deletingFilename === cp.filename ? (
                  <span
                    className="w-3 h-3 border border-t-transparent border-red-400 rounded-full animate-spin"
                  />
                ) : (
                  <Trash2 size={12} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
