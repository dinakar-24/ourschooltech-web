import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  usePaymentSubmissions, useApproveSubmission, useRejectSubmission,
  PaymentSubmission,
} from '@/hooks/usePaymentSubmissions';
import { getSignedReadUrl } from '@/lib/uploads';
import {
  CheckCircle, XCircle, Eye, Loader2, Clock, IndianRupee, User, FileText,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function PaymentVerificationPanel() {
  const { data: submissions = [], isLoading } = usePaymentSubmissions('pending');
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const viewScreenshot = async (key: string) => {
    const url = await getSignedReadUrl(key);
    if (url) {
      setScreenshotUrl(url);
      setScreenshotOpen(true);
    }
  };

  const handleReject = () => {
    if (!rejectId || !rejectReason.trim()) return;
    reject.mutate({ id: rejectId, reason: rejectReason.trim() }, {
      onSuccess: () => { setRejectId(null); setRejectReason(''); },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No pending verifications</p>
        <p className="text-sm mt-1">All parent-submitted payments have been reviewed</p>
      </div>
    );
  }

  const methodLabel: Record<string, string> = {
    phonepe: 'PhonePe', gpay: 'Google Pay', paytm: 'Paytm',
    upi_other: 'UPI', bank_transfer: 'Bank Transfer',
  };

  return (
    <div className="space-y-3">
      {submissions.map((s) => (
        <Card key={s.id} className="border-warning/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {s.student?.full_name || 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.student?.class_name}-{s.student?.section}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.student?.admission_number} · {s.invoice?.term?.name || 'Invoice'}
                </p>
              </div>
              <Badge className="bg-warning text-warning-foreground">
                <Clock className="w-3 h-3 mr-1" /> Pending
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-bold flex items-center">
                  <IndianRupee className="w-3 h-3" />{Number(s.amount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Method</p>
                <p className="font-medium">{methodLabel[s.payment_method || ''] || s.payment_method}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">UTR / Transaction ID</p>
                <p className="font-mono text-xs font-bold bg-muted/50 px-2 py-1 rounded select-all">
                  {s.transaction_id}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="text-xs">{new Date(s.created_at).toLocaleDateString('en-IN')}</p>
              </div>
            </div>

            {s.notes && (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
                <FileText className="w-3 h-3 inline mr-1" />{s.notes}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              {s.screenshot_url && (
                <Button variant="outline" size="sm" onClick={() => viewScreenshot(s.screenshot_url!)}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> View Screenshot
                </Button>
              )}
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30"
                onClick={() => { setRejectId(s.id); setRejectReason(''); }}
                disabled={reject.isPending}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                className="bg-success hover:bg-success/90 text-success-foreground"
                onClick={() => approve.mutate(s)}
                disabled={approve.isPending}
              >
                {approve.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                Approve & Record
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Screenshot viewer */}
      <Dialog open={screenshotOpen} onOpenChange={setScreenshotOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Screenshot</DialogTitle>
          </DialogHeader>
          {screenshotUrl && (
            <img src={screenshotUrl} alt="Payment proof" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payment Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection (will be shown to parent)..."
              rows={3}
              maxLength={500}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason.trim() || reject.isPending}
              >
                {reject.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
