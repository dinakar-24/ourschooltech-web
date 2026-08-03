import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function ParentAnnouncements() {
  const { user } = useAuth();

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['parent-announcements', user?.schoolId],
    queryFn: async () => {
      const { data } = await api.get<{ announcements: { id: string; title: string; content: string; createdAt: string }[] }>('/parent/announcements');
      return data.announcements;
    },
    enabled: !!user?.schoolId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <MobileLayout title="Announcements" showBack>
      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-32 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
          ))
        ) : announcements?.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Bell className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold">No Announcements</h3>
            <p className="text-sm text-muted-foreground">Nothing new at the moment</p>
          </div>
        ) : (
          announcements?.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm">{a.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{a.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">{format(new Date(a.createdAt), 'dd MMM yyyy')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </MobileLayout>
  );
}
