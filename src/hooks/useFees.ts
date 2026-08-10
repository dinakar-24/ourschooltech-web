import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';

// useFees/useFeeStats/useRecordPayment (the raw Supabase `fees` table
// reads/writes this file used to also export) are gone -- confirmed zero
// importers anywhere in src/ before removing. useFeeInvoices.ts already
// covers everything the flat `fees` table tracked; useCreateFee below is
// the only export anything still calls, and was already fully migrated to
// Express before this cleanup.

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
