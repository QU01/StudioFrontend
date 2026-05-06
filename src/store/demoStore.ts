import { create } from 'zustand';

interface DemoState {
  isDemoMode: boolean;
  currentNodeId: string | null;
  narrative: Record<string, string>;
  toggle: () => void;
  activate: () => void;
  deactivate: () => void;
  setCurrent: (id: string | null) => void;
  setNarrative: (narrative: Record<string, string>) => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  isDemoMode: false,
  currentNodeId: null,
  narrative: {},
  toggle: () => set((s) => ({ isDemoMode: !s.isDemoMode })),
  activate: () => set({ isDemoMode: true }),
  deactivate: () => set({ isDemoMode: false, currentNodeId: null }),
  setCurrent: (id) => set({ currentNodeId: id }),
  setNarrative: (narrative) => set({ narrative }),
}));
