"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Microscope, Activity, GitBranch, BarChart3 } from "lucide-react";
import { NNInspectorPanel } from "../NNInspectorPanel";
import { inspectNNModel, type NNInspectResult } from "@/lib/api";

interface InspectTabProps {
  hasModel: boolean;
}

const TYPE_META = {
  weights: {
    label: "Weights",
    Icon: BarChart3,
    color: "#3b82f6",
    description:
      "Weight distributions for all trainable parameters. Histograms show spread — dead or saturated values indicate training issues.",
  },
  activations: {
    label: "Activations",
    Icon: Activity,
    color: "#22c55e",
    description:
      "Intermediate activations captured via forward hooks on a sample batch. Dead neurons (>50% zeros) may indicate dying ReLU.",
  },
  gradients: {
    label: "Gradients",
    Icon: GitBranch,
    color: "#f59e0b",
    description:
      "Gradient magnitudes from one backward pass. Vanishing (<1e-6) or exploding (>1.0) values indicate training instability.",
  },
} as const;

type InspectType = keyof typeof TYPE_META;

export function InspectTab({ hasModel }: InspectTabProps) {
  const [inspectType, setInspectType] = useState<InspectType>("weights");
  const [inspectResult, setInspectResult] = useState<NNInspectResult | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  const handleInspect = useCallback(async (type: InspectType) => {
    setInspectType(type);
    setIsInspecting(true);
    setInspectResult(null);
    try {
      const result = await inspectNNModel(type);
      setInspectResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inspection failed");
    } finally {
      setIsInspecting(false);
    }
  }, []);

  if (!hasModel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(245,158,11,0.07)",
              border: "1px solid rgba(245,158,11,0.15)",
              boxShadow: "0 0 24px rgba(245,158,11,0.07)",
            }}
          >
            <Microscope size={28} style={{ color: "rgba(245,158,11,0.4)" }} />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-white/40 text-[13px] font-medium">No trained model</p>
            <p className="text-white/20 text-[11px]">Train a model in the Design tab first</p>
          </div>
        </div>
      </div>
    );
  }

  const activeMeta = TYPE_META[inspectType];

  return (
    <div className="flex flex-col h-full">
      {/* ── Type selector ── */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="flex rounded-xl overflow-hidden p-1 gap-1"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {(Object.entries(TYPE_META) as [InspectType, typeof TYPE_META[InspectType]][]).map(([key, meta]) => {
            const active = inspectType === key;
            const running = isInspecting && inspectType === key;
            return (
              <button
                key={key}
                onClick={() => handleInspect(key)}
                disabled={isInspecting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-60"
                style={{
                  background: active ? `${meta.color}18` : "transparent",
                  color: active ? meta.color : "rgba(255,255,255,0.3)",
                  border: active ? `1px solid ${meta.color}35` : "1px solid transparent",
                  boxShadow: active ? `0 0 12px ${meta.color}15` : "none",
                }}
              >
                {running ? (
                  <div
                    className="w-3 h-3 rounded-full border border-t-transparent animate-spin"
                    style={{ borderColor: meta.color + "60", borderTopColor: meta.color }}
                  />
                ) : (
                  <meta.Icon size={12} />
                )}
                {running ? "Analyzing…" : meta.label}
              </button>
            );
          })}
        </div>

        {/* Description */}
        <div
          className="mt-2.5 px-3 py-2 rounded-lg text-[10px] leading-relaxed"
          style={{
            background: `${activeMeta.color}08`,
            border: `1px solid ${activeMeta.color}15`,
            color: "rgba(255,255,255,0.35)",
          }}
        >
          {activeMeta.description}
        </div>
      </div>

      {/* ── Results ── */}
      <div className="flex-1 min-h-0">
        {!inspectResult && !isInspecting && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: `${activeMeta.color}0a`,
                border: `1px solid ${activeMeta.color}20`,
              }}
            >
              <activeMeta.Icon size={20} style={{ color: activeMeta.color + "60" }} />
            </div>
            <p className="text-white/25 text-[12px]">
              Click <span style={{ color: activeMeta.color }}>{activeMeta.label}</span> above to analyze
            </p>
          </div>
        )}
        {isInspecting && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${activeMeta.color}30`, borderTopColor: activeMeta.color }}
            />
            <p className="text-white/40 text-sm">Analyzing model…</p>
          </div>
        )}
        {inspectResult && !isInspecting && (
          <NNInspectorPanel result={inspectResult} />
        )}
      </div>
    </div>
  );
}
