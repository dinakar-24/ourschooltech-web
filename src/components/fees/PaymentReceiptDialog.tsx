import { useRef, useCallback, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Download, Printer, Share2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { FeePayment, FeeInvoice } from '@/hooks/useFeeInvoices';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: FeePayment | null;
  invoice: FeeInvoice | null;
  copyLabel?: 'PARENT COPY' | 'OFFICE COPY';
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const wholePart = Math.floor(num);
  const decimalPart = Math.round((num - wholePart) * 100);
  let result = 'INR ' + convert(wholePart);
  if (decimalPart > 0) result += ' and ' + convert(decimalPart) + ' Paise';
  return result + ' Only';
}

function formatINR(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

const printStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; background: #fff; }
  @media print { body { padding: 0; } .receipt-outer { box-shadow: none !important; border: none !important; } }
`;

export function PaymentReceiptDialog({ open, onOpenChange, payment, invoice, copyLabel = 'OFFICE COPY' }: PaymentReceiptDialogProps) {
  const { school } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const isMobile = useIsMobile();

  const generatePdfBlob = useCallback(async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;

    // Clone receipt into offscreen container with fixed print-width
    const clone = receiptRef.current.cloneNode(true) as HTMLElement;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:680px;background:#fff;z-index:-1;padding:0;margin:0;';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // Yield to UI thread so loading state renders, then let images/QR settle
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 150)));

    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: clone.scrollWidth,
        height: clone.scrollHeight,
        windowWidth: 680,
      });

      // Yield again before heavy PNG encoding
      await new Promise(r => requestAnimationFrame(() => r(undefined)));

      const imgData = canvas.toDataURL('image/png', 1.0);

      const A4_W = 210;
      const A4_H = 297;
      const MARGIN = 10;
      const contentW = A4_W - MARGIN * 2;
      const contentH = (canvas.height * contentW) / canvas.width;
      const pageH = Math.min(contentH + MARGIN * 2, A4_H);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [A4_W, pageH],
        compress: true,
      });

      pdf.addImage(imgData, 'PNG', MARGIN, MARGIN, contentW, contentH, undefined, 'FAST');
      return pdf.output('blob');
    } finally {
      document.body.removeChild(wrapper);
    }
  }, []);

  // Build verification URL using the current tenant's domain (subdomain or custom domain)
  const verificationUrl = useMemo(() => {
    if (!payment) return '';
    // window.location.origin already reflects the school's subdomain or custom domain
    return `${window.location.origin}/receipt/${encodeURIComponent(payment.receipt_number)}`;
  }, [payment]);

  if (!payment || !invoice) return null;

  const receiptFileName = `Receipt-${payment.receipt_number || 'NA'}`;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !receiptRef.current) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <title>Receipt ${payment.receipt_number}</title>
      <style>${printStyles}</style></head><body>
      ${receiptRef.current.innerHTML}
      <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleSavePdf = async () => {
    setPdfLoading(true);
    try {
      const blob = await generatePdfBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${receiptFileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const { toast } = await import('@/hooks/use-toast');
      toast({ title: 'Downloaded!', description: `${receiptFileName}.pdf saved successfully` });
    } catch {
      const { toast } = await import('@/hooks/use-toast');
      toast({ title: 'Error', description: 'Could not generate PDF', variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      // Try sharing as PDF file first (mobile devices)
      const blob = await generatePdfBlob();
      if (blob && navigator.share && navigator.canShare) {
        const file = new File([blob], `${receiptFileName}.pdf`, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Fee Receipt - ${payment.receipt_number}`,
            files: [file],
          });
          return;
        }
      }

      // Fallback: share as text
      const studentName = invoice.student?.full_name || 'N/A';
      const admNo = invoice.student?.admission_number || 'N/A';
      const className = [invoice.student?.class_name, invoice.student?.section].filter(Boolean).join(' ');
      const schoolName = school?.name || 'School';
      const components = (invoice.components || [])
        .map(c => `  • ${c.fee_type}: ₹${formatINR(Number(c.amount))}`)
        .join('\n');

      const receiptText = [
        `📄 *FEE RECEIPT - ${schoolName}*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `Receipt No: ${payment.receipt_number}`,
        `Date: ${new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        ``,
        `👤 *Student Details*`,
        `Name: ${studentName}`,
        `Adm No: ${admNo}`,
        className ? `Class: ${className}` : '',
        invoice.student?.parent_name ? `Father: ${invoice.student.parent_name}` : '',
        ``,
        components ? `📋 *Fee Breakdown*\n${components}\n` : '',
        `💰 *Payment Summary*`,
        `Total Fee: ₹${formatINR(totalFees)}`,
        `Previously Paid: ₹${formatINR(previouslyPaid)}`,
        `Current Payment: ₹${formatINR(currentPayment)}`,
        `Total Paid Till Date: ₹${formatINR(totalPaidTillDate)}`,
        `Remaining Balance: ₹${formatINR(remainingBalance)}`,
        ``,
        `Payment Mode: ${payment.payment_method?.charAt(0).toUpperCase() + payment.payment_method?.slice(1)}`,
        payment.transaction_id ? `Transaction ID: ${payment.transaction_id}` : '',
        payment.cheque_number ? `Cheque No: ${payment.cheque_number}` : '',
        `━━━━━━━━━━━━━━━━━━━━`,
        `_This is a system-generated receipt._`,
      ].filter(Boolean).join('\n');

      if (navigator.share) {
        await navigator.share({
          title: `Fee Receipt - ${payment.receipt_number}`,
          text: receiptText,
        });
      } else {
        await navigator.clipboard.writeText(receiptText);
        const { toast } = await import('@/hooks/use-toast');
        toast({ title: 'Copied!', description: 'Receipt details copied to clipboard' });
      }
    } catch {
      // user cancelled or error
    }
  };

  // ── Cumulative payment calculations ──────────────────────────────
  const allPayments = [...(invoice.payments || [])].sort((a, b) => {
    const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id);
  });
  const currentPayment = Number(payment.amount);
  const totalFees = Number(invoice.total_amount);

  const currentPaymentIndex = allPayments.findIndex((p) => p.id === payment.id);
  const previousPayments = currentPaymentIndex >= 0 ? allPayments.slice(0, currentPaymentIndex) : [];
  const previouslyPaid = previousPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaidTillDate = previouslyPaid + currentPayment;
  const remainingBalance = Math.max(0, totalFees - totalPaidTillDate);

  const componentAllocations = (invoice.components || []).map((component) => ({
    id: component.id,
    fee_type: component.fee_type,
    amount: Number(component.amount),
    prevPaid: 0,
    currentPaid: 0,
    totalPaid: 0,
    balance: Number(component.amount),
  }));

  const relevantPayments = currentPaymentIndex >= 0 ? allPayments.slice(0, currentPaymentIndex + 1) : allPayments;

  // Direct attribution for payments recorded against one specific component
  // (the admin's "Pay <component>" button, or a submission naming exactly
  // one item) -- fee_item_id is a real FK, not a guess. Payments without one
  // ("Pay All", multi-item submissions) fall through to the waterfall below.
  const findTargetComponentIndex = (feeItemId: string | null | undefined) => {
    if (!feeItemId) return -1;
    return componentAllocations.findIndex((component) => component.id === feeItemId);
  };

  relevantPayments.forEach((paid) => {
    let remainingAmount = Number(paid.amount);
    if (remainingAmount <= 0 || componentAllocations.length === 0) return;

    const isCurrentPayment = paid.id === payment.id;
    const targetIndex = findTargetComponentIndex(paid.fee_item_id);

    if (targetIndex >= 0) {
      const target = componentAllocations[targetIndex];
      const targetRemaining = Math.max(0, target.amount - target.totalPaid);
      const targetAllocation = Math.min(remainingAmount, targetRemaining);

      if (targetAllocation > 0) {
        if (isCurrentPayment) {
          target.currentPaid += targetAllocation;
        } else {
          target.prevPaid += targetAllocation;
        }
        target.totalPaid += targetAllocation;
        target.balance = Math.max(0, target.amount - target.totalPaid);
        remainingAmount -= targetAllocation;
      }
    }

    for (const component of componentAllocations) {
      if (remainingAmount <= 0) break;

      const componentRemaining = Math.max(0, component.amount - component.totalPaid);
      if (componentRemaining <= 0) continue;

      const allocation = Math.min(remainingAmount, componentRemaining);
      if (allocation <= 0) continue;

      if (isCurrentPayment) {
        component.currentPaid += allocation;
      } else {
        component.prevPaid += allocation;
      }

      component.totalPaid += allocation;
      component.balance = Math.max(0, component.amount - component.totalPaid);
      remainingAmount -= allocation;
    }
  });

  const hasComponentAllocation = componentAllocations.length > 0;


  const paymentDate = new Date(payment.payment_date);
  const createdAt = new Date(payment.created_at);
  const formattedDate = paymentDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const cellPad = isMobile ? '4px 5px' : '6px 8px';
  const cellFont = isMobile ? '10px' : '11px';
  const labelStyle: React.CSSProperties = { fontWeight: 700, fontSize: isMobile ? '11px' : '12px', color: '#1a1a1a' };
  const valueStyle: React.CSSProperties = { fontSize: isMobile ? '11px' : '12px', color: '#1a1a1a' };
  const thStyle: React.CSSProperties = { border: '1.5px solid #222', padding: cellPad, textAlign: 'left', fontWeight: 700, fontSize: cellFont, background: '#f5f5f5' };
  const thRight: React.CSSProperties = { ...thStyle, textAlign: 'right' };
  const tdStyle: React.CSSProperties = { border: '1px solid #999', padding: cellPad, fontSize: cellFont };
  const tdRight: React.CSSProperties = { ...tdStyle, textAlign: 'right', fontFamily: "'Courier New', monospace" };

  const actionButtons = (
    <div className="flex gap-2 mb-1">
      <Button variant="outline" size="sm" className="flex-1 h-9 text-xs font-medium border-border" onClick={handlePrint}>
        <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
      </Button>
      <Button variant="outline" size="sm" className="flex-1 h-9 text-xs font-medium border-border" onClick={handleSavePdf} disabled={pdfLoading}>
        {pdfLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
        {pdfLoading ? 'Generating...' : 'Save'}
      </Button>
      <Button variant="outline" size="sm" className="flex-1 h-9 text-xs font-medium border-border" onClick={handleShare}>
        <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
      </Button>
    </div>
  );

  const receiptContent = (
    <div ref={receiptRef} style={isMobile ? { transform: 'scale(0.88)', transformOrigin: 'top left', width: '113.6%' } : undefined}>
      <div className="receipt-outer" style={{ margin: '0 auto', border: '2px solid #333', fontFamily: "'Segoe UI', sans-serif", fontSize: '13px', color: '#1a1a1a', background: '#fff', padding: isMobile ? '12px' : '16px' }}>

        {/* OFFICE COPY - top right */}
        <div style={{ textAlign: 'right', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#dc2626', fontStyle: 'italic' }}>
            {copyLabel}
          </span>
        </div>

        {/* School Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
          {school?.logo && (
            <img src={school.logo} alt={school.name} style={{ height: '50px', width: '50px', objectFit: 'contain', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a1a', letterSpacing: '0.5px' }}>
              {school?.name || 'School Name'}
            </div>
            <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
              {[school?.address, school?.city].filter(Boolean).join(', ')}
            </div>
            {(school?.phone || school?.email) && (
              <div style={{ fontSize: '11px', color: '#444', marginTop: '1px' }}>
                {school?.phone && <>Tel: {school.phone}</>}
                {school?.phone && school?.email && ', '}
                {school?.email && <>Email: {school.email}</>}
              </div>
            )}
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', marginTop: '4px' }}>
              FEE RECEIPT
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr style={{ border: 'none', borderTop: '2px solid #333', margin: '0 0 12px' }} />

        {/* Receipt & Student Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: '14px', fontSize: '11px' }}>
          <div>
            <span style={labelStyle}>Receipt No: </span>
            <span style={valueStyle}>{payment.receipt_number}</span>
          </div>
          <div>
            <span style={labelStyle}>Date: </span>
            <span style={valueStyle}>{formattedDate} {formattedTime}</span>
          </div>
          <div>
            <span style={labelStyle}>Student: </span>
            <span style={valueStyle}>{invoice.student?.full_name || 'N/A'}</span>
          </div>
          <div>
            <span style={labelStyle}>Adm No: </span>
            <span style={valueStyle}>{invoice.student?.admission_number || 'N/A'}</span>
          </div>
          <div>
            <span style={labelStyle}>Father: </span>
            <span style={valueStyle}>{invoice.student?.parent_name || '--'}</span>
          </div>
          <div>
            <span style={labelStyle}>Class: </span>
            <span style={valueStyle}>{invoice.student?.class_name} {invoice.student?.section}</span>
          </div>
        </div>

        {/* Fee Component Table with cumulative tracking */}
        <div style={{ marginBottom: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: cellFont, tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={thStyle}>Particulars</th>
                <th style={thRight}>Amount</th>
                {hasComponentAllocation && <th style={thRight}>Prev. Paid</th>}
                <th style={{ ...thRight, background: '#e8f5e9' }}>Current Paid</th>
                {hasComponentAllocation && <th style={thRight}>Balance</th>}
              </tr>
            </thead>
            <tbody>
              {componentAllocations.length > 0 ? componentAllocations.map((c) => (
                <tr key={c.fee_type}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{c.fee_type}</td>
                  <td style={tdRight}>{formatINR(c.amount)}</td>
                  {hasComponentAllocation && (
                    <td style={{ ...tdRight, color: '#1a1a1a' }}>
                      {c.prevPaid > 0 ? formatINR(c.prevPaid) : '—'}
                    </td>
                  )}
                  <td style={{ ...tdRight, fontWeight: c.currentPaid > 0 ? 700 : 400, color: '#1a1a1a' }}>
                    {c.currentPaid > 0 ? formatINR(c.currentPaid) : '—'}
                  </td>
                  {hasComponentAllocation && (
                    <td style={{ ...tdRight, color: c.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      {formatINR(c.balance)}
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>Fee Payment</td>
                  <td style={tdRight}>{formatINR(totalFees)}</td>
                  {hasComponentAllocation && <td style={tdRight}>—</td>}
                  <td style={{ ...tdRight, fontWeight: 700 }}>{formatINR(currentPayment)}</td>
                  {hasComponentAllocation && <td style={tdRight}>{formatINR(remainingBalance)}</td>}
                </tr>
              )}
              {/* Total Row */}
              <tr style={{ background: '#f5f5f5' }}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
                <td style={{ ...tdRight, fontWeight: 800, fontSize: '12px' }}>{formatINR(totalFees)}</td>
                {hasComponentAllocation && (
                  <td style={{ ...tdRight, fontWeight: 700 }}>{formatINR(previouslyPaid)}</td>
                )}
                <td style={{ ...tdRight, fontWeight: 800, fontSize: '12px' }}>{formatINR(currentPayment)}</td>
                {hasComponentAllocation && (
                  <td style={{ ...tdRight, fontWeight: 700 }}>{formatINR(remainingBalance)}</td>
                )}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cumulative Payment Summary */}
        <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
          <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
            Payment Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 12px' }}>
            <span>Total Fees</span>
            <span style={{ textAlign: 'right', fontFamily: "'Courier New', monospace", fontWeight: 600 }}>₹{formatINR(totalFees)}</span>

            {previouslyPaid > 0 && (
              <>
                <span>Previously Paid</span>
                <span style={{ textAlign: 'right', fontFamily: "'Courier New', monospace" }}>₹{formatINR(previouslyPaid)}</span>
              </>
            )}

            <span style={{ fontWeight: 700, color: '#16a34a' }}>Current Payment</span>
            <span style={{ textAlign: 'right', fontFamily: "'Courier New', monospace", fontWeight: 700, color: '#16a34a' }}>₹{formatINR(currentPayment)}</span>

            <span style={{ fontWeight: 700, borderTop: '1px solid #cbd5e1', paddingTop: '4px', marginTop: '2px' }}>Total Paid Till Date</span>
            <span style={{ textAlign: 'right', fontFamily: "'Courier New', monospace", fontWeight: 700, borderTop: '1px solid #cbd5e1', paddingTop: '4px', marginTop: '2px' }}>₹{formatINR(totalPaidTillDate)}</span>

            {remainingBalance > 0 && (
              <>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>Remaining Balance</span>
                <span style={{ textAlign: 'right', fontFamily: "'Courier New', monospace", fontWeight: 700, color: '#dc2626' }}>₹{formatINR(remainingBalance)}</span>
              </>
            )}
            {remainingBalance <= 0 && (
              <>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>Remaining Balance</span>
                <span style={{ textAlign: 'right', fontFamily: "'Courier New', monospace", fontWeight: 700, color: '#16a34a' }}>₹0.00 (Fully Paid)</span>
              </>
            )}
          </div>
        </div>

        {/* Amount in Words */}
        <div style={{ fontSize: '11px', marginBottom: '6px' }}>
          <span style={labelStyle}>Amount In Words: </span>
          <span style={valueStyle}>{numberToWords(currentPayment)}</span>
        </div>

        {/* Payment Mode */}
        <div style={{ fontSize: '11px', marginBottom: '4px' }}>
          <span style={labelStyle}>Payment Mode: </span>
          <span style={{ ...valueStyle, textTransform: 'capitalize' }}>{payment.payment_method}</span>
        </div>

        {/* Transaction / Cheque Info */}
        {payment.transaction_id && (
          <div style={{ fontSize: '11px', marginBottom: '4px' }}>
            <span style={labelStyle}>Transaction No: </span>
            <span style={valueStyle}>{payment.transaction_id}</span>
          </div>
        )}
        {payment.cheque_number && (
          <div style={{ fontSize: '11px', marginBottom: '4px' }}>
            <span style={labelStyle}>Cheque No: </span>
            <span style={valueStyle}>{payment.cheque_number}</span>
            {payment.bank_name && <> | <span style={labelStyle}>Bank: </span><span style={valueStyle}>{payment.bank_name}</span></>}
          </div>
        )}


        {/* Disclaimer */}
        <div style={{ fontSize: '10px', color: '#333', marginTop: '10px', lineHeight: 1.5 }}>
          <strong style={{ color: '#dc2626' }}>Note: </strong>
          Parents are requested to preserve this receipt for future clarification. Fees once paid will not be refunded or transferred.
        </div>

        {/* Receipt Verification Section */}
        <div style={{ marginTop: '12px', padding: '10px 12px', border: '1px dashed #999', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <QRCodeSVG value={verificationUrl} size={64} level="M" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#1a1a1a', marginBottom: '2px' }}>
              Verify This Receipt
            </div>
            <div style={{ fontSize: '9px', color: '#555', lineHeight: 1.5 }}>
              Scan the QR code or visit:
            </div>
            <div style={{ fontSize: '9px', color: '#0f766e', fontFamily: "'Courier New', monospace", wordBreak: 'break-all', marginTop: '2px' }}>
              {verificationUrl}
            </div>
          </div>
        </div>

        {/* System Note */}
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#dc2626', fontStyle: 'italic', marginTop: '8px' }}>
          This is a system-generated Fee Receipt and does not require any stamp or signature.
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] bg-background">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-base font-semibold">Fee Receipt</DrawerTitle>
          </DrawerHeader>
          <div data-vaul-no-drag className="overflow-y-auto flex-1 min-h-0 px-3 pb-4 space-y-2 bg-background">
            {actionButtons}
            {receiptContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Fee Receipt</DialogTitle>
        </DialogHeader>
        {actionButtons}
        {receiptContent}
      </DialogContent>
    </Dialog>
  );
}
