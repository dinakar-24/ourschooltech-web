import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Mail, MailWarning, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export interface CreatedAccount {
  role: string;
  email: string;
  name: string;
  // Set under SET_PASSWORD onboarding mode (the default) -- undefined
  // while the request is in flight, then true/false once the backend
  // responds.
  welcomeEmailSent?: boolean;
  // Set under TEMP_PASSWORD onboarding mode instead -- a real password,
  // shown here exactly once, to hand over directly. Mutually exclusive
  // with welcomeEmailSent in practice (a school is in one mode or the
  // other), but both are optional on the type since the two modes share
  // this one dialog.
  temporaryPassword?: string;
}

interface CredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: CreatedAccount[];
  studentName: string;
}

export function CredentialsDialog({ open, onOpenChange, accounts, studentName }: CredentialsDialogProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const hasTempPasswords = accounts.some((a) => a.temporaryPassword);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-success" />
            Accounts Created
          </DialogTitle>
          <DialogDescription>
            {hasTempPasswords ? (
              <>Login accounts for <strong>{studentName}</strong>. Share these passwords with the respective users — they won't be shown again.</>
            ) : (
              <>Login accounts for <strong>{studentName}</strong>. Each person gets a welcome email with a link to set their own password.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {accounts.map((account, index) => (
            <div key={index} className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant={account.role === 'Student' ? 'default' : 'secondary'}>
                  {account.role}
                </Badge>
                {account.temporaryPassword ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(`Email: ${account.email}\nPassword: ${account.temporaryPassword}`, index)}
                  >
                    {copiedIndex === index ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </Button>
                ) : account.welcomeEmailSent === false ? (
                  <span className="flex items-center gap-1.5 text-xs text-destructive">
                    <MailWarning className="w-3.5 h-3.5" /> Email failed
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" /> Welcome email sent
                  </span>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {account.name}</p>
                <p><span className="text-muted-foreground">Email:</span> <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{account.email}</code></p>
                {account.temporaryPassword && (
                  <p><span className="text-muted-foreground">Password:</span> <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{account.temporaryPassword}</code></p>
                )}
              </div>
              {account.welcomeEmailSent === false && (
                <p className="text-xs text-destructive">Ask them to use "Forgot Password" on the login page instead.</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
