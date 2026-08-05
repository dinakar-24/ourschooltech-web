import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// Migrated off raw supabase.from('school_payment_config') calls to real
// Express routes. Also a real design change, not just a port: the old
// schema modeled each school connecting its own Cashfree merchant account
// (app_id/secret_key, submitted for Super Admin approval). That workflow
// was never actually wired to payment processing -- payment.controller.js
// has always used one shared platform Cashfree account
// (CASHFREE_APP_ID/SECRET_KEY env vars), so per-school credentials were
// dead weight. What's real and worth keeping: each school's own online/
// manual toggle, a Super Admin override on top, and (new) a required
// per-school surcharge-free threshold below which the online gateway fee
// isn't charged.
// ─────────────────────────────────────────────────────────────────────────

export interface EffectivePaymentConfig {
  onlineEnabled: boolean;
  manualEnabled: boolean;
  surchargePct: number;
  surchargeFreeThreshold: number | null;
}

/** Parent/student-facing: resolved values only, school derived server-side. */
export function usePaymentConfig() {
  return useQuery({
    queryKey: ['payment-config'],
    queryFn: async (): Promise<EffectivePaymentConfig> => {
      const { data } = await api.get<{ config: EffectivePaymentConfig }>('/parent/payment-config');
      return data.config;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface SchoolPaymentConfig {
  id: string;
  schoolId: string;
  onlineEnabled: boolean;
  manualEnabled: boolean;
  surchargeFreeThreshold: number;
  superAdminOverrideOnline: boolean | null;
  superAdminOverrideManual: boolean | null;
  updatedAt: string;
}

interface SchoolPaymentConfigResponse {
  config: SchoolPaymentConfig | null;
  effective: EffectivePaymentConfig;
}

/** School Admin's own config -- raw settings plus what's actually in effect. */
export function useSchoolPaymentConfig() {
  return useQuery({
    queryKey: ['school-payment-config'],
    queryFn: async (): Promise<SchoolPaymentConfigResponse> => {
      const { data } = await api.get<SchoolPaymentConfigResponse>('/school/payment-config');
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdatePaymentConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { onlineEnabled?: boolean; manualEnabled?: boolean; surchargeFreeThreshold?: number }) => {
      const { data } = await api.patch<{ config: SchoolPaymentConfig }>('/school/payment-config', payload);
      return data.config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-payment-config'] });
      toast.success('Payment settings saved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to save payment settings'),
  });
}

export interface SchoolPaymentConfigOverview {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  config: SchoolPaymentConfig | null;
  effective: EffectivePaymentConfig;
}

/** Super Admin oversight: every school's config + resolved status. */
export function useAllSchoolPaymentConfigs() {
  return useQuery({
    queryKey: ['all-school-payment-configs'],
    queryFn: async () => {
      const { data } = await api.get<{ configs: SchoolPaymentConfigOverview[] }>('/superadmin/payment-configs');
      return data.configs;
    },
  });
}

export function useSetPaymentOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ schoolId, field, value }: { schoolId: string; field: 'online' | 'manual'; value: boolean | null }) => {
      await api.patch(`/superadmin/payment-configs/${schoolId}/override`, { field, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-school-payment-configs'] });
      toast.success('Override updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update override'),
  });
}
