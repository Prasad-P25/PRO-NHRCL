import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { useAppStore } from '@/store/appStore';
import { queryClient } from '@/lib/queryClient';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

// Helper to clear ALL of the previous user's state on logout/login: persisted
// localStorage, the in-memory appStore (currentProject/availableProjects which
// drive the X-Project-Id header), and the React Query cache.
const clearAppStorage = () => {
  // Reset in-memory project context so the next user never inherits it
  try {
    useAppStore.setState({ currentProject: null, availableProjects: [] });
  } catch {
    // ignore if store not initialized yet
  }

  // Drop all cached query data (dashboards, lists, notifications, etc.)
  try {
    queryClient.clear();
  } catch {
    // ignore
  }

  const appStorage = localStorage.getItem('app-storage');
  if (appStorage) {
    try {
      const parsed = JSON.parse(appStorage);
      // Clear project-related data but keep sidebar preference
      parsed.state.currentProject = null;
      parsed.state.availableProjects = [];
      localStorage.setItem('app-storage', JSON.stringify(parsed));
    } catch {
      // If parsing fails, just remove the entire app storage
      localStorage.removeItem('app-storage');
    }
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        // Clear previous user's project data when new user logs in
        clearAppStorage();
        set({
          user,
          token,
          isAuthenticated: true,
        });
      },
      logout: () => {
        clearAppStorage();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
