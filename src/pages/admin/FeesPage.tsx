import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useClasses } from '@/hooks/useClasses';
import { useSections } from '@/hooks/useSections';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Search, Plus, TrendingUp, AlertCircle, CheckCircle,
  ChevronRight, User,
  Download, Bell, ShieldCheck, Upload, MoreHorizontal,
} from 'lucide-react';
import { useFeeInvoices, useInvoiceStats, FeeInvoice } from '@/hooks/useFeeInvoices';
import { usePaymentSubmissions } from '@/hooks/usePaymentSubmissions';
import { PaymentVerificationPanel } from '@/components/fees/PaymentVerificationPanel';
import { useDebounce } from '@/hooks/useDebounce';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useFeeRealtime } from '@/hooks/useFeeRealtime';
import { useFeeReports } from '@/hooks/useFeeReports';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateInvoiceDialog } from '@/components/fees/CreateInvoiceDialog';
import { SendReminderDialog } from '@/components/fees/SendReminderDialog';
import { ImportFeesDialog } from '@/components/fees/ImportFeesDialog';

interface StudentGroup {
  studentId: string;
  name: string;
  admissionNumber: string;
  className: string;
  section: string;
  invoices: FeeInvoice[];
  totalAmount: number;
  totalPaid: number;
  totalBalance: number;
}

// Legacy fee-table merge dropped here: useFeeInvoices already represents
// everything the flat `fees` table tracked, and there's no Express
// equivalent of that table to reconcile against (superseded by design, not
// "not yet built"). See useFees.ts's own migration note.
function groupByStudent(invoices: FeeInvoice[]): StudentGroup[] {
  const map = new Map<string, StudentGroup>();

  for (const inv of invoices) {
    const sid = inv.student_id;
    if (!map.has(sid)) {
      map.set(sid, {
        studentId: sid,
        name: inv.student?.full_name || 'Unknown',
        admissionNumber: inv.student?.admission_number || '',
        className: inv.student?.class_name || '',
        section: inv.student?.section || '',
        invoices: [],
        totalAmount: 0,
        totalPaid: 0,
        totalBalance: 0,
      });
    }
    const g = map.get(sid)!;
    g.invoices.push(inv);
    g.totalAmount += Number(inv.total_amount);
    g.totalPaid += Number(inv.paid_amount);
    g.totalBalance += Number(inv.balance);
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default function FeesPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const schoolId = useEffectiveSchoolId();
  const [searchInput, setSearchInput] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [showVerifications, setShowVerifications] = useState(false);

  useFeeRealtime({
    schoolId,
    scope: 'admin-fees',
    enabled: !!schoolId,
  });

  const { data: classes } = useClasses();
  const { data: sections } = useSections(selectedClass !== 'all' ? selectedClass : undefined);

  // Dialogs
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { generateFeeSummary, generatePendingList, generatePaymentHistory, generateAllInvoices } = useFeeReports();

  const debouncedSearch = useDebounce(searchInput, 400);

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data: invoicesResult, isLoading } = useFeeInvoices({
    status: selectedStatus,
    search: debouncedSearch,
    className: selectedClass,
    page,
    pageSize,
  });
  const invoices = invoicesResult?.data || [];
  const totalCount = invoicesResult?.totalCount || 0;
  const { data: invoiceStats } = useInvoiceStats();

  const stats = invoiceStats;
  const loading = isLoading;
  const totalPages = Math.ceil(totalCount / pageSize);

  const { data: pendingSubmissions = [] } = usePaymentSubmissions('pending');
  const pendingCount = pendingSubmissions.length;

  const studentGroups = useMemo(
    () => groupByStudent(invoices),
    [invoices]
  );

  const filteredGroups = useMemo(() => {
    let groups = studentGroups;

    if (selectedSection !== 'all') {
      groups = groups.filter(g => g.section === selectedSection);
    }

    if (selectedStatus === 'all') return groups;
    return groups.filter(g => {
      if (selectedStatus === 'paid') return g.totalBalance === 0 && g.totalAmount > 0;
      if (selectedStatus === 'pending') return g.totalBalance > 0;
      if (selectedStatus === 'overdue') {
        const today = new Date().toISOString().split('T')[0];
        return g.invoices.some(i => i.status === 'pending' && i.due_date < today);
      }
      return true;
    });
  }, [studentGroups, selectedStatus, selectedSection]);

  const getGroupBadge = (g: StudentGroup) => {
    if (g.totalAmount === 0) return <Badge variant="secondary">No Fees</Badge>;
    if (g.totalBalance === 0) return <Badge className="bg-success text-success-foreground">Paid</Badge>;
    const today = new Date().toISOString().split('T')[0];
    const hasOverdue = g.invoices.some(i => i.status === 'pending' && i.due_date < today);
    if (hasOverdue) return <Badge variant="destructive">Overdue</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  const fmt = (n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n.toLocaleString()}`;
  };

  const collectionRate = stats && stats.totalDue > 0 ? ((stats.collected / stats.totalDue) * 100).toFixed(0) : '0';

  const goToStudent = (studentId: string) => {
    navigate(`/admin/fees/${studentId}`);
  };

  return (
    <AdminLayout title="Fees Management">
      <div className="space-y-6 animate-fade-up">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: CheckCircle, value: fmt(stats?.collected || 0), label: 'Collected', color: 'text-success', bg: 'bg-success/10' },
            { icon: AlertCircle, value: fmt(stats?.pending || 0), label: 'Pending', color: 'text-warning', bg: 'bg-warning/10' },
            { icon: AlertCircle, value: fmt(stats?.overdue || 0), label: 'Overdue', color: 'text-destructive', bg: 'bg-destructive/10' },
            { icon: TrendingUp, value: `${collectionRate}%`, label: 'Collection Rate', color: 'text-foreground', bg: 'bg-primary/10' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 md:p-4">
                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg mb-1.5 md:mb-2 ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${s.color}`} />
                </div>
                <p className={`text-xl md:text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs md:text-sm text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions + Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Student Fees</h2>
              <Badge variant="outline" className="text-xs font-normal">
                {filteredGroups.length}{filteredGroups.length !== studentGroups.length ? `/${studentGroups.length}` : ''} students
              </Badge>
            </div>
            
            {!isMobile ? (
              <div className="flex gap-2 flex-wrap">
                {pendingCount > 0 && (
                  <Button
                    variant={showVerifications ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowVerifications(!showVerifications)}
                    className="relative"
                  >
                    <ShieldCheck className="w-4 h-4 mr-1" />
                    Verify
                    <Badge className="ml-1 bg-warning text-warning-foreground text-xs px-1.5 py-0">{pendingCount}</Badge>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setReminderDialogOpen(true)}>
                  <Bell className="w-4 h-4 mr-1" /> Reminders
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-1" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={generateFeeSummary}>Fee Summary Report</DropdownMenuItem>
                    <DropdownMenuItem onClick={generatePendingList}>Pending Fees List</DropdownMenuItem>
                    <DropdownMenuItem onClick={generatePaymentHistory}>Payment History</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={generateAllInvoices}>All Invoices (Detailed)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-1" /> Import
                </Button>
                <Button size="sm" onClick={() => setInvoiceDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Create Invoice
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setInvoiceDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Create
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon-sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setReminderDialogOpen(true)}>
                      <Bell className="w-4 h-4 mr-2" /> Send Reminders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                      <Upload className="w-4 h-4 mr-2" /> Import from Excel
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Download className="w-4 h-4 mr-2" /> Export Report
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={generateFeeSummary}>Fee Summary</DropdownMenuItem>
                        <DropdownMenuItem onClick={generatePendingList}>Pending Fees</DropdownMenuItem>
                        <DropdownMenuItem onClick={generatePaymentHistory}>Payment History</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={generateAllInvoices}>All Invoices</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {pendingCount > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowVerifications(!showVerifications)}>
                          <ShieldCheck className="w-4 h-4 mr-2" /> Verify Payments ({pendingCount})
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search student..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection('all'); }}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {(classes || []).map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClass !== 'all' && (
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {(sections || []).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Payment Verification Panel */}
        {showVerifications && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-warning" />
                Pending Payment Verifications
                <Badge className="bg-warning text-warning-foreground">{pendingCount}</Badge>
              </h3>
              <PaymentVerificationPanel />
            </CardContent>
          </Card>
        )}

        {/* Student-Grouped List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No student fee records found</p>
                <p className="text-sm mt-1">Create invoices to get started</p>
              </div>
            ) : isMobile ? (
              /* ── Mobile: Cards ── */
              <div className="divide-y">
                {filteredGroups.map(g => (
                  <div
                    key={g.studentId}
                    className="p-4 cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors"
                    onClick={() => goToStudent(g.studentId)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{g.name}</p>
                          <p className="text-xs text-muted-foreground">{g.admissionNumber} · {g.className}-{g.section}</p>
                        </div>
                      </div>
                      {getGroupBadge(g)}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1.5 pl-6">
                      <span>Total: ₹{g.totalAmount.toLocaleString()}</span>
                      <span>Paid: ₹{g.totalPaid.toLocaleString()}</span>
                      <span className="font-medium text-foreground">Balance: ₹{g.totalBalance.toLocaleString()}</span>
                    </div>
                    {g.totalAmount > 0 && (
                      <div className="pl-6 mt-1.5">
                        <Progress value={Math.round((g.totalPaid / g.totalAmount) * 100)} className="h-1.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* ── Desktop: Table ── */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Total Due</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead className="w-24">Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.map(g => (
                    <TableRow
                      key={g.studentId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => goToStudent(g.studentId)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{g.name}</p>
                          <p className="text-xs text-muted-foreground">{g.admissionNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell>{g.className}-{g.section}</TableCell>
                      <TableCell className="font-medium">₹{g.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-success">₹{g.totalPaid.toLocaleString()}</TableCell>
                      <TableCell className="text-destructive font-medium">₹{g.totalBalance.toLocaleString()}</TableCell>
                      <TableCell>
                        {g.totalAmount > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Progress value={Math.round((g.totalPaid / g.totalAmount) * 100)} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">{Math.round((g.totalPaid / g.totalAmount) * 100)}%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getGroupBadge(g)}</TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <CreateInvoiceDialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen} />
        <SendReminderDialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen} />
        <ImportFeesDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      </div>
    </AdminLayout>
  );
}
