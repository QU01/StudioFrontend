"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, Cpu, Download } from "lucide-react";
import type { NNTrainEvent } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface EpochData {
  epoch: number;
  train_loss: number;
  train_acc: number | null;
  val_loss: number;
  val_acc: number | null;
  val_r2?: number | null;
  val_rmse?: number | null;
}

interface StartMeta {
  total_epochs: number;
  n_features: number;
  n_classes: number;
  train_samples: number;
  val_samples: number;
  device: string;
}

interface DoneResult {
  val_acc: number | null;
  val_r2?: number | null;
  val_rmse?: number | null;
  val_loss: number;
  n_classes: number;
  classes: string[];
}

interface TrainingMonitorProps {
  status: "idle" | "training" | "done" | "error";
  meta: StartMeta | null;
  epochs: EpochData[];
  done: DoneResult | null;
  error: string | null;
  onStop: () => void;
  onExport?: (format: string) => void;
}

const PLOT_LAYOUT_BASE = {
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: { color: "#ffffff80", size: 10, family: "monospace" },
  margin: { l: 38, r: 8, t: 8, b: 28 },
  legend: { orientation: "h" as const, y: -0.25, font: { size: 9 } },
  xaxis: {
    gridcolor: "#ffffff10",
    zerolinecolor: "#ffffff10",
    tickfont: { size: 9 },
  },
  yaxis: {
    gridcolor: "#ffffff10",
    zerolinecolor: "#ffffff10",
    tickfont: { size: 9 },
  },
};

const PLOT_CONFIG = {
  displayModeBar: false,
  responsive: true,
};

export function TrainingMonitor({ status, meta, epochs, done, error, onStop, onExport }: TrainingMonitorProps) {
  const epochNums = epochs.map((e) => e.epoch);
  const totalEpochs = meta?.total_epochs ?? 0;
  const currentEpoch = epochs.length;
  const progress = totalEpochs > 0 ? (currentEpoch / totalEpochs) * 100 : 0;
  const lastEpoch = epochs[epochs.length - 1];

  // Detect regression: val_acc is null but val_r2 may be present
  const isRegression = epochs.length > 0 && epochs[0].val_acc == null;

  const lossData = useMemo(() => [
    {
      x: epochNums,
      y: epochs.map((e) => e.train_loss),
      type: "scatter" as const,
      mode: "lines" as const,
      name: "Train Loss",
      line: { color: "#3b82f6", width: 2 },
    },
    {
      x: epochNums,
      y: epochs.map((e) => e.val_loss),
      type: "scatter" as const,
      mode: "lines" as const,
      name: "Val Loss",
      line: { color: "#f97316", width: 2, dash: "dot" as const },
    },
  ], [epochs]);

  const accData = useMemo(() => [
    {
      x: epochNums,
      y: isRegression
        ? epochs.map((e) => e.val_r2 != null ? Number((e.val_r2 * 100).toFixed(2)) : null)
        : epochs.map((e) => e.train_acc),
      type: "scatter" as const,
      mode: "lines" as const,
      name: isRegression ? "Val R²" : "Train Acc",
      line: { color: "#22c55e", width: 2 },
    },
    ...(isRegression ? [] : [{
      x: epochNums,
      y: epochs.map((e) => e.val_acc),
      type: "scatter" as const,
      mode: "lines" as const,
      name: "Val Acc",
      line: { color: "#a855f7", width: 2, dash: "dot" as const },
    }]),
  ], [epochs, isRegression]);

  if (status === "idle") return null;

  return (
    <div className="flex flex-col h-full overflow-auto custom-scrollbar px-4 py-3 gap-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "training" && (
            <Loader2 size={14} className="animate-spin text-[#3b82f6]" />
          )}
          {status === "done" && <CheckCircle2 size={14} className="text-[#22c55e]" />}
          {status === "error" && <XCircle size={14} className="text-red-400" />}
          <span className="text-[12px] font-semibold text-white/80">
            {status === "training" ? "Training…" : status === "done" ? "Training Complete" : "Training Error"}
          </span>
        </div>
        {status === "training" && (
          <button
            onClick={onStop}
            className="text-[10px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 px-2 py-1 rounded border border-red-400/20 transition-all"
          >
            Stop
          </button>
        )}
      </div>

      {/* ── Error ── */}
      {status === "error" && error && (
        <div className="rounded-lg px-3 py-2 text-[11px] text-red-300 bg-red-400/10 border border-red-400/20">
          {error}
        </div>
      )}

      {/* ── Meta info ── */}
      {meta && (
        <div className="flex gap-3 flex-wrap">
          {[
            { label: "Device", val: meta.device.toUpperCase() },
            { label: "Features", val: meta.n_features },
            { label: "Classes", val: meta.n_classes },
            { label: "Train", val: `${meta.train_samples} rows` },
            { label: "Val", val: `${meta.val_samples} rows` },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center bg-white/5 rounded-md px-2.5 py-1.5 min-w-[52px]">
              <span className="text-[9px] text-white/30 uppercase tracking-wider">{item.label}</span>
              <span className="text-[11px] font-bold text-white/80">{item.val}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <Cpu size={10} />
            {meta.device === "cuda" ? "GPU Accelerated" : "CPU Mode"}
          </div>
        </div>
      )}

      {/* ── Progress bar ── */}
      {meta && (
        <div>
          <div className="flex justify-between text-[10px] text-white/40 mb-1">
            <span>Epoch {currentEpoch} / {totalEpochs}</span>
            {lastEpoch && (
              <span>
                loss {lastEpoch.val_loss.toFixed(4)}
                {isRegression
                  ? lastEpoch.val_r2 != null ? ` · R² ${(lastEpoch.val_r2 * 100).toFixed(1)}%` : ""
                  : lastEpoch.val_acc != null ? ` · acc ${lastEpoch.val_acc.toFixed(1)}%` : ""}
              </span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: status === "done"
                  ? "linear-gradient(90deg, #22c55e, #16a34a)"
                  : "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                boxShadow: status === "training" ? "0 0 8px rgba(59,130,246,0.6)" : "none",
              }}
            />
          </div>
        </div>
      )}

      {/* ── Charts ── */}
      {epochs.length > 1 && (
        <div className="grid grid-cols-2 gap-2" style={{ minHeight: 160 }}>
          <div className="bg-white/3 rounded-lg overflow-hidden border border-white/5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/25 px-2 pt-2 pb-0">Loss</div>
            <Plot
              data={lossData}
              layout={{ ...PLOT_LAYOUT_BASE, height: 140 }}
              config={PLOT_CONFIG}
              style={{ width: "100%", height: 140 }}
              useResizeHandler
            />
          </div>
          <div className="bg-white/3 rounded-lg overflow-hidden border border-white/5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/25 px-2 pt-2 pb-0">{isRegression ? "R² (%)" : "Accuracy (%)"}</div>
            <Plot
              data={accData}
              layout={{ ...PLOT_LAYOUT_BASE, height: 140, yaxis: { ...PLOT_LAYOUT_BASE.yaxis, range: [0, 100] } }}
              config={PLOT_CONFIG}
              style={{ width: "100%", height: 140 }}
              useResizeHandler
            />
          </div>
        </div>
      )}

      {/* ── Done card ── */}
      {status === "done" && done && (
        <div className="rounded-xl p-3 border border-[#22c55e]/30 bg-[#22c55e]/8 space-y-2">
          <div className="text-[11px] font-semibold text-[#86efac]">Final Results</div>
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] text-white/30 uppercase tracking-wider">
                {isRegression ? "Val R²" : "Val Accuracy"}
              </span>
              <span className="text-[22px] font-bold text-[#22c55e]">
                {isRegression
                  ? done.val_r2 != null ? `${(done.val_r2 * 100).toFixed(1)}%` : "—"
                  : done.val_acc != null ? `${done.val_acc.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-white/30 uppercase tracking-wider">Val Loss</span>
              <span className="text-[22px] font-bold text-white/70">{done.val_loss.toFixed(4)}</span>
            </div>
            {isRegression && done.val_rmse != null && (
              <div className="flex flex-col">
                <span className="text-[9px] text-white/30 uppercase tracking-wider">RMSE</span>
                <span className="text-[22px] font-bold text-white/70">{done.val_rmse.toFixed(4)}</span>
              </div>
            )}
          </div>
          {!isRegression && done.classes.length <= 8 && (
            <div className="flex flex-wrap gap-1">
              {done.classes.map((c) => (
                <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/50 border border-white/10">
                  {c}
                </span>
              ))}
            </div>
          )}
          {onExport && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onExport("torchscript")}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: "color-mix(in oklch, #3b82f6 12%, transparent)",
                  border: "1px solid color-mix(in oklch, #3b82f6 30%, transparent)",
                  color: "#93c5fd",
                }}
              >
                <Download size={11} />
                TorchScript (.pt)
              </button>
              <button
                onClick={() => onExport("onnx")}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: "color-mix(in oklch, #f97316 12%, transparent)",
                  border: "1px solid color-mix(in oklch, #f97316 30%, transparent)",
                  color: "#fdba74",
                }}
              >
                <Download size={11} />
                ONNX
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
