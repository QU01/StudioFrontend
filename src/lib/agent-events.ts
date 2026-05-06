/**
 * Lightweight global event bus for agent → canvas communication.
 * Uses window CustomEvents so PipelineView / NeuralNetView can react
 * to agent tool calls without a shared state library.
 */

// ── Payload types ─────────────────────────────────────────────────────────────

export interface AgentAddPipelineNode {
  kind: string;
  params: Record<string, unknown>;
  connectToLast?: boolean;
}

export interface AgentNNDesign {
  layers: Array<{ kind: string; params: Record<string, unknown> }>;
  inputShape?: number[];
}

export interface AgentDataLoaded {
  filename: string;
  rows: number;
  columns: number;
}

export interface AgentNNTrainComplete {
  epochs: number;
  finalLoss: number;
  finalAccuracy: number;
  valLoss?: number;
  valAccuracy?: number;
}

export interface AgentModelEvaluation {
  metrics: Record<string, unknown>;
}

export interface LoadPipelineEvent {
  id: number;
  name: string;
  nodes: any[];
  edges: any[];
}

export interface LoadArchitectureEvent {
  id: number;
  name: string;
  config: {
    inputShape: number[];
    nodes: any[];
    edges: any[];
  };
}

// ── Core helpers ──────────────────────────────────────────────────────────────

export function dispatchAgentEvent<T>(name: string, detail: T): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`agent:${name}`, { detail }));
}

/** Returns a cleanup function — call it in useEffect return. */
export function onAgentEvent<T>(
  name: string,
  handler: (detail: T) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<T>).detail);
  window.addEventListener(`agent:${name}`, listener);
  return () => window.removeEventListener(`agent:${name}`, listener);
}

// ── Typed dispatchers (called from AgentChatDrawer on tool_end) ───────────────

export function agentAddPipelineNode(detail: AgentAddPipelineNode): void {
  dispatchAgentEvent("pipeline:addNode", detail);
}

export function agentExecutePipeline(): void {
  dispatchAgentEvent("pipeline:execute", {});
}

export function agentDesignNN(detail: AgentNNDesign): void {
  dispatchAgentEvent("nn:design", detail);
}

export function agentDataLoaded(detail: AgentDataLoaded): void {
  dispatchAgentEvent("dataLoaded", detail);
}

export function agentSwitchView(view: string): void {
  dispatchAgentEvent("switchView", { view });
}

export function agentNNTrainComplete(detail: AgentNNTrainComplete): void {
  dispatchAgentEvent("nn:trainComplete", detail);
}

export function agentNNCheckpointLoaded(): void {
  dispatchAgentEvent("nn:checkpointLoaded", {});
}

export function agentNNSolutionLoaded(detail: any): void {
  dispatchAgentEvent("nn:solutionLoaded", detail);
}

export function agentModelEvaluation(detail: AgentModelEvaluation): void {
  dispatchAgentEvent("model:evaluation", detail);
}

export function loadPipeline(detail: LoadPipelineEvent): void {
  dispatchAgentEvent("pipeline:load", detail);
}

export function loadArchitecture(detail: LoadArchitectureEvent): void {
  dispatchAgentEvent("architecture:load", detail);
}
