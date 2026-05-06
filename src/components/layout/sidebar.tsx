"use client";

import Image from "next/image";
import { useState } from "react";
import {
  LayoutDashboard, Database, GitBranch, Brain,
  MessageSquare, Settings, User, Mail, LogOut,
  ChevronDown, LayoutPanelTop,
} from "lucide-react";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  chatOpen?: boolean;
  onToggleChat?: () => void;
}

const navSections = [
  {
    header: "Main",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", hasSubmenu: false },
    ],
  },
  {
    header: "App",
    items: [
      { icon: Database, label: "Data", id: "data", hasSubmenu: false },
      { icon: GitBranch, label: "Pipeline", id: "pipeline", hasSubmenu: false },
      { icon: Brain, label: "Neural Net", id: "neural", hasSubmenu: false },
      { icon: LayoutPanelTop, label: "Dashboard Builder", id: "dashboard-builder", hasSubmenu: false },
      { icon: MessageSquare, label: "QUO", id: "agent", hasSubmenu: false },
    ],
  },
  {
    header: "System",
    items: [
      { icon: Settings, label: "Settings", id: "settings", hasSubmenu: false },
    ],
  }
];

export function Sidebar({ activeView, onViewChange, isOpen, chatOpen, onToggleChat }: SidebarProps) {
  const [openUserMenu, setOpenUserMenu] = useState(false);

  return (
    <div className={`fixed left-0 top-0 h-full bg-[#1e242d] border-r border-[#262e38] z-50 flex flex-col transition-all duration-300 ${isOpen ? 'w-[240px]' : 'w-[70px]'}`}>

      {/* ── Brand ── */}
      <div className={`flex items-center pb-6 pt-6 border-b border-white/10 group cursor-pointer ${isOpen ? 'justify-start pl-4 pr-2 gap-4' : 'justify-center mx-auto'}`}>
        <Image
          src="/quasar-logo.svg"
          alt="Quasar Studio"
          width={isOpen ? 54 : 44}
          height={isOpen ? 54 : 44}
          className="object-cover drop-shadow-[0_0_8px_rgba(0,240,255,0.6)] transition-all duration-700 group-hover:animate-[spin_2s_linear_infinite] flex-shrink-0"
          priority
        />
        {isOpen && (
          <div className="flex flex-col justify-center overflow-hidden">
            <span
              className="text-[28px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.3)] leading-none mb-0.5 tracking-wide"
              style={{ fontFamily: "'Eurostile', 'Michroma', sans-serif" }}
            >
              QUASAR
            </span>
            <span
              className="text-[14px] font-bold text-white/50 tracking-[0.2em] leading-none uppercase"
              style={{ fontFamily: "'Eurostile', 'Michroma', sans-serif" }}
            >
              Studio
            </span>
          </div>
        )}
      </div>

      {/* ── Scroll Area ── */}
      <div className="flex-1 overflow-y-auto w-full custom-scrollbar overflow-x-hidden">

        {/* ── User Profile ── */}
        <div className={`my-5 flex items-center relative ${isOpen ? 'mx-2.5 gap-4' : 'justify-center mx-auto'}`}>
          <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden relative">
            <div className="w-full h-full bg-gradient-to-br from-[#683cff] to-[#7214ca] flex items-center justify-center text-white text-[16px] font-bold">
              Q
            </div>
          </div>
          
          {isOpen && (
            <div>
              <div className="text-[13px] text-[#77797c] leading-tight">Welcome,</div>
              <button
                onClick={() => setOpenUserMenu(!openUserMenu)}
                className="text-[#a5a8ad] text-[14px] font-bold hover:text-white transition-colors flex items-center gap-1 mt-0.5"
              >
                Quasar User
                <ChevronDown size={14} className="text-white/40 ml-1" />
              </button>

              {openUserMenu && (
                <div className="absolute top-16 left-5 w-[180px] bg-[#222a35] border border-white/10 rounded-md shadow-lg py-2 z-50">
                  <button className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white flex items-center gap-2 hover:bg-white/5">
                    <User size={14} /> My Profile
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white flex items-center gap-2 hover:bg-white/5">
                    <MessageSquare size={14} /> Messages
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white flex items-center gap-2 hover:bg-white/5">
                    <Settings size={14} /> Settings
                  </button>
                  <div className="h-[1px] bg-white/10 my-1 w-full" />
                  <button className="w-full text-left px-4 py-2 text-sm text-[#e47297] hover:text-pink-400 flex items-center gap-2 hover:bg-white/5">
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-b border-white/5 mx-2.5 mb-2" />

        {/* ── Nav Sections ── */}
        <div className="pb-10 font-['Montserrat']">
          {navSections.map((section, idx) => (
            <div key={idx} className="mb-0">
              {isOpen ? (
                <div className="text-[13px] font-bold text-[#e2e4e7] px-5 pt-4 pb-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  {section.header}
                </div>
              ) : (
                <div className="h-6" /> // spacer replacing header in mini mode
              )}

              <nav className={`flex flex-col gap-0 ${isOpen ? 'px-2.5' : 'px-2'}`}>
                {section.items.map((item) => {
                  const isAgent = item.id === "agent";
                  const isActive = isAgent ? !!chatOpen : activeView === item.id;
                  const handleClick = isAgent && onToggleChat
                    ? onToggleChat
                    : () => onViewChange(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={handleClick}
                      className={`w-full flex items-center ${isOpen ? 'text-left px-3' : 'justify-center px-0'} py-[10px] my-0.5 rounded-lg transition-all relative group
                        ${isActive
                          ? "text-white font-medium bg-gradient-to-r from-[#00f0ff]/10 to-transparent shadow-[inset_2px_0_0_0_#00f0ff]"
                          : "text-[#a5a8ad] hover:text-white hover:bg-white/5"}
                      `}
                      title={!isOpen ? item.label : undefined}
                    >
                      <item.icon size={20} className={`${isOpen ? 'mr-3' : 'mx-auto'} transition-colors ${isActive ? "text-[#00f0ff] drop-shadow-[0_0_5px_#00f0ff]" : "text-[#77797c] group-hover:text-[#00f0ff]"}`} />
                      {isOpen && (
                        <span className="text-[14px] flex-1 font-['Montserrat'] tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                          {item.label}
                        </span>
                      )}
                      {isAgent && isActive && (
                        <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse ml-1 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
