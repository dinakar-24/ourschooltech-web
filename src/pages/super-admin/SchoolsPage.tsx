import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Search, Building2, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { TableSkeleton, CardSkeleton, ErrorState } from '@/components/ui/data-states';
import { useSchools, useCreateSchool, useUpdateSchool, useDeleteSchool, useToggleSchoolStatus, School, SchoolFormData } from '@/hooks/useSchools';
import { SchoolFormDialog } from '@/components/super-admin/schools/SchoolFormDialog';
import { DeleteSchoolDialog } from '@/components/super-admin/schools/DeleteSchoolDialog';
import { PwaSettingsDialog } from '@/components/super-admin/schools/PwaSettingsDialog';
import { SchoolsTable } from '@/components/super-admin/schools/SchoolsTable';
import { SchoolCard } from '@/components/super-admin/schools/SchoolCard';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SchoolsPage() {
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const [searchQuery, setSearchQuery] = useState('');
  const pagination = usePagination(25);

  useEffect(() => {
    pagination.resetPage();
  }, [searchQuery]);

  const { data: result, isLoading, isError, refetch } = useSchools({ search: searchQuery, page: pagination.page, pageSize: pagination.pageSize });
  const schools = result?.data || [];
  const totalCount = result?.totalCount || 0;
  const createSchool = useCreateSchool();
  const updateSchool = useUpdateSchool();
  const deleteSchoolMutation = useDeleteSchool();
  const toggleStatusMutation = useToggleSchoolStatus();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [deletingSchool, setDeletingSchool] = useState<School | null>(null);
  const [togglingSchool, setTogglingSchool] = useState<School | null>(null);
  const [pwaSchool, setPwaSchool] = useState<any>(null);
  const [pwaDialogOpen, setPwaDialogOpen] = useState(false);

  const handleOpenAddDialog = useCallback(() => {
    setEditingSchool(null);
    setIsDialogOpen(true);
  }, []);

  const handleEdit = useCallback((school: School) => {
    setEditingSchool(school);
    setIsDialogOpen(true);
  }, []);

  const handleDelete = useCallback((school: School) => {
    setDeletingSchool(school);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingSchool) return;
    await deleteSchoolMutation.mutateAsync(deletingSchool.id);
    setDeletingSchool(null);
  }, [deleteSchoolMutation, deletingSchool]);

  const handleSubmit = useCallback(async (formData: SchoolFormData, logoPreview: string | null) => {
    try {
      if (editingSchool) {
        await updateSchool.mutateAsync({ id: editingSchool.id, ...formData, logoPreview });
      } else {
        await createSchool.mutateAsync({ ...formData, logoPreview });
      }
      setIsDialogOpen(false);
      setEditingSchool(null);
    } catch {
      // Error handled by mutation
    }
  }, [createSchool, updateSchool, editingSchool]);

  const handleDialogChange = useCallback((open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingSchool(null);
    }
  }, []);

  const handleImpersonate = useCallback((school: School) => {
    startImpersonation({ id: school.id, name: school.name, subdomain: school.subdomain });
    navigate('/admin/dashboard');
  }, [startImpersonation, navigate]);

  const handleToggleStatus = useCallback((school: School) => {
    setTogglingSchool(school);
  }, []);

  const handlePwaSettings = useCallback(async (school: School) => {
    try {
      const { data } = await api.get(`/superadmin/schools/${school.id}`);
      const s = data.school;
      setPwaSchool({
        id: s.id,
        name: s.name,
        code: s.schoolCode,
        logo: s.logo,
        primary_color: s.primaryColor,
        accent_color: s.accentColor,
        secondary_color: s.secondaryColor,
        background_color: s.backgroundColor,
        app_display_name: s.appDisplayName,
        app_short_name: s.appShortName,
        splash_screen_image_url: s.splashScreenImageUrl,
      });
      setPwaDialogOpen(true);
    } catch {
      toast.error('Failed to load PWA settings');
    }
  }, []);

  const [togglePassword, setTogglePassword] = useState('');
  const [showTogglePassword, setShowTogglePassword] = useState(false);
  const [isVerifyingToggle, setIsVerifyingToggle] = useState(false);

  const handleConfirmToggle = useCallback(async () => {
    if (!togglingSchool || !togglePassword.trim()) {
      toast.error('Please enter your password');
      return;
    }

    setIsVerifyingToggle(true);
    try {
      // Re-confirm identity via Express. The old supabase.auth
      // .signInWithPassword re-auth always errors now that auth moved off
      // Supabase, which made this gate fail closed and blocked the toggle
      // entirely. verify-password checks the caller's own hash and issues no
      // tokens.
      try {
        await api.post('/auth/verify-password', { password: togglePassword });
      } catch (err: any) {
        toast.error(
          err?.response?.status === 401
            ? 'Incorrect password. Please try again.'
            : err?.response?.data?.error || 'Unable to verify identity'
        );
        return;
      }

      const newStatus = togglingSchool.is_active === false ? true : false;
      await toggleStatusMutation.mutateAsync({ schoolId: togglingSchool.id, isActive: newStatus });
      setTogglingSchool(null);
      setTogglePassword('');
    } catch {
      toast.error('Failed to update school status');
    } finally {
      setIsVerifyingToggle(false);
    }
  }, [toggleStatusMutation, togglingSchool, togglePassword]);

  const handleCloseToggleDialog = useCallback(() => {
    setTogglingSchool(null);
    setTogglePassword('');
    setShowTogglePassword(false);
  }, []);

  const isSubmitting = createSchool.isPending || updateSchool.isPending;
  const togglingSchoolIsActive = togglingSchool?.is_active !== false;

  return (
    <SuperAdminLayout title="Schools Management">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search schools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Button onClick={handleOpenAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add School
          </Button>
        </div>

        {/* Schools Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="w-5 h-5" />
              All Schools ({totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
              <div className="lg:hidden"><CardSkeleton count={3} /></div>
                <div className="hidden lg:block"><TableSkeleton rows={5} columns={5} /></div>
              </>
            ) : isError ? (
              <ErrorState onRetry={() => refetch()} />
            ) : schools.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No schools found</p>
                <p className="text-sm mt-1">
                  {searchQuery ? 'Try a different search term' : 'Add your first school to get started'}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="lg:hidden grid gap-3 sm:grid-cols-2">
                  {schools.map((school) => (
                    <SchoolCard
                      key={school.id}
                      school={school}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onImpersonate={handleImpersonate}
                      onToggleStatus={handleToggleStatus}
                      onPwaSettings={handlePwaSettings}
                      isToggling={toggleStatusMutation.isPending && togglingSchool?.id === school.id}
                    />
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <SchoolsTable
                    schools={schools}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onImpersonate={handleImpersonate}
                    onToggleStatus={handleToggleStatus}
                    onPwaSettings={handlePwaSettings}
                    isTogglingId={toggleStatusMutation.isPending ? togglingSchool?.id || null : null}
                  />
                </div>
              </>
            )}
            <PaginationControls
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalCount={totalCount}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <SchoolFormDialog
          open={isDialogOpen}
          onOpenChange={handleDialogChange}
          editingSchool={editingSchool}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />

        {/* PWA Settings Dialog */}
        <PwaSettingsDialog
          open={pwaDialogOpen}
          onOpenChange={(open) => {
            setPwaDialogOpen(open);
            if (!open) setPwaSchool(null);
          }}
          school={pwaSchool}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteSchoolDialog
          open={!!deletingSchool}
          onOpenChange={(open) => !open && setDeletingSchool(null)}
          schoolName={deletingSchool?.name || ''}
          onConfirm={handleConfirmDelete}
        />

        {/* Toggle Status Confirmation Dialog */}
        <AlertDialog open={!!togglingSchool} onOpenChange={(open) => !open && handleCloseToggleDialog()}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-100 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-amber-600" />
              </div>
              <AlertDialogTitle className="text-center">
                {togglingSchoolIsActive ? 'Disable School?' : 'Enable School?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                {togglingSchoolIsActive
                  ? `Disabling "${togglingSchool?.name}" will prevent all users from logging in. The school's subdomain will show an inactive message.`
                  : `Enabling "${togglingSchool?.name}" will restore access for all users and reactivate the school's subdomain.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 py-2">
              <Label htmlFor="toggle-password">Super Admin Password</Label>
              <div className="relative">
                <Input
                  id="toggle-password"
                  type={showTogglePassword ? 'text' : 'password'}
                  value={togglePassword}
                  onChange={(e) => setTogglePassword(e.target.value)}
                  placeholder="Enter your password"
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmToggle()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowTogglePassword(!showTogglePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showTogglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AlertDialogFooter>
              <Button variant="outline" onClick={handleCloseToggleDialog} disabled={isVerifyingToggle}>
                Cancel
              </Button>
              <Button
                variant={togglingSchoolIsActive ? 'destructive' : 'default'}
                onClick={handleConfirmToggle}
                disabled={isVerifyingToggle || !togglePassword.trim()}
              >
                {isVerifyingToggle ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  togglingSchoolIsActive ? 'Disable School' : 'Enable School'
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SuperAdminLayout>
  );
}
