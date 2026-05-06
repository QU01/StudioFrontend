"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Layers, Grid3x3, Zap, Activity, CloudRain, AlignCenter, Minus, Sigma, Plus, GitMerge,
  Type, Radio, RefreshCcw, RotateCcw, GitFork, Layers3, ChevronLast, Rows,
} from "lucide-react";
import { LAYER_META, type LayerKind } from "./layerTypes";
import type { ShapeInfo } from "./shapeEngine";
import { formatShape } from "./shapeEngine";

const ICON_MAP: Record<string, React.ElementType> = {
  Layers, Grid3x3, Zap, Activity, CloudRain, AlignCenter, Minus, Sigma, Plus, GitMerge,
  Type, Radio, RefreshCcw, RotateCcw, GitFork, Layers3, ChevronLast, Rows,
};

export interface NeuralNodeData extends Record<string, unknown> {
  kind:       LayerKind;
  params:     Record<string, unknown>;
  shapeInfo?: ShapeInfo;
}

// ─── Param summary line ──────────────────────────────────────────────────────
function ParamSummary({ kind, params }: { kind: LayerKind; params: Record<string, unknown> }) {
  switch (kind) {
    case "Linear":
      return <span>{String(params.in_features)} → {String(params.out_features)}</span>;
    case "Conv2d":
      return <span>{String(params.in_channels)}ch → {String(params.out_channels)}ch, k={String(params.kernel_size)}, s={String(params.stride)}</span>;
    case "MaxPool2d":
      return <span>k={String(params.kernel_size)}, s={String(params.stride)}</span>;
    case "Dropout":
      return <span>p = {Number(params.p).toFixed(2)}</span>;
    case "BatchNorm":
      return <span>features: {String(params.num_features)}</span>;
    case "Flatten":
      return <span>from dim {String(params.start_dim)}</span>;
    case "Softmax":
      return <span>dim = {String(params.dim)}</span>;
    case "Add":
      return <span>a + b (element-wise)</span>;
    case "Concat":
      return <span>cat(dim={String(params.dim)})</span>;
    case "ReLU":
    case "GELU":
      return <span>{kind}()</span>;
    case "Embedding":
      return <span>vocab {String(params.vocab_size)} → dim {String(params.embedding_dim)}</span>;
    case "PositionalEncoding":
      return <span>d_model = {String(params.d_model)}</span>;
    case "LSTM":
    case "GRU":
    case "RNN":
      return <span>{String(params.input_size)} → {String(params.hidden_size)}{params.bidirectional ? " (bi)" : ""} × {String(params.num_layers)}</span>;
    case "MultiheadAttention":
      return <span>dim {String(params.embed_dim)} · {String(params.num_heads)} heads</span>;
    case "TransformerEncoderLayer":
      return <span>d {String(params.d_model)} · {String(params.nhead)}h × {String(params.num_layers)}L</span>;
    case "LayerNorm":
      return <span>shape: {String(params.normalized_shape)}</span>;
    case "LastTimestep":
      return <span>x[:, -1, :]</span>;
    case "MeanPool":
      return <span>mean over T</span>;
    default:
      return null;
  }
}

// ─── Border / glow style ─────────────────────────────────────────────────────
function nodeStyle(color: string, selected: boolean, hasError: boolean) {
  if (hasError)  return { border: `1.5px solid #ef444488`, boxShadow: "0 0 12px #ef444433" };
  if (selected)  return { border: `1.5px solid ${color}`, boxShadow: `0 0 18px ${color}55` };
  return { border: "1.5px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" };
}

// ─── Inner component ─────────────────────────────────────────────────────────
function NeuralNodeInner({ data, selected }: NodeProps) {
  const { kind, params, shapeInfo } = data as NeuralNodeData;
  const meta    = LAYER_META[kind];
  const Icon    = ICON_MAP[meta.iconName] ?? Layers;
  const hasError = !!shapeInfo?.error;

  const inShape  = formatShape(shapeInfo?.inputShape);
  const outShape = formatShape(shapeInfo?.outputShape ?? shapeInfo?.inputShape);

  return (
    <div
      style={{
        ...nodeStyle(meta.color, !!selected, hasError),
        borderRadius: 10,
        background: "#222a35",
        minWidth: 210,
        maxWidth: 240,
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: meta.color, border: "2px solid #181d23", width: 10, height: 10 }}
      />

      {/* ─── Header ─── */}
      <div
        style={{
          background: `linear-gradient(to right, ${meta.color}22, transparent)`,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "8px 8px 0 0",
          borderLeft: `3px solid ${meta.color}`,
          padding: "7px 10px",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <Icon size={14} style={{ color: meta.color, flexShrink: 0 }} />
        <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, flex: 1 }}>{meta.label}</span>
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: meta.color, opacity: 0.8,
        }}>
          {meta.category}
        </span>
      </div>

      {/* ─── Body ─── */}
      <div style={{ padding: "8px 12px 4px" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
          <ParamSummary kind={kind} params={params} />
        </div>
      </div>

      {/* ─── Shape strip ─── */}
      <div style={{
        margin: "0 10px 8px",
        borderRadius: 6,
        background: hasError ? "rgba(239,68,68,0.08)" : `${meta.color}10`,
        border: `1px solid ${hasError ? "rgba(239,68,68,0.2)" : `${meta.color}22`}`,
        padding: "4px 8px",
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        color: hasError ? "#f87171" : "rgba(255,255,255,0.55)",
        fontFamily: "monospace",
      }}>
        {hasError ? (
          <span style={{ color: "#f87171" }}>⚠ {shapeInfo?.error}</span>
        ) : (
          <>
            <span style={{ color: meta.color, opacity: 0.8 }}>{inShape}</span>
            <span style={{ opacity: 0.4 }}>→</span>
            <span style={{ color: meta.color }}>{outShape}</span>
          </>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: meta.color, border: "2px solid #181d23", width: 10, height: 10 }}
      />
    </div>
  );
}

export const NeuralNode = memo(NeuralNodeInner);
