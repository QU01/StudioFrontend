"use client";

import { useDemoStore } from "@/store/demoStore";

/** Returns true when demo mode is active and this node is currently running. */
export function useNodeHalo(nodeId: string): boolean {
  const { isDemoMode, currentNodeId } = useDemoStore();
  return isDemoMode && currentNodeId === nodeId;
}
