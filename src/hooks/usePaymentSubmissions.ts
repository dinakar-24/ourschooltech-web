import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface PaymentSubmission {
  id: string;
  school_id: string;
  invoice_id: string;
  student_id: string;
  submitted_by: string;
  amount: number;
  payment_method: string | null;
  transaction_id: string;
  screenshot_url: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  notes: string | null;
  // joined
  student?: { full_name: string; admission_number: string; class_name: string; section: string };
  invoice?: { total_amount: number; balance: number; due_date: string; term?: { name: string } };
}

/** Admin: fetch pending submissions for their school */
export function usePaymentSubmissions(status?: string) {
  return useQuery({
    queryKey: ['payment-submissions', status],
    queryFn: async (): Promise<PaymentSubmission[]> => {
      const { data } = await api.get('/school/fees/payment-submissions', {
        params: status ? { status } : undefined,
      });
      return data.submissions as PaymentSubmission[];
    },
  });
}

/** Parent: fetch own submissions for a student */
export function useParentPaymentSubmissions(studentId?: string) {
  return useQuery({
    queryKey: ['parent-payment-submissions', studentId],
    queryFn: async (): Promise<PaymentSubmission[]> => {
      const { data } = await api.get('/parent/payment-submissions', {
        params: { student_id: studentId },
      });
      return data.submissions as PaymentSubmission[];
    },
    enabled: !!studentId,
  });
}

/** Parent: submit payment proof */
export function useSubmitPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      school_id: string;
      invoice_id: string;
      student_id: string;
      amount: number;
      payment_method: string;
      transaction_id: string;
      screenshot_url?: string;
      notes?: string;
      fee_invoice_item_ids?: string[];
    }) => {
      const { school_id, ...body } = params;
      void school_id; // schoolId is derived server-side from the caller's JWT, not sent
      await api.post('/parent/payment-submissions', body);
    },
    onSuccess: () => {
      toast.success('Payment proof submitted! Admin will verify shortly.');
      qc.invalidateQueries({ queryKey: ['parent-payment-submissions'] });
      qc.invalidateQueries({ queryKey: ['parent-invoices'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

/** Admin: approve a submission (records a real Payment against the invoice) */
export function useApproveSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submission: PaymentSubmission) => {
      await api.patch(`/school/fees/payment-submissions/${submission.id}/approve`);
    },
    onSuccess: () => {
      toast.success('Payment approved and receipt generated!');
      qc.invalidateQueries({ queryKey: ['payment-submissions'] });
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
    onError: (e: any) => toast.error(`Approval failed: ${e?.response?.data?.error || e.message}`),
  });
}

/** Admin: reject a submission with reason */
export function useRejectSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.patch(`/school/fees/payment-submissions/${id}/reject`, { reason });
    },
    onSuccess: () => {
      toast.success('Submission rejected.');
      qc.invalidateQueries({ queryKey: ['payment-submissions'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}
