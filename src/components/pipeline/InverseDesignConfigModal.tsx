"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Target, Lock, Unlock, ChevronDown, ChevronRight, Trash2 } from "lucide-react";

interface ConstraintTerm {
  col: string;
  coeff: number;
}

interface LinearConstraint {
  id: string;
  label: string;
  lhs: ConstraintTerm[];
  op: "lt" | "gt";
  rhs: ConstraintTerm[];
  rhs_const: number;
  penalty: number;
  enabled: boolean;
}

interface InverseDesignConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: Record<string, unknown>) => void;
  initialParams: Record<string, unknown>;
  availableColumns: string[];
}

export function InverseDesignConfigModal({
  isOpen,
  onClose,
  onConfirm,
  initialParams,
  availableColumns,
}: InverseDesignConfigModalProps) {
  const [targetSpecs, setTargetSpecs] = useState<Record<string, number>>({});
  const [targetWeights, setTargetWeights] = useState<Record<string, number>>({});
  
  const [locksOpen, setLocksOpen] = useState(false);
  const [lockedFeatures, setLockedFeatures] = useState<Record<string, number>>({});

  const [boundsOpen, setBoundsOpen] = useState(false);
  const [featureBounds, setFeatureBounds] = useState<Record<string, { min?: number; max?: number }>>({});

  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [constraints, setConstraints] = useState<LinearConstraint[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConstraint, setNewConstraint] = useState<Omit<LinearConstraint, "id">>({
    label: "", lhs: [{ col: "", coeff: 1 }], op: "lt",
    rhs: [{ col: "", coeff: 1 }], rhs_const: 0, penalty: 10, enabled: true,
  });

  // Hyperparameters
  const [nSteps, setNSteps] = useState(200);
  const [lr, setLr] = useState(0.05);
  const [optimizer, setOptimizer] = useState<"adam" | "lbfgs">("adam");
  const [nStarts, setNStarts] = useState(3);
  const [earlyStop, setEarlyStop] = useState(true);
  const [patience, setPatience] = useState(20);
  const [constraintMethod, setConstraintMethod] = useState<"augmented_lagrangian" | "penalty">("augmented_lagrangian");

  useEffect(() => {
    if (isOpen) {
      setTargetSpecs((initialParams.desired_outputs as Record<string, number>) || {});
      setTargetWeights((initialParams.output_weights as Record<string, number>) || {});
      setLockedFeatures((initialParams.feature_lock as Record<string, number>) || {});
      
      const bounds = (initialParams.bounds as Record<string, [number, number]>) || {};
      const parsedBounds: Record<string, { min?: number; max?: number }> = {};
      Object.entries(bounds).forEach(([col, [min, max]]) => {
        parsedBounds[col] = {
          min: min <= -1e8 ? undefined : min,
          max: max >= 1e8 ? undefined : max,
        };
      });
      setFeatureBounds(parsedBounds);

      // Reconstruct constraints
      const rawC = (initialParams.constraints as any[]) || [];
      const parsedC: LinearConstraint[] = rawC.map(c => ({
        id: Math.random().toString(36).slice(2),
        label: c.label || "",
        lhs: Object.entries(c.lhs || {}).map(([col, coeff]) => ({ col, coeff: coeff as number })),
        op: c.op || "lt",
        rhs: Object.entries(c.rhs || {}).map(([col, coeff]) => ({ col, coeff: coeff as number })),
        rhs_const: c.rhs_const || 0,
        penalty: c.penalty || 10,
        enabled: true,
      }));
      setConstraints(parsedC);

      setNSteps(Number(initialParams.n_steps ?? 200));
      setLr(Number(initialParams.lr ?? 0.05));
      setOptimizer((initialParams.optimizer as any) ?? "adam");
      setNStarts(Number(initialParams.n_starts ?? 3));
      setEarlyStop(Boolean(initialParams.early_stopping ?? true));
      setPatience(Number(initialParams.patience ?? 20));
      setConstraintMethod((initialParams.constraint_method as any) ?? "augmented_lagrangian");
    }
  }, [isOpen, initialParams]);

  const handleSave = () => {
    const activeConstraints = constraints
      .filter((c) => c.enabled)
      .map((c) => ({
        lhs: Object.fromEntries(c.lhs.filter((t) => t.col).map((t) => [t.col, t.coeff])),
        op: c.op,
        rhs: Object.fromEntries(c.rhs.filter((t) => t.col).map((t) => [t.col, t.coeff])),
        rhs_const: c.rhs_const,
        penalty: c.penalty,
        label: c.label,
      }));

    const activeBounds: Record<string, [number, number]> = {};
    Object.entries(featureBounds).forEach(([col, { min, max }]) => {
      if (min !== undefined && max !== undefined) activeBounds[col] = [min, max];
      else if (min !== undefined) activeBounds[col] = [min, 1e9];
      else if (max !== undefined) activeBounds[col] = [-1e9, max];
    });

    onConfirm({
      desired_outputs: targetSpecs,
      output_weights: Object.keys(targetWeights).length > 0 ? targetWeights : undefined,
      feature_lock: Object.keys(lockedFeatures).length > 0 ? lockedFeatures : undefined,
      bounds: Object.keys(activeBounds).length > 0 ? activeBounds : undefined,
      constraints: activeConstraints.length > 0 ? activeConstraints : undefined,
      n_steps: nSteps,
      lr,
      optimizer,
      n_starts: nStarts,
      early_stopping: earlyStop,
      patience,
      constraint_method: constraintMethod,
    });
    onClose();
  };

  if (!isOpen) return null;

  const selectClass = "w-full bg-[#0a0d14] border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white/80 focus:outline-none focus:border-[#007bff]";
  const inputClass = "w-full bg-[#0a0d14] border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white/80 focus:outline-none focus:border-[#007bff]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div 
        className="w-full max-w-2xl bg-[#111827] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-white/10 animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#1a2333]/50">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-[#06b6d4]" />
            <h2 className="text-[13px] font-semibold text-[#06b6d4] tracking-widest uppercase">Inverse Design Configuration</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-white/60 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#0f1523] space-y-6">
          
          {/* Target outputs */}
          <div>
            <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-3">Output Targets</p>
            {availableColumns.length === 0 ? (
              <p className="text-white/30 text-[12px] italic">No numeric columns available to target.</p>
            ) : (
              <div className="space-y-2">
                {availableColumns.map((col) => {
                  const isEnabled = targetSpecs[col] !== undefined;
                  const val = targetSpecs[col] ?? 0;
                  const weight = targetWeights[col] ?? 1.0;
                  return (
                    <div key={col} className="rounded-xl p-3 transition-colors" style={{ background: isEnabled ? "rgba(6,182,212,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${isEnabled ? "rgba(6,182,212,0.18)" : "rgba(255,255,255,0.06)"}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-medium truncate" style={{ color: isEnabled ? "#e2e8f0" : "rgba(255,255,255,0.3)", maxWidth: 200 }} title={col}>{col}</span>
                        <button
                          onClick={() => {
                            if (isEnabled) {
                              const ns = { ...targetSpecs }; delete ns[col]; setTargetSpecs(ns);
                              const nw = { ...targetWeights }; delete nw[col]; setTargetWeights(nw);
                            } else {
                              setTargetSpecs(p => ({ ...p, [col]: 0 }));
                            }
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: isEnabled ? "rgba(6,182,212,0.18)" : "rgba(255,255,255,0.06)", color: isEnabled ? "#06b6d4" : "rgba(255,255,255,0.3)" }}
                        >
                          {isEnabled ? "ON" : "OFF"}
                        </button>
                      </div>
                      {isEnabled && (
                        <div className="flex gap-4 items-end mt-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Target Value</label>
                            <input
                              type="number" step="any" value={val}
                              onChange={(e) => setTargetSpecs(p => ({ ...p, [col]: parseFloat(e.target.value) || 0 }))}
                              className={inputClass} style={{ borderColor: "rgba(6,182,212,0.2)" }}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Weight <span className="opacity-70 lowercase">({weight.toFixed(1)}x)</span></label>
                            <input
                              type="range" min={0.1} max={5} step={0.1} value={weight}
                              onChange={(e) => setTargetWeights(p => ({ ...p, [col]: parseFloat(e.target.value) || 1 }))}
                              className="w-full h-8 cursor-pointer" style={{ accentColor: "#8b5cf6" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Locked features */}
          <div>
            <button onClick={() => setLocksOpen(v => !v)} className="flex items-center gap-2 w-full mb-2 text-white/40 hover:text-white/60 transition-colors">
              {locksOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-[11px] font-semibold uppercase tracking-wider">Locked Features</span>
              {Object.keys(lockedFeatures).length > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>{Object.keys(lockedFeatures).length}</span>
              )}
            </button>
            {locksOpen && (
              <div className="flex flex-col gap-1">
                {availableColumns.map((col) => {
                  const locked = lockedFeatures[col] !== undefined;
                  const lockVal = lockedFeatures[col] ?? 0;
                  return (
                    <div key={col} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: locked ? "rgba(245,158,11,0.06)" : "transparent", border: `1px solid ${locked ? "rgba(245,158,11,0.2)" : "transparent"}` }}>
                      <button
                        onClick={() => {
                          if (locked) { const next = { ...lockedFeatures }; delete next[col]; setLockedFeatures(next); }
                          else { setLockedFeatures(p => ({ ...p, [col]: 0 })); }
                        }}
                        className="shrink-0 transition-colors" style={{ color: locked ? "#f59e0b" : "rgba(255,255,255,0.2)" }}
                      >
                        {locked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                      <span className="flex-1 text-[11px] truncate" style={{ color: locked ? "#e2e8f0" : "rgba(255,255,255,0.3)" }} title={col}>{col}</span>
                      {locked && (
                        <input
                          type="number" step="any" value={lockVal}
                          onChange={(e) => setLockedFeatures(p => ({ ...p, [col]: parseFloat(e.target.value) || 0 }))}
                          className="w-24 rounded px-1.5 py-1 text-[11px] font-mono outline-none bg-black/30 text-[#e2e8f0] border border-amber-500/20"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bounds */}
          <div>
            <button onClick={() => setBoundsOpen(v => !v)} className="flex items-center gap-2 w-full mb-2 text-white/40 hover:text-white/60 transition-colors">
              {boundsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-[11px] font-semibold uppercase tracking-wider">Feature Bounds</span>
              {Object.keys(featureBounds).length > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{Object.keys(featureBounds).length}</span>
              )}
            </button>
            {boundsOpen && (
              <div className="flex flex-col gap-1.5">
                <p className="text-white/20 text-[10px] px-0.5 mb-1">Hard clamp on each feature every optimizer step. Leave blank to leave unconstrained.</p>
                {availableColumns.map((col) => {
                  const b = featureBounds[col] ?? {};
                  const hasAny = b.min !== undefined || b.max !== undefined;
                  return (
                    <div key={col} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: hasAny ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${hasAny ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                      <span className="text-[11px] truncate flex-1" style={{ color: hasAny ? "#e2e8f0" : "rgba(255,255,255,0.3)" }}>{col}</span>
                      <input
                        type="number" placeholder="min" value={b.min ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                          setFeatureBounds(p => { const next = { ...p, [col]: { ...p[col], min: v } }; if (next[col].min === undefined && next[col].max === undefined) delete next[col]; return next; });
                        }}
                        className="w-20 rounded px-1.5 py-1 text-[11px] font-mono outline-none text-right bg-black/30 text-[#e2e8f0] border border-purple-500/20"
                        step="any"
                      />
                      <span className="text-white/20 text-[10px]">–</span>
                      <input
                        type="number" placeholder="max" value={b.max ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                          setFeatureBounds(p => { const next = { ...p, [col]: { ...p[col], max: v } }; if (next[col].min === undefined && next[col].max === undefined) delete next[col]; return next; });
                        }}
                        className="w-20 rounded px-1.5 py-1 text-[11px] font-mono outline-none text-right bg-black/30 text-[#e2e8f0] border border-purple-500/20"
                        step="any"
                      />
                      {hasAny && (
                        <button onClick={() => setFeatureBounds(p => { const next = { ...p }; delete next[col]; return next; })} className="text-white/20 hover:text-red-400 ml-1">
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Physical Constraints */}
          <div>
            <button onClick={() => setConstraintsOpen(v => !v)} className="flex items-center gap-2 w-full mb-2 text-white/40 hover:text-white/60 transition-colors">
              {constraintsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-[11px] font-semibold uppercase tracking-wider">Physical Constraints</span>
              {constraints.filter(c => c.enabled).length > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>{constraints.filter(c => c.enabled).length}</span>
              )}
            </button>
            {constraintsOpen && (
              <div className="flex flex-col gap-2">
                {constraints.map((c) => (
                  <div key={c.id} className="rounded-xl p-3" style={{ background: c.enabled ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${c.enabled ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.06)"}` }}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-medium leading-snug flex-1" style={{ color: c.enabled ? "#fca5a5" : "rgba(255,255,255,0.3)" }}>
                        {c.label || (
                          <span className="italic text-white/25">
                            {c.lhs.filter((t) => t.col).map((t) => `${t.coeff !== 1 ? t.coeff + "×" : ""}${t.col}`).join(" + ")}
                            {" "}{c.op === "lt" ? "<" : ">"}{" "}
                            {c.rhs.filter((t) => t.col).map((t) => `${t.coeff !== 1 ? t.coeff + "×" : ""}${t.col}`).join(" + ")}
                            {c.rhs_const !== 0 ? ` + ${c.rhs_const}` : ""}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setConstraints(p => p.map(x => x.id === c.id ? { ...x, enabled: !x.enabled } : x))} className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: c.enabled ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)", color: c.enabled ? "#f87171" : "rgba(255,255,255,0.3)" }}>
                          {c.enabled ? "ON" : "OFF"}
                        </button>
                        <button onClick={() => setConstraints(p => p.filter(x => x.id !== c.id))} className="text-white/20 hover:text-red-400">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    {c.enabled && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-white/25 text-[10px] w-12 shrink-0">Penalty</span>
                        <input type="range" min={1} max={200} step={1} value={c.penalty} onChange={(e) => setConstraints(p => p.map(x => x.id === c.id ? { ...x, penalty: Number(e.target.value) } : x))} className="flex-1 h-1 rounded cursor-pointer" style={{ accentColor: "#ef4444" }} />
                        <span className="text-white/40 text-[10px] w-8 text-right font-mono">{c.penalty}</span>
                      </div>
                    )}
                  </div>
                ))}
                
                {showAddForm ? (
                  <div className="rounded-xl p-3 flex flex-col gap-2 bg-white/5 border border-white/10 mt-1">
                    <input type="text" placeholder="Short description (optional)" value={newConstraint.label} onChange={e => setNewConstraint({ ...newConstraint, label: e.target.value })} className={inputClass + " mb-1"} />
                    <div className="text-[10px] text-white/40">Left side:</div>
                    {newConstraint.lhs.map((term, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <input type="number" step="any" value={term.coeff} onChange={(e) => { const neo = [...newConstraint.lhs]; neo[idx].coeff = parseFloat(e.target.value) || 0; setNewConstraint({ ...newConstraint, lhs: neo }); }} className={inputClass + " w-16 px-1 py-0.5"} />
                        <span className="text-white/40 text-[10px]">×</span>
                        <select value={term.col} onChange={(e) => { const neo = [...newConstraint.lhs]; neo[idx].col = e.target.value; setNewConstraint({ ...newConstraint, lhs: neo }); }} className={selectClass + " flex-1 py-0.5 px-1"}>
                          <option value="">- Feature -</option>
                          {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => { const neo = newConstraint.lhs.filter((_, i) => i !== idx); setNewConstraint({ ...newConstraint, lhs: neo }); }} className="p-1 text-white/20 hover:text-red-400"><Trash2 size={10} /></button>
                      </div>
                    ))}
                    <button onClick={() => setNewConstraint({ ...newConstraint, lhs: [...newConstraint.lhs, { col: "", coeff: 1 }] })} className="text-[10px] text-[#06b6d4] self-start py-0.5 font-semibold">+ Add Term</button>
                    
                    <div className="flex justify-center my-1">
                      <select value={newConstraint.op} onChange={(e) => setNewConstraint({ ...newConstraint, op: e.target.value as "lt" | "gt" })} className="bg-black/40 text-white/70 border-none outline-none text-[12px] font-bold rounded px-2 py-0.5">
                        <option value="lt">{"<"} (Less Than)</option>
                        <option value="gt">{">"} (Greater Than)</option>
                      </select>
                    </div>

                    <div className="text-[10px] text-white/40">Right side:</div>
                    {newConstraint.rhs.map((term, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <input type="number" step="any" value={term.coeff} onChange={(e) => { const neo = [...newConstraint.rhs]; neo[idx].coeff = parseFloat(e.target.value) || 0; setNewConstraint({ ...newConstraint, rhs: neo }); }} className={inputClass + " w-16 px-1 py-0.5"} />
                        <span className="text-white/40 text-[10px]">×</span>
                        <select value={term.col} onChange={(e) => { const neo = [...newConstraint.rhs]; neo[idx].col = e.target.value; setNewConstraint({ ...newConstraint, rhs: neo }); }} className={selectClass + " flex-1 py-0.5 px-1"}>
                          <option value="">- Feature -</option>
                          {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => { const neo = newConstraint.rhs.filter((_, i) => i !== idx); setNewConstraint({ ...newConstraint, rhs: neo }); }} className="p-1 text-white/20 hover:text-red-400"><Trash2 size={10} /></button>
                      </div>
                    ))}
                    <button onClick={() => setNewConstraint({ ...newConstraint, rhs: [...newConstraint.rhs, { col: "", coeff: 1 }] })} className="text-[10px] text-[#06b6d4] self-start py-0.5 font-semibold">+ Add Term</button>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-white/40 text-[10px]">+ Constant:</span>
                      <input type="number" step="any" value={newConstraint.rhs_const} onChange={e => setNewConstraint({ ...newConstraint, rhs_const: parseFloat(e.target.value) || 0 })} className={inputClass + " w-20 px-1 py-0.5 text-right"} />
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-white/5">
                      <button onClick={() => setShowAddForm(false)} className="text-[11px] text-white/50 hover:text-white px-2 py-1">Cancel</button>
                      <button onClick={() => { setConstraints([...constraints, { ...newConstraint, id: Math.random().toString() }]); setShowAddForm(false); setNewConstraint({ label: "", lhs: [{ col: "", coeff: 1 }], op: "lt", rhs: [{ col: "", coeff: 1 }], rhs_const: 0, penalty: 10, enabled: true }); }} disabled={newConstraint.lhs.every(t => !t.col) && newConstraint.rhs.every(t => !t.col)} className="text-[11px] font-semibold bg-[#ef4444]/20 text-[#ef4444] px-3 py-1 rounded hover:bg-[#ef4444]/30 disabled:opacity-50">Save Constraint</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddForm(true)} className="flex items-center justify-center gap-1 py-1.5 mt-1 rounded-lg border border-dashed border-white/10 text-white/30 hover:text-white/50 hover:bg-white/5 transition-colors text-[10px] font-semibold w-full">
                    + Add Custom Constraint
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-white/5 w-full my-2"></div>

          {/* Hyperparameters */}
          <div>
            <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-3">Hyperparameters</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Optimizer</label>
                <select value={optimizer} onChange={(e) => setOptimizer(e.target.value as any)} className={selectClass}>
                  <option value="adam">Adam (Fast)</option>
                  <option value="lbfgs">L-BFGS (Precise)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Constraint Method</label>
                <select value={constraintMethod} onChange={(e) => setConstraintMethod(e.target.value as any)} className={selectClass}>
                  <option value="augmented_lagrangian">Augmented Lagrangian</option>
                  <option value="penalty">Quadratic Penalty</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Max Steps</label>
                <input type="number" value={nSteps} onChange={e => setNSteps(parseInt(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Learning Rate</label>
                <input type="number" step="any" value={lr} onChange={e => setLr(parseFloat(e.target.value))} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-white/30 uppercase tracking-widest flex items-center justify-between mb-1">
                  <span>Multi-start runs: {nStarts}</span>
                  <span className="normal-case opacity-50">1 (fast) to 10 (robust)</span>
                </label>
                <input type="range" min={1} max={10} step={1} value={nStarts} onChange={e => setNStarts(parseInt(e.target.value))} className="w-full accent-[#06b6d4] h-1" />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-4 border-t border-white/5 bg-[#1a2333]/30 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-1.5 rounded-md text-[12px] font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-1.5 rounded-md text-[12px] font-semibold text-black bg-[#06b6d4] hover:bg-[#0891b2] transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
