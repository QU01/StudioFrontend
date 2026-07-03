"use client";

// RunForm (D-39/D-42/D-44, UX-1) — formulario de ejecución GENERADO desde la spec.
//
// El usuario elige versión, llena un formulario derivado de `spec.entradas` (tipos,
// unidades, bounds como helper) y ejecuta SIN abrir el editor (UX-1). El esquema es
// del backend (D-39: getDesignerVersion). La validación client-side es ESPEJO/azúcar
// de UX; la validación autoritativa es el 422 del backend, que también se pinta en
// el MISMO ValidationPanel del plan 03 (componente compartido, D-40).
//
// Éxito → panel de resultado con DeterminismBadge (D-44), métricas, fingerprint
// truncado, badge "Candidato preliminar" (RQ-G-3) y "Ver reporte"; luego recordRun
// para persistir el historial (D-43). Error → copy exacto + recordFailedRun.

import { useCallback, useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import {
  getDesignerVersion,
  runDesigner,
  recordRun,
  recordFailedRun,
  reportUrl,
  type DesignerVersion,
  type DesignerSpec,
  type SpecEntrada,
  type RunResult,
  type ValidationError,
} from "@/lib/designers";
import { ValidationPanel } from "./ValidationPanel";
import { DeterminismBadge } from "./DeterminismBadge";

interface RunFormProps {
  designerName: string;
  version: DesignerVersion;
  onClose: () => void;
  onRunComplete?: () => void;
}

const DEFAULT_SEED = 71;

type Phase = "loading" | "form" | "running" | "success" | "error";

function isScalar(tipo: string): boolean {
  return tipo === "float" || tipo === "int";
}

export function RunForm({ designerName, version, onClose, onRunComplete }: RunFormProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [spec, setSpec] = useState<DesignerSpec | null>(null);
  const [loadError, setLoadError] = useState<string>("");

  // Valores del formulario: escalares/strings en `values`, CSVs en `files`.
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [seed, setSeed] = useState<string>(String(DEFAULT_SEED));

  const [clientErrors, setClientErrors] = useState<ValidationError[]>([]);
  const [serverErrors, setServerErrors] = useState<ValidationError[]>([]);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string>("");

  // Cargar la spec desde el backend (D-39).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const detail = await getDesignerVersion(designerName, version.version);
      if (cancelled) return;
      if (!detail) {
        setLoadError(
          "No se pudo cargar la spec del Diseñador. Verifica que el backend esté activo.",
        );
        setPhase("error");
        return;
      }
      setSpec(detail.spec ?? {});
      setPhase("form");
    })();
    return () => {
      cancelled = true;
    };
  }, [designerName, version.version]);

  const entradas: SpecEntrada[] = spec?.entradas ?? [];

  // Validación client-side ESPEJO (requeridos + bounds) — azúcar de UX (D-40).
  const validateClient = useCallback((): ValidationError[] => {
    const errs: ValidationError[] = [];
    for (const e of entradas) {
      const nombre = e.nombre;
      const requerido = e.requerido !== false;
      if (e.tipo === "csv") {
        if (requerido && !files[nombre]) {
          errs.push({
            campo: `entradas.${nombre}`,
            regla: "requerido",
            mensaje: `Falta el archivo CSV requerido '${nombre}'.`,
          });
        }
        continue;
      }
      const raw = (values[nombre] ?? "").trim();
      if (!raw) {
        if (requerido) {
          errs.push({
            campo: `entradas.${nombre}`,
            regla: "requerido",
            mensaje: `Falta la entrada requerida '${nombre}'.`,
          });
        }
        continue;
      }
      if (isScalar(e.tipo)) {
        const num = Number(raw);
        if (Number.isNaN(num)) {
          errs.push({
            campo: `entradas.${nombre}`,
            regla: "tipo",
            mensaje: `'${nombre}' debe ser ${e.tipo}.`,
          });
          continue;
        }
        if (e.min != null && num < e.min) {
          errs.push({
            campo: `entradas.${nombre}`,
            regla: "min",
            mensaje: `'${nombre}' (${num}) es menor que el mínimo ${e.min}.`,
          });
        }
        if (e.max != null && num > e.max) {
          errs.push({
            campo: `entradas.${nombre}`,
            regla: "max",
            mensaje: `'${nombre}' (${num}) es mayor que el máximo ${e.max}.`,
          });
        }
      }
    }
    return errs;
  }, [entradas, values, files]);

  const formValid = phase === "form" && validateClient().length === 0;

  const handleRun = useCallback(async () => {
    const clientErrs = validateClient();
    setClientErrors(clientErrs);
    setServerErrors([]);
    if (clientErrs.length > 0) return;

    // Construir inputs escalares/string (los CSV van como File aparte).
    const inputs: Record<string, unknown> = {};
    for (const e of entradas) {
      if (e.tipo === "csv") continue;
      const raw = (values[e.nombre] ?? "").trim();
      if (!raw) continue;
      inputs[e.nombre] = isScalar(e.tipo) ? Number(raw) : raw;
    }

    const seedNum = Number((seed || "").trim() || DEFAULT_SEED);

    setPhase("running");
    const outcome = await runDesigner(
      designerName,
      version.version,
      inputs,
      Number.isNaN(seedNum) ? DEFAULT_SEED : seedNum,
      files,
    );

    if ("validationErrors" in outcome) {
      setServerErrors(outcome.validationErrors);
      setPhase("form");
      return;
    }
    if ("error" in outcome) {
      setRunError(outcome.error);
      setPhase("error");
      await recordFailedRun(version.id, version.version, outcome.error);
      onRunComplete?.();
      return;
    }

    setRunResult(outcome.data);
    setPhase("success");
    await recordRun(version.id, outcome.data);
    onRunComplete?.();
  }, [designerName, version, entradas, values, files, seed, validateClient, onRunComplete]);

  const errors = serverErrors.length > 0 ? serverErrors : clientErrors;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl"
        style={{
          background: "var(--surface-2)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 p-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="min-w-0">
            <h2
              style={{
                fontFamily: "var(--quasar-font-sans)",
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--ink-primary)",
              }}
            >
              {`Ejecutar ${designerName}@${version.version}`}
            </h2>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--quasar-font-sans)",
                fontSize: "14px",
                color: "var(--ink-muted)",
                lineHeight: 1.5,
              }}
            >
              Entradas definidas por la spec. No necesitas abrir el editor.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex-shrink-0 rounded-md p-1"
            style={{ color: "var(--ink-dim)" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {phase === "loading" && (
            <div
              className="flex items-center gap-2"
              style={{ color: "var(--ink-muted)", fontSize: "14px" }}
            >
              <Loader2 size={16} className="animate-spin" />
              Cargando spec…
            </div>
          )}

          {phase === "error" && !runResult && loadError && (
            <p style={{ color: "var(--error)", fontSize: "14px" }}>{loadError}</p>
          )}

          {/* ── Estado error de corrida (copy exacto del contrato) ── */}
          {phase === "error" && runError && (
            <div
              className="rounded-lg p-4"
              style={{
                background: "var(--surface-3)",
                border: "1px solid rgba(239,68,68,0.35)",
              }}
            >
              <p style={{ fontSize: "14px", color: "var(--ink-primary)", lineHeight: 1.5 }}>
                La corrida falló: {runError}. Revisa las entradas o consulta el log del run
                en el historial.
              </p>
            </div>
          )}

          {/* ── Formulario spec-driven ── */}
          {(phase === "form" || phase === "running") && (() => {
            const running = phase === "running";
            return (
            <>
              {errors.length > 0 && <ValidationPanel errors={errors} />}

              {entradas.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "14px" }}>
                  Esta spec no declara entradas. Puedes ejecutar directamente.
                </p>
              ) : (
                entradas.map((e) => (
                  <FieldRow
                    key={e.nombre}
                    entrada={e}
                    value={values[e.nombre] ?? ""}
                    fileName={files[e.nombre]?.name}
                    onValue={(v) => setValues((s) => ({ ...s, [e.nombre]: v }))}
                    onFile={(f) =>
                      setFiles((s) => {
                        const next = { ...s };
                        if (f) next[e.nombre] = f;
                        else delete next[e.nombre];
                        return next;
                      })
                    }
                  />
                ))
              )}

              {/* Semilla */}
              <div className="flex flex-col gap-1.5">
                <label
                  style={{
                    fontFamily: "var(--quasar-font-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--ink-primary)",
                  }}
                >
                  Semilla
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(ev) => setSeed(ev.target.value)}
                  className="rounded-lg px-3 py-2 outline-none"
                  style={{
                    background: "var(--surface-3)",
                    border: "1px solid var(--surface-3)",
                    color: "var(--ink-primary)",
                    fontFamily: "var(--quasar-font-mono)",
                    fontSize: "12px",
                  }}
                />
              </div>

              <button
                onClick={handleRun}
                disabled={!formValid || running}
                className="mt-2 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "var(--electric)",
                  color: "#0A0E14",
                  boxShadow: "var(--glow-electric)",
                }}
              >
                {running ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Ejecutando…
                  </>
                ) : (
                  "Ejecutar"
                )}
              </button>
            </>
            );
          })()}

          {/* ── Panel de resultado ── */}
          {phase === "success" && runResult && (
            <ResultPanel result={runResult} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Campo generado desde una entrada de la spec ──────────────────────────────

interface FieldRowProps {
  entrada: SpecEntrada;
  value: string;
  fileName?: string;
  onValue: (v: string) => void;
  onFile: (f: File | null) => void;
}

function FieldRow({ entrada, value, fileName, onValue, onFile }: FieldRowProps) {
  const requerido = entrada.requerido !== false;
  const helper =
    entrada.min != null || entrada.max != null
      ? `min ${entrada.min ?? "—"} · max ${entrada.max ?? "—"}`
      : "";

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="flex items-center gap-2"
        style={{
          fontFamily: "var(--quasar-font-sans)",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--ink-primary)",
        }}
      >
        {entrada.nombre}
        {requerido ? <span style={{ color: "var(--error)" }}>*</span> : null}
        {entrada.unidad ? (
          <span
            style={{
              fontFamily: "var(--quasar-font-mono)",
              fontSize: "12px",
              color: "var(--ink-muted)",
              fontWeight: 400,
            }}
          >
            {entrada.unidad}
          </span>
        ) : null}
      </label>

      {entrada.tipo === "csv" ? (
        <input
          type="file"
          accept=".csv"
          onChange={(ev) => onFile(ev.target.files?.[0] ?? null)}
          className="text-[13px]"
          style={{ color: "var(--ink-muted)" }}
        />
      ) : (
        <input
          type={isScalar(entrada.tipo) ? "number" : "text"}
          value={value}
          onChange={(ev) => onValue(ev.target.value)}
          className="rounded-lg px-3 py-2 outline-none"
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--surface-3)",
            color: "var(--ink-primary)",
            fontFamily: isScalar(entrada.tipo)
              ? "var(--quasar-font-mono)"
              : "var(--quasar-font-sans)",
            fontSize: isScalar(entrada.tipo) ? "12px" : "14px",
          }}
        />
      )}

      {helper ? (
        <span
          style={{
            fontFamily: "var(--quasar-font-mono)",
            fontSize: "12px",
            color: "var(--ink-muted)",
          }}
        >
          {helper}
        </span>
      ) : null}
      {fileName ? (
        <span
          style={{
            fontFamily: "var(--quasar-font-mono)",
            fontSize: "12px",
            color: "var(--ink-dim)",
          }}
        >
          {fileName}
        </span>
      ) : null}
    </div>
  );
}

// ── Panel de resultado exitoso ───────────────────────────────────────────────

function ResultPanel({ result }: { result: RunResult }) {
  const metrics = flattenMetrics(result.results);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <DeterminismBadge determinism={result.determinism} seed={result.seed} />
        <span
          className="inline-flex items-center rounded-full px-3 py-1"
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

      {/* Fingerprint truncado + tooltip del hash completo */}
      <div className="flex flex-col gap-1">
        <span style={{ fontSize: "12px", color: "var(--ink-dim)" }}>Fingerprint</span>
        <span
          title={result.fingerprint}
          style={{
            fontFamily: "var(--quasar-font-mono)",
            fontSize: "12px",
            color: "var(--ink-primary)",
            whiteSpace: "nowrap",
          }}
        >
          {result.fingerprint.slice(0, 12)}
        </span>
      </div>

      {/* Métricas clave */}
      {metrics.length > 0 && (
        <div
          className="rounded-lg overflow-hidden"
          style={{ background: "var(--surface-3)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {metrics.map(([k, v], i) => (
            <div
              key={k}
              className="flex items-center justify-between px-4 py-2"
              style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)" }}
            >
              <span style={{ fontSize: "13px", color: "var(--ink-muted)" }}>{k}</span>
              <span
                style={{
                  fontFamily: "var(--quasar-font-mono)",
                  fontSize: "12px",
                  color: "var(--ink-primary)",
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
      )}

      {result.report_file ? (
        <a
          href={reportUrl(result.report_file)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center py-2 rounded-lg text-[13px] font-medium transition-all"
          style={{
            background: "transparent",
            color: "var(--ink-primary)",
            border: "1px solid var(--surface-3)",
          }}
        >
          Ver reporte
        </a>
      ) : null}
    </div>
  );
}

// Extrae métricas escalares legibles de los results anidados del pipeline.
function flattenMetrics(results: Record<string, unknown>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const nodes = (results?.results ?? results) as Record<string, unknown>;
  if (!nodes || typeof nodes !== "object") return out;
  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== "object") continue;
    const m = (node as Record<string, unknown>).metrics;
    if (!m || typeof m !== "object") continue;
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      if (typeof v === "number") out.push([k, formatNum(v)]);
      else if (typeof v === "string") out.push([k, v]);
    }
  }
  return out.slice(0, 8);
}

function formatNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(4);
}
