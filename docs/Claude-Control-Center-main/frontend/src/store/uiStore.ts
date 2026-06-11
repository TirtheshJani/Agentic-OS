import { create } from 'zustand';

interface UIState {
  openSubagentId: string | null;
  openSubagentSessionId: string | null;
  openSubagentProjectId: string | null;
  memoryEditorOpen: boolean;
  memoryEditorTarget: string | null;
  memoryEditorProjectId: string | null;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  setOpenSubagent: (id: string | null, sessionId?: string, projectId?: string) => void;
  openMemoryEditor: (projectId: string, filename: string | null) => void;
  closeMemoryEditor: () => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  openSubagentId: null,
  openSubagentSessionId: null,
  openSubagentProjectId: null,
  memoryEditorOpen: false,
  memoryEditorTarget: null,
  memoryEditorProjectId: null,
  sidebarCollapsed: false,
  commandPaletteOpen: false,

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  setOpenSubagent: (id, sessionId, projectId) =>
    set({
      openSubagentId: id,
      openSubagentSessionId: sessionId ?? null,
      openSubagentProjectId: projectId ?? null,
    }),

  openMemoryEditor: (projectId, filename) =>
    set({ memoryEditorOpen: true, memoryEditorProjectId: projectId, memoryEditorTarget: filename }),

  closeMemoryEditor: () =>
    set({ memoryEditorOpen: false, memoryEditorTarget: null, memoryEditorProjectId: null }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
