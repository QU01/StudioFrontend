"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type IsValidConnection,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from "@xyflow/react";
import { DeleteableEdge } from "./DeleteableEdge";
import "@xyflow/react/dist/style.css";

import Prism from "prismjs";
import "prismjs/components/prism-python";

import { LAYER_META, defaultLayerParams, type LayerKind } from "./layerTypes";
import { onAgentEvent, type AgentNNDesign, type LoadArchitectureEvent } from "@/lib/agent-events";
import { SaveModal } from "@/components/ui/SaveModal";
import { NeuralNode, type NeuralNodeData } from "./NeuralNode";
import { NNToolbar } from "./NNToolbar";
import { NNConfigPanel } from "./NNConfigPanel";
import { TrainingMonitor } from "./TrainingMonitor";
import { runShapeEngine } from "./shapeEngine";
import { generatePyTorchCode } from "./codegenPyTorch";
import { toast } from "sonner";
import { Brain, FlaskConical, Settings2, Microscope, PenTool, Compass, ChevronDown, ChevronRight } from "lucide-react";
import { validateNNGraph, createNNTrainingWebSocket, fetchProfile, exportNNModel, saveNNGraph, fetchNNHistory, inspectNNModel } from "@/lib/api";
import type { NNTrainEvent, NNInspectResult } from "@/lib/api";
import { LabTab } from "./tabs/LabTab";
import { OptimizeTab } from "./tabs/OptimizeTab";
import { InspectTab } from "./tabs/InspectTab";
import { SolveTab } from "./tabs/SolveTab";
import { loadLatestArchitecture } from "@/lib/persistence";
import { getAccessToken, DJANGO_API_BASE, fetchWithAuth } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
const nodeTypes: NodeTypes = { nnLayer: NeuralNode };
const edgeTypes: EdgeTypes = { deleteable: DeleteableEdge };

const defaultEdgeOptions = {
  type: "deleteable",
  style: { stroke: "#3b82f6", strokeWidth: 1.5 },
};

const nextId = () => `nn-${crypto.randomUUID().slice(0, 8)}`;

// Merge node kinds that should not auto-sync their input params
const MERGE_KINDS = new Set<LayerKind>(["Add", "Concat"]);

// ─────────────────────────────────────────────────────────────────────────────
// ── Training config modal ────────────────────────────────────────────────────
import { type TrainConfig, TrainConfigModal } from "./TrainConfigModal";

const NN_LS_KEY = "quasar_nn_canvas";

function _loadCanvasFromLS() {
  if (typeof window === "undefined") return { nodes: [], edges: [] };
  try {
    const raw = localStorage.getItem(NN_LS_KEY);
    if (!raw) return { nodes: [], edges: [] };
    const parsed = JSON.parse(raw);
    return { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export function NeuralNetView({ activeView }: { activeView?: string }) {
  const _initial = _loadCanvasFromLS();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NeuralNodeData>>(_initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(_initial.edges);
  const rfInstanceRef = useRef<any>(null);

  const [nnTab, setNnTab] = useState<"design" | "lab" | "optimize" | "inspect" | "solve">("design");

  const [selectedNodeId, setSelectedNodeId]     = useState<string | null>(null);

  const [inputShape, setInputShape]             = useState<number[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(NN_LS_KEY) : null;
      return raw ? (JSON.parse(raw).inputShape ?? [1, 784]) : [1, 784];
    } catch { return [1, 784]; }
  });
  const [isValidating, setIsValidating]         = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message?: string } | null>(null);
  const [codeExpanded, setCodeExpanded]         = useState(false);
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 });

  // ── Load most recently saved architecture from Django on mount ───────────
  useEffect(() => {
    loadLatestArchitecture().then((arch) => {
      if (arch?.config?.nodes && arch.config.nodes.length > 0) {
        archIdRef.current = arch.id;
        setNodes(arch.config.nodes);
        setEdges(arch.config.edges ?? []);
        if (arch.config.inputShape) setInputShape(arch.config.inputShape);
      }
      // If no Django data, the component already initialized from localStorage (lines above)
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Training state ───────────────────────────────────────────────────────
  const [showTrainModal, setShowTrainModal]   = useState(false);
  const [isSaveArchModalOpen, setIsSaveArchModalOpen] = useState(false);
  const [showFeatureSelect, setShowFeatureSelect] = useState(false);
  const [datasetCols, setDatasetCols]         = useState<string[]>([]);
  const [trainConfig, setTrainConfig]         = useState<TrainConfig>({
    target: "", target_cols: [], feature_cols: [], task: "classification",
    epochs: 30, lr: 0.001, batch_size: 32, use_pinn: false, physics_weight: 0.1,
  });
  const [trainingStatus, setTrainingStatus]   = useState<"idle" | "training" | "done" | "error">("idle");
  const [trainMeta, setTrainMeta]             = useState<Parameters<typeof TrainingMonitor>[0]["meta"]>(null);
  const [trainEpochs, setTrainEpochs]         = useState<Parameters<typeof TrainingMonitor>[0]["epochs"]>([]);
  const [trainDone, setTrainDone]             = useState<Parameters<typeof TrainingMonitor>[0]["done"]>(null);
  const [trainError, setTrainError]           = useState<string | null>(null);
  const [monitorExpanded, setMonitorExpanded] = useState(false);
  const [loadedSolution, setLoadedSolution]   = useState<any>(null);
  const wsRef = useRef<{ stop: () => void } | null>(null);
  const archIdRef = useRef<number | null>(null);
  const archAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Inspector state ──────────────────────────────────────────────────────
  const [inspectorTab, setInspectorTab]         = useState<"layer" | "model">("layer");
  const [inspectType, setInspectType]           = useState<"weights" | "activations" | "gradients">("weights");
  const [inspectResult, setInspectResult]       = useState<NNInspectResult | null>(null);
  const [isInspecting, setIsInspecting]         = useState(false);

  // ── Shape inference ──────────────────────────────────────────────────────
  const shapeMap = useMemo(
    () => runShapeEngine(nodes, edges, inputShape),
    [nodes, edges, inputShape]
  );

  // ── Edge error map: edge id → error message ──────────────────────────────
  // An edge is "in error" if the source node has an error in shapeMap
  // or the target node has an error that is due to shape mismatch.
  const edgeErrorMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const edge of edges) {
      const sourceInfo = shapeMap.get(edge.source);
      const targetInfo = shapeMap.get(edge.target);
      const hasError = !!(sourceInfo?.error || targetInfo?.error);
      map.set(edge.id, hasError);
    }
    return map;
  }, [edges, shapeMap]);

  // ── PyTorch code with Prism syntax highlighting ──────────────────────────
  const rawCode = useMemo(() => generatePyTorchCode(nodes, edges), [nodes, edges]);
  const highlightedCode = useMemo(() => {
    try {
      return Prism.highlight(rawCode, Prism.languages.python, "python");
    } catch {
      return rawCode;
    }
  }, [rawCode]);

  // ── Enrich nodes with shape info ─────────────────────────────────────────
  const enrichedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, shapeInfo: shapeMap.get(n.id) },
      })),
    [nodes, shapeMap]
  );

  // ── Enrich edges with error color ────────────────────────────────────────
  const enrichedEdges = useMemo(
    () =>
      edges.map((e) => {
        const hasError = edgeErrorMap.get(e.id) ?? false;
        return {
          ...e,
          style: {
            ...(e.style ?? {}),
            stroke: hasError ? "#ef4444" : "#3b82f6",
            strokeWidth: hasError ? 2 : 1.5,
            filter: hasError ? "drop-shadow(0 0 4px #ef444488)" : undefined,
          },
        };
      }),
    [edges, edgeErrorMap]
  );

  // ── Selected node (for inspector) ────────────────────────────────────────
  const selectedNode = useMemo(
    () => selectedNodeId ? (enrichedNodes.find((n) => n.id === selectedNodeId) ?? null) : null,
    [enrichedNodes, selectedNodeId]
  );

  // ── React Flow selection → inspector sync ────────────────────────────────
  const onSelectionChange = useCallback(
    ({ nodes: selNodes }: OnSelectionChangeParams) => {
      setSelectedNodeId(selNodes.length > 0 ? selNodes[selNodes.length - 1].id : null);
    },
    []
  );

  // ── Auto-sync input params from inferred shapes ──────────────────────────
  // Only applies to single-input parametric layers (not Add/Concat merge nodes).
  useEffect(() => {
    setNodes((nds) => {
      let hasChanges = false;
      const nextNodes = nds.map((n) => {
        // Skip merge nodes
        if (MERGE_KINDS.has(n.data.kind)) return n;

        const info = shapeMap.get(n.id);
        if (!info?.inputShape || info.error) return n;
        const shape = info.inputShape;
        const params = n.data.params;
        let updated: Record<string, unknown> | null = null;

        if (n.data.kind === "Linear") {
          const auto = shape[shape.length - 1];
          if (auto > 0 && auto !== params.in_features) {
            updated = { ...params, in_features: auto };
          }
        } else if (n.data.kind === "Conv2d") {
          const auto = shape.length >= 3 ? shape[shape.length - 3] : null;
          if (auto && auto > 0 && auto !== params.in_channels) {
            updated = { ...params, in_channels: auto };
          }
        } else if (n.data.kind === "MaxPool2d") {
          // MaxPool2d has no input-dependent params — no sync needed
        } else if (n.data.kind === "BatchNorm") {
          const auto = shape[shape.length - 1];
          if (auto > 0 && auto !== params.num_features) {
            updated = { ...params, num_features: auto };
          }
        }

        if (updated) {
          hasChanges = true;
          return { ...n, data: { ...n.data, params: updated } };
        }
        return n;
      });

      return hasChanges ? nextNodes : nds;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeMap]);

  // ── Add layer ────────────────────────────────────────────────────────────
  const addLayer = useCallback(
    (kind: LayerKind) => {
      const id = nextId();
      const { x, y, zoom } = viewportRef.current;
      const newNode: Node<NeuralNodeData> = {
        id,
        type: "nnLayer",
        position: {
          x: (-x + 300) / zoom + Math.random() * 60 - 30,
          y: (-y + 180) / zoom + Math.random() * 60 - 30,
        },
        data: { kind, params: defaultLayerParams(kind) },
      };
      setNodes((nds) => [...nds, newNode]);
      setValidationResult(null);
    },
    [setNodes]
  );

  // ── Delete selected node ─────────────────────────────────────────────────
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
    );
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges]);

  // ── Clear canvas ─────────────────────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setValidationResult(null);
    try { localStorage.removeItem(NN_LS_KEY); } catch { /* ignore */ }
  }, [setNodes, setEdges]);

  // ── Re-fit when this view becomes visible ───────────────────────────────
  useEffect(() => {
    if (activeView === "neural" && rfInstanceRef.current && nodes.length > 0) {
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.1 }), 50);
    }
  }, [activeView, nodes.length]);

  // ── Persist canvas to localStorage on every change ──────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(NN_LS_KEY, JSON.stringify({ nodes, edges, inputShape }));
    } catch { /* quota exceeded or SSR */ }
  }, [nodes, edges, inputShape]);

  // ── Auto-save architecture to Django 2 seconds after the last change ────
  useEffect(() => {
    if (nodes.length === 0 || !getAccessToken()) return;
    clearTimeout(archAutoSaveTimerRef.current);
    archAutoSaveTimerRef.current = setTimeout(async () => {
      const id = archIdRef.current;
      const config = { nodes, edges, inputShape };
      try {
        const url = id
          ? `${DJANGO_API_BASE}/architectures/${id}/`
          : `${DJANGO_API_BASE}/architectures/`;
        const method = id ? "PATCH" : "POST";
        const res = await fetchWithAuth(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Autosave", config }),
        });
        if (res.ok && !id) {
          const body = await res.json().catch(() => ({}));
          if (body?.id) archIdRef.current = body.id;
        }
      } catch {
        // silent — auto-save is best-effort
      }
    }, 2000);
    return () => clearTimeout(archAutoSaveTimerRef.current);
  }, [nodes, edges, inputShape]);

  // ── Load training history ───────────────────────────────────────────────
  const reloadTrainingHistory = useCallback(() => {
    fetchNNHistory().then((data) => {
      if (data.has_model && data.history.length > 0) {
        const epochs = data.history.map((e) => ({
          epoch: e.epoch,
          train_loss: e.train_loss,
          train_acc: e.train_acc,
          val_loss: e.val_loss,
          val_acc: e.val_acc,
          val_r2: e.val_r2,
          val_rmse: e.val_rmse,
        }));
        setTrainEpochs(epochs);
        const lastEpoch = epochs[epochs.length - 1];
        const meta = data.meta as Record<string, unknown> | null;
        if (meta) {
          setTrainMeta({
            total_epochs: epochs.length,
            n_features: Number(meta.n_features ?? 0),
            n_classes: Number(meta.n_classes ?? meta.n_outputs ?? 0),
            train_samples: 0,
            val_samples: 0,
            device: "cpu",
          });
          setTrainDone({
            val_acc: lastEpoch.val_acc,
            val_r2: lastEpoch.val_r2,
            val_rmse: lastEpoch.val_rmse,
            val_loss: lastEpoch.val_loss,
            n_classes: Number(meta.n_classes ?? meta.n_outputs ?? 0),
            classes: (meta.classes as string[]) ?? [],
          });
        }
        setTrainingStatus("done");
        setTrainingStatus("done");
      } else if (data.has_model && data.history.length === 0) {
        // Fallback: we have a model but no history (e.g. loaded checkpoint or pipeline sync without epoch history)
        const meta = data.meta as Record<string, unknown> | null;
        if (meta) {
          setTrainMeta({
            total_epochs: 1,
            n_features: Number(meta.n_features ?? 0),
            n_classes: Number(meta.n_classes ?? meta.n_outputs ?? 0),
            train_samples: 0,
            val_samples: 0,
            device: "cpu",
          });
          setTrainDone({
            val_acc: 0,
            val_r2: 0,
            val_rmse: 0,
            val_loss: 0,
            n_classes: Number(meta.n_classes ?? meta.n_outputs ?? 0),
            classes: (meta.classes as string[]) ?? [],
          });
        }
        setTrainingStatus("done");
      }
    }).catch(() => { /* ignore — no history yet */ });
  }, []);

  useEffect(() => {
    reloadTrainingHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Agent event: Checkpoint loaded ───────────────────────────────────────
  useEffect(() => {
    return onAgentEvent("nn:checkpointLoaded", () => {
      reloadTrainingHistory();
    });
  }, [reloadTrainingHistory]);

  // ── Agent event: Solution loaded ─────────────────────────────────────────
  useEffect(() => {
    return onAgentEvent("nn:solutionLoaded", (detail: any) => {
      setLoadedSolution(detail);
      setNnTab("solve");
    });
  }, []);

  // ── Agent event: update from pipeline ──────────────────────────────────
  useEffect(() => {
    return onAgentEvent("nn:trainComplete", () => {
      reloadTrainingHistory();
    });
  }, [reloadTrainingHistory]);

  // ── Refetch when navigating to view ──────────────────────────────────────
  useEffect(() => {
    if (activeView === "neural") {
      reloadTrainingHistory();
    }
  }, [activeView, reloadTrainingHistory]);

  // ── Agent event: design neural network ──────────────────────────────────
  useEffect(() => {
    return onAgentEvent<AgentNNDesign>("nn:design", (detail) => {
      // Clear current canvas
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      setValidationResult(null);

      if (detail.inputShape) {
        setInputShape(detail.inputShape);
      }

      const validLayers = detail.layers.filter((l) => LAYER_META[l.kind as LayerKind]);
      if (validLayers.length === 0) return;

      const newNodes: Node<NeuralNodeData>[] = validLayers.map((layer, i) => ({
        id: `nn-agent-${i}`,
        type: "nnLayer",
        position: { x: 260, y: 60 + i * 120 },
        data: {
          kind: layer.kind as LayerKind,
          params: { ...defaultLayerParams(layer.kind as LayerKind), ...layer.params },
          agentAdded: true,
        },
      }));

      const newEdges: Edge[] = validLayers.slice(0, -1).map((_, i) => ({
        id: `nn-agent-edge-${i}`,
        source: `nn-agent-${i}`,
        target: `nn-agent-${i + 1}`,
        type: "deleteable",
        style: { stroke: "#3b82f6", strokeWidth: 1.5 },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Agent event: load saved architecture ────────────────────────────────
  useEffect(() => {
    return onAgentEvent<LoadArchitectureEvent>("architecture:load", (detail) => {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      setValidationResult(null);

      if (detail.config?.inputShape) {
        setInputShape(detail.config.inputShape);
      }

      const savedNodes: any[] = detail.config?.nodes ?? [];
      const savedEdges: any[] = detail.config?.edges ?? [];

      const newNodes: Node<NeuralNodeData>[] = savedNodes
        .filter((n) => LAYER_META[n.kind as LayerKind])
        .map((n, i) => ({
          id: n.id ?? `nn-load-${i}`,
          type: "nnLayer",
          position: { x: 260, y: 60 + i * 120 },
          data: {
            kind: n.kind as LayerKind,
            params: { ...defaultLayerParams(n.kind as LayerKind), ...n.params },
          },
        }));

      const newEdges: Edge[] = savedEdges.map((e, i) => ({
        id: `nn-load-edge-${i}`,
        source: e.source,
        target: e.target,
        type: "deleteable",
        style: { stroke: "#3b82f6", strokeWidth: 1.5 },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Connect nodes ─────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => connection.source !== connection.target,
    []
  );

  // ── Update layer params ──────────────────────────────────────────────────
  const updateParams = useCallback(
    (nodeId: string, params: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, params } } : n))
      );
    },
    [setNodes]
  );

  // ── Backend validate ─────────────────────────────────────────────────────
  const handleValidate = useCallback(async () => {
    if (nodes.length === 0) {
      setValidationResult({ valid: false, message: "Canvas is empty" });
      return;
    }
    setIsValidating(true);
    setValidationResult(null);
    try {
      const result = await validateNNGraph({
        nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, params: n.data.params })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
        input_shape: inputShape,
      });
      setValidationResult({
        valid: result.valid,
        message: result.error ?? result.output_shape?.join("×"),
      });
      // Persist graph for pipeline trainNeuralNetwork node
      if (result.valid) {
        saveNNGraph({
          nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, params: n.data.params })),
          edges: edges.map((e) => ({ source: e.source, target: e.target })),
        }).catch(() => { /* non-critical */ });
      }
    } catch (err) {
      setValidationResult({
        valid: false,
        message: err instanceof Error ? err.message : "Validation failed",
      });
    } finally {
      setIsValidating(false);
    }
  }, [nodes, edges, inputShape]);

  // ── Save Architecture ────────────────────────────────────────────────────
  const doSaveArchitecture = useCallback(async (name: string, description: string) => {
    try {
      const config = {
        inputShape,
        nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, params: n.data.params })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
      };

      const { DJANGO_API_BASE, fetchWithAuth } = await import("@/lib/auth");
      const res = await fetchWithAuth(`${DJANGO_API_BASE}/architectures/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, config }),
      });

      if (res.ok) {
        toast.success("Architecture saved successfully!");
      } else {
        toast.error("Failed to save architecture");
      }
    } catch (err) {
      toast.error("Error saving architecture");
    }
  }, [inputShape, nodes, edges]);

  const handleSaveArchitecture = useCallback(() => setIsSaveArchModalOpen(true), []);

  // ── Open train modal — fetch dataset columns ────────────────────────────
  const openTrainModal = useCallback(async () => {
    try {
      const profile = await fetchProfile();
      const cols = profile.columns.map((c) => c.name);
      setDatasetCols(cols);
      // Auto-detect: if target not yet set, pick last column and detect task
      if (!trainConfig.target && cols.length > 0) {
        const lastCol = cols[cols.length - 1];
        const lastColInfo = profile.columns[profile.columns.length - 1];
        // Heuristic: numeric dtype → regression, else classification
        const isNumeric = lastColInfo?.dtype
          ? ["int", "float", "number"].some((t) => lastColInfo.dtype.toLowerCase().includes(t))
          : false;
        const defaultTask = isNumeric ? "regression" : "classification";
        setTrainConfig((prev) => ({
          ...prev,
          target: lastCol,
          target_cols: [lastCol],
          task: defaultTask,
        }));
      }
    } catch {
      setDatasetCols([]);
    }
    setShowTrainModal(true);
  }, [trainConfig.target]);

  // ── Model inspector ──────────────────────────────────────────────────────
  const handleInspect = useCallback(async (type: "weights" | "activations" | "gradients") => {
    setInspectType(type);
    setIsInspecting(true);
    setInspectResult(null);
    try {
      const result = await inspectNNModel(type);
      setInspectResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inspection failed");
    } finally {
      setIsInspecting(false);
    }
  }, []);

  // ── Start training ───────────────────────────────────────────────────────
  const handleStartTraining = useCallback(() => {
    if (nodes.length === 0) return;
    // Persist graph for pipeline node before training
    saveNNGraph({
      nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, params: n.data.params })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    }).catch(() => { /* non-critical */ });
    setShowTrainModal(false);
    setTrainingStatus("training");
    setTrainEpochs([]);
    setTrainMeta(null);
    setTrainDone(null);
    setTrainError(null);
    setMonitorExpanded(true);

    const config = {
      nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, params: n.data.params })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
      target: trainConfig.task === "classification" ? trainConfig.target : (trainConfig.target_cols[0] ?? ""),
      target_cols: trainConfig.task === "regression" ? trainConfig.target_cols : [trainConfig.target],
      feature_cols: trainConfig.feature_cols.length > 0 ? trainConfig.feature_cols : undefined,
      task: trainConfig.task,
      epochs: trainConfig.epochs,
      lr: trainConfig.lr,
      batch_size: trainConfig.batch_size,
      pinn_config: trainConfig.use_pinn ? { physics_weight: trainConfig.physics_weight } : undefined,
    };

    wsRef.current = createNNTrainingWebSocket(config, (event: NNTrainEvent) => {
      if (event.type === "start") {
        setTrainMeta({
          total_epochs: event.total_epochs,
          n_features: event.n_features,
          n_classes: event.n_classes,
          train_samples: event.train_samples,
          val_samples: event.val_samples,
          device: event.device,
        });
      } else if (event.type === "epoch") {
        setTrainEpochs((prev) => [...prev, {
          epoch: event.epoch,
          train_loss: event.train_loss,
          train_acc: event.train_acc,
          val_loss: event.val_loss,
          val_acc: event.val_acc,
          val_r2: event.val_r2,
          val_rmse: event.val_rmse,
        }]);
      } else if (event.type === "done") {
        setTrainingStatus("done");
        const isReg = event.task === "regression";
        setTrainDone({
          val_acc: event.val_acc,
          val_r2: event.val_r2,
          val_rmse: event.val_rmse,
          val_loss: event.val_loss,
          n_classes: event.n_classes ?? event.n_outputs ?? 0,
          classes: event.classes ?? event.target_cols ?? [],
        });
        const metric = isReg
          ? event.val_r2 != null ? `R² ${(event.val_r2 * 100).toFixed(1)}%` : `loss ${event.val_loss.toFixed(4)}`
          : event.val_acc != null ? `${event.val_acc.toFixed(1)}% accuracy` : `loss ${event.val_loss.toFixed(4)}`;
        toast.success(`Training complete — ${metric}`);
        wsRef.current = null;
      } else if (event.type === "error") {
        setTrainingStatus("error");
        setTrainError(event.message);
        toast.error(`Training failed: ${event.message}`);
        wsRef.current = null;
      }
    });
  }, [nodes, edges, trainConfig]);

  // ── Stop training ────────────────────────────────────────────────────────
  const handleStopTraining = useCallback(() => {
    wsRef.current?.stop();
    wsRef.current = null;
    setTrainingStatus("idle");
  }, []);

  // ── Derived: does the user have a trained model? ─────────────────────────
  const hasModel = trainingStatus === "done";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ── Top-level tab bar ── */}
      <div
        className="flex shrink-0 items-center px-2 gap-1"
        style={{
          background: "linear-gradient(180deg, #151c28 0%, #111720 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          minHeight: 44,
        }}
      >
        {(["design", "lab", "optimize", "inspect", "solve"] as const).map((tab) => {
          const meta = {
            design:   { label: "Design",   color: "#3b82f6", Icon: PenTool },
            lab:      { label: "Lab",      color: "#22c55e", Icon: FlaskConical },
            optimize: { label: "Optimize", color: "#8b5cf6", Icon: Settings2 },
            inspect:  { label: "Inspect",  color: "#f59e0b", Icon: Microscope },
            solve:    { label: "Solve",    color: "#06b6d4", Icon: Compass },
          }[tab];
          const active = nnTab === tab;
          const disabled = tab !== "design" && !hasModel && !(tab === "solve" && loadedSolution);
          return (
            <button
              key={tab}
              onClick={() => !disabled && setNnTab(tab)}
              disabled={disabled}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10.5px] font-bold uppercase tracking-widest transition-all relative disabled:opacity-25 disabled:cursor-not-allowed"
              style={{
                background: active ? `${meta.color}14` : "transparent",
                color: active ? meta.color : "rgba(255,255,255,0.3)",
                border: active ? `1px solid ${meta.color}28` : "1px solid transparent",
                boxShadow: active ? `0 0 12px ${meta.color}14` : "none",
              }}
              title={disabled ? "Train a model first in the Design tab" : undefined}
            >
              <meta.Icon size={12} />
              {meta.label}
            </button>
          );
        })}
        <div className="flex-1" />
        {hasModel && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest"
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.18)",
              color: "#4ade80",
            }}
            title="A trained model is loaded"
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#4ade80", boxShadow: "0 0 5px #4ade80" }}
            />
            Model ready
          </div>
        )}
      </div>

      {/* ── Non-Design tabs ── */}
      {nnTab === "lab" && (
        <div className="flex-1 min-h-0">
          <LabTab hasModel={hasModel} />
        </div>
      )}
      {nnTab === "optimize" && (
        <div className="flex-1 min-h-0 flex">
          <OptimizeTab hasModel={hasModel} />
        </div>
      )}
      {nnTab === "inspect" && (
        <div className="flex-1 min-h-0">
          <InspectTab hasModel={hasModel} />
        </div>
      )}
      {nnTab === "solve" && (
        <div className="flex-1 min-h-0 flex">
          <SolveTab hasModel={hasModel} loadedSolution={loadedSolution} />
        </div>
      )}

      {/* ── Design tab — always mounted so ReactFlow state is preserved ── */}
      <div
        className="flex-1 min-h-0"
        style={{ display: nnTab === "design" ? "flex" : "none" }}
      >
      <div className="flex h-full w-full">
      {/* ── Left toolbar / layer catalog ── */}
      <NNToolbar
        inputShape={inputShape}
        onInputShapeChange={setInputShape}
        onAddLayer={addLayer}
        onClear={clearCanvas}
        onValidate={handleValidate}
        onTrain={openTrainModal}
        onSaveSetup={handleSaveArchitecture}
        isValidating={isValidating}
        isTraining={trainingStatus === "training"}
        validationResult={validationResult}
      />

      {/* ── Canvas ── */}
      <div className="flex-1 min-w-0 relative flex flex-col">
        <ReactFlow
          nodes={enrichedNodes}
          edges={enrichedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          isValidConnection={isValidConnection}
          deleteKeyCode={["Backspace", "Delete"]}
          connectionLineStyle={{ stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "5 5" }}
          fitView
          style={{ background: "#181d23" }}
          // @ts-ignore
          onInit={(instance: any) => { rfInstanceRef.current = instance; }}
          onMove={(_, viewport) => { viewportRef.current = viewport; }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="#2a3240" gap={24} size={1.5} />
          <Controls style={{ background: "transparent", border: "none", boxShadow: "none" }} />
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none select-none">
              <Brain size={48} className="text-white/10 mb-3" />
              <p className="text-white/30 text-sm font-medium">Add layers from the toolbar to design your network</p>
              <p className="text-white/20 text-xs mt-1">or ask QUO to design one for you</p>
            </div>
          )}
          <MiniMap
            style={{ background: "#1a2030", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
            maskColor="rgba(0,0,0,0.6)"
            nodeColor={(n) => {
              const d = n.data as NeuralNodeData;
              return LAYER_META[d.kind]?.color ?? "#444";
            }}
          />
        </ReactFlow>

        {/* ── Bottom panel: PyTorch Code / Training Monitor ── */}
        {trainingStatus !== "idle" ? (
          /* Training Monitor */
          <div
            className="shrink-0 border-t overflow-hidden transition-all duration-300"
            style={{
              borderColor: "rgba(34,197,94,0.2)",
              background: "#1a2030",
              height: monitorExpanded ? "320px" : "36px",
            }}
          >
            <button
              onClick={() => setMonitorExpanded((v) => !v)}
              className="w-full flex items-center gap-2 px-4 h-[36px] text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-[#22c55e] transition-colors"
              style={{ borderBottom: monitorExpanded ? "1px solid rgba(34,197,94,0.15)" : "none" }}
            >
              <span
                className="text-[#22c55e] opacity-70"
                style={{
                  transform: monitorExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  display: "inline-block",
                  transition: "transform 0.2s",
                }}
              >▶</span>
              Training Monitor
              {trainingStatus === "training" && trainMeta && (
                <span className="ml-2 text-[9px] text-[#22c55e]/60 normal-case">
                  epoch {trainEpochs.length} / {trainMeta.total_epochs}
                </span>
              )}
              {trainingStatus === "done" && trainDone && (
                <span className="ml-2 text-[9px] text-[#22c55e] normal-case font-normal">
                  {trainDone.val_r2 != null
                    ? `✓ R² ${(trainDone.val_r2 * 100).toFixed(1)}%`
                    : trainDone.val_acc != null
                    ? `✓ ${trainDone.val_acc.toFixed(1)}% accuracy`
                    : `✓ loss ${trainDone.val_loss.toFixed(4)}`}
                </span>
              )}
            </button>
            {monitorExpanded && (
              <div className="h-[calc(320px-36px)] overflow-hidden">
                <TrainingMonitor
                  status={trainingStatus}
                  meta={trainMeta}
                  epochs={trainEpochs}
                  done={trainDone}
                  error={trainError}
                  onStop={handleStopTraining}
                  onExport={(format) => exportNNModel(format).catch((e) => console.error("Export failed:", e))}
                />
              </div>
            )}
          </div>
        ) : (
          /* PyTorch Code Panel */
          <div
            className="shrink-0 border-t overflow-hidden transition-all duration-300"
            style={{
              borderColor: "rgba(59,130,246,0.2)",
              background: "#1a2030",
              height: codeExpanded ? "240px" : "36px",
            }}
          >
            <button
              onClick={() => setCodeExpanded((v) => !v)}
              className="w-full flex items-center gap-2 px-4 h-[36px] text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-[#3b82f6] transition-colors"
              style={{ borderBottom: codeExpanded ? "1px solid rgba(59,130,246,0.15)" : "none" }}
            >
              <span
                className="text-[#3b82f6] opacity-70"
                style={{
                  transform: codeExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  display: "inline-block",
                  transition: "transform 0.2s",
                }}
              >▶</span>
              PyTorch Code Preview
              {nodes.length > 0 && (
                <span className="ml-auto text-[9px] text-white/20 normal-case tracking-normal font-normal">
                  {nodes.length} layer{nodes.length !== 1 ? "s" : ""}
                </span>
              )}
            </button>
            {codeExpanded && (
              <div className="overflow-auto h-[calc(240px-36px)] custom-scrollbar">
                <pre
                  className="text-[11px] leading-relaxed p-4 font-mono"
                  style={{ whiteSpace: "pre", minWidth: "max-content" }}
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right config panel ── */}
      <div className="w-[280px] shrink-0 bg-[#222a35] border-l border-white/5 flex flex-col">
        {/* Panel tabs */}
        <div className="flex border-b border-white/5 shrink-0">
          <button
            onClick={() => setInspectorTab("layer")}
            className="flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-colors"
            style={{ color: inspectorTab === "layer" ? "#3b82f6" : "rgba(255,255,255,0.3)", borderBottom: inspectorTab === "layer" ? "2px solid #3b82f6" : "2px solid transparent" }}
          >
            Layer
          </button>
          <button
            onClick={() => setInspectorTab("model")}
            disabled={trainingStatus !== "done"}
            className="flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-colors disabled:opacity-30"
            style={{ color: inspectorTab === "model" ? "#22c55e" : "rgba(255,255,255,0.3)", borderBottom: inspectorTab === "model" ? "2px solid #22c55e" : "2px solid transparent" }}
          >
            Inspect
          </button>
        </div>

        {inspectorTab === "layer" ? (
          <>
            <div className="px-4 py-2 border-b border-white/5 shrink-0 flex items-center justify-between">
              <div className="text-[11px] text-white/40">Layer Inspector</div>
              {selectedNodeId && (
                <button
                  onClick={deleteSelectedNode}
                  className="text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-400/10 px-2 py-1 rounded transition-all"
                  title="Delete selected layer"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <NNConfigPanel
                node={selectedNode as Node<NeuralNodeData> | null}
                onParamsChange={updateParams}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {/* Inspect type selector */}
            <div className="flex gap-1">
              {(["weights", "activations", "gradients"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleInspect(t)}
                  disabled={isInspecting}
                  className="flex-1 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
                  style={{
                    background: inspectType === t && inspectResult ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${inspectType === t && inspectResult ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)"}`,
                    color: inspectType === t && inspectResult ? "#22c55e" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {isInspecting && inspectType === t ? "…" : t.slice(0, 4)}
                </button>
              ))}
            </div>

            {!inspectResult && !isInspecting && (
              <p className="text-[11px] text-white/30 text-center py-4">Click a button above to inspect the model</p>
            )}

            {isInspecting && (
              <p className="text-[11px] text-white/50 text-center py-4 animate-pulse">Analyzing model…</p>
            )}

            {inspectResult && !isInspecting && inspectResult.layers.map((layer, i) => {
              const name = String(layer.name ?? `layer_${i}`);
              const meanAbs = (layer as Record<string, unknown>).mean_abs ?? (layer as Record<string, unknown>).mean;
              const isVanishing = (layer as Record<string, unknown>).vanishing === true;
              const isExploding = (layer as Record<string, unknown>).exploding === true;
              const isDead = (layer as Record<string, unknown>).dead_neurons === true;
              const pctZeros = (layer as Record<string, unknown>).pct_zeros;
              const shape = (layer as Record<string, unknown>).shape as number[] | undefined;

              return (
                <div key={i} className="rounded-lg p-2 space-y-1" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${isVanishing ? "rgba(239,68,68,0.3)" : isExploding ? "rgba(249,115,22,0.3)" : isDead ? "rgba(234,179,8,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/60 truncate">{name}</span>
                    {(isVanishing || isExploding || isDead) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: isExploding ? "rgba(249,115,22,0.2)" : isVanishing ? "rgba(239,68,68,0.2)" : "rgba(234,179,8,0.2)", color: isExploding ? "#f97316" : isVanishing ? "#ef4444" : "#eab308" }}>
                        {isExploding ? "EXPLODING" : isVanishing ? "VANISHING" : "DEAD"}
                      </span>
                    )}
                  </div>
                  {shape && <div className="text-[9px] text-white/30">shape: [{(shape as number[]).join(", ")}]</div>}
                  {meanAbs !== undefined && (
                    <div className="text-[10px] text-white/50">
                      mean: <span className="text-white/80">{Number(meanAbs).toExponential(3)}</span>
                      {typeof layer.std === "number" && <span className="ml-2 text-white/30">std: {(layer.std as number).toExponential(3)}</span>}
                    </div>
                  )}
                  {pctZeros !== undefined && (
                    <div className="text-[10px]" style={{ color: Number(pctZeros) > 50 ? "#eab308" : "rgba(255,255,255,0.4)" }}>
                      zeros: {Number(pctZeros).toFixed(1)}%
                    </div>
                  )}
                </div>
              );
            })}

            {inspectResult?.type === "gradients" && typeof inspectResult.loss === "number" && (
              <div className="text-[10px] text-white/40 text-center">Loss: {inspectResult.loss.toFixed(4)}</div>
            )}
          </div>
        )}
      </div>

      {/* ── Training config modal ── */}
      <TrainConfigModal
        isOpen={showTrainModal}
        onClose={() => setShowTrainModal(false)}
        datasetCols={datasetCols}
        trainConfig={trainConfig as any}
        setTrainConfig={setTrainConfig as any}
        onConfirm={handleStartTraining}
      />
      </div>
      </div>

      <SaveModal
        isOpen={isSaveArchModalOpen}
        onClose={() => setIsSaveArchModalOpen(false)}
        onSave={doSaveArchitecture}
        title="Save Architecture"
        descriptionLabel="Architecture Description"
      />
    </div>
  );
}
