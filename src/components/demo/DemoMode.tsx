"use client";

import { useEffect } from "react";
import { useDemoStore } from "@/store/demoStore";

export function DemoMode({ children }: { children: React.ReactNode }) {
  const { isDemoMode, toggle, deactivate } = useDemoStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "D") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && isDemoMode) {
        deactivate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDemoMode, toggle, deactivate]);

  useEffect(() => {
    if (isDemoMode) {
      document.documentElement.classList.add("demo-mode");
      document.documentElement
        .requestFullscreen?.()
        .catch(() => {});
    } else {
      document.documentElement.classList.remove("demo-mode");
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [isDemoMode]);

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove("demo-mode");
    };
  }, []);

  return <>{children}</>;
}
