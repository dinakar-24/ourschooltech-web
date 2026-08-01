import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Subscription {
  id: string;
  school_id: string;
  razorpay_account_id: string | null;
  plan_type: string;
  student_count: number;
  price_per_student: number;
  total_amount: number;
  total_paid_amount: number;
  status: 'active' | 'expired' | 'pending' | 'trial';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  school?: { id: string; name: string; code: string; city: string | null } | null;
}

export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  school_id: string;
  amount: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  status: 'pending' | 'success' | 'failed';
  paid_at: string | null;
  created_at: string;
  student_count: number | null;
  payment_type: string | null;
}

export function useSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['subscription', user?.schoolId],
    queryFn: async () => {
      const { data } = await api.get<{ subscription: Subscription | null }>('/subscriptions/me');
      return data.subscription;
    },
    enabled: !!user?.schoolId,
  });
}

export function useAllSubscriptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-subscriptions'],
    queryFn: async () => {
      const { data } = await api.get<{ subscriptions: Subscription[] }>('/subscriptions');
      return data.subscriptions;
    },
    enabled: user?.role === 'super_admin',
  });
}

export function useSubscriptionPayments(schoolId?: string) {
  const { user } = useAuth();
  const targetSchoolId = schoolId || user?.schoolId;

  return useQuery({
    queryKey: ['subscription-payments', targetSchoolId],
    queryFn: async () => {
      const { data } = await api.get<{ payments: SubscriptionPayment[] }>('/subscriptions/payments', {
        params: user?.role === 'super_admin' ? { schoolId: targetSchoolId } : undefined,
      });
      return data.payments;
    },
    enabled: !!targetSchoolId,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      schoolId,
      studentCount,
      pricePerStudent,
      status,
      startDate,
      endDate,
    }: {
      schoolId: string;
      studentCount: number;
      pricePerStudent: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      const { data } = await api.post('/subscriptions', {
        schoolId,
        studentCount,
        pricePerStudent,
        status,
        startDate,
        endDate,
      });
      return data.subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['all-subscriptions'] });
      toast.success('Subscription created');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to create subscription');
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      student_count,
      price_per_student,
      status,
      start_date,
      end_date,
    }: {
      id: string;
      student_count?: number;
      price_per_student?: number;
      status?: string;
      start_date?: string | null;
      end_date?: string | null;
    }) => {
      const { data } = await api.patch(`/subscriptions/${id}`, {
        studentCount: student_count,
        pricePerStudent: price_per_student,
        status,
        startDate: start_date,
        endDate: end_date,
      });
      return data.subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['all-subscriptions'] });
      toast.success('Subscription updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to update subscription');
    },
  });
}

export function useSubscriptionStatus() {
  const { data: subscription, isLoading } = useSubscription();

  const isActive = subscription?.status === 'active' || subscription?.status === 'trial';
  const isExpired = subscription?.status === 'expired';
  const daysRemaining = subscription?.end_date
    ? Math.ceil((new Date(subscription.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    subscription,
    isLoading,
    isActive,
    isExpired,
    daysRemaining,
    isNearExpiry: daysRemaining > 0 && daysRemaining <= 30,
  };
}
