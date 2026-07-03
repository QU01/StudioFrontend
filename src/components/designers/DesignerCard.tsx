"use client";

// DesignerCard (01-UI-SPEC §Screens 1 "Populated"). Anatomía TemplateGallery:
// card surface-2, borde hairline, hover border electric/35. Copy en español,
// colores SOLO vía variables CSS (--surface-*, --electric, --ink-*); acento rosa prohibido.

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import type { Designer } from "@/lib/designers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DesignerCardProps {
  designer: Designer;
  onRun?: (designer: Designer) => void;
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

export function DesignerCard({ designer, onRun }: DesignerCardProps) {
  const [hover, setHover] = useState(false);
  const versionCount = designer.versions?.length ?? 0;
  const chip = `${designer.name}@${latestVersion(designer)}`;

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: "var(--surface-2)",
        border: `1px solid ${hover ? "rgba(58,160,255,0.35)" : "rgba(255,255,255,0.06)"}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex flex-col flex-1 p-6 gap-3">
        {/* Nombre + chip nombre@versión */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
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
              {/* Deshabilitadas hasta el plan 06 — presentes pero disabled, sin ocultar. */}
              <DropdownMenuItem disabled>Exportar .qsd</DropdownMenuItem>
              <DropdownMenuItem disabled variant="destructive">
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

        {/* Metadatos mono */}
        <div
          className="flex items-center gap-3 mt-auto"
          style={{
            fontFamily: "var(--quasar-font-mono)",
            fontSize: "12px",
            color: "var(--ink-dim)",
          }}
        >
          <span>{versionCount} {versionCount === 1 ? "versión" : "versiones"}</span>
          <span>·</span>
          <span>{formatDate(designer.created_at)}</span>
        </div>
      </div>

      {/* Divisor */}
      <div className="mx-6 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

      {/* Fila de acciones — "Ejecutar" abre el detalle del Diseñador (plan 05). */}
      <div className="p-6 pt-4">
        <button
          onClick={() => onRun?.(designer)}
          className="w-full py-2 rounded-lg text-[13px] font-semibold transition-all"
          style={{
            background: "var(--electric)",
            color: "#0A0E14",
            boxShadow: "var(--glow-electric)",
          }}
        >
          Ejecutar
        </button>
      </div>
    </div>
  );
}
