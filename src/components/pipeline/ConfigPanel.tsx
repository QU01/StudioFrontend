"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Settings2, Table2, AlertCircle, Target, Download, Expand, Loader2 } from "lucide-react";
import { exportPipelineModel, API_BASE, fetchDemoDatasets, loadDemoDataset, loadSavedDataset, type DemoDataset } from "@/lib/api";
import { DJANGO_API_BASE, fetchWithAuth } from "@/lib/auth";
import { agentDataLoaded } from "@/lib/agent-events";
import { CustomPythonEditorModal } from "./CustomPythonEditorModal";
import { type TrainConfig, TrainConfigModal } from "../neural/TrainConfigModal";
import { InverseDesignConfigModal } from "./InverseDesignConfigModal";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
import type { Node } from "@xyflow/react";
import { NODE_META, IO_PORT_COLORS, type NodeKind, type DatasetInfo, type IOPort, type IOContract, type IOPortType } from "./nodeTypes";
import type { PipelineNodeData } from "./nodes/PipelineNode";
import type { NodeResult } from "@/lib/api";

interface ConfigPanelProps {
  node: Node<PipelineNodeData> | null;
  columnNames: string[];
  numericColumns: string[];
  datasetInfo: DatasetInfo | null;
  onParamsChange: (nodeId: string, params: Record<string, unknown>) => void;
}

const selectClass =
  "w-full bg-[#1a2030] border border-white/10 rounded-md px-2.5 py-1.5 text-[13px] text-white/80 focus:outline-none focus:border-[#007bff] transition-colors";
const inputClass =
  "w-full bg-[#1a2030] border border-white/10 rounded-md px-2.5 py-1.5 text-[13px] text-white/80 focus:outline-none focus:border-[#007bff] transition-colors";

function LabeledRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-white/40 uppercase tracking-wider font-bold">{label}</label>
      {children}
    </div>
  );
}

function ColumnCheckboxes({
  allColumns, selected, onChange, accentColor = "#007bff",
}: {
  allColumns: string[];
  selected: string[];
  onChange: (cols: string[]) => void;
  accentColor?: string;
}) {
  if (allColumns.length === 0) {
    return <p className="text-[12px] text-white/30 italic">Load a dataset first</p>;
  }
  return (
    <div className="flex flex-col gap-1 max-h-44 overflow-y-auto custom-scrollbar pr-1">
      {allColumns.map((col) => {
        const checked = selected.includes(col);
        return (
          <label key={col} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                if (e.target.checked) onChange([...selected, col]);
                else onChange(selected.filter((c) => c !== col));
              }}
              style={{ accentColor }}
            />
            <span className="text-[12px] text-white/70 group-hover:text-white truncate">{col}</span>
          </label>
        );
      })}
    </div>
  );
}

function CustomPythonSection({
  params,
  onChange,
}: {
  params: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const set = (key: string, value: unknown) => onChange({ ...params, [key]: value });

  const contract = (params.io_contract as IOContract) ?? { inputs: [], outputs: [] };
  const portTypes: IOPortType[] = ["DataFrame", "NumpyArray", "TorchModel", "Dict", "Scalar", "Vocab", "Any"];

  const updatePort = (side: "inputs" | "outputs", idx: number, field: keyof IOPort, value: string) => {
    const ports = [...contract[side]];
    ports[idx] = { ...ports[idx], [field]: value };
    set("io_contract", { ...contract, [side]: ports });
  };
  const addPort = (side: "inputs" | "outputs") =>
    set("io_contract", { ...contract, [side]: [...contract[side], { name: `${side === "inputs" ? "in" : "out"}${contract[side].length + 1}`, type: "DataFrame" as IOPortType }] });
  const removePort = (side: "inputs" | "outputs", idx: number) =>
    set("io_contract", { ...contract, [side]: contract[side].filter((_, i) => i !== idx) });

  const PortList = ({ side }: { side: "inputs" | "outputs" }) => (
    <div className="space-y-1">
      {contract[side].map((port, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: IO_PORT_COLORS[port.type] ?? "#6c757d", flexShrink: 0, display: "inline-block" }} />
          <input
            className="flex-1 bg-[#1a2030] border border-white/10 rounded px-2 py-1 text-[12px] text-white/80 focus:outline-none focus:border-[#a855f7]"
            value={port.name}
            onChange={(e) => updatePort(side, idx, "name", e.target.value)}
            placeholder="name"
          />
          <select
            className="bg-[#1a2030] border border-white/10 rounded px-1 py-1 text-[11px] text-white/60 focus:outline-none focus:border-[#a855f7]"
            value={port.type}
            onChange={(e) => updatePort(side, idx, "type", e.target.value)}
          >
            {portTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => removePort(side, idx)} className="text-white/20 hover:text-red-400 text-[14px] px-1">×</button>
        </div>
      ))}
      <button
        onClick={() => addPort(side)}
        className="text-[11px] text-[#a855f7] hover:text-[#c084fc] mt-1"
      >
        + Add {side === "inputs" ? "input" : "output"}
      </button>
    </div>
  );

  return (
    <>
      <div className="space-y-3 flex flex-col h-full">
        <div className="grid grid-cols-2 gap-3">
          <LabeledRow label="Inputs"><PortList side="inputs" /></LabeledRow>
          <LabeledRow label="Outputs"><PortList side="outputs" /></LabeledRow>
        </div>
        <LabeledRow label="Timeout (s)">
          <input type="number" className={inputClass} min={5} max={600} value={Number(params.timeout ?? 60)} onChange={(e) => set("timeout", Number(e.target.value))} />
        </LabeledRow>
        <LabeledRow label="Python Code">
          <div className="relative" style={{ height: 180, border: "1px solid rgba(168,85,247,0.3)", borderRadius: 6, overflow: "hidden" }}>
            <MonacoEditor
              height="180px"
              language="python"
              theme="vs-dark"
              value={String(params.code ?? "")}
              onChange={(val) => set("code", val ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                tabSize: 4,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
            <button
              onClick={() => setModalOpen(true)}
              title="Open full editor"
              className="absolute top-1.5 right-1.5 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#a855f7] bg-[#1a2030]/90 border border-[#a855f7]/30 hover:border-[#a855f7]/70 hover:bg-[#a855f7]/10 transition-all z-10"
            >
              <Expand size={10} />
              Full Editor
            </button>
          </div>
        </LabeledRow>
        <div className="text-[10px] text-white/30 mt-1 leading-relaxed">
          Use <code className="text-[#a855f7]">inputs[&quot;name&quot;]</code> to read ports.
          Assign <code className="text-[#a855f7]">outputs = {"{"}...{"}"}</code> at end.
          Optionally set <code className="text-[#a855f7]">metrics</code> and <code className="text-[#a855f7]">chart</code>.
        </div>
      </div>

      {modalOpen && (
        <CustomPythonEditorModal
          nodeLabel="Custom Python"
          code={String(params.code ?? "")}
          ioContract={contract}
          timeout={Number(params.timeout ?? 60)}
          onSave={(newCode, newContract, newTimeout) => {
            onChange({ ...params, code: newCode, io_contract: newContract, timeout: newTimeout });
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function TrainNeuralNetworkSection({
  params,
  columnNames,
  onChange,
}: {
  params: Record<string, unknown>;
  columnNames: string[];
  onChange: (p: Record<string, unknown>) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const targetCols = (params.target_cols as string[]) ?? [];
  const singleTarget = String(params.target ?? "");
  const effectiveTargets = targetCols.length > 0 ? targetCols : (singleTarget ? [singleTarget] : []);

  // Sync params to TrainConfig locally in the modal
  const [internalConfig, setInternalConfig] = useState<TrainConfig>({
    target: singleTarget,
    target_cols: targetCols,
    feature_cols: (params.feature_cols as string[]) ?? [],
    task: String(params.task || "classification"),
    epochs: Number(params.epochs ?? 30),
    lr: Number(params.lr ?? 0.001),
    batch_size: Number(params.batch_size ?? 32),
  });

  const [architectures, setArchitectures] = useState<any[]>([]);
  const [loadingArchs, setLoadingArchs] = useState(false);
  const [loadingArchConfig, setLoadingArchConfig] = useState(false);

  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);

  useEffect(() => {
    setLoadingArchs(true);
    fetchWithAuth(`${DJANGO_API_BASE}/architectures/`)
      .then(res => res.json())
      .then(data => setArchitectures(data))
      .catch(console.error)
      .finally(() => setLoadingArchs(false));

    setLoadingCheckpoints(true);
    fetchWithAuth(`${API_BASE}/api/nn/checkpoints`)
      .then(res => res.json())
      .then(data => setCheckpoints(data.checkpoints || []))
      .catch(console.error)
      .finally(() => setLoadingCheckpoints(false));
  }, []);

  const handleArchChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const aid = e.target.value;
    if (!aid) {
      onChange({ ...params, architecture_id: null, nn_graph: null });
      return;
    }
    setLoadingArchConfig(true);
    try {
      const res = await fetchWithAuth(`${DJANGO_API_BASE}/architectures/${aid}/`);
      const full = await res.json();
      onChange({ 
        ...params, 
        architecture_id: aid, 
        nn_graph: { nodes: full.config?.nodes || [], edges: full.config?.edges || [] } 
      });
    } catch (err) {
      console.error("Failed to load architecture config", err);
      // Fallback: just clear it
      onChange({ ...params, architecture_id: null, nn_graph: null });
    } finally {
      setLoadingArchConfig(false);
    }
  };

  const handleOpen = () => {
    // Sync current node params into internal modal config when opening
    setInternalConfig({
      target: String(params.target ?? ""),
      target_cols: (params.target_cols as string[]) ?? [],
      feature_cols: (params.feature_cols as string[]) ?? [],
      task: String(params.task || "classification"),
      epochs: Number(params.epochs ?? 30),
      lr: Number(params.lr ?? 0.001),
      batch_size: Number(params.batch_size ?? 32),
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    // Commit to the actual Node parameters
    onChange({
      ...params,
      target: internalConfig.target,
      target_cols: internalConfig.target_cols,
      feature_cols: internalConfig.feature_cols,
      task: internalConfig.task,
      epochs: internalConfig.epochs,
      lr: internalConfig.lr,
      batch_size: internalConfig.batch_size,
    });
    setModalOpen(false);
  };

  return (
    <>
      <div className="space-y-3">
        <button
          onClick={handleOpen}
          className="w-full flex items-center justify-center gap-2 bg-[#22c55e]/10 hover:bg-[#22c55e]/20 border border-[#22c55e]/30 text-[#22c55e] text-[12px] font-semibold py-2 rounded-lg transition-all"
        >
          <Settings2 size={14} /> Configure Training
        </button>

        <LabeledRow label="Architecture Source">
          <div className="relative">
            <select 
              value={String(params.architecture_id || "")}
              onChange={handleArchChange}
              disabled={loadingArchs || loadingArchConfig}
              className={selectClass}
            >
              <option value="">Derive from Neural Network view (Current)</option>
              {architectures.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {loadingArchConfig && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                <Loader2 size={14} className="animate-spin text-white/50" />
              </div>
            )}
          </div>
        </LabeledRow>

        <LabeledRow label="Load Checkpoint (Weights)">
          <div className="relative">
            <select 
              value={String(params.checkpoint_file || "")}
              onChange={(e) => onChange({ ...params, checkpoint_file: e.target.value || null })}
              disabled={loadingCheckpoints}
              className={selectClass}
            >
              <option value="">Start from scratch (No checkpoint)</option>
              {checkpoints.map(c => (
                <option key={c.filename} value={c.filename}>
                  {c.name} - Acc: {c.val_acc ? c.val_acc.toFixed(2) : "N/A"}%
                </option>
              ))}
            </select>
            {loadingCheckpoints && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                <Loader2 size={14} className="animate-spin text-white/50" />
              </div>
            )}
          </div>
        </LabeledRow>

        {effectiveTargets.length > 0 && (
          <div className="text-[11px] text-white/50 space-y-1 bg-[#1a2030] p-2 rounded-lg border border-white/5">
            <div><span className="font-bold uppercase tracking-wider text-white/30 text-[9px] mr-1">TGT:</span> {effectiveTargets.join(", ")}</div>
            <div><span className="font-bold uppercase tracking-wider text-white/30 text-[9px] mr-1">CFG:</span> {(params.task as string) || "Classification"} | {params.epochs} epochs | bs={params.batch_size}</div>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]" style={{ background: params.architecture_id ? "rgba(10,88,202,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${params.architecture_id ? "rgba(10,88,202,0.2)" : "rgba(34,197,94,0.2)"}` }}>
          <span style={{ color: params.architecture_id ? "#0a58ca" : "#22c55e" }}>⬡</span>
          <span className="text-white/60">
            {params.architecture_id ? "Using saved architecture" : "Architecture derived from Neural Network view"}
          </span>
        </div>
      </div>

      {/* Reusuable config modal! */}
      <TrainConfigModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        datasetCols={columnNames}
        trainConfig={internalConfig}
        setTrainConfig={setInternalConfig}
        onConfirm={handleSave}
        confirmLabel="Save Configuration"
      />
    </>
  );
}

function DataSourceSection({ datasetInfo }: { datasetInfo: DatasetInfo | null }) {
  const [demos, setDemos] = useState<DemoDataset[]>([]);
  const [savedDatasets, setSavedDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDemoDatasets().then(setDemos).catch(() => {});
    fetchWithAuth(`${DJANGO_API_BASE}/datasets/`)
      .then(res => res.json())
      .then(data => {
        // deduplicate by name
        const seen = new Set<string>();
        const deduped = (data || [])
          .slice()
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .filter((d: any) => { if (seen.has(d.name)) return false; seen.add(d.name); return true; });
        setSavedDatasets(deduped);
      })
      .catch(() => {});
  }, []);

  const handleSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    setLoading(true);
    try {
      if (val.startsWith("demo:")) {
        const name = val.replace("demo:", "");
        await loadDemoDataset(name);
        const demo = demos.find((d) => d.name === name);
        if (demo) agentDataLoaded({ filename: name, rows: demo.rows, columns: demo.columns });
      } else if (val.startsWith("saved:")) {
        const id = val.replace("saved:", "");
        const res = await fetchWithAuth(`${DJANGO_API_BASE}/datasets/${id}/`);
        if (res.ok) {
          const data = await res.json();
          if (data.csv_data) {
            await loadSavedDataset(data.csv_data, data.name);
            agentDataLoaded({ filename: data.name, rows: data.rows, columns: data.columns });
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      e.target.value = ""; // reset selector
    }
  };

  return (
    <div className="space-y-4">
      {datasetInfo && (
        <>
          <LabeledRow label="Current File">
            <div className="text-[13px] text-white/70 font-mono bg-[#1a2030] rounded-md px-2.5 py-1.5 truncate border border-white/5">
              {datasetInfo.filename}
            </div>
          </LabeledRow>
          <div className="grid grid-cols-2 gap-2">
            <LabeledRow label="Rows">
              <div className="text-[13px] text-[#007bff] font-bold bg-[#1a2030] rounded-md px-2.5 py-1.5 border border-[#007bff]/20">{datasetInfo.rows.toLocaleString()}</div>
            </LabeledRow>
            <LabeledRow label="Columns">
              <div className="text-[13px] text-[#17C2D7] font-bold bg-[#1a2030] rounded-md px-2.5 py-1.5 border border-[#17C2D7]/20">{datasetInfo.col_count}</div>
            </LabeledRow>
          </div>
        </>
      )}
      {!datasetInfo && (
        <p className="text-[12px] text-yellow-400/70 py-2">
          No dataset loaded. Select one below, or go to Data view to upload a file.
        </p>
      )}
      <div className="pt-2 border-t border-white/5">
        <LabeledRow label="Load from Data Drawer">
          <div className="relative">
            <select className={selectClass} onChange={handleSelect} disabled={loading} defaultValue="">
              <option value="" disabled>— Select dataset —</option>
              {demos.length > 0 && (
                <optgroup label="Demos">
                  {demos.map(d => <option key={`demo:${d.name}`} value={`demo:${d.name}`}>Demo: {d.name} ({d.rows} rows)</option>)}
                </optgroup>
              )}
              {savedDatasets.length > 0 && (
                <optgroup label="Your Datasets">
                  {savedDatasets.map(d => <option key={`saved:${d.id}`} value={`saved:${d.id}`}>{d.name} ({d.rows} rows)</option>)}
                </optgroup>
              )}
            </select>
            {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/50" />}
          </div>
        </LabeledRow>
      </div>
    </div>
  );
}

function InverseDesignSection({
  params,
  numericColumns,
  onChange,
}: {
  params: Record<string, unknown>;
  numericColumns: string[];
  onChange: (p: Record<string, unknown>) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const targetCount = Object.keys((params.desired_outputs as Record<string, number>) || {}).length;
  const limitsCount = Object.keys((params.bounds as Record<string, any>) || {}).length + Object.keys((params.feature_lock as Record<string, any>) || {}).length;
  const constrCount = ((params.constraints as any[]) || []).length;

  return (
    <div className="space-y-4">
      <div className="bg-[#1a2030] border border-white/10 rounded-lg p-5 text-center">
        <Target size={28} className="mx-auto text-[#06b6d4] mb-3 opacity-90" />
        <h3 className="text-[14px] font-bold text-white mb-1 tracking-wide">Inverse Design</h3>
        <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
          Configure target outputs, limit feature bounds, and apply strict physical constraints.
        </p>

        <div className="flex justify-center gap-6 mb-5">
          <div className="flex flex-col items-center">
            <span className="text-[16px] font-bold text-white/90">{targetCount}</span>
            <span className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">Targets</span>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex flex-col items-center">
            <span className="text-[16px] font-bold text-white/90">{limitsCount}</span>
            <span className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">Limits</span>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex flex-col items-center">
            <span className="text-[16px] font-bold text-white/90">{constrCount}</span>
            <span className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">Constraints</span>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-6 py-2 rounded-lg text-[12px] font-semibold text-black bg-[#06b6d4] hover:bg-[#0891b2] transition-colors shadow-[0_0_15px_rgba(6,182,212,0.25)]"
        >
          Open Configuration
        </button>
      </div>

      <InverseDesignConfigModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialParams={params}
        availableColumns={numericColumns}
        onConfirm={onChange}
      />
    </div>
  );
}

function NodeConfig({
  kind, params, columnNames, numericColumns, datasetInfo, onChange,
}: {
  kind: NodeKind;
  params: Record<string, unknown>;
  columnNames: string[];
  numericColumns: string[];
  datasetInfo: DatasetInfo | null;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...params, [key]: value });

  switch (kind) {
    case "dataSource":
      return <DataSourceSection datasetInfo={datasetInfo} />;

    case "filterRows":
      return (
        <div className="space-y-3">
          <LabeledRow label="Column">
            <select className={selectClass} value={String(params.column ?? "")} onChange={(e) => set("column", e.target.value)}>
              <option value="">— select column —</option>
              {columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="Operator">
            <select className={selectClass} value={String(params.operator ?? ">")} onChange={(e) => set("operator", e.target.value)}>
              {[">", "<", "==", "!=", ">=", "<="].map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="Value">
            <input type="text" className={inputClass} placeholder="e.g. 0.5 or male" value={String(params.value ?? "")} onChange={(e) => set("value", e.target.value)} />
          </LabeledRow>
        </div>
      );

    case "dropColumns":
      return (
        <LabeledRow label="Columns to drop">
          <ColumnCheckboxes allColumns={columnNames} selected={(params.columns as string[]) ?? []} onChange={(cols) => set("columns", cols)} />
        </LabeledRow>
      );

    case "handleMissing":
      return (
        <div className="space-y-3">
          <LabeledRow label="Strategy">
            <div className="flex flex-col gap-1.5">
              {["mean", "median", "mode", "drop_rows"].map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="strategy" value={s} checked={params.strategy === s} onChange={() => set("strategy", s)} style={{ accentColor: "#F39C12" }} />
                  <span className="text-[13px] text-white/70 capitalize">{s.replace("_", " ")}</span>
                </label>
              ))}
            </div>
          </LabeledRow>
          <LabeledRow label="Apply to (empty = all)">
            <ColumnCheckboxes allColumns={columnNames} selected={(params.columns as string[]) ?? []} onChange={(cols) => set("columns", cols)} accentColor="#F39C12" />
          </LabeledRow>
        </div>
      );

    case "standardScaler":
      return (
        <LabeledRow label="Columns to scale (empty = all numeric)">
          <ColumnCheckboxes allColumns={numericColumns.length > 0 ? numericColumns : columnNames} selected={(params.columns as string[]) ?? []} onChange={(cols) => set("columns", cols)} accentColor="#9367B4" />
        </LabeledRow>
      );

    case "oneHotEncode":
      return (
        <div className="space-y-3">
          <LabeledRow label="Columns to encode (empty = all categorical)">
            <ColumnCheckboxes allColumns={columnNames} selected={(params.columns as string[]) ?? []} onChange={(cols) => set("columns", cols)} accentColor="#17C2D7" />
          </LabeledRow>
          <LabeledRow label="">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!params.drop_first}
                onChange={(e) => set("drop_first", e.target.checked)}
                className="accent-[#17C2D7]"
              />
              <span className="text-[12px] text-white/70">Drop first category (avoid multicollinearity)</span>
            </label>
          </LabeledRow>
        </div>
      );

    case "labelEncode":
      return (
        <LabeledRow label="Columns to encode (empty = all categorical)">
          <ColumnCheckboxes allColumns={columnNames} selected={(params.columns as string[]) ?? []} onChange={(cols) => set("columns", cols)} accentColor="#17C2D7" />
        </LabeledRow>
      );

    case "trainTestSplit": {
      const ratio = Number(params.ratio ?? 0.2);
      return (
        <div className="space-y-3">
          <LabeledRow label={`Test ratio: ${(ratio * 100).toFixed(0)}%`}>
            <input type="range" min={0.1} max={0.5} step={0.05} value={ratio} onChange={(e) => set("ratio", parseFloat(e.target.value))} className="w-full accent-[#28a745]" />
            <div className="flex justify-between text-[10px] text-white/30"><span>10%</span><span>50%</span></div>
          </LabeledRow>
          <LabeledRow label="Random seed">
            <input type="number" className={inputClass} value={Number(params.seed ?? 42)} onChange={(e) => set("seed", parseInt(e.target.value, 10))} />
          </LabeledRow>
        </div>
      );
    }

    case "trainModel": {
      const featureCols = columnNames.filter((c) => c !== String(params.target ?? ""));
      return (
        <div className="space-y-3">
          <LabeledRow label="Algorithm">
            <select className={selectClass} value={String(params.algorithm ?? "logistic_regression")} onChange={(e) => set("algorithm", e.target.value)}>
              <optgroup label="Classification">
                <option value="logistic_regression">Logistic Regression</option>
                <option value="random_forest">Random Forest</option>
                <option value="gradient_boosting">Gradient Boosting</option>
              </optgroup>
              <optgroup label="Regression">
                <option value="linear_regression">Linear Regression</option>
                <option value="ridge">Ridge Regression</option>
                <option value="svr">SVR</option>
              </optgroup>
            </select>
          </LabeledRow>
          <LabeledRow label="Target column">
            <select className={selectClass} value={String(params.target ?? "")} onChange={(e) => set("target", e.target.value)}>
              <option value="">— select target —</option>
              {columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="Features (empty = all numeric)">
            <ColumnCheckboxes allColumns={featureCols} selected={(params.features as string[]) ?? []} onChange={(cols) => set("features", cols)} accentColor="#E83E8C" />
          </LabeledRow>
        </div>
      );
    }

    case "clusterModel": {
      const algo = String(params.algorithm ?? "kmeans");
      return (
        <div className="space-y-3">
          <LabeledRow label="Algorithm">
            <select className={selectClass} value={algo} onChange={(e) => set("algorithm", e.target.value)}>
              <option value="kmeans">K-Means</option>
              <option value="dbscan">DBSCAN</option>
            </select>
          </LabeledRow>
          {algo === "kmeans" && (
            <LabeledRow label="Clusters (k)">
              <input type="number" className={inputClass} min={2} max={20} value={Number(params.n_clusters ?? 3)} onChange={(e) => set("n_clusters", Number(e.target.value))} />
            </LabeledRow>
          )}
          {algo === "dbscan" && (<>
            <LabeledRow label="Epsilon (eps)">
              <input type="number" className={inputClass} step={0.1} min={0.1} value={Number(params.eps ?? 0.5)} onChange={(e) => set("eps", Number(e.target.value))} />
            </LabeledRow>
            <LabeledRow label="Min samples">
              <input type="number" className={inputClass} min={1} value={Number(params.min_samples ?? 5)} onChange={(e) => set("min_samples", Number(e.target.value))} />
            </LabeledRow>
          </>)}
          <LabeledRow label="Features (empty = all numeric)">
            <ColumnCheckboxes allColumns={numericColumns} selected={(params.features as string[]) ?? []} onChange={(cols) => set("features", cols)} accentColor="#9367B4" />
          </LabeledRow>
        </div>
      );
    }

    case "trainNeuralNetwork":
      return <TrainNeuralNetworkSection params={params} columnNames={columnNames} onChange={onChange} />;

    case "inverseDesign":
      return <InverseDesignSection params={params} numericColumns={numericColumns} onChange={onChange} />;

    case "visualizeOutput":
      return (
        <div className="space-y-3">
          <LabeledRow label="Chart type">
            <select className={selectClass} value={String(params.chart_type ?? "scatter")} onChange={(e) => set("chart_type", e.target.value)}>
              {["scatter", "bar", "line", "histogram"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="X column">
            <select className={selectClass} value={String(params.x_col ?? "")} onChange={(e) => set("x_col", e.target.value)}>
              <option value="">— select —</option>
              {columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="Y column">
            <select className={selectClass} value={String(params.y_col ?? "")} onChange={(e) => set("y_col", e.target.value)}>
              <option value="">— select (optional) —</option>
              {columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="Color column (optional)">
            <select className={selectClass} value={String(params.color_col ?? "")} onChange={(e) => set("color_col", e.target.value)}>
              <option value="">— none —</option>
              {columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </LabeledRow>
        </div>
      );

    case "customPython":
      return <CustomPythonSection params={params} onChange={onChange} />;

    case "replayBuffer":
      return (
        <div className="space-y-3">
          <LabeledRow label="Capacity">
            <input type="number" className={inputClass} min={100} value={Number(params.capacity ?? 10000)} onChange={(e) => set("capacity", Number(e.target.value))} />
          </LabeledRow>
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-white/40 uppercase tracking-wider font-bold">Prioritized (PER)</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!params.prioritized} onChange={(e) => set("prioritized", e.target.checked)} style={{ accentColor: "#06b6d4" }} />
              <span className="text-[12px] text-white/60">Enabled</span>
            </label>
          </div>
          {!!params.prioritized && (
            <>
              <LabeledRow label="Alpha (priority exponent)">
                <input type="number" className={inputClass} step={0.1} min={0} max={1} value={Number(params.alpha ?? 0.6)} onChange={(e) => set("alpha", Number(e.target.value))} />
              </LabeledRow>
              <LabeledRow label="Beta (IS correction)">
                <input type="number" className={inputClass} step={0.1} min={0} max={1} value={Number(params.beta ?? 0.4)} onChange={(e) => set("beta", Number(e.target.value))} />
              </LabeledRow>
            </>
          )}
          <div className="text-[10px] text-[#06b6d4]/60 rounded-lg px-3 py-2" style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)" }}>
            Stores transitions for DQN training. Connect output to Training Loop.
          </div>
        </div>
      );

    case "trainingLoop":
      return (
        <div className="space-y-3">
          <LabeledRow label="Total steps">
            <input type="number" className={inputClass} min={100} step={100} value={Number(params.steps ?? 5000)} onChange={(e) => set("steps", Number(e.target.value))} />
          </LabeledRow>
          <LabeledRow label="Log every N steps">
            <input type="number" className={inputClass} min={1} value={Number(params.log_every ?? 100)} onChange={(e) => set("log_every", Number(e.target.value))} />
          </LabeledRow>
          <LabeledRow label="Eval every N steps">
            <input type="number" className={inputClass} min={1} value={Number(params.eval_every ?? 500)} onChange={(e) => set("eval_every", Number(e.target.value))} />
          </LabeledRow>
          <LabeledRow label="Target net update every N steps">
            <input type="number" className={inputClass} min={1} value={Number(params.target_update_every ?? 200)} onChange={(e) => set("target_update_every", Number(e.target.value))} />
          </LabeledRow>
          <div className="text-[10px] text-[#f97316]/60 rounded-lg px-3 py-2" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
            Connect model + buffer inputs. Streams metrics live via WebSocket during training.
          </div>
        </div>
      );

    case "envStep":
      return (
        <div className="space-y-3">
          <LabeledRow label="Ticks per step">
            <input type="number" className={inputClass} min={1} max={100} value={Number(params.ticks ?? 1)} onChange={(e) => set("ticks", Number(e.target.value))} />
          </LabeledRow>
          <div className="text-[10px] text-[#84cc16]/60 rounded-lg px-3 py-2" style={{ background: "rgba(132,204,22,0.06)", border: "1px solid rgba(132,204,22,0.2)" }}>
            Advances the environment by N ticks. Connect a World state object to the input.
          </div>
        </div>
      );

    case "modelCheckpoint":
      return (
        <div className="space-y-3">
          <LabeledRow label="Checkpoint name">
            <input type="text" className={inputClass} placeholder="my-dqn-agent" value={String(params.checkpoint_name ?? "")} onChange={(e) => set("checkpoint_name", e.target.value)} />
          </LabeledRow>
          <LabeledRow label="Mode">
            <div className="flex gap-3">
              {["save", "load"].map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="cp_mode" value={m} checked={params.mode === m} onChange={() => set("mode", m)} style={{ accentColor: "#eab308" }} />
                  <span className="text-[13px] text-white/70 capitalize">{m}</span>
                </label>
              ))}
            </div>
          </LabeledRow>
          {params.mode === "load" && (
            <LabeledRow label="Checkpoint ID">
              <input type="number" className={inputClass} placeholder="checkpoint DB id" value={String(params.checkpoint_id ?? "")} onChange={(e) => set("checkpoint_id", Number(e.target.value) || null)} />
            </LabeledRow>
          )}
        </div>
      );

    case "tokenize":
      return (
        <div className="space-y-3">
          <LabeledRow label="Text column">
            <select className={selectClass} value={String(params.text_column ?? "")} onChange={(e) => set("text_column", e.target.value)}>
              <option value="">— select column —</option>
              {columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="Method">
            <select className={selectClass} value={String(params.method ?? "whitespace")} onChange={(e) => set("method", e.target.value)}>
              <option value="whitespace">Whitespace split</option>
              <option value="regex_word">Regex word + punctuation</option>
              <option value="char">Character-level</option>
            </select>
          </LabeledRow>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!params.lowercase} onChange={(e) => set("lowercase", e.target.checked)} style={{ accentColor: "#0ea5e9" }} />
              <span className="text-[13px] text-white/70">Lowercase</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!params.strip_punct} onChange={(e) => set("strip_punct", e.target.checked)} style={{ accentColor: "#0ea5e9" }} />
              <span className="text-[13px] text-white/70">Strip punctuation</span>
            </label>
          </div>
          <LabeledRow label="Output column (optional)">
            <input type="text" className={inputClass} placeholder="defaults to <text>_tokens" value={String(params.output_column ?? "")} onChange={(e) => set("output_column", e.target.value)} />
          </LabeledRow>
        </div>
      );

    case "buildVocab":
      return (
        <div className="space-y-3">
          <LabeledRow label="Tokens column">
            <select className={selectClass} value={String(params.tokens_column ?? "")} onChange={(e) => set("tokens_column", e.target.value)}>
              <option value="">— select column —</option>
              {columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="Vocab size">
            <input type="number" className={inputClass} min={10} value={Number(params.vocab_size ?? 10000)} onChange={(e) => set("vocab_size", Math.max(10, Number(e.target.value) || 10000))} />
          </LabeledRow>
          <LabeledRow label="Min frequency">
            <input type="number" className={inputClass} min={1} value={Number(params.min_freq ?? 2)} onChange={(e) => set("min_freq", Math.max(1, Number(e.target.value) || 1))} />
          </LabeledRow>
          <LabeledRow label="Special tokens (comma-separated)">
            <input
              type="text"
              className={inputClass}
              value={(params.special_tokens as string[] | undefined)?.join(", ") ?? "<pad>, <unk>, <bos>, <eos>"}
              onChange={(e) => set("special_tokens", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            />
          </LabeledRow>
          <p className="text-[11px] text-white/40 italic">
            The vocabulary is exposed on the &ldquo;vocab&rdquo; output handle for downstream Pad Sequences / Load Embeddings nodes.
          </p>
        </div>
      );

    case "padSequences":
      return (
        <div className="space-y-3">
          <LabeledRow label="Tokens column">
            <select className={selectClass} value={String(params.tokens_column ?? "")} onChange={(e) => set("tokens_column", e.target.value)}>
              <option value="">— select column —</option>
              {columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="Max length">
            <input type="number" className={inputClass} min={1} value={Number(params.max_length ?? 128)} onChange={(e) => set("max_length", Math.max(1, Number(e.target.value) || 128))} />
          </LabeledRow>
          <LabeledRow label="Padding side">
            <select className={selectClass} value={String(params.padding ?? "post")} onChange={(e) => set("padding", e.target.value)}>
              <option value="post">post (right-pad)</option>
              <option value="pre">pre (left-pad)</option>
            </select>
          </LabeledRow>
          <LabeledRow label="Truncation side">
            <select className={selectClass} value={String(params.truncating ?? "post")} onChange={(e) => set("truncating", e.target.value)}>
              <option value="post">post (drop tail)</option>
              <option value="pre">pre (drop head)</option>
            </select>
          </LabeledRow>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!params.add_bos} onChange={(e) => set("add_bos", e.target.checked)} style={{ accentColor: "#22d3ee" }} />
              <span className="text-[13px] text-white/70">Prepend &lt;bos&gt;</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!params.add_eos} onChange={(e) => set("add_eos", e.target.checked)} style={{ accentColor: "#22d3ee" }} />
              <span className="text-[13px] text-white/70">Append &lt;eos&gt;</span>
            </label>
          </div>
          <LabeledRow label="Output column (optional)">
            <input type="text" className={inputClass} placeholder="defaults to <tokens>_ids" value={String(params.output_column ?? "")} onChange={(e) => set("output_column", e.target.value)} />
          </LabeledRow>
          <p className="text-[11px] text-white/40 italic">
            Connect a Build Vocabulary node to the &ldquo;vocab&rdquo; input handle.
          </p>
        </div>
      );

    case "loadEmbeddings":
      return (
        <div className="space-y-3">
          <LabeledRow label="Embedding file path (server-side)">
            <input type="text" className={inputClass} placeholder="/path/to/glove.6B.100d.txt" value={String(params.embedding_path ?? "")} onChange={(e) => set("embedding_path", e.target.value)} />
          </LabeledRow>
          <LabeledRow label="Embedding dimension">
            <input type="number" className={inputClass} min={1} value={Number(params.dim ?? 100)} onChange={(e) => set("dim", Math.max(1, Number(e.target.value) || 100))} />
          </LabeledRow>
          <p className="text-[11px] text-white/40 italic">
            Connect a Build Vocabulary node to the &ldquo;vocab&rdquo; input handle. The matrix becomes available downstream as a TorchTensor model.
          </p>
        </div>
      );

    case "tfidfVectorizer":
      return (
        <div className="space-y-3">
          <LabeledRow label="Text column">
            <select className={selectClass} value={String(params.text_column ?? "")} onChange={(e) => set("text_column", e.target.value)}>
              <option value="">— select column —</option>
              {columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </LabeledRow>
          <LabeledRow label="Max features">
            <input type="number" className={inputClass} min={10} value={Number(params.max_features ?? 1000)} onChange={(e) => set("max_features", Math.max(10, Number(e.target.value) || 1000))} />
          </LabeledRow>
          <div className="grid grid-cols-2 gap-2">
            <LabeledRow label="N-gram min">
              <input type="number" className={inputClass} min={1} value={Number(params.ngram_range_min ?? 1)} onChange={(e) => set("ngram_range_min", Math.max(1, Number(e.target.value) || 1))} />
            </LabeledRow>
            <LabeledRow label="N-gram max">
              <input type="number" className={inputClass} min={1} value={Number(params.ngram_range_max ?? 1)} onChange={(e) => set("ngram_range_max", Math.max(1, Number(e.target.value) || 1))} />
            </LabeledRow>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!params.lowercase} onChange={(e) => set("lowercase", e.target.checked)} style={{ accentColor: "#67e8f9" }} />
            <span className="text-[13px] text-white/70">Lowercase before vectorizing</span>
          </label>
        </div>
      );

    case "dataProfile":
      return (
        <div className="space-y-3">
          <LabeledRow label="Columns to profile (empty = all)">
            <ColumnCheckboxes allColumns={columnNames} selected={(params.columns as string[]) ?? []} onChange={(cols) => set("columns", cols)} accentColor="#a78bfa" />
          </LabeledRow>
          <div className="text-[10px] text-[#a78bfa]/60 rounded-lg px-3 py-2" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
            Generates statistical profile, histograms, and correlation matrix for the input data.
          </div>
        </div>
      );

    case "exportPDF":
      return (
        <div className="space-y-3">
          <LabeledRow label="Report title">
            <input type="text" className={inputClass} value={String(params.title ?? "Quasar Studio Report")} onChange={(e) => set("title", e.target.value)} />
          </LabeledRow>
          <div className="text-[10px] text-[#f472b6]/60 rounded-lg px-3 py-2" style={{ background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.2)" }}>
            Generates a professional PDF report with dataset stats, model metrics, inverse design results, and PINN breakdown. PDF is saved to <code className="text-[#f472b6]/80">runs/reports/</code>.
          </div>
        </div>
      );

    default:
      return null;
  }
}

function PreviewTable({ result, nodeKind, nodeId }: { result: NodeResult, nodeKind: string, nodeId: string }) {
  if (result.status === "error") {
    return (
      <div className="flex items-center gap-2 p-4 text-red-400 text-sm">
        <AlertCircle size={16} />
        {result.error}
      </div>
    );
  }

  // ── Inverse Design: rich multi-panel result ───────────────────────────────
  if (result.chart && (result.chart as Record<string, unknown>).chart_type === "inverse_design") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch = result.chart as any;
    const plotBase = {
      paper_bgcolor: "transparent",
      plot_bgcolor: "#1a2030",
      font: { color: "rgba(255,255,255,0.5)", size: 10 },
      margin: { t: 28, b: 40, l: 50, r: 14 },
    };
    const perErrors: Record<string, { desired: number; achieved: number; abs_error: number; rel_error_pct: number }> =
      ch.per_target_errors ?? {};
    const violations: Array<{ label: string; satisfied: boolean; margin: number; op: string }> =
      ch.constraint_violations ?? [];
    const allStarts: Array<{ start_idx: number; final_loss: number; is_best: boolean; steps_taken: number }> =
      ch.all_starts ?? [];

    return (
      <div className="overflow-auto h-full custom-scrollbar">
        {/* Header metrics */}
        <div className="px-4 pt-3 pb-1 grid grid-cols-3 gap-2">
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#F39C12] font-bold text-sm">{ch.n_steps_taken ?? 0}</div>
            <div className="text-white/40 text-[10px]">Steps taken</div>
          </div>
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#17C2D7] font-bold text-sm">{typeof ch.convergence_rate === "number" ? ch.convergence_rate.toExponential(2) : "—"}</div>
            <div className="text-white/40 text-[10px]">Conv. rate</div>
          </div>
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#28a745] font-bold text-sm">{allStarts.length > 0 ? allStarts.length : 1}</div>
            <div className="text-white/40 text-[10px]">Starts</div>
          </div>
        </div>

        {/* Convergence chart */}
        {ch.convergence_traces?.length > 0 && (
          <div className="px-4 py-2">
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">Convergence</div>
            <Plot
              data={ch.convergence_traces as never[]}
              layout={{ ...plotBase, height: 180, ...(ch.convergence_layout as object) } as never}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {/* Achieved vs Desired */}
        {ch.av_traces?.length > 0 && (
          <div className="px-4 py-2">
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">Achieved vs Desired</div>
            <Plot
              data={ch.av_traces as never[]}
              layout={{ ...plotBase, height: 160, barmode: "group", ...(ch.av_layout as object) } as never}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {/* Per-target error table */}
        {Object.keys(perErrors).length > 0 && (
          <div className="px-4 py-2">
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">Per-Target Errors</div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr>
                  {["Target", "Desired", "Achieved", "Abs Err", "Rel Err%"].map((h) => (
                    <th key={h} className="px-2 py-1 text-left text-white/40 font-semibold border-b border-white/10">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(perErrors).map(([col, e]) => (
                  <tr key={col} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-2 py-1 text-white/70 font-mono">{col}</td>
                    <td className="px-2 py-1 text-[#28a745]">{e.desired.toFixed(4)}</td>
                    <td className="px-2 py-1 text-[#17C2D7]">{e.achieved.toFixed(4)}</td>
                    <td className="px-2 py-1 text-white/50">{e.abs_error.toFixed(4)}</td>
                    <td className="px-2 py-1" style={{ color: e.rel_error_pct < 5 ? "#28a745" : e.rel_error_pct < 20 ? "#F39C12" : "#dc3545" }}>
                      {e.rel_error_pct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sensitivity chart */}
        {ch.sensitivity_traces?.length > 0 && (
          <div className="px-4 py-2">
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">Feature Sensitivity</div>
            <Plot
              data={ch.sensitivity_traces as never[]}
              layout={{
                ...plotBase,
                height: Math.max(120, (ch.sensitivity_traces[0]?.y?.length ?? 5) * 22 + 50),
                xaxis: { gridcolor: "rgba(255,255,255,0.05)", zeroline: false },
                yaxis: { autorange: "reversed" },
                ...(ch.sensitivity_layout as object),
              } as never}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {/* Constraint violations */}
        {violations.length > 0 && (
          <div className="px-4 py-2">
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">Constraints</div>
            <div className="space-y-1">
              {violations.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] rounded px-2 py-1"
                  style={{ background: v.satisfied ? "rgba(40,167,69,0.1)" : "rgba(220,53,69,0.1)", border: `1px solid ${v.satisfied ? "rgba(40,167,69,0.3)" : "rgba(220,53,69,0.3)"}` }}>
                  <span style={{ color: v.satisfied ? "#28a745" : "#dc3545" }}>{v.satisfied ? "✓" : "✗"}</span>
                  <span className="text-white/60 truncate">{v.label || `Constraint ${i + 1}`}</span>
                  <span className="ml-auto text-white/40">margin: {v.margin.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multi-start summary */}
        {allStarts.length > 1 && (
          <div className="px-4 py-2">
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">Multi-Start Summary</div>
            <div className="space-y-1">
              {allStarts.map((s) => (
                <div key={s.start_idx} className="flex items-center gap-2 text-[11px] rounded px-2 py-1"
                  style={{ background: s.is_best ? "rgba(243,156,18,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${s.is_best ? "rgba(243,156,18,0.3)" : "rgba(255,255,255,0.07)"}` }}>
                  <span style={{ color: s.is_best ? "#F39C12" : "rgba(255,255,255,0.3)" }}>{s.is_best ? "★" : "○"}</span>
                  <span className="text-white/50">Start {s.start_idx + 1}</span>
                  <span className="ml-auto text-white/40">loss: {s.final_loss?.toFixed(6)} · {s.steps_taken} steps</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Visualize Output: render chart ─────────────────────────────────────────
  if (result.chart) {
    const { traces, layout } = result.chart;
    return (
      <div className="p-2 overflow-auto h-full custom-scrollbar">
        <Plot
          data={traces as never[]}
          layout={{
            ...(layout as object),
            height: 340,
            margin: { t: 16, b: 50, l: 50, r: 16 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "#1a2030",
            font: { color: "rgba(255,255,255,0.5)", size: 10 },
            xaxis: { ...(layout as Record<string, Record<string, unknown>>).xaxis, gridcolor: "rgba(255,255,255,0.05)" },
            yaxis: { ...(layout as Record<string, Record<string, unknown>>).yaxis, gridcolor: "rgba(255,255,255,0.05)" },
            legend: { bgcolor: "transparent", font: { color: "rgba(255,255,255,0.5)", size: 10 } },
          } as never}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
        />
      </div>
    );
  }

  if (!result.preview || result.preview.length === 0) {
    return <p className="p-4 text-white/30 text-sm">No preview available</p>;
  }
  const cols = Object.keys(result.preview[0]);
  return (
    <div className="overflow-auto h-full custom-scrollbar">

      {result.metrics && (result.metrics.task === "classification" || (!result.metrics.task && result.metrics.accuracy != null)) && (
        <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-2">
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#E83E8C] font-bold text-sm">{(result.metrics.accuracy! * 100).toFixed(1)}%</div>
            <div className="text-white/40 text-[10px]">Accuracy</div>
          </div>
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#17C2D7] font-bold text-sm">{result.metrics.f1?.toFixed(3)}</div>
            <div className="text-white/40 text-[10px]">F1 Score</div>
          </div>
          <div className="col-span-2 bg-[#1a2030] rounded-lg p-2">
            <div className="text-white/50 text-[11px]">Target: <span className="text-white/80">{result.metrics.target}</span></div>
            <div className="text-white/50 text-[11px]">Algorithm: <span className="text-white/80">{result.metrics.algorithm?.replace(/_/g, " ")}</span></div>
          </div>
        </div>
      )}
      {result.metrics && result.metrics.task === "regression" && (
        <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-2">
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#17C2D7] font-bold text-sm">{result.metrics.r2?.toFixed(4)}</div>
            <div className="text-white/40 text-[10px]">R²</div>
          </div>
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#F39C12] font-bold text-sm">{result.metrics.rmse?.toFixed(4)}</div>
            <div className="text-white/40 text-[10px]">RMSE</div>
          </div>
          <div className="col-span-2 bg-[#1a2030] rounded-lg p-2">
            <div className="text-white/50 text-[11px]">Target: <span className="text-white/80">{result.metrics.target}</span></div>
            <div className="text-white/50 text-[11px]">Algorithm: <span className="text-white/80">{result.metrics.algorithm?.replace(/_/g, " ")}</span></div>
            <div className="text-white/50 text-[11px]">MSE: <span className="text-white/80">{result.metrics.mse?.toFixed(4)}</span></div>
          </div>
        </div>
      )}
      {result.metrics && result.metrics.task === "clustering" && (
        <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-2">
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#9367B4] font-bold text-sm">{result.metrics.n_clusters_found}</div>
            <div className="text-white/40 text-[10px]">Clusters found</div>
          </div>
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#17C2D7] font-bold text-sm">
              {result.metrics.silhouette != null ? result.metrics.silhouette.toFixed(3) : "—"}
            </div>
            <div className="text-white/40 text-[10px]">Silhouette</div>
          </div>
          {result.metrics.inertia != null && (
            <div className="col-span-2 bg-[#1a2030] rounded-lg p-2">
              <div className="text-white/50 text-[11px]">Inertia: <span className="text-white/80">{result.metrics.inertia.toFixed(2)}</span></div>
              <div className="text-white/50 text-[11px]">Algorithm: <span className="text-white/80">{result.metrics.algorithm?.replace(/_/g, " ")}</span></div>
            </div>
          )}
        </div>
      )}
      {result.confusion_matrix && (
        <div className="px-4 py-2">
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">Confusion Matrix</div>
          <Plot
            data={[{
              type: "heatmap",
              z: result.confusion_matrix.matrix,
              x: result.confusion_matrix.labels,
              y: result.confusion_matrix.labels,
              colorscale: [[0, "#1a2030"], [1, "#E83E8C"]],
              showscale: true,
              text: result.confusion_matrix.matrix.map(row => row.map(String)) as unknown as string[],
              texttemplate: "%{text}",
              hovertemplate: "Actual: %{y}<br>Predicted: %{x}<br>Count: %{z}<extra></extra>",
            } as never]}
            layout={{
              height: 220,
              margin: { t: 8, b: 40, l: 60, r: 8 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#1a2030",
              font: { color: "rgba(255,255,255,0.5)", size: 10 },
              xaxis: { title: { text: "Predicted" } },
              yaxis: { title: { text: "Actual" }, autorange: "reversed" },
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}
      {result.roc_curve && (
        <div className="px-4 py-2">
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">
            ROC Curve (AUC: {result.roc_curve.auc.toFixed(4)})
          </div>
          <Plot
            data={[
              {
                type: "scatter",
                mode: "lines",
                x: result.roc_curve.fpr,
                y: result.roc_curve.tpr,
                line: { color: "#17C2D7", width: 2 },
                name: `AUC = ${result.roc_curve.auc.toFixed(3)}`,
              },
              {
                type: "scatter",
                mode: "lines",
                x: [0, 1],
                y: [0, 1],
                line: { color: "rgba(255,255,255,0.2)", width: 1, dash: "dash" },
                showlegend: false,
              },
            ] as never[]}
            layout={{
              height: 220,
              margin: { t: 8, b: 40, l: 40, r: 8 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#1a2030",
              font: { color: "rgba(255,255,255,0.4)", size: 9 },
              xaxis: { title: { text: "FPR" }, range: [0, 1], gridcolor: "rgba(255,255,255,0.05)" },
              yaxis: { title: { text: "TPR" }, range: [0, 1], gridcolor: "rgba(255,255,255,0.05)" },
              showlegend: false,
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}
      {result.feature_importance && (
        <div className="px-4 py-2">
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">Feature Importance</div>
          <Plot
            data={[{
              type: "bar",
              orientation: "h",
              y: result.feature_importance.features,
              x: result.feature_importance.importances,
              marker: { color: "#28a745", opacity: 0.85 },
            } as never]}
            layout={{
              height: Math.max(120, result.feature_importance.features.length * 28 + 40),
              margin: { t: 8, b: 28, l: 100, r: 8 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#1a2030",
              font: { color: "rgba(255,255,255,0.5)", size: 9 },
              xaxis: { gridcolor: "rgba(255,255,255,0.05)", zeroline: false },
              yaxis: { autorange: "reversed" },
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}
      {result.residuals && (
        <div className="px-4 py-2">
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-1 font-bold">Residual Plot</div>
          <Plot
            data={[{
              type: "scatter",
              mode: "markers",
              x: result.residuals.predicted,
              y: result.residuals.residuals,
              marker: { color: "#F39C12", opacity: 0.6, size: 5 },
              hovertemplate: "Predicted: %{x}<br>Residual: %{y}<extra></extra>",
            } as never, {
              type: "scatter",
              mode: "lines",
              x: [Math.min(...result.residuals.predicted), Math.max(...result.residuals.predicted)],
              y: [0, 0],
              line: { color: "rgba(255,255,255,0.3)", width: 1, dash: "dash" },
              showlegend: false,
            } as never]}
            layout={{
              height: 200,
              margin: { t: 8, b: 36, l: 44, r: 8 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "#1a2030",
              font: { color: "rgba(255,255,255,0.4)", size: 9 },
              xaxis: { title: { text: "Predicted" }, gridcolor: "rgba(255,255,255,0.05)" },
              yaxis: { title: { text: "Residual" }, gridcolor: "rgba(255,255,255,0.05)", zeroline: false },
              showlegend: false,
            } as never}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}
      {(nodeKind === "trainModel" || nodeKind === "clusterModel" || nodeKind === "trainNeuralNetwork") && result.status === "success" && (
        <div className="px-4 py-2 flex flex-col gap-2">
          {nodeKind === "trainNeuralNetwork" && result.metrics && (
            <div className="grid grid-cols-2 gap-2 text-center my-2">
              <div className="bg-[#1a2030] rounded-lg p-2 border border-white/5">
                <div className="text-[14px] font-bold text-white/90">
                  {result.metrics.task === "regression" ? result.metrics.mse : (result.metrics.accuracy * 100).toFixed(2) + "%"}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-white/40">
                  {result.metrics.task === "regression" ? "MSE Loss" : "Accuracy"}
                </div>
              </div>
              <div className="bg-[#1a2030] rounded-lg p-2 border border-white/5">
                <div className="text-[14px] font-bold text-white/90">
                  {result.metrics.task === "regression" ? result.metrics.r2 : result.metrics.f1}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-white/40">
                  {result.metrics.task === "regression" ? "R² Score" : "F1 Score"}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {nodeKind === "trainNeuralNetwork" && (
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
                className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] font-semibold transition-all"
                style={{
                  background: "color-mix(in oklch, #22c55e 12%, #1a2030)",
                  border: "1px solid color-mix(in oklch, #22c55e 30%, transparent)",
                  color: "#22c55e",
                }}
              >
                <Download size={13} />
                Save PyTorch Checkpoint
              </button>
            )}
            <button
              onClick={() => exportPipelineModel(nodeId, "onnx").catch((e) => alert(`Export failed: ${e.message}`))}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] font-semibold transition-all"
              style={{
                background: "color-mix(in oklch, #17C2D7 12%, #1a2030)",
                border: "1px solid color-mix(in oklch, #17C2D7 30%, transparent)",
                color: "#17C2D7",
              }}
            >
              <Download size={13} />
              Export ONNX Model
            </button>
          </div>
        </div>
      )}
      {result.train_rows != null && (
        <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-2">
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#28a745] font-bold text-sm">{result.train_rows}</div>
            <div className="text-white/40 text-[10px]">Train rows</div>
          </div>
          <div className="bg-[#1a2030] rounded-lg p-2 text-center">
            <div className="text-[#F39C12] font-bold text-sm">{result.test_rows}</div>
            <div className="text-white/40 text-[10px]">Test rows</div>
          </div>
        </div>
      )}
      <div className="px-2 pb-4">
        <table className="w-full text-[11px] border-collapse" style={{ minWidth: "max-content" }}>
          <thead className="sticky top-0 bg-[#1a2030]">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-2 py-1.5 text-left text-white/40 font-semibold border-b border-white/10 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.preview.map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1 text-white/70 whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis">
                    {row[c] == null ? <span className="text-white/20 italic">null</span> : String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ConfigPanel({ node, columnNames, numericColumns, datasetInfo, onParamsChange }: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<"config" | "preview">("config");

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm gap-3 p-6 text-center">
        <Settings2 size={32} className="opacity-30" />
        <span>Select a node to configure it</span>
      </div>
    );
  }

  const { kind, params, status, result } = node.data;
  const meta = NODE_META[kind];
  const hasResult = status === "success" || status === "error";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0" style={{ borderLeft: `3px solid ${meta.color}` }}>
        <div className="text-[13px] font-semibold text-white/90">{meta.label}</div>
        <div className="text-[11px] mt-0.5" style={{ color: meta.color }}>{meta.category}</div>
      </div>

      {/* Error banner */}
      {status === "error" && result?.error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] text-red-400 bg-red-400/10 border border-red-400/20 shrink-0">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {result.error}
        </div>
      )}

      {/* Tabs */}
      {hasResult && (
        <div className="flex border-b border-white/10 shrink-0 mx-0">
          {(["config", "preview"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex items-center gap-1.5 flex-1 justify-center py-2 text-[12px] font-medium transition-colors"
              style={{
                color: activeTab === tab ? meta.color : "rgba(255,255,255,0.4)",
                borderBottom: activeTab === tab ? `2px solid ${meta.color}` : "2px solid transparent",
              }}
            >
              {tab === "config" ? <Settings2 size={12} /> : <Table2 size={12} />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0">
        {(!hasResult || activeTab === "config") && (
          <div className="p-4 overflow-y-auto h-full custom-scrollbar">
            <NodeConfig
              kind={kind}
              params={params}
              columnNames={columnNames}
              numericColumns={numericColumns}
              datasetInfo={datasetInfo}
              onChange={(p) => onParamsChange(node.id, p)}
            />
          </div>
        )}
        {hasResult && activeTab === "preview" && result && (
          <PreviewTable result={result} nodeKind={kind} nodeId={node.id} />
        )}
      </div>
    </div>
  );
}
