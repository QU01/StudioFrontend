"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Database, Filter, Columns2, Eraser, BarChart2, Scissors, Brain, LineChart, Eye, Trash2,
  Code2, RefreshCw, Play, Save, Group, Network, Hash, Binary, PlayCircle,
  Type, Book, AlignJustify, Download,
} from "lucide-react";
import { NODE_META, IO_PORT_COLORS, type NodeKind, type DatasetInfo, type IOContract } from "../nodeTypes";
import type { NodeResult } from "@/lib/api";
import { useNodeHalo } from "@/components/demo/NodeHalo";

const ICON_MAP: Record<string, React.ElementType> = {
  Database, Filter, Columns2, Eraser, BarChart2, Scissors, Brain, LineChart,
  Code2, RefreshCw, Play, Save, Group, Network, Hash, Binary,
  Type, Book, AlignJustify, Download,
};

export interface PipelineNodeData extends Record<string, unknown> {
  kind: NodeKind;
  params: Record<string, unknown>;
  datasetInfo?: DatasetInfo | null;
  status?: "idle" | "running" | "success" | "error";
  result?: NodeResult;
  agentAdded?: boolean;
  onPreview?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onRunFrom?: (nodeId: string) => void;
}

function StatusDot({ status }: { status?: PipelineNodeData["status"] }) {
  if (!status || status === "idle") return null;
  const styles: Record<string, string> = {
    running: "bg-[#007bff] animate-pulse",
    success: "bg-[#28a745]",
    error:   "bg-[#dc3545]",
  };
  return (
    <span
      className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border-2 border-[#181d23] ${styles[status]}`}
      style={status === "success" ? { boxShadow: "0 0 6px #28a74566" } : {}}
    />
  );
}

function ParamPreview({ kind, params, datasetInfo, status, result }: PipelineNodeData) {
  // After success, show result summary
  if (status === "success" && result) {
    if (kind === "trainModel" && result.metrics) {
      return (
        <div className="text-[11px] space-y-0.5">
          <div style={{ color: "#E83E8C" }} className="font-bold">
            Accuracy: {(result.metrics.accuracy! * 100).toFixed(1)}%
          </div>
          <div className="text-white/40">F1: {result.metrics.f1?.toFixed(3)}</div>
        </div>
      );
    }
    if (kind === "trainNeuralNetwork" && result.metrics) {
      if (result.metrics.task === "regression") {
        return (
          <div className="text-[11px] space-y-0.5">
            <div style={{ color: "#22c55e" }} className="font-bold">R²: {result.metrics.r2?.toFixed(4)}</div>
            <div className="text-white/40">RMSE: {result.metrics.rmse?.toFixed(4)} · Regression</div>
          </div>
        );
      }
      return (
        <div className="text-[11px] space-y-0.5">
          <div style={{ color: "#22c55e" }} className="font-bold">Acc: {(result.metrics.accuracy! * 100).toFixed(1)}%</div>
          <div className="text-white/40">Classification</div>
        </div>
      );
    }
    if (kind === "inverseDesign" && result.chart) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = result.chart as any;
      const errors = ch.per_target_errors as Record<string, { rel_error_pct: number }> | undefined;
      const firstErr = errors ? Object.values(errors)[0] : null;
      return (
        <div className="text-[11px] space-y-0.5">
          <div style={{ color: "#F39C12" }} className="font-bold">
            {firstErr ? `Error: ${firstErr.rel_error_pct.toFixed(2)}%` : "Done"}
          </div>
          <div className="text-white/40">Steps: {ch.n_steps_taken} · {ch.all_starts?.length ?? 1} start(s)</div>
        </div>
      );
    }
    if (kind === "trainTestSplit" && result.train_rows != null) {
      return (
        <div className="text-[11px] text-white/50">
          Train: {result.train_rows} · Test: {result.test_rows}
        </div>
      );
    }
    if (result.rows != null) {
      return (
        <div className="text-[11px] text-white/50">
          {result.rows.toLocaleString()} rows · {result.cols} cols
        </div>
      );
    }
  }

  if (status === "error" && result?.error) {
    return (
      <div className="text-[11px] text-red-400 truncate max-w-[160px]" title={result.error}>
        ⚠ {result.error}
      </div>
    );
  }

  // Default param preview
  switch (kind) {
    case "dataSource":
      if (!datasetInfo) {
        return <span className="text-yellow-400/70 text-[11px]">No dataset loaded</span>;
      }
      return (
        <div className="text-[11px] text-white/50 space-y-0.5">
          <div className="truncate max-w-[160px]">{datasetInfo.filename}</div>
          <div>{datasetInfo.rows.toLocaleString()} rows · {datasetInfo.col_count} cols</div>
        </div>
      );
    case "filterRows": {
      const { column, operator, value } = params as { column: string; operator: string; value: string };
      return <div className="text-[11px] text-white/50">{column || "col"} {operator} {value || "…"}</div>;
    }
    case "dropColumns": {
      const cols = (params.columns as string[]) ?? [];
      return <div className="text-[11px] text-white/50">{cols.length === 0 ? "No columns selected" : `${cols.length} column(s)`}</div>;
    }
    case "handleMissing":
      return <div className="text-[11px] text-white/50">Strategy: {String(params.strategy ?? "mean")}</div>;
    case "standardScaler": {
      const cols = (params.columns as string[]) ?? [];
      return <div className="text-[11px] text-white/50">{cols.length === 0 ? "Auto (all numeric)" : `${cols.length} column(s)`}</div>;
    }
    case "trainTestSplit":
      return <div className="text-[11px] text-white/50">Test ratio: {Number(params.ratio ?? 0.2) * 100}% · seed {String(params.seed ?? 42)}</div>;
    case "trainModel":
      return (
        <div className="text-[11px] text-white/50">
          <div>{String(params.algorithm ?? "logistic_regression").replace(/_/g, " ")}</div>
          <div>Target: {String(params.target || "not set")}</div>
        </div>
      );
    case "visualizeOutput":
      return (
        <div className="text-[11px] text-white/50">
          {String(params.chart_type ?? "scatter")} · x: {String(params.x_col || "?")} y: {String(params.y_col || "?")}
        </div>
      );
    case "tokenize":
      return (
        <div className="text-[11px] text-white/50">
          {String(params.text_column || "no column")} · {String(params.method ?? "whitespace")}
        </div>
      );
    case "buildVocab":
      return (
        <div className="text-[11px] text-white/50">
          Vocab: {Number(params.vocab_size ?? 10000)} · min freq {Number(params.min_freq ?? 2)}
        </div>
      );
    case "padSequences":
      return (
        <div className="text-[11px] text-white/50">
          Max len {Number(params.max_length ?? 128)} · pad {String(params.padding ?? "post")}
        </div>
      );
    case "loadEmbeddings":
      return (
        <div className="text-[11px] text-white/50 truncate max-w-[180px]" title={String(params.embedding_path ?? "")}>
          dim {Number(params.dim ?? 100)} · {String(params.embedding_path || "no file")}
        </div>
      );
    case "tfidfVectorizer":
      return (
        <div className="text-[11px] text-white/50">
          {Number(params.max_features ?? 1000)} feats · n-gram {Number(params.ngram_range_min ?? 1)}-{Number(params.ngram_range_max ?? 1)}
        </div>
      );
    default:
      return null;
  }
}

function borderStyle(meta: { color: string }, selected: boolean, status?: PipelineNodeData["status"]) {
  if (status === "success") return { border: "1.5px solid #28a74588", boxShadow: "0 0 12px #28a74533" };
  if (status === "error")   return { border: "1.5px solid #dc354588", boxShadow: "0 0 12px #dc354533" };
  if (status === "running") return { border: `1.5px solid ${meta.color}`, boxShadow: `0 0 16px ${meta.color}55` };
  if (selected)             return { border: `1.5px solid ${meta.color}`, boxShadow: `0 0 16px ${meta.color}55` };
  return { border: "1.5px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" };
}

function PipelineNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as PipelineNodeData;
  const { kind, params, datasetInfo, status, result, agentAdded, onPreview, onDelete, onRunFrom } = nodeData;
  const meta = NODE_META[kind];
  const Icon = ICON_MAP[meta.iconName] ?? Database;
  const isSource = kind === "dataSource";
  const isHalo = useNodeHalo(id);

  return (
    <div
      className={`${agentAdded ? "agent-pulse-node" : ""} ${isHalo ? "node-halo" : ""}`}
      style={{
        ...borderStyle(meta, !!selected, status),
        ...(isHalo ? { boxShadow: undefined } : {}),
        borderRadius: 10,
        background: "#222a35",
        minWidth: 200,
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes agentNodePulse {
          0%, 100% { box-shadow: 0 0 0 rgba(0,240,255,0); }
          40% { box-shadow: 0 0 22px rgba(0,240,255,0.45), 0 0 40px rgba(0,240,255,0.15); }
        }
        .agent-pulse-node {
          animation: agentNodePulse 1.2s ease-in-out 3;
        }
      `}</style>
      <StatusDot status={status} />

      {!isSource && (kind === "predictModel" || kind === "inverseDesign") ? (
        <div style={{ position: "absolute", top: -5, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16 }}>
          <Handle id="data"  type="target" position={Position.Top}
            style={{ background: "#4A90E2", border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
          <Handle id="model" type="target" position={Position.Top}
            style={{ background: "#E83E8C", border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
        </div>
      ) : kind === "padSequences" ? (
        <div style={{ position: "absolute", top: -5, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16 }}>
          <Handle id="data"  type="target" position={Position.Top}
            title="data: DataFrame with tokens column"
            style={{ background: "#4A90E2", border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
          <Handle id="vocab" type="target" position={Position.Top}
            title="vocab: from a Build Vocabulary node"
            style={{ background: IO_PORT_COLORS.Vocab, border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
        </div>
      ) : kind === "loadEmbeddings" ? (
        <div style={{ position: "absolute", top: -5, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16 }}>
          <Handle id="vocab" type="target" position={Position.Top}
            title="vocab: from a Build Vocabulary node"
            style={{ background: IO_PORT_COLORS.Vocab, border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
        </div>
      ) : kind === "customPython" && (params.io_contract as IOContract)?.inputs?.length ? (
        <div style={{ position: "absolute", top: -5, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12 }}>
          {(params.io_contract as IOContract).inputs.map((port) => (
            <Handle key={port.name} id={port.name} type="target" position={Position.Top}
              title={`${port.name}: ${port.type}`}
              style={{ background: IO_PORT_COLORS[port.type] ?? "#6c757d", border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
          ))}
        </div>
      ) : !isSource && (
        <Handle type="target" position={Position.Top}
          style={{ background: meta.color, border: "2px solid #181d23", width: 10, height: 10 }} />
      )}

      {/* Header */}
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
        <span style={{ color: "#fff", fontSize: 12, fontWeight: 600, flex: 1 }}>{meta.label}</span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: meta.color, opacity: 0.8 }}>
          {meta.category}
        </span>
        {onRunFrom && (
          <button
            onClick={(e) => { e.stopPropagation(); onRunFrom(id); }}
            title="Run from here"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 3px",
              display: "flex",
              alignItems: "center",
              color: "rgba(255,255,255,0.25)",
              borderRadius: 4,
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#007bff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,123,255,0.12)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <PlayCircle size={11} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(id); }}
            title="Delete node"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 3px",
              display: "flex",
              alignItems: "center",
              color: "rgba(255,255,255,0.25)",
              borderRadius: 4,
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#dc3545"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,53,69,0.12)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "8px 12px 10px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ParamPreview kind={kind} params={params} datasetInfo={datasetInfo} status={status} result={result} />
        </div>
        {status === "success" && result && onPreview && (
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(id); }}
            title="Preview data"
            style={{
              flexShrink: 0,
              background: `${NODE_META[kind].color}22`,
              border: `1px solid ${NODE_META[kind].color}55`,
              borderRadius: 6,
              padding: "3px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: NODE_META[kind].color,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            <Eye size={11} />
            View
          </button>
        )}
      </div>

      {kind === "trainTestSplit" ? (
        <div style={{ position: "absolute", bottom: -5, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16 }}>
          <Handle id="train" type="source" position={Position.Bottom}
            style={{ background: "#28a745", border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
          <Handle id="test"  type="source" position={Position.Bottom}
            style={{ background: "#F39C12", border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
        </div>
      ) : kind === "buildVocab" ? (
        <div style={{ position: "absolute", bottom: -5, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16 }}>
          <Handle id="data"  type="source" position={Position.Bottom}
            title="data: DataFrame passthrough"
            style={{ background: "#4A90E2", border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
          <Handle id="vocab" type="source" position={Position.Bottom}
            title="vocab: feed into Pad Sequences / Load Embeddings"
            style={{ background: IO_PORT_COLORS.Vocab, border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
        </div>
      ) : kind === "customPython" && (params.io_contract as IOContract)?.outputs?.length ? (
        <div style={{ position: "absolute", bottom: -5, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12 }}>
          {(params.io_contract as IOContract).outputs.map((port) => (
            <Handle key={port.name} id={port.name} type="source" position={Position.Bottom}
              title={`${port.name}: ${port.type}`}
              style={{ background: IO_PORT_COLORS[port.type] ?? "#6c757d", border: "2px solid #181d23", width: 10, height: 10, position: "relative", transform: "none", left: "unset" }} />
          ))}
        </div>
      ) : (
        <Handle type="source" position={Position.Bottom}
          style={{ background: meta.color, border: "2px solid #181d23", width: 10, height: 10 }} />
      )}
    </div>
  );
}

export const PipelineNode = memo(PipelineNodeInner);
