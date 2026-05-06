"use client";

import { useState, useCallback } from "react";
import { Scissors, Zap, HardDrive, Settings2, type LucideIcon } from "lucide-react";
import { PruningPanel } from "../optimize/PruningPanel";
import { QuantizePanel } from "../optimize/QuantizePanel";
import { CheckpointList } from "../optimize/CheckpointList";

type OptimizeSection = "prune" | "quantize" | "checkpoints";

interface OptimizeTabProps {
  hasModel: boolean;
  onCheckpointLoaded?: () => void;
}

const SECTION_META: Record<OptimizeSection, { label: string; Icon: LucideIcon; color: string; desc: string }> = {
  prune:       { label: "Prune",       Icon: Scissors, color: "#3b82f6", desc: "Remove low-magnitude weights" },
  quantize:    { label: "Quantize",    Icon: Zap,      color: "#8b5cf6", desc: "Reduce numeric precision" },
  checkpoints: { label: "Snapshots",   Icon: HardDrive,color: "#22c55e", desc: "Save & restore model state" },
};

export function OptimizeTab({ hasModel, onCheckpointLoaded }: OptimizeTabProps) {
  const [section, setSection] = useState<OptimizeSection>("checkpoints");
  const [modelVersion, setModelVersion] = useState(0);

  const handleModelChanged = useCallback(() => {
    setModelVersion((v) => v + 1);
  }, []);

  if (!hasModel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(139,92,246,0.07)",
              border: "1px solid rgba(139,92,246,0.15)",
              boxShadow: "0 0 24px rgba(139,92,246,0.07)",
            }}
          >
            <Settings2 size={28} style={{ color: "rgba(139,92,246,0.4)" }} />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-white/40 text-[13px] font-medium">No trained model</p>
            <p className="text-white/20 text-[11px]">Train a model in the Design tab first</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      {/* ── Side nav ── */}
      <div
        className="shrink-0 flex flex-col gap-1.5 p-2.5"
        style={{
          width: 132,
          borderRight: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(0,0,0,0.15)",
        }}
      >
        {(Object.entries(SECTION_META) as [OptimizeSection, typeof SECTION_META[OptimizeSection]][]).map(([key, m]) => {
          const active = section === key;
          return (
            <button
              key={key}
              onClick={() => setSection(key)}
              className="w-full py-3.5 px-2 rounded-xl text-center transition-all relative overflow-hidden"
              style={{
                background: active ? `${m.color}12` : "transparent",
                border: `1px solid ${active ? m.color + "30" : "transparent"}`,
                boxShadow: active ? `0 0 14px ${m.color}12` : "none",
              }}
            >
              {active && (
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `radial-gradient(ellipse at top, ${m.color}20 0%, transparent 70%)`,
                  }}
                />
              )}
              <div className="relative flex flex-col items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: active ? `${m.color}18` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? m.color + "30" : "rgba(255,255,255,0.07)"}`,
                  }}
                >
                  <m.Icon size={15} style={{ color: active ? m.color : "rgba(255,255,255,0.3)" }} />
                </div>
                <div
                  className="text-[9.5px] font-bold uppercase tracking-wider"
                  style={{ color: active ? m.color : "rgba(255,255,255,0.3)" }}
                >
                  {m.label}
                </div>
                {active && (
                  <div
                    className="text-[8px] leading-tight"
                    style={{ color: m.color + "70" }}
                  >
                    {m.desc}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
        {section === "prune" && (
          <PruningPanel key={`prune-${modelVersion}`} onModelChanged={handleModelChanged} />
        )}
        {section === "quantize" && (
          <QuantizePanel key={`quant-${modelVersion}`} onModelChanged={handleModelChanged} />
        )}
        {section === "checkpoints" && (
          <CheckpointList onLoaded={handleModelChanged} onCheckpointLoaded={onCheckpointLoaded} />
        )}
      </div>
    </div>
  );
}
