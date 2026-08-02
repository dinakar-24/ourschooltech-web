import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, FileText, RefreshCw, Filter, User, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

const actionColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  login: 'outline',
  logout: 'outline',
};

export default function AuditLogsPage() {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/superadmin/audit-logs', { params: { limit: 100 } });
      setLogs(data.logs ?? []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getUniqueActions = () => {
    const actions = [...new Set(logs.map(l => l.action))];
    return actions.sort();
  };

  const getUniqueEntities = () => {
    const entities = [...new Set(logs.map(l => l.entity_type))];
    return entities.sort();
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchQuery === '' ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;

    return matchesSearch && matchesAction && matchesEntity;
  });

  const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (action.includes('delete') || action.includes('remove')) return 'destructive';
    if (action.includes('create') || action.includes('add')) return 'default';
    if (action.includes('update') || action.includes('edit')) return 'secondary';
    return 'outline';
  };

  const formatDetails = (details: Record<string, any> | null) => {
    if (!details) return '-';
    const keys = Object.keys(details);
    if (keys.length === 0) return '-';
    
    return keys.slice(0, 2).map(key => `${key}: ${details[key]}`).join(', ');
  };

  return (
    <SuperAdminLayout title="Audit Logs">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {getUniqueActions().map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {getUniqueEntities().map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {entity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Activity Log ({filteredLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-start gap-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-5 w-14 bg-muted rounded-full animate-pulse shrink-0" />
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No audit logs found</p>
                <p className="text-sm mt-1">
                  {searchQuery || actionFilter !== 'all' || entityFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Activity will appear here as actions are performed'}
                </p>
              </div>
            ) : isMobile ? (
              /* Mobile Card Layout */
              <div className="divide-y">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {log.user_name ? (
                          <div className="w-8 h-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                            {log.user_name.split(' ').map(n => n[0]).join('')}
                          </div>
                        ) : (
                          <div className="w-8 h-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{log.user_name || 'System'}</p>
                          <p className="text-xs text-muted-foreground truncate">{log.user_email || ''}</p>
                        </div>
                      </div>
                      <Badge variant={getActionBadgeVariant(log.action)} className="shrink-0 text-[10px]">
                        {log.action}
                      </Badge>
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                        <span className="mx-1">·</span>
                        <span>{log.entity_type}</span>
                      </div>
                      {formatDetails(log.details) && (
                        <p className="text-muted-foreground line-clamp-2">{formatDetails(log.details)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop Table */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span className="text-sm">{format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.user_name || log.user_email ? (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                {log.user_name ? log.user_name.split(' ').map(n => n[0]).join('') : <User className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{log.user_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{log.user_email}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">System</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge></TableCell>
                        <TableCell>
                          <span className="text-sm">{log.entity_type}</span>
                          {log.entity_id && <span className="text-xs text-muted-foreground block truncate max-w-[120px]">{log.entity_id}</span>}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{formatDetails(log.details)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
