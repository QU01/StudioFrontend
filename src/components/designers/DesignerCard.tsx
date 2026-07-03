"use client";

// DesignerCard (01-UI-SPEC §Screens 1 "Populated"). Anatomía TemplateGallery:
// card surface-2, borde hairline, hover border electric/35. Copy en español,
// colores SOLO vía variables CSS (--surface-*, --electric, --ink-*); acento rosa prohibido.

import { useState } from "react";
import { MoreVertical, Boxes } from "lucide-react";
import { toast } from "sonner";
import { exportDesigner, deleteDesigner, type Designer } from "@/lib/designers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DesignerCardProps {
  designer: Designer;
  onRun?: (designer: Designer) => void;
  /** Refresca la lista tras eliminar (el disco es la verdad, D-30). */
  onChanged?: () => void;
}

function latestVersion(d: Designer): string {
  const versions = d.versions ?? [];
  if (versions.length === 0) return "—";
  // El índice ordena por creación; tomamos la última fila como la más reciente.
  return versions[versions.length - 1]?.version ?? "—";
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

export function DesignerCard({ designer, onRun, onChanged }: DesignerCardProps) {
  const [hover, setHover] = useState(false);
  const [runHover, setRunHover] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const versionCount = designer.versions?.length ?? 0;
  const chip = `${designer.name}@${latestVersion(designer)}`;

  async function handleExport() {
    const version = latestVersion(designer);
    if (version === "—") {
      toast.error("Este Diseñador no tiene versiones para exportar.");
      return;
    }
    try {
      const filename = await exportDesigner(designer.name, version);
      toast.success(`Diseñador exportado: ${filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo exportar el Diseñador.");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteDesigner(designer.name, designer.id);
      toast.success(`Diseñador eliminado: ${designer.name}`);
      setConfirmDelete(false);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el Diseñador.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: "var(--surface-2)",
        border: `1px solid ${hover ? "rgba(58,160,255,0.35)" : "rgba(255,255,255,0.06)"}`,
        boxShadow: hover
          ? "var(--shadow-elevated)"
          : "0 1px 3px rgba(0,0,0,0.4)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex flex-col flex-1 p-6 gap-3">
        {/* Tile de artefacto + nombre + chip nombre@versión (mismo trato que las
            stat-tiles del Dashboard: surface-3 con acento eléctrico tenue). */}
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "color-mix(in srgb, var(--electric) 14%, var(--surface-3))",
              border: "1px solid rgba(58,160,255,0.25)",
              color: "var(--electric)",
            }}
            aria-hidden
          >
            <Boxes size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className="truncate"
              style={{
                fontFamily: "var(--quasar-font-sans)",
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--ink-primary)",
                lineHeight: 1.2,
              }}
              title={designer.name}
            >
              {designer.name}
            </h2>
            <span
              className="inline-block mt-1.5 truncate max-w-full"
              style={{
                fontFamily: "var(--quasar-font-mono)",
                fontSize: "12px",
                color: "var(--ink-muted)",
              }}
              title={chip}
            >
              {chip}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex-shrink-0 rounded-md p-1 transition-colors"
              style={{ color: "var(--ink-dim)" }}
              aria-label="Acciones del Diseñador"
            >
              <MoreVertical size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Base UI Menu.Item usa onClick — onSelect (API Radix) nunca dispara. */}
              <DropdownMenuItem onClick={() => void handleExport()}>
                Exportar .qsd
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                // Diferir al siguiente tick: el menú devuelve el foco al trigger al
                // cerrarse y cerraría el Dialog en el mismo ciclo (race menú→diálogo).
                onClick={() => {
                  setTimeout(() => setConfirmDelete(true), 0);
                }}
              >
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Descripción */}
        {designer.description ? (
          <p
            style={{
              fontFamily: "var(--quasar-font-sans)",
              fontSize: "14px",
              color: "var(--ink-muted)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {designer.description}
          </p>
        ) : null}

        {/* Métrica destacada: nº de versiones como numeral mono grande + label. */}
        <div className="flex items-end justify-between gap-3 mt-auto pt-1">
          <div className="flex flex-col">
            <span
              style={{
                fontFamily: "var(--quasar-font-mono)",
                fontSize: "28px",
                fontWeight: 700,
                lineHeight: 1,
                color: "var(--ink-primary)",
              }}
            >
              {versionCount}
            </span>
            <span
              className="mt-1"
              style={{
                fontFamily: "var(--quasar-font-mono)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "var(--ink-dim)",
              }}
            >
              {versionCount === 1 ? "versión" : "versiones"}
            </span>
          </div>

          {/* Metadatos: publicación + último run (UI-SPEC §Screens 1). No hay
              datos de runs en el objeto Designer → "Sin ejecuciones" honesto,
              sin llamadas de red nuevas. */}
          <div
            className="flex flex-col items-end gap-0.5 text-right"
            style={{ fontFamily: "var(--quasar-font-mono)", fontSize: "12px" }}
          >
            <span style={{ color: "var(--ink-muted)" }}>
              {formatDate(designer.created_at)}
            </span>
            <span style={{ color: "var(--ink-dim)" }}>
              último run · Sin ejecuciones
            </span>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div className="mx-6 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

      {/* Fila de acciones — "Ejecutar" abre el detalle del Diseñador (plan 05).
          Acción de lista (N tarjetas): outline que se rellena eléctrico en hover
          (disciplina 60/30/10, sin glow a densidad de lista). */}
      <div className="p-6 pt-4">
        <button
          onClick={() => onRun?.(designer)}
          onMouseEnter={() => setRunHover(true)}
          onMouseLeave={() => setRunHover(false)}
          className="w-full py-2 rounded-lg text-[13px] font-semibold transition-all"
          style={{
            background: runHover ? "var(--electric)" : "transparent",
            color: runHover ? "#0A0E14" : "var(--electric)",
            border: "1px solid rgba(58,160,255,0.45)",
          }}
        >
          Ejecutar
        </button>
      </div>

      {/* Diálogo destructivo de eliminación (única acción destructiva de la fase). */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          className="max-w-md"
          style={{ background: "var(--surface-2)", color: "var(--ink-primary)" }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--quasar-font-sans)", color: "var(--error)" }}>
              Eliminar Diseñador
            </DialogTitle>
            <DialogDescription
              style={{ fontFamily: "var(--quasar-font-sans)", color: "var(--ink-muted)" }}
            >
              Esto elimina &apos;{designer.name}&apos; y sus {versionCount}{" "}
              {versionCount === 1 ? "versión" : "versiones"} del registry local. Los
              archivos .qsd que exportaste no se tocan. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-50"
              style={{ background: "var(--error)", color: "#0A0E14" }}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
              style={{
                background: "transparent",
                color: "var(--ink-muted)",
                border: "1px solid var(--surface-3)",
              }}
            >
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
