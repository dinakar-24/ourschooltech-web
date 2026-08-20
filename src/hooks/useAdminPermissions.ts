import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// All controllable modules for school admins
export const ALL_ADMIN_MODULES = [
  'students',
  'teachers',
  'classes',
  'fees',
  'attendance',
  'exams',
  'timetable',
  'online-classes',
  'academic-years',
  'announcements',
  'feedback',
  'queries',
  'reports',
  'gallery',
  'transport',
  'bulk-upload',
  'subscription',
  'settings',
  // No sidebar page of its own -- the disable/enable/delete/reset-password
  // actions live on Super Admin screens. It's listed here because the
  // backend gates /api/manage-user on this key, and a SCHOOL_ADMIN can call
  // that API directly whether or not their sidebar shows a button for it.
  // Without a toggle here it would be enforced but invisible, revocable
  // only by a save that happened to omit it.
  'user-management',
] as const;

export type AdminModule = typeof ALL_ADMIN_MODULES[number];

// Human-readable labels for modules
export const MODULE_LABELS: Record<AdminModule, string> = {
  'students': 'Students',
  'teachers': 'Teachers',
  'classes': 'Classes',
  'fees': 'Fees',
  'attendance': 'Attendance',
  'exams': 'Exams',
  'timetable': 'Timetable',
  'online-classes': 'Online Classes',
  'academic-years': 'Academic Years',
  'announcements': 'Announcements',
  'feedback': 'Feedback',
  'queries': 'Queries',
  'reports': 'Reports',
  'gallery': 'Gallery',
  'transport': 'Transport',
  'bulk-upload': 'Bulk Upload',
  'subscription': 'Subscription',
  'settings': 'Settings',
  'user-management': 'User Management',
};

// Map sidebar paths to module keys
export const PATH_TO_MODULE: Record<string, AdminModule> = {
  '/students': 'students',
  '/teachers': 'teachers',
  '/classes': 'classes',
  '/fees': 'fees',
  '/attendance': 'attendance',
  '/exams': 'exams',
  '/timetable': 'timetable',
  '/online-classes': 'online-classes',
  '/academic-years': 'academic-years',
  '/announcements': 'announcements',
  '/feedback': 'feedback',
  '/queries': 'queries',
  '/reports': 'reports',
  '/gallery': 'gallery',
  '/transport': 'transport',
  '/bulk-upload': 'bulk-upload',
  '/subscription': 'subscription',
  '/settings': 'settings',
};

interface PermissionRow {
  module: string;
  can_access: boolean;
}

/**
 * Hook for the currently logged-in school_admin to check their own permissions.
 * If no permissions are stored, all modules are accessible (backward compat).
 */
export function useMyAdminPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Set<AdminModule> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'school_admin') {
      setPermissions(null);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        const { data } = await api.get('/school/my-permissions');
        const rows = (data.permissions || []) as PermissionRow[];
        if (rows.length === 0) {
          // No permissions stored = full access (backward compat)
          setPermissions(null);
        } else {
          const allowed = new Set<AdminModule>();
          rows.forEach(row => {
            if (row.can_access) allowed.add(row.module as AdminModule);
          });
          setPermissions(allowed);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions(null);
      }
      setLoading(false);
    };

    fetch();
  }, [user]);

  const hasAccess = useCallback((module: AdminModule): boolean => {
    // null means no restrictions (full access)
    if (permissions === null) return true;
    return permissions.has(module);
  }, [permissions]);

  const hasPathAccess = useCallback((path: string): boolean => {
    const module = PATH_TO_MODULE[path];
    if (!module) return true; // Dashboard, profile, etc. always accessible
    return hasAccess(module);
  }, [hasAccess]);

  return { hasAccess, hasPathAccess, loading, hasRestrictions: permissions !== null };
}

/**
 * Hook for super admin to manage permissions for a specific admin user.
 */
// schoolId stays in the signature so ManagePermissionsDialog.tsx (and
// AdminCard.tsx/SchoolAdminsPage.tsx above it) need zero changes, but it's
// no longer sent anywhere -- the backend derives it from the target user's
// own record instead of trusting a client-supplied value.
export function useManageAdminPermissions(userId: string, schoolId: string) {
  const [allowedModules, setAllowedModules] = useState<Set<AdminModule>>(new Set(ALL_ADMIN_MODULES));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const { data } = await api.get(`/superadmin/school-admins/${userId}/permissions`);
      const rows = (data.permissions || []) as PermissionRow[];
      if (rows.length === 0) {
        // No permissions = full access
        setAllowedModules(new Set(ALL_ADMIN_MODULES));
      } else {
        const allowed = new Set<AdminModule>();
        rows.forEach(row => {
          if (row.can_access) allowed.add(row.module as AdminModule);
        });
        setAllowedModules(allowed);
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const toggleModule = (module: AdminModule) => {
    setAllowedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  const setAll = (allowed: boolean) => {
    setAllowedModules(allowed ? new Set(ALL_ADMIN_MODULES) : new Set());
  };

  const savePermissions = async () => {
    if (!userId) return false;
    setSaving(true);

    try {
      // Full module -> canAccess map every time, same delete-all+insert-all
      // shape the old Supabase version used -- an explicit "everything
      // revoked" save needs to stay distinguishable from "never configured"
      // on the read side, which only an empty result set (not an all-false
      // one) means "unrestricted".
      const modules: Record<string, boolean> = {};
      ALL_ADMIN_MODULES.forEach(module => { modules[module] = allowedModules.has(module); });

      await api.put(`/superadmin/school-admins/${userId}/permissions`, { modules });

      toast.success('Permissions updated successfully');
      return true;
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to save permissions');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    allowedModules,
    toggleModule,
    setAll,
    savePermissions,
    loading,
    saving,
  };
}
