"use client";

// RunHistoryTable (D-43) — historial de corridas POR Diseñador.
//
// Filas: timestamp, versión (mono), estado (dot --success/--error + label),
// semilla (mono), duración, DeterminismBadge compacto, "Ver reporte" (link al
// endpoint de reportes usando results.report_file). Datos vía listRuns sobre las
// versiones del Diseñador; los campos de reproducibilidad viven dentro de `results`
// del ExecutionRun. Orden descendente por fecha. Se refresca tras cada corrida
// exitosa (refreshNonce desde DesignerDetail). Empty state breve.

import { useCallback, useEffect, useState } from "react";
import {
  listRuns,
  reportUrl,
  type ExecutionRun,
} from "@/lib/designers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeterminismBadge } from "./DeterminismBadge";

interface RunHistoryTableProps {
  versionIds: number[];
  refreshNonce?: number;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDuration(s: number | undefined): string {
  if (s == null) return "—";
  if (s < 1) return `${Math.round(s * 1000)} ms`;
  return `${s.toFixed(2)} s`;
}

export function RunHistoryTable({ versionIds, refreshNonce = 0 }: RunHistoryTableProps) {
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listRuns(versionIds);
    setRuns(list);
    setLoading(false);
  }, [versionIds]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

  if (loading) {
    return (
      <p style={{ color: "var(--ink-muted)", fontSize: "14px" }}>Cargando historial…</p>
    );
  }

  if (runs.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{
          background: "var(--surface-2)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <p style={{ color: "var(--ink-muted)", fontSize: "14px" }}>
          Sin corridas aún — ejecuta una versión para empezar el historial.
        </p>
      </div>
    );
  }

  return (
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
            <TableHead>Fecha</TableHead>
            <TableHead>Versión</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Semilla</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Determinismo</TableHead>
            <TableHead className="text-right">Reporte</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const r = run.results ?? {};
            const isError = run.status === "error";
            return (
              <TableRow key={run.id}>
                <TableCell
                  style={{
                    fontFamily: "var(--quasar-font-mono)",
                    fontSize: "12px",
                    color: "var(--ink-muted)",
                  }}
                >
                  {formatTimestamp(run.finished_at ?? run.started_at)}
                </TableCell>
                <TableCell
                  style={{
                    fontFamily: "var(--quasar-font-mono)",
                    fontSize: "12px",
                    color: "var(--ink-primary)",
                  }}
                >
                  {r.version ?? "—"}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "9999px",
                        background: isError ? "var(--error)" : "var(--success)",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
                      {isError ? "error" : "éxito"}
                    </span>
                  </span>
                </TableCell>
                <TableCell
                  style={{
                    fontFamily: "var(--quasar-font-mono)",
                    fontSize: "12px",
                    color: "var(--ink-muted)",
                  }}
                >
                  {r.seed ?? "—"}
                </TableCell>
                <TableCell
                  style={{
                    fontFamily: "var(--quasar-font-mono)",
                    fontSize: "12px",
                    color: "var(--ink-muted)",
                  }}
                >
                  {formatDuration(r.duration_s)}
                </TableCell>
                <TableCell>
                  {isError || !r.determinism ? (
                    <span style={{ color: "var(--ink-dim)", fontSize: "12px" }}>—</span>
                  ) : (
                    <DeterminismBadge determinism={r.determinism} seed={r.seed} compact />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {r.report_file ? (
                    <a
                      href={reportUrl(r.report_file)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px]"
                      style={{ color: "var(--electric)" }}
                    >
                      Ver reporte
                    </a>
                  ) : (
                    <span style={{ color: "var(--ink-dim)", fontSize: "12px" }}>—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
