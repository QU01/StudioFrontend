"use client";

import type { Widget, RunSummary } from "./types";

const inputClass = "w-full bg-[#1a2030] border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white/80 focus:outline-none focus:border-[#007bff] transition-colors";
const selectClass = inputClass;

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{children}</label>;
}

// Collect all field paths available in a result object (up to 2 levels deep)
function collectPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  const paths: string[] = [];
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    paths.push(full);
    const val = (obj as Record<string, unknown>)[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      paths.push(...collectPaths(val as Record<string, unknown>, full));
    }
  }
  return paths;
}

export function WidgetConfigPanel({
  widget,
  runs,
  onUpdate,
}: {
  widget: Widget | null;
  runs: RunSummary[];
  onUpdate: (w: Widget) => void;
}) {
  if (!widget) {
    return (
      <div className="w-[220px] shrink-0 bg-[#1a2030] border-l border-white/5 flex items-center justify-center">
        <p className="text-[12px] text-white/20 text-center px-4">Select a widget to configure it</p>
      </div>
    );
  }

  const set = (key: keyof Widget, value: unknown) => onUpdate({ ...widget, [key]: value });
  const setBinding = (key: keyof Widget["binding"], value: unknown) =>
    onUpdate({ ...widget, binding: { ...widget.binding, [key]: value } });
  const setConfig = (key: string, value: unknown) =>
    onUpdate({ ...widget, config: { ...widget.config, [key]: value } });

  const selectedRun = runs.find(r => r.id === widget.binding.run_id) ?? runs[0] ?? null;
  const nodeIds = selectedRun ? Object.keys(selectedRun.results) : [];
  const nodeResult = selectedRun?.results?.[widget.binding.node_id] ?? {};
  const fieldPaths = collectPaths(nodeResult as Record<string, unknown>);

  return (
    <div className="w-[220px] shrink-0 bg-[#1a2030] border-l border-white/5 flex flex-col gap-3 p-3 overflow-y-auto">
      <div className="text-[11px] text-white/60 font-semibold">Widget Config</div>

      <div className="flex flex-col gap-1">
        <Label>Title</Label>
        <input
          className={inputClass}
          value={String(widget.config.title ?? "")}
          onChange={e => setConfig("title", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>Type</Label>
        <select className={selectClass} value={widget.type} onChange={e => set("type", e.target.value as Widget["type"])}>
          <option value="PlotlyChart">Chart</option>
          <option value="MetricCard">Metric Card</option>
          <option value="DataTable">Data Table</option>
          <option value="Markdown">Markdown</option>
        </select>
      </div>

      <div className="border-t border-white/5 pt-3">
        <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Data Binding</div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label>Run</Label>
            <select
              className={selectClass}
              value={widget.binding.run_id ?? ""}
              onChange={e => setBinding("run_id", Number(e.target.value) || null)}
            >
              <option value="">— select run —</option>
              {runs.map(r => (
                <option key={r.id} value={r.id}>
                  Run #{r.id} · {r.status} · {r.started_at ? new Date(r.started_at).toLocaleDateString() : "?"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Node</Label>
            <select
              className={selectClass}
              value={widget.binding.node_id}
              onChange={e => setBinding("node_id", e.target.value)}
            >
              <option value="">— select node —</option>
              {nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Field</Label>
            <select
              className={selectClass}
              value={widget.binding.field_path}
              onChange={e => setBinding("field_path", e.target.value)}
            >
              <option value="">— select field —</option>
              {fieldPaths.map(fp => <option key={fp} value={fp}>{fp}</option>)}
            </select>
          </div>
        </div>
      </div>

      {widget.type === "Markdown" && (
        <div className="flex flex-col gap-1">
          <Label>Content</Label>
          <textarea
            className={inputClass + " resize-none"}
            rows={6}
            value={String(widget.config.content ?? "")}
            onChange={e => setConfig("content", e.target.value)}
            placeholder="# My notes&#10;Write **markdown** here..."
          />
        </div>
      )}

      {widget.type === "MetricCard" && (
        <div className="flex flex-col gap-1">
          <Label>Suffix</Label>
          <input
            className={inputClass}
            value={String(widget.config.suffix ?? "")}
            onChange={e => setConfig("suffix", e.target.value)}
            placeholder="e.g. %, ms, rows"
          />
        </div>
      )}
    </div>
  );
}
