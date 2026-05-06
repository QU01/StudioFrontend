"use client";

interface MainCanvasProps {
  children?: React.ReactNode;
  title?: string;
}

export function MainCanvas({ children, title = "Workspace" }: MainCanvasProps) {
  return (
    <main className="flex flex-1 flex-col overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      {/* Electric gradient top accent line */}
      <div
        className="h-px w-full shrink-0"
        style={{
          background: "linear-gradient(to right, transparent 0%, var(--electric-dim) 15%, var(--electric) 35%, var(--cyan) 50%, var(--electric) 65%, var(--electric-dim) 85%, transparent 100%)",
        }}
      />

      {/* Top bar */}
      <div
        className="flex h-14 shrink-0 items-center justify-between border-b px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Breadcrumb dot */}
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--electric-dim)" }}
          />
          <h1 className="text-sm font-semibold tracking-wide">{title}</h1>
        </div>

        {/* Status indicator */}
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1"
          style={{
            backgroundColor: "color-mix(in oklch, oklch(0.72 0.19 155) 8%, transparent)",
            border: "1px solid color-mix(in oklch, oklch(0.72 0.19 155) 20%, transparent)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-status-pulse"
            style={{
              backgroundColor: "oklch(0.72 0.19 155)",
              boxShadow: "0 0 6px oklch(0.72 0.19 155 / 0.6)",
            }}
          />
          <span className="text-xs font-medium" style={{ color: "oklch(0.72 0.19 155)" }}>
            Backend connected
          </span>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </main>
  );
}
