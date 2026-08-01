import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';

// ─────────────────────────────────────────────────────────────────────────
// 7 of the 9 report types now generate server-side (reports.controller.js)
// and download the returned .xlsx as a blob — the client no longer builds
// the workbook itself for these. Exam Results and Performance Analysis (and
// the Custom Builder's "exams" module) are deliberately NOT migrated: the
// underlying Exam/Result tables have zero rows in Postgres today (marks
// entry — useExams.ts/TeacherMarks.tsx — is still fully on Supabase, a
// separate unmigrated subsystem), so those keep their original client-side
// Supabase path until that gets its own batch.
// ─────────────────────────────────────────────────────────────────────────

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach(col => {
    let max = 12;
    col.eachCell?.({ includeEmpty: false }, cell => {
      const len = String(cell.value || '').length + 4;
      if (len > max) max = len;
    });
    col.width = Math.min(max, 45);
  });
}

function addHeader(ws: ExcelJS.Worksheet, title: string) {
  const row = ws.addRow([title]);
  row.font = { bold: true, size: 14 };
  ws.addRow([`Generated: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`]);
  ws.addRow([]);
}

function styleHeaderRow(headerRow: ExcelJS.Row) {
  headerRow.font = { bold: true, size: 11 };
  headerRow.height = 24;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
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
  // Deferred — Exam/Result have zero rows in Postgres (marks entry is still
  // on Supabase). Unchanged client-side path until that batch happens.
  const generateExamResults = async (filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const tid = toast.loading('Generating Exam Results Report...');
    try {
      let examQuery = supabase
        .from('exams')
        .select('id, name, class_name, subject, max_marks, exam_date')
        .eq('school_id', schoolId)
        .order('exam_date', { ascending: false });

      if (filters.examId) examQuery = examQuery.eq('id', filters.examId);
      if (filters.className) examQuery = examQuery.eq('class_name', filters.className);

      const { data: exams, error: eErr } = await examQuery;
      if (eErr) throw eErr;
      if (!exams?.length) {
        toast.dismiss(tid);
        toast.info('No exams found for the selected filters.');
        return;
      }

      const examIds = exams.map(e => e.id);
      const { data: results, error: rErr } = await supabase
        .from('results')
        .select('exam_id, student_id, marks_obtained, grade, remarks')
        .in('exam_id', examIds);

      if (rErr) throw rErr;

      // Get student details
      const studentIds = [...new Set((results || []).map(r => r.student_id))];
      const { data: students } = await supabase
        .from('students')
        .select('id, full_name, admission_number, class_name, section, roll_number')
        .in('id', studentIds.length > 0 ? studentIds : ['00000000-0000-0000-0000-000000000000']);

      const studentMap = new Map((students || []).map(s => [s.id, s]));

      const wb = new ExcelJS.Workbook();

      for (const exam of exams) {
        const examResults = (results || []).filter(r => r.exam_id === exam.id);
        const ws = wb.addWorksheet(`${exam.name}-${exam.subject}`.substring(0, 30));
        addHeader(ws, `${exam.name} - ${exam.subject} (Class ${exam.class_name})`);
        ws.addRow([`Max Marks: ${exam.max_marks} | Date: ${new Date(exam.exam_date).toLocaleDateString('en-IN')}`]);
        ws.addRow([]);

        const headerRow = ws.addRow(['#', 'Name', 'Admission No', 'Section', 'Roll No', 'Marks', 'Percentage', 'Grade', 'Remarks']);
        styleHeaderRow(headerRow);

        const sorted = examResults
          .map(r => ({ ...r, student: studentMap.get(r.student_id) }))
          .sort((a, b) => b.marks_obtained - a.marks_obtained);

        sorted.forEach((r, i) => {
          const pct = exam.max_marks > 0 ? ((r.marks_obtained / exam.max_marks) * 100).toFixed(1) + '%' : '';
          ws.addRow([
            i + 1, r.student?.full_name || '', r.student?.admission_number || '',
            r.student?.section || '', r.student?.roll_number || '',
            r.marks_obtained, pct, r.grade || '', r.remarks || '',
          ]);
        });

        if (sorted.length > 0) {
          ws.addRow([]);
          const avg = sorted.reduce((s, r) => s + r.marks_obtained, 0) / sorted.length;
          const highest = sorted[0]?.marks_obtained || 0;
          const lowest = sorted[sorted.length - 1]?.marks_obtained || 0;
          const statsRow = ws.addRow(['', 'Statistics', '', '', '', `Avg: ${avg.toFixed(1)}`, `Highest: ${highest}`, `Lowest: ${lowest}`, `Students: ${sorted.length}`]);
          statsRow.font = { bold: true };
        }

        autoWidth(ws);
      }

      await downloadWorkbook(wb, `exam-results-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(tid);
      toast.success(`Exam results exported (${exams.length} exams)`);
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error(err.message || 'Failed to generate report');
    }
  };

  // ─── PERFORMANCE ANALYSIS ────────────────────────────
  // Deferred — same Exam/Result dependency as above, plus needs its own new
  // aggregation logic. Unchanged client-side path.
  const generatePerformanceAnalysis = async (filters: ReportFilters = {}) => {
    if (!schoolId) return;
    const tid = toast.loading('Generating Performance Analysis...');
    try {
      let examQuery = supabase
        .from('exams')
        .select('id, name, class_name, subject, max_marks')
        .eq('school_id', schoolId);

      if (filters.className) examQuery = examQuery.eq('class_name', filters.className);

      const { data: exams, error: eErr } = await examQuery;
      if (eErr) throw eErr;
      if (!exams?.length) {
        toast.dismiss(tid);
        toast.info('No exams found.');
        return;
      }

      const examIds = exams.map(e => e.id);
      const { data: results, error: rErr } = await supabase
        .from('results')
        .select('exam_id, student_id, marks_obtained')
        .in('exam_id', examIds);

      if (rErr) throw rErr;

      const studentIds = [...new Set((results || []).map(r => r.student_id))];
      const { data: students } = await supabase
        .from('students')
        .select('id, full_name, admission_number, class_name, section')
        .in('id', studentIds.length > 0 ? studentIds : ['00000000-0000-0000-0000-000000000000']);

      const studentMap = new Map((students || []).map(s => [s.id, s]));
      const examMap = new Map(exams.map(e => [e.id, e]));

      const wb = new ExcelJS.Workbook();

      // Subject-wise performance
      const subjectWs = wb.addWorksheet('Subject Performance');
      addHeader(subjectWs, 'Subject-wise Performance Summary');
      const sh = subjectWs.addRow(['Subject', 'Class', 'Exam', 'Students', 'Average', 'Highest', 'Lowest', 'Pass Rate (≥40%)']);
      styleHeaderRow(sh);

      const examGroups = new Map<string, typeof results>();
      for (const r of results || []) {
        const eid = r.exam_id;
        if (!examGroups.has(eid)) examGroups.set(eid, []);
        examGroups.get(eid)!.push(r);
      }

      for (const [eid, ers] of Array.from(examGroups.entries())) {
        const exam = examMap.get(eid);
        if (!exam) continue;
        const marks = ers.map(r => r.marks_obtained);
        const avg = marks.reduce((s, m) => s + m, 0) / marks.length;
        const passRate = exam.max_marks > 0 ? ((marks.filter(m => (m / exam.max_marks) * 100 >= 40).length / marks.length) * 100).toFixed(1) + '%' : '';
        subjectWs.addRow([exam.subject, exam.class_name, exam.name, marks.length, avg.toFixed(1), Math.max(...marks), Math.min(...marks), passRate]);
      }
      autoWidth(subjectWs);

      // Top performers
      const topWs = wb.addWorksheet('Top Performers');
      addHeader(topWs, 'Top Performers');

      // Calculate total percentage per student across all exams
      const studentScores = new Map<string, { totalPct: number; count: number }>();
      for (const r of results || []) {
        const exam = examMap.get(r.exam_id);
        if (!exam || exam.max_marks === 0) continue;
        const pct = (r.marks_obtained / exam.max_marks) * 100;
        if (!studentScores.has(r.student_id)) studentScores.set(r.student_id, { totalPct: 0, count: 0 });
        const s = studentScores.get(r.student_id)!;
        s.totalPct += pct;
        s.count++;
      }

      const ranked = Array.from(studentScores.entries())
        .map(([sid, { totalPct, count }]) => ({
          student: studentMap.get(sid),
          avgPct: totalPct / count,
          examsTaken: count,
        }))
        .filter(r => r.student)
        .sort((a, b) => b.avgPct - a.avgPct)
        .slice(0, 50);

      const th = topWs.addRow(['Rank', 'Name', 'Admission No', 'Class', 'Section', 'Exams Taken', 'Average %']);
      styleHeaderRow(th);
      ranked.forEach((r, i) => {
        topWs.addRow([i + 1, r.student?.full_name, r.student?.admission_number, r.student?.class_name, r.student?.section, r.examsTaken, r.avgPct.toFixed(1) + '%']);
      });
      autoWidth(topWs);

      await downloadWorkbook(wb, `performance-analysis-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(tid);
      toast.success('Performance analysis exported');
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error(err.message || 'Failed to generate report');
    }
  };

  // ─── CUSTOM REPORT BUILDER ───────────────────────────
  // students/fees/attendance modules now hit the server-side endpoint;
  // "exams" stays on its original client-side Supabase path (deferred, same
  // reason as the two reports above).
  const generateCustomReport = async (module: string, fields: string[], filters: ReportFilters = {}) => {
    if (!schoolId) return;

    if (module === 'exams') {
      const tid = toast.loading('Generating Custom Report...');
      try {
        const { data: d, error } = await supabase
          .from('results')
          .select('marks_obtained, grade, remarks, exam:exams!inner(name, subject, class_name, max_marks), student:students!inner(full_name, class_name, section)')
          .in('exam_id', (
            await supabase.from('exams').select('id').eq('school_id', schoolId)
          ).data?.map(e => e.id) || []);
        if (error) throw error;
        let data = (d || []).map((r: any) => ({
          student_name: r.student?.full_name,
          class_name: r.exam?.class_name,
          exam_name: r.exam?.name,
          subject: r.exam?.subject,
          marks: r.marks_obtained,
          max_marks: r.exam?.max_marks,
          grade: r.grade,
        }));
        if (filters.className) data = data.filter(r => r.class_name === filters.className);

        if (data.length === 0) {
          toast.dismiss(tid);
          toast.info('No data found for the selected criteria.');
          return;
        }

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Report');
        addHeader(ws, 'Custom Exam Report');

        const columns = fields.length > 0 ? fields : Object.keys(data[0]);
        const headerRow = ws.addRow(columns.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())));
        styleHeaderRow(headerRow);

        for (const row of data) {
          ws.addRow(columns.map(c => (row as any)[c] ?? ''));
        }

        autoWidth(ws);
        ws.views = [{ state: 'frozen', ySplit: 4 }];
        await downloadWorkbook(wb, `custom-report-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.dismiss(tid);
        toast.success(`Custom report exported (${data.length} records)`);
      } catch (err: any) {
        toast.dismiss(tid);
        toast.error(err.message || 'Failed to generate report');
      }
      return;
    }

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
