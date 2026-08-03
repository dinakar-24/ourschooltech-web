import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useClasses } from '@/hooks/useClasses';

/**
 * Returns all section names defined for the current school (optionally
 * filtered by class name). Falls back to A-D if no sections exist yet.
 */
export function useSections(className?: string) {
  const schoolId = useEffectiveSchoolId();
  const { data: classes } = useClasses();

  return useQuery({
    queryKey: ['dynamic-sections', schoolId, className, classes],
    queryFn: async () => {
      if (!classes) return ['A', 'B', 'C', 'D'];

      const relevant = className && className !== 'All Classes'
        ? classes.filter(c => c.name === className)
        : classes;

      const unique = [...new Set(relevant.flatMap(c => c.sections.map(s => s.name)))].sort();
      return unique.length > 0 ? unique : ['A', 'B', 'C', 'D'];
    },
    enabled: !!schoolId && !!classes,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Returns all unique fee types used across invoices in the current school.
 */
export function useFeeTypes() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['dynamic-fee-types', schoolId],
    queryFn: async () => {
      const { data } = await api.get<{ feeTypes: string[] }>('/school/fees/types');
      return data.feeTypes;
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}
