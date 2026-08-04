import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  HelpCircle, Send, Loader2, Clock, AlertTriangle, CheckCircle2, CircleDot,
} from 'lucide-react';
import {
  useSupportQueryList, useQueryResponses, useRespondToQuery, useUpdateQueryStatus,
  SupportQuery,
} from '@/hooks/useSupportQueries';
import { format } from 'date-fns';

const statusIcons: Record<string, React.ReactNode> = {
  open: <CircleDot className="w-3.5 h-3.5 text-primary" />,
  in_progress: <Clock className="w-3.5 h-3.5 text-warning" />,
  resolved: <CheckCircle2 className="w-3.5 h-3.5 text-success" />,
  closed: <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />,
};

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-destructive/10 text-destructive',
};

export default function QueryPage() {
  const { data: queries, isLoading } = useSupportQueryList(true);
  const respondMutation = useRespondToQuery();
  const updateStatus = useUpdateQueryStatus();
  const [selected, setSelected] = useState<SupportQuery | null>(null);
  const [responseText, setResponseText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: responses, isLoading: responsesLoading } = useQueryResponses(selected?.id);

  const filtered = queries?.filter(q => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && q.category !== categoryFilter) return false;
    return true;
  }) || [];

  const handleRespond = async () => {
    if (!selected || !responseText.trim()) return;
    await respondMutation.mutateAsync({ queryId: selected.id, response: responseText });
    setResponseText('');
  };

  return (
    <>
      <div className="space-y-6 animate-fade-up">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: queries?.length || 0 },
            { label: 'Open', value: queries?.filter(q => q.status === 'open').length || 0 },
            { label: 'In Progress', value: queries?.filter(q => q.status === 'in_progress').length || 0 },
            { label: 'Resolved', value: queries?.filter(q => q.status === 'resolved').length || 0 },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="fees">Fees</SelectItem>
              <SelectItem value="transport">Transport</SelectItem>
              <SelectItem value="academics">Academics</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No queries found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map(q => (
                  <div key={q.id} className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelected(q); setResponseText(''); }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <HelpCircle className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm">{q.subject}</span>
                          <Badge variant="outline" className="text-[10px]">{q.ticket_number}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs">{statusIcons[q.status]} {q.status.replace('_', ' ')}</span>
                          <Badge className={`text-[10px] capitalize ${priorityColors[q.priority] || ''}`}>{q.priority}</Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{q.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {q.submitter_name} • {q.submitter_role} • {format(new Date(q.created_at), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selected?.subject}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{selected.ticket_number}</Badge>
                <Badge className={`text-xs capitalize ${priorityColors[selected.priority]}`}>{selected.priority}</Badge>
                <Badge variant="outline" className="text-xs capitalize">{selected.category}</Badge>
              </div>
              <p className="text-sm">{selected.description}</p>
              <p className="text-xs text-muted-foreground">Submitted by {selected.submitter_name} ({selected.submitter_role}) on {format(new Date(selected.created_at), 'dd MMM yyyy, hh:mm a')}</p>

              {/* Status change */}
              <div className="flex gap-2">
                {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                  <Button
                    key={s}
                    variant={selected.status === s ? 'default' : 'outline'}
                    size="sm"
                    className="capitalize text-xs"
                    onClick={() => updateStatus.mutateAsync({ id: selected.id, status: s }).then(() => setSelected({ ...selected, status: s }))}
                  >
                    {s.replace('_', ' ')}
                  </Button>
                ))}
              </div>

              {/* Responses */}
              <div className="border-t pt-3 space-y-3">
                <p className="text-sm font-medium">Responses</p>
                {responsesLoading ? <Skeleton className="h-10 w-full" /> : responses?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No responses yet</p>
                ) : (
                  responses?.map(r => (
                    <div key={r.id} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm">{r.response}</p>
                      <p className="text-xs text-muted-foreground mt-1">{r.responder_name} • {format(new Date(r.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Reply */}
              <div className="flex gap-2">
                <Textarea placeholder="Type your response..." value={responseText} onChange={e => setResponseText(e.target.value)} className="min-h-[60px]" />
                <Button size="icon" className="shrink-0 self-end" onClick={handleRespond} disabled={respondMutation.isPending || !responseText.trim()}>
                  {respondMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
