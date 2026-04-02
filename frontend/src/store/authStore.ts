import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

// Helper to clear app storage on logout
const clearAppStorage = () => {
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
