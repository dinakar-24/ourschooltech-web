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
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer';
import {
  MessageSquare, Star, Send, Loader2, User, Eye, MessagesSquare, TrendingUp,
} from 'lucide-react';
import {
  useFeedbackList, useFeedbackResponses, useRespondToFeedback, useMarkFeedbackRead,
  Feedback,
} from '@/hooks/useFeedback';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';



export default function FeedbackPage() {
  const isMobile = useIsMobile();
  const { data: feedbacks, isLoading } = useFeedbackList(true);
  const respondMutation = useRespondToFeedback();
  const markRead = useMarkFeedbackRead();
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [responseText, setResponseText] = useState('');

  const { data: responses, isLoading: responsesLoading } = useFeedbackResponses(selected?.id);

  const handleRespond = async () => {
    if (!selected || !responseText.trim()) return;
    await respondMutation.mutateAsync({ feedbackId: selected.id, response: responseText });
    setResponseText('');
  };

  const handleSelect = (fb: Feedback) => {
    setSelected(fb);
    setResponseText('');
    if (fb.status !== 'read') {
      markRead.mutate(fb.id);
    }
  };

  const renderStars = (rating: number, size = 'w-3.5 h-3.5') => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${size} ${i <= rating ? 'fill-warning text-warning' : 'text-muted-foreground/20'}`} />
      ))}
    </div>
  );

  const avgRating = feedbacks?.length
    ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
    : '0';

  return (
    <>
      <div className="space-y-4 animate-fade-up">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border/50 p-3 md:p-4 bg-gradient-to-br from-card to-muted/30 shadow-sm">
            <div className="flex items-start justify-between mb-1.5">
              <span className="text-[11px] md:text-xs font-medium text-muted-foreground">Total Feedback</span>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <MessagesSquare className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold text-foreground">
              {isLoading ? <Skeleton className="h-7 w-10 inline-block" /> : feedbacks?.length || 0}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 p-3 md:p-4 bg-gradient-to-br from-card to-muted/30 shadow-sm">
            <div className="flex items-start justify-between mb-1.5">
              <span className="text-[11px] md:text-xs font-medium text-muted-foreground">Avg Rating</span>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-7 w-10 inline-block" /> : avgRating}
              </p>
              {!isLoading && <div className="flex gap-0.5">{renderStars(Math.round(Number(avgRating)), 'w-3 h-3')}</div>}
            </div>
          </div>
        </div>

        {/* Feedback List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : !feedbacks?.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground">No feedback yet</p>
            <p className="text-sm text-muted-foreground mt-1">Feedback from parents and teachers will appear here</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {feedbacks.map(fb => (
              <div
                key={fb.id}
                className={`rounded-xl border border-border/50 p-3.5 md:p-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.99] bg-card ${fb.status !== 'read' ? 'border-l-[3px] border-l-primary/60' : ''}`}
                onClick={() => handleSelect(fb)}
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {fb.is_anonymous ? 'Anonymous' : fb.submitter_name || 'Unknown'}
                      </span>
                      {fb.submitter_role && !fb.is_anonymous && (
                        <Badge variant="outline" className="text-[10px] capitalize font-medium px-1.5 py-0">{fb.submitter_role}</Badge>
                      )}
                      {fb.status === 'read' && (
                        <Eye className="w-3 h-3 text-muted-foreground/50" />
                      )}
                    </div>
                    {renderStars(fb.rating)}
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">{fb.message}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                      {format(new Date(fb.created_at), 'dd MMM yyyy, hh:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail - Drawer on mobile, Dialog on desktop */}
      {isMobile ? (
        <Drawer open={!!selected} onOpenChange={() => setSelected(null)}>
          <DrawerContent className="max-h-[85dvh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle>Feedback Details</DrawerTitle>
            </DrawerHeader>
            <div data-vaul-no-drag className="overflow-y-auto flex-1 min-h-0 px-4 pb-6">
              {selected && <FeedbackDetailContent
                selected={selected}
                responses={responses}
                responsesLoading={responsesLoading}
                responseText={responseText}
                setResponseText={setResponseText}
                handleRespond={handleRespond}
                respondMutation={respondMutation}
                renderStars={renderStars}
              />}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Feedback Details</DialogTitle></DialogHeader>
            {selected && <FeedbackDetailContent
              selected={selected}
              responses={responses}
              responsesLoading={responsesLoading}
              responseText={responseText}
              setResponseText={setResponseText}
              handleRespond={handleRespond}
              respondMutation={respondMutation}
              renderStars={renderStars}
            />}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function FeedbackDetailContent({
  selected, responses, responsesLoading, responseText, setResponseText, handleRespond, respondMutation, renderStars,
}: {
  selected: Feedback;
  responses: any;
  responsesLoading: boolean;
  responseText: string;
  setResponseText: (v: string) => void;
  handleRespond: () => void;
  respondMutation: any;
  renderStars: (r: number, s?: string) => React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            {selected.is_anonymous ? 'Anonymous' : selected.submitter_name}
          </p>
          {renderStars(selected.rating, 'w-4 h-4')}
        </div>
      </div>
      <p className="text-sm leading-relaxed">{selected.message}</p>
      <p className="text-xs text-muted-foreground">
        {format(new Date(selected.created_at), 'dd MMM yyyy, hh:mm a')}
      </p>

      {/* Responses */}
      <div className="border-t pt-3 space-y-3">
        <p className="text-sm font-semibold">Responses</p>
        {responsesLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : responses?.length === 0 ? (
          <p className="text-xs text-muted-foreground">No responses yet</p>
        ) : (
          responses?.map((r: any) => (
            <div key={r.id} className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm">{r.response}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(r.created_at), 'dd MMM yyyy, hh:mm a')}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Reply */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Type your response..."
          value={responseText}
          onChange={e => setResponseText(e.target.value)}
          className="min-h-[60px]"
        />
        <Button
          size="icon"
          className="shrink-0 self-end"
          onClick={handleRespond}
          disabled={respondMutation.isPending || !responseText.trim()}
        >
          {respondMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
