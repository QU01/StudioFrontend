"use client";

import { useEffect, useState } from "react";
import {
  Database, GitBranch, Brain, Cpu,
  TrendingUp, Clock, CheckCircle2,
  ArrowUpRight, MoreHorizontal,
  Activity, Server, BarChart2, Sparkles, Zap,
} from "lucide-react";
import { fetchSystemInfo, fetchDashboardStats, type SystemInfo, type DashboardStats } from "@/lib/api";

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, sub, accentColor }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accentColor: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-center relative overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--surface-3)',
      }}
    >
      <div
        className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0 z-10"
        style={{ background: `color-mix(in srgb, ${accentColor} 18%, var(--surface-3))`, color: accentColor }}
      >
        <Icon size={22} />
      </div>

      <div className="ml-4 flex-1 z-10 flex flex-col justify-center min-w-0">
        <div
          className="text-[11px] uppercase mb-1"
          style={{ fontFamily: 'var(--quasar-font-mono)', letterSpacing: '0.15em', color: 'var(--ink-dim)' }}
        >
          {label}
        </div>
        <div
          className="text-[26px] font-bold leading-none mb-1"
          style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-primary)' }}
        >
          {value}
        </div>
        {sub && (
          <div
            className="text-[11px] truncate"
            style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-dim)' }}
          >
            {sub}
          </div>
        )}
      </div>

      {/* Subtle accent glow in corner */}
      <div
        className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}18, transparent 70%)` }}
      />
    </div>
  );
}

/* ── Activity Item ── */
function ActivityItem({ icon, title, sub, time, accentColor, status }: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  time: string;
  accentColor: string;
  status: string;
}) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-3 transition-colors"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        className="w-8 h-8 rounded flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${accentColor} 20%, var(--surface-3))`, color: accentColor }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium truncate"
          style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--ink-primary)' }}
        >
          {title}
        </p>
        <p
          className="text-[11px] truncate"
          style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-muted)' }}
        >
          {sub}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span
          className="rounded text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5"
          style={{ fontFamily: 'var(--quasar-font-mono)', border: `1px solid ${accentColor}`, color: accentColor }}
        >
          {status}
        </span>
        <span
          className="text-[10px]"
          style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-dim)' }}
        >
          {time}
        </span>
      </div>
    </div>
  );
}

/* ── Resource Bar ── */
function ResourceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span
          className="text-[11px]"
          style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-muted)' }}
        >
          {label}
        </span>
        <span
          className="text-[11px] font-semibold"
          style={{ fontFamily: 'var(--quasar-font-mono)', color }}
        >
          {value}%
        </span>
      </div>
      <div
        className="w-full h-1 rounded-full overflow-hidden"
        style={{ background: 'var(--surface-3)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ── Quick Action ── */
function QuickAction({ icon: Icon, label, sub, color }: {
  icon: React.ElementType;
  label: string;
  sub: string;
  color: string;
}) {
  return (
    <button
      className="w-full flex items-center gap-3 p-2.5 rounded-lg transition-all group text-left"
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <div
        className="w-8 h-8 rounded flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ background: `color-mix(in srgb, ${color} 18%, var(--surface-3))`, color }}
      >
        <Icon size={15} />
      </div>
      <div className="flex-1">
        <p
          className="text-[13px] font-medium"
          style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--ink-primary)' }}
        >
          {label}
        </p>
        <p
          className="text-[11px]"
          style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-dim)' }}
        >
          {sub}
        </p>
      </div>
      <ArrowUpRight
        size={14}
        className="transition-colors"
        style={{ color: 'var(--ink-dim)' }}
      />
    </button>
  );
}

/* ── Section Card wrapper ── */
function SectionCard({ title, icon: Icon, iconColor, action, children }: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-3)' }}
    >
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-2">
          <Icon size={15} style={{ color: iconColor }} />
          <span
            className="text-[13px] font-semibold"
            style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--ink-primary)' }}
          >
            {title}
          </span>
        </div>
        {action}
      </div>
      {children}
    </div>
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
    ? sysInfo.gpu_available ? sysInfo.gpu_name ?? "GPU" : "CPU Only"
    : "GPU";

  const gpuValue = sysInfo
    ? sysInfo.gpu_available && sysInfo.gpu_utilization_pct != null
      ? `${sysInfo.gpu_utilization_pct}%`
      : sysInfo.gpu_available ? "Active" : "N/A"
    : "—";

  const gpuSub = sysInfo?.gpu_available && sysInfo.gpu_memory_used_mb != null && sysInfo.gpu_memory_total_mb != null
    ? `${(sysInfo.gpu_memory_used_mb / 1024).toFixed(1)} / ${(sysInfo.gpu_memory_total_mb / 1024).toFixed(1)} GB VRAM`
    : sysInfo?.gpu_available === false ? "No CUDA GPU detected" : "Loading…";

  const cpuPct = sysInfo?.cpu_percent ?? 0;
  const ramPct = sysInfo?.ram_percent ?? 0;
  const vramPct = sysInfo?.gpu_available && sysInfo.gpu_memory_total_mb
    ? Math.round(((sysInfo.gpu_memory_used_mb ?? 0) / sysInfo.gpu_memory_total_mb) * 100)
    : 0;
  const gpuUtilPct = sysInfo?.gpu_utilization_pct ?? 0;

  return (
    <div
      className="min-h-full p-4 md:p-6 space-y-5 animate-fade-in-up"
      style={{ background: 'var(--surface-1)' }}
    >

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 mb-2">
        <div>
          <h1
            className="leading-none mb-1"
            style={{
              fontFamily: 'var(--quasar-font-display)',
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--ink-primary)',
            }}
          >
            Dashboard
          </h1>
          <div
            className="text-[13px]"
            style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--ink-muted)' }}
          >
            Welcome back — here's what's happening in your workspace.
          </div>
        </div>
        <button
          className="text-[13px] font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all focus:outline-none"
          style={{
            fontFamily: 'var(--quasar-font-sans)',
            background: 'var(--electric)',
            color: '#0A0E14',
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--glow-electric)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--electric-bright)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--electric)')}
        >
          <Zap size={13} />
          New Project
        </button>
      </div>

      {/* ── Welcome splash (empty state) ── */}
      {stats !== null && !stats.dataset && stats.models.length === 0 && (
        <div
          className="rounded-xl p-8 text-center space-y-3 animate-fade-in-up"
          style={{ border: '1px solid var(--surface-3)', background: 'rgba(58,160,255,0.03)' }}
        >
          <Sparkles
            size={34}
            className="mx-auto"
            style={{ color: 'var(--electric-dim)' }}
          />
          <h2
            style={{
              fontFamily: 'var(--quasar-font-display)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--ink-primary)',
            }}
          >
            Welcome to Quasar Studio
          </h2>
          <p
            className="text-sm max-w-md mx-auto"
            style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--ink-muted)' }}
          >
            Load a dataset to get started, then build an ML pipeline or design a neural network.
          </p>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Database}
          label="Dataset"
          value={stats?.dataset ? "1" : "0"}
          sub={stats?.dataset
            ? `${stats.dataset.filename} · ${stats.dataset.rows.toLocaleString()} rows · ${stats.dataset.columns} cols`
            : "No dataset loaded"}
          accentColor="var(--electric)"
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
          accentColor="var(--cyan)"
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
          accentColor="var(--warning)"
        />
        <StatCard
          icon={Cpu}
          label={gpuLabel}
          value={gpuValue}
          sub={gpuSub}
          accentColor="var(--magenta)"
        />
      </div>

      {/* ── Middle row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Activity */}
        <div className="col-span-1 lg:col-span-2">
          <SectionCard
            title="Recent Activity"
            icon={Activity}
            iconColor="var(--electric)"
            action={
              <button
                style={{ color: 'var(--ink-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-dim)')}
              >
                <MoreHorizontal size={15} />
              </button>
            }
          >
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
                      icon={<Brain size={15} />}
                      title="Model training complete"
                      sub={`${m.algorithm?.replace(/_/g, " ")} · ${metric}`}
                      time="This session"
                      accentColor="var(--magenta)"
                      status="Done"
                    />
                  );
                });
              }
              if (stats?.dataset) {
                items.push(
                  <ActivityItem
                    key="dataset"
                    icon={<BarChart2 size={15} />}
                    title="Dataset loaded"
                    sub={`${stats.dataset.filename} · ${stats.dataset.rows.toLocaleString()} rows · ${stats.dataset.columns} cols`}
                    time="This session"
                    accentColor="var(--cyan)"
                    status="Ready"
                  />
                );
              }
              if (items.length === 0) {
                return (
                  <div
                    className="px-5 py-8 text-center text-[13px]"
                    style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--ink-dim)' }}
                  >
                    No activity yet — load a dataset or run a pipeline.
                  </div>
                );
              }
              return items;
            })()}
            <div
              className="px-5 py-3 text-center"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <button
                className="text-[12px] font-medium transition-colors"
                style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--electric)', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--electric-bright)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--electric)')}
              >
                View all activity
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="col-span-1 flex flex-col gap-5">

          {/* System Resources */}
          <SectionCard
            title="System Resources"
            icon={Server}
            iconColor="var(--cyan)"
            action={
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'var(--success)', boxShadow: '0 0 8px rgba(34,197,94,0.8)' }}
              />
            }
          >
            <div className="p-5">
              {sysInfo?.gpu_available ? (
                <>
                  <ResourceBar label={`GPU — ${sysInfo.gpu_name ?? "CUDA"}`} value={gpuUtilPct} color="var(--electric)" />
                  <ResourceBar
                    label={`VRAM ${sysInfo.gpu_memory_total_mb ? (sysInfo.gpu_memory_total_mb / 1024).toFixed(0) + " GB" : ""}`}
                    value={vramPct}
                    color="var(--cyan)"
                  />
                </>
              ) : (
                <ResourceBar label="GPU — Not Available" value={0} color="var(--electric)" />
              )}
              <ResourceBar
                label={`CPU${sysInfo?.cpu_count ? ` (${sysInfo.cpu_count} cores)` : ""}`}
                value={cpuPct}
                color="var(--magenta)"
              />
              <ResourceBar
                label={`RAM${sysInfo?.ram_total_gb ? ` ${sysInfo.ram_total_gb} GB` : ""}`}
                value={ramPct}
                color="var(--warning)"
              />
            </div>
          </SectionCard>

          {/* Quick Actions */}
          <SectionCard
            title="Quick Actions"
            icon={Zap}
            iconColor="var(--electric)"
          >
            <div className="p-3 space-y-1">
              <QuickAction icon={Database}  label="Import Dataset" sub="CSV or XLSX"        color="var(--electric)" />
              <QuickAction icon={GitBranch} label="New Pipeline"   sub="Visual editor"      color="var(--cyan)" />
              <QuickAction icon={Brain}     label="Train Model"    sub="AutoML or custom"   color="var(--magenta)" />
            </div>
          </SectionCard>

        </div>
      </div>

      {/* ── Model Leaderboard ── */}
      <SectionCard
        title="Model Leaderboard"
        icon={TrendingUp}
        iconColor="var(--electric)"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface-3)' }}>
                {["Model", "Dataset", "Algorithm", "Accuracy", "F1 Score", "Status", "Trained"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3"
                    style={{ fontFamily: 'var(--quasar-font-mono)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-dim)', fontWeight: 500 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!stats || stats.models.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-[13px]"
                    style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--ink-dim)' }}
                  >
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
                  <tr
                    key={m.node_id}
                    className="transition-colors last:border-0"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-5 py-3">
                      <span style={{ fontFamily: 'var(--quasar-font-mono)', fontSize: '13px', color: 'var(--cyan)' }}>
                        {m.node_id}
                      </span>
                    </td>
                    <td className="px-5 py-3" style={{ fontFamily: 'var(--quasar-font-sans)', fontSize: '13px', color: 'var(--ink-muted)' }}>
                      {stats.dataset?.filename ?? "—"}
                    </td>
                    <td className="px-5 py-3" style={{ fontFamily: 'var(--quasar-font-sans)', fontSize: '13px', color: 'var(--ink-muted)' }}>
                      {m.algorithm?.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-12 h-1 rounded-full overflow-hidden"
                          style={{ background: 'var(--surface-3)' }}
                        >
                          <div
                            className="h-full"
                            style={{ width: `${accPct}%`, background: 'var(--cyan)' }}
                          />
                        </div>
                        <span style={{ fontFamily: 'var(--quasar-font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                          {accValue}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3" style={{ fontFamily: 'var(--quasar-font-mono)', fontSize: '13px', color: 'var(--ink-muted)' }}>
                      {f1Display}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase"
                        style={{
                          fontFamily: 'var(--quasar-font-mono)',
                          color: 'var(--success)',
                          border: '1px solid var(--success)',
                        }}
                      >
                        <CheckCircle2 size={10} className="mr-1" />
                        Ready
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div
                        className="flex items-center gap-1.5 text-[11px]"
                        style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-dim)' }}
                      >
                        <Clock size={11} className="opacity-70" /> This session
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

    </div>
  );
}
