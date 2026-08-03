import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Save, Loader2 } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { Label } from '@/components/ui/label';

const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'flash', label: 'Fast · Gemini Flash' },
  { value: 'pro', label: 'Deep · Gemini Pro' },
];

const TONE_OPTIONS = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'concise', label: 'Concise' },
  { value: 'playful', label: 'Playful' },
];

const ROLE_OPTIONS = ['parent', 'student', 'teacher', 'school_admin'];

interface AiConfig {
  enabled: boolean;
  model: string;
  tone: string;
  custom_instructions: string;
  allowed_roles: string[];
}

const DEFAULT_CONFIG: AiConfig = {
  enabled: true,
  model: 'auto',
  tone: 'friendly',
  custom_instructions: '',
  allowed_roles: [...ROLE_OPTIONS],
};

// Per-school AI settings overrides were deliberately never built (v1 scope
// decision: no school has ever configured this, easy to add later if
// actually needed) -- School has no aiSettings column. Only the global
// defaults, which do have a real backing key (system_settings['ai_defaults']),
// are editable here.
export function AiSettings() {
  const { getSetting, updateSetting } = useSystemSettings();
  const globalDefaults = getSetting<AiConfig>('ai_defaults', DEFAULT_CONFIG);
  const [defaults, setDefaults] = useState<AiConfig>(globalDefaults);
  const [savingDefaults, setSavingDefaults] = useState(false);

  useEffect(() => { setDefaults(globalDefaults); }, [globalDefaults.enabled, globalDefaults.model, globalDefaults.tone, globalDefaults.custom_instructions, globalDefaults.allowed_roles?.join(',')]);

  const saveDefaults = async () => {
    setSavingDefaults(true);
    try {
      await updateSetting.mutateAsync({ key: 'ai_defaults', value: defaults });
    } finally {
      setSavingDefaults(false);
    }
  };

  const toggleRole = (role: string) => {
    const next = defaults.allowed_roles.includes(role)
      ? defaults.allowed_roles.filter((r) => r !== role)
      : [...defaults.allowed_roles, role];
    setDefaults({ ...defaults, allowed_roles: next });
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            OurSchool AI — Global Defaults
          </CardTitle>
          <CardDescription className="text-xs">
            Applied platform-wide. Per-school overrides aren't available yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ConfigEditor value={defaults} onChange={setDefaults} onToggleRole={toggleRole} />
          <Button size="sm" onClick={saveDefaults} disabled={savingDefaults}>
            {savingDefaults ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigEditor({
  value,
  onChange,
  onToggleRole,
}: {
  value: AiConfig;
  onChange: (c: AiConfig) => void;
  onToggleRole: (role: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label className="text-sm font-medium">Enable OurSchool AI</Label>
          <p className="text-xs text-muted-foreground">Shows the floating AI button inside the app.</p>
        </div>
        <Switch checked={value.enabled} onCheckedChange={(v) => onChange({ ...value, enabled: v })} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Model</Label>
          <Select value={value.model} onValueChange={(v) => onChange({ ...value, model: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MODEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Response tone</Label>
          <Select value={value.tone} onValueChange={(v) => onChange({ ...value, tone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TONE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Custom instructions</Label>
        <Textarea
          rows={3}
          value={value.custom_instructions}
          onChange={(e) => onChange({ ...value, custom_instructions: e.target.value })}
          placeholder="e.g. Always mention our school motto. Reply in Hindi by default."
        />
        <p className="text-[11px] text-muted-foreground">Prepended to the AI's system prompt.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Available to roles</Label>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((r) => {
            const on = value.allowed_roles.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => onToggleRole(r)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
              >
                {r.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
