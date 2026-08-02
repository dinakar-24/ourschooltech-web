import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ReceiptData {
  verified: boolean;
  receipt_number: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  school_name: string;
}

export default function ReceiptVerificationPage() {
  const { receiptNumber } = useParams<{ receiptNumber: string }>();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      if (!receiptNumber) {
        setError('No receipt number provided');
        setLoading(false);
        return;
      }
      try {
        const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
        const resp = await fetch(
          `${apiUrl}/payment/verify-receipt?receipt_number=${encodeURIComponent(receiptNumber)}`
        );
        const json = await resp.json();

        if (!resp.ok || !json.verified) {
          setError(json.error || 'Receipt not found or invalid');
        } else {
          setData(json);
        }
      } catch {
        setError('Failed to verify receipt');
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [receiptNumber]);

  const formatINR = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-card border border-border rounded-xl p-8 shadow-lg">
          <XCircle className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Verification Failed</h1>
          <p className="text-muted-foreground">{error || 'This receipt could not be verified.'}</p>
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact the school administration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-primary p-6 text-center">
          <CheckCircle className="w-12 h-12 text-primary-foreground mx-auto mb-2" />
          <h1 className="text-xl font-bold text-primary-foreground">Receipt Verified</h1>
          <p className="text-primary-foreground/80 text-sm mt-1">This receipt is authentic and valid</p>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="text-center pb-4 border-b border-border">
            <p className="text-sm text-muted-foreground">School</p>
            <p className="text-lg font-bold text-foreground">{data.school_name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Receipt No</p>
              <p className="font-semibold text-foreground">{data.receipt_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Date</p>
              <p className="font-semibold text-foreground">
                {new Date(data.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Mode</p>
              <p className="font-semibold text-foreground capitalize">{data.payment_method}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-accent/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Amount Paid</p>
            <p className="text-2xl font-bold text-foreground">₹{formatINR(data.amount_paid)}</p>
          </div>
        </div>

        <div className="bg-muted/50 px-6 py-3 text-center text-xs text-muted-foreground">
          Verified by Our School Tech • {new Date().toLocaleDateString('en-IN')}
        </div>
      </div>
    </div>
  );
}
