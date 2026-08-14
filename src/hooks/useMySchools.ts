import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Powers the in-session "Switch School" control's visibility + list.
// Deliberately its own endpoint rather than folded into /auth/me -- see
// GET /api/auth/my-schools's own comment for why. Returns [] for
// single-membership/SUPER_ADMIN accounts; callers should hide the switcher
// entirely unless length > 1, not just when this list is empty.
export interface MySchool {
  school_id: string;
  school_name: string;
  logo_url: string | null;
  role: string;
}

export function useMySchools() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['my-schools'],
    queryFn: async (): Promise<MySchool[]> => {
      const { data } = await api.get('/auth/my-schools');
      return data.schools;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}
