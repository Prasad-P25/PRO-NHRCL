import { create } from 'zustand';
import type { Package, AuditCategory } from '@/types';

interface AppState {
  // Sidebar state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

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

export const useAppStore = create<AppState>((set) => ({
  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

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
}));
