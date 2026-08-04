import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { FeeEntry } from '@/components/admin/AddStudentDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddStudentDialog } from '@/components/admin/AddStudentDialog';
import {
  Search,
  Plus,
  Upload,
  Download,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Phone,
  Loader2,
  Users,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStudents, useStudentStats, useDeleteStudent, useCreateStudent, Student } from '@/hooks/useStudents';
import { useCreateFee } from '@/hooks/useFees';
import { invokeEdgeFunction } from '@/lib/api';
import { friendlyErrorMessage } from '@/lib/error-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { CredentialsDialog, type CreatedAccount } from '@/components/admin/CredentialsDialog';
import { EditStudentDialog } from '@/components/admin/EditStudentDialog';
import { ViewStudentDialog } from '@/components/admin/ViewStudentDialog';
import { useClasses, useCreateClass, useCreateSection } from '@/hooks/useClasses';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSections } from '@/hooks/useSections';
import { StudentCard } from '@/components/admin/StudentCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const schoolId = useEffectiveSchoolId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedSection, setSelectedSection] = useState('All Sections');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [createdAccounts, setCreatedAccounts] = useState<CreatedAccount[]>([]);
  const [credentialsStudentName, setCredentialsStudentName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const pagination = usePagination(25);
  
  // Open add dialog from sidebar link
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Reset to page 1 when filters change
  useEffect(() => {
    pagination.resetPage();
  }, [searchQuery, selectedClass, selectedSection]);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    admission_number: '',
    class_name: '',
    section: '',
    roll_number: '',
    gender: '',
    date_of_birth: '',
    parent_name: '',
    parent_phone: '',
    alternate_phone: '',
    student_email: '',
    parent_email: '',
    blood_group: '',
    address: '',
    avatar_url: '',
  });
  const [feeEntries, setFeeEntries] = useState<FeeEntry[]>([]);

  // Fetch data
  const { data: result, isLoading: studentsLoading } = useStudents({
    className: selectedClass,
    section: selectedSection,
    search: searchQuery,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const students = result?.data || [];
  const totalCount = result?.totalCount || 0;
  const { data: stats, isLoading: statsLoading } = useStudentStats();
  const { data: classes } = useClasses();
  const createStudent = useCreateStudent();
  const createFee = useCreateFee();
  const deleteStudent = useDeleteStudent();
  const createClass = useCreateClass();
  const createSection = useCreateSection();

  const classNames = ['All Classes', ...(classes?.map(c => c.name) || [])];
  const { data: dynamicSections } = useSections();
  const sections = ['All Sections', ...(dynamicSections || ['A', 'B', 'C', 'D'])];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.admission_number || !formData.class_name || !formData.section || !formData.roll_number || !formData.gender || !formData.date_of_birth) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!schoolId) {
      toast.error('No school found');
      return;
    }

    setIsCreating(true);
    try {
      // class_name/section are display strings from the form; the backend
      // needs the real sectionId FK. classes (useClasses()) already carries
      // each class's nested sections with real ids, so resolve it here --
      // and if the admin used the "type manually" escape hatch (or picked a
      // section chip that isn't a real section on this class yet), create
      // the missing class/section on the fly instead of failing, since
      // that's the whole point of manual entry.
      const matchedClass = classes?.find(c => c.name === formData.class_name);
      let classId = matchedClass?.id;
      if (!classId) {
        const newClass = await createClass.mutateAsync({ name: formData.class_name });
        classId = newClass.id;
      }

      const matchedSection = matchedClass?.sections.find(s => s.name === formData.section);
      let sectionId = matchedSection?.id;
      if (!sectionId) {
        const newSection = await createSection.mutateAsync({ classId, name: formData.section });
        sectionId = newSection.id;
      }

      const result = await createStudent.mutateAsync({
        full_name: formData.full_name,
        admission_number: formData.admission_number,
        sectionId,
        roll_number: parseInt(formData.roll_number),
        gender: formData.gender || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        parent_name: formData.parent_name || undefined,
        parent_phone: formData.parent_phone || undefined,
        alternate_phone: formData.alternate_phone || undefined,
        student_email: formData.student_email || undefined,
        parent_email: formData.parent_email || undefined,
        blood_group: formData.blood_group || undefined,
        address: formData.address || undefined,
        avatar_url: formData.avatar_url || undefined,
      });

      const student = result.student;

      // Create fee records
      if (student?.id && feeEntries.length > 0) {
        const defaultDueDate = new Date();
        defaultDueDate.setMonth(defaultDueDate.getMonth() + 1);
        const defaultDueDateStr = defaultDueDate.toISOString().split('T')[0];

        for (const entry of feeEntries) {
          if (entry.fee_type && entry.amount) {
            try {
              await createFee.mutateAsync({
                student_id: student.id,
                fee_type: entry.fee_type,
                amount: parseFloat(entry.amount),
                due_date: entry.due_date || defaultDueDateStr,
              });
            } catch {
              toast.error(`Fee assignment failed for ${entry.fee_type}`);
            }
          }
        }
      }

      // Show credentials dialog
      const accounts = result.createdAccounts || [];
      if (accounts.length > 0) {
        setCredentialsStudentName(formData.full_name);
        setCreatedAccounts(accounts);
      }

      toast.success('Student added successfully');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });

      setFormData({
        full_name: '', admission_number: '', class_name: '', section: '',
        roll_number: '', gender: '', date_of_birth: '', parent_name: '',
        parent_phone: '', alternate_phone: '', student_email: '', parent_email: '', blood_group: '',
        address: '', avatar_url: '',
      });
      setFeeEntries([]);
      setIsAddDialogOpen(false);
    } catch (error: any) {
      // api.post (axios) throws with the real backend message under
      // response.data.error, not error.message (that's just "Request
      // failed with status code 400") — invokeEdgeFunction used to put the
      // real message directly on .message, so this extraction changed along
      // with the call.
      const msg = error?.response?.data?.error || (error instanceof Error ? error.message : 'Failed to add student');
      toast.error(friendlyErrorMessage(msg));
    } finally {
      setIsCreating(false);
    }
  };

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<{ id: string; userId: string | null; name: string } | null>(null);

  const handleDeleteConfirmed = async () => {
    if (!deletingStudent) return;
    await deleteStudent.mutateAsync({ studentId: deletingStudent.id, userId: deletingStudent.userId });
    setDeletingStudent(null);
  };

  const handleDeleteAll = async () => {
    if (!schoolId) return;
    setIsDeletingAll(true);
    try {
      const result = await invokeEdgeFunction<{ deleted_count: number }>(
        'delete-all-students',
        { school_id: schoolId },
      );
      toast.success(`Deleted ${result.deleted_count} students`);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
    } catch (err: any) {
      toast.error(friendlyErrorMessage(err.message));
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllConfirm(false);
    }
  };

  return (
      <div className="space-y-6 animate-fade-up">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Students</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Active</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-success">{stats?.active || 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">New This Month</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-primary">{stats?.newThisMonth || 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Inactive</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-destructive">{stats?.inactive || 0}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, admission no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {classNames.map(cls => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map(sec => (
                  <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            {(stats?.total || 0) > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteAllConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All
              </Button>
            )}
            <AddStudentDialog
              classes={classes}
              formData={formData}
              feeEntries={feeEntries}
              onFeeEntriesChange={setFeeEntries}
              onInputChange={handleInputChange}
              onSubmit={handleSubmit}
              isPending={isCreating}
              isOpen={isAddDialogOpen}
              onOpenChange={setIsAddDialogOpen}
            />
          </div>
        </div>

        {/* Students Table */}
        <Card>
          <CardContent className="p-0">
            {studentsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground px-4">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No students found</p>
                <p className="text-sm mt-1">Add your first student to get started</p>
              </div>
            ) : isMobile ? (
              /* Mobile Card Layout */
              <div className="divide-y">
                {students.map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    onView={(s) => setViewingStudent(s as any)}
                    onEdit={(s) => setEditingStudent(s as any)}
                    onDelete={(id, userId) => setDeletingStudent({ id, userId, name: students.find(s => s.id === id)?.full_name || '' })}
                  />
                ))}
              </div>
            ) : (
              /* Desktop Table Layout */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Parent Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.admission_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={(student as any).avatar_url || (student as any).profiles?.avatar_url} alt={student.full_name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                              {student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{student.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{student.class_name} - {student.section}</TableCell>
                      <TableCell>{student.roll_number || '-'}</TableCell>
                      <TableCell>{student.parent_name || '-'}</TableCell>
                      <TableCell>
                        {student.parent_phone ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {student.parent_phone}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingStudent(student)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingStudent(student)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => setDeletingStudent({ id: student.id, userId: student.user_id, name: student.full_name })}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <PaginationControls
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalCount={totalCount}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              isLoading={studentsLoading}
            />
          </CardContent>
        </Card>

        <ViewStudentDialog
          student={viewingStudent}
          open={!!viewingStudent}
          onOpenChange={(open) => !open && setViewingStudent(null)}
        />

        <EditStudentDialog
          student={editingStudent}
          open={!!editingStudent}
          onOpenChange={(open) => !open && setEditingStudent(null)}
        />

        <AlertDialog open={!!deletingStudent} onOpenChange={(open) => !open && setDeletingStudent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Student</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deletingStudent?.name}</strong>? This will permanently remove all their data including attendance, fees, and results. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirmed}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete All Students</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>ALL {stats?.total || 0} students</strong> from this school? This will permanently remove all student records, their auth accounts, attendance, fees, and results. <span className="text-destructive font-semibold">This action cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingAll}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {isDeletingAll ? 'Deleting...' : 'Delete All Students'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <CredentialsDialog
          open={createdAccounts.length > 0}
          onOpenChange={(open) => { if (!open) setCreatedAccounts([]); }}
          accounts={createdAccounts}
          studentName={credentialsStudentName}
        />
      </div>
  );
}
