import { useState, useCallback, useRef } from 'react';
import * as XLSX from '@e965/xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  FileDown,
  Eye,
  Filter,
  Users,
  GraduationCap,
  IndianRupee,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  parseFile,
  validateRows,
  generateErrorReport,
  generateTemplate,
  ParseResult,
  ParsedRow,
  STUDENT_FIELDS,
  TEACHER_FIELDS,
  FEE_FIELDS,
} from '@/lib/bulk-upload-utils';
import { useQueryClient } from '@tanstack/react-query';

type UploadType = 'students' | 'teachers' | 'fees';
type Step = 'select' | 'preview' | 'uploading' | 'result';
type RowFilter = 'all' | 'valid' | 'invalid';

const PAGE_SIZE = 50;

export default function BulkUploadPage() {
  const schoolId = useEffectiveSchoolId();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadType, setUploadType] = useState<UploadType>('students');
  const [step, setStep] = useState<Step>('select');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Upload progress
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{
    inserted: number;
    errors: { row: number; error: string }[];
    total: number;
  } | null>(null);

  const filteredRows = parseResult?.rows.filter(r => {
    if (rowFilter === 'valid') return r.isValid;
    if (rowFilter === 'invalid') return !r.isValid;
    return true;
  }) || [];

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const paginatedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(file.type) && !['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size must be under 20MB');
      return;
    }

    setIsParsing(true);
    try {
      const { headers, rawRows } = await parseFile(file);

      if (rawRows.length > 10000) {
        toast.error('Maximum 10,000 records per file');
        setIsParsing(false);
        return;
      }

      const result = validateRows(rawRows, uploadType);
      setParseResult(result);
      setStep('preview');
      setCurrentPage(1);
      setRowFilter('all');
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse file');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [uploadType]);

  const handleUpload = useCallback(async () => {
    if (!parseResult || !schoolId) return;

    const validRows = parseResult.rows.filter(r => r.isValid).map(r => r.data);
    if (validRows.length === 0) {
      toast.error('No valid rows to upload');
      return;
    }

    setStep('uploading');
    setUploadProgress(10);

    try {
      // Simulate progress while waiting for response
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 85));
      }, 500);

      const { data: result } = await api.post('/school/bulk-upload', {
        type: uploadType,
        records: validRows,
      });

      clearInterval(progressInterval);

      setUploadProgress(100);
      setUploadResult(result);
      setStep('result');

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [uploadType === 'students' ? 'students' : uploadType === 'teachers' ? 'teachers' : 'fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      if (uploadType === 'fees') {
        queryClient.invalidateQueries({ queryKey: ['fee-stats'] });
        queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      }

      if (result.errors.length === 0) {
        toast.success(`Successfully uploaded ${result.inserted} ${uploadType}`);
      } else {
        toast.warning(`Uploaded ${result.inserted} ${uploadType} with ${result.errors.length} errors`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Upload failed');
      setStep('preview');
      setUploadProgress(0);
    }
  }, [parseResult, schoolId, uploadType, queryClient]);

  const handleDownloadTemplate = async (type: UploadType) => {
    const blob = await generateTemplate(type);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadErrors = () => {
    if (!parseResult) return;
    const blob = generateErrorReport(parseResult.rows, uploadType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${uploadType}_errors.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadServerErrors = () => {
    if (!uploadResult?.errors.length) return;
    const ws_data = uploadResult.errors.map(e => ({ Row: e.row, Error: e.error }));
    const ws = XLSX.utils.json_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${uploadType}_upload_errors.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep('select');
    setParseResult(null);
    setUploadResult(null);
    setUploadProgress(0);
    setRowFilter('all');
    setCurrentPage(1);
  };

  const fields = uploadType === 'students' ? STUDENT_FIELDS : uploadType === 'teachers' ? TEACHER_FIELDS : FEE_FIELDS;
  const displayHeaders = [...fields.required, ...fields.optional].filter(
    f => parseResult?.headers.includes(f)
  );

  return (
      <div className="space-y-4 animate-fade-up">
        {/* Step: Select File */}
        {step === 'select' && (
          <>
            {/* Type selector */}
            <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as UploadType)}>
              <TabsList className="grid w-full max-w-lg grid-cols-3">
                <TabsTrigger value="students" className="gap-1.5 text-xs sm:text-sm">
                  <Users className="w-3.5 h-3.5" />
                  Students
                </TabsTrigger>
                <TabsTrigger value="teachers" className="gap-1.5 text-xs sm:text-sm">
                  <GraduationCap className="w-3.5 h-3.5" />
                  Teachers
                </TabsTrigger>
                <TabsTrigger value="fees" className="gap-1.5 text-xs sm:text-sm">
                  <IndianRupee className="w-3.5 h-3.5" />
                  Fees
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Upload area */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div
                  className="border-2 border-dashed border-border rounded-xl p-6 sm:p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      <p className="text-base font-medium">Parsing file...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-base font-semibold">
                        Upload {uploadType === 'students' ? 'Students' : uploadType === 'teachers' ? 'Teachers' : 'Fees'} File
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CSV or Excel (.xlsx, .xls) • Max 10,000 rows • 20MB
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Template download + Required fields — combined into single card */}
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    Download Template
                  </p>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate(uploadType)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {uploadType === 'students' ? 'Students' : uploadType === 'teachers' ? 'Teachers' : 'Fees'}
                  </Button>
                </div>
                
                <div className="border-t pt-3 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-destructive mb-1.5">Required *</p>
                    <div className="flex flex-wrap gap-1.5">
                      {fields.required.map(f => (
                        <Badge key={f} variant="destructive" className="text-[10px] h-5">{f}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Optional</p>
                    <div className="flex flex-wrap gap-1.5">
                      {fields.optional.map(f => (
                        <Badge key={f} variant="outline" className="text-[10px] h-5">{f}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Step: Preview */}
        {step === 'preview' && parseResult && (
          <>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={reset}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <h2 className="text-lg font-semibold">Preview & Validate</h2>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{parseResult.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-success">{parseResult.validRows}</p>
                  <p className="text-xs text-muted-foreground">Valid</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-destructive">{parseResult.invalidRows}</p>
                  <p className="text-xs text-muted-foreground">Invalid</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{displayHeaders.length}</p>
                  <p className="text-xs text-muted-foreground">Columns Mapped</p>
                </CardContent>
              </Card>
            </div>

            {/* Filter + Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="flex gap-2">
                {(['all', 'valid', 'invalid'] as RowFilter[]).map(f => (
                  <Button
                    key={f}
                    variant={rowFilter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setRowFilter(f); setCurrentPage(1); }}
                  >
                    {f === 'all' && <Eye className="w-3.5 h-3.5 mr-1.5" />}
                    {f === 'valid' && <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
                    {f === 'invalid' && <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                    {f.charAt(0).toUpperCase() + f.slice(1)} ({
                      f === 'all' ? parseResult.totalRows :
                      f === 'valid' ? parseResult.validRows : parseResult.invalidRows
                    })
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                {parseResult.invalidRows > 0 && (
                  <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                    <FileDown className="w-4 h-4 mr-1.5" />
                    Download Errors
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={parseResult.validRows === 0}
                  onClick={handleUpload}
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  Upload {parseResult.validRows} Valid Records
                </Button>
              </div>
            </div>

            {/* Data table */}
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead className="w-16 text-center">Status</TableHead>
                      {displayHeaders.map(h => (
                        <TableHead key={h} className="whitespace-nowrap text-xs">
                          {h}
                          {fields.required.includes(h) && <span className="text-destructive ml-0.5">*</span>}
                        </TableHead>
                      ))}
                      {filteredRows.some(r => !r.isValid) && (
                        <TableHead className="min-w-[200px]">Errors</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map(row => (
                      <TableRow
                        key={row.rowIndex}
                        className={cn(!row.isValid && 'bg-destructive/5')}
                      >
                        <TableCell className="text-center text-xs text-muted-foreground">{row.rowIndex}</TableCell>
                        <TableCell className="text-center">
                          {row.isValid ? (
                            <CheckCircle className="w-4 h-4 text-success mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive mx-auto" />
                          )}
                        </TableCell>
                        {displayHeaders.map(h => (
                          <TableCell key={h} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                            {row.data[h] || <span className="text-muted-foreground/40">—</span>}
                          </TableCell>
                        ))}
                        {filteredRows.some(r => !r.isValid) && (
                          <TableCell className="text-xs text-destructive">
                            {row.errors.join('; ')}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step: Uploading */}
        {step === 'uploading' && (
          <Card>
            <CardContent className="p-12 text-center space-y-6">
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" />
              <div>
                <p className="text-xl font-semibold">Uploading {uploadType}...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Processing records in batches. Please do not close this page.
                </p>
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <Progress value={uploadProgress} className="h-3" />
                <p className="text-sm text-muted-foreground">{uploadProgress}% complete</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Result */}
        {step === 'result' && uploadResult && (
          <>
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                {uploadResult.errors.length === 0 ? (
                  <CheckCircle className="w-16 h-16 text-success mx-auto" />
                ) : (
                  <AlertTriangle className="w-16 h-16 text-warning mx-auto" />
                )}
                <div>
                  <p className="text-2xl font-bold">
                    {uploadResult.errors.length === 0 ? 'Upload Complete!' : 'Upload Completed with Errors'}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {uploadResult.inserted} of {uploadResult.total} records uploaded successfully
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{uploadResult.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{uploadResult.inserted}</p>
                    <p className="text-xs text-muted-foreground">Inserted</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-destructive">{uploadResult.errors.length}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {uploadResult.errors.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base text-destructive">Failed Records</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleDownloadServerErrors}>
                    <FileDown className="w-4 h-4 mr-1.5" />
                    Download Error Report
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadResult.errors.slice(0, 50).map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{e.row}</TableCell>
                          <TableCell className="text-sm text-destructive">{e.error}</TableCell>
                        </TableRow>
                      ))}
                      {uploadResult.errors.length > 50 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground text-sm">
                            ...and {uploadResult.errors.length - 50} more errors. Download the full report.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={reset}>
                <Upload className="w-4 h-4 mr-2" />
                Upload More
              </Button>
              <Button variant="outline" onClick={() => window.history.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          </>
        )}
      </div>
  );
}
