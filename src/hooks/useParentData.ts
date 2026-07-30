import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase (RPCs get_parent_dashboard/get_parent_children,
// direct table queries) to the Express endpoints in routes/parent.js.
//
// Exported shapes (ChildInfo, ChildAttendanceStats, ChildFeeStats) and query
// keys are UNCHANGED so ParentDashboard/ParentFees/etc. need no edits.
//
// useChildHomework no longer takes className/section: the old version did a
// fragile client-side `classes` name lookup to reconstruct what the backend
// already knows from the student's own section -> class relation. The
// Express endpoint resolves that server-side, so callers now just pass
// studentId.
//
// useChildAnnouncements: the Supabase version filtered `is_active = true`.
// Announcement has no isActive column in the current schema, so this now
// returns everything the endpoint sends. Known gap, not a schema change —
// flag before adding a column for it.
// ─────────────────────────────────────────────────────────────────────────

export interface ChildInfo {
  id: string;
  full_name: string;
  class_name: string;
  section: string;
  roll_number: number | null;
  admission_number: string;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  alternate_phone: string | null;
  avatar_url: string | null;
  school_id?: string;
}

export interface ChildAttendanceStats {
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

export interface ChildFeeStats {
  pending: number;
  paid: number;
  overdue: number;
}

/** Raw shape of a student row within GET /api/parent/children */
interface RawStudent {
  id: string;
  firstName: string;
  lastName: string;
  rollNo: string | null;
  admissionNo: string;
  photo: string | null;
  schoolId: string;
  section: { name: string; class: { name: string } };
}

/** Raw shape of the `parent` object in GET /api/parent/children */
interface RawParent {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

function mapChild(raw: RawStudent, parent: RawParent): ChildInfo {
  return {
    id: raw.id,
    full_name: `${raw.firstName} ${raw.lastName}`.trim(),
    class_name: raw.section.class.name,
    section: raw.section.name,
    roll_number: raw.rollNo ? Number(raw.rollNo) || null : null,
    admission_number: raw.admissionNo,
    parent_name: `${parent.firstName} ${parent.lastName}`.trim(),
    parent_email: parent.email,
    parent_phone: parent.phone,
    alternate_phone: null,
    avatar_url: raw.photo,
    school_id: raw.schoolId,
  };
}

async function fetchParentChildren(): Promise<ChildInfo[]> {
  const { data } = await api.get<{ children: RawStudent[]; parent: RawParent }>('/parent/children');
  return data.children.map(c => mapChild(c, data.parent));
}

// Consolidated hook — single call replaces 4+ serial Supabase queries
export function useParentData() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['parent-dashboard', user?.id],
    queryFn: async () => {
      const child = await fetchFirstChild();
      const [attendance, fees, announcements] = await Promise.all([
        child ? fetchAttendanceStats(child.id) : Promise.resolve(null),
        child ? fetchFeeStats(child.id) : Promise.resolve(null),
        fetchAnnouncements(),
      ]);
      return { child, attendance, fees, announcements };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    childProfile: data?.child ?? null,
    attendanceStats: data?.attendance ?? null,
    feeStats: data?.fees ?? null,
    announcements: data?.announcements ?? [],
    fees: [] as any[], // legacy compat — use fee invoices directly where needed
    isLoading,
  };
}

async function fetchFirstChild(): Promise<ChildInfo | null> {
  const children = await fetchParentChildren();
  return children[0] ?? null;
}

// Keep individual hooks for pages that need them standalone
export function useParentChild() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent-child', user?.id],
    queryFn: fetchFirstChild,
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Raw shape of GET /api/parent/attendance/:studentId */
interface RawAttendanceResponse {
  summary: {
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    total: number;
    percentage: number;
  };
}

async function fetchAttendanceStats(studentId: string): Promise<ChildAttendanceStats> {
  const { data } = await api.get<RawAttendanceResponse>(`/parent/attendance/${studentId}`);
  const { present, absent, late, total, percentage } = data.summary;
  return { present, absent, late, total, percentage };
}

export function useChildAttendanceStats(studentId?: string) {
  return useQuery({
    queryKey: ['child-attendance-stats', studentId],
    queryFn: () => {
      if (!studentId) throw new Error('No student ID');
      return fetchAttendanceStats(studentId);
    },
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Raw shape of GET /api/parent/fees/:studentId */
interface RawFeesResponse {
  invoices: Array<{
    dueAmount: number | string;
    paidAmount: number | string;
    dueDate: string;
    status: string;
  }>;
  summary: { totalDue: number; totalPaid: number };
}

async function fetchFeeStats(studentId: string): Promise<ChildFeeStats> {
  const { data } = await api.get<RawFeesResponse>(`/parent/fees/${studentId}`);
  const now = new Date();

  const pending = data.summary.totalDue;
  const paid = data.summary.totalPaid;
  const overdue = data.invoices
    .filter(inv => inv.status !== 'PAID' && new Date(inv.dueDate) < now)
    .reduce((sum, inv) => sum + Number(inv.dueAmount), 0);

  return { pending, paid, overdue };
}

export function useChildFeeStats(studentId?: string) {
  return useQuery({
    queryKey: ['child-fee-stats', studentId],
    queryFn: () => {
      if (!studentId) throw new Error('No student ID');
      return fetchFeeStats(studentId);
    },
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Raw shape of GET /api/parent/homework/:studentId */
interface RawHomeworkResponse {
  homework: any[];
}

async function fetchHomework(studentId: string) {
  const { data } = await api.get<RawHomeworkResponse>(`/parent/homework/${studentId}`);
  return data.homework;
}

export function useChildHomework(studentId?: string) {
  return useQuery({
    queryKey: ['child-homework', studentId],
    queryFn: () => {
      if (!studentId) throw new Error('No student ID');
      return fetchHomework(studentId);
    },
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

async function fetchAnnouncements() {
  const { data } = await api.get<{ announcements: any[] }>('/parent/announcements');
  return data.announcements;
}

export function useChildAnnouncements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['child-announcements', user?.schoolId],
    queryFn: fetchAnnouncements,
    enabled: !!user?.schoolId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
