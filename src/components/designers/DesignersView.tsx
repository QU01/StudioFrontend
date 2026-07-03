"use client";

// Vista "Diseñadores" (D-33). Shell del Task 1 — los 4 estados llegan en Task 2.

interface DesignersViewProps {
  onNavigate?: (view: string) => void;
}

export function DesignersView({ onNavigate }: DesignersViewProps) {
  void onNavigate;
  return (
    <div className="min-h-full" style={{ background: "var(--surface-1)" }}>
      <div className="max-w-6xl mx-auto px-8 pt-10 pb-8">
        <h1
          style={{
            fontFamily: "var(--quasar-font-display)",
            fontSize: "25px",
            fontWeight: 600,
            lineHeight: 1.15,
            color: "var(--ink-primary)",
          }}
        >
          Diseñadores
        </h1>
      </div>
    </div>
  );
}
