"use client";

import { useState, useCallback } from "react";
import { Save, Scissors, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { pruneNNModel, saveNNCheckpoint, type NNPruneResult } from "@/lib/api";

interface PruningPanelProps {
  onModelChanged?: () => void;
}

function MetricRow({ label, before, after, unit = "" }: {
  label: string; before: number; after: number; unit?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-white/40">{label}</span>
      <div className="flex items-center gap-2 text-[11px] font-mono">
        <span className="text-white/40">{before.toFixed(1)}{unit}</span>
        <span
          className="text-[8px] px-1"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >▶</span>
        <span className="text-white/80 font-semibold">{after.toFixed(1)}{unit}</span>
      </div>
    </div>
  );
}

function DeltaBadge({ value, unit = "%" }: { value: number; unit?: string }) {
  const pos = value >= 0;
  return (
    <span
      className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md"
      style={{
        background: pos ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color: pos ? "#4ade80" : "#f87171",
        border: `1px solid ${pos ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
      }}
    >
      {pos ? "+" : ""}{value.toFixed(1)}{unit}
    </span>
  );
}

export function PruningPanel({ onModelChanged }: PruningPanelProps) {
  const [sparsity, setSparsity] = useState(0.5);
  const [scope, setScope] = useState<"global" | "per_layer">("global");
  const [previewResult, setPreviewResult] = useState<NNPruneResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePreview = useCallback(async () => {
    setIsPreviewing(true);
    setPreviewResult(null);
    setShowConfirm(false);
    try {
      const result = await pruneNNModel(sparsity, scope, false);
      setPreviewResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  }, [sparsity, scope]);

  const handleApply = useCallback(async () => {
    setIsApplying(true);
    setShowConfirm(false);
    try {
      const result = await pruneNNModel(sparsity, scope, true);
      if (result.committed) {
        toast.success(`Pruning applied — ${result.sparsity_actual.toFixed(1)}% sparsity`);
        setPreviewResult(result);
        onModelChanged?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pruning failed");
    } finally {
      setIsApplying(false);
    }
  }, [sparsity, scope, onModelChanged]);

  const handleSaveCheckpoint = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveNNCheckpoint("pre-prune");
      toast.success("Checkpoint saved as 'pre-prune'");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, []);

  const sparsityPct = Math.round(sparsity * 100);

  return (
    <div className="p-4 space-y-5">
      {/* ── Title ── */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <Scissors size={16} style={{ color: "#3b82f6" }} />
        </div>
        <div>
          <div className="text-[12px] font-semibold text-white/80">Magnitude Pruning</div>
          <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">
            Zeros out lowest-magnitude weights (L1 unstructured). Reduces model size
            without changing architecture.
          </p>
        </div>
      </div>

      {/* ── Sparsity slider ── */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}
      >
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">Sparsity</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[26px] font-bold leading-none" style={{ color: "#3b82f6" }}>
              {sparsityPct}
            </span>
            <span className="text-[12px] text-[#3b82f6]/60">%</span>
          </div>
        </div>
        <input
          type="range"
          min={0.1}
          max={0.95}
          step={0.05}
          value={sparsity}
          onChange={(e) => { setSparsity(parseFloat(e.target.value)); setPreviewResult(null); }}
          className="w-full accent-[#3b82f6] h-1.5"
        />
        <div className="flex justify-between text-[8.5px] text-white/20">
          <span>10% light</span>
          <span>50% moderate</span>
          <span>95% aggressive</span>
        </div>
      </div>

      {/* ── Scope selector ── */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Scope</label>
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {(["global", "per_layer"] as const).map((s) => {
            const active = scope === s;
            return (
              <button
                key={s}
                onClick={() => setScope(s)}
                className="flex-1 py-2 rounded-lg text-[10px] font-semibold transition-all"
                style={{
                  background: active ? "rgba(59,130,246,0.18)" : "transparent",
                  color: active ? "#93c5fd" : "rgba(255,255,255,0.3)",
                  border: active ? "1px solid rgba(59,130,246,0.35)" : "1px solid transparent",
                }}
              >
                {s === "global" ? "Global" : "Per Layer"}
              </button>
            );
          })}
        </div>
        <p className="text-[9.5px] text-white/25 px-1">
          {scope === "global"
            ? "Prunes the lowest N% weights across the entire model."
            : "Prunes the lowest N% weights independently within each layer."}
        </p>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={isPreviewing}
          className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-50 active:scale-95"
          style={{
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.28)",
            color: "#93c5fd",
            boxShadow: isPreviewing ? "none" : "0 0 10px rgba(59,130,246,0.1)",
          }}
        >
          {isPreviewing ? (
            <span className="flex items-center justify-center gap-1.5">
              <span className="w-3 h-3 border border-t-transparent border-[#93c5fd] rounded-full animate-spin inline-block" />
              Calculating…
            </span>
          ) : "Preview Impact"}
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isApplying || isPreviewing}
          className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-50 active:scale-95"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.28)",
            color: "#fca5a5",
          }}
        >
          {isApplying ? "Applying…" : "Apply Prune"}
        </button>
      </div>

      {/* ── Preview results ── */}
      {previewResult && (
        <div
          className="rounded-xl p-4 space-y-3 relative overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: previewResult.committed
                ? "radial-gradient(ellipse at top right, rgba(34,197,94,0.08) 0%, transparent 60%)"
                : "radial-gradient(ellipse at top right, rgba(59,130,246,0.06) 0%, transparent 60%)",
            }}
          />
          <div className="relative">
            <div
              className="text-[9px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"
              style={{ color: previewResult.committed ? "#22c55e" : "rgba(255,255,255,0.35)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: previewResult.committed ? "#22c55e" : "rgba(255,255,255,0.3)" }}
              />
              {previewResult.committed ? "Applied" : "Preview"} Results
            </div>
            <div className="space-y-2.5">
              <MetricRow label="Accuracy" before={previewResult.accuracy_before} after={previewResult.accuracy_after} unit="%" />
              <MetricRow label="Sparsity" before={0} after={previewResult.sparsity_actual} unit="%" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40">Size Reduction</span>
                <DeltaBadge value={previewResult.size_reduction_pct} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40">Accuracy Δ</span>
                <DeltaBadge value={previewResult.accuracy_delta} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {showConfirm && (
        <div
          className="rounded-xl p-4 space-y-3 relative overflow-hidden"
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            boxShadow: "0 0 20px rgba(239,68,68,0.05)",
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/60 leading-relaxed">
              This <span className="text-red-400 font-semibold">permanently replaces</span> the current model with a pruned version.
              Save a checkpoint to be able to revert.
            </p>
          </div>

          <button
            onClick={handleSaveCheckpoint}
            disabled={isSaving}
            className="w-full py-2 rounded-lg flex items-center justify-center gap-2 text-[10px] text-white/50 transition-all hover:text-white/70 hover:bg-white/5 disabled:opacity-50"
            style={{ border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <Save size={12} />
            {isSaving ? "Saving checkpoint…" : "Save 'pre-prune' checkpoint first"}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 rounded-lg text-[10px] text-white/35 transition-all hover:text-white/55 hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex-1 py-2 rounded-lg text-[10px] font-bold transition-all active:scale-95"
              style={{
                background: "rgba(239,68,68,0.2)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#fca5a5",
                boxShadow: "0 0 12px rgba(239,68,68,0.12)",
              }}
            >
              Prune &amp; Replace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
