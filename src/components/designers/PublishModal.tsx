"use client";

// PublishModal (D-32/D-40). Extiende el patrón de SaveModal (overlay bg-black/60
// backdrop-blur, gradient top-bar, controlled useState). Camino PRIMARIO: formulario
// tipado (el fundador NO teclea JSON en la demo del gate 1→2). Fallback avanzado:
// tab JSON crudo con try/catch de parse.
//
// El schema del spec SIEMPRE viene del backend (getDesignerSchema, D-39/T-01-13):
// el formulario solo cubre el subconjunto mínimo (dominio/objetivos/punto_operacion/
// entradas) y el resto va con defaults del template — NUNCA se redefine el schema aquí.

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  publishDesigner,
  mirrorIndexAfterPublish,
  getDesignerSchema,
  type ValidationError,
} from "@/lib/designers";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ValidationPanel } from "./ValidationPanel";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: () => void;
}

// ── Modelos del formulario tipado (subconjunto mínimo del spec) ───────────────

interface ObjetivoRow {
  nombre: string;
  direccion: "min" | "max";
  unidad: string;
}
interface PuntoRow {
  nombre: string;
  valor: string;
  unidad: string;
  min: string;
  max: string;
}
interface EntradaRow {
  nombre: string;
  tipo: "csv" | "float" | "int" | "str";
  requerido: boolean;
}

const DEFAULT_OBJETIVOS: ObjetivoRow[] = [
  { nombre: "eficiencia", direccion: "max", unidad: "%" },
];
const DEFAULT_PUNTO: PuntoRow[] = [
  { nombre: "presion_entrada", valor: "101.3", unidad: "kPa", min: "50", max: "500" },
  { nombre: "presion_salida", valor: "405.2", unidad: "kPa", min: "100", max: "2000" },
];
const DEFAULT_ENTRADAS: EntradaRow[] = [
  { nombre: "datos_operacion", tipo: "csv", requerido: true },
];

// Construye el spec payload desde el estado del formulario. Los campos que el
// formulario no cubre (limites_duros, envelope, contrato_salida, reglas) van con
// defaults del template — el backend es la única verdad del esquema (D-39).
function buildSpecFromForm(
  dominio: string,
  descripcion: string,
  objetivos: ObjetivoRow[],
  punto: PuntoRow[],
  entradas: EntradaRow[]
): Record<string, unknown> {
  const punto_operacion: Record<string, unknown> = {};
  for (const p of punto) {
    if (!p.nombre.trim()) continue;
    const cantidad: Record<string, unknown> = {
      valor: p.valor === "" ? 0 : Number(p.valor),
      unidad: p.unidad || "u",
    };
    if (p.min !== "") cantidad.min = Number(p.min);
    if (p.max !== "") cantidad.max = Number(p.max);
    punto_operacion[p.nombre.trim()] = cantidad;
  }

  return {
    spec_schema_version: "1.0",
    dominio: dominio.trim() || "turbomaquinas",
    descripcion,
    objetivos: objetivos
      .filter((o) => o.nombre.trim())
      .map((o) => ({ nombre: o.nombre.trim(), direccion: o.direccion, unidad: o.unidad })),
    punto_operacion,
    limites_duros: {},
    envelope: {},
    entradas: entradas
      .filter((e) => e.nombre.trim())
      .map((e) => ({ nombre: e.nombre.trim(), tipo: e.tipo, requerido: e.requerido })),
    contrato_salida: [],
    metadatos_validacion: {},
    reglas: [],
  };
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface-3)",
  color: "var(--ink-primary)",
  border: "1px solid rgba(255,255,255,0.10)",
};

export function PublishModal({ isOpen, onClose, onPublished }: PublishModalProps) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [description, setDescription] = useState("");

  const [dominio, setDominio] = useState("turbomaquinas");
  const [objetivos, setObjetivos] = useState<ObjetivoRow[]>(DEFAULT_OBJETIVOS);
  const [punto, setPunto] = useState<PuntoRow[]>(DEFAULT_PUNTO);
  const [entradas, setEntradas] = useState<EntradaRow[]>(DEFAULT_ENTRADAS);

  const [tab, setTab] = useState<string>("formulario");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  // Cuando el usuario edita el JSON crudo, ese payload manda (fallback avanzado).
  const [jsonEdited, setJsonEdited] = useState(false);

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset al abrir + confirmar que el schema del backend está disponible (D-39).
  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setVersion("1.0.0");
    setDescription("");
    setDominio("turbomaquinas");
    setObjetivos(DEFAULT_OBJETIVOS);
    setPunto(DEFAULT_PUNTO);
    setEntradas(DEFAULT_ENTRADAS);
    setTab("formulario");
    setJsonText("");
    setJsonError(null);
    setJsonEdited(false);
    setValidationErrors([]);
    setConflict(null);
    setSubmitting(false);
    // El schema del backend es la única verdad — lo tocamos para respetar D-39.
    getDesignerSchema().catch(() => null);
  }, [isOpen]);

  // Spec derivado del formulario (para sincronizar al tab JSON).
  const formSpec = useMemo(
    () => buildSpecFromForm(dominio, description, objetivos, punto, entradas),
    [dominio, description, objetivos, punto, entradas]
  );

  // Al cambiar de tab hacia JSON, sincroniza el JSON con el formulario (salvo que
  // el usuario ya lo haya editado a mano).
  function handleTabChange(next: string) {
    if (next === "json" && !jsonEdited) {
      setJsonText(JSON.stringify(formSpec, null, 2));
      setJsonError(null);
    }
    setTab(next);
  }

  function currentSpec(): Record<string, unknown> | null {
    if (jsonEdited) {
      try {
        const parsed = JSON.parse(jsonText);
        setJsonError(null);
        return parsed;
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : "JSON inválido");
        return null;
      }
    }
    return formSpec;
  }

  async function handlePublish() {
    if (!name.trim() || submitting) return;
    setValidationErrors([]);
    setConflict(null);

    const spec = currentSpec();
    if (spec === null) {
      toast.error("El JSON del spec no es válido — corrígelo antes de publicar.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await publishDesigner({
        name: name.trim(),
        version: version.trim(),
        description,
        spec,
      });

      if ("validationErrors" in result) {
        setValidationErrors(result.validationErrors); // D-40 gate visible
        return;
      }
      if ("conflict" in result) {
        setConflict(result.conflict);
        return;
      }

      // Éxito.
      if (result.data.status === "duplicate") {
        toast.info("Ya tienes este Diseñador — contenido idéntico (hash verificado).");
      } else {
        await mirrorIndexAfterPublish(result.data);
        toast.success(`Diseñador publicado: ${result.data.name}@${result.data.version}`);
      }
      onPublished?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo publicar el Diseñador.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const publishBlocked = validationErrors.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden relative flex flex-col"
        style={{ background: "var(--surface-2)", border: "1px solid rgba(255,255,255,0.10)", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 left-0 w-full h-1"
          style={{ background: "linear-gradient(to right, transparent, var(--electric), transparent)", opacity: 0.7 }}
        />

        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontFamily: "var(--quasar-font-sans)", fontSize: "18px", fontWeight: 600, color: "var(--ink-primary)" }}>
            Publicar como Diseñador
          </h3>
          <button onClick={onClose} style={{ color: "var(--ink-dim)" }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Identidad: Nombre / Versión / Descripción */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. compresor-centrifugo"
                className="w-full rounded-lg py-2 px-3 outline-none text-sm"
                style={inputStyle}
                autoFocus
              />
            </Field>
            <Field label="Versión">
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full rounded-lg py-2 px-3 outline-none text-sm"
                style={{ ...inputStyle, fontFamily: "var(--quasar-font-mono)" }}
              />
            </Field>
          </div>
          <Field label="Descripción">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué diseña este Diseñador…"
              className="w-full rounded-lg py-2 px-3 outline-none text-sm"
              style={inputStyle}
            />
          </Field>
          <p style={{ fontFamily: "var(--quasar-font-mono)", fontSize: "12px", color: "var(--ink-dim)" }}>
            Cada versión publicada es inmutable.
          </p>

          {/* Spec: tabs Formulario (default) / JSON (avanzado) */}
          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsList>
              <TabsTrigger value="formulario">Formulario</TabsTrigger>
              <TabsTrigger value="json">JSON (avanzado)</TabsTrigger>
            </TabsList>

            {/* ── Tab Formulario (camino primario) ── */}
            <TabsContent value="formulario" className="flex flex-col gap-5 pt-2">
              <Field label="Dominio">
                <input
                  type="text"
                  value={dominio}
                  onChange={(e) => setDominio(e.target.value)}
                  className="w-full rounded-lg py-2 px-3 outline-none text-sm"
                  style={inputStyle}
                />
              </Field>

              {/* Objetivos */}
              <RepeatableSection
                title="Objetivos"
                onAdd={() => setObjetivos((r) => [...r, { nombre: "", direccion: "max", unidad: "" }])}
                addLabel="+ Objetivo"
              >
                {objetivos.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={o.nombre}
                      placeholder="nombre"
                      onChange={(e) => setObjetivos((r) => r.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                      className="flex-1 rounded-lg py-1.5 px-2.5 outline-none text-sm"
                      style={inputStyle}
                    />
                    <select
                      value={o.direccion}
                      onChange={(e) => setObjetivos((r) => r.map((x, j) => (j === i ? { ...x, direccion: e.target.value as "min" | "max" } : x)))}
                      className="rounded-lg py-1.5 px-2 outline-none text-sm"
                      style={inputStyle}
                    >
                      <option value="max">max</option>
                      <option value="min">min</option>
                    </select>
                    <input
                      type="text"
                      value={o.unidad}
                      placeholder="unidad"
                      onChange={(e) => setObjetivos((r) => r.map((x, j) => (j === i ? { ...x, unidad: e.target.value } : x)))}
                      className="w-24 rounded-lg py-1.5 px-2.5 outline-none text-sm"
                      style={inputStyle}
                    />
                    <RemoveBtn onClick={() => setObjetivos((r) => r.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </RepeatableSection>

              {/* Punto de operación */}
              <RepeatableSection
                title="Punto de operación"
                onAdd={() => setPunto((r) => [...r, { nombre: "", valor: "", unidad: "", min: "", max: "" }])}
                addLabel="+ Variable"
              >
                {punto.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={p.nombre}
                      placeholder="nombre"
                      onChange={(e) => setPunto((r) => r.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                      className="flex-1 min-w-[120px] rounded-lg py-1.5 px-2.5 outline-none text-sm"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      value={p.valor}
                      placeholder="valor"
                      onChange={(e) => setPunto((r) => r.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                      className="w-24 rounded-lg py-1.5 px-2.5 outline-none text-sm"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      value={p.unidad}
                      placeholder="unidad"
                      onChange={(e) => setPunto((r) => r.map((x, j) => (j === i ? { ...x, unidad: e.target.value } : x)))}
                      className="w-20 rounded-lg py-1.5 px-2.5 outline-none text-sm"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      value={p.min}
                      placeholder="min"
                      onChange={(e) => setPunto((r) => r.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))}
                      className="w-20 rounded-lg py-1.5 px-2.5 outline-none text-sm"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      value={p.max}
                      placeholder="max"
                      onChange={(e) => setPunto((r) => r.map((x, j) => (j === i ? { ...x, max: e.target.value } : x)))}
                      className="w-20 rounded-lg py-1.5 px-2.5 outline-none text-sm"
                      style={inputStyle}
                    />
                    <RemoveBtn onClick={() => setPunto((r) => r.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </RepeatableSection>

              {/* Entradas */}
              <RepeatableSection
                title="Entradas"
                onAdd={() => setEntradas((r) => [...r, { nombre: "", tipo: "float", requerido: true }])}
                addLabel="+ Entrada"
              >
                {entradas.map((en, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={en.nombre}
                      placeholder="nombre"
                      onChange={(e) => setEntradas((r) => r.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                      className="flex-1 rounded-lg py-1.5 px-2.5 outline-none text-sm"
                      style={inputStyle}
                    />
                    <select
                      value={en.tipo}
                      onChange={(e) => setEntradas((r) => r.map((x, j) => (j === i ? { ...x, tipo: e.target.value as EntradaRow["tipo"] } : x)))}
                      className="rounded-lg py-1.5 px-2 outline-none text-sm"
                      style={inputStyle}
                    >
                      <option value="csv">csv</option>
                      <option value="float">float</option>
                      <option value="int">int</option>
                      <option value="str">str</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--ink-muted)" }}>
                      <input
                        type="checkbox"
                        checked={en.requerido}
                        onChange={(e) => setEntradas((r) => r.map((x, j) => (j === i ? { ...x, requerido: e.target.checked } : x)))}
                      />
                      requerido
                    </label>
                    <RemoveBtn onClick={() => setEntradas((r) => r.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </RepeatableSection>
            </TabsContent>

            {/* ── Tab JSON (avanzado / fallback) ── */}
            <TabsContent value="json" className="flex flex-col gap-2 pt-2">
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonEdited(true);
                  setJsonError(null);
                }}
                spellCheck={false}
                className="w-full rounded-lg py-2 px-3 outline-none resize-none"
                style={{ ...inputStyle, fontFamily: "var(--quasar-font-mono)", fontSize: "12px", height: "260px" }}
              />
              {jsonError && (
                <span style={{ fontFamily: "var(--quasar-font-mono)", fontSize: "12px", color: "var(--error)" }}>
                  JSON inválido: {jsonError}
                </span>
              )}
            </TabsContent>
          </Tabs>

          {/* Gate de validación (D-40) — dentro del modal */}
          {validationErrors.length > 0 && <ValidationPanel errors={validationErrors} />}

          {/* Conflicto de inmutabilidad (409) */}
          {conflict && (
            <div
              className="rounded-lg px-4 py-3"
              style={{ background: "var(--surface-3)", border: "1px solid rgba(239,68,68,0.35)" }}
            >
              <span style={{ fontFamily: "var(--quasar-font-sans)", fontSize: "14px", color: "var(--error)" }}>
                Conflicto de inmutabilidad — {conflict} Las versiones publicadas nunca se sobrescriben.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ color: "var(--ink-muted)", border: "1px solid transparent" }}
          >
            Cancelar
          </button>
          <button
            onClick={handlePublish}
            disabled={!name.trim() || submitting || publishBlocked}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--electric)", color: "#0A0E14", boxShadow: "var(--glow-electric)" }}
          >
            {submitting ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers de layout ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block mb-1"
        style={{ fontFamily: "var(--quasar-font-sans)", fontSize: "14px", fontWeight: 600, color: "var(--ink-muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function RepeatableSection({
  title,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "var(--quasar-font-sans)", fontSize: "14px", fontWeight: 600, color: "var(--ink-muted)" }}>
          {title}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
          style={{ color: "var(--electric)", border: "1px solid rgba(58,160,255,0.25)" }}
        >
          <Plus size={12} /> {addLabel.replace(/^\+\s*/, "")}
        </button>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded-md transition-colors flex-shrink-0"
      style={{ color: "var(--ink-dim)" }}
      aria-label="Eliminar fila"
    >
      <Trash2 size={14} />
    </button>
  );
}
