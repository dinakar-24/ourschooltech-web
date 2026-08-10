import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search, UserCheck, BookOpen, GraduationCap, UserRound, ArrowLeft, Users,
  School, ChevronRight, ChevronDown, Mail, Phone, Hash, Pencil,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UserActionsMenu } from '@/components/super-admin/UserActionsMenu';
import { EditStudentDialog } from '@/components/admin/EditStudentDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';
import { mapStudent, type Student, type RawStudent } from '@/hooks/useStudents';
import { mapUser, type RawUser } from '@/hooks/useAllUsers';

type ViewMode = 'overview' | 'admins' | 'teachers' | 'classes' | 'section-students';

interface SchoolUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  roles: string[];
}

interface ClassData {
  id: string;
  name: string;
  sections: SectionData[];
  totalStudents: number;
}

interface SectionData {
  id: string;
  name: string;
  classId: string;
  className: string;
  studentCount: number;
  classTeacher?: string;
}

interface SectionStudent {
  id: string;
  full_name: string;
  admission_number: string;
  roll_number: number | null;
  avatar_url: string | null;
  user_id: string | null;
  email: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
}

const CATEGORY_TILES = [
  { key: 'admins' as ViewMode, label: 'Admins', icon: UserCheck, color: 'text-teal-600', bg: 'bg-gradient-to-br from-teal-50 to-teal-100/60 dark:from-teal-950/40 dark:to-teal-900/20', border: 'border-teal-200/60 dark:border-teal-800/60', iconBg: 'bg-teal-100 dark:bg-teal-900/50', role: 'school_admin' },
  { key: 'teachers' as ViewMode, label: 'Teachers', icon: BookOpen, color: 'text-blue-600', bg: 'bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-950/40 dark:to-blue-900/20', border: 'border-blue-200/60 dark:border-blue-800/60', iconBg: 'bg-blue-100 dark:bg-blue-900/50', role: 'teacher' },
  { key: 'classes' as ViewMode, label: 'Classes & Sections', icon: School, color: 'text-emerald-600', bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20', border: 'border-emerald-200/60 dark:border-emerald-800/60', iconBg: 'bg-emerald-100 dark:bg-emerald-900/50', role: '' },
];

export default function SchoolUsersPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [view, setView] = useState<ViewMode>('overview');
  const [schoolName, setSchoolName] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});

  // User list state (admins/teachers)
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [disabledUsers, setDisabledUsers] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebounce(searchInput, 400);

  // Classes state
  const [classesData, setClassesData] = useState<ClassData[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  // Section students state
  const [selectedSection, setSelectedSection] = useState<SectionData | null>(null);
  const [sectionStudents, setSectionStudents] = useState<SectionStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Edit student state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentOpen, setEditStudentOpen] = useState(false);

  // Fetch school name + counts on mount
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      try {
        const { data: schoolData } = await api.get(`/superadmin/schools/${schoolId}`);
        setSchoolName(schoolData.school?.name || 'Unknown School');

        const [admins, teachers] = await Promise.all([
          api.get('/superadmin/users', { params: { schoolId, role: 'school_admin', limit: 1 } }),
          api.get('/superadmin/users', { params: { schoolId, role: 'teacher', limit: 1 } }),
        ]);
        setCounts({
          school_admin: admins.data.pagination.total,
          teacher: teachers.data.pagination.total,
        });
      } catch {
        toast.error('Failed to load school overview');
      }
    })();
  }, [schoolId]);

  // Fetch users for admins/teachers
  const fetchUsers = useCallback(async (role: string) => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await api.get('/superadmin/users', {
        params: { schoolId, role, search: debouncedSearch || undefined, limit: 200 },
      });
      setUsers((data.users as RawUser[]).map(mapUser));
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [schoolId, debouncedSearch]);

  // Fetch classes & sections
  const fetchClasses = useCallback(async () => {
    if (!schoolId) return;
    setClassesLoading(true);
    try {
      // Counts + class teacher now come straight off the endpoint (real
      // Section.students/classTeacher relations) -- no separate RPC or
      // teacher lookup needed.
      const { data } = await api.get(`/superadmin/schools/${schoolId}/classes`);
      const classes: Array<{
        id: string; name: string;
        sections: Array<{
          id: string; name: string;
          classTeacher: { firstName: string; lastName: string } | null;
          _count: { students: number };
        }>;
      }> = data.classes || [];

      const result: ClassData[] = classes.map(cls => {
        const classSections: SectionData[] = cls.sections.map(s => ({
          id: s.id,
          name: s.name,
          classId: cls.id,
          className: cls.name,
          studentCount: s._count.students,
          classTeacher: s.classTeacher ? `${s.classTeacher.firstName} ${s.classTeacher.lastName}`.trim() : undefined,
        }));
        return {
          id: cls.id,
          name: cls.name,
          sections: classSections,
          totalStudents: classSections.reduce((sum, s) => sum + s.studentCount, 0),
        };
      });

      setClassesData(result);
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setClassesLoading(false);
    }
  }, [schoolId]);

  // Fetch students for a specific section
  const fetchSectionStudents = useCallback(async (section: SectionData) => {
    if (!schoolId) return;
    setStudentsLoading(true);
    try {
      // Real sectionId FK now -- no more class_name/section string matching.
      // Parents + the student's own login email come back on the same row,
      // so no separate profiles lookup is needed either.
      const { data } = await api.get(`/superadmin/schools/${schoolId}/students`, {
        params: { sectionId: section.id, search: debouncedSearch || undefined },
      });

      const rows: Array<RawStudent & {
        user?: { email: string } | null;
        parents?: Array<{ firstName: string; lastName: string; phone: string | null; user?: { email: string } | null }>;
      }> = data.students || [];

      setSectionStudents(rows.map(s => {
        const parent = s.parents && s.parents.length > 0 ? s.parents[0] : null;
        return {
          id: s.id,
          full_name: `${s.firstName} ${s.lastName}`.trim(),
          admission_number: s.admissionNo,
          roll_number: s.rollNo ? Number(s.rollNo) || null : null,
          avatar_url: s.photo ?? null,
          user_id: s.userId,
          email: s.user?.email ?? null,
          parent_name: parent ? `${parent.firstName} ${parent.lastName}`.trim() : null,
          parent_email: parent?.user?.email ?? null,
          parent_phone: parent?.phone ?? null,
        };
      }));
    } catch {
      toast.error('Failed to load students');
    } finally {
      setStudentsLoading(false);
    }
  }, [schoolId, debouncedSearch]);

  // Open edit student dialog with full data
  const openEditStudent = useCallback(async (studentId: string) => {
    if (!schoolId) return;
    try {
      const { data } = await api.get(`/superadmin/schools/${schoolId}/students/${studentId}`);
      setEditingStudent(mapStudent(data.student as RawStudent));
      setEditStudentOpen(true);
    } catch {
      toast.error('Failed to load student');
    }
  }, [schoolId]);

  // Load data when view changes
  useEffect(() => {
    if (view === 'overview') return;
    if (view === 'classes') fetchClasses();
    else if (view === 'section-students' && selectedSection) fetchSectionStudents(selectedSection);
    else {
      const tile = CATEGORY_TILES.find(t => t.key === view);
      if (tile?.role) fetchUsers(tile.role);
    }
  }, [view, fetchUsers, fetchClasses, fetchSectionStudents, selectedSection]);

  // Re-fetch on search
  useEffect(() => {
    if (view === 'admins' || view === 'teachers') {
      const tile = CATEGORY_TILES.find(t => t.key === view);
      if (tile?.role) fetchUsers(tile.role);
    } else if (view === 'section-students' && selectedSection) {
      fetchSectionStudents(selectedSection);
    }
  }, [debouncedSearch]);

  const handleActionComplete = useCallback((action?: string, userId?: string) => {
    if (action === 'disable' && userId) {
      setDisabledUsers(prev => new Set(prev).add(userId));
    } else if (action === 'enable' && userId) {
      setDisabledUsers(prev => { const next = new Set(prev); next.delete(userId); return next; });
    } else if (action === 'delete' && userId) {
      if (view === 'section-students') {
        setSectionStudents(prev => prev.filter(s => s.user_id !== userId));
      } else {
        setUsers(prev => prev.filter(u => u.id !== userId));
      }
      return;
    }
    if (view === 'section-students' && selectedSection) {
      fetchSectionStudents(selectedSection);
    } else {
      const tile = CATEGORY_TILES.find(t => t.key === view);
      if (tile?.role) fetchUsers(tile.role);
    }
  }, [view, fetchUsers, fetchSectionStudents, selectedSection]);

  const handleBack = () => {
    if (view === 'overview') {
      navigate('/super-admin/schools');
    } else if (view === 'section-students') {
      setView('classes');
      setSelectedSection(null);
      setSearchInput('');
      setSectionStudents([]);
    } else {
      setView('overview');
      setSearchInput('');
      setUsers([]);
    }
  };

  const openSection = (section: SectionData) => {
    setSelectedSection(section);
    setSearchInput('');
    setView('section-students');
  };

  const currentTile = CATEGORY_TILES.find(t => t.key === view);

  const getViewTitle = () => {
    if (view === 'section-students' && selectedSection) {
      return `Class ${selectedSection.className} - Section ${selectedSection.name}`;
    }
    return currentTile?.label || '';
  };

  return (
    <SuperAdminLayout title={schoolName}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-9 w-9 rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">
              {view === 'overview' ? schoolName : view === 'section-students' && selectedSection ? getViewTitle() : currentTile?.label || 'Classes & Sections'}
            </h2>
            {view === 'overview' && (
              <p className="text-xs text-muted-foreground">Manage school users and structure</p>
            )}
          </div>
        </div>

        {/* Search bar for non-overview */}
        {view !== 'overview' && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${view === 'section-students' ? 'students, parents...' : view === 'classes' ? 'classes...' : currentTile?.label || ''}...`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Overview Tiles */}
        {view === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {CATEGORY_TILES.map(tile => {
              const Icon = tile.icon;
              const count = tile.role ? (counts[tile.role] || 0) : undefined;
              return (
                <Card
                  key={tile.key}
                  className={`cursor-pointer group hover:shadow-lg transition-all duration-200 border ${tile.border} ${tile.bg} hover:scale-[1.02]`}
                  onClick={() => setView(tile.key)}
                >
                  <CardContent className="p-5 sm:p-6 flex flex-col items-center text-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${tile.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${tile.color}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{tile.label}</p>
                      {count !== undefined && (
                        <p className={`text-2xl font-bold mt-1 ${tile.color}`}>{count}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* User List View (Admins / Teachers) */}
        {(view === 'admins' || view === 'teachers') && (
          <>
            {loading ? (
              <Card>
                <div className="space-y-3 p-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : users.length === 0 ? (
              <Card>
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No {currentTile?.label?.toLowerCase()} found</p>
                  <p className="text-sm mt-1">
                    {debouncedSearch ? 'Try a different search term' : `No ${currentTile?.label?.toLowerCase()} in this school yet`}
                  </p>
                </div>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {currentTile && <currentTile.icon className={`w-4 h-4 ${currentTile.color}`} />}
                    {currentTile?.label}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{users.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {users.map(user => {
                    const initials = user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2);
                    return (
                      <div key={user.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarImage src={user.avatar_url ?? undefined} alt={user.full_name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{user.full_name}</p>
                            <UserActionsMenu
                              userId={user.id} userName={user.full_name} userEmail={user.email}
                              isDisabled={disabledUsers.has(user.id)}
                              isSelf={currentUser?.id === user.id}
                              onActionComplete={handleActionComplete}
                              currentFullName={user.full_name}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="w-3 h-3 shrink-0" />{user.email}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Classes & Sections View */}
        {view === 'classes' && (
          <>
            {classesLoading ? (
              <Card>
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              </Card>
            ) : classesData.length === 0 ? (
              <Card>
                <div className="text-center py-12 text-muted-foreground">
                  <School className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No classes found</p>
                  <p className="text-sm mt-1">No classes configured for this school yet</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {classesData.filter(cls => !debouncedSearch || cls.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || cls.sections.some(s => s.name.toLowerCase().includes(debouncedSearch.toLowerCase()))).map(cls => (
                  <Card key={cls.id}>
                    <Collapsible defaultOpen>
                      <CardHeader className="pb-3">
                        <CollapsibleTrigger className="flex items-center gap-2 w-full group/cls">
                          <School className="w-4 h-4 text-emerald-600" />
                          <CardTitle className="text-sm">Class {cls.name}</CardTitle>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                            {cls.totalStudents} students
                          </Badge>
                          <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground transition-transform group-data-[state=open]/cls:rotate-180" />
                        </CollapsibleTrigger>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          {cls.sections.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No sections configured</p>
                          ) : (
                            <div className="grid gap-2">
                              {cls.sections.map(sec => (
                                <div
                                  key={sec.id}
                                  className="flex items-center justify-between p-3 border rounded-lg bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => openSection(sec)}
                                >
                                  <div className="space-y-0.5">
                                    <p className="text-sm font-medium flex items-center gap-1">
                                      Section {sec.name}
                                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                    </p>
                                    {sec.classTeacher && (
                                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <BookOpen className="w-3 h-3 shrink-0 text-blue-500" />
                                        Class Teacher: {sec.classTeacher}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    <GraduationCap className="w-3 h-3 mr-1" />
                                    {sec.studentCount}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Section Students View */}
        {view === 'section-students' && selectedSection && (
          <>
            {selectedSection.classTeacher && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="p-3 flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span className="text-muted-foreground">Class Teacher:</span>
                  <span className="font-medium">{selectedSection.classTeacher}</span>
                </CardContent>
              </Card>
            )}

            {studentsLoading ? (
              <Card>
                <div className="space-y-3 p-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : sectionStudents.length === 0 ? (
              <Card>
                <div className="text-center py-12 text-muted-foreground">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No students found</p>
                  <p className="text-sm mt-1">
                    {debouncedSearch ? 'Try a different search term' : 'No students in this section yet'}
                  </p>
                </div>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-amber-600" />
                    Students
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{sectionStudents.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {sectionStudents.map(student => {
                    const initials = student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2);
                    return (
                      <div key={student.id} className="p-3 border rounded-lg bg-card space-y-1.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9 shrink-0">
                            <AvatarImage src={student.avatar_url ?? undefined} alt={student.full_name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{student.full_name}</p>
                              {student.user_id && student.email ? (
                                <UserActionsMenu
                                  userId={student.user_id}
                                  userName={student.full_name}
                                  userEmail={student.email}
                                  isDisabled={disabledUsers.has(student.user_id)}
                                  isSelf={currentUser?.id === student.user_id}
                                  onActionComplete={handleActionComplete}
                                  currentFullName={student.full_name}
                                  onEditOverride={() => openEditStudent(student.id)}
                                />
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditStudent(student.id)}
                                  title="Edit Student"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {student.roll_number && (
                                <span className="flex items-center gap-0.5">
                                  <Hash className="w-3 h-3" />Roll: {student.roll_number}
                                </span>
                              )}
                              {student.admission_number && (
                                <span className="truncate">Adm: {student.admission_number}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Parent info */}
                        {(student.parent_name || student.parent_email || student.parent_phone) && (
                          <div className="ml-12 border-l-2 border-purple-200 dark:border-purple-800 pl-2 space-y-0.5">
                            {student.parent_name && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <UserRound className="w-3 h-3 shrink-0 text-purple-500" />
                                <span className="font-medium">Parent:</span> {student.parent_name}
                              </p>
                            )}
                            {student.parent_phone && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3 shrink-0 text-purple-400" />
                                {student.parent_phone}
                              </p>
                            )}
                            {student.parent_email && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3 shrink-0 text-purple-400" />
                                <span className="truncate">{student.parent_email}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Edit Student Dialog */}
      <EditStudentDialog
        student={editingStudent}
        open={editStudentOpen}
        schoolId={schoolId}
        onOpenChange={(open) => {
          setEditStudentOpen(open);
          if (!open && selectedSection) {
            fetchSectionStudents(selectedSection);
          }
        }}
      />
    </SuperAdminLayout>
  );
}
