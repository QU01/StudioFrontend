"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { runAutoML, type AutoMLResult } from "@/lib/api";

interface AutoMLPanelProps {
  isOpen: boolean;
  onClose: () => void;
  columnNames: string[];
}

export function AutoMLPanel({ isOpen, onClose, columnNames }: AutoMLPanelProps) {
  const [target, setTarget] = useState<string>(columnNames[0] ?? "");
  const [timeBudget, setTimeBudget] = useState<number>(60);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AutoMLResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRun = async () => {
    if (!target) return;
    setIsRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await runAutoML(target, timeBudget, []);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AutoML failed");
    } finally {
      setIsRunning(false);
    }
  };

  const sortedModels = result
    ? [...result.models_tried].sort((a, b) => {
        const av = a.metric_value ?? -Infinity;
        const bv = b.metric_value ?? -Infinity;
        return bv - av;
      })
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-xl overflow-y-auto"
        style={{
          background: "#1a2030",
          border: "1px solid rgba(255,255,255,0.1)",
          width: 640,
          maxHeight: "80vh",
          padding: "1.5rem",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-bold text-white tracking-wide">AutoML Search</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors rounded p-0.5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-4 mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-white/40 uppercase tracking-widest font-bold">Target Column</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={isRunning}
              className="rounded-md text-[13px] text-white px-3 py-1.5 outline-none disabled:opacity-50"
              style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", minWidth: 160 }}
            >
              {columnNames.length === 0 && (
                <option value="">No dataset loaded</option>
              )}
              {columnNames.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-white/40 uppercase tracking-widest font-bold">Time Budget (s)</label>
            <input
              type="number"
              value={timeBudget}
              min={10}
              max={300}
              disabled={isRunning}
              onChange={(e) => setTimeBudget(Number(e.target.value))}
              className="rounded-md text-[13px] text-white px-3 py-1.5 outline-none w-24 disabled:opacity-50"
              style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning || !target}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "#7c3aed", border: "1px solid #7c3aed99" }}
          >
            {isRunning ? (
              <>
                <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
                </svg>
                Running...
              </>
            ) : (
              "Run AutoML"
            )}
          </button>
        </div>

        {/* Loading state */}
        {isRunning && (
          <div className="flex items-center gap-3 py-6 justify-center text-white/50 text-[13px]">
            <svg className="animate-spin" width={18} height={18} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#7c3aed" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
            </svg>
            Searching for best model... (up to {timeBudget}s)
          </div>
        )}

        {/* Error */}
        {error && !isRunning && (
          <div className="rounded-lg px-4 py-3 text-[13px] text-red-400 mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && !isRunning && (
          <div className="flex flex-col gap-5">
            {/* Summary */}
            <div className="rounded-lg p-4" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div className="text-[22px] font-bold text-emerald-400 mb-1">{result.best_estimator}</div>
              <div className="text-[13px] text-white/60 mb-1">
                <span className="text-white/40">{result.metric}:</span>{" "}
                <span className="text-emerald-300 font-semibold">{(1 - result.best_loss).toFixed(3)}</span>
              </div>
              <div className="text-[12px] text-white/30 uppercase tracking-widest">Task: {result.task}</div>
            </div>

            {/* Models tried table */}
            {sortedModels.length > 0 && (
              <div>
                <div className="text-[11px] text-white/30 uppercase tracking-widest font-bold mb-2">Models Tried</div>
                <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <th className="text-left py-1.5 pr-4 text-white/30 font-semibold text-[11px] uppercase tracking-wide">Model</th>
                      <th className="text-right py-1.5 text-white/30 font-semibold text-[11px] uppercase tracking-wide">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedModels.map((m, i) => {
                      const isBest = m.model === result.best_estimator;
                      return (
                        <tr
                          key={`${m.model}-${i}`}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            background: isBest ? "rgba(16,185,129,0.08)" : "transparent",
                          }}
                        >
                          <td className="py-1.5 pr-4" style={{ color: isBest ? "#34d399" : "rgba(255,255,255,0.7)" }}>
                            {isBest && <span className="mr-1.5 text-emerald-400">★</span>}
                            {m.model}
                          </td>
                          <td className="py-1.5 text-right font-mono" style={{ color: isBest ? "#34d399" : "rgba(255,255,255,0.5)" }}>
                            {m.metric_value != null ? m.metric_value.toFixed(4) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
