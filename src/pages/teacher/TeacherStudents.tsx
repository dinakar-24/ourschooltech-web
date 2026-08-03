import { useState, useMemo } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useClasses } from '@/hooks/useClasses';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/useDebounce';

interface RawStudent {
  id: string;
  firstName: string;
  lastName: string;
  rollNo: string | null;
  admissionNo: string;
  section?: { name: string; class?: { name: string } | null } | null;
}

export default function TeacherStudents() {
  const schoolId = useEffectiveSchoolId();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: classes } = useClasses();
  const classObj = classes?.find(c => c.name === selectedClass);
  const sections = classObj?.sections || [];
  const sectionObj = sections.find(s => s.name === selectedSection);

  const { data: students, isLoading } = useQuery({
    queryKey: ['teacher-students', schoolId, classObj?.id, sectionObj?.id, debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get<{ students: RawStudent[] }>('/school/students', {
        params: {
          status: 'active',
          classId: classObj?.id || undefined,
          sectionId: sectionObj?.id || undefined,
          search: debouncedSearch || undefined,
          limit: 50,
        },
      });
      return data.students.map(s => ({
        id: s.id,
        full_name: `${s.firstName} ${s.lastName}`.trim(),
        class_name: s.section?.class?.name ?? '',
        section: s.section?.name ?? '',
        roll_number: s.rollNo ? Number(s.rollNo) || null : null,
        admission_number: s.admissionNo,
      }));
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });

  const classOptions = classes?.map(c => c.name) || [];

  return (
    <MobileLayout title="Students" showBack>
      <div className="p-4 space-y-3">
        {/* Search & Filters */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection(''); }}>
            <SelectTrigger className="flex-1 h-10"><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>{classOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          {selectedClass && (
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-28 h-10"><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.name}>Sec {s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        {/* Student List */}
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
        ) : !students?.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Users className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold">No Students Found</h3>
            <p className="text-sm text-muted-foreground">Select a class or adjust filters</p>
          </div>
        ) : (
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden divide-y divide-border/50">
            {students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {s.roll_number || '-'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.class_name} - {s.section} • {s.admission_number}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
