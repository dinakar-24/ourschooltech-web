import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useDebounce } from '@/hooks/useDebounce';

interface StudentSearchResult {
  id: string;
  full_name: string;
  admission_number: string;
  class_name: string;
  section: string;
}

interface RawStudent {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  section?: { name: string; class?: { name: string } | null } | null;
}

/**
 * Lightweight student search hook for dropdowns/selectors.
 * Only fetches up to 20 matches based on search input — never loads the full student list.
 */
export function useStudentSearch() {
  const schoolId = useEffectiveSchoolId();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['student-search', schoolId, debouncedSearch],
    queryFn: async (): Promise<StudentSearchResult[]> => {
      const { data } = await api.get<{ students: RawStudent[] }>('/school/students', {
        params: { search: debouncedSearch, status: 'active', limit: 20 },
      });

      return data.students.map(s => ({
        id: s.id,
        full_name: `${s.firstName} ${s.lastName}`.trim(),
        admission_number: s.admissionNo,
        class_name: s.section?.class?.name ?? '',
        section: s.section?.name ?? '',
      }));
    },
    enabled: !!schoolId && debouncedSearch.length >= 2,
    staleTime: 30 * 1000,
  });

  return {
    students,
    isLoading,
    searchInput,
    setSearchInput,
    hasSearched: debouncedSearch.length >= 2,
  };
}
