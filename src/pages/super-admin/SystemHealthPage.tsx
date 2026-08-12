import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertTriangle, Activity, ShieldAlert, Clock, Bug, Layers, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { format, subHours, startOfHour } from 'date-fns';

// --- Types ---

type ErrorLog = {
  id: string;
  created_at: string;
  error_type: string;
  error_message: string;
  error_context: Record<string, any>;
  user_id: string | null;
  school_id: string | null;
  severity: string;
};

type JobRecord = {
  id: string;
  created_at: string;
  job_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
};

type JobStats = {
  queued: number;
  processing: number;
  completed_24h: number;
  failed_24h: number;
  retrying: number;
};

// --- Hooks ---

// Migrated to /api/superadmin/system-health/error-logs -- reads the same
// ErrorLog model both logger.ts's client-error POSTs and the backend's own
// global error handler write to. Same 24h/desc/200 shape the old direct
// Supabase query used.
function useErrorLogs() {
  return useQuery({
    queryKey: ['error-logs-health'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/system-health/error-logs');
      return (data.logs ?? []) as ErrorLog[];
    },
    staleTime: 60_000,
  });
}

// Migrated to /api/superadmin/system-health/login-attempts -- reads the
// LoginAttempt model auth.controller.js writes to alongside (not instead
// of) its in-memory lockout Map. Bare count, matching the old direct
// Supabase query's exact shape (head:true count-only, never a row list).
function useLoginAttempts() {
  return useQuery({
    queryKey: ['login-attempts-health'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/system-health/login-attempts');
      return (data.count ?? 0) as number;
    },
    staleTime: 60_000,
  });
}

// Migrated to /api/superadmin/system-health/* -- read-only against the real
// BullMQ/Redis queues (fee-reminders, razorpay-webhooks), no Postgres model
// behind this. See systemHealth.controller.js for the BullMQ-state mapping.
function useJobStats() {
  return useQuery({
    queryKey: ['job-queue-stats'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/system-health/job-stats');
      return data as JobStats;
    },
    staleTime: 30_000,
  });
}

function useRecentJobs() {
  return useQuery({
    queryKey: ['recent-jobs'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/system-health/recent-jobs');
      return (data.jobs ?? []) as JobRecord[];
    },
    staleTime: 30_000,
  });
}

// --- Constants ---

const severityColor: Record<string, string> = {
  warning: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
  critical: 'bg-red-600/10 text-red-700 border-red-500/30',
};

const jobStatusColor: Record<string, string> = {
  queued: 'bg-blue-500/10 text-blue-700 border-blue-300',
  processing: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
  completed: 'bg-green-500/10 text-green-700 border-green-300',
  failed: 'bg-destructive/10 text-destructive border-destructive/30',
  dead: 'bg-red-600/10 text-red-700 border-red-500/30',
};

const typeIcons: Record<string, typeof Bug> = {
  edge_function: Activity,
  auth: ShieldAlert,
  frontend_crash: AlertTriangle,
  mutation: Bug,
  network: Clock,
  rpc: Activity,
};

// --- Component ---

export default function SystemHealthPage() {
  const { data: logs = [], isLoading } = useErrorLogs();
  const { data: loginAttempts = 0 } = useLoginAttempts();
  const { data: jobStats } = useJobStats();
  const { data: recentJobs = [] } = useRecentJobs();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [jobStatusFilter, setJobStatusFilter] = useState<string>('all');

  // Build hourly chart data
  const chartData = useMemo(() => {
    const now = new Date();
    const hours: { hour: string; count: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const h = startOfHour(subHours(now, i));
      const label = format(h, 'HH:mm');
      const count = logs.filter(l => {
        const d = new Date(l.created_at);
        return d >= h && d < new Date(h.getTime() + 3600000);
      }).length;
      hours.push({ hour: label, count });
    }
    return hours;
  }, [logs]);

  // Stats
  const criticalCount = logs.filter(l => l.severity === 'critical').length;
  const errorCount = logs.filter(l => l.severity === 'error').length;

  const edgeFnLogs = logs.filter(l => l.error_type === 'edge_function' && l.error_context?.duration_ms);
  const avgDuration = edgeFnLogs.length > 0
    ? Math.round(edgeFnLogs.reduce((s, l) => s + (l.error_context.duration_ms || 0), 0) / edgeFnLogs.length)
    : null;

  // Filtered errors
  const filteredErrors = logs.filter(l => {
    if (typeFilter !== 'all' && l.error_type !== typeFilter) return false;
    if (severityFilter !== 'all' && l.severity !== severityFilter) return false;
    return true;
  }).slice(0, 50);

  // Filtered jobs
  const filteredJobs = recentJobs.filter(j => {
    if (jobStatusFilter !== 'all' && j.status !== jobStatusFilter) return false;
    return true;
  });

  return (
    <SuperAdminLayout title="System Health">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Critical (24h)
              </div>
              <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Bug className="w-3.5 h-3.5" /> Errors (24h)
              </div>
              <p className="text-2xl font-bold text-foreground">{errorCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Login Attempts (24h)
              </div>
              <p className="text-2xl font-bold text-foreground">{loginAttempts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Clock className="w-3.5 h-3.5" /> Avg Edge Fn (ms)
              </div>
              <p className="text-2xl font-bold text-foreground">{avgDuration ?? '—'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Job Queue Stats */}
        {jobStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Layers className="w-3.5 h-3.5" /> Queued
                </div>
                <p className="text-2xl font-bold text-foreground">{jobStats.queued}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Processing
                </div>
                <p className="text-2xl font-bold text-foreground">{jobStats.processing}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed (24h)
                </div>
                <p className="text-2xl font-bold text-foreground">{jobStats.completed_24h}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <XCircle className="w-3.5 h-3.5" /> Failed (24h)
                </div>
                <p className="text-2xl font-bold text-destructive">{jobStats.failed_24h}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Retrying
                </div>
                <p className="text-2xl font-bold text-foreground">{jobStats.retrying}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs for Errors vs Jobs */}
        <Tabs defaultValue="errors" className="space-y-4">
          <TabsList>
            <TabsTrigger value="errors">Error Logs</TabsTrigger>
            <TabsTrigger value="jobs">Job Queue</TabsTrigger>
          </TabsList>

          <TabsContent value="errors" className="space-y-4">
            {/* Error Rate Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Error Rate — Last 24 Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} className="fill-muted-foreground" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(v) => `Hour: ${v}`} />
                      <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Errors Table */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <CardTitle className="text-base">Recent Errors</CardTitle>
                  <div className="flex gap-2">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="edge_function">Edge Function</SelectItem>
                        <SelectItem value="auth">Auth</SelectItem>
                        <SelectItem value="frontend_crash">Crash</SelectItem>
                        <SelectItem value="mutation">Mutation</SelectItem>
                        <SelectItem value="network">Network</SelectItem>
                        <SelectItem value="rpc">RPC</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                      <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
                ) : filteredErrors.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No errors in the last 24 hours 🎉</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 pr-3 font-medium">Time</th>
                          <th className="text-left py-2 pr-3 font-medium">Type</th>
                          <th className="text-left py-2 pr-3 font-medium">Severity</th>
                          <th className="text-left py-2 font-medium">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredErrors.map((log) => {
                          const Icon = typeIcons[log.error_type] || Bug;
                          return (
                            <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                                {format(new Date(log.created_at), 'HH:mm:ss')}
                              </td>
                              <td className="py-2 pr-3">
                                <span className="flex items-center gap-1"><Icon className="w-3 h-3" />{log.error_type}</span>
                              </td>
                              <td className="py-2 pr-3">
                                <Badge variant="outline" className={severityColor[log.severity] || ''}>{log.severity}</Badge>
                              </td>
                              <td className="py-2 max-w-xs truncate" title={log.error_message}>{log.error_message}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <CardTitle className="text-base">Recent Jobs</CardTitle>
                  <Select value={jobStatusFilter} onValueChange={setJobStatusFilter}>
                    <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="queued">Queued</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="dead">Dead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No jobs found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 pr-3 font-medium">Created</th>
                          <th className="text-left py-2 pr-3 font-medium">Type</th>
                          <th className="text-left py-2 pr-3 font-medium">Status</th>
                          <th className="text-left py-2 pr-3 font-medium">Attempts</th>
                          <th className="text-left py-2 font-medium">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredJobs.map((job) => (
                          <tr key={job.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                              {format(new Date(job.created_at), 'MMM dd HH:mm')}
                            </td>
                            <td className="py-2 pr-3 font-mono">{job.job_type}</td>
                            <td className="py-2 pr-3">
                              <Badge variant="outline" className={jobStatusColor[job.status] || ''}>{job.status}</Badge>
                            </td>
                            <td className="py-2 pr-3">{job.attempts}/{job.max_attempts}</td>
                            <td className="py-2 max-w-xs truncate text-muted-foreground" title={job.error_message || ''}>
                              {job.error_message || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
}
