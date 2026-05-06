"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { NNInspectResult } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface NNInspectorPanelProps {
  result: NNInspectResult;
}

const LAYER_COLOR_MAP: Record<string, string> = {
  weight: "#3b82f6",
  bias: "#8b5cf6",
};

function _layerColor(name: string): string {
  if (name.includes("bias")) return LAYER_COLOR_MAP.bias;
  return LAYER_COLOR_MAP.weight;
}

export function NNInspectorPanel({ result }: NNInspectorPanelProps) {
  const [expanded, setExpanded] = useState<number | null>(0);

  if (result.error) {
    return (
      <div className="p-4 text-red-400 text-sm">{result.error}</div>
    );
  }

  if (!result.layers || result.layers.length === 0) {
    return (
      <div className="p-4 text-white/30 text-sm">No layer data available.</div>
    );
  }

  return (
    <div className="overflow-y-auto h-full custom-scrollbar space-y-1 p-2">
      {result.type === "gradients" && typeof result.loss === "number" && (
        <div className="text-[11px] text-white/50 px-2 pb-2">
          Backward loss: <span className="text-white/80 font-mono">{result.loss.toFixed(4)}</span>
        </div>
      )}

      {/* Gradient flow bar chart (whole model overview) */}
      {result.type === "gradients" && result.layers.length > 0 && (
        <div className="px-1 pb-2">
          <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1 font-bold">Gradient Flow</div>
          <Plot
            data={[{
              type: "bar",
              orientation: "h",
              y: result.layers.map((l) => String(l.name ?? "")),
              x: result.layers.map((l) => Number(l.mean_abs ?? 0)),
              marker: {
                color: result.layers.map((l) =>
                  l.exploding ? "#f97316" : l.vanishing ? "#ef4444" : "#22c55e"
                ),
                opacity: 0.85,
              },
            } as never]}
            layout={{
              height: Math.max(120, result.layers.length * 26 + 40),
              margin: { t: 4, b: 28, l: 120, r: 8 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#1a2030",
              font: { color: "rgba(255,255,255,0.4)", size: 9 },
              xaxis: { title: { text: "Mean |grad|" }, gridcolor: "rgba(255,255,255,0.05)", type: "log" as never },
              yaxis: { autorange: "reversed" as never },
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Per-layer detail accordion */}
      {result.layers.map((layer, i) => {
        const name = String(layer.name ?? `layer_${i}`);
        const hist = layer.histogram as { counts: number[]; edges: number[] } | undefined;
        const isVanishing = layer.vanishing === true;
        const isExploding = layer.exploding === true;
        const isDead = layer.dead_neurons === true;
        const flagColor = isExploding ? "#f97316" : isVanishing ? "#ef4444" : isDead ? "#eab308" : "#22c55e";
        const hasFlag = isVanishing || isExploding || isDead;

        return (
          <div
            key={i}
            className="rounded-lg overflow-hidden"
            style={{ border: `1px solid ${hasFlag ? flagColor + "44" : "rgba(255,255,255,0.06)"}` }}
          >
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
              style={{ background: expanded === i ? "rgba(255,255,255,0.04)" : "transparent" }}
            >
              <span className="text-[11px] font-mono text-white/70 truncate">{name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {hasFlag && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: flagColor + "22", color: flagColor }}
                  >
                    {isExploding ? "EXPLODING" : isVanishing ? "VANISHING" : "DEAD"}
                  </span>
                )}
                <span className="text-white/30 text-[10px]">{expanded === i ? "▲" : "▼"}</span>
              </div>
            </button>

            {expanded === i && (
              <div className="px-3 pb-3 space-y-2">
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  {["mean", "std", "min", "max", "mean_abs", "max_abs", "pct_zeros"].map((k) => {
                    const v = layer[k];
                    if (v === undefined || v === null) return null;
                    return (
                      <div key={k} className="bg-[#1a2030] rounded px-2 py-1">
                        <div className="text-white/30">{k.replace("_", " ")}</div>
                        <div className="text-white/80 font-mono">{Number(v).toExponential(3)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Histogram */}
                {hist && hist.counts.length > 0 && (
                  <Plot
                    data={[{
                      type: "bar",
                      x: hist.edges.slice(0, -1).map((e, j) => (e + hist.edges[j + 1]) / 2),
                      y: hist.counts,
                      marker: { color: _layerColor(name), opacity: 0.75 },
                    } as never]}
                    layout={{
                      height: 110,
                      margin: { t: 4, b: 24, l: 32, r: 4 },
                      paper_bgcolor: "transparent",
                      plot_bgcolor: "#1a2030",
                      font: { color: "rgba(255,255,255,0.3)", size: 8 },
                      xaxis: { gridcolor: "rgba(255,255,255,0.04)" },
                      yaxis: { gridcolor: "rgba(255,255,255,0.04)" },
                      bargap: 0.05,
                    } as never}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: "100%" }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
