"use client";

import {
  Database, Filter, Columns2, Eraser, BarChart2, Scissors, Brain, LineChart, Group, Binary, Hash, Network,
  Trash2, Play, Save, Code2, RefreshCw, Square, Copy, FileText, Zap,
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
  pipelineName?: string;
  isRunning: boolean;
}

export function Toolbar({ onAddNode, onClear, onExecute, onStop, onSave, onSaveAs, onAutoML, pipelineName, isRunning }: ToolbarProps) {
  return (
    <div className="flex flex-col bg-[#1a2030] border-b border-white/10 shrink-0">
    {/* Title bar with current pipeline name */}
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/5">
      <FileText size={12} className="text-white/30" />
      <span className="text-[11px] uppercase tracking-widest text-white/30 font-bold">Pipeline:</span>
      <span className="text-[12px] text-white/80 font-medium truncate" title={pipelineName || "Untitled"}>
        {pipelineName || <span className="text-white/25 italic font-normal">Untitled (unsaved)</span>}
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
            <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold px-1 select-none">
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
            <span className="text-white/10 mx-1 select-none">│</span>
          </div>
        ));
      })()}

      <div className="ml-auto flex items-center gap-2">
        {onAutoML && (
          <button
            onClick={onAutoML}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "#7c3aed22", border: "1px solid #7c3aed66", color: "#a78bfa" }}
            title="Auto-find the best model"
          >
            <Zap size={13} />
            AutoML
          </button>
        )}

        {isRunning && onStop ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold text-white transition-all hover:scale-105 active:scale-95"
            style={{ background: "#c0392b", boxShadow: "0 0 12px rgba(192,57,43,0.5)" }}
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
              background: "#007bff",
              boxShadow: "0 0 12px rgba(0,123,255,0.4)",
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-white/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all border border-white/10 disabled:opacity-40"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-white/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all border border-white/10 disabled:opacity-40"
            title="Save as a new pipeline"
          >
            <Copy size={13} />
            Save As
          </button>
        )}

        <button
          onClick={onClear}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all border border-white/10 disabled:opacity-40"
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
