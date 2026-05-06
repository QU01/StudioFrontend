"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface TrainConfig {
  target: string;
  target_cols: string[];
  feature_cols: string[];
  task: "classification" | "regression" | string;
  epochs: number;
  lr: number;
  batch_size: number;
  use_pinn: boolean;
  physics_weight: number;
}

export function TrainConfigModal({
  isOpen,
  onClose,
  datasetCols,
  trainConfig,
  setTrainConfig,
  onConfirm,
  confirmLabel = "Start Training"
}: {
  isOpen: boolean;
  onClose: () => void;
  datasetCols: string[];
  trainConfig: TrainConfig;
  setTrainConfig: React.Dispatch<React.SetStateAction<TrainConfig>>;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  const [showFeatureSelect, setShowFeatureSelect] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#222a35] border border-white/10 rounded-2xl p-6 w-[440px] shadow-2xl space-y-5 relative">
        <div className="text-[15px] font-semibold text-white/90">Train Neural Network</div>

        {/* Task type toggle */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Task</label>
          <div
            className="flex rounded-xl p-1 gap-1"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {(["classification", "regression"] as const).map((t) => {
              const active = trainConfig.task === t;
              const color = t === "classification" ? "#22c55e" : "#06b6d4";
              return (
                <button
                  key={t}
                  onClick={() => setTrainConfig((p) => ({
                    ...p, task: t,
                    // Reset targets when switching
                    target: p.target,
                    target_cols: t === "regression" ? (p.target_cols.filter(x => x).length ? p.target_cols.filter(x => x) : (p.target ? [p.target] : [])) : (p.target ? [p.target] : []),
                  }))}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: active ? `${color}18` : "transparent",
                    color: active ? color : "rgba(255,255,255,0.3)",
                    border: active ? `1px solid ${color}35` : "1px solid transparent",
                  }}
                >
                  {t === "classification" ? "Classification" : "Regression"}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-white/25 px-0.5">
            {trainConfig.task === "classification"
              ? "Single categorical target. Trains with CrossEntropyLoss."
              : "One or more numeric targets. Trains with MSELoss."}
          </p>
        </div>

        {/* Target column(s) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">
            {trainConfig.task === "regression" ? "Target Columns" : "Target Column"}
          </label>
          {datasetCols.length > 0 ? (
            trainConfig.task === "classification" ? (
              <select
                value={trainConfig.target}
                onChange={(e) => setTrainConfig((p) => ({ ...p, target: e.target.value, target_cols: [e.target.value] }))}
                className="w-full bg-[#181d23] border border-white/10 rounded-md px-3 py-2 text-[13px] text-white/80 focus:outline-none focus:border-[#22c55e]"
              >
                {datasetCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <div
                className="rounded-xl p-2 space-y-1 max-h-[140px] overflow-y-auto custom-scrollbar"
                style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {datasetCols.map((c) => {
                  const checked = trainConfig.target_cols.includes(c);
                  return (
                    <label
                      key={c}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...trainConfig.target_cols.filter((x) => x), c]
                            : trainConfig.target_cols.filter((x) => x && x !== c);
                          // Also remove from feature_cols if it was there
                          const nextFeatures = trainConfig.feature_cols.filter((x) => x !== c);
                          setTrainConfig((p) => ({ ...p, target_cols: next, target: next[0] ?? "", feature_cols: nextFeatures }));
                        }}
                        className="accent-[#06b6d4]"
                      />
                      <span className="text-[12px] text-white/70 font-mono">{c}</span>
                      {checked && (
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}>
                          target
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-[11px] text-yellow-400/70 bg-yellow-400/10 border border-yellow-400/20 rounded px-3 py-2">
              No dataset loaded. Load a dataset first.
            </div>
          )}
        </div>

        {/* Input Features (collapsible) */}
        {datasetCols.length > 0 && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowFeatureSelect((v) => !v)}
              className="flex items-center gap-1.5 w-full text-left"
            >
              {showFeatureSelect ? <ChevronDown size={12} className="text-white/40" /> : <ChevronRight size={12} className="text-white/40" />}
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                Input Features
              </span>
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}
              >
                {trainConfig.feature_cols.length > 0
                  ? `${trainConfig.feature_cols.length} selected`
                  : "auto"}
              </span>
            </button>
            {showFeatureSelect && (
              <>
                <p className="text-[9px] text-white/25 px-0.5">
                  Choose which columns are inputs. Leave all unchecked to use every numeric non-target column automatically.
                </p>
                <div
                  className="rounded-xl p-2 space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar"
                  style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {datasetCols
                    .filter((c) => !trainConfig.target_cols.includes(c) && c !== trainConfig.target)
                    .map((c) => {
                      const checked = trainConfig.feature_cols.includes(c);
                      return (
                        <label
                          key={c}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...trainConfig.feature_cols, c]
                                : trainConfig.feature_cols.filter((x) => x !== c);
                              setTrainConfig((p) => ({ ...p, feature_cols: next }));
                            }}
                            className="accent-[#8b5cf6]"
                          />
                          <span className="text-[12px] text-white/70 font-mono">{c}</span>
                          {checked && (
                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                              input
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
                {trainConfig.feature_cols.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTrainConfig((p) => ({ ...p, feature_cols: [] }))}
                    className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
                  >
                    Clear selection (revert to auto)
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Epochs */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Epochs</label>
            <span className="text-[11px] font-bold text-[#22c55e]">{trainConfig.epochs}</span>
          </div>
          <input
            type="range" min={5} max={100} step={5}
            value={trainConfig.epochs}
            onChange={(e) => setTrainConfig((p) => ({ ...p, epochs: Number(e.target.value) }))}
            className="w-full accent-[#22c55e]"
          />
        </div>

        {/* Learning rate */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Learning Rate</label>
          <select
            value={trainConfig.lr}
            onChange={(e) => setTrainConfig((p) => ({ ...p, lr: Number(e.target.value) }))}
            className="w-full bg-[#181d23] border border-white/10 rounded-md px-3 py-2 text-[13px] text-white/80 focus:outline-none focus:border-[#22c55e]"
          >
            <option value={0.01}>0.01 — Fast</option>
            <option value={0.001}>0.001 — Default</option>
            <option value={0.0001}>0.0001 — Slow / stable</option>
          </select>
        </div>

        {/* Batch size */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Batch Size</label>
          <select
            value={trainConfig.batch_size}
            onChange={(e) => setTrainConfig((p) => ({ ...p, batch_size: Number(e.target.value) }))}
            className="w-full bg-[#181d23] border border-white/10 rounded-md px-3 py-2 text-[13px] text-white/80 focus:outline-none focus:border-[#22c55e]"
          >
            <option value={16}>16</option>
            <option value={32}>32 — Default</option>
            <option value={64}>64</option>
            <option value={128}>128</option>
          </select>
        </div>

        {/* PINN Config */}
        {trainConfig.task === "regression" && (
          <div className="space-y-2 p-3 rounded-xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={trainConfig.use_pinn}
                onChange={(e) => setTrainConfig((p) => ({ ...p, use_pinn: e.target.checked }))}
                className="accent-[#8b5cf6] w-4 h-4"
              />
              <span className="text-[12px] font-bold text-white/80">Use PINN Loss</span>
            </label>
            {trainConfig.use_pinn && (
              <div className="space-y-1.5 pl-6 pt-1">
                <div className="flex justify-between">
                  <label className="text-[10px] font-semibold text-white/50">Physics Weight</label>
                  <span className="text-[10px] font-mono text-[#8b5cf6]">{trainConfig.physics_weight.toFixed(2)}</span>
                </div>
                <input
                  type="range" min={0.01} max={1.0} step={0.01}
                  value={trainConfig.physics_weight}
                  onChange={(e) => setTrainConfig((p) => ({ ...p, physics_weight: Number(e.target.value) }))}
                  className="w-full accent-[#8b5cf6]"
                />
                <p className="text-[9px] text-white/30 leading-relaxed">
                  Applies physics constraints (Mass, Energy, Torque) alongside MSE loss. Requires correct column names.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-[12px] text-white/50 border border-white/10 hover:text-white/80 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={
              datasetCols.length === 0 ||
              (trainConfig.task === "classification" && !trainConfig.target) ||
              (trainConfig.task === "regression" && trainConfig.target_cols.length === 0)
            }
            className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: "#16a34a", boxShadow: "0 0 12px rgba(34,197,94,0.3)" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
