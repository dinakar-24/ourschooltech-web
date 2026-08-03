import { useState, useRef, useCallback, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2,
} from 'lucide-react';
import * as XLSX from '@e965/xlsx';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface ParsedRow {
  rowIndex: number;
  admission_number: string;
  fee_type: string;
  amount: number;
  due_date: string;
  term_name: string;
  errors: string[];
}

interface InvoiceGroup {
  admission_number: string;
  due_date: string;
  term_name: string;
  components: { fee_type: string; amount: number }[];
  totalAmount: number;
  rows: number[];
}

/* ─── Header Aliases ─────────────────────────────────────────────────── */

const ALIASES: Record<string, string> = {
  'admission no': 'admission_number', 'admission_no': 'admission_number',
  'adm no': 'admission_number', 'adm_no': 'admission_number',
  'admission number': 'admission_number',
  'fee type': 'fee_type', 'type': 'fee_type', 'fee_type': 'fee_type',
  'amount': 'amount', 'amt': 'amount',
  'due date': 'due_date', 'due_date': 'due_date', 'due': 'due_date',
  'term': 'term_name', 'term name': 'term_name', 'term_name': 'term_name',
};

const REQUIRED = ['admission_number', 'fee_type', 'amount', 'due_date'];

function normalize(h: string): string {
  const lower = h.toLowerCase().trim();
  return ALIASES[lower] || lower.replace(/\s+/g, '_');
}

/* ─── Component ──────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportFeesDialog({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile();
  const schoolId = useEffectiveSchoolId();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setImportProgress(0);
    setImportResult({ success: 0, failed: 0 });
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleClose = useCallback((v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  }, [onOpenChange, reset]);

  /* ── Parse File ──────────────────────────────────────────────────── */

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array', dateNF: 'yyyy-mm-dd' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

        if (!json.length) {
          toast.error('File is empty');
          return;
        }

        const origHeaders = Object.keys(json[0]);
        const headerMap: Record<string, string> = {};
        origHeaders.forEach(h => { headerMap[h] = normalize(h); });

        const parsed: ParsedRow[] = json.map((row, i) => {
          const norm: Record<string, string> = {};
          for (const [orig, mapped] of Object.entries(headerMap)) {
            norm[mapped] = row[orig] !== null && row[orig] !== undefined ? String(row[orig]).trim() : '';
          }

          const errors: string[] = [];
          for (const req of REQUIRED) {
            if (!norm[req]) errors.push(`Missing "${req}"`);
          }

          const amount = parseFloat(norm.amount || '0');
          if (norm.amount && (isNaN(amount) || amount <= 0)) errors.push('Invalid amount');
          if (norm.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(norm.due_date)) errors.push('due_date must be YYYY-MM-DD');

          return {
            rowIndex: i + 2,
            admission_number: norm.admission_number || '',
            fee_type: norm.fee_type || '',
            amount: isNaN(amount) ? 0 : amount,
            due_date: norm.due_date || '',
            term_name: norm.term_name || '',
            errors,
          };
        });

        setRows(parsed);
        setStep('preview');
      } catch {
        toast.error('Failed to parse file');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* ── Grouped Invoices ────────────────────────────────────────────── */

  const validRows = useMemo(() => rows.filter(r => r.errors.length === 0), [rows]);
  const invalidRows = useMemo(() => rows.filter(r => r.errors.length > 0), [rows]);

  const invoiceGroups = useMemo(() => {
    const map = new Map<string, InvoiceGroup>();
    for (const r of validRows) {
      const key = `${r.admission_number}|${r.due_date}`;
      if (!map.has(key)) {
        map.set(key, {
          admission_number: r.admission_number,
          due_date: r.due_date,
          term_name: r.term_name,
          components: [],
          totalAmount: 0,
          rows: [],
        });
      }
      const g = map.get(key)!;
      g.components.push({ fee_type: r.fee_type, amount: r.amount });
      g.totalAmount += r.amount;
      g.rows.push(r.rowIndex);
    }
    return Array.from(map.values());
  }, [validRows]);

  /* ── Import ──────────────────────────────────────────────────────── */

  const handleImport = useCallback(async () => {
    if (!schoolId || invoiceGroups.length === 0) return;
    setStep('importing');
    setImportProgress(50);

    try {
      // Grouping into multi-component invoices now happens server-side
      // (bulkCreateFees), from the same admission_number+due_date key --
      // send the raw valid rows, not the client-side invoiceGroups preview.
      const { data } = await api.post('/school/bulk-upload', {
        type: 'fees',
        records: validRows.map(r => ({
          admission_number: r.admission_number,
          fee_type: r.fee_type,
          amount: r.amount,
          due_date: r.due_date,
        })),
      });

      setImportResult({ success: data.inserted, failed: invoiceGroups.length - data.inserted });
    } catch {
      setImportResult({ success: 0, failed: invoiceGroups.length });
    }

    setImportProgress(100);
    setStep('done');
    queryClient.invalidateQueries({ queryKey: queryKeys.allFeeInvoices });
    queryClient.invalidateQueries({ queryKey: queryKeys.allInvoiceStats });
  }, [schoolId, invoiceGroups, validRows, queryClient]);

  /* ── Download Sample ─────────────────────────────────────────────── */

  const downloadSample = useCallback(async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Fee Import', { views: [{ state: 'frozen', ySplit: 1 }] });

    const headers = ['admission_number', 'fee_type', 'amount', 'due_date', 'term_name'];
    const samples = [
      ['ADM001', 'Tuition Fee', '15000', '2026-04-01', 'Term 1'],
      ['ADM001', 'Transport Fee', '5000', '2026-04-01', 'Term 1'],
      ['ADM001', 'Lab Fee', '2000', '2026-04-01', 'Term 1'],
      ['ADM002', 'Tuition Fee', '15000', '2026-04-01', 'Term 1'],
      ['ADM002', 'Transport Fee', '5000', '2026-04-01', 'Term 1'],
    ];

    ws.columns = headers.map(h => {
      const maxLen = Math.max(h.length, ...samples.map(s => s[headers.indexOf(h)]?.length || 0));
      return { header: h, key: h, width: maxLen + 6 };
    });

    const hRow = ws.getRow(1);
    hRow.height = 24;
    hRow.eachCell((cell, col) => {
      const isRequired = col <= 4;
      cell.font = { bold: true, size: 11, color: { argb: isRequired ? 'FFDC2626' : 'FF1A1A1A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } } };
    });

    for (const s of samples) {
      const dRow = ws.addRow(s);
      dRow.eachCell(cell => {
        cell.font = { size: 10, italic: true, color: { argb: 'FF999999' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fee_import_sample.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  /* ── Render Content ────────────────────────────────────────────────── */

  const content = (
    <div className="space-y-4">
      {step === 'upload' && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={downloadSample}>
              <Download className="w-4 h-4 mr-1.5" /> Download Sample
            </Button>
          </div>

          <div
            className="border-2 border-dashed rounded-xl p-6 md:p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Drop Excel/CSV file here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
              Rows with same admission number + due date → one invoice with multiple fee types
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />

          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground">Required columns (red in sample):</p>
            <div className="flex flex-wrap gap-1.5">
              {REQUIRED.map(f => (
                <Badge key={f} variant="outline" className="text-xs border-destructive/50 text-destructive">{f}</Badge>
              ))}
              <Badge variant="outline" className="text-xs">term_name (optional)</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              💡 Multiple rows with same admission_number + due_date automatically merge into one invoice with multiple fee components.
            </p>
          </div>
        </>
      )}

      {step === 'preview' && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">{fileName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold">{rows.length}</p>
              <p className="text-xs text-muted-foreground">Rows</p>
            </div>
            <div className="bg-success/10 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-success">{invoiceGroups.length}</p>
              <p className="text-xs text-muted-foreground">Invoices</p>
            </div>
            <div className="bg-destructive/10 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-destructive">{invalidRows.length}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>

          {/* Invoice Preview */}
          <ScrollArea className="max-h-[40vh]">
            <div className="space-y-2">
              {invoiceGroups.map((g, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">{g.admission_number}</Badge>
                      <span className="text-xs text-muted-foreground">Due: {g.due_date}</span>
                    </div>
                    <span className="text-sm font-bold">₹{g.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.components.map((c, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">
                        {c.fee_type}: ₹{c.amount.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                  {g.term_name && (
                    <p className="text-xs text-muted-foreground">Term: {g.term_name}</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Error rows */}
          {invalidRows.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {invalidRows.length} rows with errors (will be skipped)
              </p>
              <ScrollArea className="max-h-24">
                <div className="space-y-1">
                  {invalidRows.slice(0, 10).map(r => (
                    <p key={r.rowIndex} className="text-xs text-muted-foreground">
                      Row {r.rowIndex}: {r.errors.join(', ')}
                    </p>
                  ))}
                  {invalidRows.length > 10 && (
                    <p className="text-xs text-muted-foreground">...and {invalidRows.length - 10} more</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={reset}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={invoiceGroups.length === 0}
              onClick={handleImport}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Import {invoiceGroups.length} Invoice{invoiceGroups.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </>
      )}

      {step === 'importing' && (
        <div className="py-8 text-center space-y-4">
          <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
          <p className="text-sm font-medium">Creating invoices...</p>
          <Progress value={importProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">{importProgress}%</p>
        </div>
      )}

      {step === 'done' && (
        <div className="py-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-success" />
          <p className="text-lg font-semibold">Import Complete</p>
          <div className="flex justify-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{importResult.success}</p>
              <p className="text-xs text-muted-foreground">Created</p>
            </div>
            {importResult.failed > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{importResult.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            )}
          </div>
          <Button onClick={() => handleClose(false)} className="mt-2">Done</Button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Import Fee Invoices</DrawerTitle>
            <DrawerDescription>Upload Excel/CSV with fee data</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Fee Invoices</DialogTitle>
          <DialogDescription>Upload Excel/CSV with fee data</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
