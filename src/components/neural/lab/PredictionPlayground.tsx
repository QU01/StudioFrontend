"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Shuffle, Play, Eye, EyeOff } from "lucide-react";
import {
  predictNNSample,
  fetchNNRandomSample,
  fetchNNSaliency,
  fetchNNHistory,
  type NNPredictResult,
  type NNSaliencyResult,
  type NNFeatureMeta,
} from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface PredictionPlaygroundProps {
  onPrediction?: (result: NNPredictResult) => void;
  currentFeatures?: Record<string, number>;
  onFeaturesChange?: (features: Record<string, number>) => void;
}

// Class color palette
const CLASS_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];

export function PredictionPlayground({
  onPrediction,
  currentFeatures,
  onFeaturesChange,
}: PredictionPlaygroundProps) {
  const [featureMeta, setFeatureMeta] = useState<NNFeatureMeta[]>([]);
  const [features, setFeatures] = useState<Record<string, number>>({});
  const [result, setResult] = useState<NNPredictResult | null>(null);
  const [saliency, setSaliency] = useState<NNSaliencyResult | null>(null);
  const [showSaliency, setShowSaliency] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isSampling, setIsSampling] = useState(false);
  const [isLoadingSaliency, setIsLoadingSaliency] = useState(false);

  // Load feature metadata from history on mount
  useEffect(() => {
    fetchNNHistory().then((data) => {
      if (data.meta) {
        const meta = data.meta as Record<string, unknown>;
        const cols = (meta.feature_cols as string[]) ?? [];
        const means = (meta.mean as number[]) ?? [];
        const stds = (meta.std as number[]) ?? [];
        const fMeta: NNFeatureMeta[] = cols.map((col, i) => ({
          col,
          mean: means[i] ?? 0,
          std: stds[i] ?? 1,
        }));
        setFeatureMeta(fMeta);
        const initFeatures: Record<string, number> = {};
        fMeta.forEach(({ col, mean }) => { initFeatures[col] = mean; });
        setFeatures(initFeatures);
      }
    }).catch(() => { /* no history */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRun = useCallback(async () => {
    if (Object.keys(features).length === 0) {
      toast.error("No features loaded. Load a sample first.");
      return;
    }
    setIsPredicting(true);
    setSaliency(null);
    setShowSaliency(false);
    try {
      const pred = await predictNNSample(features, true);
      setResult(pred);
      onPrediction?.(pred);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setIsPredicting(false);
    }
  }, [features, onPrediction]);

  const handleSample = useCallback(async () => {
    setIsSampling(true);
    try {
      const sample = await fetchNNRandomSample();
      setFeatures(sample.features);
      if (sample.feature_meta.length > 0) {
        setFeatureMeta(sample.feature_meta);
      }
      setSaliency(null);
      setResult(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch sample");
    } finally {
      setIsSampling(false);
    }
  }, []);

  const handleSaliency = useCallback(async () => {
    if (!result) return;
    if (showSaliency && saliency) {
      setShowSaliency(false);
      return;
    }
    setIsLoadingSaliency(true);
    try {
      const sal = await fetchNNSaliency(features, result.pred_class);
      setSaliency(sal);
      setShowSaliency(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saliency failed");
    } finally {
      setIsLoadingSaliency(false);
    }
  }, [features, result, showSaliency, saliency]);

  const updateFeature = useCallback((col: string, value: number) => {
    setFeatures((prev) => ({ ...prev, [col]: value }));
  }, []);

  // Propagate feature changes to parent
  useEffect(() => {
    if (Object.keys(features).length > 0) {
      onFeaturesChange?.(features);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);

  const isRegression = result?.task === "regression";
  const predColor = result != null && !isRegression
    ? CLASS_COLORS[(result.pred_class ?? 0) % CLASS_COLORS.length]
    : "#06b6d4";

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }}
          />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            Prediction Playground
          </span>
        </div>
        <button
          onClick={handleSample}
          disabled={isSampling}
          className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 active:scale-95"
          style={{
            background: "rgba(59,130,246,0.1)",
            color: "#93c5fd",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          <Shuffle size={11} />
          {isSampling ? "Loading…" : "Random"}
        </button>
      </div>

      {/* ── Feature inputs ── */}
      <div className="p-3 shrink-0">
        {featureMeta.length === 0 ? (
          <div
            className="rounded-xl p-5 text-center"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.07)",
            }}
          >
            <p className="text-white/25 text-xs">No feature metadata available.</p>
            <p className="text-white/15 text-[10px] mt-1">Train a model first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Feature grid */}
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
            >
              {featureMeta.map(({ col, mean, std }) => {
                const val = features[col] ?? mean;

                // Saliency color overlay
                let borderColor = "rgba(255,255,255,0.08)";
                let glowColor = "transparent";
                if (saliency && showSaliency) {
                  const idx = saliency.feature_cols.indexOf(col);
                  if (idx >= 0) {
                    const norm = saliency.normalized[idx];
                    const grad = saliency.gradients[idx];
                    if (grad >= 0) {
                      borderColor = `rgba(34,197,94,${0.15 + norm * 0.55})`;
                      glowColor = `rgba(34,197,94,${norm * 0.15})`;
                    } else {
                      borderColor = `rgba(239,68,68,${0.15 + norm * 0.55})`;
                      glowColor = `rgba(239,68,68,${norm * 0.15})`;
                    }
                  }
                }

                return (
                  <div key={col} className="space-y-0.5">
                    <div className="text-[9px] text-white/35 truncate font-mono px-0.5" title={col}>
                      {col}
                    </div>
                    <input
                      type="number"
                      step={(std / 10).toFixed(6)}
                      value={val}
                      onChange={(e) => updateFeature(col, parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg px-2 py-1.5 text-[11px] font-mono text-white/80 focus:outline-none transition-all"
                      style={{
                        background: `rgba(15,20,30,0.8)`,
                        border: `1px solid ${borderColor}`,
                        boxShadow: glowColor !== "transparent" ? `0 0 8px ${glowColor}` : "none",
                      }}
                      title={`mean: ${mean.toFixed(3)}, std: ${std.toFixed(3)}`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Action bar */}
            <div className="flex gap-2">
              <button
                onClick={handleRun}
                disabled={isPredicting}
                className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold text-white transition-all disabled:opacity-50 active:scale-[0.98]"
                style={{
                  background: isPredicting
                    ? "rgba(59,130,246,0.2)"
                    : "linear-gradient(135deg, rgba(59,130,246,0.9) 0%, rgba(99,102,241,0.9) 100%)",
                  boxShadow: isPredicting ? "none" : "0 0 18px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {isPredicting ? (
                  <>
                    <span
                      className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white/60 animate-spin"
                    />
                    Running…
                  </>
                ) : (
                  <>
                    <Play size={12} fill="white" />
                    Run Inference
                  </>
                )}
              </button>
              {result && (
                <button
                  onClick={handleSaliency}
                  disabled={isLoadingSaliency}
                  className="px-3 py-2.5 rounded-xl flex items-center gap-1.5 text-[10px] font-semibold transition-all disabled:opacity-50 active:scale-95"
                  style={{
                    background: showSaliency ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${showSaliency ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: showSaliency ? "#4ade80" : "rgba(255,255,255,0.4)",
                  }}
                  title="Toggle feature importance (input gradient)"
                >
                  {isLoadingSaliency
                    ? <span className="w-3 h-3 border border-t-transparent border-green-400 rounded-full animate-spin" />
                    : showSaliency ? <EyeOff size={12} /> : <Eye size={12} />}
                  {isLoadingSaliency ? "…" : "Grad"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Result card ── */}
      {result && (
        <div
          className="mx-3 mb-3 rounded-xl overflow-hidden"
          style={{
            border: `1px solid ${predColor}30`,
            boxShadow: `0 0 20px ${predColor}12`,
          }}
        >
          {isRegression ? (
            /* ── Regression output ── */
            <div>
              <div
                className="px-4 py-3 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${predColor}12 0%, ${predColor}05 100%)` }}
              >
                <div className="text-[8.5px] font-bold uppercase tracking-widest text-white/30 mb-2">
                  Predicted Outputs
                </div>
                <div className="space-y-2">
                  {Object.entries(result.outputs ?? {}).map(([col, val]) => (
                    <div key={col} className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] font-mono text-white/50 truncate">{col}</span>
                      <span
                        className="text-[16px] font-bold font-mono leading-none"
                        style={{ color: predColor, textShadow: `0 0 12px ${predColor}40` }}
                      >
                        {typeof val === "number" ? val.toFixed(4) : val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Classification output ── */
            <div>
              <div
                className="px-4 py-4 text-center relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${predColor}14 0%, ${predColor}06 100%)` }}
              >
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ background: `radial-gradient(ellipse at center top, ${predColor}60 0%, transparent 60%)` }}
                />
                <div className="relative">
                  <div className="text-[8.5px] font-bold uppercase tracking-widest text-white/30 mb-2">
                    Prediction
                  </div>
                  <div
                    className="text-[28px] font-black leading-none mb-1"
                    style={{ color: predColor, textShadow: `0 0 20px ${predColor}60` }}
                  >
                    {result.pred_label}
                  </div>
                  <div
                    className="text-[11px] font-mono px-3 py-0.5 rounded-full inline-block"
                    style={{ background: predColor + "20", color: predColor + "cc", border: `1px solid ${predColor}30` }}
                  >
                    {((result.probs?.[result.pred_class ?? 0] ?? 0) * 100).toFixed(1)}% confidence
                  </div>
                </div>
              </div>

              {(result.classes?.length ?? 0) > 0 && (
                <div className="px-3 py-3" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="text-[8.5px] font-bold uppercase tracking-widest text-white/20 mb-1.5">
                    Class Probabilities
                  </div>
                  <Plot
                    data={[{
                      type: "bar", orientation: "h",
                      y: result.classes,
                      x: (result.probs ?? []).map((p) => p * 100),
                      marker: {
                        color: (result.classes ?? []).map((_, i) =>
                          i === result.pred_class ? predColor : "rgba(255,255,255,0.08)"
                        ),
                      },
                    } as never]}
                    layout={{
                      height: Math.max(72, (result.classes?.length ?? 1) * 22 + 36),
                      margin: { t: 2, b: 22, l: 72, r: 8 },
                      paper_bgcolor: "transparent", plot_bgcolor: "rgba(0,0,0,0)",
                      font: { color: "rgba(255,255,255,0.3)", size: 9 },
                      xaxis: { title: { text: "%" }, range: [0, 100], gridcolor: "rgba(255,255,255,0.04)", zeroline: false },
                      yaxis: { autorange: "reversed" as never, gridcolor: "rgba(255,255,255,0.03)" },
                    } as never}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: "100%" }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Saliency bar chart (both tasks) */}
          {saliency && showSaliency && (
            <div
              className="px-3 py-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.15)" }}
            >
              <div className="text-[8.5px] font-bold uppercase tracking-widest text-[#22c55e]/50 mb-1.5">
                Feature Importance · ∂output/∂input
              </div>
              <Plot
                data={[{
                  type: "bar", orientation: "h",
                  y: saliency.feature_cols,
                  x: saliency.gradients,
                  marker: {
                    color: saliency.gradients.map((v) =>
                      v >= 0 ? "rgba(34,197,94,0.75)" : "rgba(239,68,68,0.75)"
                    ),
                  },
                } as never]}
                layout={{
                  height: Math.max(72, saliency.feature_cols.length * 18 + 36),
                  margin: { t: 2, b: 22, l: 90, r: 8 },
                  paper_bgcolor: "transparent", plot_bgcolor: "rgba(0,0,0,0)",
                  font: { color: "rgba(255,255,255,0.3)", size: 8 },
                  xaxis: { title: { text: "gradient" }, gridcolor: "rgba(255,255,255,0.04)", zeroline: true, zerolinecolor: "rgba(255,255,255,0.12)" },
                  yaxis: { autorange: "reversed" as never, gridcolor: "rgba(255,255,255,0.03)" },
                } as never}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%" }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
