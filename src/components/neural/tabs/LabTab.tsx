"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Dna } from "lucide-react";
import { NetworkDiagram } from "../lab/NetworkDiagram";
import { NeuronDetailPanel } from "../lab/NeuronDetailPanel";
import { PredictionPlayground } from "../lab/PredictionPlayground";
import {
  fetchNNNeuronStats,
  fetchNNNeuronDetail,
  type NNPerNeuronStatsResult,
  type NNNeuronDetail,
  type NNPredictResult,
} from "@/lib/api";

interface LabTabProps {
  hasModel: boolean;
}

export function LabTab({ hasModel }: LabTabProps) {
  const [neuronStats, setNeuronStats] = useState<NNPerNeuronStatsResult | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [selectedNeuron, setSelectedNeuron] = useState<{ layer_idx: number; neuron_idx: number } | null>(null);
  const [neuronDetail, setNeuronDetail] = useState<NNNeuronDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [lastPrediction, setLastPrediction] = useState<NNPredictResult | null>(null);
  const [currentFeatures, setCurrentFeatures] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!hasModel) return;
    setLoadingStats(true);
    fetchNNNeuronStats()
      .then(setNeuronStats)
      .catch(() => toast.error("Failed to load network structure"))
      .finally(() => setLoadingStats(false));
  }, [hasModel]);

  const handleNeuronClick = useCallback(async (layerIdx: number, neuronIdx: number) => {
    setSelectedNeuron({ layer_idx: layerIdx, neuron_idx: neuronIdx });
    setLoadingDetail(true);
    setNeuronDetail(null);
    try {
      const sampleFeatures = Object.keys(currentFeatures).length > 0 ? currentFeatures : undefined;
      const detail = await fetchNNNeuronDetail(layerIdx, neuronIdx, sampleFeatures);
      setNeuronDetail(detail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load neuron");
    } finally {
      setLoadingDetail(false);
    }
  }, [currentFeatures]);

  const handlePrediction = useCallback((pred: NNPredictResult) => {
    setLastPrediction(pred);
    if (selectedNeuron) {
      fetchNNNeuronDetail(selectedNeuron.layer_idx, selectedNeuron.neuron_idx, currentFeatures)
        .then(setNeuronDetail)
        .catch(() => { /* non-critical */ });
    }
  }, [selectedNeuron, currentFeatures]);

  if (!hasModel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(34,197,94,0.07)",
              border: "1px solid rgba(34,197,94,0.15)",
              boxShadow: "0 0 24px rgba(34,197,94,0.07)",
            }}
          >
            <Dna size={28} style={{ color: "rgba(34,197,94,0.4)" }} />
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
    <div className="flex h-full gap-0">
      {/* ── Left: Prediction Playground ── */}
      <div
        className="shrink-0 overflow-hidden"
        style={{
          width: 300,
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <PredictionPlayground
          onPrediction={handlePrediction}
          currentFeatures={currentFeatures}
          onFeaturesChange={setCurrentFeatures}
        />
      </div>

      {/* ── Center: Network Diagram ── */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {/* Section header */}
        <div
          className="px-5 py-2.5 shrink-0 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }}
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Network Diagram
            </span>
          </div>
          <span className="text-[9px] text-white/20">
            Click a neuron to inspect · Run inference to animate
          </span>
        </div>

        <div
          className="flex-1 min-h-0 overflow-auto"
          style={{ background: "radial-gradient(ellipse at center, #0f1722 0%, #0b1018 100%)" }}
        >
          {loadingStats && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "rgba(34,197,94,0.3)", borderTopColor: "#22c55e" }}
              />
              <p className="text-white/30 text-xs">Loading network structure…</p>
            </div>
          )}
          {!loadingStats && neuronStats && (
            <NetworkDiagram
              layers={neuronStats.layers}
              activations={lastPrediction?.layer_activations}
              selectedNeuron={selectedNeuron ?? undefined}
              onNeuronClick={handleNeuronClick}
            />
          )}
          {!loadingStats && !neuronStats && (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/25 text-sm">Network diagram unavailable</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Neuron Inspector ── */}
      <div
        className="shrink-0 overflow-hidden flex flex-col"
        style={{
          width: 284,
          borderLeft: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="px-4 py-2.5 shrink-0 flex items-center gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: selectedNeuron ? "#3b82f6" : "rgba(255,255,255,0.15)",
              boxShadow: selectedNeuron ? "0 0 6px #3b82f6" : "none",
              transition: "all 0.3s ease",
            }}
          />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            Neuron Inspector
          </span>
          {selectedNeuron && (
            <span
              className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd" }}
            >
              L{selectedNeuron.layer_idx} · N{selectedNeuron.neuron_idx}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <NeuronDetailPanel detail={neuronDetail} loading={loadingDetail} />
        </div>
      </div>
    </div>
  );
}
