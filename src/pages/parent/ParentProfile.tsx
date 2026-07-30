import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useParentChild } from '@/hooks/useParentData';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  Mail,
  Phone,
  GraduationCap,
  Settings,
  LogOut,
  ChevronRight,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';

export default function ParentProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: child, isLoading: childLoading } = useParentChild();

  // AuthContext doesn't expose a way to refresh `user` after a profile edit
  // (its shape is deliberately frozen — see useParentData.ts / AuthContext.tsx
  // migration notes), so the avatar is tracked locally and seeded from the
  // /auth/me value already on `user`.
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { label: 'Feedback', icon: MessageSquare, href: '/parent/feedback' },
    { label: 'Help & Queries', icon: HelpCircle, href: '/parent/queries' },
    { label: 'Settings', icon: Settings, href: '/parent/settings' },
  ];

  return (
    <MobileLayout title="Profile">
      <div className="p-4 space-y-4">
        {/* Parent Profile Card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <AvatarUpload
                value={avatarUrl}
                onChange={async (url) => {
                  await api.patch('/parent/profile', { photo: url });
                  setAvatarUrl(url ?? undefined);
                }}
                fallback={user?.name}
                size="lg"
                folder="parents"
              />
              <div>
                <h2 className="text-lg font-bold">{user?.name}</h2>
                <Badge variant="secondary" className="mt-1">Parent</Badge>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{user?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{user?.phone || 'Not provided'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Child Info */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">WARD DETAILS</h3>
            {childLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div>
                  <Skeleton className="h-5 w-28 mb-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ) : child ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="font-bold">{child.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {child.class_name} - {child.section}
                    {child.roll_number ? ` | Roll No. ${child.roll_number}` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No child linked to your account.</p>
            )}
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.href)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </MobileLayout>
  );
}
