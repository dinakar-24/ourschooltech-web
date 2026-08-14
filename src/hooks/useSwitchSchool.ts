import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getRefreshToken } from '@/stores/authStore';
import { useAuth } from '@/contexts/AuthContext';

// Role -> post-switch landing route. Same map LoginPage.tsx uses after a
// normal login; duplicated rather than imported since a page component
// isn't a natural thing for a shared hook to depend on.
const ROLE_DASHBOARD_PATHS: Record<string, string> = {
  super_admin: '/super-admin/dashboard',
  school_admin: '/admin/dashboard',
  teacher: '/teacher/dashboard',
  parent: '/parent/dashboard',
  student: '/student/dashboard',
};

export function useSwitchSchool() {
  const { loginWithSession } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);

  const switchSchool = async (schoolId: string) => {
    setIsSwitching(true);
    try {
      const { data } = await api.post('/auth/switch-school', {
        schoolId,
        refreshToken: getRefreshToken(),
      });

      await loginWithSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      // A hard reload, not a client-side navigate: this is the deliberate
      // choice over queryClient.clear() + navigate() -- it guarantees every
      // piece of school-scoped state (React Query cache, any component's
      // own local state, refs) starts clean, the same guarantee a normal
      // login already gets from mounting into a fresh app. The brief delay
      // gives the IndexedDB-backed auth store (async under the hood) time
      // to flush the new tokens before the reload re-reads them on boot.
      await new Promise((resolve) => setTimeout(resolve, 250));
      const role = String(data.user.role || '').toLowerCase();
      window.location.href = ROLE_DASHBOARD_PATHS[role] || '/dashboard';
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to switch school');
      setIsSwitching(false);
    }
  };

  return { switchSchool, isSwitching };
}
