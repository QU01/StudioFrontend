import { cn } from "@/lib/utils"

// Skeleton con shimmer sutil: gradiente animado (surface-3 → highlight → surface-3)
// que se desliza, en vez del pulse plano. Respeta prefers-reduced-motion vía la
// utilidad animate-pulse de fallback cuando el shimmer no aplica.
function Skeleton({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md overflow-hidden relative", className)}
      style={{
        background:
          "linear-gradient(90deg, var(--surface-3) 0%, color-mix(in srgb, var(--surface-3) 70%, var(--ink-dim)) 50%, var(--surface-3) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-slide 1.6s linear infinite",
        ...style,
      }}
      {...props}
    />
  )
}

export { Skeleton }
