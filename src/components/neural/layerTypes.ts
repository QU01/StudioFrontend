// ─────────────────────────────────────────────────────────────────────────────
// Layer type definitions for the Neural Network Builder
// ─────────────────────────────────────────────────────────────────────────────

export type LayerKind =
  | "Linear"
  | "Conv2d"
  | "ReLU"
  | "GELU"
  | "Dropout"
  | "BatchNorm"
  | "Flatten"
  | "Softmax"
  | "MaxPool2d"
  | "Add"
  | "Concat"
  | "Embedding"
  | "PositionalEncoding"
  | "LSTM"
  | "GRU"
  | "RNN"
  | "MultiheadAttention"
  | "TransformerEncoderLayer"
  | "LayerNorm"
  | "LastTimestep"
  | "MeanPool";

export interface LayerMeta {
  label: string;
  color: string;
  category: string;
  iconName: string;
  description: string;
}

export const LAYER_META: Record<LayerKind, LayerMeta> = {
  Linear:    { label: "Linear",    color: "#3b82f6", category: "Linear",        iconName: "Layers",    description: "Fully-connected linear transformation" },
  Conv2d:    { label: "Conv2D",    color: "#f97316", category: "Convolutional",  iconName: "Grid3x3",   description: "2D convolution over an input signal" },
  ReLU:      { label: "ReLU",      color: "#22c55e", category: "Activation",     iconName: "Zap",       description: "Rectified Linear Unit activation" },
  GELU:      { label: "GELU",      color: "#86efac", category: "Activation",     iconName: "Activity",  description: "Gaussian Error Linear Unit activation" },
  Dropout:   { label: "Dropout",   color: "#f59e0b", category: "Regularization", iconName: "CloudRain", description: "Randomly zeros elements with probability p" },
  BatchNorm: { label: "BatchNorm", color: "#06b6d4", category: "Normalization",  iconName: "AlignCenter", description: "Batch normalization over mini-batches" },
  Flatten:   { label: "Flatten",   color: "#6b7280", category: "Reshape",        iconName: "Minus",     description: "Flattens a contiguous range of dims" },
  Softmax:   { label: "Softmax",   color: "#d946ef", category: "Activation",     iconName: "Sigma",     description: "Softmax activation (output probabilities)" },
  MaxPool2d: { label: "MaxPool2D", color: "#8b5cf6", category: "Pooling",        iconName: "Grid3x3",   description: "2D max pooling over an input signal" },
  Add:       { label: "Add",       color: "#10b981", category: "Merge",          iconName: "Plus",      description: "Element-wise sum of inputs (residual / skip connection)" },
  Concat:    { label: "Concat",    color: "#a855f7", category: "Merge",          iconName: "GitMerge",  description: "Concatenate inputs along a given dimension" },
  Embedding:              { label: "Embedding",            color: "#0ea5e9", category: "Embedding",   iconName: "Type",          description: "Look up dense vectors for token IDs" },
  PositionalEncoding:     { label: "Positional Encoding",  color: "#22d3ee", category: "Embedding",   iconName: "Radio",         description: "Add sinusoidal positional information to token embeddings" },
  LSTM:                   { label: "LSTM",                 color: "#ec4899", category: "Recurrent",   iconName: "RefreshCcw",    description: "Long short-term memory recurrent layer" },
  GRU:                    { label: "GRU",                  color: "#f472b6", category: "Recurrent",   iconName: "RefreshCcw",    description: "Gated recurrent unit" },
  RNN:                    { label: "RNN",                  color: "#fb7185", category: "Recurrent",   iconName: "RotateCcw",     description: "Vanilla Elman RNN" },
  MultiheadAttention:     { label: "Multi-Head Attention", color: "#a78bfa", category: "Attention",   iconName: "GitFork",       description: "Self-attention with multiple heads" },
  TransformerEncoderLayer:{ label: "Transformer Encoder",  color: "#7c3aed", category: "Transformer", iconName: "Layers3",       description: "Stack of TransformerEncoderLayer (multi-head attention + FFN)" },
  LayerNorm:              { label: "LayerNorm",            color: "#0891b2", category: "Normalization", iconName: "AlignCenter", description: "Layer normalization across the last dimension" },
  LastTimestep:           { label: "Last Timestep",        color: "#94a3b8", category: "Pooling NLP", iconName: "ChevronLast",   description: "Take x[:, -1, :] — collapse sequence to its final hidden state" },
  MeanPool:               { label: "Mean Pool",            color: "#64748b", category: "Pooling NLP", iconName: "Rows",          description: "Average over the time dimension" },
};

export const LAYER_ORDER: LayerKind[] = [
  "Linear",
  "Conv2d",
  "MaxPool2d",
  "Embedding",
  "PositionalEncoding",
  "LSTM",
  "GRU",
  "RNN",
  "MultiheadAttention",
  "TransformerEncoderLayer",
  "LastTimestep",
  "MeanPool",
  "ReLU",
  "GELU",
  "Dropout",
  "BatchNorm",
  "LayerNorm",
  "Flatten",
  "Softmax",
  "Add",
  "Concat",
];

export const CATEGORY_ORDER = [
  "Linear",
  "Convolutional",
  "Pooling",
  "Embedding",
  "Recurrent",
  "Attention",
  "Transformer",
  "Pooling NLP",
  "Activation",
  "Regularization",
  "Normalization",
  "Reshape",
  "Merge",
];

// ─────────────────────────────────────────────────────────────────────────────
// Default parameters per layer kind
// ─────────────────────────────────────────────────────────────────────────────

export interface LinearParams   { in_features: number; out_features: number; bias: boolean }
export interface Conv2dParams   { in_channels: number; out_channels: number; kernel_size: number; stride: number; padding: number }
export interface ReLUParams     { inplace: boolean }
export interface GELUParams     { approximate: "none" | "tanh" }
export interface DropoutParams  { p: number }
export interface BatchNormParams{ num_features: number; eps: number; momentum: number }
export interface FlattenParams  { start_dim: number; end_dim: number }
export interface SoftmaxParams  { dim: number }
export interface MaxPool2dParams{ kernel_size: number; stride: number; padding: number }
export interface AddParams      { _?: never }   // no params
export interface ConcatParams   { dim: number }
export interface EmbeddingParams              { vocab_size: number; embedding_dim: number; padding_idx: number }
export interface PositionalEncodingParams     { d_model: number; max_len: number }
export interface LSTMParams                   { input_size: number; hidden_size: number; num_layers: number; bidirectional: boolean; dropout: number }
export interface GRUParams                    { input_size: number; hidden_size: number; num_layers: number; bidirectional: boolean; dropout: number }
export interface RNNParams                    { input_size: number; hidden_size: number; num_layers: number; bidirectional: boolean; dropout: number; nonlinearity: "tanh" | "relu" }
export interface MultiheadAttentionParams     { embed_dim: number; num_heads: number; dropout: number }
export interface TransformerEncoderLayerParams{ d_model: number; nhead: number; dim_feedforward: number; dropout: number; num_layers: number }
export interface LayerNormParams              { normalized_shape: number; eps: number }
export interface LastTimestepParams           { _?: never }
export interface MeanPoolParams               { _?: never }

export type LayerParams =
  | LinearParams | Conv2dParams | ReLUParams | GELUParams
  | DropoutParams | BatchNormParams | FlattenParams | SoftmaxParams
  | MaxPool2dParams | AddParams | ConcatParams
  | EmbeddingParams | PositionalEncodingParams | LSTMParams | GRUParams | RNNParams
  | MultiheadAttentionParams | TransformerEncoderLayerParams | LayerNormParams
  | LastTimestepParams | MeanPoolParams;

export function defaultLayerParams(kind: LayerKind): Record<string, unknown> {
  switch (kind) {
    case "Linear":    return { in_features: 128, out_features: 64, bias: true } satisfies LinearParams;
    case "Conv2d":    return { in_channels: 3, out_channels: 32, kernel_size: 3, stride: 1, padding: 1 } satisfies Conv2dParams;
    case "ReLU":      return { inplace: false } satisfies ReLUParams;
    case "GELU":      return { approximate: "none" } satisfies GELUParams;
    case "Dropout":   return { p: 0.5 } satisfies DropoutParams;
    case "BatchNorm": return { num_features: 64, eps: 1e-5, momentum: 0.1 } satisfies BatchNormParams;
    case "Flatten":   return { start_dim: 1, end_dim: -1 } satisfies FlattenParams;
    case "Softmax":   return { dim: -1 } satisfies SoftmaxParams;
    case "MaxPool2d": return { kernel_size: 2, stride: 2, padding: 0 } satisfies MaxPool2dParams;
    case "Add":       return {} satisfies AddParams;
    case "Concat":    return { dim: -1 } satisfies ConcatParams;
    case "Embedding":               return { vocab_size: 10000, embedding_dim: 64, padding_idx: 0 } satisfies EmbeddingParams;
    case "PositionalEncoding":      return { d_model: 64, max_len: 5000 } satisfies PositionalEncodingParams;
    case "LSTM":                    return { input_size: 64, hidden_size: 128, num_layers: 1, bidirectional: false, dropout: 0.0 } satisfies LSTMParams;
    case "GRU":                     return { input_size: 64, hidden_size: 128, num_layers: 1, bidirectional: false, dropout: 0.0 } satisfies GRUParams;
    case "RNN":                     return { input_size: 64, hidden_size: 128, num_layers: 1, bidirectional: false, dropout: 0.0, nonlinearity: "tanh" } satisfies RNNParams;
    case "MultiheadAttention":      return { embed_dim: 64, num_heads: 4, dropout: 0.0 } satisfies MultiheadAttentionParams;
    case "TransformerEncoderLayer": return { d_model: 64, nhead: 4, dim_feedforward: 256, dropout: 0.1, num_layers: 2 } satisfies TransformerEncoderLayerParams;
    case "LayerNorm":               return { normalized_shape: 64, eps: 1e-5 } satisfies LayerNormParams;
    case "LastTimestep":            return {} satisfies LastTimestepParams;
    case "MeanPool":                return {} satisfies MeanPoolParams;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape inference helpers — pure functions used by shapeEngine.ts
// Shape is represented as number[] where -1 = dynamic / unknown
// ─────────────────────────────────────────────────────────────────────────────

export type TensorShape = number[];

/** Infer output shape for a single-input layer */
export function inferOutputShape(
  kind: LayerKind,
  params: Record<string, unknown>,
  inputShape: TensorShape | null
): { shape: TensorShape; error?: string } {
  if (!inputShape) return { shape: [], error: "No input shape" };

  switch (kind) {
    case "Linear": {
      const out = Number(params.out_features ?? 64);
      if (inputShape.length < 1) return { shape: [], error: "Linear requires at least 1D input" };
      return { shape: [...inputShape.slice(0, -1), out] };
    }

    case "Conv2d": {
      if (inputShape.length < 3) return { shape: [], error: "Conv2D requires [C,H,W] or [B,C,H,W]" };
      const outCh = Number(params.out_channels ?? 32);
      const k     = Number(params.kernel_size ?? 3);
      const s     = Number(params.stride ?? 1);
      const p     = Number(params.padding ?? 0);
      const hIdx  = inputShape.length - 2;
      const wIdx  = inputShape.length - 1;
      const H = inputShape[hIdx];
      const W = inputShape[wIdx];
      const out = [...inputShape];
      out[inputShape.length - 3] = outCh;
      if (H < 0 || W < 0) { out[hIdx] = -1; out[wIdx] = -1; }
      else { out[hIdx] = Math.floor((H + 2 * p - k) / s) + 1; out[wIdx] = Math.floor((W + 2 * p - k) / s) + 1; }
      return { shape: out };
    }

    case "MaxPool2d": {
      if (inputShape.length < 3) return { shape: [], error: "MaxPool2D requires [C,H,W] or [B,C,H,W]" };
      const k = Number(params.kernel_size ?? 2);
      const s = Number(params.stride ?? 2);
      const p = Number(params.padding ?? 0);
      const hIdx = inputShape.length - 2;
      const wIdx = inputShape.length - 1;
      const H = inputShape[hIdx];
      const W = inputShape[wIdx];
      const out = [...inputShape];
      if (H < 0 || W < 0) { out[hIdx] = -1; out[wIdx] = -1; }
      else { out[hIdx] = Math.floor((H + 2 * p - k) / s) + 1; out[wIdx] = Math.floor((W + 2 * p - k) / s) + 1; }
      return { shape: out };
    }

    case "Flatten": {
      if (inputShape.length < 2) return { shape: inputShape };
      const startDim = Number(params.start_dim ?? 1);
      const prefix = inputShape.slice(0, startDim);
      const rest   = inputShape.slice(startDim);
      const flatDim = rest.reduce((acc, d) => (d < 0 ? -1 : acc < 0 ? -1 : acc * d), 1);
      return { shape: [...prefix, flatDim] };
    }

    // Passthrough layers — shape unchanged
    case "ReLU":
    case "GELU":
    case "Dropout":
    case "BatchNorm":
    case "Softmax":
    case "LayerNorm":
    case "PositionalEncoding":
    case "MultiheadAttention":
    case "TransformerEncoderLayer":
      return { shape: inputShape };

    case "Embedding": {
      // [B, T] → [B, T, D]
      const D = Number(params.embedding_dim ?? 64);
      return { shape: [...inputShape, D] };
    }

    case "LSTM":
    case "GRU":
    case "RNN": {
      // [B, T, D_in] → [B, T, D_h * (2 if bi else 1)]
      if (inputShape.length < 2) return { shape: [], error: `${kind} requires at least [B,T,D] or [T,D]` };
      const H = Number(params.hidden_size ?? 128);
      const bi = Boolean(params.bidirectional ?? false);
      const out = [...inputShape];
      out[out.length - 1] = H * (bi ? 2 : 1);
      return { shape: out };
    }

    case "LastTimestep": {
      // [B, T, D] → [B, D]
      if (inputShape.length < 2) return { shape: [], error: "LastTimestep requires sequence input [B,T,D]" };
      const out = [...inputShape];
      out.splice(out.length - 2, 1); // drop the T dim
      return { shape: out };
    }

    case "MeanPool": {
      // [B, T, D] → [B, D]
      if (inputShape.length < 2) return { shape: [], error: "MeanPool requires sequence input [B,T,D]" };
      const out = [...inputShape];
      out.splice(out.length - 2, 1);
      return { shape: out };
    }

    // Merge nodes — handled by inferMultiInputShape below
    case "Add":
    case "Concat":
      return { shape: inputShape }; // fallback: single input passthrough
  }
}

/**
 * Infer output shape for merge nodes (Add / Concat) that have multiple inputs.
 */
export function inferMultiInputShape(
  kind: LayerKind,
  params: Record<string, unknown>,
  inputShapes: TensorShape[]
): { shape: TensorShape; error?: string } {
  if (inputShapes.length === 0) return { shape: [], error: "No input shapes" };
  if (inputShapes.length === 1) return inferOutputShape(kind, params, inputShapes[0]);

  if (kind === "Add") {
    // All shapes must be identical
    const ref = inputShapes[0];
    for (let i = 1; i < inputShapes.length; i++) {
      const s = inputShapes[i];
      if (s.length !== ref.length || s.some((d, j) => d !== ref[j] && d >= 0 && ref[j] >= 0)) {
        return { shape: [], error: `Add: shape mismatch ${JSON.stringify(ref)} vs ${JSON.stringify(s)}` };
      }
    }
    return { shape: ref };
  }

  if (kind === "Concat") {
    const dim = Number(params.dim ?? 1);
    const ref = inputShapes[0];
    let concatDim = ref[dim] ?? -1;
    for (let i = 1; i < inputShapes.length; i++) {
      const s = inputShapes[i];
      if (s.length !== ref.length) {
        return { shape: [], error: `Concat: rank mismatch ${ref.length} vs ${s.length}` };
      }
      // All dims except concat-dim must match
      for (let j = 0; j < s.length; j++) {
        if (j !== dim && s[j] !== ref[j] && s[j] >= 0 && ref[j] >= 0) {
          return { shape: [], error: `Concat: dim ${j} mismatch ${ref[j]} vs ${s[j]}` };
        }
      }
      const d = s[dim] ?? -1;
      concatDim = concatDim < 0 || d < 0 ? -1 : concatDim + d;
    }
    const out = [...ref];
    out[dim] = concatDim;
    return { shape: out };
  }

  // Non-merge layer with multiple parents — error
  return { shape: [], error: "Multiple inputs require Add or Concat node" };
}
