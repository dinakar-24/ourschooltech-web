import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, MapPin, Pencil, Trash2, Eye, ExternalLink, Copy, Users, Smartphone, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

const BASE_DOMAIN = 'ourschooltech.com';

interface School {
  id: string;
  name: string;
  code: string;
  subdomain: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  logo: string | null;
  is_active?: boolean | null;
  primary_color?: string | null;
  accent_color?: string | null;
  created_at: string;
}

interface SchoolsTableProps {
  schools: School[];
  onEdit: (school: School) => void;
  onDelete: (school: School) => void;
  onImpersonate?: (school: School) => void;
  onToggleStatus?: (school: School) => void;
  onPwaSettings?: (school: School) => void;
  onOnboardingSettings?: (school: School) => void;
  isTogglingId?: string | null;
}

export const SchoolsTable = memo(function SchoolsTable({
  schools,
  onEdit,
  onDelete,
  onImpersonate,
  onToggleStatus,
  onPwaSettings,
  onOnboardingSettings,
  isTogglingId,
}: SchoolsTableProps) {
  const navigate = useNavigate();
  const handleCopyUrl = (subdomain: string) => {
    navigator.clipboard.writeText(`https://${subdomain}.${BASE_DOMAIN}`);
    toast.success('Subdomain URL copied!');
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>School</TableHead>
            <TableHead>Subdomain</TableHead>
            <TableHead>City</TableHead>
            <TableHead className="text-center w-20">Status</TableHead>
            <TableHead className="text-right w-48">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schools.map((school) => {
            const isActive = school.is_active !== false;
            return (
              <TableRow key={school.id} className={!isActive ? 'opacity-60' : ''}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {school.logo ? (
                        <img 
                          src={school.logo} 
                          alt={`${school.name} logo`}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <Building2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate max-w-[200px]">{school.name}</p>
                        {(school as any).primary_color && (
                          <div className="flex gap-0.5 shrink-0">
                            <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: (school as any).primary_color }} />
                            <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: (school as any).accent_color || '#E69500' }} />
                          </div>
                        )}
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0">{school.code}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[240px]">{school.address}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-muted-foreground">{school.subdomain}.{BASE_DOMAIN}</span>
                    <button onClick={() => handleCopyUrl(school.subdomain)} className="text-muted-foreground hover:text-foreground shrink-0" title="Copy URL">
                      <Copy className="w-3 h-3" />
                    </button>
                    <a href={`https://${school.subdomain}.${BASE_DOMAIN}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0" title="Open">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{school.city}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={isActive}
                    disabled={isTogglingId === school.id}
                    onCheckedChange={() => onToggleStatus?.(school)}
                    aria-label={isActive ? 'Disable school' : 'Enable school'}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/super-admin/schools/${school.id}`)}
                      className="h-7 px-2 text-xs"
                    >
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Users
                    </Button>
                    {onImpersonate && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => onImpersonate(school)}
                        className="h-7 px-2 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Impersonate
                      </Button>
                    )}
                    {onPwaSettings && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onPwaSettings(school)} title="PWA Settings">
                        <Smartphone className="w-3.5 h-3.5 mr-1" />
                        PWA
                      </Button>
                    )}
                    {onOnboardingSettings && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onOnboardingSettings(school)} title="Onboarding Settings">
                        <KeyRound className="w-3.5 h-3.5 mr-1" />
                        Onboarding
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(school)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDelete(school)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});
