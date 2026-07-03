"use client";

// ValidationPanel (D-40) — componente COMPARTIDO publish/run (el plan 05 lo reutiliza).
// Renderiza la lista machine-readable de errores por campo {campo, regla, mensaje}.
// El acento --error va al borde/heading, no a todo el texto (01-UI-SPEC §Color).

import type { ValidationError } from "@/lib/designers";

interface ValidationPanelProps {
  errors: ValidationError[];
}

export function ValidationPanel({ errors }: ValidationPanelProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "var(--surface-3)",
        border: "1px solid rgba(239,68,68,0.35)",
      }}
    >
      <div
        className="px-4 py-2.5"
        style={{
          borderBottom: "1px solid rgba(239,68,68,0.25)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--quasar-font-sans)",
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--error)",
          }}
        >
          Spec inválida — corrige antes de continuar
        </span>
      </div>
      <ul className="flex flex-col">
        {errors.map((e, i) => (
          <li
            key={`${e.campo}-${e.regla}-${i}`}
            className="flex flex-col gap-0.5 px-4 py-2.5"
            style={{
              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                style={{
                  fontFamily: "var(--quasar-font-mono)",
                  fontSize: "12px",
                  color: "var(--ink-primary)",
                }}
              >
                {e.campo}
              </span>
              <span style={{ color: "var(--ink-dim)" }}>·</span>
              <span
                style={{
                  fontFamily: "var(--quasar-font-mono)",
                  fontSize: "12px",
                  color: "var(--ink-muted)",
                }}
              >
                {e.regla}
              </span>
            </div>
            <span
              style={{
                fontFamily: "var(--quasar-font-sans)",
                fontSize: "14px",
                color: "var(--ink-muted)",
                lineHeight: 1.5,
              }}
            >
              {e.mensaje}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
