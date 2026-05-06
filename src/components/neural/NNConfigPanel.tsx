"use client";

import { Settings2 } from "lucide-react";
import type { Node } from "@xyflow/react";
import { LAYER_META, type LayerKind } from "./layerTypes";
import type { NeuralNodeData } from "./NeuralNode";
import { formatShape } from "./shapeEngine";

interface NNConfigPanelProps {
  node: Node<NeuralNodeData> | null;
  onParamsChange: (nodeId: string, params: Record<string, unknown>) => void;
}

const inputClass =
  "w-full bg-[#1a2030] border border-white/10 rounded-md px-2.5 py-1.5 text-[13px] text-white/80 focus:outline-none focus:border-[#3b82f6] transition-colors";
const labelClass = "text-[11px] text-white/40 uppercase tracking-wider font-bold";

function LabeledRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  min,
  onChange,
  step = 1,
}: {
  value: number;
  min?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      className={inputClass}
      value={value}
      min={min}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function LayerConfig({
  kind,
  params,
  onChange,
}: {
  kind: LayerKind;
  params: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...params, [key]: value });

  switch (kind) {
    case "Linear":
      return (
        <div className="space-y-3">
          <LabeledRow label="in_features">
            <NumberInput value={Number(params.in_features)} min={1} onChange={(v) => set("in_features", v)} />
          </LabeledRow>
          <LabeledRow label="out_features">
            <NumberInput value={Number(params.out_features)} min={1} onChange={(v) => set("out_features", v)} />
          </LabeledRow>
          <LabeledRow label="bias">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.bias as boolean}
                onChange={(e) => set("bias", e.target.checked)}
                style={{ accentColor: "#3b82f6" }}
              />
              <span className="text-[13px] text-white/70">Enable bias</span>
            </label>
          </LabeledRow>
        </div>
      );

    case "Conv2d":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <LabeledRow label="in_channels">
              <NumberInput value={Number(params.in_channels)} min={1} onChange={(v) => set("in_channels", v)} />
            </LabeledRow>
            <LabeledRow label="out_channels">
              <NumberInput value={Number(params.out_channels)} min={1} onChange={(v) => set("out_channels", v)} />
            </LabeledRow>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <LabeledRow label="kernel">
              <NumberInput value={Number(params.kernel_size)} min={1} onChange={(v) => set("kernel_size", v)} />
            </LabeledRow>
            <LabeledRow label="stride">
              <NumberInput value={Number(params.stride)} min={1} onChange={(v) => set("stride", v)} />
            </LabeledRow>
            <LabeledRow label="padding">
              <NumberInput value={Number(params.padding)} min={0} onChange={(v) => set("padding", v)} />
            </LabeledRow>
          </div>
        </div>
      );

    case "MaxPool2d":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <LabeledRow label="kernel">
              <NumberInput value={Number(params.kernel_size)} min={1} onChange={(v) => set("kernel_size", v)} />
            </LabeledRow>
            <LabeledRow label="stride">
              <NumberInput value={Number(params.stride)} min={1} onChange={(v) => set("stride", v)} />
            </LabeledRow>
            <LabeledRow label="padding">
              <NumberInput value={Number(params.padding)} min={0} onChange={(v) => set("padding", v)} />
            </LabeledRow>
          </div>
        </div>
      );

    case "Dropout": {
      const p = Number(params.p ?? 0.5);
      return (
        <LabeledRow label={`probability: ${p.toFixed(2)}`}>
          <input
            type="range" min={0} max={0.99} step={0.01} value={p}
            onChange={(e) => set("p", parseFloat(e.target.value))}
            className="w-full accent-[#f59e0b]"
          />
          <div className="flex justify-between text-[9px] text-white/25">
            <span>0.00</span><span>0.99</span>
          </div>
        </LabeledRow>
      );
    }

    case "BatchNorm":
      return (
        <div className="space-y-3">
          <LabeledRow label="num_features">
            <NumberInput value={Number(params.num_features)} min={1} onChange={(v) => set("num_features", v)} />
          </LabeledRow>
          <LabeledRow label="momentum">
            <NumberInput value={Number(params.momentum)} min={0.001} step={0.01} onChange={(v) => set("momentum", v)} />
          </LabeledRow>
        </div>
      );

    case "Flatten":
      return (
        <LabeledRow label="start_dim">
          <NumberInput value={Number(params.start_dim)} min={0} onChange={(v) => set("start_dim", v)} />
        </LabeledRow>
      );

    case "Softmax":
      return (
        <LabeledRow label="dim">
          <NumberInput value={Number(params.dim)} min={0} onChange={(v) => set("dim", v)} />
        </LabeledRow>
      );

    case "GELU":
      return (
        <LabeledRow label="approximate">
          <select
            className={inputClass}
            value={String(params.approximate ?? "none")}
            onChange={(e) => set("approximate", e.target.value)}
          >
            <option value="none">none</option>
            <option value="tanh">tanh</option>
          </select>
        </LabeledRow>
      );

    case "ReLU":
      return (
        <LabeledRow label="inplace">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={params.inplace as boolean}
              onChange={(e) => set("inplace", e.target.checked)}
              style={{ accentColor: "#22c55e" }}
            />
            <span className="text-[13px] text-white/70">Inplace operation</span>
          </label>
        </LabeledRow>
      );

    case "Add":
      return <p className="text-[12px] text-white/30 italic">Element-wise sum of all inputs.<br/>All input tensors must have the same shape.</p>;

    case "Concat":
      return (
        <LabeledRow label="dim">
          <NumberInput value={Number(params.dim ?? 1)} min={0} onChange={(v) => set("dim", v)} />
        </LabeledRow>
      );

    case "Embedding":
      return (
        <div className="space-y-3">
          <LabeledRow label="vocab_size">
            <NumberInput value={Number(params.vocab_size ?? 10000)} min={2} onChange={(v) => set("vocab_size", v)} />
          </LabeledRow>
          <LabeledRow label="embedding_dim">
            <NumberInput value={Number(params.embedding_dim ?? 64)} min={1} onChange={(v) => set("embedding_dim", v)} />
          </LabeledRow>
          <LabeledRow label="padding_idx">
            <NumberInput value={Number(params.padding_idx ?? 0)} min={0} onChange={(v) => set("padding_idx", v)} />
          </LabeledRow>
        </div>
      );

    case "PositionalEncoding":
      return (
        <div className="space-y-3">
          <LabeledRow label="d_model">
            <NumberInput value={Number(params.d_model ?? 64)} min={1} onChange={(v) => set("d_model", v)} />
          </LabeledRow>
          <LabeledRow label="max_len">
            <NumberInput value={Number(params.max_len ?? 5000)} min={1} onChange={(v) => set("max_len", v)} />
          </LabeledRow>
        </div>
      );

    case "LSTM":
    case "GRU":
    case "RNN":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <LabeledRow label="input_size">
              <NumberInput value={Number(params.input_size ?? 64)} min={1} onChange={(v) => set("input_size", v)} />
            </LabeledRow>
            <LabeledRow label="hidden_size">
              <NumberInput value={Number(params.hidden_size ?? 128)} min={1} onChange={(v) => set("hidden_size", v)} />
            </LabeledRow>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LabeledRow label="num_layers">
              <NumberInput value={Number(params.num_layers ?? 1)} min={1} onChange={(v) => set("num_layers", v)} />
            </LabeledRow>
            <LabeledRow label="dropout">
              <NumberInput value={Number(params.dropout ?? 0)} min={0} step={0.05} onChange={(v) => set("dropout", v)} />
            </LabeledRow>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!params.bidirectional}
              onChange={(e) => set("bidirectional", e.target.checked)}
              style={{ accentColor: "#ec4899" }}
            />
            <span className="text-[13px] text-white/70">Bidirectional</span>
          </label>
          {kind === "RNN" && (
            <LabeledRow label="nonlinearity">
              <select
                className={inputClass}
                value={String(params.nonlinearity ?? "tanh")}
                onChange={(e) => set("nonlinearity", e.target.value)}
              >
                <option value="tanh">tanh</option>
                <option value="relu">relu</option>
              </select>
            </LabeledRow>
          )}
        </div>
      );

    case "MultiheadAttention":
      return (
        <div className="space-y-3">
          <LabeledRow label="embed_dim">
            <NumberInput value={Number(params.embed_dim ?? 64)} min={1} onChange={(v) => set("embed_dim", v)} />
          </LabeledRow>
          <LabeledRow label="num_heads">
            <NumberInput value={Number(params.num_heads ?? 4)} min={1} onChange={(v) => set("num_heads", v)} />
          </LabeledRow>
          <LabeledRow label="dropout">
            <NumberInput value={Number(params.dropout ?? 0)} min={0} step={0.05} onChange={(v) => set("dropout", v)} />
          </LabeledRow>
          <p className="text-[11px] text-white/30 italic">embed_dim must be divisible by num_heads.</p>
        </div>
      );

    case "TransformerEncoderLayer":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <LabeledRow label="d_model">
              <NumberInput value={Number(params.d_model ?? 64)} min={1} onChange={(v) => set("d_model", v)} />
            </LabeledRow>
            <LabeledRow label="nhead">
              <NumberInput value={Number(params.nhead ?? 4)} min={1} onChange={(v) => set("nhead", v)} />
            </LabeledRow>
          </div>
          <LabeledRow label="dim_feedforward">
            <NumberInput value={Number(params.dim_feedforward ?? 256)} min={1} onChange={(v) => set("dim_feedforward", v)} />
          </LabeledRow>
          <div className="grid grid-cols-2 gap-2">
            <LabeledRow label="num_layers">
              <NumberInput value={Number(params.num_layers ?? 2)} min={1} onChange={(v) => set("num_layers", v)} />
            </LabeledRow>
            <LabeledRow label="dropout">
              <NumberInput value={Number(params.dropout ?? 0.1)} min={0} step={0.05} onChange={(v) => set("dropout", v)} />
            </LabeledRow>
          </div>
        </div>
      );

    case "LayerNorm":
      return (
        <div className="space-y-3">
          <LabeledRow label="normalized_shape">
            <NumberInput value={Number(params.normalized_shape ?? 64)} min={1} onChange={(v) => set("normalized_shape", v)} />
          </LabeledRow>
          <LabeledRow label="eps">
            <NumberInput value={Number(params.eps ?? 1e-5)} min={1e-12} step={1e-6} onChange={(v) => set("eps", v)} />
          </LabeledRow>
        </div>
      );

    case "LastTimestep":
      return <p className="text-[12px] text-white/30 italic">Collapses [B, T, D] → [B, D] by taking the last timestep.<br/>Use before a Linear classifier.</p>;

    case "MeanPool":
      return <p className="text-[12px] text-white/30 italic">Collapses [B, T, D] → [B, D] by averaging over the time dim.</p>;

    default:
      return <p className="text-[12px] text-white/30 italic">No configurable parameters.</p>;
  }
}

export function NNConfigPanel({ node, onParamsChange }: NNConfigPanelProps) {
  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm gap-3 p-6 text-center">
        <Settings2 size={32} className="opacity-30" />
        <span>Select a layer to configure it</span>
      </div>
    );
  }

  const { kind, params, shapeInfo } = node.data;
  const meta = LAYER_META[kind];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-white/10 shrink-0"
        style={{ borderLeft: `3px solid ${meta.color}` }}
      >
        <div className="text-[13px] font-semibold text-white/90">{meta.label}</div>
        <div className="text-[11px] mt-0.5" style={{ color: meta.color }}>{meta.category}</div>
      </div>

      {/* Shape info */}
      {shapeInfo && (
        <div className="mx-4 mt-3 shrink-0">
          <div
            className="rounded-lg px-3 py-2 font-mono text-[11px] space-y-1"
            style={{
              background: shapeInfo.error ? "rgba(239,68,68,0.08)" : `${meta.color}10`,
              border: `1px solid ${shapeInfo.error ? "rgba(239,68,68,0.2)" : `${meta.color}25`}`,
            }}
          >
            {shapeInfo.error ? (
              <div className="text-red-400">⚠ {shapeInfo.error}</div>
            ) : (
              <>
                <div className="text-white/40">Input: <span style={{ color: meta.color }} className="opacity-80">{formatShape(shapeInfo.inputShape)}</span></div>
                <div className="text-white/40">Output: <span style={{ color: meta.color }}>{formatShape(shapeInfo.outputShape)}</span></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      <div className="px-4 pt-2 pb-1 shrink-0">
        <p className="text-[11px] text-white/25 italic">{meta.description}</p>
      </div>

      {/* Config */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="p-4">
          <LayerConfig
            kind={kind}
            params={params}
            onChange={(p) => onParamsChange(node.id, p)}
          />
        </div>
      </div>
    </div>
  );
}
