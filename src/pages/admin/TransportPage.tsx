import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Bus, Edit2, Trash2, Search, Loader2, MapPin, Phone, Users, UserPlus } from 'lucide-react';
import { useTransportRoutes, useCreateRoute, useUpdateRoute, useDeleteRoute, useStudentTransport, useAssignStudent, useRemoveStudentTransport, TransportRoute } from '@/hooks/useTransport';
import { useStudents } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useIsMobile } from '@/hooks/use-mobile';
import { EmptyState } from '@/components/ui/data-states';

const defaultRouteForm = {
  route_name: '',
  route_number: '',
  driver_name: '',
  driver_phone: '',
  vehicle_number: '',
  capacity: 40,
  start_location: '',
  end_location: '',
};

export default function TransportPage() {
  const schoolId = useEffectiveSchoolId();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [form, setForm] = useState(defaultRouteForm);
const [assignForm, setAssignForm] = useState({ student_id: '', pickup_stop: '', drop_stop: '', boarding_type: 'both' });
  const [assignClass, setAssignClass] = useState('');
  const [assignSection, setAssignSection] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const resetAssignForm = () => {
    setAssignForm({ student_id: '', pickup_stop: '', drop_stop: '', boarding_type: 'both' });
    setAssignClass('');
    setAssignSection('');
    setStudentSearch('');
  };

  const handleAssignDialogChange = (open: boolean) => {
    setAssignDialogOpen(open);
    if (!open) resetAssignForm();
  };

  const { data: routes = [], isLoading } = useTransportRoutes();
  const { data: studentTransport = [] } = useStudentTransport(selectedRouteId);
  const { data: studentData } = useStudents({ 
    className: assignClass || undefined, 
    section: assignSection || undefined,
    search: studentSearch || undefined,
    pageSize: 50,
  });
  const { data: classesData = [] } = useClasses();
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const deleteRoute = useDeleteRoute();
  const assignStudent = useAssignStudent();
  const removeStudent = useRemoveStudentTransport();

  const students = studentData?.data || [];

  // Get sections for selected class
  const selectedClassData = classesData.find(c => c.name === assignClass);
  const availableSections = selectedClassData?.sections?.map(s => s.name) || [];

  const filteredRoutes = routes.filter(r =>
    r.route_name.toLowerCase().includes(search.toLowerCase()) ||
    r.vehicle_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.driver_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateRoute = () => {
    setEditingRoute(null);
    setForm(defaultRouteForm);
    setRouteDialogOpen(true);
  };

  const openEditRoute = (r: TransportRoute) => {
    setEditingRoute(r);
    setForm({
      route_name: r.route_name,
      route_number: r.route_number || '',
      driver_name: r.driver_name || '',
      driver_phone: r.driver_phone || '',
      vehicle_number: r.vehicle_number || '',
      capacity: r.capacity,
      start_location: r.start_location || '',
      end_location: r.end_location || '',
    });
    setRouteDialogOpen(true);
  };

  const handleRouteSubmit = () => {
    if (!form.route_name) return;
    const payload = {
      ...form,
      school_id: schoolId,
      route_number: form.route_number || null,
      driver_name: form.driver_name || null,
      driver_phone: form.driver_phone || null,
      vehicle_number: form.vehicle_number || null,
      start_location: form.start_location || null,
      end_location: form.end_location || null,
    };
    setRouteDialogOpen(false);
    if (editingRoute) {
      updateRoute.mutate({ id: editingRoute.id, ...payload });
    } else {
      createRoute.mutate(payload);
    }
  };

  const handleAssignSubmit = () => {
    if (!assignForm.student_id || !selectedRouteId) return;
    setAssignDialogOpen(false);
    assignStudent.mutate({
      student_id: assignForm.student_id,
      route_id: selectedRouteId,
      school_id: schoolId!,
      pickup_stop: assignForm.pickup_stop || undefined,
      drop_stop: assignForm.drop_stop || undefined,
      boarding_type: assignForm.boarding_type,
    });
    resetAssignForm();
  };

  const routeFormJsx = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label>Route Name *</Label>
        <Input value={form.route_name} onChange={e => setForm(f => ({ ...f, route_name: e.target.value }))} placeholder="e.g. Route 1 - North" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Route Number</Label>
          <Input value={form.route_number} onChange={e => setForm(f => ({ ...f, route_number: e.target.value }))} placeholder="e.g. R-01" />
        </div>
        <div className="grid gap-2">
          <Label>Vehicle Number</Label>
          <Input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="e.g. KA-01-1234" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Driver Name</Label>
          <Input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Driver Phone</Label>
          <Input value={form.driver_phone} onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Start Location</Label>
          <Input value={form.start_location} onChange={e => setForm(f => ({ ...f, start_location: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>End Location</Label>
          <Input value={form.end_location} onChange={e => setForm(f => ({ ...f, end_location: e.target.value }))} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Capacity</Label>
        <Input type="text" inputMode="numeric" value={form.capacity || ''} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, capacity: v ? parseInt(v) : 0 })); }} placeholder="e.g. 40" />
      </div>
    </div>
  );

  const assignFormJsx = (
    <div className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Class *</Label>
          <Select value={assignClass} onValueChange={v => { setAssignClass(v); setAssignSection(''); setAssignForm(f => ({ ...f, student_id: '' })); }}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classesData.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Section</Label>
          <Select value={assignSection} onValueChange={v => { setAssignSection(v); setAssignForm(f => ({ ...f, student_id: '' })); }} disabled={!assignClass}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              {availableSections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Student *</Label>
        {!assignClass ? (
          <p className="text-sm text-muted-foreground py-2">Select a class first</p>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name or admission no..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-md border border-border">
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No students found</p>
              ) : (
                students.map((s: any) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setAssignForm(f => ({ ...f, student_id: f.student_id === s.id ? '' : s.id }))}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between ${assignForm.student_id === s.id ? 'bg-accent font-medium' : ''}`}
                  >
                    <span>{s.full_name}</span>
                    <span className="text-xs text-muted-foreground">{s.class_name}-{s.section}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2"><Label>Pickup Stop</Label><Input value={assignForm.pickup_stop} onChange={e => setAssignForm(f => ({ ...f, pickup_stop: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Drop Stop</Label><Input value={assignForm.drop_stop} onChange={e => setAssignForm(f => ({ ...f, drop_stop: e.target.value }))} /></div>
      </div>
      <div className="grid gap-2">
        <Label>Boarding Type</Label>
        <Select value={assignForm.boarding_type} onValueChange={v => setAssignForm(f => ({ ...f, boarding_type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="both">Both (Pickup & Drop)</SelectItem>
            <SelectItem value="pickup">Pickup Only</SelectItem>
            <SelectItem value="drop">Drop Only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const routeFormTitle = editingRoute ? 'Edit Route' : 'Add Route';
  const routeSubmitLabel = editingRoute ? 'Save Changes' : 'Create Route';
  const isSubmitting = createRoute.isPending || updateRoute.isPending;

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Transport Management</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Manage bus routes, drivers, and student assignments</p>
          </div>
          <Button onClick={openCreateRoute} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Add Route
          </Button>
        </div>

        <Tabs defaultValue="routes" onValueChange={(v) => { if (v === 'routes') setSelectedRouteId(undefined); }}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="routes" className="flex-1 sm:flex-none">Routes</TabsTrigger>
            <TabsTrigger value="assignments" className="flex-1 sm:flex-none">Student Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="routes" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search routes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : filteredRoutes.length === 0 ? (
              <EmptyState icon={Bus} title="No transport routes" description="Add your first bus route to get started." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRoutes.map(route => (
                  <Card key={route.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Bus className="w-5 h-5 text-primary shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{route.route_name}</p>
                            {route.route_number && <p className="text-xs text-muted-foreground">#{route.route_number}</p>}
                          </div>
                        </div>
                        <Badge variant={route.is_active ? 'default' : 'secondary'} className="text-xs">
                          {route.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        {route.vehicle_number && <p>🚌 {route.vehicle_number}</p>}
                        {route.driver_name && (
                          <div className="flex items-center gap-1">
                            <span>👤 {route.driver_name}</span>
                            {route.driver_phone && <span>• <Phone className="w-3 h-3 inline" /> {route.driver_phone}</span>}
                          </div>
                        )}
                        {(route.start_location || route.end_location) && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{route.start_location || '—'} → {route.end_location || '—'}</span>
                          </div>
                        )}
                        <p><Users className="w-3 h-3 inline" /> Capacity: {route.capacity}</p>
                      </div>

                      <div className="flex gap-2 pt-1 border-t border-border">
                        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEditRoute(route)}>
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => deleteRoute.mutate(route.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedRouteId || ''} onValueChange={v => setSelectedRouteId(v || undefined)}>
                <SelectTrigger className="w-full sm:w-[250px]"><SelectValue placeholder="Select a route" /></SelectTrigger>
                <SelectContent>
                  {routes.map(r => <SelectItem key={r.id} value={r.id}>{r.route_name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedRouteId && (
                <Button onClick={() => setAssignDialogOpen(true)} className="gap-2 w-full sm:w-auto">
                  <UserPlus className="w-4 h-4" /> Assign Student
                </Button>
              )}
            </div>

            {selectedRouteId && studentTransport.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search assigned students..." value={assignSearch} onChange={e => setAssignSearch(e.target.value)} className="pl-9" />
              </div>
            )}

            {!selectedRouteId ? (
              <EmptyState icon={Bus} title="Select a route" description="Choose a route above to view or assign students." />
            ) : studentTransport.length === 0 ? (
              <EmptyState icon={Users} title="No students assigned" description="Assign students to this route." />
            ) : (() => {
              const filtered = studentTransport.filter(st => {
                if (!assignSearch) return true;
                const q = assignSearch.toLowerCase();
                return st.student?.full_name?.toLowerCase().includes(q) ||
                  st.student?.class_name?.toLowerCase().includes(q) ||
                  st.student?.section?.toLowerCase().includes(q) ||
                  st.pickup_stop?.toLowerCase().includes(q) ||
                  st.drop_stop?.toLowerCase().includes(q);
              });
              if (filtered.length === 0) return <EmptyState icon={Search} title="No results" description="No students match your search." />;
              return isMobile ? (
              <div className="space-y-3">
                {filtered.map(st => (
                  <Card key={st.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{st.student?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{st.student?.class_name} - {st.student?.section} • {st.boarding_type}</p>
                        {(st.pickup_stop || st.drop_stop) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {st.pickup_stop && `Pickup: ${st.pickup_stop}`}{st.pickup_stop && st.drop_stop && ' | '}{st.drop_stop && `Drop: ${st.drop_stop}`}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeStudent.mutate(st.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Pickup Stop</TableHead>
                      <TableHead>Drop Stop</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(st => (
                      <TableRow key={st.id}>
                        <TableCell className="font-medium">{st.student?.full_name}</TableCell>
                        <TableCell>{st.student?.class_name} - {st.student?.section}</TableCell>
                        <TableCell>{st.pickup_stop || '—'}</TableCell>
                        <TableCell>{st.drop_stop || '—'}</TableCell>
                        <TableCell className="capitalize">{st.boarding_type}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon-sm" onClick={() => removeStudent.mutate(st.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
            })()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Route Form Dialog/Drawer */}
      {isMobile ? (
        <Drawer open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
          <DrawerContent className="max-h-[90dvh] flex flex-col bg-background">
            <DrawerHeader className="text-left"><DrawerTitle>{routeFormTitle}</DrawerTitle></DrawerHeader>
            <div data-vaul-no-drag className="flex-1 min-h-0 overflow-y-auto px-4">{routeFormJsx}</div>
            <DrawerFooter className="flex-row gap-2">
              <Button variant="outline" onClick={() => setRouteDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleRouteSubmit} disabled={isSubmitting} className="flex-1">{routeSubmitLabel}</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{routeFormTitle}</DialogTitle></DialogHeader>
            {routeFormJsx}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRouteDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRouteSubmit} disabled={isSubmitting}>{routeSubmitLabel}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign Student Dialog/Drawer */}
      {isMobile ? (
        <Drawer open={assignDialogOpen} onOpenChange={handleAssignDialogChange}>
          <DrawerContent className="max-h-[90dvh] flex flex-col bg-background">
            <DrawerHeader className="text-left"><DrawerTitle>Assign Student</DrawerTitle></DrawerHeader>
            <div data-vaul-no-drag className="flex-1 min-h-0 overflow-y-auto px-4">{assignFormJsx}</div>
            <DrawerFooter className="flex-row gap-2">
              <Button variant="outline" onClick={() => handleAssignDialogChange(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAssignSubmit} disabled={assignStudent.isPending} className="flex-1">Assign</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={assignDialogOpen} onOpenChange={handleAssignDialogChange}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Assign Student to Route</DialogTitle></DialogHeader>
            {assignFormJsx}
            <DialogFooter>
              <Button variant="outline" onClick={() => handleAssignDialogChange(false)}>Cancel</Button>
              <Button onClick={handleAssignSubmit} disabled={assignStudent.isPending}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
