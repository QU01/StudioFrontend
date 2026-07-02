"use client";

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { Send, Bot, User, Loader2, ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle, X, Settings, ShieldAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  createAgentWebSocket,
  restoreProviderFromBridge,
  type AgentWebSocket,
  type AgentEvent,
  type ChatMessage,
  type ToolCallDisplay,
} from "@/lib/agent-api";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import {
  agentAddPipelineNode,
  agentExecutePipeline,
  agentDesignNN,
  agentDataLoaded,
  agentSwitchView,
  agentNNTrainComplete,
  agentModelEvaluation,
} from "@/lib/agent-events";

// react-plotly.js requires dynamic import (no SSR)
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// ── Helpers ───────────────────────────────────────────────────────────────────

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function parseVisualizationSpec(output: string): object | null {
  const marker = "VISUALIZATION_SPEC:";
  if (!output.startsWith(marker)) return null;
  try {
    return JSON.parse(output.slice(marker.length));
  } catch {
    return null;
  }
}

/** Dispatch canvas events based on tool name and its inputs/outputs */
function dispatchCanvasEvent(tool: string, input: Record<string, unknown>, output: string): void {
  try {
    if (tool === "load_dataset") {
      // Parse "Rows: N, Columns: M" from output
      const rowsMatch = output.match(/Rows:\s*(\d+)/);
      const colsMatch = output.match(/Columns:\s*(\d+)/);
      const nameMatch = output.match(/Dataset loaded:\s*'([^']+)'/);
      agentDataLoaded({
        filename: nameMatch?.[1] ?? "dataset",
        rows: parseInt(rowsMatch?.[1] ?? "0"),
        columns: parseInt(colsMatch?.[1] ?? "0"),
      });
    } else if (tool === "apply_transformation") {
      const kind = (input.kind as string) ?? "";
      let params: Record<string, unknown> = {};
      try {
        params = typeof input.params === "string" ? JSON.parse(input.params) : (input.params as Record<string, unknown>) ?? {};
      } catch { /* keep empty */ }
      if (kind) {
        agentAddPipelineNode({ kind, params, connectToLast: true });
      }
    } else if (tool === "train_ml_model") {
      agentAddPipelineNode({
        kind: "trainModel",
        params: {
          algorithm: input.algorithm ?? "logistic_regression",
          target: input.target ?? "",
          features: input.features ? String(input.features).split(",").map((s) => s.trim()).filter(Boolean) : [],
        },
        connectToLast: true,
      });
    } else if (tool === "design_neural_network") {
      let layers: Array<{ kind: string; params: Record<string, unknown> }> = [];
      try {
        layers = JSON.parse(input.layers_json as string ?? "[]");
      } catch { /* keep empty */ }
      if (layers.length > 0) {
        agentDesignNN({ layers });
        agentSwitchView("neural");
      }
    } else if (tool === "train_neural_network") {
      // Parse final metrics from output text
      const epochsMatch = output.match(/Epochs completed:\s*(\d+)/);
      const lossMatch = output.match(/Final train loss:\s*([\d.]+)/);
      const accMatch = output.match(/Final train accuracy:\s*([\d.]+)/);
      const valLossMatch = output.match(/Final val loss:\s*([\d.]+)/);
      const valAccMatch = output.match(/Final val accuracy:\s*([\d.]+)/);
      agentSwitchView("neural");
      agentNNTrainComplete({
        epochs: parseInt(epochsMatch?.[1] ?? "0"),
        finalLoss: parseFloat(lossMatch?.[1] ?? "0"),
        finalAccuracy: parseFloat(accMatch?.[1] ?? "0"),
        valLoss: valLossMatch ? parseFloat(valLossMatch[1]) : undefined,
        valAccuracy: valAccMatch ? parseFloat(valAccMatch[1]) : undefined,
      });
    } else if (tool === "get_model_evaluation") {
      agentModelEvaluation({ metrics: { raw: output } });
    }
  } catch {
    // Silently ignore dispatch errors — canvas update is best-effort
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VisualizationArtifact({ spec }: { spec: object }) {
  const fig = spec as { data?: unknown[]; layout?: object };
  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
      <Plot
        data={(fig.data ?? []) as Plotly.Data[]}
        layout={{
          ...(fig.layout ?? {}),
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(24,29,35,0.8)",
          font: { color: "#e2e4e7" },
          margin: { l: 40, r: 20, t: 30, b: 40 },
          autosize: true,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", minHeight: 240 }}
        useResizeHandler
      />
    </div>
  );
}

function ToolCallCard({ tc }: { tc: ToolCallDisplay }) {
  const [expanded, setExpanded] = useState(false);
  const vizSpec = tc.output ? parseVisualizationSpec(tc.output) : null;

  const statusIcon =
    tc.status === "running" ? (
      <Loader2 size={13} className="animate-spin" style={{ color: "var(--electric)" }} />
    ) : tc.status === "done" ? (
      <CheckCircle size={13} style={{ color: "#4ade80" }} />
    ) : (
      <XCircle size={13} style={{ color: "#f87171" }} />
    );

  const displayOutput = vizSpec
    ? "(chart rendered below)"
    : tc.output?.length > 250
    ? tc.output.slice(0, 250) + "…"
    : tc.output;

  return (
    <div
      className="mt-1.5 rounded-lg text-xs border"
      style={{
        backgroundColor: "color-mix(in oklch, var(--electric) 4%, #1e242d)",
        borderColor: "color-mix(in oklch, var(--electric) 15%, transparent)",
      }}
    >
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Wrench size={11} style={{ color: "var(--electric)" }} />
        <span style={{ color: "var(--electric)" }} className="font-mono font-semibold">
          {tc.tool}
        </span>
        <span className="flex-1" />
        {statusIcon}
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 space-y-1.5 border-t border-white/5">
          {Object.keys(tc.input).length > 0 && (
            <div>
              <div className="text-white/40 uppercase tracking-widest text-[10px] mt-1.5 mb-0.5">Input</div>
              <pre className="text-white/55 whitespace-pre-wrap break-all font-mono text-[10px]">
                {JSON.stringify(tc.input, null, 2)}
              </pre>
            </div>
          )}
          {tc.output && (
            <div>
              <div className="text-white/40 uppercase tracking-widest text-[10px] mt-1.5 mb-0.5">Output</div>
              <pre className="text-white/55 whitespace-pre-wrap break-all font-mono text-[10px]">
                {displayOutput}
              </pre>
            </div>
          )}
        </div>
      )}

      {vizSpec && <VisualizationArtifact spec={vizSpec} />}
    </div>
  );
}

function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-end gap-2 items-start">
      <div
        className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2.5 text-sm"
        style={{
          background: "linear-gradient(135deg, var(--electric) 0%, #683cff 100%)",
          color: "#fff",
          boxShadow: "0 0 12px color-mix(in oklch, var(--electric) 20%, transparent)",
        }}
      >
        {msg.content}
      </div>
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #683cff, #7214ca)" }}
      >
        <User size={13} className="text-white" />
      </div>
    </div>
  );
}

function AssistantBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  return (
    <div className="flex gap-2 items-start">
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background: "color-mix(in oklch, var(--electric) 10%, #1e242d)",
          border: "1px solid color-mix(in oklch, var(--electric) 30%, transparent)",
        }}
      >
        {isStreaming ? (
          <Loader2 size={12} className="animate-spin" style={{ color: "var(--electric)" }} />
        ) : (
          <Bot size={12} style={{ color: "var(--electric)" }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="space-y-0.5 mb-1.5">
            {msg.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} tc={tc} />
            ))}
          </div>
        )}
        {msg.content && (
          <div
            className="rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-white/85 agent-md"
            style={{
              backgroundColor: "#1e242d",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                em: ({ children }) => <em className="italic text-white/70">{children}</em>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <code className="block bg-black/30 rounded-lg px-3 py-2 mt-1 mb-2 text-[11px] font-mono text-[#00f0ff] whitespace-pre overflow-x-auto">{children}</code>
                  ) : (
                    <code className="bg-black/30 rounded px-1.5 py-0.5 text-[11px] font-mono text-[#00f0ff]">{children}</code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed text-white/80">{children}</li>,
                h1: ({ children }) => <h1 className="text-base font-bold text-white mb-1.5 mt-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-bold text-white mb-1 mt-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-white/90 mb-1 mt-1.5">{children}</h3>,
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-2">
                    <table className="text-[11px] border-collapse w-full">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead>{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr className="border-b border-white/8">{children}</tr>,
                th: ({ children }) => (
                  <th className="px-2 py-1 text-left font-semibold text-white/60 bg-white/5">{children}</th>
                ),
                td: ({ children }) => <td className="px-2 py-1 text-white/75">{children}</td>,
                hr: () => <hr className="border-white/10 my-2" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-[#00f0ff]/40 pl-3 my-1.5 text-white/60 italic">{children}</blockquote>
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
            {isStreaming && (
              <span
                className="inline-block w-1.5 h-3.5 ml-0.5 align-middle animate-pulse"
                style={{ backgroundColor: "var(--electric)" }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeCard() {
  return (
    <div className="flex h-full items-center justify-center p-6 pt-12">
      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "color-mix(in oklch, var(--electric) 8%, #1e242d)",
            border: "1px solid color-mix(in oklch, var(--electric) 20%, transparent)",
            boxShadow: "0 0 20px color-mix(in oklch, var(--electric) 15%, transparent)",
          }}
        >
          <Bot size={28} style={{ color: "var(--electric)" }} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold tracking-tight">QUO</h3>
          <p className="text-xs text-white/45 leading-relaxed">
            Describe what you want — I'll load data, build pipelines, train models, and operate the entire studio for you.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {["Analyze the dataset", "Train a model", "Show correlations", "Suggest next step"].map((s) => (
            <span
              key={s}
              className="rounded-full px-2.5 py-1 text-[11px]"
              style={{
                backgroundColor: "color-mix(in oklch, var(--electric) 8%, transparent)",
                color: "var(--electric)",
                border: "1px solid color-mix(in oklch, var(--electric) 20%, transparent)",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AgentChatDrawerProps {
  onClose?: () => void;
}

export function AgentChatDrawer({ onClose }: AgentChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  // Pending HITL confirmation requested by a destructive/costly tool (id → hint/tool/status).
  const [confirmation, setConfirmation] = useState<{
    id: string;
    tool: string;
    hint: string;
    status: "pending" | "approved" | "rejected";
  } | null>(null);
  const wsRef = useRef<AgentWebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  // On mount, re-apply the saved (encrypted) provider + key to the backend so QUO
  // works after a restart without the user re-pasting the key (D-24). No-op in web/dev.
  useEffect(() => {
    void restoreProviderFromBridge();
  }, []);

  useEffect(() => {
    const ws = createAgentWebSocket(handleEvent);
    wsRef.current = ws;
    return () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case "text_chunk": {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === "streaming") {
            return [...prev.slice(0, -1), { ...last, content: last.content + (event.content ?? "") }];
          }
          return [...prev, { id: "streaming", role: "assistant", content: event.content ?? "", toolCalls: [], timestamp: Date.now() }];
        });
        break;
      }

      case "tool_start": {
        const newTc: ToolCallDisplay = {
          id: nanoid(),
          tool: event.tool ?? "unknown",
          input: event.input ?? {},
          output: "",
          status: "running",
        };
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, toolCalls: [...(last.toolCalls ?? []), newTc] }];
          }
          return [...prev, { id: "streaming", role: "assistant", content: "", toolCalls: [newTc], timestamp: Date.now() }];
        });
        break;
      }

      case "tool_end": {
        // Dispatch canvas event based on tool
        dispatchCanvasEvent(event.tool ?? "", event.input ?? {}, event.output ?? "");

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role !== "assistant") return prev;
          const updatedTcs = (last.toolCalls ?? []).map((tc) =>
            tc.tool === event.tool && tc.status === "running"
              ? { ...tc, output: event.output ?? "", status: "done" as const }
              : tc
          );
          return [...prev.slice(0, -1), { ...last, toolCalls: updatedTcs }];
        });
        break;
      }

      case "tool_confirmation": {
        // Destructive/costly tool paused — show inline approve/reject prompt (HITL).
        if (event.id) {
          setConfirmation({
            id: event.id,
            tool: event.tool ?? "acción",
            hint: event.hint ?? "Esta acción requiere tu confirmación.",
            status: "pending",
          });
          setIsStreaming(false);
        }
        break;
      }

      case "done": {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === "streaming") {
            return [...prev.slice(0, -1), { ...last, id: nanoid() }];
          }
          return prev;
        });
        setIsStreaming(false);
        // Turn finished — clear any resolved confirmation prompt.
        setConfirmation((prev) => (prev && prev.status !== "pending" ? null : prev));
        break;
      }

      case "error": {
        setMessages((prev) => [
          ...prev,
          { id: nanoid(), role: "assistant", content: `Error: ${event.content ?? "Unknown error"}`, timestamp: Date.now() },
        ]);
        setIsStreaming(false);
        break;
      }
    }
  }, []);

  const sendMessage = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    const userMsg: ChatMessage = { id: nanoid(), role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsStreaming(true);
    wsRef.current?.send(text, messages);
  }, [inputValue, isStreaming, messages]);

  const respondConfirmation = useCallback(
    (approved: boolean) => {
      setConfirmation((prev) => {
        if (!prev) return prev;
        wsRef.current?.sendConfirmation(prev.id, approved);
        if (approved) setIsStreaming(true); // approved → tool resumes, stream continues
        return { ...prev, status: approved ? "approved" : "rejected" };
      });
    },
    []
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="relative flex flex-col h-full" style={{ backgroundColor: "#181d23" }}>
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{
          backgroundColor: "#1e242d",
          borderColor: "rgba(255,255,255,0.06)",
          boxShadow: "0 1px 0 rgba(0,240,255,0.05)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "color-mix(in oklch, var(--electric) 12%, #1e242d)",
              border: "1px solid color-mix(in oklch, var(--electric) 25%, transparent)",
            }}
          >
            <Bot size={14} style={{ color: "var(--electric)" }} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-white leading-none">QUO</div>
            <div className="text-[10px] text-white/35 leading-none mt-0.5">
              {isStreaming ? (
                <span style={{ color: "var(--electric)" }} className="animate-pulse">Thinking…</span>
              ) : "Ready"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Ajustes del proveedor de IA"
            title="Proveedor / modelo / clave"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all"
            style={showSettings ? { color: "var(--electric)" } : undefined}
          >
            <Settings size={15} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Settings overlay — proveedor/modelo/clave (D-24) */}
      {showSettings && (
        <div className="absolute inset-0 z-20">
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* Message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <WelcomeCard />
        ) : (
          messages.map((msg) =>
            msg.role === "user" ? (
              <UserBubble key={msg.id} msg={msg} />
            ) : (
              <AssistantBubble key={msg.id} msg={msg} isStreaming={isStreaming && msg.id === "streaming"} />
            )
          )
        )}

        {/* HITL confirmation prompt — destructive/costly tool awaiting approval */}
        {confirmation && (
          <div
            className="rounded-xl p-3 text-sm"
            style={{
              backgroundColor: "color-mix(in oklch, var(--quasar-warning, #F59E0B) 8%, #1e242d)",
              border: "1px solid color-mix(in oklch, var(--quasar-warning, #F59E0B) 35%, transparent)",
            }}
          >
            <div className="flex items-start gap-2">
              <ShieldAlert size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--quasar-warning, #F59E0B)" }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white/90">Confirmación requerida</div>
                <div className="text-white/60 text-[12px] mt-0.5">
                  <span className="font-mono" style={{ color: "var(--electric)" }}>{confirmation.tool}</span>
                  {" — "}
                  {confirmation.hint}
                </div>
              </div>
            </div>
            {confirmation.status === "pending" ? (
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={() => respondConfirmation(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-semibold text-white transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, var(--electric), var(--electric-dim))" }}
                >
                  <CheckCircle size={13} /> Aprobar
                </button>
                <button
                  onClick={() => respondConfirmation(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-semibold transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: "var(--surface-3)",
                    color: "rgba(255,255,255,0.75)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <XCircle size={13} /> Rechazar
                </button>
              </div>
            ) : (
              <div
                className="mt-2 text-[12px] font-medium flex items-center gap-1.5"
                style={{ color: confirmation.status === "approved" ? "#4ade80" : "#f87171" }}
              >
                {confirmation.status === "approved" ? <CheckCircle size={13} /> : <XCircle size={13} />}
                {confirmation.status === "approved" ? "Aprobado" : "Rechazado"}
              </div>
            )}
          </div>
        )}

        {isStreaming && !lastIsAssistant && (
          <div className="flex gap-2 items-center">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: "color-mix(in oklch, var(--electric) 10%, #1e242d)",
                border: "1px solid color-mix(in oklch, var(--electric) 30%, transparent)",
              }}
            >
              <Loader2 size={12} className="animate-spin" style={{ color: "var(--electric)" }} />
            </div>
            <span className="text-white/40 text-xs italic">Thinking…</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 border-t px-3 py-3"
        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#1e242d" }}
      >
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2.5"
          style={{
            backgroundColor: "#181d23",
            border: "1px solid color-mix(in oklch, var(--electric) 20%, rgba(255,255,255,0.07))",
            boxShadow: "0 0 16px color-mix(in oklch, var(--electric) 6%, transparent)",
          }}
        >
          <textarea
            className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/30 resize-none focus:outline-none leading-relaxed"
            style={{ minHeight: 36, maxHeight: 140 }}
            placeholder="Describe what you want to do…"
            value={inputValue}
            rows={1}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
            }}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isStreaming}
            className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
            style={{
              background: "linear-gradient(135deg, var(--electric), #683cff)",
              boxShadow: inputValue.trim() && !isStreaming ? "0 0 10px color-mix(in oklch, var(--electric) 35%, transparent)" : "none",
            }}
          >
            {isStreaming ? (
              <Loader2 size={14} className="text-white animate-spin" />
            ) : (
              <Send size={14} className="text-white" />
            )}
          </button>
        </div>
        <p className="text-center text-[9px] text-white/18 mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// Keep AgentView as alias for backwards compatibility (page.tsx)
export { AgentChatDrawer as AgentView };
