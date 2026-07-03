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
