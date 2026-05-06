// ─────────────────────────────────────────────────────────────────────────────
// PyTorch Code Generator — DAG-aware
// Converts the React Flow NN graph into a clean nn.Module Python class.
// Supports branching, residual connections (Add), concatenation (Concat),
// and multi-output networks (multiple leaf nodes).
// ─────────────────────────────────────────────────────────────────────────────

import type { Node, Edge } from "@xyflow/react";
import type { LayerKind } from "./layerTypes";

// Minimal shape of node.data to avoid circular import from NeuralNode
interface NNData { kind: LayerKind; params: Record<string, unknown> }

// ── Topological sort ──────────────────────────────────────────────────────────
function topoSort(nodes: Node[], edges: Edge[]): Node[] {
  const adjOut   = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) { adjOut.set(n.id, []); inDegree.set(n.id, 0); }
  for (const e of edges) {
    adjOut.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }
  const queue = nodes.filter((n) => inDegree.get(n.id) === 0);
  const order: Node[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const child of adjOut.get(node.id) ?? []) {
      const deg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, deg);
      if (deg === 0) {
        const childNode = nodes.find((n) => n.id === child);
        if (childNode) queue.push(childNode);
      }
    }
  }
  // Append any nodes not in topo order (disconnected)
  for (const n of nodes) {
    if (!order.find((o) => o.id === n.id)) order.push(n);
  }
  return order;
}

// ── Whether a kind is a "virtual" merge node (no learnable params) ────────────
function isMergeNode(kind: LayerKind) {
  return kind === "Add" || kind === "Concat";
}

// ── Generate nn.X(...) init line ──────────────────────────────────────────────
function genInit(kind: LayerKind, params: Record<string, unknown>, varName: string): string | null {
  switch (kind) {
    case "Linear":
      return `self.${varName} = nn.Linear(${params.in_features ?? 128}, ${params.out_features ?? 64}, bias=${params.bias !== false ? "True" : "False"})`;
    case "Conv2d":
      return `self.${varName} = nn.Conv2d(${params.in_channels ?? 3}, ${params.out_channels ?? 32}, kernel_size=${params.kernel_size ?? 3}, stride=${params.stride ?? 1}, padding=${params.padding ?? 0})`;
    case "MaxPool2d":
      return `self.${varName} = nn.MaxPool2d(kernel_size=${params.kernel_size ?? 2}, stride=${params.stride ?? 2}, padding=${params.padding ?? 0})`;
    case "ReLU":
      return `self.${varName} = nn.ReLU(inplace=${params.inplace ? "True" : "False"})`;
    case "GELU":
      return `self.${varName} = nn.GELU(approximate="${params.approximate ?? "none"}")`;
    case "Dropout":
      return `self.${varName} = nn.Dropout(p=${Number(params.p ?? 0.5).toFixed(2)})`;
    case "BatchNorm": {
      const nf  = params.num_features ?? 64;
      const eps = Number(params.eps ?? 1e-5).toExponential(1);
      return `self.${varName} = nn.BatchNorm1d(${nf}, eps=${eps}, momentum=${params.momentum ?? 0.1})`;
    }
    case "Flatten":
      return `self.${varName} = nn.Flatten(start_dim=${params.start_dim ?? 1})`;
    case "Softmax":
      return `self.${varName} = nn.Softmax(dim=${params.dim ?? 1})`;
    case "Embedding":
      return `self.${varName} = nn.Embedding(${params.vocab_size ?? 10000}, ${params.embedding_dim ?? 64}, padding_idx=${params.padding_idx ?? 0})`;
    case "PositionalEncoding":
      // Sinusoidal positional encoding registered as a buffer
      return `self.${varName} = SinusoidalPositionalEncoding(d_model=${params.d_model ?? 64}, max_len=${params.max_len ?? 5000})`;
    case "LSTM":
      return `self.${varName} = nn.LSTM(${params.input_size ?? 64}, ${params.hidden_size ?? 128}, num_layers=${params.num_layers ?? 1}, bidirectional=${params.bidirectional ? "True" : "False"}, dropout=${Number(params.dropout ?? 0).toFixed(2)}, batch_first=True)`;
    case "GRU":
      return `self.${varName} = nn.GRU(${params.input_size ?? 64}, ${params.hidden_size ?? 128}, num_layers=${params.num_layers ?? 1}, bidirectional=${params.bidirectional ? "True" : "False"}, dropout=${Number(params.dropout ?? 0).toFixed(2)}, batch_first=True)`;
    case "RNN":
      return `self.${varName} = nn.RNN(${params.input_size ?? 64}, ${params.hidden_size ?? 128}, num_layers=${params.num_layers ?? 1}, nonlinearity="${params.nonlinearity ?? "tanh"}", bidirectional=${params.bidirectional ? "True" : "False"}, dropout=${Number(params.dropout ?? 0).toFixed(2)}, batch_first=True)`;
    case "MultiheadAttention":
      return `self.${varName} = nn.MultiheadAttention(embed_dim=${params.embed_dim ?? 64}, num_heads=${params.num_heads ?? 4}, dropout=${Number(params.dropout ?? 0).toFixed(2)}, batch_first=True)`;
    case "TransformerEncoderLayer": {
      const enc = `nn.TransformerEncoderLayer(d_model=${params.d_model ?? 64}, nhead=${params.nhead ?? 4}, dim_feedforward=${params.dim_feedforward ?? 256}, dropout=${Number(params.dropout ?? 0.1).toFixed(2)}, batch_first=True)`;
      return `self.${varName} = nn.TransformerEncoder(${enc}, num_layers=${params.num_layers ?? 2})`;
    }
    case "LayerNorm":
      return `self.${varName} = nn.LayerNorm(${params.normalized_shape ?? 64}, eps=${Number(params.eps ?? 1e-5).toExponential(1)})`;
    // No-param layers — inline ops, no __init__ registration
    case "Add":
    case "Concat":
    case "LastTimestep":
    case "MeanPool":
      return null;
  }
}

// ── Generate forward() statement for a node ───────────────────────────────────
function genForward(
  kind: LayerKind,
  params: Record<string, unknown>,
  varName: string,
  outputVar: string,
  inputVars: string[]   // e.g. ["x_0"] or ["x_1", "x_2"]
): string {
  if (kind === "Add") {
    return `${outputVar} = ${inputVars.join(" + ")}`;
  }
  if (kind === "Concat") {
    const dim = params.dim ?? 1;
    return `${outputVar} = torch.cat([${inputVars.join(", ")}], dim=${dim})`;
  }
  const inp = inputVars[0] ?? "x";
  if (kind === "LSTM" || kind === "GRU" || kind === "RNN") {
    // Discard the hidden state — keep [B, T, H*directions] only
    return `${outputVar}, _ = self.${varName}(${inp})`;
  }
  if (kind === "MultiheadAttention") {
    // Self-attention: query=key=value=inp; discard attention weights
    return `${outputVar}, _ = self.${varName}(${inp}, ${inp}, ${inp}, need_weights=False)`;
  }
  if (kind === "LastTimestep") {
    return `${outputVar} = ${inp}[:, -1, :]`;
  }
  if (kind === "MeanPool") {
    return `${outputVar} = ${inp}.mean(dim=1)`;
  }
  return `${outputVar} = self.${varName}(${inp})`;
}

// ── Main codegen function ─────────────────────────────────────────────────────
export function generatePyTorchCode(nodes: Node[], edges: Edge[]): string {
  if (nodes.length === 0) {
    return "# Add layers to the canvas to generate code";
  }

  const ordered  = topoSort(nodes, edges);
  const nodeById = new Map<string, Node>(nodes.map((n) => [n.id, n]));

  // Build parent and child maps
  const parentMap = new Map<string, string[]>();  // nodeId → parent ids (in edge order)
  const childMap  = new Map<string, string[]>();  // nodeId → child ids
  for (const n of ordered) { parentMap.set(n.id, []); childMap.set(n.id, []); }
  for (const e of edges) {
    parentMap.get(e.target)?.push(e.source);
    childMap.get(e.source)?.push(e.target);
  }

  // Assign variable names per node
  const kindCounts: Record<string, number> = {};
  const layerVarName  = new Map<string, string>(); // layerName used in self.xxx
  const outputVarName = new Map<string, string>(); // the output tensor variable x_i

  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i];
    const data = node.data as unknown as NNData;
    const base = data.kind.toLowerCase();
    kindCounts[base] = (kindCounts[base] ?? 0) + 1;
    layerVarName.set(node.id, `${base}_${kindCounts[base]}`);
    outputVarName.set(node.id, `x_${i}`);
  }

  // Identify root nodes (no parents) and leaf nodes (no children)
  const rootIds = ordered.filter((n) => (parentMap.get(n.id)?.length ?? 0) === 0).map((n) => n.id);
  const leafIds = ordered.filter((n) => (childMap.get(n.id)?.length ?? 0) === 0).map((n) => n.id);

  const lines: string[] = [];

  lines.push("import torch");
  lines.push("import torch.nn as nn");

  // If any node uses PositionalEncoding, emit the helper class
  const usesPosEnc = ordered.some((n) => (n.data as unknown as NNData).kind === "PositionalEncoding");
  if (usesPosEnc) {
    lines.push("import math");
    lines.push("");
    lines.push("");
    lines.push("class SinusoidalPositionalEncoding(nn.Module):");
    lines.push("    def __init__(self, d_model: int, max_len: int = 5000):");
    lines.push("        super().__init__()");
    lines.push("        pe = torch.zeros(max_len, d_model)");
    lines.push("        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)");
    lines.push("        div_term = torch.exp(torch.arange(0, d_model, 2, dtype=torch.float) * -(math.log(10000.0) / d_model))");
    lines.push("        pe[:, 0::2] = torch.sin(position * div_term)");
    lines.push("        pe[:, 1::2] = torch.cos(position * div_term)");
    lines.push("        self.register_buffer('pe', pe.unsqueeze(0))  # [1, max_len, d_model]");
    lines.push("    def forward(self, x: torch.Tensor) -> torch.Tensor:");
    lines.push("        return x + self.pe[:, : x.size(1), :]");
  }

  lines.push("");
  lines.push("");
  lines.push("class QuasarNet(nn.Module):");
  lines.push("    def __init__(self):");
  lines.push("        super().__init__()");

  // __init__: only register learnable layers
  for (const node of ordered) {
    const data    = node.data as unknown as NNData;
    const varName = layerVarName.get(node.id)!;
    const initLine = genInit(data.kind, data.params, varName);
    if (initLine) lines.push(`        ${initLine}`);
  }

  // forward()
  lines.push("");
  const returnTypes = leafIds.length > 1 ? "tuple[torch.Tensor, ...]" : "torch.Tensor";
  lines.push(`    def forward(self, x: torch.Tensor) -> ${returnTypes}:`);

  for (const node of ordered) {
    const data      = node.data as unknown as NNData;
    const varName   = layerVarName.get(node.id)!;
    const outputVar = outputVarName.get(node.id)!;
    const parents   = parentMap.get(node.id) ?? [];

    let inputVars: string[];
    if (parents.length === 0) {
      // Root node: use input x (if multiple roots, number them)
      inputVars = rootIds.length === 1 ? ["x"] : [`x_input_${rootIds.indexOf(node.id)}`];
    } else {
      inputVars = parents.map((pid) => outputVarName.get(pid) ?? "x");
    }

    const fwdLine = genForward(data.kind, data.params, varName, outputVar, inputVars);
    lines.push(`        ${fwdLine}`);
  }

  // return statement
  if (leafIds.length === 0) {
    lines.push("        return x");
  } else if (leafIds.length === 1) {
    lines.push(`        return ${outputVarName.get(leafIds[0])}`);
  } else {
    const retVars = leafIds.map((id) => outputVarName.get(id)).join(", ");
    lines.push(`        return ${retVars}`);
  }

  lines.push("");
  lines.push("");
  lines.push("# Example usage:");
  lines.push("# model = QuasarNet()");
  lines.push("# print(model)");

  return lines.join("\n");
}
