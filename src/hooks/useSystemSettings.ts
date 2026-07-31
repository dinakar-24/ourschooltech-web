import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to /api/superadmin/settings — SUPER_ADMIN only,
// both read and write. Every one of the 7 super-admin settings panels that
// use this hook already lives under a SUPER_ADMIN-only route, and grepping
// the whole app found no write call site anywhere outside that folder, so
// this closes the "any school admin could overwrite platform settings" gap
// with no loss of functionality.
//
// The exported shape (settings, isLoading, getSetting, updateSetting) is
// UNCHANGED so none of the 7 consumer files need edits beyond what their
// own migration needs separately (see NotificationSettings.tsx's
// verify-password gate).
//
// Non-super-admin reads do NOT go through this hook — see
// routes/settings.js on the backend for the narrow, explicit-shape
// `/api/settings/theme` (public) and `/api/settings/payment-flags`
// (authenticated) endpoints ThemeProvider.tsx and SettingsPage.tsx use
// instead. The raw table holds real secrets (api_integrations' Razorpay
// keys) and must never be exposed as a blanket passthrough.
// ─────────────────────────────────────────────────────────────────────────

type SettingsMap = Record<string, Record<string, any>>;

export function useSystemSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async (): Promise<SettingsMap> => {
      const { data } = await api.get<{ settings: SettingsMap }>('/superadmin/settings');
      return data.settings;
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, any> }) => {
      await api.put(`/superadmin/settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Settings saved successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to save settings: ' + (error?.response?.data?.error || error.message));
    },
  });

  const getSetting = <T extends Record<string, any>>(key: string, fallback: T): T => {
    return (settings?.[key] as T) ?? fallback;
  };

  return {
    settings,
    isLoading,
    getSetting,
    updateSetting,
  };
}
