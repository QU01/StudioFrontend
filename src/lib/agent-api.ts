const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

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
