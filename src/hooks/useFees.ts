import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { getSupabaseRange } from './usePagination';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';

export interface FeeRecord {
  id: string;
  student_id: string;
  school_id: string;
  fee_type: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  transaction_id: string | null;
  receipt_number: string | null;
  created_at: string;
  updated_at: string;
  student?: {
    id: string;
    full_name: string;
    class_name: string;
    section: string;
    admission_number: string;
  };
}

export interface FeeStats {
  totalDue: number;
  collected: number;
  pending: number;
  overdue: number;
}

interface FeeFilters {
  status?: string;
  feeType?: string;
  className?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedFees {
  data: FeeRecord[];
  totalCount: number;
}

export function useFees(filters?: FeeFilters) {
  const schoolId = useEffectiveSchoolId();
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 25;

  return useQuery({
    queryKey: ['fees', schoolId, filters],
    queryFn: async (): Promise<PaginatedFees> => {
      if (!schoolId) return { data: [], totalCount: 0 };

      let query = supabase
        .from('fees')
        .select(`
          id, student_id, school_id, fee_type, amount, due_date, paid_date, status, payment_method, transaction_id, receipt_number, created_at, updated_at,
          student:students!inner(id, full_name, class_name, section, admission_number)
        `)
        .eq('school_id', schoolId)
        .order('due_date', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.feeType && filters.feeType !== 'All Types') {
        query = query.eq('fee_type', filters.feeType);
      }

      if (filters?.className && filters.className !== 'all') {
        query = query.eq('student.class_name', filters.className);
      }

      if (filters?.search) {
        query = query.or(
          `student.full_name.ilike.%${filters.search}%,student.admission_number.ilike.%${filters.search}%`,
          { foreignTable: 'student' }
        );
      }

      const { from, to } = getSupabaseRange(page, pageSize);
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;
      return { data: (data || []) as FeeRecord[], totalCount: from + (data?.length ?? 0) + ((data?.length ?? 0) === pageSize ? 1 : 0) };
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useFeeStats() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['fee-stats', schoolId],
    queryFn: async (): Promise<FeeStats> => {
      if (!schoolId) {
        return { totalDue: 0, collected: 0, pending: 0, overdue: 0 };
      }

      const { data, error } = await supabase.rpc('get_fee_stats' as any, {
        _school_id: schoolId,
      } as any);

      if (error) throw error;

      const result = data as any;
      return {
        totalDue: Number(result?.totalDue ?? 0),
        collected: Number(result?.collected ?? 0),
        pending: Number(result?.pending ?? 0),
        overdue: Number(result?.overdue ?? 0),
      };
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const schoolId = useEffectiveSchoolId();

  return useMutation({
    mutationFn: async ({
      feeId,
      paymentMethod,
      transactionId,
    }: {
      feeId: string;
      paymentMethod: string;
      transactionId?: string;
    }) => {
      const { data, error } = await supabase
        .from('fees')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
          payment_method: paymentMethod,
          transaction_id: transactionId || null,
        })
        .eq('id', feeId)
        .eq('school_id', schoolId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['fee-stats'] });
    },
  });
}

// Migrated to Express — same fix as useCreateInvoice (FeeInvoiceItem.
// feeStructureId relaxed to optional, see that hook's note), just called
// with a single item instead of a caller-built list. Old fee_type/amount
// row becomes a one-item FeeInvoice via the same POST /school/fees/invoices
// endpoint useCreateInvoice already uses — no separate backend flow.
//
// The old client-side notification block queried Supabase `students`/
// `profiles` by the *old* Supabase ids, the same wrong-id-space bug flagged
// on send-notification.ts's other pre-migration callers — dropped rather
// than ported forward, matching useCreateInvoice, which never had this
// notification step either.
export function useCreateFee() {
  const queryClient = useQueryClient();
  const schoolId = useEffectiveSchoolId();

  return useMutation({
    mutationFn: async (feeData: {
      student_id: string;
      fee_type: string;
      amount: number;
      due_date: string;
    }) => {
      if (!schoolId) throw new Error('No school ID');

      const { data } = await api.post('/school/fees/invoices', {
        studentId: feeData.student_id,
        dueDate: feeData.due_date,
        items: [{ name: feeData.fee_type, amount: feeData.amount }],
      });

      return data.invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['fee-stats'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.allFeeInvoices });
      queryClient.invalidateQueries({ queryKey: queryKeys.allInvoiceStats });
      toast.success('Fee assigned');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to assign fee');
    },
  });
}
