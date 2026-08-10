import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to GET /api/superadmin/users.
//
// This replaces roughly seven chained queries (profiles + user_roles +
// schools + students, plus email-matching to link parents to children) with
// one call. The parent↔student links are now real foreign keys instead of
// comparing `students.parent_email` strings.
//
// The returned object is unchanged, so AllUsersPage needs no edits.
//
// ⚠️ Two behavioural differences, both structural:
//  1. `roles` is ALWAYS exactly one element. Supabase's `user_roles` was
//     many-to-many; Express `User.role` is a single required enum. As a
//     result `no_role` is permanently 0 and the "No role" filter tab is dead
//     UI — it can never return a row. Worth removing from AllUsersPage in a
//     later cleanup.
//  2. Ordering is by email, not name. There is no single sortable name column
//     — names live across four profile tables. Name *search* still works (the
//     endpoint ORs across all four), but the list is no longer alphabetical
//     by person.
// ─────────────────────────────────────────────────────────────────────────

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  school_id: string | null;
  avatar_url: string | null;
  school_name?: string;
  roles: string[];
  linked_students?: string[];
  linked_parent_name?: string;
  linked_parent_email?: string;
}

interface RoleCounts {
  all: number;
  super_admin: number;
  school_admin: number;
  teacher: number;
  parent: number;
  student: number;
  no_role: number;
}

interface UseAllUsersOptions {
  page: number;
  pageSize: number;
  searchQuery: string;
  roleFilter: string | null;
  // Scope to one school (SchoolUsersPage's Super Admin cross-school view)
  // instead of the platform-wide default (AllUsersPage/PlatformUsersPage).
  schoolId?: string;
}

interface UseAllUsersResult {
  users: UserWithRole[];
  totalCount: number;
  roleCounts: RoleCounts;
  loading: boolean;
  refetch: () => void;
  removeUser: (userId: string) => void;
}

/** Raw row from GET /api/superadmin/users */
export interface RawUser {
  id: string;
  email: string;
  fullName: string;
  schoolId: string | null;
  schoolName: string | null;
  avatarUrl: string | null;
  roles: string[];
  linkedStudents?: string[];
  linkedParentName?: string;
  linkedParentEmail?: string | null;
}

const EMPTY_COUNTS: RoleCounts = {
  all: 0, super_admin: 0, school_admin: 0, teacher: 0, parent: 0, student: 0, no_role: 0,
};

export function mapUser(raw: RawUser): UserWithRole {
  return {
    id: raw.id,
    email: raw.email,
    full_name: raw.fullName,
    school_id: raw.schoolId,
    avatar_url: raw.avatarUrl,
    school_name: raw.schoolName ?? undefined,
    roles: raw.roles ?? [],
    linked_students: raw.linkedStudents,
    linked_parent_name: raw.linkedParentName,
    linked_parent_email: raw.linkedParentEmail ?? undefined,
  };
}

export function useAllUsers({ page, pageSize, searchQuery, roleFilter, schoolId }: UseAllUsersOptions): UseAllUsersResult {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Counts come back with every page, so the separate get_role_counts
      // round trip the old hook made on mount is gone.
      const { data } = await api.get('/superadmin/users', {
        params: {
          page,
          limit: pageSize,
          search: searchQuery || undefined,
          role: roleFilter || undefined,
          schoolId: schoolId || undefined,
        },
      });

      setUsers((data.users as RawUser[]).map(mapUser));
      setTotalCount(data.pagination.total as number);
      setRoleCounts({ ...EMPTY_COUNTS, ...(data.roleCounts || {}) });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(error?.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, roleFilter, schoolId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const removeUser = useCallback((userId: string) => {
    // Optimistic local removal; the next fetch reconciles counts.
    setUsers(prev => prev.filter(u => u.id !== userId));
    setTotalCount(prev => Math.max(0, prev - 1));
    setRoleCounts(prev => ({ ...prev, all: Math.max(0, prev.all - 1) }));
  }, []);

  return { users, totalCount, roleCounts, loading, refetch: fetchUsers, removeUser };
}
