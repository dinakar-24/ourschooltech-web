import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to the Express backend.
//
// Why: the Supabase `schools` table is governed by the RLS policy
// "Users can view their own school" (TO authenticated,
// USING id = get_user_school_id(auth.uid())). Once login moved to Express
// there is no Supabase session, so these queries ran as `anon` and RLS
// returned an EMPTY SET rather than an error — the page showed 0 schools
// while the data was intact. See migration 20260208003158.
//
// External shapes (`School`, `SchoolFormData`, `PaginatedSchools`) and the
// query keys are unchanged, so SchoolsPage.tsx needs no edits.
// ─────────────────────────────────────────────────────────────────────────

export interface School {
  id: string;
  name: string;
  code: string;
  subdomain: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  logo: string | null;
  is_active: boolean | null;
  student_limit: number | null;
  subscription_status: string | null;
  created_at: string;
}

export interface SchoolFormData {
  name: string;
  code: string;
  subdomain: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logo: string;
  primary_color: string;
  accent_color: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
}

interface SchoolFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  city?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSchools {
  data: School[];
  totalCount: number;
}

/** Raw row from GET /api/superadmin/schools. */
interface RawSchool {
  id: string;
  name: string;
  subdomain: string;
  schoolCode: string;
  logo: string | null;
  primaryColor: string;
  address?: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  board: string | null;
  isActive: boolean;
  isSuspended: boolean;
  subscriptionPlan: string | null;
  subscriptionEnd: string | null;
  createdAt: string;
  _count?: { students: number; teachers: number; users: number };
}

function mapSchool(raw: RawSchool): School {
  return {
    id: raw.id,
    name: raw.name,
    code: raw.schoolCode,
    subdomain: raw.subdomain,
    // ⚠️ Gap: getSchools()'s `select` does not include `address`, so this is
    // empty in list responses. Add it to the controller's select if the UI
    // needs it — the column does exist on the model.
    address: raw.address ?? '',
    city: raw.city ?? '',
    phone: raw.phone,
    email: raw.email,
    logo: raw.logo,
    // A suspended school is not usable, so treat it as inactive here.
    is_active: raw.isActive && !raw.isSuspended,
    // ⚠️ Gap: no `studentLimit` column on the Prisma School model. Always
    // null until a schema migration adds it.
    student_limit: null,
    subscription_status: raw.subscriptionPlan,
    created_at: raw.createdAt,
  };
}

export function useSchools(filters?: SchoolFilters) {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 25;

  return useQuery({
    queryKey: ['schools', filters],
    queryFn: async (): Promise<PaginatedSchools> => {
      const { data } = await api.get('/superadmin/schools', {
        params: {
          page,
          limit: pageSize,
          search: filters?.search || undefined,
        },
      });

      let rows = (data.schools as RawSchool[]).map(mapSchool);

      // ⚠️ The backend supports `search` only — no status or city params. These
      // are applied to the current page's rows, so they are NOT reliable across
      // pages (same caveat as the class/section filters in useStudents.ts).
      // Proper fix: add `status` and `city` to getSchools().
      if (filters?.status === 'active') {
        rows = rows.filter(s => s.is_active === true);
      } else if (filters?.status === 'inactive') {
        rows = rows.filter(s => s.is_active === false);
      }

      if (filters?.city && filters.city !== 'All Cities') {
        rows = rows.filter(s => s.city === filters.city);
      }

      return { data: rows, totalCount: data.pagination.total as number };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSchoolStats() {
  return useQuery({
    queryKey: ['school-stats'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/dashboard');
      const stats = data.stats ?? {};
      const total = Number(stats.totalSchools ?? 0);
      const active = Number(stats.activeSchools ?? 0);

      return { total, active, inactive: total - active };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSchoolCities() {
  return useQuery({
    queryKey: ['school-cities'],
    queryFn: async () => {
      // ⚠️ No Express equivalent of the `get_distinct_cities` RPC. Derived
      // from a large page instead, so it covers only the first 200 schools.
      const { data } = await api.get('/superadmin/schools', { params: { limit: 200 } });
      const cities = [...new Set(
        (data.schools as RawSchool[]).map(s => s.city).filter(Boolean) as string[]
      )].sort();

      return ['All Cities', ...cities];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateSchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: SchoolFormData & { logoPreview?: string | null }) => {
      // ⚠️ Same gap as updateSchool(): POST /superadmin/schools has no `logo`
      // or `accentColor` in its destructure, so those two fields are
      // collected by the form but silently dropped server-side today.
      // Extending createSchool() is the fix; not done here since it's a
      // separate, pre-existing issue from the admin-account gap this
      // migration is closing.
      void formData.logoPreview;
      void formData.logo;
      void formData.accent_color;

      const { data } = await api.post('/superadmin/schools', {
        name: formData.name,
        schoolCode: formData.code,
        subdomain: formData.subdomain,
        address: formData.address,
        city: formData.city,
        phone: formData.phone || null,
        email: formData.email || null,
        primaryColor: formData.primary_color || '#0F766E',
        adminFirstName: formData.adminFirstName,
        adminLastName: formData.adminLastName,
        adminEmail: formData.adminEmail,
        adminPassword: formData.adminPassword,
      });

      return data.school;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      queryClient.invalidateQueries({ queryKey: ['school-cities'] });
      toast.success('School added successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to add school');
    },
  });
}

export function useUpdateSchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, logoPreview, ...formData }: Partial<SchoolFormData> & { id: string; logoPreview?: string | null }) => {
      // ⚠️ PUT /superadmin/schools/:id accepts only: name, primaryColor,
      // address, city, state, pincode, phone, email, website, board, medium,
      // upiId, subscriptionPlan, subscriptionEnd.
      //
      // So `code`/`subdomain` are immutable server-side (arguably correct —
      // both are unique tenant identifiers), and `logo` and `accent_color`
      // have no home: logo isn't in the controller's destructure, and there
      // is no accentColor column. Those edits are silently dropped today —
      // extending updateSchool() is the fix.
      const { data } = await api.put(`/superadmin/schools/${id}`, {
        ...(formData.name !== undefined && { name: formData.name }),
        ...(formData.address !== undefined && { address: formData.address }),
        ...(formData.city !== undefined && { city: formData.city }),
        ...(formData.phone !== undefined && { phone: formData.phone || null }),
        ...(formData.email !== undefined && { email: formData.email || null }),
        ...(formData.primary_color !== undefined && { primaryColor: formData.primary_color }),
      });

      void logoPreview;
      return data.school;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['school-cities'] });
      toast.success('School updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to update school');
    },
  });
}

export function useDeleteSchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schoolId: string) => {
      const { data } = await api.delete(`/superadmin/schools/${schoolId}`);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      queryClient.invalidateQueries({ queryKey: ['school-cities'] });
      toast.success(data?.message || 'School and all associated data deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to delete school');
    },
  });
}

export function useToggleSchoolStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ schoolId, isActive }: { schoolId: string; isActive: boolean }) => {
      // The backend models this as suspend/activate rather than an isActive
      // flag: activate sets { isSuspended: false, isActive: true }, suspend
      // sets { isSuspended: true } and leaves isActive alone. mapSchool()
      // collapses both into `is_active` so the UI keeps its single toggle.
      const action = isActive ? 'activate' : 'suspend';
      const { data } = await api.patch(`/superadmin/schools/${schoolId}/${action}`);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      toast.success(data?.message || 'School status updated');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to update school status');
    },
  });
}

// Legacy hook for backward compatibility
export function useSchoolsLegacy() {
  const { data: result, isLoading: loading } = useSchools();
  const schools = result?.data || [];
  const createSchool = useCreateSchool();
  const updateSchool = useUpdateSchool();
  const deleteSchoolMutation = useDeleteSchool();

  const saveSchool = async (
    formData: SchoolFormData,
    logoPreview: string | null,
    editingSchool: School | null
  ) => {
    try {
      if (editingSchool) {
        await updateSchool.mutateAsync({ id: editingSchool.id, ...formData, logoPreview });
      } else {
        await createSchool.mutateAsync({ ...formData, logoPreview });
      }
      return true;
    } catch {
      return false;
    }
  };

  const deleteSchool = async (id: string) => {
    if (!confirm('Are you sure you want to delete this school? This action cannot be undone.')) {
      return false;
    }
    try {
      await deleteSchoolMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  return {
    schools,
    loading,
    searchQuery: '',
    setSearchQuery: () => {},
    saveSchool,
    deleteSchool,
    isSubmitting: createSchool.isPending || updateSchool.isPending,
  };
}
