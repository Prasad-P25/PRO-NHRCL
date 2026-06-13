import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@/types';

interface AppState {
  // Sidebar state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Project context
  currentProject: Project | null;
  availableProjects: Project[];
  setCurrentProject: (project: Project | null) => void;
  setAvailableProjects: (projects: Project[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Project context
      currentProject: null,
      availableProjects: [],
      setCurrentProject: (project) => set({ currentProject: project }),
      setAvailableProjects: (projects) => set({ availableProjects: projects }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        currentProject: state.currentProject,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
