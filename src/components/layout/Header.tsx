import { Bell, LogOut, Moon, Sun, Monitor, User, ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/cn';

import { resolveUsername } from '@/utils/users';
import { formatAuthRolesForDisplay, workflowAssigneeRoleLabel } from '@/utils/workflowEditor';

// Map route paths to human-readable breadcrumb labels
const ROUTE_LABELS: Record<string, string> = {
  dashboard:     'Dashboard',
  reports:       'Executive report',
  documents:     'Documents',
  tasks:         'My Tasks',
  audit:         'Audit Log',
  notifications: 'Notifications',
  search:        'Search & OCR',
  settings:      'Settings',
  new:           'New',
  edit:          'Edit',
  admin:               'Admin',
  users:               'User Management',
  'template-management': 'Template Management',
  create:              'Create Template',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Breadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const path = '/' + segments.slice(0, idx + 1).join('/');
        const label = ROUTE_LABELS[seg]
          ?? (UUID_RE.test(seg) ? resolveUsername(seg) || '#' + seg.slice(0, 6) : seg);

        return (
          <span key={path} className="flex items-center gap-1.5">
            {idx > 0 && <span className="text-muted-foreground/40 text-xs">/</span>}
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <button
                onClick={() => navigate(path)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function Header() {
  const navigate = useNavigate();
  const { clearAuth, user } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    clearAuth();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  const roleLabel = user?.roles[0] ? workflowAssigneeRoleLabel(user.roles[0]) : 'User';
  const displayName = user?.username ?? roleLabel;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-5 shrink-0 gap-4">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          onClick={() => navigate('/notifications')}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {/* Theme */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Toggle theme">
              {theme === 'light' ? <Sun className="h-4 w-4" /> : theme === 'dark' ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="h-4 w-4" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="h-4 w-4" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="h-4 w-4" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium text-foreground capitalize leading-none">{displayName}</p>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{user?.username ?? 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.roles?.length ? formatAuthRolesForDisplay(user.roles) : '—'}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <User className="h-4 w-4" /> Profile & Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
