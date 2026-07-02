import { fetchWithAuth } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

// ── Provider / model / key wiring (D-24, RQ-X-1) ────────────────────────────────

export type ProviderId = "gemini" | "ollama" | "openai_compatible";

export interface ProviderConfig {
  provider: ProviderId;
  model_id: string;
  api_base?: string | null;
  api_key?: string | null;
}

/**
 * The Electron preload bridge (window.__quasar__). Present only in the packaged /
 * Electron shell — undefined in a plain browser dev session (degrade to env override).
 */
export interface QuasarBridge {
  platform: string;
  version: string;
  keys: {
    set: (provider: string, apiKey: string) => Promise<{ ok: boolean; reason?: string }>;
    get: (provider: string) => Promise<string | null>;
    available: () => Promise<boolean>;
  };
  provider: {
    set: (config: { provider: string; model_id: string; api_base?: string | null }) => Promise<{ ok: boolean; reason?: string }>;
    get: () => Promise<{ provider: string; model_id: string; api_base?: string | null } | null>;
  };
}

export function getQuasarBridge(): QuasarBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __quasar__?: QuasarBridge }).__quasar__;
}

/**
 * POST the provider/model/key to the backend so the ADK agent uses them (RQ-X-1).
 * The key travels only in memory over loopback; the backend never persists it.
 */
export async function setProvider(config: ProviderConfig): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/system/provider`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "setProvider failed" }));
    throw new Error(err.detail ?? "setProvider failed");
  }
}

/**
 * On startup (Electron only): re-apply the saved provider + decrypted key to the
 * backend so QUO works after a restart WITHOUT the user re-pasting the key (D-24).
 * The backend keeps the key only in memory, so it must be re-sent each launch.
 */
export async function restoreProviderFromBridge(): Promise<boolean> {
  const bridge = getQuasarBridge();
  if (!bridge) return false;
  try {
    const cfg = await bridge.provider.get();
    if (!cfg || !cfg.provider) return false;
    const apiKey = await bridge.keys.get(cfg.provider);
    await setProvider({
      provider: cfg.provider as ProviderId,
      model_id: cfg.model_id,
      api_base: cfg.api_base ?? undefined,
      api_key: apiKey ?? undefined,
    });
    return true;
  } catch {
    return false;
  }
}

export interface AgentEvent {
  type: "text_chunk" | "tool_start" | "tool_end" | "done" | "error";
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  output?: string;
}

export interface ToolCallDisplay {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  output: string;
  status: "running" | "done" | "error";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallDisplay[];
  timestamp: number;
}

export interface AgentWebSocket {
  send: (message: string, history: ChatMessage[]) => void;
  close: () => void;
}

export function createAgentWebSocket(onEvent: (event: AgentEvent) => void): AgentWebSocket {
  let ws: WebSocket | null = null;
  let closed = false;

  function connect() {
    if (closed) return;
    ws = new WebSocket(`${WS_BASE}/api/agent/ws`);

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as AgentEvent;
        onEvent(event);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      if (!closed) {
        // Single reconnect attempt after 1s
        setTimeout(connect, 1000);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, handles reconnect
    };
  }

  connect();

  return {
    send(message: string, history: ChatMessage[]) {
      const serializedHistory = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const payload = JSON.stringify({
        type: "message",
        content: message,
        history: serializedHistory,
      });

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      } else {
        // Queue send after connection opens
        const interval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
            clearInterval(interval);
          }
        }, 100);
        // Give up after 5s
        setTimeout(() => clearInterval(interval), 5000);
      }
    },
    close() {
      closed = true;
      ws?.close();
    },
  };
}

export async function sendAgentMessage(
  message: string,
  history: ChatMessage[]
): Promise<{ response: string; tool_calls: ToolCallDisplay[] }> {
  const serializedHistory = history.map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch(`${API_BASE}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: serializedHistory }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Agent request failed" }));
    throw new Error(err.detail ?? "Agent request failed");
  }
  return res.json();
}
