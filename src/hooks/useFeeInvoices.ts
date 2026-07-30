import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to /api/school/fees/*.
//
// Safe across portals despite the name: ParentFees imports only the
// FeeInvoice / FeePayment *types* from here and fetches through
// useParentInvoices. So the coupling is type-level — these interfaces must
// stay renderable by ParentFees, but no parent ever hits /api/school/*
// (which is staff-only and would 403).
//
// useCreateInvoice is the one export still on Supabase — see its note.
// ─────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────

export interface InvoiceComponent {
  id: string;
  invoice_id: string;
  fee_type: string;
  amount: number;
}

export interface FeePayment {
  id: string;
  invoice_id: string;
  student_id: string;
  school_id: string;
  amount: number;
  payment_method: string;
  transaction_id: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  bank_name: string | null;
  payment_date: string;
  received_by: string | null;
  receipt_number: string;
  notes: string | null;
  created_at: string;
}

export interface FeeInvoice {
  id: string;
  school_id: string;
  student_id: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  due_date: string;
  created_at: string;
  student?: {
    id: string;
    full_name: string;
    class_name: string;
    section: string;
    admission_number: string;
    parent_name?: string | null;
    parent_email?: string | null;
    roll_number?: number | null;
  };
  components?: InvoiceComponent[];
  payments?: FeePayment[];
}

export interface InvoiceStats {
  totalDue: number;
  collected: number;
  pending: number;
  overdue: number;
}

interface InvoiceFilters {
  status?: string;
  search?: string;
  className?: string;
  page?: number;
  pageSize?: number;
}

// ─── Raw API shapes + mapping ────────────────────────────────────────

interface RawInvoice {
  id: string;
  schoolId: string;
  studentId: string;
  invoiceNo: string;
  totalAmount: string | number;
  paidAmount: string | number;
  dueAmount: string | number;
  dueDate: string;
  status: string;
  createdAt: string;
  student?: {
    id?: string;
    firstName: string;
    lastName: string;
    admissionNo: string;
    rollNo: string | null;
    section?: { name: string; class?: { name: string } | null } | null;
    parents?: Array<{ firstName: string; lastName: string; user?: { email: string } | null }>;
  } | null;
  items?: Array<{ id: string; name: string; amount: string | number }>;
  payments?: Array<{
    id: string;
    amount: string | number;
    method: string;
    transactionId: string | null;
    receiptNo: string | null;
    paidAt: string | null;
    createdAt: string;
  }>;
}

const num = (v: string | number | null | undefined) => Number(v ?? 0);

function mapInvoice(raw: RawInvoice): FeeInvoice {
  const s = raw.student;
  const parent = s?.parents?.[0] ?? null;

  return {
    id: raw.id,
    school_id: raw.schoolId,
    student_id: raw.studentId,
    total_amount: num(raw.totalAmount),
    paid_amount: num(raw.paidAmount),
    // Prisma calls the outstanding balance dueAmount.
    balance: num(raw.dueAmount),
    // Enum is uppercase; the UI compares against lowercase throughout.
    status: String(raw.status || '').toLowerCase(),
    due_date: raw.dueDate,
    created_at: raw.createdAt,
    student: s
      ? {
          id: s.id ?? raw.studentId,
          full_name: `${s.firstName} ${s.lastName}`.trim(),
          class_name: s.section?.class?.name ?? '',
          section: s.section?.name ?? '',
          admission_number: s.admissionNo,
          parent_name: parent ? `${parent.firstName} ${parent.lastName}`.trim() : null,
          parent_email: parent?.user?.email ?? null,
          roll_number: s.rollNo ? Number(s.rollNo) || null : null,
        }
      : undefined,
    // FeeInvoiceItem.name carries what the UI calls fee_type.
    components: (raw.items || []).map(i => ({
      id: i.id,
      invoice_id: raw.id,
      fee_type: i.name,
      amount: num(i.amount),
    })),
    payments: (raw.payments || []).map(p => ({
      id: p.id,
      invoice_id: raw.id,
      student_id: raw.studentId,
      school_id: raw.schoolId,
      amount: num(p.amount),
      payment_method: String(p.method || '').toLowerCase(),
      transaction_id: p.transactionId,
      payment_date: p.paidAt ?? p.createdAt,
      receipt_number: p.receiptNo ?? '',
      created_at: p.createdAt,
      // ⚠️ Prisma's Payment model has no columns for these — they render
      // blank until a schema migration adds them.
      cheque_number: null,
      cheque_date: null,
      bank_name: null,
      received_by: null,
      notes: null,
    })),
  };
}

// ─── Fee Invoices ────────────────────────────────────────────────────


export function useFeeInvoices(filters?: InvoiceFilters) {
  const schoolId = useEffectiveSchoolId();
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 25;

  return useQuery({
    queryKey: queryKeys.feeInvoices(schoolId, filters),
    queryFn: async () => {
      if (!schoolId) return { data: [] as FeeInvoice[], totalCount: 0 };

      const { data } = await api.get('/school/fees/invoices', {
        params: {
          page,
          limit: pageSize,
          // Backend normalises case and rejects anything outside the
          // InvoiceStatus enum, so 'overdue' maps straight through — no more
          // client-side "pending AND past due date" reconstruction.
          status: filters?.status && filters.status !== 'all' ? filters.status : undefined,
          search: filters?.search || undefined,
        },
      });

      let rows = (data.invoices as RawInvoice[]).map(mapInvoice);

      // ⚠️ No class filter on the endpoint — applied to this page's rows only,
      // so it is NOT reliable across pages (same caveat as useStudents).
      if (filters?.className && filters.className !== 'all') {
        rows = rows.filter(r => r.student?.class_name === filters.className);
      }

      // totalCount is now exact; the old code estimated it with a
      // "+1 if the page looks full" hack because Supabase didn't return it.
      return { data: rows, totalCount: data.pagination.total as number };
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Invoice Stats ───────────────────────────────────────────────────

export function useInvoiceStats() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: queryKeys.invoiceStats(schoolId),
    queryFn: async (): Promise<InvoiceStats> => {
      if (!schoolId) return { totalDue: 0, collected: 0, pending: 0, overdue: 0 };

      const { data } = await api.get('/school/fees/summary');
      const s = data.summary ?? {};

      // ⚠️ Semantic mismatch worth knowing about: the UI renders all four of
      // these as currency, but /fees/summary returns two amounts and two
      // COUNTS — `pendingInvoices` and `overdueInvoices` are invoice counts,
      // not rupee totals. Mapped straight across so nothing is invented;
      // getFeeSummary needs to sum dueAmount for those tiles to be correct.
      return {
        totalDue: Number(s.totalAmount ?? 0),
        collected: Number(s.collectedAmount ?? 0),
        pending: Number(s.pendingInvoices ?? 0),
        overdue: Number(s.overdueInvoices ?? 0),
      };
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Create Invoice ──────────────────────────────────────────────────

/**
 * ⚠️ NOT MIGRATED — BLOCKED on a required FK, still on Supabase.
 *
 * `POST /api/school/fees/invoices` builds its line items as
 * `FeeInvoiceItem { feeStructureId, name, amount }`, and `feeStructureId` is
 * a **required** relation. CreateInvoiceDialog collects `fee_type` as free
 * text with no fee-structure reference, so there is nothing to send.
 *
 * Two ways out, both outside this batch:
 *   - make `FeeInvoiceItem.feeStructureId` optional (schema migration), or
 *   - have the dialog pick from GET /school/fees/structures (a UI change,
 *     which the project rules exclude).
 *
 * Left on Supabase deliberately rather than shipping an endpoint call that
 * would fail its foreign key on every submit.
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const schoolId = useEffectiveSchoolId();

  return useMutation({
    mutationFn: async (invoiceData: {
      student_id: string;
      due_date: string;
      components: { fee_type: string; amount: number }[];
    }) => {
      if (!schoolId) throw new Error('No school ID');
      const totalAmount = invoiceData.components.reduce((s, c) => s + c.amount, 0);

      const { data: invoice, error: invErr } = await supabase
        .from('fee_invoices')
        .insert({
          school_id: schoolId,
          student_id: invoiceData.student_id,
          total_amount: totalAmount,
          paid_amount: 0,
          balance: totalAmount,
          status: 'pending',
          due_date: invoiceData.due_date,
        } as any)
        .select()
        .single();

      if (invErr) throw invErr;

      const comps = invoiceData.components.map((c) => ({
        invoice_id: invoice.id,
        fee_type: c.fee_type,
        amount: c.amount,
      }));

      const { error: compErr } = await supabase.from('fee_invoice_components').insert(comps);
      if (compErr) throw compErr;

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allFeeInvoices });
      queryClient.invalidateQueries({ queryKey: queryKeys.allInvoiceStats });
      toast.success('Invoice created');
    },
  });
}

// ─── Apply Discount (via RPC) ────────────────────────────────────────

export function useApplyDiscount() {
  const queryClient = useQueryClient();
  const schoolId = useEffectiveSchoolId();

  return useMutation({
    mutationFn: async (params: {
      invoice_id: string;
      student_id: string;
      discount_amount: number;
      reason: string;
      notes?: string;
    }) => {
      if (!schoolId) throw new Error('No school ID');

      // Replaces the apply_fee_discount RPC. The endpoint recomputes
      // dueAmount and status server-side in one update.
      //
      // `reason` and `notes` are persisted on an AuditLog row rather than on
      // FeeInvoice (which has no columns for them) — so both survive, they
      // just live in the audit trail. An earlier version of this comment said
      // notes couldn't be persisted and dropped the field; that predated the
      // AuditLog write being added to applyDiscount.
      const { data } = await api.post(`/school/fees/invoices/${params.invoice_id}/discount`, {
        amount: params.discount_amount,
        reason: params.reason,
        notes: params.notes || null,
      });
      return data.invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allFeeInvoices });
      queryClient.invalidateQueries({ queryKey: queryKeys.allInvoiceStats });
      toast.success('Discount applied successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to apply discount');
    },
  });
}

// ─── Record Payment (via RPC) ────────────────────────────────────────

export function useRecordInvoicePayment() {
  const queryClient = useQueryClient();
  const schoolId = useEffectiveSchoolId();

  return useMutation({
    mutationFn: async (payment: {
      invoice_id: string;
      student_id: string;
      amount: number;
      payment_method: string;
      transaction_id?: string;
      cheque_number?: string;
      cheque_date?: string;
      bank_name?: string;
      payment_date: string;
      received_by?: string;
      notes?: string;
    }) => {
      if (!schoolId) throw new Error('No school ID');

      // ⚠️ Prisma's Payment model has no columns for cheque_number,
      // cheque_date, bank_name, received_by or notes, and the endpoint takes
      // no payment_date (it stamps paidAt itself). Those five inputs are
      // accepted by the dialog but **silently dropped** until a schema
      // migration adds them — the payment amount and receipt are unaffected.
      const { data } = await api.post(`/school/fees/invoices/${payment.invoice_id}/pay`, {
        amount: payment.amount,
        // PaymentMethod is an uppercase Prisma enum.
        method: String(payment.payment_method || '').toUpperCase(),
        remarks: payment.notes || undefined,
      });

      return data.payment ?? data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allFeeInvoices });
      queryClient.invalidateQueries({ queryKey: queryKeys.allInvoiceStats });
      toast.success(`Payment recorded! Receipt: ${data?.receiptNo ?? data?.receipt_number ?? ''}`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to record payment');
    },
  });
}
