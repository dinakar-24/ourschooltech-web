import { useState, useMemo, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Plus,
  Calendar as CalendarIcon,
  BookOpen,
  FileText,
  Edit,
  Trash2,
  GraduationCap,
  Loader2,
  Search,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useExams, useExamStats, useCreateExam, useUpdateExam, useDeleteExam, ExamFormData, Exam } from '@/hooks/useExams';
import { useClasses } from '@/hooks/useClasses';
import { Skeleton } from '@/components/ui/skeleton';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useDebounce } from '@/hooks/useDebounce';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies',
  'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Physical Education',
  'Economics', 'Accountancy', 'Business Studies', 'Geography', 'History',
  'Sanskrit', 'Urdu', 'Art', 'Music',
];

export default function ExamsPage() {
  const isMobile = useIsMobile();
  const pagination = usePagination(25);
  const [searchInput, setSearchInput] = useState('');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    pagination.resetPage();
  }, [debouncedSearch, selectedClass]);

  const { data: examsResult, isLoading } = useExams({
    className: selectedClass,
    search: debouncedSearch,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const exams = examsResult?.data || [];
  const totalCount = examsResult?.totalCount || 0;
  const { data: stats } = useExamStats();
  const { data: classes = [] } = useClasses();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const deleteExamMutation = useDeleteExam();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  
  const [formData, setFormData] = useState<ExamFormData>({
    name: '',
    subject: '',
    class_name: '',
    exam_date: '',
    max_marks: 100,
  });

  const resetForm = () => {
    setFormData({ name: '', subject: '', class_name: '', exam_date: '', max_marks: 100 });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.subject || !formData.class_name || !formData.exam_date) return;
    await createExam.mutateAsync(formData);
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEdit = async () => {
    if (!selectedExam) return;
    await updateExam.mutateAsync({ id: selectedExam.id, ...formData });
    setIsEditDialogOpen(false);
    setSelectedExam(null);
    resetForm();
  };

  const handleDelete = async () => {
    if (!selectedExam) return;
    await deleteExamMutation.mutateAsync(selectedExam.id);
    setDeleteDialogOpen(false);
    setSelectedExam(null);
  };

  const openEditDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setFormData({
      name: exam.name,
      subject: exam.subject,
      class_name: exam.class_name,
      exam_date: exam.exam_date,
      max_marks: exam.max_marks,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setDeleteDialogOpen(true);
  };

  const getExamStatus = (examDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(examDate);
    date.setHours(0, 0, 0, 0);
    if (date > today) return 'upcoming';
    if (date < today) return 'completed';
    return 'today';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground">Completed</Badge>;
      case 'today':
        return <Badge className="bg-primary text-primary-foreground">Today</Badge>;
      case 'upcoming':
        return <Badge className="bg-warning text-warning-foreground">Upcoming</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const classNames = useMemo(() => ['All Classes', ...classes.map(c => c.name)], [classes]);

  const examFormFields = (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Exam Name</Label>
        <Input
          placeholder="e.g., Mid-Term Examination"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Subject</Label>
          <Select value={SUBJECTS.includes(formData.subject) ? formData.subject : '__custom'} onValueChange={(v) => {
            if (v === '__custom') {
              setFormData({ ...formData, subject: '' });
            } else {
              setFormData({ ...formData, subject: v });
            }
          }}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto z-50 bg-popover">
              {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              <SelectItem value="__custom">Other (type below)</SelectItem>
            </SelectContent>
          </Select>
          {(!SUBJECTS.includes(formData.subject)) && (
            <Input
              placeholder="Type custom subject..."
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="text-sm mt-2"
              autoFocus
            />
          )}
        </div>
        <div className="space-y-2">
          <Label>Class</Label>
          <Select value={formData.class_name} onValueChange={(v) => setFormData({ ...formData, class_name: v })}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Exam Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.exam_date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.exam_date
                  ? format(new Date(formData.exam_date), 'dd MMM yyyy')
                  : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.exam_date ? new Date(formData.exam_date) : undefined}
                onSelect={(date) => date && setFormData({ ...formData, exam_date: format(date, 'yyyy-MM-dd') })}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Max Marks</Label>
          <Input type="number" value={formData.max_marks} onChange={(e) => setFormData({ ...formData, max_marks: parseInt(e.target.value) || 100 })} />
        </div>
      </div>
    </div>
  );

  const FormActions = ({ onSubmit, onCancel, isPending, submitLabel }: { onSubmit: () => void; onCancel: () => void; isPending: boolean; submitLabel: string }) => (
    <div className="flex gap-2 justify-end">
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={onSubmit} disabled={isPending}>
        {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );

  return (
    <>
      <div className="space-y-6 animate-fade-up">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Exams</p>
              <p className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : stats?.total || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold text-warning">
                {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : stats?.upcoming || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-success">
                {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : stats?.completed || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : stats?.thisMonth || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search exams..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto z-50 bg-popover">
                {classNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
          {isMobile ? (
            <Drawer open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DrawerTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Exam
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader><DrawerTitle>Create New Examination</DrawerTitle></DrawerHeader>
                <div data-vaul-no-drag className="px-4 pb-2">{examFormFields}</div>
                <DrawerFooter className="pt-2">
                  <Button onClick={handleCreate} disabled={createExam.isPending}>
                    {createExam.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Exam
                  </Button>
                  <DrawerClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Exam
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create New Examination</DialogTitle></DialogHeader>
                {examFormFields}
                <FormActions onSubmit={handleCreate} onCancel={() => setIsAddDialogOpen(false)} isPending={createExam.isPending} submitLabel="Create Exam" />
              </DialogContent>
            </Dialog>
          )}
          </div>
        </div>

        {/* Exams List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground px-4">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No exams found</p>
                <p className="text-sm mt-1">
                  {debouncedSearch ? 'Try a different search term' : 'Create your first exam to get started'}
                </p>
              </div>
            ) : isMobile ? (
              /* Mobile Card Layout */
              <div className="divide-y">
                {exams.map((exam) => {
                  const status = getExamStatus(exam.exam_date);
                  return (
                    <div key={exam.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{exam.name}</p>
                          <p className="text-xs text-muted-foreground">{exam.subject} · {exam.class_name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getStatusBadge(status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(exam)}>
                                <Edit className="w-4 h-4 mr-2" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(exam)}>
                                <Trash2 className="w-4 h-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(exam.exam_date), 'dd MMM yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          Max: {exam.max_marks}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Desktop Table */
              <div className="overflow-x-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Exam Name</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Subject</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Class</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Max Marks</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[50px]"></th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {exams.map((exam) => {
                      const status = getExamStatus(exam.exam_date);
                      return (
                        <tr key={exam.id} className="border-b transition-colors hover:bg-muted/50">
                          <td className="p-4 align-middle font-medium">{exam.name}</td>
                          <td className="p-4 align-middle">{exam.subject}</td>
                          <td className="p-4 align-middle">{exam.class_name}</td>
                          <td className="p-4 align-middle">{format(new Date(exam.exam_date), 'dd MMM yyyy')}</td>
                          <td className="p-4 align-middle">{exam.max_marks}</td>
                          <td className="p-4 align-middle">{getStatusBadge(status)}</td>
                          <td className="p-4 align-middle">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm"><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(exam)}>
                                  <Edit className="w-4 h-4 mr-2" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(exam)}>
                                  <Trash2 className="w-4 h-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
      </div>

      {/* Edit Dialog/Drawer */}
      {isMobile ? (
        <Drawer open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>Edit Examination</DrawerTitle></DrawerHeader>
            <div data-vaul-no-drag className="px-4 pb-2">{examFormFields}</div>
            <DrawerFooter className="pt-2">
              <Button onClick={handleEdit} disabled={updateExam.isPending}>
                {updateExam.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Examination</DialogTitle></DialogHeader>
            {examFormFields}
            <FormActions onSubmit={handleEdit} onCancel={() => setIsEditDialogOpen(false)} isPending={updateExam.isPending} submitLabel="Save Changes" />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Examination</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedExam?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
