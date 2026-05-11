import { useQuery } from '@tanstack/react-query';
import { User, Shield, Moon, Sun, Monitor, LogOut, Key, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProfileSignatureSection } from '@/components/settings/ProfileSignatureSection';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/providers/ThemeProvider';
import { authApi } from '@/api/auth';
import { cn } from '@/utils/cn';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { theme, setTheme } = useTheme();

  const { data: rolesData } = useQuery({
    queryKey: ['user-roles', user?.user_id],
    queryFn: () => authApi.getUserRoles(user!.user_id),
    enabled: !!user?.user_id,
  });

  const handleLogout = () => {
    clearAuth();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  const copyId = () => {
    if (user?.user_id) {
      navigator.clipboard.writeText(user.user_id);
      toast.success('User ID copied');
    }
  };

  const themeOptions = [
    { value: 'light',  label: 'Light',  icon: Sun },
    { value: 'dark',   label: 'Dark',   icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;

  const roleColors: Record<string, string> = {
    admin:     'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:ring-violet-800',
    reviewer:  'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
    submitter: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold shadow-sm">
              {(user?.username ?? user?.roles[0] ?? 'U').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground text-lg">
                {user?.username ?? 'User'}
              </p>
              <p className="text-sm text-muted-foreground capitalize mt-0.5">
                {user?.roles.join(', ')}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Username</span>
              <span className="text-sm font-medium">{user?.username ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">User ID</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-muted-foreground">{user?.user_id.slice(0, 16)}…</span>
                <button onClick={copyId} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy full ID">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Roles</span>
              <div className="flex items-center gap-1.5">
                {user?.roles.map((role) => (
                  <span
                    key={role}
                    className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full ring-1 capitalize', roleColors[role] ?? 'bg-muted text-muted-foreground ring-border')}
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Permissions</span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {user?.permissions.map((p) => (
                  <Badge key={p} variant="muted" className="capitalize text-[10px]">{p}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {user?.user_id && <ProfileSignatureSection userId={user.user_id} />}

      {/* Roles & Permissions detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Roles & Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rolesData?.roles.length ? (
            <div className="space-y-4">
              {rolesData.roles.map((role) => (
                <div key={role.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold capitalize">{role.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.length > 0 ? (
                      role.permissions.map((perm) => (
                        <Badge key={perm} variant="success" className="capitalize text-xs">{perm}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No permissions assigned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
              Loading permissions…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4" /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all',
                  theme === value
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30'
                )}
              >
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  theme === value ? 'bg-primary/10' : 'bg-muted'
                )}>
                  <Icon className={cn('h-4 w-4', theme === value ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <span className={cn('text-sm font-medium', theme === value ? 'text-primary' : 'text-muted-foreground')}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground mt-0.5">End your current session. You'll need to sign in again.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
