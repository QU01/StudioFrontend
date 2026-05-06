"use client";

import {
  Layers, Grid3x3, Zap, Activity, CloudRain, AlignCenter, Minus, Sigma,
  Trash2, CheckCircle, Loader2, Play, Save
} from "lucide-react";
import { LAYER_META, LAYER_ORDER, CATEGORY_ORDER, type LayerKind } from "./layerTypes";

const ICON_MAP: Record<string, React.ElementType> = {
  Layers, Grid3x3, Zap, Activity, CloudRain, AlignCenter, Minus, Sigma,
};

interface NNToolbarProps {
  inputShape:         number[];
  onInputShapeChange: (shape: number[]) => void;
  onAddLayer:         (kind: LayerKind) => void;
  onClear:            () => void;
  onValidate:         () => void;
  onTrain:            () => void;
  onSaveSetup?:       () => void;
  isValidating:       boolean;
  isTraining:         boolean;
  validationResult?:  { valid: boolean; message?: string } | null;
}

const inputClass =
  "bg-[#181d23] border border-white/10 rounded-md px-2 py-1 text-[12px] text-white/70 w-full focus:outline-none focus:border-[#3b82f6] transition-colors font-mono";

export function NNToolbar({
  inputShape,
  onInputShapeChange,
  onAddLayer,
  onClear,
  onValidate,
  onTrain,
  onSaveSetup,
  isValidating,
  isTraining,
  validationResult,
}: NNToolbarProps) {
  // Group layers by category
  const byCategory: Record<string, LayerKind[]> = {};
  for (const kind of LAYER_ORDER) {
    const cat = LAYER_META[kind].category;
    (byCategory[cat] ??= []).push(kind);
  }

  return (
    <div className="w-[180px] shrink-0 bg-[#1a2030] border-r border-white/5 flex flex-col overflow-y-auto custom-scrollbar">
      {/* ── Title ── */}
      <div className="px-3 py-3 border-b border-white/5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          Layer Catalog
        </div>
      </div>

      {/* ── Layer buttons by category ── */}
      <div className="flex-1 px-2 py-3 space-y-4">
        {CATEGORY_ORDER.filter((c) => byCategory[c]).map((cat) => (
          <div key={cat}>
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 px-1 mb-1.5">
              {cat}
            </div>
            <div className="space-y-1">
              {byCategory[cat].map((kind) => {
                const meta = LAYER_META[kind];
                const Icon = ICON_MAP[meta.iconName] ?? Layers;
                return (
                  <button
                    key={kind}
                    onClick={() => onAddLayer(kind)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[12px] font-medium text-left transition-all hover:scale-[1.02] active:scale-95"
                    style={{
                      background: `${meta.color}18`,
                      border: `1px solid ${meta.color}35`,
                      color: meta.color,
                    }}
                    title={meta.description}
                  >
                    <Icon size={12} style={{ flexShrink: 0 }} />
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Input shape ── */}
      <div className="px-3 py-3 border-t border-white/5 space-y-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-white/25">
          Input Shape
        </div>
        <input
          type="text"
          className={inputClass}
          value={inputShape.join(", ")}
          placeholder="1, 784"
          onChange={(e) => {
            const parsed = e.target.value
              .split(",")
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => !isNaN(n));
            if (parsed.length > 0) onInputShapeChange(parsed);
          }}
        />
        <div className="text-[9px] text-white/20">e.g. 1, 3, 224, 224</div>
      </div>

      {/* ── Actions ── */}
      <div className="px-3 py-3 border-t border-white/5 space-y-2">
        <button
          onClick={onTrain}
          disabled={isTraining || isValidating}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          style={{
            background: isTraining ? "#15803d" : "#16a34a",
            boxShadow: isTraining ? "none" : "0 0 10px rgba(34,197,94,0.35)",
          }}
        >
          {isTraining
            ? <><Loader2 size={11} className="animate-spin" />Training…</>
            : <><Play size={11} />Train</>
          }
        </button>

        <button
          onClick={onValidate}
          disabled={isValidating || isTraining}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          style={{
            background: isValidating ? "#1d4ed8" : "#2563eb",
            boxShadow: isValidating ? "none" : "0 0 10px rgba(59,130,246,0.35)",
          }}
        >
          {isValidating
            ? <><Loader2 size={11} className="animate-spin" />Validating…</>
            : <><CheckCircle size={11} />Validate</>
          }
        </button>

        {validationResult && (
          <div
            className="text-[10px] px-2 py-1.5 rounded text-center"
            style={{
              background: validationResult.valid ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${validationResult.valid ? "#22c55e33" : "#ef444433"}`,
              color: validationResult.valid ? "#86efac" : "#fca5a5",
            }}
          >
            {validationResult.valid ? "✓ Valid network" : `✗ ${validationResult.message}`}
          </div>
        )}

        <button
          onClick={onClear}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all border border-white/10"
        >
          <Trash2 size={11} />
          Clear
        </button>

        {onSaveSetup && (
          <button
            onClick={onSaveSetup}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-white/40 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all border border-white/10"
          >
            <Save size={11} />
            Save
          </button>
        )}
      </div>
    </div>
  );
}
