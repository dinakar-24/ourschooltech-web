import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to /api/feedback — same role-derived scoping fix
// as useSupportQueries.ts: admin sees the whole school, anyone else sees
// only their own submissions, decided server-side from req.user.role, not
// a client-supplied isAdmin flag. `isAdmin` here is now just a cache-key/
// display hint.
//
// One-way by design, not a gap: parents submit and can view admin
// responses, but never reply back (ParentFeedback.tsx has no respond
// capability — unlike support queries, which are a real two-way thread).
//
// Status casing: UNREAD/READ on the wire, lowercase in the UI.
// ─────────────────────────────────────────────────────────────────────────

export interface Feedback {
  id: string;
  school_id: string;
  submitted_by: string | null;
  submitter_name: string | null;
  submitter_role: string | null;
  rating: number;
  message: string;
  is_anonymous: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FeedbackResponse {
  id: string;
  feedback_id: string;
  responded_by: string | null;
  response: string;
  created_at: string;
}

interface RawFeedback {
  id: string;
  schoolId: string;
  submittedBy: string;
  submitterName: string | null;
  submitterRole: string | null;
  rating: number;
  message: string;
  isAnonymous: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface RawFeedbackResponse {
  id: string;
  feedbackId: string;
  respondedBy: string | null;
  response: string;
  createdAt: string;
}

const STATUS_FROM_API: Record<string, string> = { UNREAD: 'unread', READ: 'read' };

function mapFeedback(raw: RawFeedback): Feedback {
  return {
    id: raw.id,
    school_id: raw.schoolId,
    submitted_by: raw.submittedBy,
    submitter_name: raw.submitterName,
    submitter_role: raw.submitterRole,
    rating: raw.rating,
    message: raw.message,
    is_anonymous: raw.isAnonymous,
    status: STATUS_FROM_API[raw.status] ?? raw.status.toLowerCase(),
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

function mapResponse(raw: RawFeedbackResponse): FeedbackResponse {
  return {
    id: raw.id,
    feedback_id: raw.feedbackId,
    responded_by: raw.respondedBy,
    response: raw.response,
    created_at: raw.createdAt,
  };
}

export function useFeedbackList(isAdmin = false) {
  const schoolId = useEffectiveSchoolId();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['feedback', schoolId, isAdmin, user?.id],
    queryFn: async () => {
      const { data } = await api.get<{ feedback: RawFeedback[] }>('/feedback');
      return data.feedback.map(mapFeedback);
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFeedbackResponses(feedbackId?: string) {
  return useQuery({
    queryKey: ['feedback-responses', feedbackId],
    queryFn: async () => {
      if (!feedbackId) return [];
      const { data } = await api.get<{ responses: RawFeedbackResponse[] }>(`/feedback/${feedbackId}/responses`);
      return data.responses.map(mapResponse);
    },
    enabled: !!feedbackId,
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { rating: number; message: string; is_anonymous: boolean }) => {
      await api.post('/feedback', {
        rating: data.rating,
        message: data.message,
        isAnonymous: data.is_anonymous,
        submitterName: data.is_anonymous ? undefined : user?.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback submitted successfully');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useRespondToFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ feedbackId, response }: { feedbackId: string; response: string }) => {
      await api.post(`/feedback/${feedbackId}/responses`, { response });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-responses'] });
      toast.success('Response sent');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useMarkFeedbackRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/feedback/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}
