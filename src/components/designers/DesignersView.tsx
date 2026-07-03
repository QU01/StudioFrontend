"use client";

// Vista "Diseñadores" (D-33) con los 4 estados de 01-UI-SPEC §Screens 1:
//   loading → 3 skeleton cards
//   empty   → estado centrado (icono Package, headings/body/botones exactos del contrato)
//   error   → alert inline + Reintentar
//   populated → grid de DesignerCard
// Español, dark, marca por variables CSS. Honestidad de claims per RQ-G-3.

import { useCallback, useEffect, useState } from "react";
import { Package } from "lucide-react";
import { listDesigners, type Designer } from "@/lib/designers";
import { Skeleton } from "@/components/ui/skeleton";
import { DesignerCard } from "./DesignerCard";
import { DesignerDetail } from "./DesignerDetail";

interface DesignersViewProps {
  onNavigate?: (view: string) => void;
}

type LoadState = "loading" | "error" | "ready";

export function DesignersView({ onNavigate }: DesignersViewProps) {
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  // Vista de detalle DENTRO de la vista (export estático, sin router — D-21).
  const [selected, setSelected] = useState<Designer | null>(null);

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

  // Detalle del Diseñador (tabs Versiones | Historial + RunForm) — plan 05.
  if (selected) {
    return <DesignerDetail designer={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="min-h-full" style={{ background: "var(--surface-1)" }}>
      <div className="max-w-6xl mx-auto px-8 pt-10 pb-8">
        {/* View header */}
        <div className="mb-8">
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
                disabled
                title="Disponible en este milestone — flujo de import"
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
              <DesignerCard key={d.id} designer={d} onRun={setSelected} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
