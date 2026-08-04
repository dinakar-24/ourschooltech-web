import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, ExternalLink, Search, Loader2, Clock, Users as UsersIcon } from 'lucide-react';
import { useOnlineClasses } from '@/hooks/useOnlineClasses';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { EmptyState } from '@/components/ui/data-states';

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  live: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

// Read-only oversight -- creation/editing is teacher-only (see
// TeacherOnlineClasses.tsx). Admin sees everything scheduled school-wide
// but doesn't write here.
export default function OnlineClassesPage() {
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: classes = [], isLoading } = useOnlineClasses({ status: statusFilter !== 'all' ? statusFilter : undefined });

  const filtered = classes.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.subject?.toLowerCase().includes(search.toLowerCase()) ||
    c.class_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Online Classes</h1>
        <p className="text-xs md:text-sm text-muted-foreground">School-wide view of virtual classes scheduled by teachers</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search classes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="LIVE">Live</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Video} title="No online classes" description="No teacher has scheduled a virtual class yet." />
      ) : isMobile ? (
        /* Mobile Card Layout */
        <div className="space-y-3">
          {filtered.map(cls => (
            <Card key={cls.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Video className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">{cls.title}</span>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-xs ${statusColors[cls.status.toLowerCase()] || ''}`}>
                    {cls.status.toLowerCase()}
                  </Badge>
                </div>

                {cls.subject && (
                  <p className="text-xs text-muted-foreground">{cls.subject}</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{format(new Date(cls.scheduled_at), 'dd MMM, hh:mm a')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{cls.duration_minutes} min</span>
                    <span>• {cls.platform.replace('_', ' ')}</span>
                  </div>
                  {cls.class_name && (
                    <div className="flex items-center gap-1.5">
                      <UsersIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>{cls.class_name}{cls.section ? ` - ${cls.section}` : ''}</span>
                    </div>
                  )}
                  {cls.teacher?.full_name && (
                    <div className="truncate">
                      <span>{cls.teacher.full_name}</span>
                    </div>
                  )}
                </div>

                {cls.meeting_url && (
                  <div className="pt-1 border-t border-border">
                    <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                      <a href={cls.meeting_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Link
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop Table Layout */
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(cls => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" />
                      {cls.title}
                    </div>
                    {cls.subject && <p className="text-xs text-muted-foreground">{cls.subject}</p>}
                  </TableCell>
                  <TableCell className="capitalize">{cls.platform.replace('_', ' ')}</TableCell>
                  <TableCell>{cls.class_name}{cls.section ? ` - ${cls.section}` : ''}</TableCell>
                  <TableCell>{cls.teacher?.full_name || '—'}</TableCell>
                  <TableCell>{format(new Date(cls.scheduled_at), 'dd MMM yyyy, hh:mm a')}</TableCell>
                  <TableCell>{cls.duration_minutes} min</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[cls.status.toLowerCase()] || ''}>{cls.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {cls.meeting_url && (
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={cls.meeting_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
