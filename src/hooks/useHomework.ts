import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface Homework {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  due_date: string;
  attachments: string[];
  created_at: string;
}

interface RawHomework {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  attachments: string[];
  createdAt: string;
  subject?: { name: string } | null;
}

function mapHomework(raw: RawHomework): Homework {
  return {
    id: raw.id,
    subject: raw.subject?.name ?? '',
    title: raw.title,
    description: raw.description,
    due_date: raw.dueDate,
    attachments: raw.attachments || [],
    created_at: raw.createdAt,
  };
}

// Teacher's own posted homework -- GET /school/homework (schoolId: true) is
// the school-wide admin listing, a different, dead-code hook this session
// removed (zero real callers); this is the only real consumer.
export function useTeacherHomework() {
  return useQuery({
    queryKey: ['teacher-homework'],
    queryFn: async () => {
      const { data } = await api.get<{ homework: RawHomework[] }>('/school/homework', { params: { mine: true } });
      return data.homework.map(mapHomework);
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateHomework() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (homeworkData: {
      class_id: string;
      section_id?: string;
      subject: string;
      title: string;
      description?: string;
      due_date: string;
      attachments?: string[];
    }) => {
      const { data } = await api.post('/school/homework', {
        classId: homeworkData.class_id,
        subject: homeworkData.subject,
        title: homeworkData.title,
        description: homeworkData.description,
        dueDate: homeworkData.due_date,
        attachments: homeworkData.attachments,
      });
      return data.homework;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-homework'] });
      toast.success('Homework posted successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to post homework');
    },
  });
}
