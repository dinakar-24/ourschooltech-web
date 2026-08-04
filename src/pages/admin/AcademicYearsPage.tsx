import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle,
  Clock,
  CalendarDays
} from 'lucide-react';
import { 
  useAcademicYears, 
  useCreateAcademicYear, 
  useUpdateAcademicYear, 
  useDeleteAcademicYear,
  useSetCurrentAcademicYear
} from '@/hooks/useAcademicYears';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function AcademicYearsPage() {
  const isMobile = useIsMobile();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<any>(null);
  
  const { data: academicYears, isLoading } = useAcademicYears();
  const createMutation = useCreateAcademicYear();
  const updateMutation = useUpdateAcademicYear();
  const deleteMutation = useDeleteAcademicYear();
  const setCurrentMutation = useSetCurrentAcademicYear();

  const currentYear = academicYears?.find(y => y.is_current);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await createMutation.mutateAsync({
      name: formData.get('name') as string,
      startDate: formData.get('start_date') as string,
      endDate: formData.get('end_date') as string,
    });
    
    setIsAddDialogOpen(false);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingYear) return;
    
    const formData = new FormData(e.currentTarget);
    
    await updateMutation.mutateAsync({
      id: editingYear.id,
      name: formData.get('name') as string,
      startDate: formData.get('start_date') as string,
      endDate: formData.get('end_date') as string,
    });
    
    setEditingYear(null);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const handleSetCurrent = async (id: string) => {
    await setCurrentMutation.mutateAsync(id);
  };

  return (
      <div className="space-y-6 animate-fade-up">
        {/* Current Academic Year Banner */}
        {currentYear && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <CalendarDays className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Academic Year</p>
                    <p className="text-xl font-bold text-primary">{currentYear.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(currentYear.start_date), 'MMM d, yyyy')} - {format(new Date(currentYear.end_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 w-fit">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Academic Years Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                All Academic Years
              </CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Academic Year
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Academic Year</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input 
                        id="name" 
                        name="name" 
                        placeholder="e.g., 2024-25" 
                        required 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_date">Start Date</Label>
                        <Input 
                          id="start_date" 
                          name="start_date" 
                          type="date" 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_date">End Date</Label>
                        <Input 
                          id="end_date" 
                          name="end_date" 
                          type="date" 
                          required 
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Creating...' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !academicYears || academicYears.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No academic years defined</p>
                <p className="text-sm mt-1">Add your first academic year to get started</p>
              </div>
            ) : isMobile ? (
              /* Mobile Card Layout */
              <div className="divide-y">
                {academicYears.map((year) => (
                  <div key={year.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{year.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(year.start_date), 'MMM d, yyyy')} — {format(new Date(year.end_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {year.is_current ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          <CheckCircle className="w-3 h-3 mr-1" />Current
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="w-3 h-3 mr-1" />Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {!year.is_current && (
                        <Button variant="outline" size="sm" onClick={() => handleSetCurrent(year.id)} disabled={setCurrentMutation.isPending}>
                          Set Current
                        </Button>
                      )}
                      <Dialog open={editingYear?.id === year.id} onOpenChange={(open) => !open && setEditingYear(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditingYear(year)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Edit Academic Year</DialogTitle></DialogHeader>
                          <form onSubmit={handleUpdate} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit-name">Name</Label>
                              <Input id="edit-name" name="name" defaultValue={editingYear?.name} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-start_date">Start Date</Label>
                                <Input id="edit-start_date" name="start_date" type="date" defaultValue={editingYear?.start_date} required />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-end_date">End Date</Label>
                                <Input id="edit-end_date" name="end_date" type="date" defaultValue={editingYear?.end_date} required />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setEditingYear(null)}>Cancel</Button>
                              <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" disabled={year.is_current}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Academic Year?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete "{year.name}". This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(year.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop Table */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {academicYears.map((year) => (
                      <TableRow key={year.id}>
                        <TableCell className="font-medium">{year.name}</TableCell>
                        <TableCell>{format(new Date(year.start_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{format(new Date(year.end_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          {year.is_current ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                              <CheckCircle className="w-3 h-3 mr-1" />Current
                            </Badge>
                          ) : (
                            <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!year.is_current && (
                              <Button variant="outline" size="sm" onClick={() => handleSetCurrent(year.id)} disabled={setCurrentMutation.isPending}>Set Current</Button>
                            )}
                            <Dialog open={editingYear?.id === year.id} onOpenChange={(open) => !open && setEditingYear(null)}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon-sm" onClick={() => setEditingYear(year)}><Edit2 className="w-4 h-4" /></Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Edit Academic Year</DialogTitle></DialogHeader>
                                <form onSubmit={handleUpdate} className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-name">Name</Label>
                                    <Input id="edit-name" name="name" defaultValue={editingYear?.name} required />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-start_date">Start Date</Label>
                                      <Input id="edit-start_date" name="start_date" type="date" defaultValue={editingYear?.start_date} required />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-end_date">End Date</Label>
                                      <Input id="edit-end_date" name="end_date" type="date" defaultValue={editingYear?.end_date} required />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setEditingYear(null)}>Cancel</Button>
                                    <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                                  </DialogFooter>
                                </form>
                              </DialogContent>
                            </Dialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" disabled={year.is_current}><Trash2 className="w-4 h-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Academic Year?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete "{year.name}". This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(year.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
