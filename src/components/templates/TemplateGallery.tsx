"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchTemplatesList, fetchPipelineTemplate, loadDemoDataset, type TemplateMetadata } from "@/lib/api";
import { loadPipeline, loadArchitecture } from "@/lib/agent-events";

interface Props {
  onNavigate: (view: string) => void;
}

// Full static class strings so Tailwind JIT can scan them
const DOMAIN_THEME: Record<string, {
  accent: string;
  iconBg: string;
  topLine: string;
  cardHover: string;
  btnClass: string;
  glowColor: string;
}> = {
  "Aerotermondinámica": {
    accent:    "text-cyan-400",
    iconBg:    "bg-cyan-500/10 border border-cyan-500/20",
    topLine:   "from-cyan-400/70",
    cardHover: "hover:border-cyan-500/35",
    btnClass:  "border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/50",
    glowColor: "rgba(6,182,212,0.10)",
  },
  "Eficiencia Energética": {
    accent:    "text-amber-400",
    iconBg:    "bg-amber-500/10 border border-amber-500/20",
    topLine:   "from-amber-400/70",
    cardHover: "hover:border-amber-500/35",
    btnClass:  "border-amber-500/25 text-amber-300 hover:bg-amber-500/10 hover:border-amber-400/50",
    glowColor: "rgba(245,158,11,0.10)",
  },
  "Finanzas / Banca": {
    accent:    "text-violet-400",
    iconBg:    "bg-violet-500/10 border border-violet-500/20",
    topLine:   "from-violet-400/70",
    cardHover: "hover:border-violet-500/35",
    btnClass:  "border-violet-500/25 text-violet-300 hover:bg-violet-500/10 hover:border-violet-400/50",
    glowColor: "rgba(139,92,246,0.10)",
  },
  "Biología / Botánica": {
    accent:    "text-emerald-400",
    iconBg:    "bg-emerald-500/10 border border-emerald-500/20",
    topLine:   "from-emerald-400/70",
    cardHover: "hover:border-emerald-500/35",
    btnClass:  "border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-400/50",
    glowColor: "rgba(16,185,129,0.10)",
  },
  "Ciencia de Datos": {
    accent:    "text-blue-400",
    iconBg:    "bg-blue-500/10 border border-blue-500/20",
    topLine:   "from-blue-400/70",
    cardHover: "hover:border-blue-500/35",
    btnClass:  "border-blue-500/25 text-blue-300 hover:bg-blue-500/10 hover:border-blue-400/50",
    glowColor: "rgba(59,130,246,0.10)",
  },
};

const DEFAULT_THEME = {
  accent:    "text-[#00f0ff]",
  iconBg:    "bg-[#00f0ff]/10 border border-[#00f0ff]/15",
  topLine:   "from-[#00f0ff]/50",
  cardHover: "hover:border-[#00f0ff]/30",
  btnClass:  "border-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/10 hover:border-[#00f0ff]/40",
  glowColor: "rgba(0,240,255,0.08)",
};

const DIFFICULTY_STYLE: Record<string, string> = {
  "Principiante": "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  "Intermedio":   "text-amber-300 bg-amber-500/10 border-amber-500/20",
  "Avanzado":     "text-rose-300 bg-rose-500/10 border-rose-500/20",
};

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function DbIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

export function TemplateGallery({ onNavigate }: Props) {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("Todos");

  useEffect(() => {
    fetchTemplatesList()
      .then(setTemplates)
      .catch(() => toast.error("No se pudo cargar la galería de plantillas"))
      .finally(() => setLoading(false));
  }, []);

  const domains = Array.from(new Set(templates.map((t) => t.domain).filter(Boolean)));
  const filters = ["Todos", ...domains];
  const visible = activeFilter === "Todos" ? templates : templates.filter((t) => t.domain === activeFilter);

  async function handleUse(t: TemplateMetadata) {
    if (loadingId) return;
    setLoadingId(t.id);
    try {
      const full = (await fetchPipelineTemplate(t.id)) as any;

      // 1. Load associated dataset if the template specifies one
      if (full.demo_dataset) {
        await loadDemoDataset(full.demo_dataset);
      }

      // 2. Load pipeline structure (nodes + edges + params)
      loadPipeline({ id: 0, name: full.name ?? t.name, nodes: full.nodes ?? [], edges: full.edges ?? [] });

      // 3. Load NN architecture into Neural Net canvas if defined
      if (full.nn_architecture) {
        await new Promise((r) => setTimeout(r, 250));
        loadArchitecture({
          id: 0,
          name: full.name ?? t.name,
          config: {
            inputShape: full.nn_architecture.inputShape ?? [1],
            nodes: full.nn_architecture.nodes ?? [],
            edges: full.nn_architecture.edges ?? [],
          },
        });
      }

      toast.success(`Plantilla "${t.name}" cargada`, { description: "Cambiando a Pipeline…" });
      setTimeout(() => onNavigate("pipeline"), 400);
    } catch (err) {
      console.error("Template load error:", err);
      toast.error(`No se pudo cargar la plantilla "${t.name}"`);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="min-h-full bg-[#181d23]">

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="border-b border-white/5 bg-gradient-to-b from-[#1c2330] to-[#181d23]">
        <div className="max-w-6xl mx-auto px-8 pt-10 pb-0">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#00f0ff]/6 border border-[#00f0ff]/12 rounded-full px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] opacity-80" />
                <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#00f0ff]/70">
                  Quasar Studio
                </span>
              </div>
              <h1 className="text-[28px] font-bold tracking-tight mb-2">
                <span className="text-white">Galería de </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#3AA0FF]">
                  Plantillas
                </span>
              </h1>
              <p className="text-[#77797c] text-[13.5px] max-w-md leading-relaxed">
                Pipelines preconfigurados listos para ejecutar. Selecciona uno, carga tus datos y entrena en segundos.
              </p>
            </div>

            {!loading && (
              <div className="hidden md:flex flex-col items-end gap-1 pt-1 flex-shrink-0">
                <div className="text-[36px] font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
                  {templates.length}
                </div>
                <div className="text-[11px] text-[#a5a8ad] tracking-wide">plantillas disponibles</div>
              </div>
            )}
          </div>

          {/* Filter tabs */}
          {!loading && filters.length > 1 && (
            <div className="flex gap-1.5 mt-7 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-all border whitespace-nowrap ${
                    activeFilter === f
                      ? "bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff]"
                      : "bg-transparent border-white/8 text-[#77797c] hover:border-white/18 hover:text-[#a5a8ad]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* Bottom spacer that bleeds into grid */}
          <div className="h-7" />
        </div>
      </div>

      {/* ── Card grid ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-[#1e242d] animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {visible.map((t) => {
              const theme = DOMAIN_THEME[t.domain] ?? DEFAULT_THEME;
              const isThisLoading = loadingId === t.id;

              return (
                <div
                  key={t.id}
                  className={`group relative flex flex-col rounded-2xl border border-white/7 bg-[#1c2230] ${theme.cardHover} transition-all duration-300 overflow-hidden`}
                  style={{
                    boxShadow: `0 1px 3px rgba(0,0,0,0.4)`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 40px ${theme.glowColor}, 0 1px 3px rgba(0,0,0,0.5)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 1px 3px rgba(0,0,0,0.4)`;
                  }}
                >
                  {/* Colored top accent line */}
                  <div className={`h-[2px] w-full bg-gradient-to-r ${theme.topLine} via-transparent to-transparent flex-shrink-0`} />

                  {/* Card body */}
                  <div className="flex flex-col flex-1 p-6 gap-4">

                    {/* Icon + header */}
                    <div className="flex items-start gap-4">
                      <div className={`w-[46px] h-[46px] rounded-xl flex items-center justify-center text-[22px] flex-shrink-0 ${theme.iconBg}`}>
                        {t.icon}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className={`text-[10px] font-bold tracking-[0.13em] uppercase mb-1.5 ${theme.accent}`}>
                          {t.domain}
                        </div>
                        <h2 className="text-white font-semibold text-[15px] leading-snug">
                          {t.name}
                        </h2>
                      </div>
                    </div>

                    {/* Description */}
                    <p
                      className="text-[#6b7280] text-[13px] leading-relaxed"
                      style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {t.description}
                    </p>

                    {/* Tags + difficulty */}
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] px-2.5 py-[3px] rounded-full bg-white/[0.04] border border-white/8 text-[#8b9099]"
                        >
                          {tag}
                        </span>
                      ))}
                      {t.difficulty && (
                        <span className={`text-[11px] px-2.5 py-[3px] rounded-full border font-medium ${DIFFICULTY_STYLE[t.difficulty] ?? "text-[#8b9099] border-white/10"}`}>
                          {t.difficulty}
                        </span>
                      )}
                    </div>

                    {/* Dataset hint */}
                    {t.dataset_hint && (
                      <div className={`flex items-center gap-1.5 text-[11px] text-[#4b5563]`}>
                        <DbIcon className={`${theme.accent} opacity-50 flex-shrink-0`} />
                        <span>Dataset sugerido: </span>
                        <span className="font-mono text-[#6b7280]">{t.dataset_hint}</span>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="mx-6 h-px bg-white/5" />

                  {/* Footer button */}
                  <div className="p-6 pt-4">
                    <button
                      onClick={() => handleUse(t)}
                      disabled={!!loadingId}
                      className={`
                        w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200
                        border bg-transparent active:scale-[0.98]
                        disabled:opacity-40 disabled:cursor-not-allowed
                        ${theme.btnClass}
                      `}
                    >
                      {isThisLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Spinner />
                          Cargando…
                        </span>
                      ) : (
                        "▶  Usar plantilla"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
