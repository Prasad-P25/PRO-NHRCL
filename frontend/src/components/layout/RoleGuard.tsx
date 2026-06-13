import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/use-toast';

interface RoleGuardProps {
  roles: string[];
  children: React.ReactNode;
}

/**
 * Restricts a route to the given roles. Sidebar hiding is cosmetic only —
 * without this guard a user could reach admin pages by typing the URL.
 */
export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user } = useAuthStore();
  const roleName = user?.role?.name || (user as any)?.roleName || '';
  const allowed = roles.includes(roleName);

  useEffect(() => {
    if (!allowed) {
      toast({
        title: 'Access denied',
        description: 'You do not have permission to view that page.',
        variant: 'destructive',
      });
    }
  }, [allowed]);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
