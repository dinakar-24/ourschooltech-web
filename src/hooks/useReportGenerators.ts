import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// All 9 report types now generate server-side (reports.controller.js) and
// download the returned .xlsx as a blob — the client no longer builds any
// workbook itself. Exam Results/Performance Analysis/the Custom Builder's
// "exams" module were the last 3 held back (Exam/Result had zero rows until
// the exam/marks management batch); now direct ports of the same working
// aggregation logic (subject averages, pass rate, top-50 cross-exam
// ranking), not new logic, since that logic already existed here.
// ─────────────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Reports fail as a JSON error body, but axios still hands it back as a
// Blob when responseType is 'blob' — has to be read as text and parsed
// before the real message is visible.
async function extractReportError(err: any): Promise<string> {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed.error || 'Failed to generate report';
    } catch {
      return 'Failed to generate report';
    }
  }
  return err?.response?.data?.error || err?.message || 'Failed to generate report';
}

export interface ReportFilters {
  className?: string;
  section?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  examId?: string;
  status?: string;
}

export function useReportGenerators() {
  const schoolId = useEffectiveSchoolId();

  // ─── STUDENT LIST REPORT ─────────────────────────────
  const generateStudentList = async (filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const tid = toast.loading('Generating Student List Report...');
    try {
      const params: Record<string, string> = {};
      if (filters.className) params.className = filters.className;
      if (filters.section) params.section = filters.section;
      if (filters.status && filters.status !== 'all') params.status = filters.status;

      const response = await api.get('/school/reports/students', { params, responseType: 'blob' });
      downloadBlob(response.data, `student-list-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(tid);
      toast.success('Student List exported');
    } catch (err) {
      toast.dismiss(tid);
      toast.error(await extractReportError(err));
    }
  };

  // ─── CLASS-WISE REPORT ───────────────────────────────
  const generateClassWise = async () => {
    if (!schoolId) return;
    const tid = toast.loading('Generating Class-wise Report...');
    try {
      const response = await api.get('/school/reports/class-wise', { responseType: 'blob' });
      downloadBlob(response.data, `class-wise-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(tid);
      toast.success('Class-wise report exported');
    } catch (err) {
      toast.dismiss(tid);
      toast.error(await extractReportError(err));
    }
  };

  // ─── DAILY ATTENDANCE REPORT ─────────────────────────
  const generateDailyAttendance = async (filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const date = filters.date || new Date().toISOString().split('T')[0];
    const tid = toast.loading('Generating Daily Attendance Report...');
    try {
      const params: Record<string, string> = { date };
      if (filters.className) params.className = filters.className;

      const response = await api.get('/school/reports/attendance/daily', { params, responseType: 'blob' });
      downloadBlob(response.data, `daily-attendance-${date}.xlsx`);
      toast.dismiss(tid);
      toast.success(`Attendance report exported for ${new Date(date).toLocaleDateString('en-IN')}`);
    } catch (err) {
      toast.dismiss(tid);
      toast.error(await extractReportError(err));
    }
  };

  // ─── ABSENTEE REPORT ─────────────────────────────────
  const generateAbsenteeReport = async (filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const dateFrom = filters.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = filters.dateTo || new Date().toISOString().split('T')[0];
    const tid = toast.loading('Generating Absentee Report...');
    try {
      const params: Record<string, string> = { dateFrom, dateTo };
      if (filters.className) params.className = filters.className;

      const response = await api.get('/school/reports/attendance/absentees', { params, responseType: 'blob' });
      downloadBlob(response.data, `absentee-report-${dateFrom}-to-${dateTo}.xlsx`);
      toast.dismiss(tid);
      toast.success('Absentee report exported');
    } catch (err) {
      toast.dismiss(tid);
      toast.error(await extractReportError(err));
    }
  };

  // ─── FEE COLLECTION REPORT ───────────────────────────
  const generateFeeCollection = async (filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const tid = toast.loading('Generating Fee Collection Report...');
    try {
      const params: Record<string, string> = {};
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.className) params.className = filters.className;

      const response = await api.get('/school/reports/fees/collection', { params, responseType: 'blob' });
      downloadBlob(response.data, `fee-collection-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(tid);
      toast.success('Collection report exported');
    } catch (err) {
      toast.dismiss(tid);
      toast.error(await extractReportError(err));
    }
  };

  // ─── PENDING DUES REPORT ─────────────────────────────
  const generatePendingDues = async (filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const tid = toast.loading('Generating Pending Dues Report...');
    try {
      const params: Record<string, string> = {};
      if (filters.className) params.className = filters.className;

      const response = await api.get('/school/reports/fees/pending', { params, responseType: 'blob' });
      downloadBlob(response.data, `pending-dues-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(tid);
      toast.success('Pending dues exported');
    } catch (err) {
      toast.dismiss(tid);
      toast.error(await extractReportError(err));
    }
  };

  // ─── EXAM RESULTS REPORT ─────────────────────────────
  const generateExamResults = async (filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const tid = toast.loading('Generating Exam Results Report...');
    try {
      const params: Record<string, string> = {};
      if (filters.examId) params.examId = filters.examId;
      if (filters.className) params.className = filters.className;

      const response = await api.get('/school/reports/exams/results', { params, responseType: 'blob' });
      downloadBlob(response.data, `exam-results-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(tid);
      toast.success('Exam results exported');
    } catch (err) {
      toast.dismiss(tid);
      toast.error(await extractReportError(err));
    }
  };

  // ─── PERFORMANCE ANALYSIS ────────────────────────────
  const generatePerformanceAnalysis = async (filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const tid = toast.loading('Generating Performance Analysis...');
    try {
      const params: Record<string, string> = {};
      if (filters.className) params.className = filters.className;

      const response = await api.get('/school/reports/exams/performance', { params, responseType: 'blob' });
      downloadBlob(response.data, `performance-analysis-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(tid);
      toast.success('Performance analysis exported');
    } catch (err) {
      toast.dismiss(tid);
      toast.error(await extractReportError(err));
    }
  };

  // ─── CUSTOM REPORT BUILDER ───────────────────────────
  const generateCustomReport = async (module: string, fields: string[], filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const tid = toast.loading('Generating Custom Report...');
    try {
      const params: Record<string, string> = { module, fields: fields.join(',') };
      if (filters.className) params.className = filters.className;
      if (filters.section) params.section = filters.section;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.date) params.date = filters.date;

      const response = await api.get('/school/reports/custom', { params, responseType: 'blob' });
      downloadBlob(response.data, `custom-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(tid);
      toast.success('Custom report exported');
    } catch (err) {
      toast.dismiss(tid);
      toast.error(await extractReportError(err));
    }
  };

  return {
    generateStudentList,
    generateClassWise,
    generateDailyAttendance,
    generateAbsenteeReport,
    generateFeeCollection,
    generatePendingDues,
    generateExamResults,
    generatePerformanceAnalysis,
    generateCustomReport,
  };
}
