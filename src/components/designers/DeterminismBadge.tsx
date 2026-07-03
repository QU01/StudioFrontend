"use client";

// DeterminismBadge (D-44) — comunica el determinismo con HONESTIDAD.
//   CPU → badge --success "Bit-idéntico verificado · CPU · semilla {N}"
//   GPU → badge --warning "Corrida GPU — no bit-exacta" + tooltip exacto del contrato
//
// Copy EXACTO del Copywriting Contract (01-UI-SPEC). Colores solo vía variables CSS.

interface DeterminismBadgeProps {
  determinism: string; // "cpu-bit-exacta" | "gpu-no-bit-exacta"
  seed?: number;
  compact?: boolean;
}

const GPU_TOOLTIP =
  "Los kernels CUDA no garantizan determinismo bit a bit. Para reproducibilidad exacta, ejecuta en CPU.";

export function DeterminismBadge({ determinism, seed, compact = false }: DeterminismBadgeProps) {
  const isGpu = determinism === "gpu-no-bit-exacta";

  const label = isGpu
    ? "Corrida GPU — no bit-exacta"
    : `Bit-idéntico verificado · CPU · semilla ${seed ?? "—"}`;

  const color = isGpu ? "var(--warning)" : "var(--success)";
  const bg = isGpu ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)";
  const border = isGpu ? "rgba(245,158,11,0.35)" : "rgba(34,197,94,0.35)";

  return (
    <span
      className="inline-flex items-center rounded-full whitespace-nowrap"
      title={isGpu ? GPU_TOOLTIP : undefined}
      style={{
        fontFamily: "var(--quasar-font-mono)",
        fontSize: "12px",
        color,
        background: bg,
        border: `1px solid ${border}`,
        padding: compact ? "1px 8px" : "3px 12px",
      }}
    >
      {label}
    </span>
  );
}
