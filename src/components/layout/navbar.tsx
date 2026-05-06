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
  { icon: <Brain size={16} />, title: "Model training complete", sub: "Titanic · 94.2% accuracy", time: "2m ago",  dotClass: "bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" },
  { icon: <BarChart2 size={16} />, title: "Dataset profiled",         sub: "iris.csv · 150 rows",       time: "15m ago", dotClass: "bg-[#17C2D7]" },
  { icon: <Zap size={16} />, title: "GPU memory warning",       sub: "RTX 3080 · 89% usage",      time: "1h ago",  dotClass: "bg-[#F39C12]" },
  { icon: <CheckCircle2 size={16} />, title: "Pipeline executed",         sub: "4 nodes · 0 errors",        time: "2h ago",  dotClass: "bg-[#28a745]" },
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
      ? { label: `GPU — ${sys.gpu_name ?? "CUDA"}`, value: sys.gpu_utilization_pct ?? 0, color: "#00f0ff", sub: null }
      : { label: "GPU — Not Available", value: 0, color: "#00f0ff", sub: null },
    sys.gpu_available && sys.gpu_memory_total_mb
      ? { label: `VRAM ${(sys.gpu_memory_total_mb / 1024).toFixed(0)} GB`, value: vramPct, color: "#17C2D7", sub: `${(sys.gpu_memory_used_mb! / 1024).toFixed(1)} / ${(sys.gpu_memory_total_mb / 1024).toFixed(1)} GB used` }
      : null,
    { label: `CPU${sys.cpu_count ? ` (${sys.cpu_count} cores)` : ""}`, value: Math.round(sys.cpu_percent ?? 0), color: "#9367B4", sub: null },
    { label: `RAM${sys.ram_total_gb ? ` ${sys.ram_total_gb} GB` : ""}`, value: Math.round(sys.ram_percent ?? 0), color: "#F39C12", sub: sys.ram_used_gb != null && sys.ram_total_gb != null ? `${sys.ram_used_gb} / ${sys.ram_total_gb} GB used` : null },
  ].filter(Boolean) as { label: string; value: number; color: string; sub: string | null }[] : [
    { label: "GPU", value: 0, color: "#00f0ff", sub: null },
    { label: "CPU", value: 0, color: "#9367B4", sub: null },
    { label: "RAM", value: 0, color: "#F39C12", sub: null },
  ];

  return (
    <>
      <nav className="bg-[#191f28] border-b border-white/5 w-full h-full flex">
        <div className="w-full h-full flex items-center justify-between pr-4">

          {/* ── navbar-left ── */}
          <div className="flex items-center h-full">

            {/* Hamburger (Matches the dark box aesthetic) */}
            <div className="h-full flex items-center justify-center w-[62px] bg-[#11161d] border-r border-black/50 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)] mr-2 transition-colors hover:bg-[#161c24]">
              <button
                type="button"
                className="text-white/50 hover:text-[#00f0ff] flex flex-col gap-[3px] w-full h-full justify-center items-center transition-all duration-300"
                onClick={onToggleSidebar}
                title="Toggle sidebar"
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
                <span
                  className={`px-4 py-4 cursor-pointer relative flex items-center transition-colors ${openDropdown === "notif" ? "text-white" : "text-white/50 hover:text-[#00f0ff]"}`}
                  onClick={() => toggle("notif")}
                  title="Notifications"
                >
                  <Bell size={18} />
                  <span className="absolute top-[14px] right-[10px] bg-[#007bff] text-white text-[9px] font-bold px-[4px] py-[1px] leading-none rounded-2xl shadow-[0_0_8px_rgba(0,123,255,0.8)]">4</span>
                </span>

                {openDropdown === "notif" && (
                  <div className="absolute top-full left-0 bg-[#222a35] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-md w-80 overflow-hidden z-50">
                    <div className="bg-[#007bff] text-white font-semibold text-sm px-4 py-3 border-b border-white/10">
                      You have 4 New Notifications
                    </div>
                    {notifications.map((n, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-white/10 hover:bg-white/5 cursor-pointer">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center text-sm ${n.dotClass} text-white`}>
                          {n.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white">{n.title}</div>
                          <small className="text-xs text-white/50">{n.sub}</small>
                        </div>
                        <span className="text-[10px] text-white/40 whitespace-nowrap">{n.time}</span>
                      </div>
                    ))}
                    <div className="text-center py-2">
                       <a href="#" className="text-xs font-medium text-[#007bff] hover:text-blue-300">View all notifications</a>
                    </div>
                  </div>
                )}
              </li>

              {/* Hardware / GPU Status */}
              <li className="h-full flex items-center relative z-50">
                <span
                  className={`px-4 py-4 cursor-pointer relative flex items-center transition-colors ${openDropdown === "gpu" ? "text-white" : "text-white/50 hover:text-[#00f0ff]"}`}
                  onClick={() => toggle("gpu")}
                  title="Hardware Status"
                >
                  <Cpu size={18} />
                  <span className="absolute top-[14px] right-[10px] bg-[#28a745] text-white text-[9px] font-bold px-[4px] py-[1px] leading-none rounded-2xl shadow-[0_0_8px_rgba(40,167,69,0.8)]">4</span>
                </span>

                {openDropdown === "gpu" && (
                  <div className="absolute top-full left-0 bg-[#222a35] border border-white/10 shadow-lg rounded-md w-64 overflow-hidden z-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                        Hardware Status
                      </p>
                      {sys && (
                        <span className="text-[9px] text-white/25">
                          {sys.pytorch_version ? `PyTorch ${sys.pytorch_version}` : ""}
                          {sys.cuda_version ? ` · CUDA ${sys.cuda_version}` : ""}
                        </span>
                      )}
                    </div>
                    {hwStats.map((s) => (
                      <div key={s.label} className="mb-3 last:mb-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[11px] text-white/50">{s.label}</span>
                          <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.value}%</span>
                        </div>
                        {s.sub && (
                          <div className="text-[10px] text-white/30 mb-1">{s.sub}</div>
                        )}
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </li>

              {/* Mega, Social */}
              <li className="hidden sm:flex items-center h-full xl:ml-2">
                <span className="text-white/50 hover:text-white px-3 py-4 cursor-pointer text-[13px] font-medium tracking-wide">
                  Mega
                </span>
                <span className="text-white/50 hover:text-white px-3 py-4 cursor-pointer text-[13px] font-medium tracking-wide">
                  Social
                </span>
              </li>

            </ul>
          </div>

          {/* ── navbar-right (Search + Profile) ── */}
          <div className="flex items-center gap-2 h-full">
            <button 
              className="text-white/50 hover:text-[#00f0ff] px-3 py-4 h-full cursor-pointer flex items-center transition-colors" 
              title="Saved Data"
              onClick={() => setDataDrawerOpen(true)}
            >
              <Database size={16} />
            </button>
            {/* Messages */}
            <button className="text-white/50 hover:text-[#00f0ff] px-3 py-4 h-full cursor-pointer flex items-center relative transition-colors" title="Messages">
              <MessageCircle size={18} />
              <span className="absolute top-3 right-[6px] bg-[#E83E8C] text-white text-[9px] font-bold px-[4px] py-[1px] leading-none rounded-2xl shadow-[0_0_8px_rgba(232,62,140,0.8)]">2</span>
            </button>

            {user ? (
              <>
                <button
                  className="text-white/50 hover:text-[#00f0ff] px-3 py-4 h-full cursor-pointer flex items-center transition-colors"
                  title="Logout"
                  onClick={logoutUser}
                >
                  <LogOut size={16} />
                </button>
                <button className="text-[#00f0ff] hover:text-white pl-3 pr-0 py-4 h-full cursor-pointer flex items-center transition-colors" title={user.username}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00f0ff] to-[#0a58ca] text-white flex items-center justify-center font-bold text-sm shadow-[0_0_8px_rgba(0,240,255,0.4)] uppercase">
                    {user.username.charAt(0)}
                  </div>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-transparent border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff] hover:text-black text-sm font-semibold px-4 py-1.5 ml-2 rounded transition-all shadow-[0_0_8px_rgba(0,240,255,0.2)] block"
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
