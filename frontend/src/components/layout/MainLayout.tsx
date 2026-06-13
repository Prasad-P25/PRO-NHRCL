import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

export function MainLayout() {
  const { isAuthenticated } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  // On small screens the sidebar should start closed (it overlays the content).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />

      {/* Backdrop for the mobile slide-out sidebar (desktop never shows it) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-16 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <main
        className={cn(
          // Margin only applies on large screens; on mobile the sidebar overlays
          // so content stays full-width.
          'pt-16 transition-all duration-300',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        )}
      >
        <div className="container mx-auto p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
