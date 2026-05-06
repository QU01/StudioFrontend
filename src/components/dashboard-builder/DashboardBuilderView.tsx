"use client";

import { useState, useCallback, useEffect, useRef, type ComponentType } from "react";
import dynamic from "next/dynamic";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Loaded client-only to avoid SSR issues with getBoundingClientRect inside WidthProvider
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout = dynamic(() => import("react-grid-layout"), { ssr: false }) as ComponentType<any>;
import { Plus, Save, Trash2, Layout } from "lucide-react";
import { toast } from "sonner";
import { DJANGO_API_BASE, fetchWithAuth } from "@/lib/auth";
import type { DashboardDef, Widget, LayoutItem, RunSummary } from "./types";
import { WidgetRenderer } from "./WidgetRenderer";
import { WidgetPalette } from "./WidgetPalette";
import { WidgetConfigPanel } from "./WidgetConfigPanel";
import { SaveModal } from "@/components/ui/SaveModal";

function generateId() {
  return `w-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function DashboardBuilderView() {
  const [dashboard, setDashboard] = useState<DashboardDef>({ name: "My Dashboard", layout: [], widgets: [] });
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(900);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [savedDashboards, setSavedDashboards] = useState<DashboardDef[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  useEffect(() => {
    // Fetch pipeline runs from Django (persisted across sessions)
    fetchWithAuth(`${DJANGO_API_BASE}/runs/`).then(r => r.json()).then(d => setRuns(Array.isArray(d) ? [...d].sort((a, b) => b.id - a.id) : [])).catch(() => {});
    // Fetch saved dashboards from Django
    fetchWithAuth(`${DJANGO_API_BASE}/dashboards/`).then(r => r.json()).then(setSavedDashboards).catch(() => {});
  }, []);

  // Listen for dashboard:load events dispatched by DataDrawer
  useEffect(() => {
    const handler = (e: Event) => {
      const dash = (e as CustomEvent).detail as DashboardDef;
      if (dash) {
        setDashboard(dash);
        setSelectedWidgetId(null);
      }
    };
    window.addEventListener("dashboard:load", handler);
    return () => window.removeEventListener("dashboard:load", handler);
  }, []);

  // Measure container width for GridLayout
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setGridWidth(el.clientWidth - 32));
    obs.observe(el);
    setGridWidth(el.clientWidth - 32);
    return () => obs.disconnect();
  }, []);

  const addWidget = useCallback((type: Widget["type"]) => {
    const id = generateId();
    const newWidget: Widget = {
      id,
      type,
      binding: { run_id: runs[0]?.id ?? null, node_id: "", field_path: "" },
      config: { title: type },
    };
    const newItem: LayoutItem = { i: id, x: 0, y: Infinity, w: 6, h: 4 };
    setDashboard(d => ({
      ...d,
      layout: [...d.layout, newItem],
      widgets: [...d.widgets, newWidget],
    }));
    setSelectedWidgetId(id);
  }, [runs]);

  const removeWidget = useCallback((id: string) => {
    setDashboard(d => ({
      ...d,
      layout: d.layout.filter(l => l.i !== id),
      widgets: d.widgets.filter(w => w.id !== id),
    }));
    if (selectedWidgetId === id) setSelectedWidgetId(null);
  }, [selectedWidgetId]);

  const updateWidget = useCallback((updated: Widget) => {
    setDashboard(d => ({ ...d, widgets: d.widgets.map(w => w.id === updated.id ? updated : w) }));
  }, []);

  const onLayoutChange = useCallback((layout: LayoutItem[]) => {
    setDashboard(d => ({ ...d, layout }));
  }, []);

  const handleModalSave = useCallback(async (name: string) => {
    setIsSaving(true);
    try {
      const method = dashboard.id ? "PATCH" : "POST";
      const url = dashboard.id
        ? `${DJANGO_API_BASE}/dashboards/${dashboard.id}/`
        : `${DJANGO_API_BASE}/dashboards/`;
      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, layout: dashboard.layout, widgets: dashboard.widgets }),
      });
      if (res.ok) {
        const saved = await res.json();
        setDashboard(d => ({ ...d, id: saved.id, name }));
        fetchWithAuth(`${DJANGO_API_BASE}/dashboards/`).then(r => r.json()).then(setSavedDashboards).catch(() => {});
        toast.success(dashboard.id ? "Dashboard updated!" : "Dashboard saved!");
      } else {
        toast.error("Failed to save dashboard");
      }
    } finally {
      setIsSaving(false);
      setIsSaveModalOpen(false);
    }
  }, [dashboard]);

  // Open modal for new dashboards; silently PATCH for already-saved ones
  const saveDashboard = useCallback(() => {
    if (dashboard.id) {
      handleModalSave(dashboard.name);
    } else {
      setIsSaveModalOpen(true);
    }
  }, [dashboard, handleModalSave]);

  const loadDashboard = useCallback((d: DashboardDef) => {
    setDashboard(d);
    setSelectedWidgetId(null);
  }, []);

  const selectedWidget = dashboard.widgets.find(w => w.id === selectedWidgetId) ?? null;
  const activeRun = runs.find(r => r.id === (selectedWidget?.binding.run_id ?? runs[0]?.id)) ?? runs[0] ?? null;

  return (
    <div className="flex flex-col h-full bg-[#181d23]">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#1a2030] border-b border-white/10 shrink-0">
        <Layout size={15} className="text-white/40" />
        <input
          className="bg-transparent text-white/80 text-[13px] font-semibold focus:outline-none border-b border-transparent focus:border-white/30 transition-colors"
          value={dashboard.name}
          onChange={e => setDashboard(d => ({ ...d, name: e.target.value }))}
        />
        <div className="ml-auto flex items-center gap-2">
          {savedDashboards.length > 0 && (
            <select
              className="bg-[#1a2030] border border-white/10 rounded px-2 py-1 text-[12px] text-white/60 focus:outline-none"
              onChange={e => {
                const found = savedDashboards.find(d => String(d.id) === e.target.value);
                if (found) loadDashboard(found);
              }}
              defaultValue=""
            >
              <option value="" disabled>Load saved…</option>
              {savedDashboards.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </select>
          )}
          <button
            onClick={saveDashboard}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-white/70 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
          >
            <Save size={13} />
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Widget Palette */}
        <WidgetPalette onAddWidget={addWidget} />

        {/* Grid canvas */}
        <div ref={gridContainerRef} className="flex-1 min-w-0 overflow-auto bg-[#181d23] p-4">
          {dashboard.widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20 select-none gap-2">
              <Plus size={40} />
              <p className="text-sm">Add widgets from the palette on the left</p>
            </div>
          ) : (
            <GridLayout
              className="layout"
              layout={dashboard.layout}
              cols={12}
              rowHeight={80}
              width={gridWidth}
              onLayoutChange={(layout: LayoutItem[]) => onLayoutChange(layout)}
              draggableHandle=".drag-handle"
            >
              {dashboard.widgets.map(widget => {
                const run = runs.find(r => r.id === widget.binding.run_id) ?? activeRun;
                const nodeResult = run?.results?.[widget.binding.node_id];
                const isSelected = selectedWidgetId === widget.id;
                return (
                  <div
                    key={widget.id}
                    onClick={() => setSelectedWidgetId(widget.id)}
                    style={{
                      background: "#222a35",
                      border: isSelected ? "1.5px solid #007bff" : "1.5px solid rgba(255,255,255,0.07)",
                      borderRadius: 8,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                    }}
                  >
                    <div className="drag-handle flex items-center gap-2 px-3 py-1.5 bg-[#1a2030] border-b border-white/5 cursor-grab shrink-0">
                      <span className="text-[11px] text-white/40 flex-1 truncate">{(widget.config.title as string) || widget.type}</span>
                      <button
                        onClick={e => { e.stopPropagation(); removeWidget(widget.id); }}
                        className="text-white/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <WidgetRenderer widget={widget} value={nodeResult} />
                    </div>
                  </div>
                );
              })}
            </GridLayout>
          )}
        </div>

        {/* Config panel */}
        <WidgetConfigPanel
          widget={selectedWidget}
          runs={runs}
          onUpdate={updateWidget}
        />
      </div>
      <SaveModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleModalSave}
        title="Save Dashboard"
        descriptionLabel=""
        initialName={dashboard.name === "My Dashboard" ? "" : dashboard.name}
      />
    </div>
  );
}
