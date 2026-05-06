"use client";

import { useState, useCallback } from "react";
import { Save, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { quantizeNNModel, saveNNCheckpoint, type NNQuantizeResult } from "@/lib/api";

interface QuantizePanelProps {
  onModelChanged?: () => void;
}

const MODE_INFO = {
  dynamic: {
    label: "Dynamic INT8",
    sublabel: "8-bit integer",
    description: "Quantizes Linear layer weights to int8 at runtime. Fastest, broadest hardware support. ~75% size reduction.",
    color: "#3b82f6",
  },
  fp16: {
    label: "FP16 Cast",
    sublabel: "16-bit float",
    description: "Casts all weights to float16. ~50% size reduction with minimal accuracy loss on most hardware.",
    color: "#8b5cf6",
  },
} as const;

function MetricArrow({ label, before, after, unit = "" }: {
  label: string; before: number; after: number; unit?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-white/40">{label}</span>
      <div className="flex items-center gap-2 text-[11px] font-mono">
        <span className="text-white/40">{before.toFixed(1)}{unit}</span>
        <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.2)" }}>▶</span>
        <span className="text-white/80 font-semibold">{after.toFixed(1)}{unit}</span>
      </div>
    </div>
  );
}

function DeltaBadge({ value, unit = "%", invertPositive = false }: {
  value: number; unit?: string; invertPositive?: boolean;
}) {
  const isGood = invertPositive ? value <= 0 : value >= 0;
  return (
    <span
      className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md"
      style={{
        background: isGood ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color: isGood ? "#4ade80" : "#f87171",
        border: `1px solid ${isGood ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
      }}
    >
      {value >= 0 ? "+" : ""}{value.toFixed(1)}{unit}
    </span>
  );
}

export function QuantizePanel({ onModelChanged }: QuantizePanelProps) {
  const [mode, setMode] = useState<"dynamic" | "fp16">("dynamic");
  const [previewResult, setPreviewResult] = useState<NNQuantizeResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePreview = useCallback(async () => {
    setIsPreviewing(true);
    setPreviewResult(null);
    setShowConfirm(false);
    try {
      const result = await quantizeNNModel(mode, false);
      setPreviewResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  }, [mode]);

  const handleApply = useCallback(async () => {
    setIsApplying(true);
    setShowConfirm(false);
    try {
      const result = await quantizeNNModel(mode, true);
      if (result.committed) {
        toast.success(`${MODE_INFO[mode].label} applied — ${result.size_reduction_pct.toFixed(0)}% size reduction`);
        setPreviewResult(result);
        onModelChanged?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Quantization failed");
    } finally {
      setIsApplying(false);
    }
  }, [mode, onModelChanged]);

  const handleSaveCheckpoint = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveNNCheckpoint("pre-quant");
      toast.success("Checkpoint saved as 'pre-quant'");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, []);

  const modeInfo = MODE_INFO[mode];

  return (
    <div className="p-4 space-y-5">
      {/* ── Title ── */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          <Zap size={16} style={{ color: "#8b5cf6" }} />
        </div>
        <div>
          <div className="text-[12px] font-semibold text-white/80">Post-Training Quantization</div>
          <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">
            Reduces model precision to lower memory footprint and speed up inference.
            Works on a copy — preview first, then commit.
          </p>
        </div>
      </div>

      {/* ── Mode selector ── */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Mode</label>
        <div className="space-y-2">
          {(Object.entries(MODE_INFO) as [keyof typeof MODE_INFO, typeof MODE_INFO[keyof typeof MODE_INFO]][]).map(([key, info]) => {
            const active = mode === key;
            return (
              <button
                key={key}
                onClick={() => { setMode(key); setPreviewResult(null); }}
                className="w-full p-3.5 rounded-xl text-left transition-all relative overflow-hidden"
                style={{
                  background: active ? `${info.color}0e` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${active ? `${info.color}30` : "rgba(255,255,255,0.06)"}`,
                  boxShadow: active ? `0 0 16px ${info.color}10` : "none",
                }}
              >
                {active && (
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      background: `radial-gradient(ellipse at top left, ${info.color}20 0%, transparent 60%)`,
                    }}
                  />
                )}
                <div className="relative flex items-start gap-3">
                  <div
                    className="w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center"
                    style={{
                      borderColor: active ? info.color : "rgba(255,255,255,0.2)",
                    }}
                  >
                    {active && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: info.color, boxShadow: `0 0 4px ${info.color}` }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[12px] font-semibold"
                        style={{ color: active ? info.color : "rgba(255,255,255,0.55)" }}
                      >
                        {info.label}
                      </span>
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: active ? info.color + "20" : "rgba(255,255,255,0.05)",
                          color: active ? info.color : "rgba(255,255,255,0.25)",
                        }}
                      >
                        {info.sublabel}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/25 mt-1 leading-relaxed">{info.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={isPreviewing}
          className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-50 active:scale-95"
          style={{
            background: `${modeInfo.color}12`,
            border: `1px solid ${modeInfo.color}28`,
            color: modeInfo.color + "cc",
            boxShadow: isPreviewing ? "none" : `0 0 10px ${modeInfo.color}10`,
          }}
        >
          {isPreviewing ? (
            <span className="flex items-center justify-center gap-1.5">
              <span
                className="w-3 h-3 border border-t-transparent rounded-full animate-spin inline-block"
                style={{ borderColor: modeInfo.color + "60", borderTopColor: modeInfo.color }}
              />
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
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
          }}
        >
          {isApplying ? "Applying…" : "Apply Quantize"}
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
                : `radial-gradient(ellipse at top right, ${modeInfo.color}0a 0%, transparent 60%)`,
            }}
          />
          <div className="relative space-y-2.5">
            <div
              className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: previewResult.committed ? "#22c55e" : "rgba(255,255,255,0.35)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: previewResult.committed ? "#22c55e" : "rgba(255,255,255,0.3)" }}
              />
              {previewResult.committed ? "Applied" : "Preview"} Results
            </div>
            <MetricArrow
              label="Accuracy"
              before={previewResult.accuracy_before}
              after={previewResult.accuracy_after}
              unit="%"
            />
            <MetricArrow
              label="Size"
              before={previewResult.size_before / 1024}
              after={previewResult.size_after / 1024}
              unit=" KB"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">Size Reduction</span>
              <DeltaBadge value={previewResult.size_reduction_pct} invertPositive />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">Accuracy Δ</span>
              <DeltaBadge value={previewResult.accuracy_delta} />
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {showConfirm && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            boxShadow: "0 0 20px rgba(239,68,68,0.05)",
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/60 leading-relaxed">
              This <span className="text-red-400 font-semibold">replaces</span> the active model
              with the {modeInfo.label} version. Save a checkpoint first.
            </p>
          </div>

          <button
            onClick={handleSaveCheckpoint}
            disabled={isSaving}
            className="w-full py-2 rounded-lg flex items-center justify-center gap-2 text-[10px] text-white/50 transition-all hover:text-white/70 hover:bg-white/5 disabled:opacity-50"
            style={{ border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <Save size={12} />
            {isSaving ? "Saving checkpoint…" : "Save 'pre-quant' checkpoint first"}
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
              Quantize &amp; Replace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
