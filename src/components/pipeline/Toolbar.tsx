"use client";

import {
  Database, Filter, Columns2, Eraser, BarChart2, Scissors, Brain, LineChart, Group, Binary, Hash, Network,
  Trash2, Play, Save, Code2, RefreshCw, Square, Copy, FileText, Zap, Package,
} from "lucide-react";
import { NODE_KIND_ORDER, NODE_META, type NodeKind } from "./nodeTypes";

const ICON_MAP: Record<string, React.ElementType> = {
  Database, Filter, Columns2, Eraser, BarChart2, Scissors, Brain, LineChart, Group, Binary, Hash, Network,
  Code2, RefreshCw, Play, Save, FileText,
};

interface ToolbarProps {
  onAddNode: (kind: NodeKind) => void;
  onClear: () => void;
  onExecute: () => void;
  onStop?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onAutoML?: () => void;
  onPublishDesigner?: () => void;
  pipelineName?: string;
  isRunning: boolean;
}

export function Toolbar({ onAddNode, onClear, onExecute, onStop, onSave, onSaveAs, onAutoML, onPublishDesigner, pipelineName, isRunning }: ToolbarProps) {
  return (
    <div
      className="flex flex-col shrink-0"
      style={{ background: "var(--surface-0)", borderBottom: "1px solid var(--surface-3)" }}
    >
    {/* Title bar with current pipeline name */}
    <div
      className="flex items-center gap-2 px-4 py-1.5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      <FileText size={12} style={{ color: "var(--ink-dim)" }} />
      <span
        className="text-[10px] uppercase tracking-widest font-bold"
        style={{ fontFamily: "var(--quasar-font-mono)", color: "var(--ink-dim)" }}
      >Pipeline:</span>
      <span
        className="text-[12px] font-medium truncate"
        style={{ color: "var(--ink-primary)" }}
        title={pipelineName || "Untitled"}
      >
        {pipelineName || <span style={{ color: "var(--ink-dim)", fontStyle: "italic", fontWeight: 400 }}>Untitled (unsaved)</span>}
      </span>
    </div>
    <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
      {(() => {
        // Group kinds by category
        const groups: Record<string, NodeKind[]> = {};
        for (const kind of NODE_KIND_ORDER) {
          const cat = NODE_META[kind].category;
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(kind);
        }
        return Object.entries(groups).map(([category, kinds]) => (
          <div key={category} className="flex items-center gap-1 flex-wrap">
            <span
              className="text-[9px] uppercase tracking-widest font-bold px-1 select-none"
              style={{ fontFamily: "var(--quasar-font-mono)", color: "var(--ink-dim)" }}
            >
              {category}
            </span>
            {kinds.map((kind) => {
              const meta = NODE_META[kind];
              const Icon = ICON_MAP[meta.iconName] ?? Database;
              return (
                <button
                  key={kind}
                  onClick={() => onAddNode(kind)}
                  disabled={isRunning}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: `${meta.color}18`,
                    border: `1px solid ${meta.color}44`,
                    color: meta.color,
                  }}
                  title={`${meta.category}: ${meta.label}`}
                >
                  <Icon size={13} />
                  {meta.label}
                </button>
              );
            })}
            <span className="mx-1 select-none" style={{ color: "var(--surface-3)" }}>│</span>
          </div>
        ));
      })()}

      <div className="ml-auto flex items-center gap-2">
        {onAutoML && (
          <button
            onClick={onAutoML}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "rgba(226,62,192,0.10)", border: "1px solid rgba(226,62,192,0.35)", color: "var(--magenta)" }}
            title="Auto-find the best model"
          >
            <Zap size={13} />
            AutoML
          </button>
        )}

        {onPublishDesigner && (
          <button
            onClick={onPublishDesigner}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "rgba(58,160,255,0.10)", border: "1px solid rgba(58,160,255,0.35)", color: "var(--electric)" }}
            title="Publicar el pipeline vivo como un Diseñador"
          >
            <Package size={13} />
            Guardar como Diseñador
          </button>
        )}

        {isRunning && onStop ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold text-white transition-all hover:scale-105 active:scale-95"
            style={{ background: "var(--error)", boxShadow: "0 0 12px rgba(239,68,68,0.5)" }}
            title="Detener ejecución"
          >
            <Square size={13} />
            Stop
          </button>
        ) : (
          <button
            onClick={onExecute}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--electric)",
              boxShadow: "var(--glow-electric)",
              color: "#0A0E14",
            }}
          >
            <Play size={13} />
            Run Pipeline
          </button>
        )}

        {onSave && (
          <button
            onClick={onSave}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all disabled:opacity-40"
            style={{ color: "var(--ink-dim)", border: "1px solid var(--surface-3)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--electric)"; e.currentTarget.style.background = "rgba(58,160,255,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-dim)"; e.currentTarget.style.background = "transparent"; }}
            title={pipelineName ? `Update "${pipelineName}"` : "Save Pipeline to server"}
          >
            <Save size={13} />
            Save
          </button>
        )}

        {onSaveAs && (
          <button
            onClick={onSaveAs}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all disabled:opacity-40"
            style={{ color: "var(--ink-dim)", border: "1px solid var(--surface-3)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--electric)"; e.currentTarget.style.background = "rgba(58,160,255,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-dim)"; e.currentTarget.style.background = "transparent"; }}
            title="Save as a new pipeline"
          >
            <Copy size={13} />
            Save As
          </button>
        )}

        <button
          onClick={onClear}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all disabled:opacity-40"
          style={{ color: "var(--ink-dim)", border: "1px solid var(--surface-3)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--error)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-dim)"; e.currentTarget.style.background = "transparent"; }}
          title="Clear canvas"
        >
          <Trash2 size={13} />
          Clear
        </button>
      </div>
    </div>
    </div>
  );
}
