// ─────────────────────────────────────────────────────────────────────────────
// Shape Inference Engine
// Topologically sorts the NN graph and propagates tensor shapes forward.
// Supports multi-parent nodes (Add, Concat) and branching.
// ─────────────────────────────────────────────────────────────────────────────

import type { Node, Edge } from "@xyflow/react";
import {
  inferOutputShape,
  inferMultiInputShape,
  type TensorShape,
  type LayerKind,
} from "./layerTypes";

// Minimal shape of the node.data we care about (avoids circular import from NeuralNode)
interface NNData { kind: LayerKind; params: Record<string, unknown> }

export interface ShapeInfo {
  inputShape:   TensorShape | null;
  outputShape:  TensorShape | null;
  inputShapes?: TensorShape[];   // all parent output shapes (for multi-parent nodes)
  error?:       string;
}

/** Build adjacency list and in-degree map for topological sort */
function buildGraph(nodes: Node[], edges: Edge[]) {
  const adjOut   = new Map<string, string[]>(); // nodeId → [children]
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    adjOut.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    adjOut.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }
  return { adjOut, inDegree };
}

/** Kahn's algorithm — returns topological order (excludes cycles) */
function topoSort(nodes: Node[], edges: Edge[]): string[] {
  const { adjOut, inDegree } = buildGraph(nodes, edges);
  const queue = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const child of adjOut.get(id) ?? []) {
      const deg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, deg);
      if (deg === 0) queue.push(child);
    }
  }
  return order;
}

/**
 * Infers tensor shapes for every node in the graph.
 * Supports multi-parent (Add / Concat) nodes.
 *
 * @param nodes       React Flow nodes with NeuralNodeData
 * @param edges       React Flow edges
 * @param inputShape  User-configured input tensor shape (e.g. [1, 784])
 */
export function runShapeEngine(
  nodes: Node[],
  edges: Edge[],
  inputShape: TensorShape
): Map<string, ShapeInfo> {
  const result = new Map<string, ShapeInfo>();
  const order  = topoSort(nodes, edges);

  // Build parent map: nodeId → [source node ids]
  const parentMap = new Map<string, string[]>();
  for (const n of nodes) parentMap.set(n.id, []);
  for (const e of edges) {
    parentMap.get(e.target)?.push(e.source);
  }

  for (const nodeId of order) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const data    = node.data as unknown as NNData;
    const parents = parentMap.get(nodeId) ?? [];

    // Collect all parent output shapes
    const parentShapes: TensorShape[] = parents
      .map((pid) => result.get(pid)?.outputShape)
      .filter((s): s is TensorShape => s !== null && s !== undefined);

    if (parents.length === 0) {
      // Root node — use global inputShape
      const { shape: outShape, error } = inferOutputShape(data.kind, data.params, inputShape);
      result.set(nodeId, {
        inputShape,
        inputShapes: [inputShape],
        outputShape: error ? null : outShape,
        error,
      });
    } else if (parents.length === 1) {
      // Single-parent node — standard inference
      const inShape = result.get(parents[0])?.outputShape ?? null;
      const { shape: outShape, error } = inferOutputShape(data.kind, data.params, inShape);
      result.set(nodeId, {
        inputShape: inShape,
        inputShapes: inShape ? [inShape] : [],
        outputShape: error ? null : outShape,
        error,
      });
    } else {
      // Multi-parent node — merge inference
      const { shape: outShape, error } = inferMultiInputShape(data.kind, data.params, parentShapes);
      result.set(nodeId, {
        inputShape:  parentShapes[0] ?? null,
        inputShapes: parentShapes,
        outputShape: error ? null : outShape,
        error,
      });
    }
  }

  // Nodes not in topo order (e.g. disconnected or cyclic) — mark as unreachable
  for (const n of nodes) {
    if (!result.has(n.id)) {
      result.set(n.id, { inputShape: null, outputShape: null, error: "Unreachable (cycle?)" });
    }
  }

  return result;
}

/** Format a TensorShape as a human-readable string, e.g. [B, 784] */
export function formatShape(shape: TensorShape | null | undefined): string {
  if (!shape || shape.length === 0) return "—";
  return (
    "[" +
    shape
      .map((d, i) => (i === 0 && d === 1 ? "B" : d < 0 ? "?" : String(d)))
      .join(", ") +
    "]"
  );
}
