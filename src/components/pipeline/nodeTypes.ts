export type NodeKind =
  | "dataSource"
  | "filterRows"
  | "dropColumns"
  | "handleMissing"
  | "standardScaler"
  | "oneHotEncode"
  | "labelEncode"
  | "trainTestSplit"
  | "trainModel"
  | "clusterModel"
  | "trainNeuralNetwork"
  | "predictModel"
  | "inverseDesign"
  | "visualizeOutput"
  | "customPython"
  | "replayBuffer"
  | "trainingLoop"
  | "envStep"
  | "modelCheckpoint"
  | "tokenize"
  | "buildVocab"
  | "padSequences"
  | "loadEmbeddings"
  | "tfidfVectorizer"
  | "dataProfile"
  | "exportPDF";

export type IOPortType = "DataFrame" | "NumpyArray" | "TorchModel" | "Dict" | "Scalar" | "Vocab" | "Any";

export interface IOPort {
  name: string;
  type: IOPortType;
  description?: string;
}

export interface IOContract {
  inputs: IOPort[];
  outputs: IOPort[];
}

export const IO_PORT_COLORS: Record<IOPortType, string> = {
  DataFrame:   "#007bff",
  NumpyArray:  "#17C2D7",
  TorchModel:  "#E83E8C",
  Dict:        "#F39C12",
  Scalar:      "#9367B4",
  Vocab:       "#0ea5e9",
  Any:         "#6c757d",
};

export interface NodeMeta {
  label: string;
  color: string;
  iconName: string;
  category: string;
}

export const NODE_META: Record<NodeKind, NodeMeta> = {
  dataSource:     { label: "Data Source",      color: "#007bff", iconName: "Database",    category: "Input" },
  filterRows:     { label: "Filter Rows",      color: "#17C2D7", iconName: "Filter",      category: "Transform" },
  dropColumns:    { label: "Drop Columns",     color: "#17C2D7", iconName: "Columns2",    category: "Transform" },
  handleMissing:  { label: "Handle Missing",   color: "#F39C12", iconName: "Eraser",      category: "Clean" },
  standardScaler: { label: "Standard Scaler",  color: "#9367B4", iconName: "BarChart2",   category: "Feature Eng." },
  oneHotEncode:   { label: "One-Hot Encode",   color: "#17C2D7", iconName: "Binary",      category: "Encoding" },
  labelEncode:    { label: "Label Encode",      color: "#17C2D7", iconName: "Hash",        category: "Encoding" },
  trainTestSplit:  { label: "Train/Test Split", color: "#28a745", iconName: "Scissors",    category: "Prepare" },
  trainModel:           { label: "Train Model",       color: "#E83E8C", iconName: "Brain",       category: "ML" },
  clusterModel:         { label: "Cluster Model",     color: "#9367B4", iconName: "Group",       category: "ML" },
  trainNeuralNetwork:   { label: "Train Neural Net",  color: "#22c55e", iconName: "Network",     category: "ML" },
  predictModel:         { label: "Predict Model",     color: "#E83E8C", iconName: "Database",    category: "ML" },
  inverseDesign:        { label: "Inverse Design",    color: "#F39C12", iconName: "BarChart2",   category: "Optimize" },
  visualizeOutput:   { label: "Visualize Output",  color: "#FF6B35", iconName: "LineChart",  category: "Viz" },
  customPython:      { label: "Custom Python",     color: "#a855f7", iconName: "Code2",      category: "Custom" },
  replayBuffer:      { label: "Replay Buffer",     color: "#06b6d4", iconName: "Database",   category: "RL" },
  trainingLoop:      { label: "Training Loop",     color: "#f97316", iconName: "RefreshCw",  category: "RL" },
  envStep:           { label: "Env Step",          color: "#84cc16", iconName: "Play",       category: "RL" },
  modelCheckpoint:   { label: "Checkpoint",        color: "#eab308", iconName: "Save",       category: "RL" },
  tokenize:          { label: "Tokenize Text",     color: "#0ea5e9", iconName: "Type",       category: "NLP" },
  buildVocab:        { label: "Build Vocabulary",  color: "#38bdf8", iconName: "Book",       category: "NLP" },
  padSequences:      { label: "Pad Sequences",     color: "#22d3ee", iconName: "AlignJustify", category: "NLP" },
  loadEmbeddings:    { label: "Load Embeddings",   color: "#0891b2", iconName: "Download",   category: "NLP" },
  tfidfVectorizer:   { label: "TF-IDF Vectorizer", color: "#67e8f9", iconName: "BarChart2",  category: "NLP" },
  dataProfile:       { label: "Data Profile",      color: "#a78bfa", iconName: "BarChart2",  category: "Analyze" },
  exportPDF:         { label: "Export PDF",         color: "#f472b6", iconName: "FileText",  category: "Export" },
};

export const NODE_KIND_ORDER: NodeKind[] = [
  "dataSource",
  "filterRows",
  "dropColumns",
  "handleMissing",
  "standardScaler",
  "oneHotEncode",
  "labelEncode",
  "trainTestSplit",
  "trainModel",
  "clusterModel",
  "trainNeuralNetwork",
  "predictModel",
  "inverseDesign",
  "visualizeOutput",
  "customPython",
  "replayBuffer",
  "trainingLoop",
  "envStep",
  "modelCheckpoint",
  "tokenize",
  "buildVocab",
  "padSequences",
  "loadEmbeddings",
  "tfidfVectorizer",
  "dataProfile",
  "exportPDF",
];

export function defaultParams(kind: NodeKind): Record<string, unknown> {
  switch (kind) {
    case "dataSource":     return {};
    case "filterRows":     return { column: "", operator: ">", value: "" };
    case "dropColumns":    return { columns: [] as string[] };
    case "handleMissing":  return { strategy: "mean", columns: [] as string[] };
    case "standardScaler": return { columns: [] as string[] };
    case "oneHotEncode":   return { columns: [] as string[], drop_first: false };
    case "labelEncode":    return { columns: [] as string[] };
    case "trainTestSplit":  return { ratio: 0.2, seed: 42 };
    case "trainModel":      return { algorithm: "logistic_regression", target: "", features: [] as string[] };
    case "clusterModel":          return { algorithm: "kmeans", features: [] as string[], n_clusters: 3, eps: 0.5, min_samples: 5 };
    case "trainNeuralNetwork":    return { target: "", target_cols: [] as string[], task: "", epochs: 30, lr: 0.001, batch_size: 32, nn_graph: null };
    case "predictModel":          return {};
    case "inverseDesign":         return {
      desired_outputs: {} as Record<string, number>,
      n_steps: 200,
      lr: 0.05,
      n_starts: 3,
      optimizer: "adam",
      early_stopping: true,
      patience: 20,
      constraint_method: "augmented_lagrangian",
      bounds: {} as Record<string, [number, number]>,
      feature_lock: {} as Record<string, number>,
      constraints: [] as unknown[],
    };
    case "visualizeOutput":    return { chart_type: "scatter", x_col: "", y_col: "", color_col: "" };
    case "customPython":       return {
      code: "# inputs dict contains your declared input ports\n# assign outputs = {...} before the end\noutputs = {\"df\": inputs.get(\"df\")}",
      io_contract: { inputs: [{ name: "df", type: "DataFrame" }], outputs: [{ name: "df", type: "DataFrame" }] } as IOContract,
      timeout: 60,
    };
    case "replayBuffer":       return { capacity: 10000, prioritized: false, alpha: 0.6, beta: 0.4 };
    case "trainingLoop":       return { steps: 5000, eval_every: 500, log_every: 100, target_update_every: 200 };
    case "envStep":            return { ticks: 1 };
    case "modelCheckpoint":    return { checkpoint_name: "", mode: "save" };
    case "tokenize":           return {
      text_column: "",
      method: "whitespace",      // "whitespace" | "regex_word" | "char"
      lowercase: true,
      strip_punct: false,
      output_column: "",          // empty → defaults to `<text_column>_tokens`
    };
    case "buildVocab":         return {
      tokens_column: "",
      vocab_size: 10000,
      min_freq: 2,
      special_tokens: ["<pad>", "<unk>", "<bos>", "<eos>"] as string[],
    };
    case "padSequences":       return {
      tokens_column: "",
      max_length: 128,
      padding: "post",            // "pre" | "post"
      truncating: "post",         // "pre" | "post"
      output_column: "",
      add_bos: false,
      add_eos: false,
    };
    case "loadEmbeddings":     return {
      embedding_path: "",         // server-side absolute path or relative to backend/runs
      dim: 100,
    };
    case "tfidfVectorizer":    return {
      text_column: "",
      max_features: 1000,
      ngram_range_min: 1,
      ngram_range_max: 1,
      lowercase: true,
    };
    case "dataProfile":        return {
      columns: [] as string[],
    };
    case "exportPDF":          return {
      title: "Quasar Studio Report",
    };
  }
}

export interface DatasetInfo {
  filename: string;
  rows: number;
  col_count: number;
  columns: string[];
  numericColumns: string[];
}
