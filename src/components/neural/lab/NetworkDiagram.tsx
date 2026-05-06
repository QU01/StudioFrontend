"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { NNLayerNeuronStats, NNLayerActivation } from "@/lib/api";

interface SelectedNeuron {
  layer_idx: number;
  neuron_idx: number;
}

interface NetworkDiagramProps {
  layers: NNLayerNeuronStats[];
  activations?: NNLayerActivation[];        // from last prediction
  selectedNeuron?: SelectedNeuron | null;
  onNeuronClick?: (layerIdx: number, neuronIdx: number) => void;
}

// ── Layout constants ────────────────────────────────────────────────────────
const MAX_NEURONS = 20;
const R = 13;
const MIN_COL_W = 150;
const V_GAP = 38;
const PAD_TOP = 64;
const PAD_BOT = 36;
const PAD_X = 40;
const MAX_CONNS_PER_PAIR = 60;

// ── Color helpers ───────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

/** Cool blue (idle) → cyan (active) → near-white (very active) */
function activationColor(intensity: number): { core: string; rim: string } {
  const t = clamp01(intensity);
  if (t < 0.5) {
    const k = t * 2;
    const r = Math.round(lerp(40, 14, k));
    const g = Math.round(lerp(70, 165, k));
    const b = Math.round(lerp(150, 233, k));
    return { core: `rgb(${r},${g},${b})`, rim: `rgba(${r},${g},${b},0.8)` };
  } else {
    const k = (t - 0.5) * 2;
    const r = Math.round(lerp(14, 190, k));
    const g = Math.round(lerp(165, 250, k));
    const b = Math.round(lerp(233, 255, k));
    return { core: `rgb(${r},${g},${b})`, rim: `rgba(${r},${g},${b},0.9)` };
  }
}

interface NeuronLayout {
  idx: number;
  cy: number;
  absSum: number;
  dead: boolean;
}

interface LayerLayout {
  layerIdx: number;
  name: string;
  type: string;
  totalCount: number;
  colX: number;
  colTop: number;
  colBottom: number;
  neurons: NeuronLayout[];
  collapsed: number;
}

// ── Map layer kind → short label + accent color ─────────────────────────────
const LAYER_ACCENT: Record<string, string> = {
  Linear: "#3b82f6",
  Conv2d: "#22c55e",
  BatchNorm1d: "#f59e0b",
  BatchNorm2d: "#f59e0b",
};

function layerAccent(type: string) {
  return LAYER_ACCENT[type] ?? "#64748b";
}

export function NetworkDiagram({
  layers,
  activations,
  selectedNeuron,
  onNeuronClick,
}: NetworkDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);
  const [containerH, setContainerH] = useState(500);
  const [hoveredNeuron, setHoveredNeuron] = useState<SelectedNeuron | null>(null);
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setContainerW(r.width);
      setContainerH(r.height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const weightLayers = useMemo(
    () => layers.filter((l) => l.neurons.length > 0),
    [layers]
  );

  const activationMap = useMemo(() => {
    const m = new Map<number, NNLayerActivation>();
    for (const act of activations ?? []) {
      m.set(act.layer_idx, act);
    }
    return m;
  }, [activations]);

  // Layout
  const layout = useMemo<LayerLayout[]>(() => {
    if (weightLayers.length === 0) return [];

    const availW = containerW - PAD_X * 2;
    const colSpacing = Math.max(MIN_COL_W, availW / Math.max(weightLayers.length, 1));
    const totalW = colSpacing * weightLayers.length;
    const startX = (containerW - totalW) / 2 + colSpacing / 2;

    return weightLayers.map((layer, colIdx) => {
      const colX = startX + colIdx * colSpacing;
      const displayNeurons = layer.neurons.slice(0, MAX_NEURONS);
      const collapsed = Math.max(0, layer.neurons.length - MAX_NEURONS);
      const totalH = displayNeurons.length * V_GAP;
      const startY = PAD_TOP + (containerH - PAD_TOP - PAD_BOT - totalH) / 2;

      return {
        layerIdx: layer.layer_idx,
        name: layer.name,
        type: layer.type,
        totalCount: layer.neurons.length,
        colX,
        colTop: PAD_TOP - 8,
        colBottom: containerH - PAD_BOT + 4,
        neurons: displayNeurons.map((n, i) => ({
          idx: n.idx,
          cy: startY + i * V_GAP + V_GAP / 2,
          absSum: n.abs_sum,
          dead: n.dead,
        })),
        collapsed,
      };
    });
  }, [weightLayers, containerW, containerH]);

  const svgH = Math.max(containerH, 380);
  const svgW = containerW;

  // Max abs sum (for dim baseline coloring)
  const maxAbsSum = useMemo(() => {
    let max = 1;
    for (const l of layout) {
      for (const n of l.neurons) {
        if (n.absSum > max) max = n.absSum;
      }
    }
    return max;
  }, [layout]);

  // Per-layer max activation magnitude for normalization
  const layerMaxAct = useMemo(() => {
    const m = new Map<number, number>();
    for (const [k, act] of activationMap.entries()) {
      m.set(k, Math.max(...act.values.map(Math.abs), 0.0001));
    }
    return m;
  }, [activationMap]);

  // Returns 0–1 activation intensity for a neuron, or null if no activation data
  const neuronActivation = useCallback(
    (layerIdx: number, neuronIdx: number): number | null => {
      const act = activationMap.get(layerIdx);
      if (!act || neuronIdx >= act.values.length) return null;
      const max = layerMaxAct.get(layerIdx) ?? 1;
      return Math.abs(act.values[neuronIdx]) / max;
    },
    [activationMap, layerMaxAct]
  );

  const isSelected = useCallback(
    (layerIdx: number, neuronIdx: number) =>
      selectedNeuron?.layer_idx === layerIdx && selectedNeuron?.neuron_idx === neuronIdx,
    [selectedNeuron]
  );

  const isHovered = useCallback(
    (layerIdx: number, neuronIdx: number) =>
      hoveredNeuron?.layer_idx === layerIdx && hoveredNeuron?.neuron_idx === neuronIdx,
    [hoveredNeuron]
  );

  // Empty state
  if (weightLayers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/30 text-sm">No weight layers found in the model</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-auto relative">
      {/* Background radial gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(59,130,246,0.06) 0%, rgba(0,0,0,0) 60%)",
        }}
      />

      <svg
        width={svgW}
        height={svgH}
        style={{ display: "block", position: "relative" }}
      >
        <defs>
          {/* Soft glow filter for active neurons */}
          <filter id="neuronGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Stronger glow for selected */}
          <filter id="selectGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Radial gradient for neurons (idle state) */}
          <radialGradient id="neuronIdle" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(96,165,250,0.7)" />
            <stop offset="60%" stopColor="rgba(59,130,246,0.5)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.85)" />
          </radialGradient>

          {/* Subtle column shelf gradient */}
          <linearGradient id="colShelf" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.015)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
          </linearGradient>

          {/* Pulse animation keyframes via stylesheet */}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.85; }
              50% { opacity: 1; }
            }
            @keyframes flow {
              from { stroke-dashoffset: 28; }
              to   { stroke-dashoffset: 0; }
            }
            .conn-active {
              stroke-dasharray: 4 6;
              animation: flow 1.4s linear infinite;
            }
            .neuron-active {
              animation: pulse 2.4s ease-in-out infinite;
            }
          `}</style>
        </defs>

        {/* ── Layer column shelves (background panels) ─────────────────── */}
        {layout.map((layer) => {
          const colW = MIN_COL_W * 0.7;
          const isLayerHovered = hoveredLayer === layer.layerIdx;
          return (
            <g key={`shelf-${layer.layerIdx}`}>
              <rect
                x={layer.colX - colW / 2}
                y={layer.colTop + 26}
                width={colW}
                height={layer.colBottom - layer.colTop - 30}
                rx={14}
                fill="url(#colShelf)"
                stroke={isLayerHovered ? layerAccent(layer.type) + "55" : "rgba(255,255,255,0.05)"}
                strokeWidth={1}
                style={{ transition: "stroke 0.2s" }}
              />
            </g>
          );
        })}

        {/* ── Layer headers (top labels) ───────────────────────────────── */}
        {layout.map((layer) => {
          const accent = layerAccent(layer.type);
          return (
            <g
              key={`header-${layer.layerIdx}`}
              onMouseEnter={() => setHoveredLayer(layer.layerIdx)}
              onMouseLeave={() => setHoveredLayer(null)}
              style={{ cursor: "default" }}
            >
              {/* Type chip */}
              <rect
                x={layer.colX - 36}
                y={18}
                width={72}
                height={18}
                rx={9}
                fill={accent + "1f"}
                stroke={accent + "55"}
                strokeWidth={1}
              />
              <text
                x={layer.colX}
                y={31}
                textAnchor="middle"
                fill={accent}
                fontSize={9}
                fontWeight={700}
                style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
              >
                {layer.type}
              </text>
              {/* Neuron count below chip */}
              <text
                x={layer.colX}
                y={50}
                textAnchor="middle"
                fill="rgba(255,255,255,0.35)"
                fontSize={10}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {layer.totalCount} units
              </text>
            </g>
          );
        })}

        {/* ── Connections (curved bezier paths) ────────────────────────── */}
        {layout.slice(0, -1).map((srcLayer, li) => {
          const dstLayer = layout[li + 1];
          const srcAct = activationMap.get(srcLayer.layerIdx);
          const hasAct = srcAct != null;
          const srcMax = layerMaxAct.get(srcLayer.layerIdx) ?? 1;

          // Build all (src, dst) pairs and sort by combined influence
          const pairs: Array<{
            src: NeuronLayout;
            dst: NeuronLayout;
            score: number;
          }> = [];
          for (const sn of srcLayer.neurons) {
            for (const dn of dstLayer.neurons) {
              pairs.push({ src: sn, dst: dn, score: sn.absSum + dn.absSum });
            }
          }
          pairs.sort((a, b) => b.score - a.score);
          const top = pairs.slice(0, MAX_CONNS_PER_PAIR);

          return top.map(({ src, dst }, ci) => {
            const x1 = srcLayer.colX + R;
            const y1 = src.cy;
            const x2 = dstLayer.colX - R;
            const y2 = dst.cy;
            const cx1 = x1 + (x2 - x1) * 0.5;
            const cx2 = x2 - (x2 - x1) * 0.5;
            const path = `M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;

            // Activation magnitude on the source neuron drives connection brightness
            const actVal = hasAct
              ? Math.abs(srcAct!.values[src.idx] ?? 0) / srcMax
              : 0;

            // Highlight if either endpoint is selected or hovered
            const endpointActive =
              isSelected(srcLayer.layerIdx, src.idx) ||
              isSelected(dstLayer.layerIdx, dst.idx) ||
              isHovered(srcLayer.layerIdx, src.idx) ||
              isHovered(dstLayer.layerIdx, dst.idx);

            const baseAlpha = endpointActive
              ? 0.85
              : hasAct
              ? Math.min(0.08 + actVal * 0.55, 0.7)
              : 0.05 + Math.min((src.absSum + dst.absSum) / (maxAbsSum * 2), 1) * 0.1;

            const strokeColor = endpointActive
              ? "rgba(245,158,11,"
              : hasAct
              ? "rgba(34,211,238,"
              : "rgba(99,179,237,";

            return (
              <path
                key={`${li}-${ci}`}
                d={path}
                fill="none"
                stroke={strokeColor + baseAlpha + ")"}
                strokeWidth={endpointActive ? 1.6 : 0.8}
                className={hasAct && actVal > 0.3 && !endpointActive ? "conn-active" : ""}
                style={{ transition: "stroke 0.3s, stroke-width 0.2s" }}
              />
            );
          });
        })}

        {/* ── Neurons ──────────────────────────────────────────────────── */}
        {layout.map((layer) =>
          layer.neurons.map((neuron) => {
            const sel = isSelected(layer.layerIdx, neuron.idx);
            const hov = isHovered(layer.layerIdx, neuron.idx);
            const act = neuronActivation(layer.layerIdx, neuron.idx);
            const hasAct = act != null;

            // Determine fill
            let fill: string;
            let strokeColor: string;
            let glowFilter: string | undefined;
            let radius = R;

            if (neuron.dead) {
              fill = "rgba(60,55,30,0.6)";
              strokeColor = "rgba(234,179,8,0.4)";
            } else if (hasAct) {
              const c = activationColor(act!);
              fill = c.core;
              strokeColor = c.rim;
              if (act! > 0.5) glowFilter = "url(#neuronGlow)";
            } else {
              // Idle — radial gradient with brightness from weight magnitude
              const t = clamp01(neuron.absSum / maxAbsSum);
              fill = "url(#neuronIdle)";
              strokeColor = `rgba(96,165,250,${0.3 + t * 0.4})`;
            }

            if (sel) {
              radius = R + 3;
              glowFilter = "url(#selectGlow)";
              strokeColor = "#fbbf24";
            } else if (hov) {
              radius = R + 1.5;
              strokeColor = "#bae6fd";
            }

            return (
              <g
                key={`${layer.layerIdx}-${neuron.idx}`}
                style={{ cursor: "pointer" }}
                onClick={() => onNeuronClick?.(layer.layerIdx, neuron.idx)}
                onMouseEnter={() => setHoveredNeuron({ layer_idx: layer.layerIdx, neuron_idx: neuron.idx })}
                onMouseLeave={() => setHoveredNeuron(null)}
              >
                {/* Outer halo for selected */}
                {sel && (
                  <circle
                    cx={layer.colX}
                    cy={neuron.cy}
                    r={radius + 7}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    strokeOpacity={0.5}
                    className="neuron-active"
                  />
                )}

                {/* Hover halo */}
                {hov && !sel && (
                  <circle
                    cx={layer.colX}
                    cy={neuron.cy}
                    r={radius + 5}
                    fill="none"
                    stroke="rgba(186,230,253,0.4)"
                    strokeWidth={1}
                  />
                )}

                {/* Main neuron */}
                <circle
                  cx={layer.colX}
                  cy={neuron.cy}
                  r={radius}
                  fill={fill}
                  stroke={strokeColor}
                  strokeWidth={sel ? 2 : 1.2}
                  filter={glowFilter}
                  style={{
                    transition: "r 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.2s, fill 0.3s",
                  }}
                  className={hasAct && act! > 0.7 ? "neuron-active" : ""}
                />

                {/* Inner highlight dot for high activation */}
                {hasAct && act! > 0.6 && !neuron.dead && (
                  <circle
                    cx={layer.colX - radius * 0.3}
                    cy={neuron.cy - radius * 0.3}
                    r={radius * 0.25}
                    fill="rgba(255,255,255,0.6)"
                    pointerEvents="none"
                  />
                )}

                {/* Tooltip on hover */}
                {hov && (
                  <g pointerEvents="none">
                    <rect
                      x={layer.colX + radius + 8}
                      y={neuron.cy - 18}
                      width={120}
                      height={36}
                      rx={6}
                      fill="rgba(15,23,42,0.95)"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth={1}
                    />
                    <text
                      x={layer.colX + radius + 16}
                      y={neuron.cy - 4}
                      fill="rgba(255,255,255,0.9)"
                      fontSize={10}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      neuron {neuron.idx}
                    </text>
                    <text
                      x={layer.colX + radius + 16}
                      y={neuron.cy + 9}
                      fill="rgba(255,255,255,0.5)"
                      fontSize={9}
                    >
                      {hasAct ? `act ${act!.toFixed(2)}` : `|w| ${neuron.absSum.toFixed(2)}`}
                    </text>
                  </g>
                )}
              </g>
            );
          })
        )}

        {/* Collapsed badges */}
        {layout.map((layer) =>
          layer.collapsed > 0 ? (
            <g key={`collapsed-${layer.layerIdx}`}>
              <rect
                x={layer.colX - 28}
                y={PAD_TOP + layer.neurons.length * V_GAP + 8}
                width={56}
                height={18}
                rx={9}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1}
              />
              <text
                x={layer.colX}
                y={PAD_TOP + layer.neurons.length * V_GAP + 21}
                textAnchor="middle"
                fill="rgba(255,255,255,0.4)"
                fontSize={9}
                fontWeight={600}
              >
                + {layer.collapsed} more
              </text>
            </g>
          ) : null
        )}
      </svg>
    </div>
  );
}
