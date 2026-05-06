import { fetchWithAuth, DJANGO_API_BASE } from "./auth";
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ColumnSchema {
  name: string;
  dtype: string;
  nullable: boolean;
}

export interface PreviewResponse {
  rows: Record<string, unknown>[];
  schema: ColumnSchema[];
  total_rows: number;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  count: number;
  nulls: number;
  unique: number;
  mean?: number | null;
  std?: number | null;
  min?: number | null;
  max?: number | null;
  histogram?: { counts: number[]; edges: number[] } | null;
  top5?: Record<string, number> | null;
  avg_str_len?: number;
  max_str_len?: number;
  is_text_like?: boolean;
}

export interface ProfileResponse {
  filename: string;
  rows: number;
  col_count: number;
  columns: ColumnProfile[];
  pct_missing: number;
}

export interface UploadResponse {
  filename: string;
  rows: number;
  columns: number;
  column_names: string[];
  dtypes: Record<string, string>;
}

export interface DemoDataset {
  name: string;
  label: string;
  description: string;
  target: string;
  task: string;
  rows: number;
  columns: number;
  column_names: string[];
}

export async function fetchDemoDatasets(): Promise<DemoDataset[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/data/demo-datasets`);
  if (!res.ok) throw new Error("Failed to fetch demo datasets");
  return res.json();
}

export async function loadDemoDataset(name: string): Promise<UploadResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/data/load-demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to load demo" }));
    throw new Error(err.detail ?? "Failed to load demo");
  }
  return res.json();
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetchWithAuth(`${API_BASE}/api/data/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail ?? "Upload failed");
  }

  return res.json();
}

export async function fetchDatasetAsCsv(): Promise<string> {
  try {
    const res = await fetchWithAuth(`${API_BASE}/api/data/export-csv`);
    if (!res.ok) {
      console.warn("export-csv returned", res.status, res.statusText);
      return "";
    }
    return res.text();
  } catch (err) {
    console.warn("export-csv fetch failed:", err);
    return "";
  }
}

export async function loadSavedDataset(csvData: string, filename: string): Promise<UploadResponse> {
  // Reconstruct a File object from stored CSV text and reuse the existing upload endpoint
  const file = new File([csvData], filename, { type: "text/csv" });
  return uploadFile(file);
}

export async function fetchPreview(): Promise<PreviewResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/data/preview`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch preview" }));
    throw new Error(err.detail ?? "Failed to fetch preview");
  }
  return res.json();
}

export async function fetchProfile(): Promise<ProfileResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/data/profile`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch profile" }));
    throw new Error(err.detail ?? "Failed to fetch profile");
  }
  return res.json();
}

export interface NodeResult {
  status: "success" | "error";
  rows?: number;
  cols?: number;
  columns?: string[];
  preview?: Record<string, unknown>[];
  error?: string;
  metrics?: {
    // shared
    algorithm?: string;
    features?: string[];
    samples?: number;
    task?: "classification" | "regression" | "clustering";
    // classification
    accuracy?: number;
    f1?: number;
    target?: string;
    // regression
    mse?: number;
    rmse?: number;
    r2?: number;
    // clustering
    n_clusters_found?: number;
    silhouette?: number | null;
    inertia?: number | null;
  };
  residuals?: { predicted: number[]; residuals: number[] };
  train_rows?: number;
  test_rows?: number;
  test_preview?: Record<string, unknown>[];
  confusion_matrix?: { matrix: number[][]; labels: string[] };
  feature_importance?: { features: string[]; importances: number[] };
  roc_curve?: { fpr: number[]; tpr: number[]; auc: number };
  chart?: {
    chart_type: string;
    traces: Record<string, unknown>[];
    layout: Record<string, unknown>;
  };
  // Multi-output custom Python nodes: one entry per named DataFrame output
  outputs_meta?: Record<string, {
    rows: number;
    cols: number;
    columns: string[];
    preview: Record<string, unknown>[];
  }>;
}

export interface PipelineExecuteResponse {
  success: boolean;
  execution_order: string[];
  results: Record<string, NodeResult>;
  error?: string;
}

export interface PipelineGraph {
  nodes: Array<{ id: string; kind: string; params: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }>;
}

export async function executePipeline(graph: PipelineGraph, signal?: AbortSignal, skipNodes?: string[]): Promise<PipelineExecuteResponse> {
  const body: Record<string, unknown> = { ...graph };
  if (skipNodes && skipNodes.length > 0) {
    body.skip_nodes = skipNodes;
  }
  const res = await fetchWithAuth(`${API_BASE}/api/pipeline/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Pipeline execution failed" }));
    throw new Error(err.detail ?? "Pipeline execution failed");
  }
  return res.json();
}

export interface SystemInfo {
  gpu_available: boolean;
  gpu_name: string | null;
  gpu_memory_total_mb: number | null;
  gpu_memory_used_mb: number | null;
  gpu_memory_free_mb: number | null;
  gpu_utilization_pct: number | null;
  cpu_count: number | null;
  cpu_percent: number | null;
  ram_total_gb: number | null;
  ram_used_gb: number | null;
  ram_percent: number | null;
  cuda_version: string | null;
  pytorch_version: string | null;
}

export interface DashboardStats {
  dataset: {
    filename: string;
    rows: number;
    columns: number;
    column_names: string[];
  } | null;
  models: Array<{
    node_id: string;
    algorithm: string;
    task: "classification" | "regression" | "clustering";
    accuracy?: number | null;
    f1?: number | null;
    mse?: number | null;
    r2?: number | null;
    silhouette?: number | null;
    n_clusters_found?: number | null;
    samples?: number;
    features?: string[];
    target?: string;
  }>;
  pipeline_nodes: number;
  pipeline_success: boolean | null;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetchWithAuth(`${API_BASE}/api/dashboard/stats`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

export async function fetchSystemInfo(): Promise<SystemInfo> {
  const res = await fetchWithAuth(`${API_BASE}/api/system/info`);
  if (!res.ok) throw new Error("Failed to fetch system info");
  return res.json();
}

// ── NN Training WebSocket ────────────────────────────────────────────────────

export type NNTrainEvent =
  | { type: "start"; total_epochs: number; n_features: number; n_classes: number; train_samples: number; val_samples: number; device: string }
  | { type: "epoch"; epoch: number; train_loss: number; train_acc: number | null; val_loss: number; val_acc: number | null; val_r2?: number | null; val_rmse?: number | null }
  | { type: "done"; task?: "classification" | "regression"; val_acc: number | null; val_loss: number; val_r2?: number | null; val_rmse?: number | null; n_features: number; n_classes?: number; n_outputs?: number; classes?: string[]; target_cols?: string[] }
  | { type: "error"; message: string };

export interface NNTrainConfig {
  nodes: Array<{ id: string; kind: string; params: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string }>;
  target: string;           // legacy single target (kept for compat)
  target_cols?: string[];   // multi-target; takes priority when set
  feature_cols?: string[];  // explicit input columns; undefined = auto (all numeric non-targets)
  task?: "classification" | "regression";
  epochs: number;
  lr: number;
  batch_size: number;
}

const WS_BASE = API_BASE.replace(/^http/, "ws");

export function createNNTrainingWebSocket(
  config: NNTrainConfig,
  onEvent: (event: NNTrainEvent) => void
): { stop: () => void } {
  const ws = new WebSocket(`${WS_BASE}/api/nn/train/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify(config));
  };

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as NNTrainEvent;
      onEvent(event);
    } catch {
      // ignore parse errors
    }
  };

  ws.onerror = () => {
    onEvent({ type: "error", message: "WebSocket connection error" });
  };

  return {
    stop() {
      ws.close();
    },
  };
}

export async function saveNNGraph(graph: {
  nodes: Array<{ id: string; kind: string; params: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string }>;
}): Promise<void> {
  await fetchWithAuth(`${API_BASE}/api/nn/save-graph`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(graph),
  });
}

export interface NNHistoryResponse {
  history: Array<{ type: string; epoch: number; train_loss: number; train_acc: number | null; val_loss: number; val_acc: number | null; val_r2?: number | null; val_rmse?: number | null }>;
  meta: Record<string, unknown> | null;
  has_model: boolean;
}

export async function fetchNNHistory(): Promise<NNHistoryResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/history`);
  if (!res.ok) throw new Error("Failed to fetch NN history");
  return res.json();
}

export interface NNInspectResult {
  type: "weights" | "activations" | "gradients";
  layers: Array<Record<string, unknown>>;
  loss?: number;
  error?: string;
}

export async function inspectNNModel(
  type: "weights" | "activations" | "gradients",
  n_samples = 100
): Promise<NNInspectResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, n_samples }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Inspection failed" }));
    throw new Error(err.detail ?? "Inspection failed");
  }
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetchWithAuth(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export interface NNValidateResponse {
  valid: boolean;
  output_shape?: number[];
  error?: string;
}

export async function validateNNGraph(graph: {
  nodes: Array<{ id: string; kind: string; params: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string }>;
  input_shape: number[];
}): Promise<NNValidateResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(graph),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Validation failed" }));
    throw new Error(err.detail ?? "Validation failed");
  }
  return res.json();
}

// ── Model Export ─────────────────────────────────────────────────────────────

async function _downloadBlob(res: Response, fallbackName: string): Promise<void> {
  const disposition = res.headers.get("Content-Disposition");
  const filename = disposition?.match(/filename="?([^";\n]+)"?/)?.[1] ?? fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportPipelineModel(nodeId: string, format = "onnx"): Promise<void> {
  const res = await fetchWithAuth(
    `${API_BASE}/api/pipeline/export/${encodeURIComponent(nodeId)}?format=${encodeURIComponent(format)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Export failed" }));
    throw new Error(err.detail ?? "Export failed");
  }
  await _downloadBlob(res, `model.${format}`);
}

export async function exportNNModel(format = "torchscript"): Promise<void> {
  const res = await fetchWithAuth(
    `${API_BASE}/api/nn/export?format=${encodeURIComponent(format)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Export failed" }));
    throw new Error(err.detail ?? "Export failed");
  }
  const ext = format === "torchscript" ? "pt" : format;
  await _downloadBlob(res, `model.${ext}`);
}

// ── NN Lab: Playground ───────────────────────────────────────────────────────

export interface NNLayerActivation {
  layer_idx: number;
  name: string;
  type: string;
  shape: number[];
  values: number[];
  mean: number;
  std: number;
  min: number;
  max: number;
  pct_zeros: number;
}

export interface NNPredictResult {
  task?: "classification" | "regression";
  // Classification fields
  logits?: number[];
  probs?: number[];
  pred_class?: number;
  pred_label?: string;
  classes?: string[];
  // Regression fields
  outputs?: Record<string, number>;
  raw_outputs?: number[];
  target_cols?: string[];
  // Shared
  feature_cols: string[];
  layer_activations: NNLayerActivation[];
}

export async function predictNNSample(
  features: Record<string, number>,
  return_activations = true
): Promise<NNPredictResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features, return_activations }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Prediction failed" }));
    throw new Error(err.detail ?? "Prediction failed");
  }
  return res.json();
}

export interface NNFeatureMeta {
  col: string;
  mean: number;
  std: number;
}

export interface NNRandomSampleResult {
  features: Record<string, number>;
  row_idx: number;
  feature_meta: NNFeatureMeta[];
}

export async function fetchNNRandomSample(): Promise<NNRandomSampleResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/random-sample`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch sample" }));
    throw new Error(err.detail ?? "Failed to fetch sample");
  }
  return res.json();
}

// ── NN Lab: Per-neuron inspection ────────────────────────────────────────────

export interface NNNeuronDetail {
  layer_idx: number;
  layer_name: string;
  neuron_idx: number;
  type: string;
  n_inputs?: number;
  n_outputs?: number;
  weights?: number[];
  bias?: number | null;
  stats?: { mean: number; std: number; min: number; max: number; abs_sum: number };
  flags?: { dead: boolean; high_influence: boolean };
  histogram?: { counts: number[]; edges: number[] };
  activation?: number | number[];
  activation_mean?: number;
  note?: string;
}

export async function fetchNNNeuronDetail(
  layer_idx: number,
  neuron_idx: number,
  sample_features?: Record<string, number>
): Promise<NNNeuronDetail> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/neuron`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layer_idx, neuron_idx, sample_features }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch neuron" }));
    throw new Error(err.detail ?? "Failed to fetch neuron");
  }
  return res.json();
}

export interface NNNeuronStat {
  idx: number;
  abs_sum: number;
  mean: number;
  std: number;
  bias: number | null;
  dead: boolean;
}

export interface NNLayerNeuronStats {
  layer_idx: number;
  name: string;
  type: string;
  n_inputs: number | null;
  n_outputs: number | null;
  neurons: NNNeuronStat[];
}

export interface NNPerNeuronStatsResult {
  type: "per_neuron_stats";
  layers: NNLayerNeuronStats[];
}

export async function fetchNNNeuronStats(): Promise<NNPerNeuronStatsResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/neuron-stats`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch neuron stats" }));
    throw new Error(err.detail ?? "Failed to fetch neuron stats");
  }
  return res.json();
}

export interface NNSaliencyResult {
  type: "saliency";
  target_class: number;
  gradients: number[];
  abs_gradients: number[];
  normalized: number[];
  feature_cols: string[];
}

export async function fetchNNSaliency(
  features: Record<string, number>,
  target_class?: number
): Promise<NNSaliencyResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/saliency`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features, target_class }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Saliency failed" }));
    throw new Error(err.detail ?? "Saliency failed");
  }
  return res.json();
}

// ── NN Optimize: Pruning + Quantization ─────────────────────────────────────

export interface NNPruneResult {
  accuracy_before: number;
  accuracy_after: number;
  accuracy_delta: number;
  sparsity_requested: number;
  sparsity_actual: number;
  size_before: number;
  size_after: number;
  size_reduction_pct: number;
  committed: boolean;
}

export async function pruneNNModel(
  sparsity: number,
  scope: "global" | "per_layer" = "global",
  commit = false
): Promise<NNPruneResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/prune`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sparsity, scope, commit }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Pruning failed" }));
    throw new Error(err.detail ?? "Pruning failed");
  }
  return res.json();
}

export interface NNQuantizeResult {
  mode: string;
  accuracy_before: number;
  accuracy_after: number;
  accuracy_delta: number;
  size_before: number;
  size_after: number;
  size_reduction_pct: number;
  committed: boolean;
}

export async function quantizeNNModel(
  mode: "dynamic" | "fp16" = "dynamic",
  commit = false
): Promise<NNQuantizeResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/quantize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, commit }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Quantization failed" }));
    throw new Error(err.detail ?? "Quantization failed");
  }
  return res.json();
}

// ── NN Optimize: Checkpoints ─────────────────────────────────────────────────

export interface NNCheckpoint {
  filename: string;
  name: string;
  timestamp: number;
  val_acc: number | null;
  size_bytes: number;
  n_features: number | null;
  n_classes: number | null;
}

export async function saveNNCheckpoint(name: string): Promise<NNCheckpoint & { path: string }> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/checkpoint/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Save failed" }));
    throw new Error(err.detail ?? "Save failed");
  }
  const data = await res.json();
  
  // Sync to Django DB so it shows up in Django Admin and other DB-driven views
  try {
    await fetchWithAuth(`${DJANGO_API_BASE}/checkpoints/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        filename: data.filename,
        val_acc: data.val_acc,
        size_bytes: data.size_bytes,
        n_features: data.n_features,
        n_classes: data.n_classes,
      }),
    });
  } catch (e) {
    console.error("Failed to sync checkpoint to Django DB", e);
  }
  
  return data;
}

export async function listNNCheckpoints(): Promise<{ checkpoints: NNCheckpoint[] }> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/checkpoints`);
  if (!res.ok) throw new Error("Failed to list checkpoints");
  return res.json();
}

export async function loadNNCheckpoint(filename: string): Promise<{ loaded: boolean; filename: string; val_acc: number | null; n_features: number | null; n_classes: number | null; classes: string[] }> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/checkpoint/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Load failed" }));
    throw new Error(err.detail ?? "Load failed");
  }
  return res.json();
}

export async function deleteNNCheckpoint(filename: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/checkpoint`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Delete failed" }));
    throw new Error(err.detail ?? "Delete failed");
  }
}

// ── NN Inverse Design ────────────────────────────────────────────────────────

export interface NNConstraintSpec {
  lhs: Record<string, number>;   // {col: coefficient}
  op: "lt" | "gt";
  rhs: Record<string, number>;   // {col: coefficient}
  rhs_const?: number;
  penalty?: number;
  label?: string;
}

export interface NNConstraintViolation {
  label: string;
  lhs_val: number;
  rhs_val: number;
  op: "lt" | "gt";
  satisfied: boolean;
  margin: number;
}

export interface NNInverseDesignRequest {
  desired_outputs: Record<string, number>;
  n_steps?: number;
  lr?: number;
  init_features?: Record<string, number>;
  bounds?: Record<string, [number, number]>;
  feature_lock?: Record<string, number>;
  output_weights?: Record<string, number>;
  constraints?: NNConstraintSpec[];
  // Professional-grade parameters
  n_starts?: number;
  optimizer?: "adam" | "lbfgs";
  early_stopping?: boolean;
  patience?: number;
  constraint_method?: "penalty" | "augmented_lagrangian";
}

export interface NNInverseDesignResult {
  final_features: Record<string, number>;
  final_outputs: Record<string, number>;
  desired_outputs: Record<string, number>;
  loss_history: number[];
  penalty_history: number[];
  grad_norm_history: number[];
  constraint_violations: NNConstraintViolation[];
  final_loss: number;
  final_penalty: number;
  n_steps: number;
  feature_deltas: Record<string, number>;
  feature_cols: string[];
  target_cols: string[];
  // Professional-grade additions
  per_target_errors: Record<string, { desired: number; achieved: number; abs_error: number; rel_error_pct: number }>;
  sensitivity: Record<string, Record<string, number>>;
  jacobian: Record<string, Record<string, number>>;
  convergence_rate: number;
  all_starts: Array<{ start_idx: number; final_loss: number; is_best: boolean; steps_taken: number; final_outputs: Record<string, number> }>;
  optimizer_used: string;
  constraint_method_used: string;
  n_starts_used: number;
}

export async function solveInverseDesign(
  req: NNInverseDesignRequest
): Promise<NNInverseDesignResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/nn/inverse-design`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Inverse design failed" }));
    throw new Error(err.detail ?? "Inverse design failed");
  }
  return res.json();
}

export async function fetchPipelineTemplate(name: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/pipeline/templates/${name}`);
  if (!res.ok) throw new Error(`Template '${name}' not found`);
  return res.json();
}

export async function exportPDFReport(title: string = "Quasar Studio Report", data?: any): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, ...data }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to generate PDF report");
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report_${new Date().getTime()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

