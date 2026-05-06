"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  Compass,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Play,
  RotateCcw,
  ArrowRight,
  Target,
  Loader2,
  Download,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  BookMarked,
  Zap,
  GitBranch,
  Star,
  TrendingDown,
  Activity,
  FileText,
} from "lucide-react";
import {
  fetchNNHistory,
  solveInverseDesign,
  type NNInverseDesignResult,
  type NNConstraintSpec,
  exportPDFReport,
} from "@/lib/api";
import { fetchWithAuth, DJANGO_API_BASE } from "@/lib/auth";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface SavedSolution {
  id: number;
  name: string;
  created_at: string;
  result: NNInverseDesignResult;
}

interface SolveTabProps {
  hasModel: boolean;
  loadedSolution?: any;
}

interface TargetSpec {
  enabled: boolean;
  value: number;
  weight: number;
}

interface LockedFeature {
  col: string;
  value: number;
}

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

// Pre-built templates for centrifugal compressor geometry
// Dataset-derived bounds for the centrifugal compressor dataset
const COMPRESSOR_BOUNDS: Record<string, [number, number]> = {
  R2_mm:         [30,      70],
  RPM:           [50000,   120000],
  Beta2_deg:     [-45,     -10],
  N_blades:      [10,      22],
  R1hub_mm:      [8,       20],
  SG_mm:         [10,      30],
  SGR:           [0.05,    0.30],
  T0_inlet_K:    [270,     320],
  P0_inlet_Pa:   [85000,   110000],
  mass_flow_kgs: [0.10,    0.40],
};

const COMPRESSOR_TEMPLATES: Omit<LinearConstraint, "id">[] = [
  {
    label: "Inlet shroud < 0.95 × R2  (flow direction)",
    lhs: [{ col: "R1hub_mm", coeff: 1 }, { col: "SG_mm", coeff: 1 }],
    op: "lt",
    rhs: [{ col: "R2_mm", coeff: 0.95 }],
    rhs_const: 0,
    penalty: 50,
    enabled: true,
  },
  {
    label: "R1hub < 0.6 × R2  (hub ratio)",
    lhs: [{ col: "R1hub_mm", coeff: 1 }],
    op: "lt",
    rhs: [{ col: "R2_mm", coeff: 0.6 }],
    rhs_const: 0,
    penalty: 30,
    enabled: true,
  },
];

export function SolveTab({ hasModel, loadedSolution }: SolveTabProps) {
  // Meta from history
  const [targetCols, setTargetCols] = useState<string[]>([]);
  const [featureCols, setFeatureCols] = useState<string[]>([]);
  const [featureMeans, setFeatureMeans] = useState<number[]>([]);
  const [targetMeans, setTargetMeans] = useState<number[]>([]);
  const [targetStds, setTargetStds] = useState<number[]>([]);
  const [isRegression, setIsRegression] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);

  // UI state
  const [targetSpecs, setTargetSpecs] = useState<Record<string, TargetSpec>>({});
  const [locksOpen, setLocksOpen] = useState(false);
  const [lockedFeatures, setLockedFeatures] = useState<Record<string, LockedFeature>>({});

  // Feature bounds
  const [boundsOpen, setBoundsOpen] = useState(false);
  const [featureBounds, setFeatureBounds] = useState<Record<string, { min?: number; max?: number }>>({});

  // Physical constraints
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [constraints, setConstraints] = useState<LinearConstraint[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newConstraint, setNewConstraint] = useState<Omit<LinearConstraint, "id">>({
    label: "", lhs: [{ col: "", coeff: 1 }], op: "lt",
    rhs: [{ col: "", coeff: 1 }], rhs_const: 0, penalty: 10, enabled: true,
  });

  // Hyperparams
  const [nSteps, setNSteps] = useState(200);
  const [lr, setLr] = useState(0.05);
  const [optimizer, setOptimizer] = useState<"adam" | "lbfgs">("adam");
  const [nStarts, setNStarts] = useState(1);
  const [earlyStop, setEarlyStop] = useState(true);
  const [patience, setPatience] = useState(20);
  const [constraintMethod, setConstraintMethod] = useState<"augmented_lagrangian" | "penalty">("augmented_lagrangian");

  // Result tabs
  const [resultTab, setResultTab] = useState<"overview" | "sensitivity" | "starts">("overview");

  // Result state
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState<NNInverseDesignResult | null>(null);

  // Saved solutions from Django
  const [savedSolutions, setSavedSolutions] = useState<SavedSolution[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);

  // ── Sync loaded solution ──────────────────────────────────────────────────
  useEffect(() => {
    if (loadedSolution) {
      setResult(loadedSolution);
    }
  }, [loadedSolution]);

  // ── Load saved solutions from Django ──────────────────────────────────────
  useEffect(() => {
    fetchWithAuth(`${DJANGO_API_BASE}/inverse-design-solutions/`)
      .then((r) => r.ok ? r.json() : [])
      .then((list: SavedSolution[]) => setSavedSolutions(list))
      .catch(() => {});
  }, []);

  // Load meta on mount
  useEffect(() => {
    fetchNNHistory().then((data) => {
      if (data.meta) {
        const meta = data.meta as Record<string, unknown>;
        const task = meta.task as string;
        const tCols = (meta.target_cols as string[]) ?? [];
        const fCols = (meta.feature_cols as string[]) ?? [];
        const fMeans = (meta.mean as number[]) ?? [];
        const tMeans = (meta.target_mean as number[]) ?? [];
        const tStds = (meta.target_std as number[]) ?? [];

        setIsRegression(task === "regression");
        setTargetCols(tCols);
        setFeatureCols(fCols);
        setFeatureMeans(fMeans);
        setTargetMeans(tMeans);
        setTargetStds(tStds);
        setMetaLoaded(true);

        // Init target specs
        const specs: Record<string, TargetSpec> = {};
        tCols.forEach((col, i) => {
          specs[col] = { enabled: true, value: tMeans[i] ?? 0, weight: 1.0 };
        });
        setTargetSpecs(specs);
      }
    }).catch(() => {});
  }, []);

  const handleLoadSaved = useCallback((sol: SavedSolution) => {
    const r = sol.result as NNInverseDesignResult | null | Record<string, unknown>;
    if (!r || typeof (r as NNInverseDesignResult).final_loss !== "number") {
      toast.error(`"${sol.name}" was saved with an older version and has no result data. Re-run Solve and save again.`);
      return;
    }
    setResult(r as NNInverseDesignResult);
    setResultTab("overview");
    toast.success(`Loaded: ${sol.name}`);
  }, []);

  const handleDeleteSaved = useCallback(async (id: number, name: string) => {
    try {
      const res = await fetchWithAuth(`${DJANGO_API_BASE}/inverse-design-solutions/${id}/`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setSavedSolutions((prev) => prev.filter((s) => s.id !== id));
        toast.success(`Deleted: ${name}`);
      }
    } catch {
      toast.error("Delete failed");
    }
  }, []);

  const handleSolve = useCallback(async () => {
    const desired: Record<string, number> = {};
    const weights: Record<string, number> = {};
    Object.entries(targetSpecs).forEach(([col, spec]) => {
      if (spec.enabled) {
        desired[col] = spec.value;
        weights[col] = spec.weight;
      }
    });

    if (Object.keys(desired).length === 0) {
      toast.error("Enable at least one target output");
      return;
    }

    const lockMap: Record<string, number> = {};
    Object.values(lockedFeatures).forEach(({ col, value }) => {
      lockMap[col] = value;
    });

    setSolving(true);
    setResult(null);
    try {
      // Build constraint specs from enabled constraints
      const activeConstraints: NNConstraintSpec[] = constraints
        .filter((c) => c.enabled)
        .map((c) => ({
          lhs: Object.fromEntries(c.lhs.filter((t) => t.col).map((t) => [t.col, t.coeff])),
          op: c.op,
          rhs: Object.fromEntries(c.rhs.filter((t) => t.col).map((t) => [t.col, t.coeff])),
          rhs_const: c.rhs_const,
          penalty: c.penalty,
          label: c.label,
        }));

      // Build bounds from featureBounds state
      const activeBounds: Record<string, [number, number]> = {};
      Object.entries(featureBounds).forEach(([col, { min, max }]) => {
        if (min !== undefined && max !== undefined) activeBounds[col] = [min, max];
        else if (min !== undefined) activeBounds[col] = [min, 1e9];
        else if (max !== undefined) activeBounds[col] = [-1e9, max];
      });

      const res = await solveInverseDesign({
        desired_outputs: desired,
        n_steps: nSteps,
        lr,
        feature_lock: Object.keys(lockMap).length > 0 ? lockMap : undefined,
        output_weights: Object.keys(weights).length > 0 ? weights : undefined,
        constraints: activeConstraints.length > 0 ? activeConstraints : undefined,
        bounds: Object.keys(activeBounds).length > 0 ? activeBounds : undefined,
        // Professional-grade params
        optimizer,
        n_starts: nStarts,
        early_stopping: earlyStop,
        patience,
        constraint_method: constraintMethod,
      });
      setResult(res);
      setResultTab("overview");
      const violated = (res.constraint_violations ?? []).filter((v) => !v.satisfied).length;
      const constraintNote = violated > 0 ? ` · ⚠ ${violated} constraint${violated > 1 ? "s" : ""} violated` : "";
      const startsNote = nStarts > 1 ? ` · ${nStarts} starts` : "";
      toast.success(`Solved in ${res.n_steps} steps · loss ${res.final_loss.toFixed(5)}${constraintNote}${startsNote}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Solve failed");
    } finally {
      setSolving(false);
    }
  }, [targetSpecs, lockedFeatures, nSteps, lr, optimizer, nStarts, earlyStop, patience, constraintMethod, constraints, featureBounds]);

  const toggleLock = useCallback((col: string, featureIdx: number) => {
    setLockedFeatures((prev) => {
      if (prev[col]) {
        const next = { ...prev };
        delete next[col];
        return next;
      }
      return { ...prev, [col]: { col, value: featureMeans[featureIdx] ?? 0 } };
    });
  }, [featureMeans]);

  const downloadResult = useCallback((format: "csv" | "json") => {
    if (!result) return;
    if (format === "json") {
      const payload = {
        inputs: result.final_features,
        outputs: result.final_outputs,
        desired_outputs: result.desired_outputs,
        deltas: result.feature_deltas,
        final_loss: result.final_loss,
        n_steps: result.n_steps,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "inverse_design_result.json"; a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV: one row with all input columns + output columns
      const allCols = [...result.feature_cols, ...result.target_cols];
      const allVals = [
        ...result.feature_cols.map((c) => result.final_features[c] ?? ""),
        ...result.target_cols.map((c) => result.final_outputs[c] ?? ""),
      ];
      const csv = [allCols.join(","), allVals.join(",")].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "inverse_design_result.csv"; a.click();
      URL.revokeObjectURL(url);
    }
    toast.success(`Downloaded as ${format.toUpperCase()}`);
  }, [result]);

  const handleSaveSolution = useCallback(async () => {
    if (!result) return;
    const name = window.prompt("Enter a name for this inverse design solution:");
    if (!name) return;

    try {
      const payload = {
        name,
        parameters: { desired_outputs: result.desired_outputs },
        result: {
          final_features:        result.final_features,
          final_outputs:         result.final_outputs,
          desired_outputs:       result.desired_outputs,
          feature_cols:          result.feature_cols,
          target_cols:           result.target_cols,
          final_loss:            result.final_loss,
          n_steps:               result.n_steps,
          loss_history:          result.loss_history,
          feature_deltas:        result.feature_deltas,
          per_target_errors:     result.per_target_errors ?? null,
          constraint_violations: result.constraint_violations ?? null,
          sensitivity:           result.sensitivity ?? null,
          all_starts:            result.all_starts ?? null,
          grad_norm_history:     result.grad_norm_history ?? null,
          convergence_rate:      result.convergence_rate ?? null,
          n_starts_used:         result.n_starts_used ?? null,
        },
      };

      const res = await fetchWithAuth(`${DJANGO_API_BASE}/inverse-design-solutions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json().catch(() => null);
        if (saved) setSavedSolutions((prev) => [saved, ...prev]);
        toast.success("Solution saved successfully!");
      } else {
        toast.error("Failed to save solution");
      }
    } catch (err) {
      toast.error("Error saving solution");
    }
  }, [result]);

  const handleExportPDF = useCallback(async () => {
    try {
      toast.info("Generating PDF report...");
      await exportPDFReport("Inverse Design Solution Report", {
        inverse_result: result || undefined
      });
      toast.success("PDF generated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF generation failed");
    }
  }, [result]);

  // ── No model / not regression ─────────────────────────────────────────────
  if (!result && !loadedSolution && (!hasModel || (metaLoaded && !isRegression))) {
    return (
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div
          className="flex flex-col overflow-y-auto shrink-0 custom-scrollbar"
          style={{ width: 340, borderRight: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.25)", padding: "20px 16px" }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Target size={14} style={{ color: "#06b6d4" }} />
            <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "#06b6d4" }}>Saved Solutions</span>
          </div>
          {savedSolutions.length === 0 ? (
            <p className="text-white/25 text-[11px] leading-relaxed">No saved solutions yet. Train a regression model, run Solve, then click Save Server.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {savedSolutions.map((sol) => (
                <div
                  key={sol.id}
                  className="rounded-xl p-3 flex items-start justify-between gap-2"
                  style={{ background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.12)" }}
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-white/80 truncate" title={sol.name}>{sol.name}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {new Date(sol.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {sol.result?.final_loss != null && <span className="ml-2 font-mono">loss {sol.result.final_loss.toFixed(5)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleLoadSaved(sol)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                      style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4" }}
                    >Load</button>
                    <button
                      onClick={() => handleDeleteSaved(sol.id, sol.name)}
                      className="px-2 py-1 rounded-lg text-[10px]"
                      style={{ border: "1px solid rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.5)" }}
                    ><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Compass size={32} style={{ color: "rgba(6,182,212,0.2)", margin: "0 auto" }} />
            <p className="text-white/30 text-[13px]">
              {!hasModel ? "Train a regression model first, or load a saved solution" : "Regression model required"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col overflow-y-auto shrink-0"
        style={{
          width: 340,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.25)",
          padding: "20px 16px",
          gap: 0,
        }}
      >
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <Target size={14} style={{ color: "#06b6d4" }} />
            <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "#06b6d4" }}>
              Inverse Design
            </span>
          </div>
          <p className="text-white/30 text-[11px] leading-relaxed">
            Specify desired output values — gradient descent will find the inputs that produce them.
          </p>
        </div>

        {/* Saved Solutions collapsible */}
        {savedSolutions.length > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setSavedOpen((v) => !v)}
              className="flex items-center gap-2 w-full mb-2 text-white/40 hover:text-white/60 transition-colors"
            >
              {savedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-[11px] font-semibold uppercase tracking-wider">Saved Solutions</span>
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}
              >
                {savedSolutions.length}
              </span>
            </button>
            {savedOpen && (
              <div className="flex flex-col gap-2">
                {savedSolutions.map((sol) => (
                  <div
                    key={sol.id}
                    className="rounded-xl p-3 flex items-start justify-between gap-2"
                    style={{ background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.12)" }}
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-white/80 truncate" title={sol.name}>{sol.name}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">
                        {new Date(sol.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {sol.result?.final_loss != null && <span className="ml-2 font-mono">loss {sol.result.final_loss.toFixed(5)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleLoadSaved(sol)}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:bg-cyan-500/10"
                        style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4" }}
                      >Load</button>
                      <button
                        onClick={() => handleDeleteSaved(sol.id, sol.name)}
                        className="px-2 py-1 rounded-lg text-[10px] transition-all hover:bg-red-500/10"
                        style={{ border: "1px solid rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.5)" }}
                      ><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Target outputs */}
        <div className="mb-5">
          <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-3">
            Output Targets
          </p>
          <div className="flex flex-col gap-3">
            {targetCols.map((col, i) => {
              const spec = targetSpecs[col] ?? { enabled: true, value: targetMeans[i] ?? 0, weight: 1.0 };
              const tMin = (targetMeans[i] ?? 0) - 3 * (targetStds[i] ?? 1);
              const tMax = (targetMeans[i] ?? 0) + 3 * (targetStds[i] ?? 1);
              return (
                <div
                  key={col}
                  className="rounded-xl p-3"
                  style={{
                    background: spec.enabled
                      ? "rgba(6,182,212,0.06)"
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${spec.enabled ? "rgba(6,182,212,0.18)" : "rgba(255,255,255,0.06)"}`,
                    transition: "all 0.15s",
                  }}
                >
                  {/* Toggle + label */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[12px] font-medium truncate"
                      style={{ color: spec.enabled ? "#e2e8f0" : "rgba(255,255,255,0.3)", maxWidth: 170 }}
                      title={col}
                    >
                      {col}
                    </span>
                    <button
                      onClick={() =>
                        setTargetSpecs((prev) => ({
                          ...prev,
                          [col]: { ...spec, enabled: !spec.enabled },
                        }))
                      }
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all"
                      style={{
                        background: spec.enabled ? "rgba(6,182,212,0.18)" : "rgba(255,255,255,0.06)",
                        color: spec.enabled ? "#06b6d4" : "rgba(255,255,255,0.3)",
                        border: `1px solid ${spec.enabled ? "rgba(6,182,212,0.3)" : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      {spec.enabled ? "ON" : "OFF"}
                    </button>
                  </div>

                  {spec.enabled && (
                    <>
                      {/* Value input */}
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="number"
                          value={spec.value}
                          onChange={(e) =>
                            setTargetSpecs((prev) => ({
                              ...prev,
                              [col]: { ...spec, value: parseFloat(e.target.value) || 0 },
                            }))
                          }
                          className="flex-1 rounded-lg px-2 py-1 text-[12px] font-mono outline-none transition-all"
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(6,182,212,0.2)",
                            color: "#e2e8f0",
                          }}
                          step={0.01}
                        />
                        <span className="text-white/25 text-[10px]">
                          ±{targetStds[i] != null ? targetStds[i].toFixed(2) : "?"}
                        </span>
                      </div>

                      {/* Range slider */}
                      <input
                        type="range"
                        min={tMin}
                        max={tMax}
                        step={(tMax - tMin) / 200}
                        value={spec.value}
                        onChange={(e) =>
                          setTargetSpecs((prev) => ({
                            ...prev,
                            [col]: { ...spec, value: parseFloat(e.target.value) },
                          }))
                        }
                        className="w-full h-1 rounded appearance-none cursor-pointer mb-2"
                        style={{ accentColor: "#06b6d4" }}
                      />

                      {/* Weight */}
                      <div className="flex items-center gap-2">
                        <span className="text-white/30 text-[10px] w-12 shrink-0">Weight</span>
                        <input
                          type="range"
                          min={0.1}
                          max={5}
                          step={0.1}
                          value={spec.weight}
                          onChange={(e) =>
                            setTargetSpecs((prev) => ({
                              ...prev,
                              [col]: { ...spec, weight: parseFloat(e.target.value) },
                            }))
                          }
                          className="flex-1 h-1 rounded appearance-none cursor-pointer"
                          style={{ accentColor: "#8b5cf6" }}
                        />
                        <span className="text-white/40 text-[10px] w-8 text-right font-mono">
                          {spec.weight.toFixed(1)}×
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Locked features (collapsible) */}
        <div className="mb-5">
          <button
            onClick={() => setLocksOpen((v) => !v)}
            className="flex items-center gap-2 w-full mb-2 text-white/40 hover:text-white/60 transition-colors"
          >
            {locksOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Locked Features
            </span>
            {Object.keys(lockedFeatures).length > 0 && (
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
              >
                {Object.keys(lockedFeatures).length}
              </span>
            )}
          </button>

          {locksOpen && (
            <div className="flex flex-col gap-1">
              {featureCols.map((col, i) => {
                const locked = !!lockedFeatures[col];
                const lockVal = lockedFeatures[col]?.value ?? featureMeans[i] ?? 0;
                return (
                  <div
                    key={col}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                    style={{
                      background: locked ? "rgba(245,158,11,0.06)" : "transparent",
                      border: `1px solid ${locked ? "rgba(245,158,11,0.2)" : "transparent"}`,
                    }}
                  >
                    <button
                      onClick={() => toggleLock(col, i)}
                      className="shrink-0 transition-colors"
                      style={{ color: locked ? "#f59e0b" : "rgba(255,255,255,0.2)" }}
                    >
                      {locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <span
                      className="flex-1 text-[11px] truncate"
                      style={{ color: locked ? "#e2e8f0" : "rgba(255,255,255,0.3)" }}
                      title={col}
                    >
                      {col}
                    </span>
                    {locked && (
                      <input
                        type="number"
                        value={lockVal}
                        onChange={(e) =>
                          setLockedFeatures((prev) => ({
                            ...prev,
                            [col]: { col, value: parseFloat(e.target.value) || 0 },
                          }))
                        }
                        className="w-20 rounded px-1.5 py-0.5 text-[11px] font-mono outline-none"
                        style={{
                          background: "rgba(0,0,0,0.3)",
                          border: "1px solid rgba(245,158,11,0.2)",
                          color: "#e2e8f0",
                        }}
                        step={0.01}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feature Bounds */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setBoundsOpen((v) => !v)}
              className="flex items-center gap-1.5 flex-1 text-left text-white/40 hover:text-white/60 transition-colors"
            >
              {boundsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-[11px] font-semibold uppercase tracking-wider">Feature Bounds</span>
              {Object.keys(featureBounds).length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                  {Object.keys(featureBounds).length}
                </span>
              )}
            </button>
            {/* Load compressor bounds template */}
            <button
              onClick={() => {
                const applicable = Object.fromEntries(
                  Object.entries(COMPRESSOR_BOUNDS).filter(([col]) => featureCols.includes(col))
                    .map(([col, [min, max]]) => [col, { min, max }])
                );
                if (Object.keys(applicable).length === 0) { toast.info("No matching columns found"); return; }
                setFeatureBounds(applicable);
                setBoundsOpen(true);
                toast.success(`Loaded bounds for ${Object.keys(applicable).length} features`);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:bg-white/8"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
              title="Load centrifugal compressor dataset bounds"
            >
              <BookMarked size={10} />
              Templates
            </button>
          </div>

          {boundsOpen && (
            <div className="flex flex-col gap-1.5">
              <p className="text-white/20 text-[10px] px-0.5 mb-1">
                Hard clamp on each feature every optimizer step. Leave blank to leave unconstrained.
              </p>
              {featureCols.map((col) => {
                const b = featureBounds[col] ?? {};
                const hasAny = b.min !== undefined || b.max !== undefined;
                return (
                  <div key={col}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                    style={{
                      background: hasAny ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${hasAny ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)"}`,
                    }}
                  >
                    <span className="text-[11px] truncate flex-1" style={{ color: hasAny ? "#e2e8f0" : "rgba(255,255,255,0.3)" }} title={col}>{col}</span>
                    <input
                      type="number"
                      placeholder="min"
                      value={b.min ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                        setFeatureBounds((prev) => {
                          const next = { ...prev, [col]: { ...prev[col], min: v } };
                          if (next[col].min === undefined && next[col].max === undefined) delete next[col];
                          return next;
                        });
                      }}
                      className="w-16 rounded px-1.5 py-0.5 text-[10px] font-mono outline-none text-right"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.2)", color: "#e2e8f0" }}
                      step="any"
                    />
                    <span className="text-white/20 text-[10px]">–</span>
                    <input
                      type="number"
                      placeholder="max"
                      value={b.max ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                        setFeatureBounds((prev) => {
                          const next = { ...prev, [col]: { ...prev[col], max: v } };
                          if (next[col].min === undefined && next[col].max === undefined) delete next[col];
                          return next;
                        });
                      }}
                      className="w-16 rounded px-1.5 py-0.5 text-[10px] font-mono outline-none text-right"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.2)", color: "#e2e8f0" }}
                      step="any"
                    />
                    {hasAny && (
                      <button
                        onClick={() => setFeatureBounds((prev) => { const next = { ...prev }; delete next[col]; return next; })}
                        className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
              {Object.keys(featureBounds).length > 0 && (
                <button
                  onClick={() => setFeatureBounds({})}
                  className="text-[10px] text-white/25 hover:text-white/45 transition-colors mt-1"
                >
                  Clear all bounds
                </button>
              )}
            </div>
          )}
        </div>

        {/* Physical Constraints */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setConstraintsOpen((v) => !v)}
              className="flex items-center gap-1.5 flex-1 text-left text-white/40 hover:text-white/60 transition-colors"
            >
              {constraintsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Physical Constraints
              </span>
              {constraints.filter((c) => c.enabled).length > 0 && (
                <span
                  className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}
                >
                  {constraints.filter((c) => c.enabled).length}
                </span>
              )}
            </button>
            {/* Templates button */}
            <button
              onClick={() => {
                const newOnes = COMPRESSOR_TEMPLATES
                  .filter((t) => !constraints.some((c) => c.label === t.label))
                  .map((t) => ({ ...t, id: Math.random().toString(36).slice(2) }));
                if (newOnes.length === 0) { toast.info("Templates already added"); return; }
                setConstraints((prev) => [...prev, ...newOnes]);
                setConstraintsOpen(true);
                toast.success(`Added ${newOnes.length} compressor constraint${newOnes.length > 1 ? "s" : ""}`);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:bg-white/8"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.35)",
              }}
              title="Load centrifugal compressor geometric constraints"
            >
              <BookMarked size={10} />
              Templates
            </button>
          </div>

          {constraintsOpen && (
            <div className="flex flex-col gap-2">
              {constraints.length === 0 && (
                <p className="text-white/20 text-[11px] px-1">
                  No constraints. Use Templates or Add to define inequalities between features.
                </p>
              )}

              {constraints.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl p-3"
                  style={{
                    background: c.enabled ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${c.enabled ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span
                      className="text-[11px] font-medium leading-snug flex-1"
                      style={{ color: c.enabled ? "#fca5a5" : "rgba(255,255,255,0.3)" }}
                    >
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
                      <button
                        onClick={() => setConstraints((prev) => prev.map((x) => x.id === c.id ? { ...x, enabled: !x.enabled } : x))}
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{
                          background: c.enabled ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
                          color: c.enabled ? "#f87171" : "rgba(255,255,255,0.3)",
                        }}
                      >
                        {c.enabled ? "ON" : "OFF"}
                      </button>
                      <button
                        onClick={() => setConstraints((prev) => prev.filter((x) => x.id !== c.id))}
                        className="text-white/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  {c.enabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/25 text-[10px] w-12 shrink-0">Penalty</span>
                      <input
                        type="range" min={1} max={200} step={1} value={c.penalty}
                        onChange={(e) => setConstraints((prev) => prev.map((x) => x.id === c.id ? { ...x, penalty: Number(e.target.value) } : x))}
                        className="flex-1 h-1 rounded appearance-none cursor-pointer"
                        style={{ accentColor: "#ef4444" }}
                      />
                      <span className="text-white/40 text-[10px] w-8 text-right font-mono">{c.penalty}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Add constraint form */}
              {showAddForm ? (
                <div
                  className="rounded-xl p-3 flex flex-col gap-2"
                  style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <input
                    type="text" placeholder="Label (optional)"
                    value={newConstraint.label}
                    onChange={(e) => setNewConstraint((p) => ({ ...p, label: e.target.value }))}
                    className="w-full rounded-lg px-2 py-1 text-[11px] outline-none"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                  />
                  {/* LHS terms */}
                  <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">Left side (LHS)</div>
                  {newConstraint.lhs.map((term, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input type="number" value={term.coeff} step={0.01}
                        onChange={(e) => setNewConstraint((p) => { const lhs = [...p.lhs]; lhs[i] = { ...lhs[i], coeff: parseFloat(e.target.value) || 1 }; return { ...p, lhs }; })}
                        className="w-14 rounded px-1.5 py-1 text-[11px] font-mono outline-none"
                        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                      />
                      <span className="text-white/30 text-[11px]">×</span>
                      <select value={term.col}
                        onChange={(e) => setNewConstraint((p) => { const lhs = [...p.lhs]; lhs[i] = { ...lhs[i], col: e.target.value }; return { ...p, lhs }; })}
                        className="flex-1 rounded px-1.5 py-1 text-[11px] outline-none"
                        style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                      >
                        <option value="">— column —</option>
                        {featureCols.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {newConstraint.lhs.length > 1 && (
                        <button onClick={() => setNewConstraint((p) => ({ ...p, lhs: p.lhs.filter((_, j) => j !== i) }))} className="text-white/20 hover:text-red-400"><Trash2 size={10} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setNewConstraint((p) => ({ ...p, lhs: [...p.lhs, { col: "", coeff: 1 }] }))}
                    className="text-[10px] text-white/30 hover:text-white/50 flex items-center gap-1"><Plus size={10} /> Add term</button>

                  {/* Operator */}
                  <div className="flex gap-2">
                    {(["lt", "gt"] as const).map((op) => (
                      <button key={op} onClick={() => setNewConstraint((p) => ({ ...p, op }))}
                        className="flex-1 py-1 rounded text-[11px] font-bold transition-all"
                        style={{
                          background: newConstraint.op === op ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${newConstraint.op === op ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
                          color: newConstraint.op === op ? "#f87171" : "rgba(255,255,255,0.3)",
                        }}
                      >{op === "lt" ? "< (less than)" : "> (greater than)"}</button>
                    ))}
                  </div>

                  {/* RHS terms */}
                  <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">Right side (RHS)</div>
                  {newConstraint.rhs.map((term, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input type="number" value={term.coeff} step={0.01}
                        onChange={(e) => setNewConstraint((p) => { const rhs = [...p.rhs]; rhs[i] = { ...rhs[i], coeff: parseFloat(e.target.value) || 1 }; return { ...p, rhs }; })}
                        className="w-14 rounded px-1.5 py-1 text-[11px] font-mono outline-none"
                        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                      />
                      <span className="text-white/30 text-[11px]">×</span>
                      <select value={term.col}
                        onChange={(e) => setNewConstraint((p) => { const rhs = [...p.rhs]; rhs[i] = { ...rhs[i], col: e.target.value }; return { ...p, rhs }; })}
                        className="flex-1 rounded px-1.5 py-1 text-[11px] outline-none"
                        style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                      >
                        <option value="">— column —</option>
                        {featureCols.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {newConstraint.rhs.length > 1 && (
                        <button onClick={() => setNewConstraint((p) => ({ ...p, rhs: p.rhs.filter((_, j) => j !== i) }))} className="text-white/20 hover:text-red-400"><Trash2 size={10} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setNewConstraint((p) => ({ ...p, rhs: [...p.rhs, { col: "", coeff: 1 }] }))}
                    className="text-[10px] text-white/30 hover:text-white/50 flex items-center gap-1"><Plus size={10} /> Add term</button>
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-[10px]">Constant</span>
                    <input type="number" value={newConstraint.rhs_const} step={0.1}
                      onChange={(e) => setNewConstraint((p) => ({ ...p, rhs_const: parseFloat(e.target.value) || 0 }))}
                      className="w-20 rounded px-1.5 py-1 text-[11px] font-mono outline-none"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                    />
                  </div>

                  {/* Penalty */}
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-[10px] w-12 shrink-0">Penalty</span>
                    <input type="range" min={1} max={200} step={1} value={newConstraint.penalty}
                      onChange={(e) => setNewConstraint((p) => ({ ...p, penalty: Number(e.target.value) }))}
                      className="flex-1 h-1 rounded appearance-none cursor-pointer" style={{ accentColor: "#ef4444" }}
                    />
                    <span className="text-white/40 text-[10px] w-8 text-right font-mono">{newConstraint.penalty}</span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        const valid = newConstraint.lhs.some((t) => t.col) && newConstraint.rhs.some((t) => t.col);
                        if (!valid) { toast.error("Add at least one column on each side"); return; }
                        setConstraints((prev) => [...prev, { ...newConstraint, id: Math.random().toString(36).slice(2) }]);
                        setNewConstraint({ label: "", lhs: [{ col: "", coeff: 1 }], op: "lt", rhs: [{ col: "", coeff: 1 }], rhs_const: 0, penalty: 10, enabled: true });
                        setShowAddForm(false);
                      }}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                    >Add</button>
                    <button onClick={() => setShowAddForm(false)}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-1.5 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-all hover:bg-white/5"
                  style={{ border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}
                >
                  <Plus size={11} />
                  Add constraint
                </button>
              )}
            </div>
          )}
        </div>

        {/* Hyperparams */}
        <div className="mb-6">
          <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-3">
            Optimizer Settings
          </p>

          {/* Optimizer algorithm */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/40 text-[11px]">Algorithm</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(["adam", "lbfgs"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setOptimizer(opt)}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: optimizer === opt ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${optimizer === opt ? "rgba(6,182,212,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: optimizer === opt ? "#06b6d4" : "rgba(255,255,255,0.3)",
                  }}
                >
                  <Zap size={10} />
                  {opt === "adam" ? "Adam" : "L-BFGS"}
                </button>
              ))}
            </div>
            <p className="text-white/20 text-[10px] mt-1 px-0.5">
              {optimizer === "lbfgs"
                ? "L-BFGS: high-precision second-order, ideal for smooth surrogates"
                : "Adam: adaptive first-order, fast general purpose"}
            </p>
          </div>

          {/* Constraint method */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/40 text-[11px]">Constraint Method</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(["augmented_lagrangian", "penalty"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setConstraintMethod(m)}
                  className="py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: constraintMethod === m ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${constraintMethod === m ? "rgba(239,68,68,0.28)" : "rgba(255,255,255,0.08)"}`,
                    color: constraintMethod === m ? "#f87171" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {m === "augmented_lagrangian" ? "Aug. Lagrangian" : "Penalty"}
                </button>
              ))}
            </div>
          </div>

          {/* Multi-start */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/40 text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <GitBranch size={10} />
                  Multi-Start Runs
                </span>
              </span>
              <span className="text-white/60 text-[11px] font-mono">{nStarts}</span>
            </div>
            <input
              type="range"
              min={1} max={10} step={1}
              value={nStarts}
              onChange={(e) => setNStarts(parseInt(e.target.value))}
              className="w-full h-1 rounded appearance-none cursor-pointer"
              style={{ accentColor: "#8b5cf6" }}
            />
            <div className="flex justify-between text-white/20 text-[10px] mt-0.5">
              <span>1 (fast)</span><span>10 (robust)</span>
            </div>
          </div>

          {/* n_steps */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/40 text-[11px]">Steps</span>
              <span className="text-white/60 text-[11px] font-mono">{nSteps}</span>
            </div>
            <input
              type="range"
              min={50}
              max={1000}
              step={50}
              value={nSteps}
              onChange={(e) => setNSteps(parseInt(e.target.value))}
              className="w-full h-1 rounded appearance-none cursor-pointer"
              style={{ accentColor: "#06b6d4" }}
            />
            <div className="flex justify-between text-white/20 text-[10px] mt-0.5">
              <span>50</span><span>1000</span>
            </div>
          </div>

          {/* lr */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/40 text-[11px]">Learning Rate</span>
              <span className="text-white/60 text-[11px] font-mono">{lr.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min={0.001}
              max={0.5}
              step={0.001}
              value={lr}
              onChange={(e) => setLr(parseFloat(e.target.value))}
              className="w-full h-1 rounded appearance-none cursor-pointer"
              style={{ accentColor: "#06b6d4" }}
            />
            <div className="flex justify-between text-white/20 text-[10px] mt-0.5">
              <span>0.001</span><span>0.5</span>
            </div>
          </div>

          {/* Early stopping */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/40 text-[11px]">Early Stopping</span>
              <button
                onClick={() => setEarlyStop((v) => !v)}
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all"
                style={{
                  background: earlyStop ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${earlyStop ? "rgba(6,182,212,0.3)" : "rgba(255,255,255,0.08)"}`,
                  color: earlyStop ? "#06b6d4" : "rgba(255,255,255,0.3)",
                }}
              >
                {earlyStop ? "ON" : "OFF"}
              </button>
            </div>
            {earlyStop && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white/30 text-[10px]">Patience</span>
                  <span className="text-white/50 text-[10px] font-mono">{patience} steps</span>
                </div>
                <input
                  type="range" min={5} max={50} step={5}
                  value={patience}
                  onChange={(e) => setPatience(parseInt(e.target.value))}
                  className="w-full h-1 rounded appearance-none cursor-pointer"
                  style={{ accentColor: "#06b6d4" }}
                />
              </>
            )}
          </div>
        </div>

        {/* Solve button */}
        <button
          onClick={handleSolve}
          disabled={solving}
          className="w-full rounded-xl py-3 flex items-center justify-center gap-2 font-semibold text-[13px] transition-all active:scale-95"
          style={{
            background: solving
              ? "rgba(6,182,212,0.15)"
              : "linear-gradient(135deg, rgba(6,182,212,0.25) 0%, rgba(139,92,246,0.2) 100%)",
            border: "1px solid rgba(6,182,212,0.3)",
            color: solving ? "rgba(6,182,212,0.5)" : "#06b6d4",
            boxShadow: solving ? "none" : "0 0 20px rgba(6,182,212,0.15)",
            cursor: solving ? "not-allowed" : "pointer",
          }}
        >
          {solving ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Optimizing…
            </>
          ) : (
            <>
              <Play size={14} />
              Solve
            </>
          )}
        </button>

        {result && (
          <button
            onClick={() => setResult(null)}
            className="mt-2 w-full rounded-xl py-2 flex items-center justify-center gap-2 text-[11px] transition-all hover:bg-white/5"
            style={{
              color: "rgba(255,255,255,0.3)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <RotateCcw size={11} />
            Clear result
          </button>
        )}
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "20px 24px" }}>

        {/* Empty state */}
        {!result && !solving && (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{
                  background: "radial-gradient(circle, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 70%)",
                  border: "1px solid rgba(6,182,212,0.12)",
                  boxShadow: "0 0 40px rgba(6,182,212,0.06)",
                }}
              >
                <Compass size={32} style={{ color: "rgba(6,182,212,0.35)" }} />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-white/35 text-[14px] font-medium">Set targets and click Solve</p>
                <p className="text-white/20 text-[11px] max-w-xs">
                  Gradient descent on the input space will find feature values that produce your desired outputs.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Solving spinner */}
        {solving && (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-full"
                  style={{ border: "2px solid rgba(6,182,212,0.1)" }}
                />
                <div
                  className="absolute inset-0 rounded-full animate-spin"
                  style={{
                    border: "2px solid transparent",
                    borderTopColor: "#06b6d4",
                    borderRightColor: "rgba(6,182,212,0.4)",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Compass size={22} style={{ color: "#06b6d4" }} />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-[13px] font-semibold" style={{ color: "#06b6d4" }}>
                  Optimizing…
                </p>
                <p className="text-white/30 text-[11px]">
                  {nStarts > 1 ? `${nStarts} starts × ` : ""}{nSteps} steps · {optimizer.toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !solving && (
          <div className="flex flex-col gap-6">

            {/* Summary pills */}
            <div className="flex flex-wrap gap-2">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", color: "#06b6d4" }}
              >
                <TrendingDown size={12} />
                Loss: {result.final_loss?.toFixed(6) ?? "—"}
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#8b5cf6" }}
              >
                {result.n_steps} steps
              </div>
              {result.n_starts_used != null && result.n_starts_used > 1 && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                  style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)", color: "#c4b5fd" }}
                >
                  <GitBranch size={11} />
                  {result.n_starts_used} starts
                </div>
              )}
              {typeof result.convergence_rate === "number" && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                  style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", color: "rgba(6,182,212,0.7)" }}
                >
                  <Activity size={11} />
                  Conv: {result.convergence_rate.toExponential(2)}/step
                </div>
              )}
              {result.constraint_violations && result.constraint_violations.length > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                  style={{
                    background: result.constraint_violations.every((v) => v.satisfied)
                      ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    border: `1px solid ${result.constraint_violations.every((v) => v.satisfied) ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                    color: result.constraint_violations.every((v) => v.satisfied) ? "#4ade80" : "#f87171",
                  }}
                >
                  {result.constraint_violations.every((v) => v.satisfied)
                    ? <ShieldCheck size={13} />
                    : <ShieldAlert size={13} />}
                  {result.constraint_violations.filter((v) => v.satisfied).length}/{result.constraint_violations.length} constraints OK
                </div>
              )}
            </div>

            {/* Result tab selector */}
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {([
                { id: "overview" as const, label: "Overview", icon: <Target size={11} /> },
                { id: "sensitivity" as const, label: "Sensitivity", icon: <Activity size={11} />, disabled: !result.sensitivity || Object.keys(result.sensitivity).length === 0 },
                { id: "starts" as const, label: "Multi-Start", icon: <GitBranch size={11} />, disabled: !result.all_starts || result.all_starts.length <= 1 },
              ]).map(({ id, label, icon, disabled }) => (
                <button
                  key={id}
                  onClick={() => !disabled && setResultTab(id)}
                  disabled={disabled}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-all"
                  style={{
                    background: resultTab === id ? "rgba(6,182,212,0.12)" : "transparent",
                    borderBottom: resultTab === id ? "2px solid #06b6d4" : "2px solid transparent",
                    color: disabled ? "rgba(255,255,255,0.15)" : resultTab === id ? "#06b6d4" : "rgba(255,255,255,0.4)",
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* OVERVIEW TAB */}
            {resultTab === "overview" && (<>

            {/* Convergence chart — dual axis: loss + grad norm */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <span className="text-white/60 text-[12px] font-semibold">Convergence</span>
                <span className="text-white/25 text-[11px]">— loss + gradient norm over steps</span>
              </div>
              <Plot
                data={[
                  {
                    x: result.loss_history.map((_, i) => i),
                    y: result.loss_history,
                    type: "scatter",
                    mode: "lines",
                    name: "Loss",
                    line: { color: "#06b6d4", width: 2, shape: "spline" },
                    fill: "tozeroy",
                    fillcolor: "rgba(6,182,212,0.06)",
                  },
                  ...(result.grad_norm_history && result.grad_norm_history.length > 0 ? [{
                    x: result.grad_norm_history.map((_, i) => i),
                    y: result.grad_norm_history,
                    type: "scatter" as const,
                    mode: "lines" as const,
                    name: "‖∇x‖",
                    yaxis: "y2",
                    line: { color: "rgba(139,92,246,0.6)", width: 1, dash: "dot" as const },
                    opacity: 0.7,
                  }] : []),
                ]}
                layout={{
                  height: 200,
                  margin: { t: 8, b: 32, l: 48, r: 48 },
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                  font: { family: "inherit", size: 10, color: "rgba(255,255,255,0.3)" },
                  legend: { x: 0.01, y: 0.99, bgcolor: "transparent", font: { size: 9, color: "rgba(255,255,255,0.4)" } },
                  xaxis: {
                    gridcolor: "rgba(255,255,255,0.04)",
                    zeroline: false,
                    tickfont: { size: 10, color: "rgba(255,255,255,0.25)" },
                    title: { text: "Step", font: { size: 10 } },
                  },
                  yaxis: {
                    gridcolor: "rgba(255,255,255,0.04)",
                    zeroline: false,
                    tickfont: { size: 10, color: "rgba(255,255,255,0.25)" },
                    title: { text: "Loss", font: { size: 10, color: "#06b6d4" } },
                  },
                  yaxis2: {
                    overlaying: "y",
                    side: "right",
                    gridcolor: "transparent",
                    zeroline: false,
                    tickfont: { size: 9, color: "rgba(139,92,246,0.5)" },
                    title: { text: "‖∇x‖", font: { size: 9, color: "rgba(139,92,246,0.5)" } },
                  },
                } as never}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%" }}
              />
            </div>

            {/* Per-target error table */}
            {result.per_target_errors && Object.keys(result.per_target_errors).length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
                  <span className="text-white/60 text-[12px] font-semibold">Per-Target Error Report</span>
                </div>
                <div className="p-4">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-white/30 font-semibold">
                        <th className="text-left pb-2">Target</th>
                        <th className="text-right pb-2">Desired</th>
                        <th className="text-right pb-2">Achieved</th>
                        <th className="text-right pb-2">Abs Err</th>
                        <th className="text-right pb-2">Rel %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.per_target_errors).map(([col, e]) => {
                        const errColor = e.rel_error_pct < 5 ? "#22c55e" : e.rel_error_pct < 20 ? "#f59e0b" : "#ef4444";
                        return (
                          <tr key={col} className="border-t border-white/[0.04]">
                            <td className="py-1.5 text-white/60 font-mono truncate max-w-[100px]" title={col}>{col}</td>
                            <td className="py-1.5 text-right text-white/50 font-mono">{e.desired.toFixed(4)}</td>
                            <td className="py-1.5 text-right font-mono" style={{ color: errColor }}>{e.achieved.toFixed(4)}</td>
                            <td className="py-1.5 text-right text-white/40 font-mono">{e.abs_error.toExponential(3)}</td>
                            <td className="py-1.5 text-right font-bold font-mono" style={{ color: errColor }}>{e.rel_error_pct.toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Constraint violations */}
            {result.constraint_violations && result.constraint_violations.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="px-4 pt-4 pb-3 border-b border-white/[0.04] flex items-center justify-between">
                  <span className="text-white/60 text-[12px] font-semibold">Physical Constraints</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: result.constraint_violations.every((v) => v.satisfied)
                        ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: result.constraint_violations.every((v) => v.satisfied) ? "#4ade80" : "#f87171",
                    }}
                  >
                    {result.constraint_violations.filter((v) => v.satisfied).length}/{result.constraint_violations.length} satisfied
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  {result.constraint_violations.map((v, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        {v.satisfied
                          ? <ShieldCheck size={14} style={{ color: "#4ade80" }} />
                          : <ShieldAlert size={14} style={{ color: "#f87171" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className="text-[11px] font-medium truncate"
                            style={{ color: v.satisfied ? "#e2e8f0" : "#fca5a5" }}
                            title={v.label || undefined}
                          >
                            {v.label || `${v.lhs_val.toFixed(3)} ${v.op === "lt" ? "<" : ">"} ${v.rhs_val.toFixed(3)}`}
                          </span>
                          <span
                            className="text-[10px] font-mono shrink-0"
                            style={{ color: v.satisfied ? "#4ade80" : "#f87171" }}
                          >
                            margin {v.margin >= 0 ? "+" : ""}{v.margin.toFixed(3)}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {v.lhs_val.toFixed(4)} {v.op === "lt" ? "<" : ">"} {v.rhs_val.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Achieved vs Desired */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
                <span className="text-white/60 text-[12px] font-semibold">Achieved vs Desired</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {result.target_cols.map((col) => {
                  const desired = result.desired_outputs[col];
                  const achieved = result.final_outputs[col];
                  if (desired == null) return null;
                  const err = Math.abs(achieved - desired);
                  const relErr = Math.abs(desired) > 1e-6 ? err / Math.abs(desired) : err;
                  const color =
                    relErr < 0.05 ? "#22c55e"
                    : relErr < 0.2 ? "#f59e0b"
                    : "#ef4444";
                  return (
                    <div key={col}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-white/50 text-[11px] truncate" style={{ maxWidth: 160 }}>{col}</span>
                        <span
                          className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: `${color}18`, color }}
                        >
                          Δ {err < 0.001 ? err.toExponential(2) : err.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Desired bar */}
                        <div
                          className="h-4 rounded-l flex items-center justify-end pr-1.5"
                          style={{
                            flex: 1,
                            background: "rgba(255,255,255,0.06)",
                            fontSize: 10,
                            color: "rgba(255,255,255,0.5)",
                            fontFamily: "monospace",
                          }}
                        >
                          {desired.toFixed(3)}
                        </div>
                        <ArrowRight size={10} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                        {/* Achieved bar */}
                        <div
                          className="h-4 rounded-r flex items-center pl-1.5"
                          style={{
                            flex: 1,
                            background: `${color}18`,
                            border: `1px solid ${color}33`,
                            fontSize: 10,
                            color,
                            fontFamily: "monospace",
                          }}
                        >
                          {achieved.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Found inputs */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="px-4 pt-4 pb-3 border-b border-white/[0.04] flex items-center justify-between">
                <span className="text-white/60 text-[12px] font-semibold">Found Inputs</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/25 text-[11px] mr-1">{result.feature_cols.length} features</span>
                  {(["csv", "json"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => downloadResult(fmt)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:bg-white/8"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
                    >
                      <Download size={10} />
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:bg-white/8 ml-1"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}
                  >
                    <FileText size={10} />
                    Export PDF
                  </button>
                  <button
                    onClick={handleSaveSolution}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:bg-white/8 ml-1"
                    style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" }}
                  >
                    <BookMarked size={10} />
                    Save Server
                  </button>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2">
                {result.feature_cols.map((col) => {
                  const finalVal = result.final_features[col];
                  const delta = result.feature_deltas[col];
                  const isLocked = !!lockedFeatures[col];
                  const sign = delta >= 0 ? "+" : "";
                  const pct =
                    Math.abs(finalVal - delta) > 1e-6
                      ? ((delta / Math.abs(finalVal - delta)) * 100).toFixed(1)
                      : "0.0";
                  const deltaColor =
                    Math.abs(delta) < 1e-6
                      ? "rgba(255,255,255,0.2)"
                      : delta > 0
                      ? "#22c55e"
                      : "#ef4444";
                  return (
                    <div
                      key={col}
                      className="rounded-xl p-2.5"
                      style={{
                        background: isLocked ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isLocked ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium truncate" style={{ color: "rgba(255,255,255,0.45)", maxWidth: 100 }} title={col}>{col}</span>
                        {isLocked && <Lock size={9} style={{ color: "#f59e0b", flexShrink: 0 }} />}
                      </div>
                      <div className="text-[13px] font-mono font-semibold mb-0.5" style={{ color: "#e2e8f0" }}>{finalVal.toFixed(4)}</div>
                      <div className="text-[10px] font-semibold font-mono" style={{ color: deltaColor }}>{sign}{delta.toFixed(4)} ({sign}{pct}%)</div>
                    </div>
                  );
                })}
              </div>
            </div>

            </>)} {/* end overview tab */}

            {/* SENSITIVITY TAB */}
            {resultTab === "sensitivity" && result.sensitivity && Object.keys(result.sensitivity).length > 0 && (
              <div className="flex flex-col gap-4">
                <div
                  className="rounded-2xl p-3"
                  style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}
                >
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Sensitivity shows <strong className="text-white/60">∂output / ∂input</strong> at the solution point, normalised row-wise.
                    Values near 1 indicate the input has the strongest influence on that output.
                  </p>
                </div>
                {Object.entries(result.sensitivity).map(([targetCol, sensMap]) => {
                  const sorted = Object.entries(sensMap).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 15);
                  return (
                    <div key={targetCol}
                      className="rounded-2xl overflow-hidden"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="px-4 pt-3 pb-1 border-b border-white/[0.04] flex items-center gap-2">
                        <span className="text-white/60 text-[12px] font-semibold">Sensitivity → {targetCol}</span>
                      </div>
                      <Plot
                        data={[{
                          type: "bar",
                          orientation: "h",
                          y: sorted.map(([f]) => f),
                          x: sorted.map(([, v]) => v),
                          marker: {
                            color: sorted.map(([, v]) =>
                              v > 0.6 ? "#8b5cf6" : v > 0.3 ? "#06b6d4" : "rgba(255,255,255,0.2)"
                            ),
                            opacity: 0.85,
                          },
                          hovertemplate: "%{y}: %{x:.4f}<extra></extra>",
                        } as never]}
                        layout={{
                          height: Math.max(160, sorted.length * 24 + 50),
                          margin: { t: 8, b: 28, l: 120, r: 16 },
                          paper_bgcolor: "transparent",
                          plot_bgcolor: "transparent",
                          font: { size: 10, color: "rgba(255,255,255,0.4)" },
                          xaxis: {
                            gridcolor: "rgba(255,255,255,0.04)",
                            zeroline: true,
                            zerolinecolor: "rgba(255,255,255,0.1)",
                            range: [0, 1.05],
                            title: { text: "Normalised sensitivity", font: { size: 9 } },
                          },
                          yaxis: { autorange: "reversed" as const, tickfont: { size: 10 } },
                        } as never}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: "100%" }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* MULTI-START TAB */}
            {resultTab === "starts" && result.all_starts && result.all_starts.length > 1 && (
              <div className="flex flex-col gap-3">
                <div
                  className="rounded-2xl p-3"
                  style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}
                >
                  <p className="text-[11px] text-white/40">
                    {result.all_starts.length} independent runs from different LHS-sampled starting points.
                    The run with the lowest final loss was selected.
                  </p>
                </div>
                {result.all_starts.map((s) => (
                  <div
                    key={s.start_idx}
                    className="rounded-2xl p-4"
                    style={{
                      background: s.is_best ? "rgba(139,92,246,0.08)" : "rgba(0,0,0,0.3)",
                      border: `1px solid ${s.is_best ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {s.is_best
                        ? <Star size={13} style={{ color: "#8b5cf6", fill: "#8b5cf6" }} />
                        : <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: "rgba(255,255,255,0.1)" }} />}
                      <span className="text-[12px] font-semibold" style={{ color: s.is_best ? "#c4b5fd" : "rgba(255,255,255,0.5)" }}>
                        Start {s.start_idx + 1} {s.is_best && "· Best"}
                      </span>
                      <div className="ml-auto flex items-center gap-3">
                        <span className="text-[11px] font-mono" style={{ color: s.is_best ? "#06b6d4" : "rgba(255,255,255,0.35)" }}>
                          loss: {s.final_loss?.toFixed(6)}
                        </span>
                        <span className="text-[11px] text-white/30">{s.steps_taken} steps</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(s.final_outputs).map(([col, val]) => (
                        <div key={col} className="flex items-center justify-between rounded-lg px-2 py-1"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          <span className="text-[10px] text-white/40 truncate" title={col}>{col}</span>
                          <span className="text-[11px] font-mono text-white/70 ml-2">{(val as number).toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
