"use client";

import { useDemoStore } from "@/store/demoStore";

export function DemoOverlay() {
  const { isDemoMode, currentNodeId, narrative } = useDemoStore();

  if (!isDemoMode || !currentNodeId) return null;

  const text = narrative[currentNodeId];
  if (!text) return null;

  return (
    <div key={currentNodeId} className="demo-overlay">
      {text}
    </div>
  );
}
