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
    started.current = true;
    setShowModal(false);

    try {
      const template = await fetchPipelineTemplate(templateName) as any;

      if (template.demoNarrative) {
        setNarrative(template.demoNarrative as Record<string, string>);
      }

      activate();

      await new Promise((r) => setTimeout(r, 350));
      loadPipeline({
        id: 0,
        name: template.name ?? templateName,
        nodes: template.nodes ?? [],
        edges: template.edges ?? [],
      });
      await new Promise((r) => setTimeout(r, 400));
      dispatchAgentEvent("pipeline:execute", {});
    } catch {
      setShowModal(false);
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
