import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, AlertCircle } from 'lucide-react';
import { useParentChild, useChildHomework } from '@/hooks/useParentData';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function ParentHomework() {
  const { data: child } = useParentChild();
  const { data: homework, isLoading } = useChildHomework(child?.id);

  return (
    <MobileLayout title="Homework" showBack>
      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-32 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
          ))
        ) : homework?.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold">No Pending Homework</h3>
            <p className="text-sm text-muted-foreground">Your child is all caught up! 🎉</p>
          </div>
        ) : (
          homework?.map((hw) => (
            <Card key={hw.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-sm">{hw.subject}</h4>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Due {format(new Date(hw.due_date), 'dd MMM')}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm">{hw.title}</p>
                    {hw.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{hw.description}</p>
                    )}
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
