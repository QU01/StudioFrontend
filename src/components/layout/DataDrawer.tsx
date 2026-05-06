"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { DJANGO_API_BASE, fetchWithAuth } from "@/lib/auth";
import { X, Network, Workflow, Target, FileCode2, Loader2, Database, Trash2, FolderOpen, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { agentSwitchView, loadPipeline, loadArchitecture } from "@/lib/agent-events";

type TabKey = "datasets" | "pipelines" | "architectures" | "checkpoints" | "solutions" | "dashboards";

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ElementType; color: string; endpoint: string }[] = [
  { key: "datasets",      label: "Datasets",    icon: Database,         color: "#17C2D7", endpoint: "/datasets/" },
  { key: "pipelines",     label: "Pipelines",   icon: Workflow,          color: "#00f0ff", endpoint: "/pipelines/" },
  { key: "architectures", label: "Configs",     icon: Network,           color: "#0a58ca", endpoint: "/architectures/" },
  { key: "checkpoints",   label: "Models",      icon: FileCode2,         color: "#E83E8C", endpoint: "/checkpoints/" },
  { key: "solutions",     label: "Inverse",     icon: Target,            color: "#4ade80", endpoint: "/inverse-design-solutions/" },
  { key: "dashboards",    label: "Dashboards",  icon: LayoutDashboard,   color: "#f59e0b", endpoint: "/dashboards/" },
];

function getEndpoint(tab: TabKey) {
  return TAB_CONFIG.find((t) => t.key === tab)?.endpoint ?? "";
}

function formatSubtitle(item: any, tab: TabKey): string {
  if (tab === "checkpoints") {
    return `Acc: ${(item.val_acc || 0).toFixed(2)}% | ${((item.size_bytes ?? 0) / 1024 / 1024).toFixed(2)} MB`;
  }
  if (tab === "datasets") {
    return item.description || item.file_path || `Created: ${new Date(item.created_at).toLocaleDateString()}`;
  }
  return item.description ? item.description : `Created: ${new Date(item.created_at).toLocaleDateString()}`;
}

export function DataDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("datasets");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    const endpoint = getEndpoint(activeTab);
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`${DJANGO_API_BASE}${endpoint}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isOpen, activeTab, user]);

  // Reset data when tab changes so stale items don't flash
  useEffect(() => {
    setData([]);
  }, [activeTab]);

  const handleDelete = async (id: number | string) => {
    if (!window.confirm("Delete this item? This cannot be undone.")) return;
    try {
      if (activeTab === "checkpoints") {
        // First delete from Django DB to keep UI in sync
        const resDb = await fetchWithAuth(`${DJANGO_API_BASE}/checkpoints/${id}/`, { method: "DELETE" });
        if (resDb.ok || resDb.status === 204) {
          setData((prev) => prev.filter((item) => item.id !== id));
          toast.success("Deleted successfully");
          
          // Then delete from FastAPI (the actual .pt file)
          // Find the filename from the data array
          const item = data.find((i) => i.id === id);
          if (item && item.filename) {
            await fetchWithAuth(`http://127.0.0.1:52628/api/nn/checkpoint`, { 
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename: item.filename })
            }).catch(() => console.error("Failed to delete .pt file from disk"));
          }
        } else {
          toast.error("Failed to delete checkpoint");
        }
      } else {
        const endpoint = getEndpoint(activeTab);
        const res = await fetchWithAuth(`${DJANGO_API_BASE}${endpoint}${id}/`, { method: "DELETE" });
        if (res.ok || res.status === 204) {
          setData((prev) => prev.filter((item) => item.id !== id));
          toast.success("Deleted successfully");
        } else {
          toast.error("Failed to delete");
        }
      }
    } catch {
      toast.error("Error deleting item");
    }
  };

  const handleLoad = async (item: any) => {
    if (activeTab === "pipelines") {
      setLoadingItemId(item.id);
      try {
        const res = await fetchWithAuth(`${DJANGO_API_BASE}/pipelines/${item.id}/`);
        if (!res.ok) { toast.error("Failed to load pipeline"); return; }
        const full = await res.json();
        loadPipeline({ id: full.id, name: full.name, nodes: full.nodes ?? [], edges: full.edges ?? [] });
        agentSwitchView("pipeline");
        onClose();
        toast.success(`Loaded pipeline: ${full.name}`);
      } catch {
        toast.error("Error loading pipeline");
      } finally {
        setLoadingItemId(null);
      }
    } else if (activeTab === "architectures") {
      setLoadingItemId(item.id);
      try {
        const res = await fetchWithAuth(`${DJANGO_API_BASE}/architectures/${item.id}/`);
        if (!res.ok) { toast.error("Failed to load architecture"); return; }
        const full = await res.json();
        loadArchitecture({ id: full.id, name: full.name, config: full.config ?? { inputShape: [1, 784], nodes: [], edges: [] } });
        agentSwitchView("neural");
        onClose();
        toast.success(`Loaded architecture: ${full.name}`);
      } catch {
        toast.error("Error loading architecture");
      } finally {
        setLoadingItemId(null);
      }
    } else if (activeTab === "datasets") {
      agentSwitchView("data");
      onClose();
      toast.info("Switch to Data tab to upload or manage datasets");
    } else if (activeTab === "checkpoints") {
      setLoadingItemId(item.id);
      try {
        // The backend expects just the filename, not the full path
        const filename = item.file_path.split(/[/\\]/).pop();
        const res = await fetchWithAuth(`http://127.0.0.1:52628/api/nn/checkpoint/load`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename })
        });
        if (!res.ok) { 
          const err = await res.json().catch(()=>({}));
          toast.error(err.detail || "Failed to load checkpoint in backend"); 
          return; 
        }
        
        import("@/lib/agent-events").then(ev => {
          ev.agentNNCheckpointLoaded();
          ev.agentSwitchView("neural");
        });
        
        onClose();
        toast.success(`Loaded model checkpoint: ${item.name}`);
      } catch {
        toast.error("Error loading checkpoint");
      } finally {
        setLoadingItemId(null);
      }
    } else if (activeTab === "solutions") {
      setLoadingItemId(item.id);
      try {
        const res = await fetchWithAuth(`${DJANGO_API_BASE}/inverse-design-solutions/${item.id}/`);
        if (!res.ok) { toast.error("Failed to load solution"); return; }
        const full = await res.json();
        
        import("@/lib/agent-events").then(ev => {
          ev.agentNNSolutionLoaded(full.solution_data);
          ev.agentSwitchView("neural");
        });
        
        onClose();
        toast.success(`Loaded inverse design solution: ${full.name}`);
      } catch {
        toast.error("Error loading solution");
      } finally {
        setLoadingItemId(null);
      }
    } else if (activeTab === "dashboards") {
      setLoadingItemId(item.id);
      try {
        const res = await fetchWithAuth(`${DJANGO_API_BASE}/dashboards/${item.id}/`);
        if (!res.ok) { toast.error("Failed to load dashboard"); return; }
        const full = await res.json();
        // Dispatch event so DashboardBuilderView can pick it up
        window.dispatchEvent(new CustomEvent("dashboard:load", { detail: full }));
        agentSwitchView("dashboard");
        onClose();
        toast.success(`Loaded dashboard: ${full.name}`);
      } catch {
        toast.error("Error loading dashboard");
      } finally {
        setLoadingItemId(null);
      }
    }
    // checkpoints and solutions: no load action yet
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[200] backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-96 bg-[#161b22] border-l border-white/10 shadow-2xl z-[210] flex flex-col transform transition-transform duration-300">

        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0d1117]">
          <h2 className="text-white font-bold text-lg">My Saved Data</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#0d1117] overflow-x-auto">
          {TAB_CONFIG.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              className="flex-1 min-w-[64px] py-3 text-xs font-semibold flex flex-col items-center gap-1 transition-colors shrink-0"
              style={
                activeTab === key
                  ? { color, borderBottom: `2px solid ${color}` }
                  : { color: "rgba(255,255,255,0.4)", borderBottom: "2px solid transparent" }
              }
              onClick={() => setActiveTab(key)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {!user ? (
            <p className="text-white/50 text-center text-sm mt-10">Sign in to view your saved data.</p>
          ) : loading ? (
            <div className="flex justify-center mt-10">
              <Loader2 className="animate-spin text-[#00f0ff]" size={24} />
            </div>
          ) : data.length === 0 ? (
            <p className="text-white/40 text-center text-sm mt-10">No {activeTab} saved yet.</p>
          ) : (
            data.map((item, idx) => (
              <div
                key={item.id ?? idx}
                className="bg-[#0d1117] border border-white/5 p-3 rounded-lg hover:border-white/20 transition-colors group cursor-pointer flex items-start gap-2"
                onClick={() => handleLoad(item)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white/90 text-sm mb-1 truncate">{item.name}</div>
                  <div className="text-white/40 text-xs truncate">{formatSubtitle(item, activeTab)}</div>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(activeTab === "pipelines" || activeTab === "architectures" || activeTab === "dashboards" || activeTab === "checkpoints" || activeTab === "solutions") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLoad(item); }}
                      className="text-white/30 hover:text-[#00f0ff] p-1 rounded transition-colors"
                      title="Load"
                      disabled={loadingItemId === item.id}
                    >
                      {loadingItemId === item.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <FolderOpen size={14} />
                      }
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    className="text-white/30 hover:text-red-400 p-1 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
