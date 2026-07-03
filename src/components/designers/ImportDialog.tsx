"use client";

// ImportDialog (01-UI-SPEC §5) — flujo de import por pasos del artefacto Diseñador.
//
// Pasos:
//   1. Selección/recepción del archivo .qsd → inspectQsd (verificación de hash).
//   2. Ramas según la clasificación de colisión:
//        - "duplicate" → toast info EXACTO "Ya lo tienes" y cierra (no-op, D-37).
//        - "conflict"  → diálogo bloqueante de inmutabilidad EXACTO (D-37).
//        - custom nodes presentes → paso de DIVULGACIÓN de código custom (D-36),
//          con "Inspeccionar código" (bloque mono read-only) y "Continuar e importar".
//        - "new" sin custom → import directo.
//   3. Confirmado → importQsd + mirrorIndexAfterImport + toast success + refresh.
//
// TODO código importado corre SIEMPRE en el sandbox de Quasar (D-36) — el copy de
// divulgación lo comunica explícitamente. El import no ejecuta nada.
//
// Colores SOLO vía variables CSS de marca. Español. Solo JSX escapado (T-01-19).

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, ShieldAlert, Code2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  inspectQsd,
  importQsd,
  mirrorIndexAfterImport,
  type InspectResult,
} from "@/lib/designers";

type Step = "select" | "conflict" | "disclose" | "importing";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Archivo entregado por Electron (doble clic .qsd) — inicia el flujo directo. */
  initialFile?: File | null;
  /** Callback tras un import exitoso (refresca la lista). */
  onImported?: () => void;
}

const btnPrimary: React.CSSProperties = {
  background: "var(--electric)",
  color: "#0A0E14",
  boxShadow: "var(--glow-electric)",
};

const btnOutline: React.CSSProperties = {
  background: "transparent",
  color: "var(--ink-muted)",
  border: "1px solid var(--surface-3)",
};

export function ImportDialog({
  open,
  onOpenChange,
  initialFile,
  onImported,
}: ImportDialogProps) {
  const [step, setStep] = useState<Step>("select");
  const [file, setFile] = useState<File | Blob | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectData, setInspectData] = useState<InspectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("select");
    setFile(null);
    setInspecting(false);
    setInspectData(null);
    setError(null);
    setExpandedNode(null);
  }, []);

  const close = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const doImport = useCallback(
    async (f: File | Blob) => {
      setStep("importing");
      setError(null);
      const outcome = await importQsd(f);
      if ("ok" in outcome) {
        if (outcome.data.status === "duplicate") {
          toast.info(
            "Ya tienes este Diseñador — contenido idéntico (hash verificado). No se importó nada.",
          );
        } else {
          toast.success(
            `Diseñador importado: ${outcome.data.name}@${outcome.data.version}`,
          );
          await mirrorIndexAfterImport(outcome.data);
        }
        onImported?.();
        close();
        return;
      }
      if ("conflict" in outcome) {
        setError(outcome.conflict);
        setStep("conflict");
        return;
      }
      if ("validationErrors" in outcome) {
        setError(
          outcome.validationErrors.map((e) => `${e.campo}: ${e.mensaje}`).join(" · "),
        );
        setStep("select");
        return;
      }
      setError(outcome.error);
      setStep("select");
    },
    [onImported, close],
  );

  const handleFile = useCallback(
    async (f: File | Blob) => {
      setFile(f);
      setError(null);
      setInspecting(true);
      const outcome = await inspectQsd(f);
      setInspecting(false);

      if (!("ok" in outcome)) {
        setError(outcome.error);
        setStep("select");
        return;
      }

      const data = outcome.data;
      setInspectData(data);

      // Rama dedup: contenido idéntico → no-op con toast y cierre.
      if (data.status === "duplicate") {
        toast.info(
          "Ya tienes este Diseñador — contenido idéntico (hash verificado). No se importó nada.",
        );
        close();
        return;
      }

      // Rama conflicto de inmutabilidad: diálogo bloqueante.
      if (data.status === "conflict") {
        setStep("conflict");
        return;
      }

      // Rama nuevo: si trae código custom, divulgar ANTES de importar (D-36).
      if (data.custom_nodes.length > 0) {
        setStep("disclose");
        return;
      }

      // Nuevo sin código custom → import directo.
      await doImport(f);
    },
    [close, doImport],
  );

  // Doble clic .qsd de Electron: si llega un initialFile y el diálogo abre, procesarlo.
  const lastInitial = useRef<File | null>(null);
  if (open && initialFile && lastInitial.current !== initialFile) {
    lastInitial.current = initialFile;
    void handleFile(initialFile);
  }
  if (!open && lastInitial.current) {
    lastInitial.current = null;
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  };

  const fontSans = "var(--quasar-font-sans)";
  const fontMono = "var(--quasar-font-mono)";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        className="max-w-lg"
        style={{ background: "var(--surface-2)", color: "var(--ink-primary)" }}
      >
        {/* ── Paso: selección + verificación de hash ── */}
        {(step === "select" || step === "importing") && (
          <>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: fontSans }}>
                Importar Diseñador
              </DialogTitle>
              <DialogDescription style={{ fontFamily: fontSans, color: "var(--ink-muted)" }}>
                Selecciona un archivo .qsd. Verificamos su hash SHA-256 antes de
                importar.
              </DialogDescription>
            </DialogHeader>

            <button
              type="button"
              disabled={inspecting || step === "importing"}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl px-4 py-8 flex flex-col items-center gap-3 transition-all disabled:opacity-50"
              style={{
                background: "var(--surface-3)",
                border: "1px dashed var(--surface-3)",
                fontFamily: fontSans,
                color: "var(--ink-muted)",
              }}
            >
              <UploadCloud size={28} style={{ color: "var(--ink-dim)" }} />
              <span className="text-[13px]">
                {inspecting
                  ? "Verificando hash…"
                  : step === "importing"
                    ? "Importando…"
                    : "Haz clic para elegir un archivo .qsd"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".qsd"
              className="hidden"
              onChange={onPick}
            />

            {error && (
              <p className="text-[13px]" style={{ fontFamily: fontSans, color: "var(--error)" }}>
                {error}
              </p>
            )}
          </>
        )}

        {/* ── Paso: conflicto de inmutabilidad (bloqueante, D-37) ── */}
        {step === "conflict" && inspectData && (
          <>
            <DialogHeader>
              <DialogTitle
                className="flex items-center gap-2"
                style={{ fontFamily: fontSans, color: "var(--error)" }}
              >
                <ShieldAlert size={18} />
                Conflicto de inmutabilidad
              </DialogTitle>
              <DialogDescription style={{ fontFamily: fontSans, color: "var(--ink-muted)" }}>
                &apos;{inspectData.name}@{inspectData.version}&apos; ya existe con
                contenido distinto (el hash SHA-256 no coincide). Las versiones
                publicadas nunca se sobrescriben.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                disabled
                title="Renombra el archivo .qsd y reintenta"
                className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={btnPrimary}
              >
                Importar con otro nombre/versión
              </button>
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
                style={btnOutline}
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {/* ── Paso: divulgación de código custom (D-36) ── */}
        {step === "disclose" && inspectData && (
          <>
            <DialogHeader>
              <DialogTitle
                className="flex items-center gap-2"
                style={{ fontFamily: fontSans, color: "var(--warning)" }}
              >
                <Code2 size={18} />
                Código custom en este Diseñador
              </DialogTitle>
              <DialogDescription style={{ fontFamily: fontSans, color: "var(--ink-muted)" }}>
                {`Este Diseñador incluye ${inspectData.custom_nodes.length} nodos con código custom. Todo código importado corre siempre en el sandbox de Quasar.`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2 max-h-[42vh] overflow-y-auto">
              {inspectData.custom_nodes.map((node) => (
                <div
                  key={node.node_id}
                  className="rounded-lg"
                  style={{ background: "var(--surface-3)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center justify-between px-3 py-2">
                    <span style={{ fontFamily: fontMono, fontSize: "12px", color: "var(--ink-primary)" }}>
                      {node.node_id}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedNode(expandedNode === node.node_id ? null : node.node_id)
                      }
                      className="px-3 py-1 rounded-md text-[12px] font-medium transition-all"
                      style={btnOutline}
                    >
                      Inspeccionar código
                    </button>
                  </div>
                  {expandedNode === node.node_id && (
                    <pre
                      className="px-3 pb-3 overflow-x-auto"
                      style={{
                        fontFamily: fontMono,
                        fontSize: "11px",
                        color: "var(--ink-muted)",
                        whiteSpace: "pre",
                        maxHeight: "30vh",
                        overflowY: "auto",
                      }}
                    >
                      {node.code}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => file && doImport(file)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
                style={btnPrimary}
              >
                Continuar e importar
              </button>
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
                style={btnOutline}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
