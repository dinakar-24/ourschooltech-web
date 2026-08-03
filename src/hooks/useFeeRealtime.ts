import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

// Migrated from a Supabase Realtime subscription (postgres_changes across
// fee_invoices/fee_payments/fee_discounts/payment_submissions/fees/
// online_payments) to a poll — Express has no Realtime equivalent, and with
// no Supabase session the old channel could never fire again, so this was a
// silent no-op. Same 60s-poll shape as useNotifications.ts. Exported
// signature unchanged, so FeesPage/StudentFeesPage/ParentFees need no edits.
const POLL_INTERVAL_MS = 60_000;

interface UseFeeRealtimeOptions {
  schoolId?: string;
  studentId?: string;
  scope: string;
  enabled?: boolean;
}

export function useFeeRealtime({ schoolId, studentId, scope, enabled = true }: UseFeeRealtimeOptions) {
  const queryClient = useQueryClient();

  const target = useMemo(() => {
    if (studentId) {
      return { column: 'student_id', value: studentId };
    }

    if (schoolId) {
      return { column: 'school_id', value: schoolId };
    }

    return null;
  }, [schoolId, studentId]);

  useEffect(() => {
    if (!enabled || !target?.value) return;

    const handleFeeChange = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allFeeInvoices });
      queryClient.invalidateQueries({ queryKey: queryKeys.allInvoiceStats });
      queryClient.invalidateQueries({ queryKey: ['student-fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payment-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['parent-payment-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['parent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      queryClient.invalidateQueries({ queryKey: ['fee-stats'] });
      queryClient.invalidateQueries({ queryKey: ['parent-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['parent-data'] });
    };

    const interval = setInterval(handleFeeChange, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, queryClient, scope, target]);
}