// Cliente del registry de Diseñadores (D-33/D-39/D-40).
//
// Eleva el patrón de `persistence.ts` (RQ-1.1-1 "Sobre: persistence.ts"):
//   - token-gate con getAccessToken (tolerante: sin token → [] / null)
//   - todas las llamadas vía fetchWithAuth (Bearer + refresh 401) — T-01-12
//   - try/catch tolerante para reads del índice
//
// Dos backends (NUNCA redefinir el schema en el cliente, D-39/T-01-13):
//   - Django (DJANGO_API_BASE): índice CRUD de Designer/DesignerVersion.
//   - FastAPI (API_BASE): GET /api/designers/schema + POST /api/designers/publish.

import { fetchWithAuth, getAccessToken, DJANGO_API_BASE } from "./auth";
import { API_BASE } from "./api";

// ── Tipos del índice (espejo de la serialización Django del plan 02) ──────────

export interface DesignerVersion {
  id: number;
  designer: number;
  version: string;
  sha256: string;
  spec_schema_version: string;
  bundle_path: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Designer {
  id: number;
  name: string;
  description: string;
  created_at: string;
  versions: DesignerVersion[];
}

// ── Contrato del schema del backend (D-39: la única verdad del esquema) ───────

export interface DesignerSchema {
  schema: Record<string, unknown>;
  spec_schema_version: string;
}

// ── Spec de una entrada del Diseñador (del plan 01; genera el RunForm, D-39) ──
// spec.entradas: [{nombre, tipo: "csv"|"float"|"int"|"str", unidad?, requerido, min?, max?}]

export interface SpecEntrada {
  nombre: string;
  tipo: "csv" | "float" | "int" | "str";
  unidad?: string;
  requerido?: boolean;
  min?: number;
  max?: number;
  [k: string]: unknown;
}

export interface DesignerSpec {
  entradas?: SpecEntrada[];
  [k: string]: unknown;
}

/** Detalle de una versión del registry (FastAPI GET /{name}/{version}). */
export interface DesignerVersionDetail {
  manifest: Record<string, unknown>;
  spec: DesignerSpec;
  sha256: string;
}

// ── Resultado de una corrida headless (POST /{name}/{version}/run) ────────────

export interface RunInputMeta {
  nombre: string;
  tipo: string;
  sha256: string;
}

export interface RunResult {
  results: Record<string, unknown>;
  fingerprint: string;
  seed: number;
  duration_s: number;
  determinism: string; // "cpu-bit-exacta" | "gpu-no-bit-exacta"
  report_file: string;
  inputs: RunInputMeta[];
  designer: { name: string; version: string; sha256: string };
}

export type RunOutcome =
  | { ok: true; data: RunResult }
  | { validationErrors: ValidationError[] }
  | { error: string };

// ── Fila del historial (espejo del ExecutionRunSerializer del plan 02) ────────
// ExecutionRun: {id, user, pipeline, project, designer_version, status, results, started_at, finished_at}
// Los campos de reproducibilidad viven DENTRO de `results` (D-43).

export interface ExecutionRun {
  id: number;
  designer_version: number | null;
  status: "pending" | "running" | "success" | "error";
  results: {
    fingerprint?: string;
    seed?: number;
    duration_s?: number;
    determinism?: string;
    report_file?: string;
    version?: string;
    error?: string;
    metrics?: Record<string, unknown>;
    [k: string]: unknown;
  };
  started_at: string | null;
  finished_at: string | null;
}

// ── Resultado discriminado de publishDesigner (422 / 409 / ok) ────────────────

export interface ValidationError {
  campo: string;
  regla: string;
  mensaje: string;
}

export interface PublishManifest {
  path?: string;
  custom_nodes?: unknown;
  data_ref?: unknown;
  [k: string]: unknown;
}

export interface PublishSuccess {
  status: "published" | "duplicate";
  name: string;
  version: string;
  sha256: string;
  manifest: PublishManifest;
}

export type PublishResult =
  | { ok: true; data: PublishSuccess }
  | { validationErrors: ValidationError[] }
  | { conflict: string };

export interface PublishInput {
  name: string;
  version: string;
  description?: string;
  spec: Record<string, unknown>;
}

// ── Índice (Django) ───────────────────────────────────────────────────────────

/** Lista los Diseñadores del índice. Tolerante: sin token/errores → []. */
export async function listDesigners(): Promise<Designer[]> {
  if (!getAccessToken()) return [];
  try {
    const res = await fetchWithAuth(`${DJANGO_API_BASE}/designers/`);
    if (!res.ok) return [];
    const list = await res.json();
    return Array.isArray(list) ? (list as Designer[]) : [];
  } catch {
    return [];
  }
}

// ── Schema (FastAPI — D-39) ────────────────────────────────────────────────────

/** Obtiene el JSON Schema del spec desde el backend (D-39). Jamás redefinirlo aquí. */
export async function getDesignerSchema(): Promise<DesignerSchema | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await fetchWithAuth(`${API_BASE}/api/designers/schema`);
    if (!res.ok) return null;
    return (await res.json()) as DesignerSchema;
  } catch {
    return null;
  }
}

// ── Publicación (FastAPI — D-32/D-40) ──────────────────────────────────────────

/**
 * Publica la sesión viva como `name@version`. Unión discriminada:
 *   - 200 → { ok, data }
 *   - 422 → { validationErrors } (gate visible, D-40)
 *   - 409 → { conflict } (inmutabilidad, D-37)
 */
export async function publishDesigner(input: PublishInput): Promise<PublishResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/designers/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      version: input.version,
      description: input.description ?? "",
      spec: input.spec,
    }),
  });

  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    const errors = (body?.detail?.errors ?? []) as ValidationError[];
    return { validationErrors: Array.isArray(errors) ? errors : [] };
  }

  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    const detail = typeof body?.detail === "string" ? body.detail : "Conflicto de inmutabilidad.";
    return { conflict: detail };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = typeof body?.detail === "string" ? body.detail : "No se pudo publicar el Diseñador.";
    throw new Error(detail);
  }

  const data = (await res.json()) as PublishSuccess;
  return { ok: true, data };
}

// ── Espejo del índice tras publish (D-30 — el disco ya es la verdad) ──────────

/**
 * Tras una publicación exitosa, refleja la versión en el índice Django:
 *   1. find-or-create Designer por `name` (GET lista + POST si falta).
 *   2. POST /designer-versions/ con la fila de versión.
 *
 * Best-effort y tolerante: el registry de disco ya contiene la verdad, así que
 * un fallo del índice no invalida la publicación (no lanza).
 */
export async function mirrorIndexAfterPublish(result: PublishSuccess): Promise<void> {
  if (result.status !== "published") return; // duplicate → nada que reflejar
  if (!getAccessToken()) return;

  try {
    // 1. find-or-create Designer por name.
    const existing = await listDesigners();
    let designer = existing.find((d) => d.name === result.name);

    if (!designer) {
      const createRes = await fetchWithAuth(`${DJANGO_API_BASE}/designers/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.name, description: "" }),
      });
      if (!createRes.ok) return;
      designer = (await createRes.json()) as Designer;
    }

    if (!designer?.id) return;

    // 2. POST fila de versión (espejo del índice).
    const manifest = result.manifest ?? {};
    await fetchWithAuth(`${DJANGO_API_BASE}/designer-versions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designer: designer.id,
        version: result.version,
        sha256: result.sha256,
        spec_schema_version:
          (manifest.spec_schema_version as string | undefined) ?? "1.0",
        bundle_path: (manifest.path as string | undefined) ?? "",
        metadata: {
          custom_nodes: manifest.custom_nodes,
          data_ref: manifest.data_ref,
        },
      }),
    });
  } catch {
    // best-effort: el disco es la verdad (D-30).
  }
}

// ── Ejecución headless (FastAPI — D-42/D-44) ──────────────────────────────────

/**
 * Obtiene manifest + spec + sha256 de una versión (FastAPI GET /{name}/{version}).
 * El RunForm se genera de `spec.entradas` (D-39: el esquema es del backend).
 */
export async function getDesignerVersion(
  name: string,
  version: string,
): Promise<DesignerVersionDetail | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await fetchWithAuth(
      `${API_BASE}/api/designers/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as DesignerVersionDetail;
  } catch {
    return null;
  }
}

/**
 * Ejecuta un Diseñador guardado con nuevas entradas (RQ-1.4-1, D-42, headless).
 *
 * Multipart: campo "payload" JSON `{inputs, seed}` + un File por cada entrada CSV
 * (mapeado por nombre de entrada). NO fijamos Content-Type: `fetchWithAuth` ya
 * detecta FramData y deja que el browser ponga el boundary (verificado en auth.ts).
 *
 * Unión discriminada: éxito → {ok,data}; 422 spec/entradas → {validationErrors};
 * otro fallo → {error} (mensaje accionable para el panel de error del run).
 */
export async function runDesigner(
  name: string,
  version: string,
  inputs: Record<string, unknown>,
  seed: number,
  files: Record<string, File>,
): Promise<RunOutcome> {
  const form = new FormData();
  form.append("payload", JSON.stringify({ inputs, seed }));
  for (const [nombre, file] of Object.entries(files)) {
    if (file) form.append(nombre, file, file.name);
  }

  let res: Response;
  try {
    res = await fetchWithAuth(
      `${API_BASE}/api/designers/${encodeURIComponent(name)}/${encodeURIComponent(version)}/run`,
      { method: "POST", body: form },
    );
  } catch {
    return { error: "No se pudo contactar el backend. Verifica que esté activo." };
  }

  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    const errors = (body?.detail?.errors ?? []) as ValidationError[];
    if (Array.isArray(errors) && errors.length > 0) {
      return { validationErrors: errors };
    }
    const detail = typeof body?.detail === "string" ? body.detail : "Entradas inválidas.";
    return { error: detail };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail =
      typeof body?.detail === "string" ? body.detail : "La corrida falló en el backend.";
    return { error: detail };
  }

  const data = (await res.json()) as RunResult;
  return { ok: true, data };
}

/** URL absoluta del reporte de una corrida (GET /api/designers/reports/{filename}). */
export function reportUrl(reportFile: string): string {
  return `${API_BASE}/api/designers/reports/${encodeURIComponent(reportFile)}`;
}

// ── Historial de runs (Django ExecutionRun — D-43) ────────────────────────────

/**
 * Persiste una fila de historial en el índice Django (D-43). Best-effort: si el
 * POST falla, el reporte + fingerprint del backend siguen siendo la verdad en
 * disco (T-01-21), así que no lanza.
 */
export async function recordRun(
  designerVersionId: number,
  runResult: RunResult,
): Promise<void> {
  if (!getAccessToken()) return;
  const now = new Date().toISOString();
  const startedAt = new Date(Date.now() - runResult.duration_s * 1000).toISOString();
  try {
    await fetchWithAuth(`${DJANGO_API_BASE}/runs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designer_version: designerVersionId,
        status: "success",
        results: {
          fingerprint: runResult.fingerprint,
          seed: runResult.seed,
          duration_s: runResult.duration_s,
          determinism: runResult.determinism,
          report_file: runResult.report_file,
          version: runResult.designer.version,
          metrics: runResult.results,
        },
        started_at: startedAt,
        finished_at: now,
      }),
    });
  } catch {
    // best-effort (T-01-21): la verdad vive en el reporte + fingerprint del backend.
  }
}

/**
 * Persiste una corrida FALLIDA en el historial (D-43). Best-effort, no lanza.
 */
export async function recordFailedRun(
  designerVersionId: number,
  version: string,
  reason: string,
): Promise<void> {
  if (!getAccessToken()) return;
  const now = new Date().toISOString();
  try {
    await fetchWithAuth(`${DJANGO_API_BASE}/runs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designer_version: designerVersionId,
        status: "error",
        results: { version, error: reason },
        started_at: now,
        finished_at: now,
      }),
    });
  } catch {
    // best-effort.
  }
}

/**
 * Lista el historial de corridas de un Diseñador filtrando por sus versiones.
 *
 * `ExecutionRunViewSet` no expone filtro por query param, así que traemos las
 * runs del usuario (ya aisladas por UserDataMixin, T-01-20) y filtramos
 * client-side por `designer_version ∈ designerVersionIds`. Orden descendente
 * por `finished_at`/`started_at`.
 */
export async function listRuns(designerVersionIds: number[]): Promise<ExecutionRun[]> {
  if (!getAccessToken()) return [];
  if (designerVersionIds.length === 0) return [];
  const idSet = new Set(designerVersionIds);
  try {
    const res = await fetchWithAuth(`${DJANGO_API_BASE}/runs/`);
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    return (list as ExecutionRun[])
      .filter((r) => r.designer_version != null && idSet.has(r.designer_version))
      .sort((a, b) => {
        const ta = new Date(a.finished_at ?? a.started_at ?? 0).getTime();
        const tb = new Date(b.finished_at ?? b.started_at ?? 0).getTime();
        return tb - ta;
      });
  } catch {
    return [];
  }
}
