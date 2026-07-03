"use client";

import { useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { Dashboard } from "@/components/dashboard/dashboard";
import { DataView } from "@/components/data/DataView";
import { PipelineView } from "@/components/pipeline/PipelineView";
import { DashboardBuilderView } from "@/components/dashboard-builder/DashboardBuilderView";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { DesignersView } from "@/components/designers/DesignersView";
import { AgentChatDrawer } from "@/components/agent/AgentView";

// NeuralNetView reads localStorage during initialization — skip SSR to avoid hydration mismatch
const NeuralNetView = dynamic(
  () => import("@/components/neural/NeuralNetView").then((m) => m.NeuralNetView),
  { ssr: false }
);
import { onAgentEvent } from "@/lib/agent-events";
import { DemoAutoplay } from "@/components/demo/DemoAutoplay";
import { useDemoStore } from "@/store/demoStore";

export default function Home() {
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const { isDemoMode } = useDemoStore();

  // Agent can request a view switch
  useEffect(() => {
    return onAgentEvent<{ view: string }>("switchView", ({ view }) => {
      if (view && view !== "agent") setActiveView(view);
    });
  }, []);

  const drawerWidth = 420;

  return (
    <div className="h-screen overflow-hidden bg-[#181d23]">
      {/* Fixed left sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        isOpen={sidebarOpen}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
      />

      {/* Top Navbar */}
      <div
        className={`fixed top-0 h-[62px] z-40 transition-all duration-300`}
        style={{
          left: sidebarOpen ? 240 : 70,
          right: chatOpen ? drawerWidth : 0,
        }}
      >
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      </div>

      {/* Scrollable main content */}
      <main
        className="relative overflow-hidden bg-[#181d23] transition-all duration-300"
        style={{
          height: isDemoMode ? '100vh' : 'calc(100vh - 62px)',
          marginTop: isDemoMode ? 0 : 62,
          marginLeft: isDemoMode ? 0 : (sidebarOpen ? 240 : 70),
          marginRight: isDemoMode ? 0 : (chatOpen ? drawerWidth : 0),
        }}
      >
        <div style={{ display: activeView === "dashboard" ? "block" : "none", height: "100%", overflowY: "auto" }}><Dashboard /></div>
        <div style={{ display: activeView === "data"      ? "block" : "none", height: "100%", overflowY: "auto" }}><DataView /></div>
        <div style={{ display: activeView === "pipeline"  ? "flex" : "none", height: "100%", flexDirection: "column" }}><PipelineView activeView={activeView} /></div>
        <div style={{ display: activeView === "neural"    ? "flex" : "none", height: "100%", flexDirection: "column" }}><NeuralNetView activeView={activeView} /></div>
        <div style={{ display: activeView === "dashboard-builder" ? "flex" : "none", height: "100%", flexDirection: "column" }}><DashboardBuilderView /></div>
        <div style={{ display: activeView === "templates" ? "block" : "none", height: "100%", overflowY: "auto" }}>
          <TemplateGallery onNavigate={setActiveView} />
        </div>
        <div style={{ display: activeView === "designers" ? "block" : "none", height: "100%", overflowY: "auto" }}>
          <DesignersView onNavigate={setActiveView} />
        </div>
      </main>

      {/* Agent chat drawer — fixed right panel */}
      {chatOpen && (
        <div
          className="fixed top-0 right-0 h-screen z-50 flex flex-col border-l"
          style={{
            width: drawerWidth,
            backgroundColor: "#181d23",
            borderColor: "rgba(0,240,255,0.12)",
            boxShadow: "-4px 0 32px rgba(0,0,0,0.5), -1px 0 0 rgba(0,240,255,0.06)",
          }}
        >
          <AgentChatDrawer onClose={() => setChatOpen(false)} />
        </div>
      )}

      {/* Demo mode: URL-based autoplay (needs Suspense for useSearchParams) */}
      <Suspense>
        <DemoAutoplay />
      </Suspense>
    </div>
  );
}
