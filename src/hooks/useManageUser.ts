import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────
// Migrated off the dead `manage-user` Supabase Edge Function (invoked via
// invokeEdgeFunction, which relies on a live Supabase session that no
// longer exists post-auth-migration) to real Express routes under
// /api/manage-user, shared by SCHOOL_ADMIN (own school only) and
// SUPER_ADMIN (any school, see manageuser.controller.js for the exact
// permission matrix).
//
// `update_role` dropped -- declared in the old type but never invoked by
// any UI.
//
// `reset_password` no longer returns a temp_password to display/copy: it
// now triggers the same forgot-password OTP email
// (ForgotPasswordDialog/passwordreset.controller.js) the user would get
// from the public "Forgot password?" link, so they set their own password
// instead of an admin generating one for them.
// ─────────────────────────────────────────────────────────────────────────

type Action = 'disable' | 'enable' | 'delete' | 'update_profile' | 'reset_password';

interface ManageUserData {
  action: Action;
  user_id: string;
  full_name?: string;
  phone?: string;
}

const actionLabels: Record<Action, string> = {
  disable: 'User disabled',
  enable: 'User enabled',
  delete: 'User deleted',
  update_profile: 'Profile updated',
  reset_password: 'Password reset email sent',
};

export function useManageUser() {
  const [isProcessing, setIsProcessing] = useState(false);

  const manageUser = useCallback(async (data: ManageUserData): Promise<{ success: boolean }> => {
    setIsProcessing(true);
    try {
      const { action, user_id: userId, full_name, phone } = data;

      switch (action) {
        case 'disable':
          await api.patch(`/manage-user/${userId}/disable`);
          break;
        case 'enable':
          await api.patch(`/manage-user/${userId}/enable`);
          break;
        case 'delete':
          await api.delete(`/manage-user/${userId}`);
          break;
        case 'reset_password':
          await api.post(`/manage-user/${userId}/reset-password`);
          break;
        case 'update_profile':
          await api.patch(`/manage-user/${userId}/profile`, { full_name, phone });
          break;
      }

      toast.success(actionLabels[action] || 'Action completed');
      return { success: true };
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Operation failed');
      return { success: false };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { manageUser, isProcessing };
}
