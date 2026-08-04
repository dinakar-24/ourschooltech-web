import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Download,
  Users,
  CreditCard,
  ClipboardList,
  Award,
  TrendingUp,
  FileText,
  IndianRupee,
} from 'lucide-react';
import { useSchoolReportStats } from '@/hooks/useSchoolReportStats';
import { useReportGenerators, type ReportFilters } from '@/hooks/useReportGenerators';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportFilterDialog, type ReportType } from '@/components/reports/ReportFilterDialog';
import { CustomReportDialog } from '@/components/reports/CustomReportDialog';

const reportCategories = [
  {
    title: 'Student Reports',
    icon: Users,
    color: 'bg-primary/10 text-primary',
    reports: [
      { name: 'Student List Report', description: 'Complete list of all enrolled students', key: 'student-list' as ReportType },
      { name: 'Class-wise Report', description: 'Students categorized by class and section', key: 'class-wise' as ReportType },
    ],
  },
  {
    title: 'Attendance Reports',
    icon: ClipboardList,
    color: 'bg-success/10 text-success',
    reports: [
      { name: 'Daily Attendance', description: 'Day-wise attendance summary', key: 'daily-attendance' as ReportType },
      { name: 'Absentee Report', description: 'List of absent students', key: 'absentee' as ReportType },
    ],
  },
  {
    title: 'Fee Reports',
    icon: CreditCard,
    color: 'bg-warning/10 text-warning',
    reports: [
      { name: 'Collection Report', description: 'Fee collection summary', key: 'fee-collection' as ReportType },
      { name: 'Pending Dues', description: 'List of pending fee payments', key: 'pending-dues' as ReportType },
    ],
  },
  {
    title: 'Academic Reports',
    icon: Award,
    color: 'bg-info/10 text-info',
    reports: [
      { name: 'Exam Results', description: 'Subject-wise exam results', key: 'exam-results' as ReportType },
      { name: 'Performance Analysis', description: 'Class-wise performance comparison', key: 'performance' as ReportType },
    ],
  },
];

export default function ReportsPage() {
  const { data: stats, isLoading } = useSchoolReportStats();
  const generators = useReportGenerators();
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportType>('student-list');

  const handleGenerate = (reportKey: ReportType) => {
    setActiveReport(reportKey);
    // Class-wise report has no filters, generate directly
    if (reportKey === 'class-wise') {
      generators.generateClassWise();
      return;
    }
    setFilterDialogOpen(true);
  };

  const handleReportGenerate = async (filters: ReportFilters) => {
    switch (activeReport) {
      case 'student-list': return generators.generateStudentList(filters);
      case 'daily-attendance': return generators.generateDailyAttendance(filters);
      case 'absentee': return generators.generateAbsenteeReport(filters);
      case 'fee-collection': return generators.generateFeeCollection(filters);
      case 'pending-dues': return generators.generatePendingDues(filters);
      case 'exam-results': return generators.generateExamResults(filters);
      case 'performance': return generators.generatePerformanceAnalysis(filters);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fade-up">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12" /> : (
                    <p className="text-2xl font-bold">{stats?.totalStudents ?? 0}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-success" />
                </div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12" /> : (
                    <p className="text-2xl font-bold">{stats?.attendanceToday.present ?? 0}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Present Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-warning" />
                </div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12" /> : (
                    <p className="text-2xl font-bold">₹{((stats?.totalFeeCollected ?? 0) / 1000).toFixed(0)}k</p>
                  )}
                  <p className="text-sm text-muted-foreground">Collected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  {isLoading ? <Skeleton className="h-8 w-12" /> : (
                    <p className="text-2xl font-bold">₹{((stats?.totalFeePending ?? 0) / 1000).toFixed(0)}k</p>
                  )}
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Categories */}
        <div className="grid md:grid-cols-2 gap-6">
          {reportCategories.map((category) => (
            <Card key={category.title}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${category.color}`}>
                    <category.icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg">{category.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.reports.map((report) => (
                  <div 
                    key={report.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{report.name}</p>
                      <p className="text-xs text-muted-foreground">{report.description}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleGenerate(report.key)}>
                      <Download className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Report Builder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Custom Report Builder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Create custom reports by selecting specific data fields and filters.
            </p>
            <Button onClick={() => setCustomDialogOpen(true)}>
              <FileText className="w-4 h-4 mr-2" />
              Create Custom Report
            </Button>
          </CardContent>
        </Card>
      </div>

      <ReportFilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        reportType={activeReport}
        onGenerate={handleReportGenerate}
      />

      <CustomReportDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        onGenerate={generators.generateCustomReport}
      />
    </>
  );
}
