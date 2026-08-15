import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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

interface SchoolCardProps {
  school: School;
  onEdit: (school: School) => void;
  onDelete: (school: School) => void;
  onImpersonate?: (school: School) => void;
  onToggleStatus?: (school: School) => void;
  onPwaSettings?: (school: School) => void;
  onOnboardingSettings?: (school: School) => void;
  isToggling?: boolean;
}

export const SchoolCard = memo(function SchoolCard({
  school,
  onEdit,
  onDelete,
  onImpersonate,
  onToggleStatus,
  onPwaSettings,
  onOnboardingSettings,
  isToggling,
}: SchoolCardProps) {
  const navigate = useNavigate();
  const subdomainUrl = `https://${school.subdomain}.${BASE_DOMAIN}`;
  const isActive = school.is_active !== false;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(subdomainUrl);
    toast.success('Subdomain URL copied!');
  };

  return (
    <div className={`rounded-xl border bg-card shadow-sm transition-opacity ${!isActive ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="w-10 h-10 flex items-center justify-center overflow-hidden flex-shrink-0">
          {school.logo ? (
            <img 
              src={school.logo} 
              alt={`${school.name} logo`}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
            />
          ) : (
            <Building2 className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-semibold text-sm truncate">{school.name}</p>
              {(school as any).primary_color && (
                <div className="flex gap-0.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: (school as any).primary_color }} />
                  <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: (school as any).accent_color || '#E69500' }} />
                </div>
              )}
            </div>
            <Switch
              checked={isActive}
              disabled={isToggling}
              onCheckedChange={() => onToggleStatus?.(school)}
              aria-label={isActive ? 'Disable school' : 'Enable school'}
              className="shrink-0"
            />
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] leading-tight">{school.code}</span>
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              {school.city}
            </span>
            {!isActive && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Disabled</span>
            )}
          </div>
        </div>
      </div>

      {/* Subdomain */}
      <div className="flex items-center gap-1.5 px-4 pb-3">
        <span className="text-[11px] text-muted-foreground font-mono truncate">{school.subdomain}.{BASE_DOMAIN}</span>
        <button onClick={handleCopyUrl} className="text-muted-foreground hover:text-foreground shrink-0" title="Copy">
          <Copy className="w-3 h-3" />
        </button>
        <a href={subdomainUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0" title="Open">
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Actions - Row 1: Main actions */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1.5 border-t bg-muted/30">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/super-admin/schools/${school.id}`)}
          className="flex-1 h-8 text-xs"
        >
          <Users className="w-3.5 h-3.5 mr-1" />
          Users
        </Button>
        {onImpersonate && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onImpersonate(school)}
            className="flex-1 h-8 text-xs"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Impersonate
          </Button>
        )}
      </div>
      {/* Actions - Row 2: Settings */}
      <div className="flex gap-1.5 px-4 pb-3 pt-0 bg-muted/30 rounded-b-xl">
        {onPwaSettings && (
          <Button variant="outline" size="sm" onClick={() => onPwaSettings(school)} className="flex-1 h-8 text-xs">
            <Smartphone className="w-3.5 h-3.5 mr-1" />
            PWA Settings
          </Button>
        )}
        {onOnboardingSettings && (
          <Button variant="outline" size="sm" onClick={() => onOnboardingSettings(school)} className="h-8 w-8 p-0 shrink-0" title="Onboarding Settings">
            <KeyRound className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onEdit(school)} className="h-8 w-8 p-0 shrink-0">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={() => onDelete(school)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
});
