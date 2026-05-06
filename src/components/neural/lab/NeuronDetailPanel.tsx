"use client";

import dynamic from "next/dynamic";
import { Brain } from "lucide-react";
import type { NNNeuronDetail } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface NeuronDetailPanelProps {
  detail: NNNeuronDetail | null;
  loading?: boolean;
}

function StatCard({ label, value, accent = false, warn = false }: {
  label: string; value: string; accent?: boolean; warn?: boolean;
}) {
  const color = warn ? "#f59e0b" : accent ? "#3b82f6" : "rgba(255,255,255,0.75)";
  const bg = warn
    ? "rgba(245,158,11,0.08)"
    : accent
    ? "rgba(59,130,246,0.08)"
    : "rgba(255,255,255,0.03)";
  const border = warn
    ? "rgba(245,158,11,0.2)"
    : accent
    ? "rgba(59,130,246,0.2)"
    : "rgba(255,255,255,0.06)";
  return (
    <div
      className="rounded-lg px-2.5 py-2 text-center"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div className="text-[8.5px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
        {label}
      </div>
      <div className="text-[11px] font-mono leading-none" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function FlagPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider"
      style={{
        background: color + "18",
        color,
        border: `1px solid ${color}35`,
        boxShadow: `0 0 6px ${color}20`,
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 4px ${color}` }}
      />
      {label}
    </span>
  );
}

export function NeuronDetailPanel({ detail, loading }: NeuronDetailPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "rgba(59,130,246,0.4)", borderTopColor: "#3b82f6" }}
        />
        <p className="text-white/30 text-xs">Loading neuron…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(59,130,246,0.07)",
            border: "1px solid rgba(59,130,246,0.15)",
            boxShadow: "0 0 20px rgba(59,130,246,0.08)",
          }}
        >
          <Brain size={24} style={{ color: "rgba(59,130,246,0.4)" }} />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-white/40 text-[12px] font-medium">No neuron selected</p>
          <p className="text-white/20 text-[10px] leading-relaxed">
            Click any neuron in the diagram to inspect its weights, bias, and activation
          </p>
        </div>
      </div>
    );
  }

  const hist = detail.histogram;

  // Type color
  const typeColor =
    detail.type === "Linear" ? "#3b82f6" :
    detail.type === "Conv2d"  ? "#8b5cf6" :
    "#06b6d4";

  return (
    <div className="overflow-y-auto h-full custom-scrollbar">
      {/* ── Header card ── */}
      <div
        className="m-3 rounded-xl p-3 space-y-2"
        style={{
          background: `linear-gradient(135deg, ${typeColor}12 0%, rgba(255,255,255,0.02) 100%)`,
          border: `1px solid ${typeColor}25`,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-md tracking-widest uppercase"
                style={{ background: typeColor + "25", color: typeColor }}
              >
                {detail.type}
              </span>
              {detail.flags?.dead && <FlagPill label="DEAD" color="#f59e0b" />}
              {detail.flags?.high_influence && <FlagPill label="HIGH INFLUENCE" color="#22c55e" />}
            </div>
            <div className="text-[10px] font-mono text-white/50 truncate">{detail.layer_name}</div>
          </div>
          <div
            className="text-right shrink-0"
          >
            <div
              className="text-[18px] font-bold font-mono leading-none"
              style={{ color: typeColor }}
            >
              {detail.neuron_idx}
            </div>
            {detail.n_outputs != null && (
              <div className="text-[9px] text-white/25">of {detail.n_outputs}</div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-3">
        {/* ── Activation ── */}
        {detail.activation !== undefined && (
          <div
            className="rounded-xl p-3 relative overflow-hidden"
            style={{
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.22)",
              boxShadow: "0 0 16px rgba(34,197,94,0.06)",
            }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: "radial-gradient(ellipse at top left, rgba(34,197,94,0.15) 0%, transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="text-[8.5px] font-bold uppercase tracking-widest text-[#22c55e]/60 mb-1.5">
                Current Activation
              </div>
              <div className="text-[22px] font-mono font-bold text-[#22c55e] leading-none">
                {typeof detail.activation === "number"
                  ? detail.activation.toFixed(4)
                  : Array.isArray(detail.activation)
                  ? `[${(detail.activation as number[]).slice(0, 3).map((v) => v.toFixed(3)).join(", ")}…]`
                  : "—"}
              </div>
            </div>
          </div>
        )}

        {/* ── Bias ── */}
        {detail.bias !== null && detail.bias !== undefined && (
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{
              background: "rgba(139,92,246,0.07)",
              border: "1px solid rgba(139,92,246,0.2)",
            }}
          >
            <span
              className="text-[9.5px] font-bold uppercase tracking-widest"
              style={{ color: "rgba(139,92,246,0.7)" }}
            >
              Bias
            </span>
            <span className="text-[13px] font-mono font-semibold text-[#a78bfa]">
              {detail.bias.toFixed(6)}
            </span>
          </div>
        )}

        {/* ── Stats grid ── */}
        {detail.stats && (
          <div>
            <div className="text-[8.5px] font-bold uppercase tracking-widest text-white/20 mb-2">
              Weight Statistics
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <StatCard label="Mean"    value={detail.stats.mean.toExponential(2)} />
              <StatCard label="Std"     value={detail.stats.std.toExponential(2)} />
              <StatCard label="Min"     value={detail.stats.min.toExponential(2)} />
              <StatCard label="Max"     value={detail.stats.max.toExponential(2)} />
              <StatCard
                label="Abs Sum"
                value={detail.stats.abs_sum.toFixed(2)}
                warn={detail.flags?.high_influence}
              />
              {detail.n_inputs != null && (
                <StatCard label="Fan-in" value={String(detail.n_inputs)} accent />
              )}
            </div>
          </div>
        )}

        {/* ── Weight histogram ── */}
        {hist && hist.counts.length > 0 && (
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-[8.5px] font-bold uppercase tracking-widest text-white/25 mb-2">
              Weight Distribution
            </div>
            <Plot
              data={[{
                type: "bar",
                x: hist.edges.slice(0, -1).map((e, j) => (e + hist.edges[j + 1]) / 2),
                y: hist.counts,
                marker: {
                  color: hist.edges.slice(0, -1).map((e) =>
                    e < 0 ? "rgba(239,68,68,0.7)" : "rgba(59,130,246,0.7)"
                  ),
                },
              } as never]}
              layout={{
                height: 110,
                margin: { t: 2, b: 20, l: 28, r: 2 },
                paper_bgcolor: "transparent",
                plot_bgcolor: "rgba(15,20,30,0.6)",
                font: { color: "rgba(255,255,255,0.25)", size: 8 },
                xaxis: { gridcolor: "rgba(255,255,255,0.04)", zeroline: false },
                yaxis: { gridcolor: "rgba(255,255,255,0.04)" },
                bargap: 0.04,
              } as never}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {/* ── Incoming weights ── */}
        {detail.weights && detail.weights.length > 0 && (
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[8.5px] font-bold uppercase tracking-widest text-white/25">
                Incoming Weights
              </div>
              {detail.weights.length > 32 && (
                <span className="text-[8px] text-white/20">top 32 of {detail.weights.length}</span>
              )}
            </div>
            <Plot
              data={[{
                type: "bar",
                x: detail.weights.slice(0, 32).map((_, i) => i),
                y: detail.weights.slice(0, 32),
                marker: {
                  color: detail.weights.slice(0, 32).map((v) =>
                    v >= 0 ? "rgba(59,130,246,0.8)" : "rgba(239,68,68,0.8)"
                  ),
                },
              } as never]}
              layout={{
                height: 100,
                margin: { t: 2, b: 18, l: 28, r: 2 },
                paper_bgcolor: "transparent",
                plot_bgcolor: "rgba(15,20,30,0.6)",
                font: { color: "rgba(255,255,255,0.25)", size: 8 },
                xaxis: { title: { text: "idx" }, gridcolor: "rgba(255,255,255,0.04)", zeroline: false },
                yaxis: { gridcolor: "rgba(255,255,255,0.04)", zeroline: true, zerolinecolor: "rgba(255,255,255,0.1)" },
                bargap: 0.08,
              } as never}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {detail.note && (
          <p className="text-[10px] text-white/25 italic px-1">{detail.note}</p>
        )}
      </div>
    </div>
  );
}
