"use client";

import { useEffect, useState } from "react";
import {
  Database, GitBranch, Brain, Cpu,
  TrendingUp, Clock, CheckCircle2, AlertTriangle,
  ArrowUpRight, MoreHorizontal,
  Activity, Zap, Server, BarChart2, Folder, Sparkles
} from "lucide-react";
import { fetchSystemInfo, fetchDashboardStats, type SystemInfo, type DashboardStats } from "@/lib/api";

/* ── Oculux styled Stat Card with original ML content ── */
function StatCard({ icon: Icon, label, value, sub, bgIcon }: any) {
  return (
    <div className="bg-[#222a35] rounded-xl p-5 flex items-center border border-white/5 relative overflow-hidden group transition-all hover:-translate-y-1">
      
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 z-10"
        style={{ backgroundColor: bgIcon, color: "white" }}
      >
        <Icon size={24} />
      </div>

      <div className="ml-5 flex-1 z-10 flex flex-col justify-center">
        <div className="text-white/60 text-[13px] font-medium mb-0.5">{label}</div>
        <div className="text-white text-[28px] font-bold tracking-normal leading-none mb-1">{value}</div>
        {sub && <div className="text-white/40 text-[11px] truncate">{sub}</div>}
      </div>

      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-5 bg-white pointer-events-none" />
    </div>
  );
}

/* ── Activity Item ── */
function ActivityItem({ icon, title, sub, time, statusColor, status }: any) {
  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
      <span
        className="w-8 h-8 rounded-md flex items-center justify-center text-sm"
        style={{ backgroundColor: statusColor, color: "white" }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white/90 font-medium truncate">{title}</p>
        <p className="text-[11px] text-white/50 truncate">{sub}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span
          className="rounded text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5"
          style={{ border: `1px solid ${statusColor}`, color: statusColor }}
        >
          {status}
        </span>
        <span className="text-[10px] text-white/30">{time}</span>
      </div>
    </div>
  );
}

/* ── Resource Bar ── */
function ResourceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] text-white/50">{label}</span>
        <span className="text-[11px] font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ── Quick Action ── */
function QuickAction({ icon: Icon, label, sub, color }: any) {
  return (
    <button className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-all group text-left">
      <div 
        className="w-8 h-8 rounded-md flex items-center justify-center group-hover:scale-110 transition-transform"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color: color }}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1">
        <p className="text-[13px] text-white/90 font-medium">{label}</p>
        <p className="text-[11px] text-white/40">{sub}</p>
      </div>
      <ArrowUpRight size={14} className="text-white/20 group-hover:text-white/60 transition-colors" />
    </button>
  );
}

/* ── Main Dashboard ── */
export function Dashboard() {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetchSystemInfo().then(setSysInfo).catch(() => {});
    fetchDashboardStats().then(setStats).catch(() => {});
    const interval = setInterval(() => {
      fetchSystemInfo().then(setSysInfo).catch(() => {});
      fetchDashboardStats().then(setStats).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const gpuLabel = sysInfo
    ? sysInfo.gpu_available
      ? sysInfo.gpu_name ?? "GPU"
      : "CPU Only"
    : "GPU";

  const gpuValue = sysInfo
    ? sysInfo.gpu_available && sysInfo.gpu_utilization_pct != null
      ? `${sysInfo.gpu_utilization_pct}%`
      : sysInfo.gpu_available
        ? "Active"
        : "N/A"
    : "—";

  const gpuSub = sysInfo?.gpu_available && sysInfo.gpu_memory_used_mb != null && sysInfo.gpu_memory_total_mb != null
    ? `${(sysInfo.gpu_memory_used_mb / 1024).toFixed(1)} / ${(sysInfo.gpu_memory_total_mb / 1024).toFixed(1)} GB VRAM`
    : sysInfo?.gpu_available === false
      ? "No CUDA GPU detected"
      : "Loading…";

  const cpuPct = sysInfo?.cpu_percent ?? 0;
  const ramPct = sysInfo?.ram_percent ?? 0;
  const vramPct = sysInfo?.gpu_available && sysInfo.gpu_memory_total_mb
    ? Math.round(((sysInfo.gpu_memory_used_mb ?? 0) / sysInfo.gpu_memory_total_mb) * 100)
    : 0;
  const gpuUtilPct = sysInfo?.gpu_utilization_pct ?? 0;

  return (
    <div className="min-h-full p-4 md:p-6 space-y-6 bg-[#181d23]">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-wide text-white/90">Dashboard</h1>
          <div className="text-[13px] text-white/50 mt-0.5">Welcome back — here's what's happening in your workspace.</div>
        </div>
        <button className="bg-[#007bff] hover:bg-[#0069d9] text-white text-[13px] font-medium px-4 py-2 rounded shadow-[0_2px_10px_rgba(0,123,255,0.4)] transition-all flex items-center gap-1.5 focus:outline-none">
          <Zap size={14} />
          New Project
        </button>
      </div>

      {/* ── Welcome splash (first-time empty state) ── */}
      {stats !== null && !stats.dataset && stats.models.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-3 animate-fade-in-up">
          <Sparkles size={36} className="mx-auto" style={{ color: "rgba(0,240,255,0.35)" }} />
          <h2 className="text-lg font-semibold text-white/80">Welcome to Quasar Studio</h2>
          <p className="text-sm text-white/40 max-w-md mx-auto">
            Load a dataset to get started, then build an ML pipeline or design a neural network.
          </p>
        </div>
      )}

      {/* ── Stat Cards (Restored from old) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          icon={Database}
          label="Dataset"
          value={stats?.dataset ? "1" : "0"}
          sub={stats?.dataset
            ? `${stats.dataset.filename} · ${stats.dataset.rows.toLocaleString()} rows · ${stats.dataset.columns} cols`
            : "No dataset loaded"}
          bgIcon="#007bff"
        />
        <StatCard
          icon={Brain}
          label="Trained Models"
          value={String(stats?.models.length ?? 0)}
          sub={(() => {
            if (!stats || stats.models.length === 0) return "No models trained";
            const best = stats.models[stats.models.length - 1];
            const metric = best.task === "classification"
              ? `${((best.accuracy ?? 0) * 100).toFixed(1)}% acc`
              : best.task === "regression"
                ? `R² ${best.r2?.toFixed(3) ?? "—"}`
                : `${best.n_clusters_found ?? "?"} clusters`;
            return `Last: ${best.algorithm?.replace(/_/g, " ")} · ${metric}`;
          })()}
          bgIcon="#17C2D7"
        />
        <StatCard
          icon={GitBranch}
          label="Pipeline Nodes"
          value={String(stats?.pipeline_nodes ?? 0)}
          sub={stats?.pipeline_success === true
            ? "All nodes succeeded"
            : stats?.pipeline_success === false
              ? "Some nodes failed"
              : "No pipeline executed"}
          bgIcon="#F39C12"
        />
        <StatCard
          icon={Cpu} label={gpuLabel} value={gpuValue} sub={gpuSub}
          bgIcon="#9367B4"
        />
      </div>

      {/* ── Middle row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Activity */}
        <div className="col-span-1 lg:col-span-2 bg-[#222a35] border border-white/5 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-white/5 text-[13px] font-semibold text-white/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[#007bff]" />
              Recent Activity
            </div>
            <button className="text-white/40 hover:text-white transition-colors">
               <MoreHorizontal size={16} />
            </button>
          </div>

          {(() => {
            const items: React.ReactNode[] = [];
            if (stats?.models && stats.models.length > 0) {
              [...stats.models].reverse().forEach((m, i) => {
                const metric = m.task === "classification"
                  ? `${((m.accuracy ?? 0) * 100).toFixed(1)}% accuracy`
                  : m.task === "regression"
                    ? `R² ${m.r2?.toFixed(3) ?? "—"}`
                    : `${m.n_clusters_found ?? "?"} clusters`;
                items.push(
                  <ActivityItem
                    key={`model-${i}`}
                    icon={<Brain size={16} />}
                    title="Model training complete"
                    sub={`${m.algorithm?.replace(/_/g, " ")} · ${metric}`}
                    time="This session"
                    statusColor="#9367B4"
                    status="Done"
                  />
                );
              });
            }
            if (stats?.dataset) {
              items.push(
                <ActivityItem
                  key="dataset"
                  icon={<BarChart2 size={16} />}
                  title="Dataset loaded"
                  sub={`${stats.dataset.filename} · ${stats.dataset.rows.toLocaleString()} rows · ${stats.dataset.columns} cols`}
                  time="This session"
                  statusColor="#17C2D7"
                  status="Ready"
                />
              );
            }
            if (items.length === 0) {
              return (
                <div className="px-5 py-8 text-center text-white/30 text-[13px]">
                  No activity yet — load a dataset or run a pipeline.
                </div>
              );
            }
            return items;
          })()}
          <div className="px-5 py-3 text-center bg-white/5">
             <button className="text-[12px] font-medium text-[#007bff] hover:text-[#0056b3]">View all activity</button>
          </div>
        </div>

        {/* Right column: Resources + Quick Actions */}
        <div className="col-span-1 flex flex-col gap-6">

          {/* System Resources */}
          <div className="bg-[#222a35] border border-white/5 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2 text-[13px] font-semibold text-white/80">
                 <Server size={16} className="text-[#17C2D7]" />
                 System Resources
               </div>
               <div className="w-2 h-2 rounded-full bg-[#28a745] shadow-[0_0_8px_rgba(40,167,69,0.8)] animate-pulse" />
            </div>
            <div className="pt-2">
              {sysInfo?.gpu_available ? (
                <>
                  <ResourceBar label={`GPU — ${sysInfo.gpu_name ?? "CUDA"}`} value={gpuUtilPct} color="#007bff" />
                  <ResourceBar label={`VRAM ${sysInfo.gpu_memory_total_mb ? (sysInfo.gpu_memory_total_mb / 1024).toFixed(0) + " GB" : ""}`} value={vramPct} color="#17C2D7" />
                </>
              ) : (
                <ResourceBar label="GPU — Not Available" value={0} color="#007bff" />
              )}
              <ResourceBar label={`CPU${sysInfo?.cpu_count ? ` (${sysInfo.cpu_count} cores)` : ""}`} value={cpuPct} color="#9367B4" />
              <ResourceBar label={`RAM${sysInfo?.ram_total_gb ? ` ${sysInfo.ram_total_gb} GB` : ""}`} value={ramPct} color="#F39C12" />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#222a35] border border-white/5 rounded-xl p-4 shadow-sm flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3 px-1">Quick Actions</p>
            <div className="space-y-1">
              <QuickAction icon={Database} label="Import Dataset" sub="CSV or XLSX" color="#007bff" />
              <QuickAction icon={GitBranch} label="New Pipeline" sub="Visual editor" color="#17C2D7" />
              <QuickAction icon={Brain} label="Train Model" sub="AutoML or custom" color="#9367B4" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: Model Leaderboard (Restored and Oculux-ified) ── */}
      <div className="bg-[#222a35] border border-white/5 rounded-xl overflow-hidden shadow-sm">
        
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-2 text-[13px] font-semibold text-white/80">
             <TrendingUp size={16} className="text-[#007bff]" />
             Model Leaderboard
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[11px] text-white/40 uppercase tracking-wider bg-white/5">
                <th className="px-5 py-3 font-semibold">Model</th>
                <th className="px-5 py-3 font-semibold">Dataset</th>
                <th className="px-5 py-3 font-semibold">Algorithm</th>
                <th className="px-5 py-3 font-semibold">Accuracy</th>
                <th className="px-5 py-3 font-semibold">F1 Score</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Trained</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-white/80">
              {!stats || stats.models.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-white/30 text-[13px]">
                    No models trained yet — run a pipeline with a Train Model or Cluster Model node.
                  </td>
                </tr>
              ) : stats.models.map((m, i) => {
                const accValue = m.task === "classification"
                  ? m.accuracy != null ? (m.accuracy * 100).toFixed(1) + "%" : "—"
                  : m.task === "regression"
                    ? m.r2 != null ? "R² " + m.r2.toFixed(3) : "—"
                    : m.n_clusters_found != null ? m.n_clusters_found + " clusters" : "—";
                const accPct = m.task === "classification"
                  ? (m.accuracy ?? 0) * 100
                  : m.task === "regression"
                    ? Math.max(0, (m.r2 ?? 0)) * 100
                    : 50;
                const f1Display = m.f1 != null ? m.f1.toFixed(3) : m.silhouette != null ? m.silhouette.toFixed(3) : "—";
                return (
                  <tr key={m.node_id} className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-0">
                    <td className="px-5 py-3">
                      <span className="font-mono text-[#17C2D7]">{m.node_id}</span>
                    </td>
                    <td className="px-5 py-3 text-white/60">{stats.dataset?.filename ?? "—"}</td>
                    <td className="px-5 py-3 text-white/60">{m.algorithm?.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#17C2D7]" style={{ width: `${accPct}%` }} />
                        </div>
                        <span className="font-semibold">{accValue}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-white/60 font-mono">{f1Display}</td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase border"
                        style={{ color: "#9367B4", borderColor: "#9367B4" }}
                      >
                        <CheckCircle2 size={10} className="mr-1" />
                        Ready
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[11px] text-white/40">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="opacity-70" /> This session
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
