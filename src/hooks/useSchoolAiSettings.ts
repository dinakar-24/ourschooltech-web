import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface SchoolAiSettings {
  enabled: boolean;
  model: 'auto' | 'flash' | 'pro';
  tone: 'friendly' | 'formal' | 'concise' | 'playful';
  custom_instructions: string;
  allowed_roles: string[];
}

const DEFAULTS: SchoolAiSettings = {
  enabled: true,
  model: 'auto',
  tone: 'friendly',
  custom_instructions: '',
  allowed_roles: ['parent', 'student', 'teacher', 'school_admin', 'super_admin'],
};

export function useSchoolAiSettings() {
  const { user } = useAuth();

  // ai_defaults is a genuinely global platform setting (per-school overrides
  // were descoped in v1 -- see the route's own comment), so this no longer
  // depends on schoolId at all. Gating on `user` instead of the old `schoolId`
  // check matters specifically for super admins, who have no schoolId of
  // their own: the old check meant this query never ran for them and they
  // always saw the hardcoded DEFAULTS instead of whatever's actually
  // configured (e.g. AI disabled platform-wide would still show the FAB).
  const { data } = useQuery({
    queryKey: ['ai-defaults'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await api.get('/settings/ai-defaults');
      return { ...DEFAULTS, ...(data as Partial<SchoolAiSettings> || {}) };
    },
  });

  const settings: SchoolAiSettings = (data as SchoolAiSettings) ?? DEFAULTS;

  return {
    settings,
    enabled: settings.enabled,
    allowedForRole: (role?: string) => !role || settings.allowed_roles.includes(role),
  };
}