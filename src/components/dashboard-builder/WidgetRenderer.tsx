"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import type { Widget } from "./types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function resolveNested(obj: unknown, path: string): unknown {
  if (!path || obj == null) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function PlotlyChartWidget({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") {
    return <div className="flex items-center justify-center h-full text-white/20 text-xs">No chart data</div>;
  }
  const d = data as Record<string, unknown>;
  const traces = (d.traces ?? [d]) as never[];
  const layout = (d.layout ?? {}) as object;
  return (
    <Plot
      data={traces}
      layout={{
        ...layout,
        paper_bgcolor: "transparent",
        plot_bgcolor: "#1a2030",
        font: { color: "rgba(255,255,255,0.5)", size: 10 },
        margin: { t: 20, b: 40, l: 50, r: 10 },
        autosize: true,
        legend: { bgcolor: "transparent", font: { color: "rgba(255,255,255,0.4)", size: 9 } },
      } as never}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}

function MetricCardWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const value = data != null ? String(data) : "—";
  const suffix = String(config.suffix ?? "");
  const isNumeric = !isNaN(Number(data));
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="text-3xl font-bold text-[#007bff]" style={{ fontVariantNumeric: "tabular-nums" }}>
        {isNumeric ? Number(data).toLocaleString(undefined, { maximumFractionDigits: 4 }) : value}
        {suffix && <span className="text-lg text-white/40 ml-1">{suffix}</span>}
      </div>
      {!!config.title && <div className="text-[11px] text-white/40 mt-1">{String(config.title)}</div>}
    </div>
  );
}

function DataTableWidget({ data }: { data: unknown }) {
  const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
  if (rows.length === 0) return <div className="flex items-center justify-center h-full text-white/20 text-xs">No data</div>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-auto h-full w-full">
      <table className="text-[11px] border-collapse w-full">
        <thead className="sticky top-0 bg-[#1a2030]">
          <tr>
            {cols.map(c => <th key={c} className="px-2 py-1 text-left text-white/50 font-semibold border-b border-white/10 whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
              {cols.map(c => <td key={c} className="px-2 py-1 text-white/60 whitespace-nowrap max-w-[120px] truncate">{row[c] == null ? <i className="text-white/20">null</i> : String(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownWidget({ config }: { config: Record<string, unknown> }) {
  const content = String(config.content ?? "*No content. Edit this widget to add markdown.*");
  return (
    <div className="overflow-auto h-full p-3 text-[12px] text-white/70 prose prose-invert prose-sm max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

export function WidgetRenderer({ widget, value }: { widget: Widget; value: unknown }) {
  const resolved = widget.binding.field_path
    ? resolveNested(value, widget.binding.field_path)
    : value;

  switch (widget.type) {
    case "PlotlyChart": return <PlotlyChartWidget data={resolved ?? value} />;
    case "MetricCard":  return <MetricCardWidget data={resolved ?? value} config={widget.config} />;
    case "DataTable":   return <DataTableWidget data={resolved ?? value} />;
    case "Markdown":    return <MarkdownWidget config={widget.config} />;
  }
}
