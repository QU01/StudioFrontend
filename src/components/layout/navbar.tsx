"use client";

import { useState, useEffect } from "react";
import { LogOut, MessageCircle, Cpu, Bell, Brain, BarChart2, Zap, CheckCircle2, Database } from "lucide-react";
import { fetchSystemInfo, type SystemInfo } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthContext";
import Link from "next/link";
import { DataDrawer } from "./DataDrawer";

interface NavbarProps {
  onToggleSidebar?: () => void;
}

const notifications = [
  {
    icon: <Brain size={15} />,
    title: "Model training complete",
    sub: "Titanic · 94.2% accuracy",
    time: "2m ago",
    dotBg: "var(--electric)",
    glow: "var(--glow-electric)",
  },
  {
    icon: <BarChart2 size={15} />,
    title: "Dataset profiled",
    sub: "iris.csv · 150 rows",
    time: "15m ago",
    dotBg: "var(--cyan)",
    glow: "none",
  },
  {
    icon: <Zap size={15} />,
    title: "GPU memory warning",
    sub: "RTX 3080 · 89% usage",
    time: "1h ago",
    dotBg: "var(--warning)",
    glow: "none",
  },
  {
    icon: <CheckCircle2 size={15} />,
    title: "Pipeline executed",
    sub: "4 nodes · 0 errors",
    time: "2h ago",
    dotBg: "var(--success)",
    glow: "none",
  },
];

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const { user, logoutUser } = useAuth();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [isDataDrawerOpen, setDataDrawerOpen] = useState(false);

  const toggle = (key: string) =>
    setOpenDropdown((prev) => (prev === key ? null : key));

  useEffect(() => {
    fetchSystemInfo().then(setSys).catch(() => {});
    const id = setInterval(() => fetchSystemInfo().then(setSys).catch(() => {}), 5000);
    return () => clearInterval(id);
  }, []);

  const vramPct = sys?.gpu_available && sys.gpu_memory_total_mb
    ? Math.round(((sys.gpu_memory_used_mb ?? 0) / sys.gpu_memory_total_mb) * 100)
    : 0;

  const hwStats = sys ? [
    sys.gpu_available
      ? { label: `GPU — ${sys.gpu_name ?? "CUDA"}`, value: sys.gpu_utilization_pct ?? 0, color: "var(--electric)", sub: null }
      : { label: "GPU — Not Available", value: 0, color: "var(--electric)", sub: null },
    sys.gpu_available && sys.gpu_memory_total_mb
      ? {
          label: `VRAM ${(sys.gpu_memory_total_mb / 1024).toFixed(0)} GB`,
          value: vramPct,
          color: "var(--cyan)",
          sub: `${(sys.gpu_memory_used_mb! / 1024).toFixed(1)} / ${(sys.gpu_memory_total_mb / 1024).toFixed(1)} GB`,
        }
      : null,
    { label: `CPU${sys.cpu_count ? ` (${sys.cpu_count}c)` : ""}`, value: Math.round(sys.cpu_percent ?? 0), color: "var(--magenta)", sub: null },
    {
      label: `RAM${sys.ram_total_gb ? ` ${sys.ram_total_gb} GB` : ""}`,
      value: Math.round(sys.ram_percent ?? 0),
      color: "var(--warning)",
      sub: sys.ram_used_gb != null && sys.ram_total_gb != null
        ? `${sys.ram_used_gb} / ${sys.ram_total_gb} GB`
        : null,
    },
  ].filter(Boolean) as { label: string; value: number; color: string; sub: string | null }[]
  : [
    { label: "GPU", value: 0, color: "var(--electric)", sub: null },
    { label: "CPU", value: 0, color: "var(--magenta)", sub: null },
    { label: "RAM", value: 0, color: "var(--warning)", sub: null },
  ];

  const dropdownBase: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    zIndex: 50,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  };

  return (
    <>
      <nav
        className="w-full h-full flex relative"
        style={{ background: 'var(--surface-0)' }}
      >
        {/* Electric gradient line at the bottom */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: '2px',
            background: 'linear-gradient(to right, var(--electric-dim), var(--electric), var(--cyan), var(--electric), var(--electric-dim))',
          }}
        />

        <div className="w-full h-full flex items-center justify-between pr-4">

          {/* ── Left ── */}
          <div className="flex items-center h-full">

            {/* Hamburger */}
            <div className="h-full flex items-center justify-center w-[62px] mr-2">
              <button
                type="button"
                className="flex flex-col gap-[4px] w-full h-full justify-center items-center transition-all duration-200"
                style={{ color: 'var(--ink-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={onToggleSidebar}
                title="Toggle sidebar"
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--electric)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-dim)')}
              >
                <span className="w-5 h-[2px] bg-current rounded-full" />
                <span className="w-5 h-[2px] bg-current rounded-full" />
                <span className="w-5 h-[2px] bg-current rounded-full" />
              </button>
            </div>

            {/* Left icon nav */}
            <ul className="flex items-center m-0 p-0 list-none h-full relative z-50">

              {/* Notifications */}
              <li className="h-full flex items-center relative z-50">
                <button
                  className="px-4 py-4 cursor-pointer relative flex items-center transition-colors"
                  style={{ color: openDropdown === "notif" ? 'var(--ink-primary)' : 'var(--ink-dim)', background: 'none', border: 'none' }}
                  onClick={() => toggle("notif")}
                  title="Notifications"
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-primary)')}
                  onMouseLeave={e => { if (openDropdown !== "notif") e.currentTarget.style.color = 'var(--ink-dim)'; }}
                >
                  <Bell size={17} />
                  <span
                    className="absolute top-[14px] right-[10px] text-white text-[9px] font-bold px-[4px] py-[1px] leading-none rounded-2xl"
                    style={{
                      fontFamily: 'var(--quasar-font-mono)',
                      background: 'var(--electric)',
                      boxShadow: '0 0 8px rgba(58,160,255,0.7)',
                    }}
                  >
                    4
                  </span>
                </button>

                {openDropdown === "notif" && (
                  <div style={{ ...dropdownBase, width: '320px' }}>
                    <div
                      className="px-4 py-3 text-sm font-semibold"
                      style={{
                        fontFamily: 'var(--quasar-font-sans)',
                        color: 'var(--ink-primary)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--electric) 40%, var(--surface-2)), color-mix(in srgb, var(--electric) 80%, var(--surface-2)))',
                      }}
                    >
                      4 New Notifications
                    </div>
                    {notifications.map((n, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center text-white flex-shrink-0"
                          style={{ background: n.dotBg, boxShadow: n.glow }}
                        >
                          {n.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[13px] font-medium"
                            style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--ink-primary)' }}
                          >
                            {n.title}
                          </div>
                          <small
                            className="text-[11px]"
                            style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-muted)' }}
                          >
                            {n.sub}
                          </small>
                        </div>
                        <span
                          className="text-[10px] whitespace-nowrap"
                          style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-dim)' }}
                        >
                          {n.time}
                        </span>
                      </div>
                    ))}
                    <div className="text-center py-2">
                      <button
                        className="text-[12px] font-medium transition-colors"
                        style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--electric)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </li>

              {/* Hardware / GPU Status */}
              <li className="h-full flex items-center relative z-50">
                <button
                  className="px-4 py-4 cursor-pointer relative flex items-center transition-colors"
                  style={{ color: openDropdown === "gpu" ? 'var(--ink-primary)' : 'var(--ink-dim)', background: 'none', border: 'none' }}
                  onClick={() => toggle("gpu")}
                  title="Hardware Status"
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-primary)')}
                  onMouseLeave={e => { if (openDropdown !== "gpu") e.currentTarget.style.color = 'var(--ink-dim)'; }}
                >
                  <Cpu size={17} />
                  <span
                    className="absolute top-[14px] right-[10px] text-white text-[9px] font-bold px-[4px] py-[1px] leading-none rounded-2xl"
                    style={{
                      fontFamily: 'var(--quasar-font-mono)',
                      background: 'var(--success)',
                      boxShadow: '0 0 8px rgba(34,197,94,0.7)',
                    }}
                  >
                    {hwStats.length}
                  </span>
                </button>

                {openDropdown === "gpu" && (
                  <div style={{ ...dropdownBase, width: '260px', padding: '16px' }}>
                    <div className="flex items-center justify-between mb-4">
                      <p
                        className="text-[10px] uppercase"
                        style={{ fontFamily: 'var(--quasar-font-mono)', letterSpacing: '0.18em', color: 'var(--ink-dim)' }}
                      >
                        Hardware Status
                      </p>
                      {sys && (
                        <span
                          className="text-[9px]"
                          style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-dim)' }}
                        >
                          {sys.pytorch_version ? `PyTorch ${sys.pytorch_version}` : ""}
                          {sys.cuda_version ? ` · CUDA ${sys.cuda_version}` : ""}
                        </span>
                      )}
                    </div>
                    {hwStats.map((s) => (
                      <div key={s.label} className="mb-3 last:mb-0">
                        <div className="flex justify-between mb-0.5">
                          <span
                            className="text-[11px]"
                            style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-muted)' }}
                          >
                            {s.label}
                          </span>
                          <span
                            className="text-[11px] font-semibold"
                            style={{ fontFamily: 'var(--quasar-font-mono)', color: s.color }}
                          >
                            {s.value}%
                          </span>
                        </div>
                        {s.sub && (
                          <div
                            className="text-[10px] mb-1"
                            style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-dim)' }}
                          >
                            {s.sub}
                          </div>
                        )}
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{ background: 'var(--surface-3)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${s.value}%`, backgroundColor: s.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </li>

            </ul>
          </div>

          {/* ── Right ── */}
          <div className="flex items-center gap-1 h-full">

            {/* Saved Data */}
            <button
              className="px-3 py-4 h-full cursor-pointer flex items-center transition-colors"
              style={{ color: 'var(--ink-dim)', background: 'none', border: 'none' }}
              title="Saved Data"
              onClick={() => setDataDrawerOpen(true)}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--electric)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-dim)')}
            >
              <Database size={16} />
            </button>

            {/* Messages */}
            <button
              className="px-3 py-4 h-full cursor-pointer flex items-center relative transition-colors"
              style={{ color: 'var(--ink-dim)', background: 'none', border: 'none' }}
              title="Messages"
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--electric)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-dim)')}
            >
              <MessageCircle size={17} />
              <span
                className="absolute top-3 right-[6px] text-white text-[9px] font-bold px-[4px] py-[1px] leading-none rounded-2xl"
                style={{
                  fontFamily: 'var(--quasar-font-mono)',
                  background: 'var(--magenta)',
                  boxShadow: '0 0 8px rgba(226,62,192,0.6)',
                }}
              >
                2
              </span>
            </button>

            {user ? (
              <>
                <button
                  className="px-3 py-4 h-full cursor-pointer flex items-center transition-colors"
                  style={{ color: 'var(--ink-dim)', background: 'none', border: 'none' }}
                  title="Logout"
                  onClick={logoutUser}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-dim)')}
                >
                  <LogOut size={15} />
                </button>
                <button
                  className="pl-2 pr-0 py-4 h-full cursor-pointer flex items-center"
                  title={user.username}
                  style={{ background: 'none', border: 'none' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm uppercase"
                    style={{
                      fontFamily: 'var(--quasar-font-display)',
                      background: 'linear-gradient(135deg, var(--electric), var(--cyan-glow))',
                      color: '#0A0E14',
                      boxShadow: 'var(--glow-electric)',
                    }}
                  >
                    {user.username.charAt(0)}
                  </div>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm font-semibold px-4 py-1.5 ml-2 rounded transition-all block"
                style={{
                  fontFamily: 'var(--quasar-font-sans)',
                  color: 'var(--electric)',
                  border: '1px solid var(--electric)',
                  background: 'transparent',
                  boxShadow: 'var(--glow-subtle)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--electric)';
                  (e.currentTarget as HTMLElement).style.color = '#0A0E14';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--electric)';
                }}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      {openDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenDropdown(null)}
        />
      )}
      <DataDrawer isOpen={isDataDrawerOpen} onClose={() => setDataDrawerOpen(false)} />
    </>
  );
}
