"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDemoStore } from "@/store/demoStore";
import { fetchPipelineTemplate } from "@/lib/api";
import { loadPipeline, dispatchAgentEvent } from "@/lib/agent-events";

export function DemoAutoplay() {
  const params = useSearchParams();
  const autoplay = params.get("autoplay") === "true";
  const templateName = params.get("template") ?? "compressor";
  const { activate, setNarrative } = useDemoStore();
  const [showModal, setShowModal] = useState(autoplay);
  const started = useRef(false);

  async function handleStart() {
    if (started.current) return;
    setShowModal(false);

    try {
      started.current = true;
      const template = await fetchPipelineTemplate(templateName);

      if (template.demoNarrative) {
        setNarrative(template.demoNarrative as Record<string, string>);
      }

      activate();

      await new Promise((r) => setTimeout(r, 350));
      loadPipeline({
        id: 0,
        name: (template.name as string) ?? templateName,
        nodes: (template.nodes as any[]) ?? [],
        edges: (template.edges as any[]) ?? [],
      });
      await new Promise((r) => setTimeout(r, 400));
      dispatchAgentEvent("pipeline:execute", {});
    } catch {
      started.current = false;
      setShowModal(true);
    }
  }

  if (!showModal) return null;

  return (
    <div className="demo-start-modal">
      <button className="demo-start-button" onClick={handleStart}>
        ▶ Iniciar Demo Quasar
      </button>
    </div>
  );
}
