import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to /api/queries. The old code only filtered by
// schoolId when isAdmin===true and applied NO filter at all on the
// parent-facing path (relied entirely on invisible Supabase RLS) — ported
// naively that leaks every school's tickets to any parent. The Express
// endpoint derives the scope from req.user.role on the verified JWT, never
// from a client flag: admin sees the whole school, anyone else sees only
// their own submissions. `isAdmin` here is now just a cache-key/display
// hint (kept so QueryPage.tsx/ParentQueries.tsx call sites don't change) —
// it does not and cannot widen what the server actually returns.
//
// The same per-record check applies to GET/POST .../responses too, not
// just the list — a parent can't read or reply into another family's
// ticket by guessing its id.
//
// Status casing: enum values are uppercase on the wire, lowercase in the
// UI — same mapping convention as useAttendance.ts.
// ─────────────────────────────────────────────────────────────────────────

export interface SupportQuery {
  id: string;
  school_id: string;
  submitted_by: string;
  submitter_name: string | null;
  submitter_role: string | null;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueryResponse {
  id: string;
  query_id: string;
  responded_by: string;
  responder_name: string | null;
  response: string;
  created_at: string;
}

interface RawSupportQuery {
  id: string;
  schoolId: string;
  submittedBy: string;
  submitterName: string | null;
  submitterRole: string | null;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawQueryResponse {
  id: string;
  queryId: string;
  respondedBy: string;
  responderName: string | null;
  response: string;
  createdAt: string;
}

const CATEGORY_TO_API: Record<string, string> = { general: 'GENERAL', fees: 'FEES', transport: 'TRANSPORT', academics: 'ACADEMICS' };
const CATEGORY_FROM_API: Record<string, string> = { GENERAL: 'general', FEES: 'fees', TRANSPORT: 'transport', ACADEMICS: 'academics' };
const PRIORITY_TO_API: Record<string, string> = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH' };
const PRIORITY_FROM_API: Record<string, string> = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };
const STATUS_TO_API: Record<string, string> = { open: 'OPEN', in_progress: 'IN_PROGRESS', resolved: 'RESOLVED', closed: 'CLOSED' };
const STATUS_FROM_API: Record<string, string> = { OPEN: 'open', IN_PROGRESS: 'in_progress', RESOLVED: 'resolved', CLOSED: 'closed' };

function mapQuery(raw: RawSupportQuery): SupportQuery {
  return {
    id: raw.id,
    school_id: raw.schoolId,
    submitted_by: raw.submittedBy,
    submitter_name: raw.submitterName,
    submitter_role: raw.submitterRole,
    ticket_number: raw.ticketNumber,
    subject: raw.subject,
    description: raw.description,
    category: CATEGORY_FROM_API[raw.category] ?? raw.category.toLowerCase(),
    priority: PRIORITY_FROM_API[raw.priority] ?? raw.priority.toLowerCase(),
    status: STATUS_FROM_API[raw.status] ?? raw.status.toLowerCase(),
    assigned_to: raw.assignedTo,
    resolved_at: raw.resolvedAt,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

function mapResponse(raw: RawQueryResponse): QueryResponse {
  return {
    id: raw.id,
    query_id: raw.queryId,
    responded_by: raw.respondedBy,
    responder_name: raw.responderName,
    response: raw.response,
    created_at: raw.createdAt,
  };
}

export function useSupportQueryList(isAdmin = false) {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['support-queries', schoolId, isAdmin],
    queryFn: async () => {
      const { data } = await api.get<{ queries: RawSupportQuery[] }>('/queries');
      return data.queries.map(mapQuery);
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useQueryResponses(queryId?: string) {
  return useQuery({
    queryKey: ['query-responses', queryId],
    queryFn: async () => {
      if (!queryId) return [];
      const { data } = await api.get<{ responses: RawQueryResponse[] }>(`/queries/${queryId}/responses`);
      return data.responses.map(mapResponse);
    },
    enabled: !!queryId,
  });
}

export function useSubmitQuery() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { subject: string; description: string; category: string; priority: string }) => {
      await api.post('/queries', {
        subject: data.subject,
        description: data.description,
        category: CATEGORY_TO_API[data.category] ?? data.category.toUpperCase(),
        priority: PRIORITY_TO_API[data.priority] ?? data.priority.toUpperCase(),
        submitterName: user?.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-queries'] });
      toast.success('Query submitted successfully');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useRespondToQuery() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ queryId, response }: { queryId: string; response: string }) => {
      await api.post(`/queries/${queryId}/responses`, { response, responderName: user?.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['query-responses'] });
      toast.success('Response sent');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useUpdateQueryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/queries/${id}/status`, { status: STATUS_TO_API[status] ?? status.toUpperCase() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-queries'] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}
