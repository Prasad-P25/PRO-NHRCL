import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Package, AuditCategory, Project } from '@/types';

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

  // Global data cache
  packages: Package[];
  setPackages: (packages: Package[]) => void;

  categories: AuditCategory[];
  setCategories: (categories: AuditCategory[]) => void;

  // Current audit state (for audit execution)
  currentAuditId: number | null;
  setCurrentAuditId: (id: number | null) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
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

      // Global data
      packages: [],
      setPackages: (packages) => set({ packages }),

      categories: [],
      setCategories: (categories) => set({ categories }),

      // Current audit
      currentAuditId: null,
      setCurrentAuditId: (id) => set({ currentAuditId: id }),

      // Loading
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
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
