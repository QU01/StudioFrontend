"use client";

import Image from "next/image";
import { useState } from "react";
import {
  LayoutDashboard, Database, GitBranch, Brain,
  MessageSquare, Settings, User, Mail, LogOut,
  ChevronDown, LayoutPanelTop, LibraryBig, Package,
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
      { icon: Database,       label: "Data",              id: "data",             hasSubmenu: false },
      { icon: GitBranch,      label: "Pipeline",          id: "pipeline",         hasSubmenu: false },
      { icon: Brain,          label: "Neural Net",        id: "neural",           hasSubmenu: false },
      { icon: LayoutPanelTop, label: "Dashboard Builder", id: "dashboard-builder",hasSubmenu: false },
      { icon: LibraryBig,     label: "Plantillas",        id: "templates",        hasSubmenu: false },
      { icon: Package,        label: "Diseñadores",       id: "designers",        hasSubmenu: false },
      { icon: MessageSquare,  label: "QUO",               id: "agent",            hasSubmenu: false },
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
    <div
      className={`fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300 ${isOpen ? 'w-[240px]' : 'w-[70px]'}`}
      style={{ background: 'var(--surface-0)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >

      {/* ── Brand ── */}
      <div className={`flex items-center pb-5 pt-5 group cursor-pointer ${isOpen ? 'justify-start pl-4 pr-2 gap-4' : 'justify-center mx-auto'}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Image
          src="/quasar-logo.svg"
          alt="Quasar Studio"
          width={isOpen ? 52 : 42}
          height={isOpen ? 52 : 42}
          className="object-contain flex-shrink-0 transition-all duration-700 group-hover:animate-[spin_2s_linear_infinite]"
          style={{ filter: 'drop-shadow(0 0 10px rgba(58,160,255,0.65))' }}
          priority
        />
        {isOpen && (
          <div className="flex flex-col justify-center overflow-hidden leading-none gap-1">
            <span
              className="font-bold leading-none"
              style={{
                fontFamily: 'var(--quasar-font-display)',
                fontSize: '20px',
                background: 'linear-gradient(135deg, #F5F7FA 60%, #3AA0FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '0.12em',
              }}
            >
              QUASAR
            </span>
            <span
              style={{
                fontFamily: 'var(--quasar-font-display)',
                fontSize: '11px',
                color: 'var(--electric)',
                letterSpacing: '0.30em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Studio
            </span>
          </div>
        )}
      </div>

      {/* ── Scroll Area ── */}
      <div className="flex-1 overflow-y-auto w-full overflow-x-hidden"
        style={{ scrollbarWidth: 'none' }}
      >

        {/* ── User Profile ── */}
        <div className={`my-4 flex items-center relative ${isOpen ? 'mx-3 gap-3' : 'justify-center mx-auto'}`}>
          <div
            className="w-9 h-9 rounded flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-[15px]"
            style={{
              background: 'linear-gradient(135deg, var(--electric-dim), var(--electric))',
              color: 'var(--ink-primary)',
              boxShadow: 'var(--glow-subtle)',
            }}
          >
            Q
          </div>

          {isOpen && (
            <div>
              <div
                className="text-[11px] leading-tight"
                style={{ fontFamily: 'var(--quasar-font-mono)', color: 'var(--ink-dim)', letterSpacing: '0.05em' }}
              >
                Welcome,
              </div>
              <button
                onClick={() => setOpenUserMenu(!openUserMenu)}
                className="flex items-center gap-1 mt-0.5 transition-colors"
                style={{ fontFamily: 'var(--quasar-font-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--ink-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--electric)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-primary)')}
              >
                Quasar User
                <ChevronDown size={12} style={{ color: 'var(--ink-dim)', marginLeft: '2px' }} />
              </button>

              {openUserMenu && (
                <div
                  className="absolute top-14 left-0 w-[185px] rounded-lg shadow-xl py-2 z-50"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  {[
                    { icon: <User size={13} />, label: 'My Profile' },
                    { icon: <Mail size={13} />, label: 'Messages' },
                    { icon: <Settings size={13} />, label: 'Settings' },
                  ].map(({ icon, label }) => (
                    <button
                      key={label}
                      className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2 transition-colors"
                      style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--ink-muted)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-muted)')}
                    >
                      {icon} {label}
                    </button>
                  ))}
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />
                  <button
                    className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2 transition-colors"
                    style={{ fontFamily: 'var(--quasar-font-sans)', color: 'var(--error)' }}
                  >
                    <LogOut size={13} /> Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '0 12px 8px' }} />

        {/* ── Nav Sections ── */}
        <div className="pb-10">
          {navSections.map((section, idx) => (
            <div key={idx} className="mb-0">
              {isOpen ? (
                <div
                  className="px-5 pt-4 pb-1.5"
                  style={{
                    fontFamily: 'var(--quasar-font-mono)',
                    fontSize: '10px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.20em',
                    color: 'var(--ink-dim)',
                  }}
                >
                  {section.header}
                </div>
              ) : (
                <div className="h-5" />
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
                      title={!isOpen ? item.label : undefined}
                      className={`w-full flex items-center ${isOpen ? 'text-left px-3' : 'justify-center px-0'} py-[9px] my-0.5 rounded transition-all relative group`}
                      style={{
                        fontFamily: 'var(--quasar-font-sans)',
                        fontSize: '14px',
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? 'var(--ink-primary)' : 'var(--ink-muted)',
                        background: isActive
                          ? 'transparent'
                          : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.color = 'var(--ink-primary)';
                          e.currentTarget.style.background = 'var(--surface-3)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.color = 'var(--ink-muted)';
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {/* Left accent bar for active item */}
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
                          style={{
                            width: '3px',
                            height: '18px',
                            background: 'var(--gradient-bar)',
                            boxShadow: 'var(--glow-electric)',
                          }}
                        />
                      )}

                      <item.icon
                        size={18}
                        className={`${isOpen ? 'mr-3' : 'mx-auto'} transition-colors flex-shrink-0`}
                        style={{ color: isActive ? 'var(--electric)' : 'var(--ink-dim)' }}
                      />

                      {isOpen && (
                        <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis tracking-wide">
                          {item.label}
                        </span>
                      )}

                      {isAgent && isActive && (
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse ml-1 flex-shrink-0"
                          style={{ background: 'var(--electric)' }}
                        />
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
