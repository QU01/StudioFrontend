"use client";

import { useEffect, useState } from "react";
import { X, KeyRound, ShieldCheck, ShieldAlert, Loader2, Check } from "lucide-react";
import {
  setProvider,
  getQuasarBridge,
  type ProviderId,
} from "@/lib/agent-api";

// Model catalogs (RESEARCH, current 2026). NO gemini-2.0-* (discontinued 2026-06-01).
const GEMINI_MODELS = [
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (rápido)" },
  { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro (potente)" },
];

const OLLAMA_DEFAULT_BASE = "http://localhost:11434/v1";

type SaveState = "idle" | "saving" | "saved" | "error";

interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const bridge = getQuasarBridge();
  const hasBridge = Boolean(bridge);

  const [provider, setProviderId] = useState<ProviderId>("gemini");
  const [modelId, setModelId] = useState<string>(GEMINI_MODELS[0].id);
  const [apiBase, setApiBase] = useState<string>(OLLAMA_DEFAULT_BASE);
  const [apiKey, setApiKey] = useState<string>("");
  const [encryptionAvailable, setEncryptionAvailable] = useState<boolean | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Load saved provider selection + encryption availability from the Electron bridge.
  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    (async () => {
      try {
        const avail = await bridge.keys.available();
        if (!cancelled) setEncryptionAvailable(avail);
      } catch {
        if (!cancelled) setEncryptionAvailable(false);
      }
      try {
        const cfg = await bridge.provider.get();
        if (cfg && !cancelled) {
          setProviderId((cfg.provider as ProviderId) ?? "gemini");
          if (cfg.model_id) setModelId(cfg.model_id);
          if (cfg.api_base) setApiBase(cfg.api_base);
        }
      } catch {
        /* no saved config yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  // Keep model selection consistent with the chosen provider.
  useEffect(() => {
    if (provider === "gemini" && !GEMINI_MODELS.some((m) => m.id === modelId)) {
      setModelId(GEMINI_MODELS[0].id);
    }
  }, [provider, modelId]);

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg("");
    try {
      const effectiveApiBase =
        provider === "ollama" || provider === "openai_compatible" ? apiBase : undefined;

      if (hasBridge && bridge) {
        // (1) Encrypt + persist the key (D-25). Skip if the user left it blank
        //     (e.g. re-saving provider/model without changing the key).
        if (apiKey) {
          const res = await bridge.keys.set(provider, apiKey);
          if (!res.ok) {
            if (res.reason === "no-encryption") {
              setEncryptionAvailable(false);
              throw new Error(
                "El cifrado del sistema no está disponible — la clave no se guardó en disco."
              );
            }
            throw new Error("No se pudo guardar la clave cifrada.");
          }
        }
        // (2) Persist the non-secret provider selection.
        await bridge.provider.set({ provider, model_id: modelId, api_base: effectiveApiBase });
        // (3) Apply to the backend: decrypt the key (or use the just-entered one) and POST.
        const keyToSend = apiKey || (await bridge.keys.get(provider)) || undefined;
        await setProvider({
          provider,
          model_id: modelId,
          api_base: effectiveApiBase,
          api_key: keyToSend,
        });
      } else {
        // Web / dev: no Electron bridge. Send whatever the user typed (memory only);
        // persistence + encryption require the desktop shell (D-24 env override for devs).
        await setProvider({
          provider,
          model_id: modelId,
          api_base: effectiveApiBase,
          api_key: apiKey || undefined,
        });
      }
      setApiKey("");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar la configuración.");
    }
  }

  const showEncWarning = hasBridge && encryptionAvailable === false;
  const showDevNotice = !hasBridge;

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--surface-1)", color: "var(--ink-primary, #F5F7FA)" }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ backgroundColor: "var(--surface-2)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "color-mix(in oklch, var(--electric) 12%, var(--surface-2))",
              border: "1px solid color-mix(in oklch, var(--electric) 25%, transparent)",
            }}
          >
            <KeyRound size={14} style={{ color: "var(--electric)" }} />
          </div>
          <div className="text-[13px] font-bold text-white leading-none">Proveedor de IA</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar ajustes"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
        {/* Encryption status */}
        {hasBridge && encryptionAvailable === true && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]"
            style={{
              backgroundColor: "color-mix(in oklch, var(--quasar-success, #22C55E) 10%, transparent)",
              color: "var(--quasar-success, #22C55E)",
            }}
          >
            <ShieldCheck size={13} />
            Tu clave se cifra con el sistema (DPAPI) antes de guardarse.
          </div>
        )}
        {showEncWarning && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
            style={{
              backgroundColor: "color-mix(in oklch, var(--quasar-warning, #F59E0B) 12%, transparent)",
              color: "var(--quasar-warning, #F59E0B)",
            }}
          >
            <ShieldAlert size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              El cifrado del sistema no está disponible en esta máquina. Por seguridad, la
              clave <strong>no se guardará en disco</strong>. Puedes usarla solo en esta
              sesión o configurar <code>GOOGLE_API_KEY</code> por variable de entorno.
            </span>
          </div>
        )}
        {showDevNotice && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
            style={{
              backgroundColor: "color-mix(in oklch, var(--electric) 10%, transparent)",
              color: "var(--electric)",
            }}
          >
            <ShieldAlert size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              Modo web/dev: sin el escritorio de Quasar la clave no se cifra ni persiste.
              Se aplicará solo en memoria; para desarrollo usa <code>GOOGLE_API_KEY</code>.
            </span>
          </div>
        )}

        {/* Provider selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-white/40">Proveedor</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "gemini", label: "Gemini" },
                { id: "ollama", label: "Ollama" },
                { id: "openai_compatible", label: "OpenAI-compat" },
              ] as { id: ProviderId; label: string }[]
            ).map((p) => {
              const active = provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProviderId(p.id)}
                  className="rounded-lg px-2 py-2 text-[11px] font-medium transition-all"
                  style={{
                    backgroundColor: active
                      ? "color-mix(in oklch, var(--electric) 18%, var(--surface-3))"
                      : "var(--surface-3)",
                    border: active
                      ? "1px solid color-mix(in oklch, var(--electric) 50%, transparent)"
                      : "1px solid rgba(255,255,255,0.06)",
                    color: active ? "var(--electric)" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Model selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-white/40">Modelo</label>
          {provider === "gemini" ? (
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: "var(--surface-3)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id} style={{ backgroundColor: "#1A2332" }}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder={provider === "ollama" ? "llama3.1" : "gpt-4o-mini"}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: "var(--surface-3)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
            />
          )}
        </div>

        {/* API base (ollama / openai-compat) */}
        {(provider === "ollama" || provider === "openai_compatible") && (
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-widest text-white/40">API base</label>
            <input
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder={OLLAMA_DEFAULT_BASE}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
              style={{
                backgroundColor: "var(--surface-3)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
            />
          </div>
        )}

        {/* API key */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-white/40">
            API key {provider === "ollama" && <span className="text-white/25">(opcional)</span>}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Pega tu clave (no se muestra tras guardar)"
            autoComplete="off"
            className="w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
            style={{
              backgroundColor: "var(--surface-3)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
            }}
          />
          <p className="text-[10px] text-white/30 leading-relaxed">
            La clave viaja solo en memoria al backend local (127.0.0.1). El backend nunca la
            guarda en disco ni la registra en logs.
          </p>
        </div>

        {saveState === "error" && (
          <div className="text-[11px]" style={{ color: "var(--quasar-error, #EF4444)" }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* Footer / save */}
      <div
        className="flex-shrink-0 border-t px-4 py-3"
        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "var(--surface-2)" }}
      >
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, var(--electric), var(--electric-dim))",
            color: "#fff",
            boxShadow: "0 0 12px color-mix(in oklch, var(--electric) 25%, transparent)",
          }}
        >
          {saveState === "saving" ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Guardando…
            </>
          ) : saveState === "saved" ? (
            <>
              <Check size={14} /> Guardado
            </>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </div>
  );
}

export default SettingsPanel;
