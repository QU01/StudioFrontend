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
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { toast } from "sonner";
import { Workflow } from "lucide-react";
import { fetchProfile, executePipeline } from "@/lib/api";
import { DJANGO_API_BASE, fetchWithAuth, getAccessToken } from "@/lib/auth";
import { loadLatestPipeline } from "@/lib/persistence";
import { NODE_META, defaultParams, type NodeKind, type DatasetInfo } from "./nodeTypes";
import { onAgentEvent, agentNNTrainComplete, type AgentAddPipelineNode, type AgentDataLoaded, type LoadPipelineEvent } from "@/lib/agent-events";
import { PipelineNode, type PipelineNodeData } from "./nodes/PipelineNode";
import { Toolbar } from "./Toolbar";
import { AutoMLPanel } from "./AutoMLPanel";
import { ConfigPanel } from "./ConfigPanel";
import { DeleteableEdge } from "./DeleteableEdge";
import { DataPreviewModal } from "./DataPreviewModal";
import { SaveModal } from "@/components/ui/SaveModal";
import { useDemoStore } from "@/store/demoStore";
import { DemoOverlay } from "@/components/demo/DemoOverlay";

const nodeTypes: NodeTypes = {
  pipeline: PipelineNode,
};

const edgeTypes: EdgeTypes = {
  deleteable: DeleteableEdge,
};

let _nodeCounter = 0;
function nextId() {
  return `node-${++_nodeCounter}`;
}

const defaultEdgeOptions = {
  type: "deleteable",
  style: { stroke: "#007bff", strokeWidth: 1.5 },
  animated: false,
};

export function PipelineView({ activeView }: { activeView?: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PipelineNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isAutoMLOpen, setIsAutoMLOpen] = useState(false);
  // When true, the modal is for "Save As" (forces creating a new pipeline even if one is loaded)
  const [saveAsMode, setSaveAsMode] = useState(false);
  // Metadata of the pipeline currently loaded/saved (null when the canvas has never been saved)
  const [currentPipelineId, setCurrentPipelineId] = useState<number | null>(null);
  const [currentPipelineName, setCurrentPipelineName] = useState<string>("");
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 });
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentPipelineIdRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { isDemoMode, toggle: toggleDemo, setCurrent: demoSetCurrent } = useDemoStore();

  // Re-fit only when this view becomes visible (not every time the node count changes —
  // that would snap the viewport back every time the user adds a node).
  useEffect(() => {
    if (activeView === "pipeline" && rfInstanceRef.current && nodes.length > 0) {
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.1 }), 50);
    }
    // Intentionally omit nodes.length from deps — only trigger on view switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  // Keep ref in sync with state so auto-save closure always sees the current id
  useEffect(() => {
    currentPipelineIdRef.current = currentPipelineId;
  }, [currentPipelineId]);

  // Load the most recently saved pipeline from Django on mount
  useEffect(() => {
    loadLatestPipeline().then((pipeline) => {
      if (!pipeline || pipeline.nodes.length === 0) return;
      setCurrentPipelineId(pipeline.id);
      setCurrentPipelineName(pipeline.name ?? "");
      const reconstructed = pipeline.nodes.map((n: any, i: number) => ({
        id: n.id,
        type: "pipeline" as const,
        position: n.position ?? { x: 200, y: 80 + i * 130 },
        data: {
          kind: n.kind,
          params: n.params ?? defaultParams(n.kind),
          datasetInfo: undefined,
          status: "idle" as const,
          result: undefined,
        },
      }));
      const reconstructedEdges = (pipeline.edges ?? []).map((e: any) => ({
        id: `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        ...defaultEdgeOptions,
      }));
      setNodes(reconstructed);
      setEdges(reconstructedEdges);
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.1 }), 100);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save pipeline to Django 2 seconds after the last change
  useEffect(() => {
    if (nodes.length === 0 || !getAccessToken()) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const id = currentPipelineIdRef.current;
      const name = currentPipelineName || "Autosave";
      const serializedNodes = nodes.map((n) => ({
        id: n.id,
        kind: n.data.kind as string,
        params: n.data.params,
        position: n.position,
      }));
      const serializedEdges = edges.map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));
      try {
        const url = id
          ? `${DJANGO_API_BASE}/pipelines/${id}/`
          : `${DJANGO_API_BASE}/pipelines/`;
        const method = id ? "PATCH" : "POST";
        const res = await fetchWithAuth(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, nodes: serializedNodes, edges: serializedEdges }),
        });
        if (res.ok && !id) {
          const body = await res.json().catch(() => ({}));
          if (body?.id) {
            currentPipelineIdRef.current = body.id;
            setCurrentPipelineId(body.id);
          }
        }
      } catch {
        // silent — auto-save is best-effort
      }
    }, 2000);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [nodes, edges, currentPipelineName]);

  // Fetch dataset info on mount and when changed
  useEffect(() => {
    const fetchDataset = () => {
      fetchProfile()
        .then((profile) => {
          setDatasetInfo({
            filename: profile.filename,
            rows: profile.rows,
            col_count: profile.col_count,
            columns: profile.columns.map((c) => c.name),
            numericColumns: profile.columns.filter((c) => c.histogram != null).map((c) => c.name),
          });
        })
        .catch(() => setDatasetInfo(null));
    };

    fetchDataset();

    const handleDataLoaded = () => fetchDataset();
    window.addEventListener("agent:dataLoaded", handleDataLoaded);
    return () => window.removeEventListener("agent:dataLoaded", handleDataLoaded);
  }, []);

  const columnNames = datasetInfo?.columns ?? [];
  const numericColumns = datasetInfo?.numericColumns ?? [];

  const selectedNode = useMemo(
    () => (selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null),
    [nodes, selectedNodeId]
  );

  // Derive effective columns from the nearest upstream node that has result.columns.
  // This ensures that e.g. Drop Columns or One-Hot Encode reflects the actual
  // columns available at that step in the pipeline, not the original dataset columns.
  // For multi-output customPython nodes, respect the edge's sourceHandle to pick
  // the correct output's columns via result.outputs_meta[handle].
  const { effectiveColumnNames, effectiveNumericColumns } = useMemo(() => {
    if (!selectedNodeId) return { effectiveColumnNames: columnNames, effectiveNumericColumns: numericColumns };

    // Walk the graph one level up to find the parent node's columns
    const parentEdge = edges.find((e) => e.target === selectedNodeId);
    if (!parentEdge) return { effectiveColumnNames: columnNames, effectiveNumericColumns: numericColumns };

    const parentNode = nodes.find((n) => n.id === parentEdge.source);
    const parentResult = parentNode?.data?.result as Record<string, unknown> | undefined;
    const outputsMeta = parentResult?.outputs_meta as Record<string, { columns: string[]; preview: Record<string, unknown>[] }> | undefined;
    const srcHandle = parentEdge.sourceHandle as string | null | undefined;

    let parentCols: string[] | undefined;
    let preview: Record<string, unknown>[] | undefined;

    if (outputsMeta && srcHandle && outputsMeta[srcHandle]) {
      // Multi-output customPython: pick the columns for this specific output handle
      parentCols = outputsMeta[srcHandle].columns;
      preview = outputsMeta[srcHandle].preview;
    } else {
      parentCols = parentResult?.columns as string[] | undefined;
      preview = parentResult?.preview as Record<string, unknown>[] | undefined;
    }

    if (!parentCols || parentCols.length === 0) {
      return { effectiveColumnNames: columnNames, effectiveNumericColumns: numericColumns };
    }

    // Infer numeric columns from the preview rows (including booleans for ML)
    let numCols: string[] = [];
    if (preview && preview.length > 0) {
      numCols = parentCols.filter((col) => {
        const val = preview[0][col];
        return (
          typeof val === "number" ||
          typeof val === "boolean" ||
          (typeof val === "string" && val !== "" && !isNaN(Number(val)))
        );
      });
    }

    return { effectiveColumnNames: parentCols, effectiveNumericColumns: numCols };
  }, [selectedNodeId, edges, nodes, columnNames, numericColumns]);

  const addNode = useCallback(
    (kind: NodeKind) => {
      const id = nextId();
      const { x, y, zoom } = viewportRef.current;
      const position = {
        x: (-x + 300) / zoom + Math.random() * 60 - 30,
        y: (-y + 200) / zoom + Math.random() * 60 - 30,
      };
      const newNode: Node<PipelineNodeData> = {
        id,
        type: "pipeline",
        position,
        data: {
          kind,
          params: defaultParams(kind),
          datasetInfo: kind === "dataSource" ? datasetInfo : undefined,
          status: "idle",
          result: undefined,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(id);
    },
    [datasetInfo, setNodes]
  );

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setCurrentPipelineId(null);
    setCurrentPipelineName("");
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const updateNodeParams = useCallback(
    (nodeId: string, params: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, params } } : n))
      );
    },
    [setNodes]
  );

  const stopPipeline = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ── Pipeline execution ──────────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (isRunning || nodes.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);

    // Reset all node statuses to idle
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" as const, result: undefined } }))
    );

    // Serialize graph
    const graph = {
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: n.data.kind as string,
        params: n.data.params,
      })),
      edges: edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
    };

    try {
      const response = await executePipeline(graph, controller.signal);

      // Animate nodes sequentially using execution_order
      const order = response.execution_order.length > 0
        ? response.execution_order
        : nodes.map((n) => n.id);

      for (const nodeId of order) {
        demoSetCurrent(nodeId);
        setNodes((nds) =>
          nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status: "running" as const } } : n)
        );
        await new Promise((r) => setTimeout(r, 300));

        const result = response.results[nodeId];
        if (result) {
          setNodes((nds) =>
            nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status: result.status as "success" | "error", result } } : n)
          );
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      setTimeout(() => demoSetCurrent(null), 600);

      if (response.success) {
        toast.success("Pipeline executed successfully");
      } else {
        toast.error("Pipeline execution failed");
      }

      // Persist run to Django so it appears in admin + Dashboard Builder history
      fetchWithAuth(`${DJANGO_API_BASE}/runs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline: currentPipelineId,
          status: response.success ? "success" : "error",
          results: response.results,
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        }),
      }).catch(() => { /* non-fatal — run still works without Django persistence */ });
    } catch (err) {
      demoSetCurrent(null);
      if (err instanceof Error && err.name === "AbortError") {
        setNodes((nds) =>
          nds.map((n) =>
            n.data.status === "running"
              ? { ...n, data: { ...n.data, status: "idle" as const, result: undefined } }
              : n
          )
        );
        toast.info("Pipeline detenido");
      } else {
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            data: {
              ...n.data,
              status: "error" as const,
              result: { status: "error" as const, error: err instanceof Error ? err.message : "Execution failed" },
            },
          }))
        );
        toast.error(err instanceof Error ? err.message : "Pipeline execution failed");
      }
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  }, [isRunning, nodes, edges, setNodes, currentPipelineId, demoSetCurrent]);

  // ── Partial execution: run pipeline starting from a specific node ────────
  const runFromNode = useCallback(async (startNodeId: string) => {
    if (isRunning || nodes.length === 0) return;

    // Compute all ancestors of startNodeId using BFS backward through edges
    const ancestorSet = new Set<string>();
    const queue = [startNodeId];
    const parentMap = new Map<string, string[]>();
    for (const e of edges) {
      if (!parentMap.has(e.target)) parentMap.set(e.target, []);
      parentMap.get(e.target)!.push(e.source);
    }
    // Walk upward — ancestors are the nodes we want to SKIP (reuse cache)
    const visited = new Set<string>();
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const parent of parentMap.get(cur) ?? []) {
        if (!visited.has(parent)) {
          ancestorSet.add(parent);
          queue.push(parent);
        }
      }
    }
    // The skip list: all ancestors that already have a cached success result
    const skipNodeIds = [...ancestorSet].filter((id) => {
      const nd = nodes.find((n) => n.id === id);
      return nd?.data.status === "success";
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);

    // Reset only the nodes that will actually run (not the skipped ones)
    setNodes((nds) =>
      nds.map((n) =>
        skipNodeIds.includes(n.id)
          ? n  // keep cached status
          : { ...n, data: { ...n.data, status: "idle" as const, result: undefined } }
      )
    );

    const graph = {
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: n.data.kind as string,
        params: n.data.params,
      })),
      edges: edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
    };

    try {
      const response = await executePipeline(graph, controller.signal, skipNodeIds);

      const order = response.execution_order.length > 0
        ? response.execution_order
        : nodes.map((n) => n.id);

      for (const nodeId of order) {
        // Don't animate skipped nodes
        if (skipNodeIds.includes(nodeId)) continue;

        demoSetCurrent(nodeId);
        setNodes((nds) =>
          nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status: "running" as const } } : n)
        );
        await new Promise((r) => setTimeout(r, 300));

        const result = response.results[nodeId];
        if (result) {
          const matchedNode = nodes.find((n) => n.id === nodeId);
          if (matchedNode?.data.kind === "trainNeuralNetwork" && result.status === "success") {
            agentNNTrainComplete({
              epochs: 1, // Will be overridden by the refetch in NeuralNetView
              finalLoss: 0,
              finalAccuracy: 0
            });
          }
          setNodes((nds) =>
            nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status: result.status as "success" | "error", result } } : n)
          );
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      setTimeout(() => demoSetCurrent(null), 600);

      const ranCount = order.filter((id) => !skipNodeIds.includes(id)).length;
      if (response.success) {
        toast.success(`Executed ${ranCount} node(s) — skipped ${skipNodeIds.length} cached`);
      } else {
        toast.error("Pipeline execution failed");
      }
    } catch (err) {
      demoSetCurrent(null);
      if (err instanceof Error && err.name === "AbortError") {
        setNodes((nds) =>
          nds.map((n) =>
            n.data.status === "running"
              ? { ...n, data: { ...n.data, status: "idle" as const, result: undefined } }
              : n
          )
        );
        toast.info("Pipeline detenido");
      } else {
        toast.error(err instanceof Error ? err.message : "Partial execution failed");
      }
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  }, [isRunning, nodes, edges, setNodes, demoSetCurrent]);

  // Low-level save: PUT if pipelineId is provided, POST otherwise.
  const savePipelineRequest = useCallback(
    async (pipelineId: number | null, name: string, description: string) => {
      const graph = {
        nodes: nodes.map((n) => ({
          id: n.id,
          kind: n.data.kind as string,
          params: n.data.params,
          position: n.position,          // ← persist canvas position
        })),
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })),
      };

      const url = pipelineId !== null
        ? `${DJANGO_API_BASE}/pipelines/${pipelineId}/`
        : `${DJANGO_API_BASE}/pipelines/`;
      const method = pipelineId !== null ? "PUT" : "POST";

      try {
        const res = await fetchWithAuth(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, nodes: graph.nodes, edges: graph.edges }),
        });

        if (!res.ok) {
          toast.error("Failed to save pipeline");
          return;
        }

        // Capture the new id (on POST) or reuse existing (on PUT)
        let savedId: number | null = pipelineId;
        try {
          const body = await res.json();
          if (body && typeof body.id === "number") savedId = body.id;
        } catch {
          // PUT may return no body — not fatal
        }

        setCurrentPipelineId(savedId);
        setCurrentPipelineName(name);
        toast.success(pipelineId !== null ? "Pipeline updated" : "Pipeline saved");
      } catch {
        toast.error("Error saving pipeline");
      }
    },
    [nodes, edges]
  );

  // "Save" button: if there's a known pipelineId, silently update; otherwise open the modal.
  const handleQuickSave = useCallback(() => {
    if (currentPipelineId !== null && currentPipelineName) {
      savePipelineRequest(currentPipelineId, currentPipelineName, "");
    } else {
      setSaveAsMode(false);
      setIsSaveModalOpen(true);
    }
  }, [currentPipelineId, currentPipelineName, savePipelineRequest]);

  // "Save As" button: always open the modal to create a new pipeline (clone).
  const handleSaveAs = useCallback(() => {
    setSaveAsMode(true);
    setIsSaveModalOpen(true);
  }, []);

  // Modal callback: route to PUT (quick first save on an unnamed canvas) or POST (Save As).
  const handleModalSave = useCallback(
    async (name: string, description: string) => {
      const targetId = saveAsMode ? null : currentPipelineId;
      await savePipelineRequest(targetId, name, description);
    },
    [saveAsMode, currentPipelineId, savePipelineRequest]
  );

  // ── Agent event listeners (must be after runPipeline) ───────────────────
  useEffect(() => {
    const cleanupAdd = onAgentEvent<AgentAddPipelineNode>("pipeline:addNode", (detail) => {
      const kind = detail.kind as NodeKind;
      if (!NODE_META[kind]) return;

      setNodes((nds) => {
        const id = nextId();
        const lastNode = nds[nds.length - 1];
        const position = lastNode
          ? { x: lastNode.position.x, y: lastNode.position.y + 120 }
          : { x: 250, y: 100 };

        const newNode: Node<PipelineNodeData> = {
          id,
          type: "pipeline",
          position,
          data: {
            kind,
            params: { ...defaultParams(kind), ...detail.params },
            datasetInfo: kind === "dataSource" ? datasetInfo : undefined,
            status: "idle",
            result: undefined,
            agentAdded: true,
          },
        };

        if (detail.connectToLast && lastNode) {
          setEdges((eds) => [
            ...eds,
            { id: `e-${lastNode.id}-${id}`, source: lastNode.id, target: id, ...defaultEdgeOptions },
          ]);
        }

        return [...nds, newNode];
      });
    });

    const cleanupExec = onAgentEvent("pipeline:execute", () => {
      runPipeline();
    });

    const cleanupData = onAgentEvent<AgentDataLoaded>("dataLoaded", () => {
      fetchProfile()
        .then((profile) => {
          setDatasetInfo({
            filename: profile.filename,
            rows: profile.rows,
            col_count: profile.col_count,
            columns: profile.columns.map((c) => c.name),
            numericColumns: profile.columns.filter((c) => c.histogram != null).map((c) => c.name),
          });
        })
        .catch(() => {});
    });

    const cleanupLoad = onAgentEvent<LoadPipelineEvent>("pipeline:load", (detail) => {
      // Remember which pipeline this is so "Save" updates in place (PUT) instead of duplicating (POST)
      setCurrentPipelineId(typeof detail.id === "number" ? detail.id : null);
      setCurrentPipelineName(detail.name ?? "");
      // Clear canvas and reconstruct from saved nodes/edges
      setEdges([]);
      const reconstructed: Node<PipelineNodeData>[] = (detail.nodes ?? []).map((n: any, i: number) => ({
        id: n.id,
        type: "pipeline",
        position: n.position ?? { x: 200, y: 80 + i * 130 }, // ← restore saved position
        data: {
          kind: n.kind as NodeKind,
          params: n.params ?? defaultParams(n.kind as NodeKind),
          datasetInfo: n.kind === "dataSource" ? datasetInfo : undefined,
          status: "idle" as const,
          result: undefined,
        },
      }));
      setNodes(reconstructed);
      const reconstructedEdges = (detail.edges ?? []).map((e: any) => ({
        id: `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        ...defaultEdgeOptions,
      }));
      setEdges(reconstructedEdges);
      setSelectedNodeId(null);
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.1 }), 100);
    });

    return () => {
      cleanupAdd();
      cleanupExec();
      cleanupData();
      cleanupLoad();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetInfo, runPipeline]);

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [setNodes, setEdges, selectedNodeId]
  );

  // Merge selection + callbacks into node data
  const nodesWithSelection = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
        data: {
          ...n.data,
          onPreview: (nodeId: string) => setPreviewNodeId(nodeId),
          onDelete: (nodeId: string) => deleteNode(nodeId),
          onRunFrom: (nodeId: string) => runFromNode(nodeId),
        },
      })),
    [nodes, selectedNodeId, deleteNode, runFromNode]
  );

  return (
    <div className="flex flex-col h-full relative">
      {!isDemoMode && (
        <>
          <Toolbar
            onAddNode={addNode}
            onClear={clearCanvas}
            onExecute={runPipeline}
            onStop={stopPipeline}
            onSave={handleQuickSave}
            onSaveAs={handleSaveAs}
            onAutoML={() => setIsAutoMLOpen(true)}
            pipelineName={currentPipelineName}
            isRunning={isRunning}
          />
          <button
            onClick={toggleDemo}
            className="absolute top-2 right-2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#1a2535] hover:bg-[#1e3050] text-[#3AA0FF] border border-[#3AA0FF]/30 transition-colors"
            title="Demo Mode (Ctrl+Shift+D)"
          >
            ◉ Demo
          </button>
        </>
      )}

      <div className="flex flex-1 min-h-0">
        {/* React Flow Canvas */}
        <div className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodesWithSelection}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            deleteKeyCode={["Backspace", "Delete"]}
            connectionLineStyle={{ stroke: "#00f0ff", strokeWidth: 1.5, strokeDasharray: "5 5" }}
            onInit={(instance) => { rfInstanceRef.current = instance as unknown as ReactFlowInstance; }}
            style={{ background: "#181d23" }}
            onMove={(_, viewport) => {
              viewportRef.current = viewport;
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} color="#2a3240" gap={20} size={1.5} />
            <Controls style={{ background: "transparent", border: "none", boxShadow: "none" }} />
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none select-none">
                <Workflow size={48} className="text-white/10 mb-3" />
                <p className="text-white/30 text-sm font-medium">Drag nodes from the toolbar to start building</p>
                <p className="text-white/20 text-xs mt-1">or ask QUO to build a pipeline for you</p>
              </div>
            )}
            <MiniMap
              style={{ background: "#1a2030", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
              maskColor="rgba(0,0,0,0.6)"
              nodeColor={(n) => {
                const data = n.data as PipelineNodeData;
                return NODE_META[data.kind]?.color ?? "#444";
              }}
            />
          </ReactFlow>
        </div>

        {/* Config / Preview Panel — hidden in demo mode */}
        {!isDemoMode && (
          <div className="w-[300px] shrink-0 bg-[#222a35] border-l border-white/5 flex flex-col">
            <div className="px-4 py-3 border-b border-white/5 shrink-0">
              <div className="text-[13px] font-semibold text-white/80">Node Inspector</div>
            </div>
            <div className="flex-1 min-h-0">
              <ConfigPanel
                node={selectedNode}
                columnNames={effectiveColumnNames}
                numericColumns={effectiveNumericColumns}
                datasetInfo={datasetInfo}
                onParamsChange={updateNodeParams}
              />
            </div>
          </div>
        )}
      </div>

      {/* Data preview modal */}
      {previewNodeId && (() => {
        const n = nodes.find((nd) => nd.id === previewNodeId);
        if (!n || !n.data.result) return null;
        return (
          <DataPreviewModal
            nodeKind={n.data.kind}
            result={n.data.result}
            onClose={() => setPreviewNodeId(null)}
          />
        );
      })()}

      <SaveModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleModalSave}
        title={saveAsMode ? "Save Pipeline As…" : "Save Pipeline"}
        descriptionLabel="Pipeline Description"
        initialName={saveAsMode ? `${currentPipelineName || "Pipeline"} (copy)` : currentPipelineName}
      />

      <DemoOverlay />

      <AutoMLPanel
        isOpen={isAutoMLOpen}
        onClose={() => setIsAutoMLOpen(false)}
        columnNames={datasetInfo?.columns ?? []}
      />
    </div>
  );
}
