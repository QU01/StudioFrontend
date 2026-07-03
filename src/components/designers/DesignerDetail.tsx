"use client";

// DesignerDetail (01-UI-SPEC §2) — detalle de un Diseñador con tabs
// "Versiones" | "Historial de runs". Header: nombre (Orbitron 25px), badge
// "Candidato preliminar" (RQ-G-3: honestidad de claims), descripción.
//
// Tab Versiones: tabla de versiones INMUTABLES (sin editar/borrar por versión) —
// versión (mono), hash truncado a 12 chars con tooltip del hash completo,
// fecha, acciones "Ejecutar" (abre RunForm) y "Exportar" (disabled hasta plan 06).
// Tab Historial: monta RunHistoryTable.
//
// Colores SOLO vía variables CSS de marca. Español. Solo JSX escapado (T-01-19).

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Designer, DesignerVersion } from "@/lib/designers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunForm } from "./RunForm";
import { RunHistoryTable } from "./RunHistoryTable";

interface DesignerDetailProps {
  designer: Designer;
  onBack: () => void;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function sortedVersions(d: Designer): DesignerVersion[] {
  return [...(d.versions ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function DesignerDetail({ designer, onBack }: DesignerDetailProps) {
  const versions = useMemo(() => sortedVersions(designer), [designer]);
  const versionIds = useMemo(() => versions.map((v) => v.id), [versions]);
  const [runFor, setRunFor] = useState<DesignerVersion | null>(null);
  // Bump para refrescar el historial tras una corrida exitosa (callback del RunForm).
  const [historyNonce, setHistoryNonce] = useState(0);

  return (
    <div className="min-h-full" style={{ background: "var(--surface-1)" }}>
      <div className="max-w-6xl mx-auto px-8 pt-10 pb-8">
        {/* Volver */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 mb-6 text-[13px] transition-colors"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--quasar-font-sans)" }}
        >
          <ArrowLeft size={14} />
          Diseñadores
        </button>

        {/* Header */}
        <div className="mb-8 flex items-start gap-3 flex-wrap">
          <div className="min-w-0">
            <h1
              className="truncate"
              style={{
                fontFamily: "var(--quasar-font-display)",
                fontSize: "25px",
                fontWeight: 600,
                lineHeight: 1.15,
                color: "var(--ink-primary)",
              }}
              title={designer.name}
            >
              {designer.name}
            </h1>
            {designer.description ? (
              <p
                className="mt-2 max-w-xl"
                style={{
                  fontFamily: "var(--quasar-font-sans)",
                  fontSize: "14px",
                  color: "var(--ink-muted)",
                  lineHeight: 1.5,
                }}
              >
                {designer.description}
              </p>
            ) : null}
          </div>
          {/* Badge "Candidato preliminar" (RQ-G-3 — nunca "validado"). */}
          <span
            className="mt-1 inline-flex items-center rounded-full px-3 py-1"
            style={{
              fontFamily: "var(--quasar-font-mono)",
              fontSize: "12px",
              color: "var(--warning)",
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.35)",
            }}
          >
            Candidato preliminar
          </span>
        </div>

        <Tabs defaultValue="versiones" className="gap-6">
          <TabsList>
            <TabsTrigger value="versiones">Versiones</TabsTrigger>
            <TabsTrigger value="historial">Historial de runs</TabsTrigger>
          </TabsList>

          {/* ── Tab Versiones ── */}
          <TabsContent value="versiones">
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versión</TableHead>
                    <TableHead>Hash</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} style={{ color: "var(--ink-muted)" }}>
                        Sin versiones en el índice.
                      </TableCell>
                    </TableRow>
                  ) : (
                    versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell
                          style={{
                            fontFamily: "var(--quasar-font-mono)",
                            fontSize: "12px",
                            color: "var(--ink-primary)",
                          }}
                        >
                          {v.version}
                        </TableCell>
                        <TableCell
                          style={{
                            fontFamily: "var(--quasar-font-mono)",
                            fontSize: "12px",
                            color: "var(--ink-muted)",
                            whiteSpace: "nowrap",
                          }}
                          title={v.sha256}
                        >
                          {v.sha256 ? v.sha256.slice(0, 12) : "—"}
                        </TableCell>
                        <TableCell
                          style={{
                            fontFamily: "var(--quasar-font-mono)",
                            fontSize: "12px",
                            color: "var(--ink-dim)",
                          }}
                        >
                          {formatDate(v.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => setRunFor(v)}
                              className="px-3 py-1.5 rounded-md text-[13px] font-semibold transition-all"
                              style={{
                                background: "var(--electric)",
                                color: "#0A0E14",
                                boxShadow: "var(--glow-electric)",
                              }}
                            >
                              Ejecutar
                            </button>
                            <button
                              disabled
                              title="Disponible en un milestone próximo — exportar .qsd"
                              className="px-3 py-1.5 rounded-md text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{
                                background: "transparent",
                                color: "var(--ink-muted)",
                                border: "1px solid var(--surface-3)",
                              }}
                            >
                              Exportar
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Tab Historial de runs ── */}
          <TabsContent value="historial">
            <RunHistoryTable versionIds={versionIds} refreshNonce={historyNonce} />
          </TabsContent>
        </Tabs>
      </div>

      {/* RunForm (modal de ejecución spec-driven). */}
      {runFor ? (
        <RunForm
          designerName={designer.name}
          version={runFor}
          onClose={() => setRunFor(null)}
          onRunComplete={() => setHistoryNonce((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
