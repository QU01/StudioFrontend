"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { X, Play, Square, ChevronDown, ChevronRight, Plus, Trash2, RefreshCw } from "lucide-react";
import { IO_PORT_COLORS, type IOContract, type IOPort, type IOPortType } from "./nodeTypes";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

const PORT_TYPES: IOPortType[] = ["DataFrame", "NumpyArray", "TorchModel", "Dict", "Scalar", "Any"];

interface LogEntry {
  id: number;
  type: "log" | "error" | "info";
  stream?: "stdout" | "stderr";
  text: string;
}

interface Props {
  nodeLabel: string;
  code: string;
  ioContract: IOContract;
  timeout: number;
  onSave: (code: string, ioContract: IOContract, timeout: number) => void;
  onClose: () => void;
}

export function CustomPythonEditorModal({
  nodeLabel,
  code: initialCode,
  ioContract: initialContract,
  timeout: initialTimeout,
  onSave,
  onClose,
}: Props) {
  const [code, setCode] = useState(initialCode);
  const [contract, setContract] = useState<IOContract>(initialContract);
  const [timeoutSecs, setTimeoutSecs] = useState(initialTimeout);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [contractOpen, setContractOpen] = useState(true);
  // For TorchModel inputs: user can specify upstream node ID to pull the model from
  const [modelRefs, setModelRefs] = useState<Record<string, string>>({});
  const [cachedModelIds, setCachedModelIds] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const fetchCachedModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("quasar_access_token") ?? "" : "";
      const res = await fetch(`${API_BASE}/api/pipeline/cached-models`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as { node_ids: string[] };
        setCachedModelIds(data.node_ids ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingModels(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    const hasTorchInput = contract.inputs.some((p) => p.type === "TorchModel");
    if (hasTorchInput) fetchCachedModels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = useCallback((entry: Omit<LogEntry, "id">) => {
    setLogs((prev) => [...prev, { ...entry, id: logIdRef.current++ }]);
  }, []);

  const runCode = useCallback(() => {
    if (isRunning) return;
    setLogs([]);
    setIsRunning(true);

    const ws = new WebSocket(`${WS_BASE}/api/pipeline/run-node/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog({ type: "info", text: `▶ Starting… (timeout: ${timeoutSecs}s)` });
      ws.send(
        JSON.stringify({
          code,
          timeout: timeoutSecs,
          inputs: {},
          model_refs: modelRefs,
        })
      );
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === "log") {
          addLog({ type: "log", stream: msg.stream as "stdout" | "stderr", text: msg.text });
        } else if (msg.type === "error") {
          addLog({ type: "error", text: msg.text });
        } else if (msg.type === "done") {
          if (msg.success) {
            const keys = (msg.output_keys as string[] | null) ?? [];
            addLog({ type: "info", text: `✓ Done${keys.length ? ` — outputs: [${keys.join(", ")}]` : ""}` });
            if (msg.metrics) {
              addLog({
                type: "info",
                text: `Metrics: ${JSON.stringify(msg.metrics, null, 0)}`,
              });
            }
          } else {
            addLog({ type: "error", text: `✗ Failed: ${msg.error ?? "unknown error"}` });
          }
          setIsRunning(false);
          wsRef.current = null;
        }
      } catch {
        addLog({ type: "log", stream: "stdout", text: ev.data as string });
      }
    };

    ws.onerror = () => {
      addLog({ type: "error", text: "WebSocket error — is the backend running on :8000?" });
      setIsRunning(false);
    };

    ws.onclose = () => {
      setIsRunning((r) => {
        if (r) addLog({ type: "info", text: "Connection closed." });
        return false;
      });
    };
  }, [code, timeoutSecs, modelRefs, isRunning, addLog]);

  const stopRun = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    addLog({ type: "info", text: "⏹ Stopped by user." });
    setIsRunning(false);
  }, [addLog]);

  const updatePort = (side: "inputs" | "outputs", idx: number, field: keyof IOPort, value: string) => {
    const ports = [...contract[side]];
    ports[idx] = { ...ports[idx], [field]: value };
    setContract({ ...contract, [side]: ports });
  };

  const addPort = (side: "inputs" | "outputs") =>
    setContract({
      ...contract,
      [side]: [
        ...contract[side],
        { name: `${side === "inputs" ? "in" : "out"}${contract[side].length + 1}`, type: "DataFrame" as IOPortType },
      ],
    });

  const removePort = (side: "inputs" | "outputs", idx: number) =>
    setContract({ ...contract, [side]: contract[side].filter((_, i) => i !== idx) });

  const handleSave = () => {
    onSave(code, contract, timeoutSecs);
    onClose();
  };

  // Keyboard shortcut: Escape → close if not running
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isRunning) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRunning, onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="flex flex-col w-[96vw] h-[93vh] bg-[#0f1318] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#141922] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#a855f7] shrink-0" />
            <span className="text-white/80 text-[13px] font-semibold">Custom Python Editor</span>
            <span className="text-white/30 text-[12px]">— {nodeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white border border-[#007bff]/50 hover:bg-[#007bff]/20 transition-colors"
            >
              Save & Close
            </button>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors p-1 rounded"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0">

          {/* Left: Monaco editor */}
          <div className="flex-1 min-w-0 border-r border-white/10">
            <MonacoEditor
              height="100%"
              language="python"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val ?? "")}
              options={{
                minimap: { enabled: true },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                tabSize: 4,
                wordWrap: "off",
                automaticLayout: true,
                folding: true,
                renderLineHighlight: "all",
                padding: { top: 14, bottom: 14 },
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
              }}
            />
          </div>

          {/* Right: Config + Logs */}
          <div className="w-[330px] shrink-0 flex flex-col bg-[#0d1117] overflow-hidden">

            {/* IO Contract */}
            <div className="border-b border-white/10">
              <button
                className="flex items-center gap-2 w-full px-4 py-2.5 text-[10px] uppercase tracking-widest text-white/40 hover:text-white/60 font-bold transition-colors"
                onClick={() => setContractOpen((o) => !o)}
              >
                {contractOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                IO Contract
              </button>

              {contractOpen && (
                <div className="px-4 pb-4 space-y-4">
                  {(["inputs", "outputs"] as const).map((side) => (
                    <div key={side}>
                      <div className="text-[9px] text-white/25 uppercase tracking-widest mb-1.5 font-bold">
                        {side}
                      </div>
                      <div className="space-y-1.5">
                        {contract[side].map((port, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: "50%",
                                  background: IO_PORT_COLORS[port.type] ?? "#6c757d",
                                  flexShrink: 0,
                                  display: "inline-block",
                                }}
                              />
                              <input
                                className="flex-1 min-w-0 bg-[#1a2030] border border-white/10 rounded px-2 py-0.5 text-[11px] text-white/80 focus:outline-none focus:border-[#a855f7]"
                                value={port.name}
                                onChange={(e) => updatePort(side, idx, "name", e.target.value)}
                                placeholder="name"
                              />
                              <select
                                className="bg-[#1a2030] border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/60 focus:outline-none focus:border-[#a855f7]"
                                value={port.type}
                                onChange={(e) => updatePort(side, idx, "type", e.target.value)}
                              >
                                {PORT_TYPES.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => removePort(side, idx)}
                                className="text-white/20 hover:text-red-400 shrink-0 transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                            {/* TorchModel input: dropdown of cached model node IDs */}
                            {side === "inputs" && port.type === "TorchModel" && (
                              <div className="flex items-center gap-1 pl-4">
                                <span className="text-[9px] text-white/25 shrink-0">model src</span>
                                {cachedModelIds.length > 0 ? (
                                  <select
                                    className="flex-1 min-w-0 bg-[#1a2030] border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/70 focus:outline-none focus:border-[#a855f7] font-mono"
                                    value={modelRefs[port.name] ?? ""}
                                    onChange={(e) =>
                                      setModelRefs((r) => ({ ...r, [port.name]: e.target.value }))
                                    }
                                  >
                                    <option value="">— pick node —</option>
                                    {cachedModelIds.map((id) => (
                                      <option key={id} value={id}>{id}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    className="flex-1 min-w-0 bg-[#1a2030] border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/60 focus:outline-none focus:border-[#a855f7] font-mono"
                                    placeholder="run pipeline first"
                                    value={modelRefs[port.name] ?? ""}
                                    onChange={(e) =>
                                      setModelRefs((r) => ({ ...r, [port.name]: e.target.value }))
                                    }
                                  />
                                )}
                                <button
                                  onClick={fetchCachedModels}
                                  title="Refresh available models"
                                  className="text-white/20 hover:text-[#a855f7] transition-colors shrink-0"
                                >
                                  <RefreshCw size={10} className={loadingModels ? "animate-spin" : ""} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => addPort(side)}
                          className="text-[10px] text-[#a855f7] hover:text-[#c084fc] flex items-center gap-1 mt-1 transition-colors"
                        >
                          <Plus size={10} /> Add {side === "inputs" ? "input" : "output"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timeout */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 shrink-0">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold shrink-0">
                Timeout (s)
              </span>
              <input
                type="number"
                min={5}
                max={600}
                value={timeoutSecs}
                onChange={(e) => setTimeoutSecs(Number(e.target.value))}
                className="w-20 bg-[#1a2030] border border-white/10 rounded px-2 py-1 text-[12px] text-white/80 focus:outline-none focus:border-[#a855f7]"
              />
            </div>

            {/* Run / Stop */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 shrink-0">
              {isRunning ? (
                <button
                  onClick={stopRun}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "#c0392b", boxShadow: "0 0 10px rgba(192,57,43,0.5)" }}
                >
                  <Square size={12} /> Stop
                </button>
              ) : (
                <button
                  onClick={runCode}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "#a855f7", boxShadow: "0 0 10px rgba(168,85,247,0.4)" }}
                >
                  <Play size={12} /> Test Run
                </button>
              )}
            </div>

            {/* Log panel */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
              <span className="text-[9px] text-white/25 uppercase tracking-widest font-bold">
                Execution Log
              </span>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="text-[9px] text-white/20 hover:text-white/40 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-px font-mono text-[11px] leading-[1.6]">
              {logs.length === 0 ? (
                <p className="text-white/15 text-center pt-8 text-[11px]">
                  No output yet — click Test Run
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`whitespace-pre-wrap break-words ${
                      log.type === "error"
                        ? "text-red-400"
                        : log.type === "info"
                        ? "text-[#a855f7]"
                        : log.stream === "stderr"
                        ? "text-yellow-400/80"
                        : "text-white/70"
                    }`}
                  >
                    {log.text}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
