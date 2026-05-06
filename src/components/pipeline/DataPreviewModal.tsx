"use client";

import { useEffect, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { X, AlertCircle, Database, Filter, Columns2, Eraser, BarChart2, Scissors, Brain, LineChart } from "lucide-react";
import { NODE_META, type NodeKind } from "./nodeTypes";
import type { NodeResult } from "@/lib/api";

import { exportPipelineModel, API_BASE } from "@/lib/api";
import { DJANGO_API_BASE, fetchWithAuth } from "@/lib/auth";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const ICON_MAP: Record<string, React.ElementType> = {
  Database, Filter, Columns2, Eraser, BarChart2, Scissors, Brain, LineChart,
};

interface DataPreviewModalProps {
  nodeKind: NodeKind;
  nodeLabel?: string;
  result: NodeResult;
  onClose: () => void;
}

// ── Data table ────────────────────────────────────────────────────────────────
function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <p className="text-white/30 text-sm p-4">No rows to display.</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-auto flex-1 custom-scrollbar">
      <table className="text-[12px] border-collapse w-full" style={{ minWidth: "max-content" }}>
        <thead
          className="sticky top-0 z-10"
          style={{ background: "#182030" }}
        >
          <tr>
            <th className="px-3 py-2 text-white/30 font-semibold border-b border-white/10 text-right w-10">#</th>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-white/50 font-semibold border-b border-white/10 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="px-3 py-1.5 text-white/20 text-right">{i + 1}</td>
              {cols.map((c) => (
                <td key={c} className="px-3 py-1.5 text-white/70 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                  {row[c] == null ? <span className="text-white/20 italic">null</span> : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, color = "#17C2D7" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-[#182030] rounded-xl p-4 text-center flex flex-col gap-1">
      <div className="font-bold text-lg" style={{ color }}>{value}</div>
      <div className="text-white/40 text-[11px] uppercase tracking-widest">{label}</div>
    </div>
  );
}

// ── Charts section ────────────────────────────────────────────────────────────
function ModelCharts({ result, nodeKind, nodeId }: { result: NodeResult; nodeKind: string; nodeId: string }) {
  const { metrics, confusion_matrix, roc_curve, feature_importance, residuals, train_rows, test_rows } = result;

  return (
    <div className="space-y-6 p-4">
      {/* Save Checkpoint / Export Buttons for Neural Networks */}
      {nodeKind === "trainNeuralNetwork" && (
        <div className="flex items-center gap-3 bg-[#182030] p-4 rounded-xl border border-white/5">
          <button
            onClick={() => {
              const name = window.prompt("Enter checkpoint name:", "pipeline_checkpoint") || "pipeline_checkpoint";
              fetchWithAuth(`${API_BASE}/api/nn/checkpoint/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
              })
                .then(res => res.json())
                .then(data => alert("Checkpoint saved: " + data.filename))
                .catch(e => alert("Save failed: " + e.message));
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-bold transition-all bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20"
          >
            Save PyTorch Checkpoint
          </button>
          <button
            onClick={() => exportPipelineModel(nodeId, "onnx").catch((e) => alert(`Export failed: ${e.message}`))}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-bold transition-all bg-[#17C2D7]/10 border border-[#17C2D7]/30 text-[#17C2D7] hover:bg-[#17C2D7]/20"
          >
            Export ONNX Model
          </button>
        </div>
      )}
      {/* Classification metrics */}
      {metrics && (metrics.task === "classification" || (!metrics.task && metrics.accuracy != null)) && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.accuracy != null && (
              <MetricCard label="Accuracy" value={`${(metrics.accuracy * 100).toFixed(2)}%`} color="#E83E8C" />
            )}
            {metrics.f1 != null && (
              <MetricCard label="F1 Score" value={metrics.f1.toFixed(4)} color="#17C2D7" />
            )}
            {metrics.target && (
              <MetricCard label="Target" value={metrics.target} color="#F39C12" />
            )}
            {metrics.algorithm && (
              <MetricCard label="Algorithm" value={metrics.algorithm.replace(/_/g, " ")} color="#9367B4" />
            )}
          </div>
        </>
      )}

      {/* Regression metrics */}
      {metrics && metrics.task === "regression" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.r2 != null && <MetricCard label="R²" value={metrics.r2.toFixed(4)} color="#17C2D7" />}
          {metrics.rmse != null && <MetricCard label="RMSE" value={metrics.rmse.toFixed(4)} color="#F39C12" />}
          {metrics.mse != null && <MetricCard label="MSE" value={metrics.mse.toFixed(4)} color="#28a745" />}
          {metrics.target && <MetricCard label="Target" value={metrics.target} color="#9367B4" />}
          {metrics.algorithm && <MetricCard label="Algorithm" value={metrics.algorithm.replace(/_/g, " ")} color="#007bff" />}
        </div>
      )}

      {/* Clustering metrics */}
      {metrics && metrics.task === "clustering" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.n_clusters_found != null && <MetricCard label="Clusters found" value={metrics.n_clusters_found} color="#9367B4" />}
          {metrics.silhouette != null && <MetricCard label="Silhouette" value={metrics.silhouette.toFixed(3)} color="#17C2D7" />}
          {metrics.inertia != null && <MetricCard label="Inertia" value={metrics.inertia.toFixed(2)} color="#F39C12" />}
          {metrics.algorithm && <MetricCard label="Algorithm" value={metrics.algorithm.replace(/_/g, " ")} color="#007bff" />}
        </div>
      )}

      {/* Train / Test split */}
      {train_rows != null && (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Train rows" value={train_rows.toLocaleString()} color="#28a745" />
          <MetricCard label="Test rows" value={(test_rows ?? 0).toLocaleString()} color="#F39C12" />
        </div>
      )}

      {/* Confusion matrix */}
      {confusion_matrix && (
        <div>
          <SectionHeader>Confusion Matrix</SectionHeader>
          <Plot
            data={[{
              type: "heatmap",
              z: confusion_matrix.matrix,
              x: confusion_matrix.labels,
              y: confusion_matrix.labels,
              colorscale: [[0, "#182030"], [1, "#E83E8C"]],
              showscale: true,
              text: confusion_matrix.matrix.map(row => row.map(String)) as unknown as string[],
              texttemplate: "%{text}",
              hovertemplate: "Actual: %{y}<br>Predicted: %{x}<br>Count: %{z}<extra></extra>",
            } as never]}
            layout={{
              height: 320,
              margin: { t: 12, b: 60, l: 80, r: 16 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#182030",
              font: { color: "rgba(255,255,255,0.5)", size: 12 },
              xaxis: { title: { text: "Predicted" } },
              yaxis: { title: { text: "Actual" }, autorange: "reversed" },
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* ROC curve */}
      {roc_curve && (
        <div>
          <SectionHeader>ROC Curve — AUC: {roc_curve.auc.toFixed(4)}</SectionHeader>
          <Plot
            data={[
              {
                type: "scatter", mode: "lines",
                x: roc_curve.fpr, y: roc_curve.tpr,
                line: { color: "#17C2D7", width: 2 },
                name: `AUC = ${roc_curve.auc.toFixed(3)}`,
              },
              {
                type: "scatter", mode: "lines",
                x: [0, 1], y: [0, 1],
                line: { color: "rgba(255,255,255,0.2)", width: 1, dash: "dash" },
                showlegend: false,
              },
            ] as never[]}
            layout={{
              height: 300,
              margin: { t: 12, b: 50, l: 50, r: 16 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#182030",
              font: { color: "rgba(255,255,255,0.4)", size: 11 },
              xaxis: { title: { text: "FPR" }, range: [0, 1], gridcolor: "rgba(255,255,255,0.05)" },
              yaxis: { title: { text: "TPR" }, range: [0, 1], gridcolor: "rgba(255,255,255,0.05)" },
              showlegend: false,
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Feature importance */}
      {feature_importance && (
        <div>
          <SectionHeader>Feature Importance</SectionHeader>
          <Plot
            data={[{
              type: "bar", orientation: "h",
              y: feature_importance.features,
              x: feature_importance.importances,
              marker: { color: "#28a745", opacity: 0.85 },
            } as never]}
            layout={{
              height: Math.max(160, feature_importance.features.length * 32 + 60),
              margin: { t: 12, b: 36, l: 120, r: 16 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#182030",
              font: { color: "rgba(255,255,255,0.5)", size: 11 },
              xaxis: { gridcolor: "rgba(255,255,255,0.05)", zeroline: false },
              yaxis: { autorange: "reversed" },
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Residual plot */}
      {residuals && (
        <div>
          <SectionHeader>Residual Plot</SectionHeader>
          <Plot
            data={[{
              type: "scatter", mode: "markers",
              x: residuals.predicted, y: residuals.residuals,
              marker: { color: "#F39C12", opacity: 0.6, size: 5 },
              hovertemplate: "Predicted: %{x}<br>Residual: %{y}<extra></extra>",
            } as never, {
              type: "scatter", mode: "lines",
              x: [Math.min(...residuals.predicted), Math.max(...residuals.predicted)],
              y: [0, 0],
              line: { color: "rgba(255,255,255,0.3)", width: 1, dash: "dash" },
              showlegend: false,
            } as never]}
            layout={{
              height: 260,
              margin: { t: 12, b: 50, l: 60, r: 16 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#182030",
              font: { color: "rgba(255,255,255,0.4)", size: 11 },
              xaxis: { title: { text: "Predicted" }, gridcolor: "rgba(255,255,255,0.05)" },
              yaxis: { title: { text: "Residual" }, gridcolor: "rgba(255,255,255,0.05)", zeroline: false },
              showlegend: false,
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Embedded Chart (e.g., PCA from clustering) */}
      {result.chart && (
        <div>
          <SectionHeader>
            {result.chart.layout?.title?.toString() || "Visualization"}
          </SectionHeader>
          <Plot
            data={result.chart.traces as never[]}
            layout={{
              ...(result.chart.layout as object),
              height: 380,
              margin: { t: 20, b: 50, l: 60, r: 20 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#182030",
              font: { color: "rgba(255,255,255,0.5)", size: 11 },
              xaxis: { ...(result.chart.layout as Record<string, Record<string, unknown>>).xaxis, gridcolor: "rgba(255,255,255,0.05)" },
              yaxis: { ...(result.chart.layout as Record<string, Record<string, unknown>>).yaxis, gridcolor: "rgba(255,255,255,0.05)" },
              legend: { bgcolor: "transparent", font: { color: "rgba(255,255,255,0.5)", size: 10 } },
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] text-white/40 uppercase tracking-widest font-bold mb-3">
      {children}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
const MODEL_KINDS: NodeKind[] = ["trainModel", "clusterModel", "trainNeuralNetwork", "trainTestSplit", "visualizeOutput"];

export function DataPreviewModal({ nodeKind, result, onClose }: DataPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<"train" | "test">("train");

  // Multi-output custom Python: list of output names (in declaration order), or [] when not applicable
  const outputNames = result.outputs_meta ? Object.keys(result.outputs_meta) : [];
  const isMultiOutput = outputNames.length > 1;
  const [activeOutput, setActiveOutput] = useState<string>(outputNames[0] ?? "");

  const meta = NODE_META[nodeKind];
  const Icon = ICON_MAP[meta.iconName] ?? Database;
  const isModelNode = MODEL_KINDS.includes(nodeKind);
  const isChartNode = nodeKind === "visualizeOutput";

  // Which preview rows to display:
  //   • trainTestSplit → its hardcoded train/test tabs
  //   • multi-output customPython → the selected output's preview from outputs_meta
  //   • otherwise → result.preview
  const activeRows: Record<string, unknown>[] = (() => {
    if (nodeKind === "trainTestSplit") {
      return (activeTab === "test" ? result.test_preview : result.preview) ?? [];
    }
    if (isMultiOutput && result.outputs_meta && activeOutput in result.outputs_meta) {
      return result.outputs_meta[activeOutput].preview ?? [];
    }
    return result.preview ?? [];
  })();

  const hasTable = !isModelNode && !isChartNode && activeRows.length > 0;

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: "min(96vw, 1100px)",
          height: "min(90vh, 820px)",
          background: "#1a2030",
          border: `1px solid ${meta.color}44`,
          boxShadow: `0 0 60px ${meta.color}22, 0 24px 80px rgba(0,0,0,0.6)`,
          animation: "modalIn 0.18s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.96) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 shrink-0"
          style={{
            background: `linear-gradient(to right, ${meta.color}18, transparent)`,
            borderBottom: `1px solid ${meta.color}33`,
            borderLeft: `4px solid ${meta.color}`,
          }}
        >
          <Icon size={18} style={{ color: meta.color }} />
          <div className="flex-1">
            <div className="text-white font-semibold text-[15px]">{meta.label}</div>
            <div className="text-[11px] uppercase tracking-widest font-bold mt-0.5" style={{ color: meta.color }}>
              {meta.category}
            </div>
          </div>

          {/* Summary badge */}
          {result.rows != null && (
            <div className="text-[12px] text-white/40 bg-white/5 rounded-lg px-3 py-1">
              {result.rows.toLocaleString()} rows · {result.cols} cols
            </div>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error state */}
        {result.status === "error" && (
          <div className="flex items-start gap-3 m-4 p-4 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-[13px]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {result.error ?? "An error occurred."}
          </div>
        )}

        {/* Content — split: charts on left (model nodes), table always on right */}
        {result.status === "success" && (
          <div className={`flex flex-1 min-h-0 ${isModelNode ? "divide-x divide-white/5" : ""}`}>

            {/* Left: model metrics + charts OR full chart for visualizeOutput */}
            {isChartNode && result.chart ? (
              <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar">
                <SectionHeader>
                  {result.chart.chart_type.charAt(0).toUpperCase() + result.chart.chart_type.slice(1)} Chart
                </SectionHeader>
                <Plot
                  data={result.chart.traces as never[]}
                  layout={{
                    ...(result.chart.layout as object),
                    height: 520,
                    autosize: true,
                    margin: { t: 20, b: 60, l: 60, r: 20 },
                    paper_bgcolor: "transparent",
                    plot_bgcolor: "#182030",
                    font: { color: "rgba(255,255,255,0.5)", size: 12 },
                    xaxis: { ...(result.chart.layout as Record<string, Record<string, unknown>>).xaxis, gridcolor: "rgba(255,255,255,0.06)" },
                    yaxis: { ...(result.chart.layout as Record<string, Record<string, unknown>>).yaxis, gridcolor: "rgba(255,255,255,0.06)" },
                    legend: { bgcolor: "transparent", font: { color: "rgba(255,255,255,0.5)", size: 11 } },
                  } as never}
                  config={{ displayModeBar: true, displaylogo: false, responsive: true }}
                  style={{ width: "100%" }}
                />
              </div>
            ) : isModelNode && (
              <div className="flex-1 flex justify-center p-4 overflow-y-auto custom-scrollbar">
                <div className="w-full max-w-2xl">
                  {/* @ts-ignore nodeId should be passed properly but modal receives full result */}
                  <ModelCharts result={result} nodeKind={nodeKind} nodeId={(result as any).id || ""} />
                </div>
              </div>
            )}

            {/* Right: data table */}
            {hasTable && (
              <div className="flex-1 flex flex-col min-w-0">
                {nodeKind === "trainTestSplit" ? (
                  <div className="flex border-b border-white/5 shrink-0">
                    <button
                      onClick={() => setActiveTab("train")}
                      className="px-4 py-3 text-[11px] uppercase tracking-widest font-bold flex-1 border-b-2"
                      style={{
                        borderColor: activeTab === "train" ? meta.color : "transparent",
                        color: activeTab === "train" ? "#fff" : "rgba(255,255,255,0.4)",
                        background: activeTab === "train" ? "rgba(255,255,255,0.02)" : "transparent",
                      }}
                    >
                      Train Dataset ({(result.train_rows || result.rows || 0).toLocaleString()})
                    </button>
                    <button
                      onClick={() => setActiveTab("test")}
                      className="px-4 py-3 text-[11px] uppercase tracking-widest font-bold flex-1 border-b-2"
                      style={{
                        borderColor: activeTab === "test" ? meta.color : "transparent",
                        color: activeTab === "test" ? "#fff" : "rgba(255,255,255,0.4)",
                        background: activeTab === "test" ? "rgba(255,255,255,0.02)" : "transparent",
                      }}
                    >
                      Test Dataset ({(result.test_rows || 0).toLocaleString()})
                    </button>
                  </div>
                ) : isMultiOutput && result.outputs_meta ? (
                  <div className="flex border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
                    {outputNames.map((name) => {
                      const info = result.outputs_meta![name];
                      const isActive = activeOutput === name;
                      return (
                        <button
                          key={name}
                          onClick={() => setActiveOutput(name)}
                          className="px-4 py-3 text-[11px] uppercase tracking-widest font-bold border-b-2 whitespace-nowrap"
                          style={{
                            borderColor: isActive ? meta.color : "transparent",
                            color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
                            background: isActive ? "rgba(255,255,255,0.02)" : "transparent",
                          }}
                          title={`${info.rows} rows × ${info.cols} cols`}
                        >
                          {name} ({info.rows.toLocaleString()})
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 pt-3 pb-2 shrink-0 border-b border-white/5">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                      Dataset preview
                    </span>
                  </div>
                )}

                <DataTable rows={activeRows} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
