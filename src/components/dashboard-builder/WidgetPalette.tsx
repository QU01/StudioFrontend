"use client";

import { BarChart2, CreditCard, Table2, FileText } from "lucide-react";
import type { Widget } from "./types";

const WIDGET_TYPES: { type: Widget["type"]; label: string; icon: React.ElementType; color: string; description: string }[] = [
  { type: "PlotlyChart", label: "Chart",       icon: BarChart2, color: "#007bff",  description: "Plotly chart from node output" },
  { type: "MetricCard",  label: "Metric",      icon: CreditCard, color: "#28a745", description: "Single metric value card" },
  { type: "DataTable",   label: "Data Table",  icon: Table2,    color: "#17C2D7",  description: "Tabular data preview" },
  { type: "Markdown",    label: "Markdown",    icon: FileText,  color: "#9367B4",  description: "Free text / notes" },
];

export function WidgetPalette({ onAddWidget }: { onAddWidget: (type: Widget["type"]) => void }) {
  return (
    <div className="w-[160px] shrink-0 bg-[#1a2030] border-r border-white/5 flex flex-col gap-1 p-3">
      <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Widgets</div>
      {WIDGET_TYPES.map(({ type, label, icon: Icon, color, description }) => (
        <button
          key={type}
          onClick={() => onAddWidget(type)}
          title={description}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-left transition-all hover:scale-105 active:scale-95"
          style={{ background: `${color}14`, border: `1px solid ${color}33`, color }}
        >
          <Icon size={13} />
          <span className="text-[12px] font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}
