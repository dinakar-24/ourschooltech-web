import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ParentInvoice {
  id: string;
  student_id: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  due_date: string;
  components?: { id: string; fee_type: string; amount: number }[];
  payments?: {
    id: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    receipt_number: string;
    transaction_id: string | null;
    notes: string | null;
    created_at: string;
  }[];
  // FeeInvoice has no discount rows to return -- applyDiscount lowers
  // dueAmount directly and logs reason/notes to AuditLog instead. Always
  // empty until/unless discounts get their own structured record.
  discounts?: { id: string; discount_amount: number; reason: string; notes: string | null; created_at: string }[];
}

interface RawInvoice {
  id: string;
  studentId: string;
  totalAmount: string | number;
  paidAmount: string | number;
  dueAmount: string | number;
  dueDate: string;
  status: string;
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

function mapInvoice(raw: RawInvoice): ParentInvoice {
  return {
    id: raw.id,
    student_id: raw.studentId,
    total_amount: num(raw.totalAmount),
    paid_amount: num(raw.paidAmount),
    balance: num(raw.dueAmount),
    status: String(raw.status || '').toLowerCase(),
    due_date: raw.dueDate,
    components: (raw.items || []).map(i => ({ id: i.id, fee_type: i.name, amount: num(i.amount) })),
    payments: (raw.payments || []).map(p => ({
      id: p.id,
      amount: num(p.amount),
      payment_method: p.method,
      payment_date: p.paidAt ?? p.createdAt,
      receipt_number: p.receiptNo ?? '',
      transaction_id: p.transactionId,
      notes: null,
      created_at: p.createdAt,
    })),
    discounts: [],
  };
}

export function useParentInvoices(studentId?: string) {
  return useQuery({
    queryKey: ['parent-invoices', studentId],
    queryFn: async (): Promise<ParentInvoice[]> => {
      const { data } = await api.get<{ invoices: RawInvoice[] }>(`/parent/fees/${studentId}`);
      return data.invoices.map(mapInvoice);
    },
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
