"use client";

// Vista "Diseñadores" (D-33) con los 4 estados de 01-UI-SPEC §Screens 1:
//   loading → 3 skeleton cards
//   empty   → estado centrado (icono Package, headings/body/botones exactos del contrato)
//   error   → alert inline + Reintentar
//   populated → grid de DesignerCard
// Español, dark, marca por variables CSS. Honestidad de claims per RQ-G-3.

import { useCallback, useEffect, useState } from "react";
import { Package, PackageOpen } from "lucide-react";
import { listDesigners, type Designer } from "@/lib/designers";
import { Skeleton } from "@/components/ui/skeleton";
import { DesignerCard } from "./DesignerCard";
import { DesignerDetail } from "./DesignerDetail";
import { ImportDialog } from "./ImportDialog";

// API de Electron expuesta por preload (__quasar__). Opcional: solo en el shell.
interface QuasarBridge {
  onOpenQsd?: (cb: (path: string) => void) => void;
  readQsdFile?: (path: string) => Promise<string>;
}
declare global {
  interface Window {
    __quasar__?: QuasarBridge & Record<string, unknown>;
  }
}

/** Decodifica base64 (de Electron readQsdFile) a un File .qsd. */
function base64ToQsdFile(base64: string, name: string): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: "application/octet-stream" });
}

interface DesignersViewProps {
  onNavigate?: (view: string) => void;
}

type LoadState = "loading" | "error" | "ready";

export function DesignersView({ onNavigate }: DesignersViewProps) {
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  // Vista de detalle DENTRO de la vista (export estático, sin router — D-21).
  const [selected, setSelected] = useState<Designer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const list = await listDesigners();
      setDesigners(list);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Doble clic .qsd en Electron (D-35): el main process envía "open-qsd" con el
  // path; leemos el archivo vía IPC y abrimos el MISMO flujo de import.
  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.__quasar__ : undefined;
    if (!bridge?.onOpenQsd || !bridge.readQsdFile) return;
    bridge.onOpenQsd(async (path: string) => {
      try {
        const base64 = await bridge.readQsdFile!(path);
        const name = path.split(/[\\/]/).pop() || "designer.qsd";
        setImportFile(base64ToQsdFile(base64, name));
        setImportOpen(true);
      } catch {
        // silencioso: si falla la lectura, el usuario puede importar manualmente.
      }
    });
  }, []);

  const openImport = useCallback(() => {
    setImportFile(null);
    setImportOpen(true);
  }, []);

  // Detalle del Diseñador (tabs Versiones | Historial + RunForm) — plan 05.
  if (selected) {
    return <DesignerDetail designer={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="min-h-full" style={{ background: "var(--surface-1)" }}>
      <div className="max-w-6xl mx-auto px-8 pt-10 pb-8">
        {/* View header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1
              style={{
                fontFamily: "var(--quasar-font-display)",
                fontSize: "25px",
                fontWeight: 600,
                lineHeight: 1.15,
                color: "var(--ink-primary)",
              }}
            >
              Diseñadores
            </h1>
            <p
              className="mt-2 max-w-xl"
              style={{
                fontFamily: "var(--quasar-font-sans)",
                fontSize: "14px",
                color: "var(--ink-muted)",
                lineHeight: 1.5,
              }}
            >
              Artefactos reutilizables que empaquetan tus datos, tu física y tu
              pipeline. Publica desde la vista Pipeline para verlos aquí.
            </p>
          </div>
          <button
            onClick={openImport}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
            style={{
              background: "transparent",
              color: "var(--ink-muted)",
              border: "1px solid var(--surface-3)",
            }}
          >
            <PackageOpen size={16} />
            Importar Diseñador
          </button>
        </div>

        {/* ── Loading: 3 skeleton cards ── */}
        {state === "loading" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 flex flex-col gap-4"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-9 w-full mt-2" />
              </div>
            ))}
          </div>
        )}

        {/* ── Error: alert inline + Reintentar ── */}
        {state === "error" && (
          <div
            className="rounded-xl p-5 flex flex-col gap-3"
            style={{
              background: "var(--surface-2)",
              border: "1px solid rgba(239,68,68,0.35)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--quasar-font-sans)",
                fontSize: "14px",
                color: "var(--ink-primary)",
              }}
            >
              No se pudo cargar el registry. Verifica que el backend esté activo y
              reintenta.
            </p>
            <div>
              <button
                onClick={load}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
                style={{
                  background: "var(--electric)",
                  color: "#0A0E14",
                  boxShadow: "var(--glow-electric)",
                }}
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* ── Empty: estado centrado ── */}
        {state === "ready" && designers.length === 0 && (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ paddingTop: "48px", paddingBottom: "48px" }}
          >
            <Package size={48} style={{ color: "var(--ink-dim)" }} />
            <h2
              className="mt-6"
              style={{
                fontFamily: "var(--quasar-font-sans)",
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--ink-primary)",
              }}
            >
              Aún no tienes Diseñadores
            </h2>
            <p
              className="mt-2 max-w-md"
              style={{
                fontFamily: "var(--quasar-font-sans)",
                fontSize: "14px",
                color: "var(--ink-muted)",
                lineHeight: 1.5,
              }}
            >
              Construye un pipeline en la vista Pipeline y publícalo con
              &apos;Guardar como Diseñador&apos;, o importa un archivo .qsd.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => onNavigate?.("pipeline")}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
                style={{
                  background: "var(--electric)",
                  color: "#0A0E14",
                  boxShadow: "var(--glow-electric)",
                }}
              >
                Ir a Pipeline
              </button>
              <button
                onClick={openImport}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
                style={{
                  background: "transparent",
                  color: "var(--ink-muted)",
                  border: "1px solid var(--surface-3)",
                }}
              >
                Importar .qsd
              </button>
            </div>
          </div>
        )}

        {/* ── Populated: grid de DesignerCard ── */}
        {state === "ready" && designers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {designers.map((d) => (
              <DesignerCard
                key={d.id}
                designer={d}
                onRun={setSelected}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        initialFile={importFile}
        onImported={load}
      />
    </div>
  );
}
