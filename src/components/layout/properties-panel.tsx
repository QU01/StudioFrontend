"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

interface PropertiesPanelProps {
  title?: string;
  children?: React.ReactNode;
}

export function PropertiesPanel({ title = "Properties", children }: PropertiesPanelProps) {
  return (
    <aside
      className="flex h-full w-[320px] flex-col border-l"
      style={{ backgroundColor: "var(--surface-0)", borderColor: "var(--border)" }}
    >
      <div className="flex h-14 items-center justify-between px-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        {/* Decorative accent */}
        <span
          className="h-1 w-8 rounded-full"
          style={{
            background: "linear-gradient(to right, var(--electric-dim), var(--cyan))",
          }}
        />
      </div>

      {/* Gradient divider */}
      <div className="mx-3">
        <div
          className="h-px"
          style={{
            background: "linear-gradient(to right, transparent, var(--electric-dim), var(--cyan), var(--electric-dim), transparent)",
          }}
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {children ?? (
            <div className="flex flex-col items-center gap-3 pt-8 text-center">
              <div
                className="h-10 w-10 rounded-xl"
                style={{
                  backgroundColor: "color-mix(in oklch, var(--electric) 8%, transparent)",
                  border: "1px solid color-mix(in oklch, var(--electric) 15%, transparent)",
                }}
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Select an element to view its properties.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
