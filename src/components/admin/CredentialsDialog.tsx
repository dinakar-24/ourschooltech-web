import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, MailWarning, ShieldCheck } from 'lucide-react';

export interface CreatedAccount {
  role: string;
  email: string;
  name: string;
  // Undefined while the request is in flight in older callers; always set
  // once the backend responds under the Set-Password flow.
  welcomeEmailSent?: boolean;
}

interface CredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: CreatedAccount[];
  studentName: string;
}

// No password is ever shown here -- every admin-created account goes
// through the Set-Password welcome-email flow now (see
// onboarding.controller.js), so this just confirms who got emailed rather
// than revealing a credential to copy/relay.
export function CredentialsDialog({ open, onOpenChange, accounts, studentName }: CredentialsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-success" />
            Accounts Created
          </DialogTitle>
          <DialogDescription>
            Login accounts for <strong>{studentName}</strong>. Each person gets a welcome email with a link to set their own password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {accounts.map((account, index) => (
            <div key={index} className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant={account.role === 'Student' ? 'default' : 'secondary'}>
                  {account.role}
                </Badge>
                {account.welcomeEmailSent === false ? (
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
