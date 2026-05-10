import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  GitBranch,
  Shield,
  Bell,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  Layers,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { canAccessTemplateManagement } from '@/utils/permissions';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/tasks', icon: CheckSquare, label: 'My Tasks' },
  { to: '/workflows', icon: GitBranch, label: 'Workflows' },
  { to: '/audit', icon: Shield, label: 'Audit Log' },
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
  { to: '/search', icon: Search, label: 'Search & OCR' },
];

const adminNavItems = [
  { to: '/admin/users', icon: Users, label: 'User Management' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isAdmin = user?.roles.includes('admin') ?? false;
  const showTemplateMgmt = user?.roles ? canAccessTemplateManagement(user.roles) : false;

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* ── Logo ── */}
      <div
        className={cn(
          'flex items-center h-20 border-b border-sidebar-border shrink-0',
          collapsed ? 'justify-center px-0' : 'px-3'
        )}
      >
        {collapsed ? (
          /* Collapsed: monogram */
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-black text-sm">N</span>
          </div>
        ) : (
          /* Expanded: actual logo on white pill */
          <div className="bg-white rounded-lg px-2 py-1">
            <img
              src="/logo.png"
              alt="NHIA Logo"
              className="h-14 w-auto object-contain"
            />
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-none">
        {navItems.map(({ to, icon: Icon, label, badge }) => {
          const path = location.pathname;
          const isActive =
            to === '/documents'
              ? path === '/documents' ||
                path.startsWith('/documents/new') ||
                /^\/documents\/[0-9a-f-]{36}/i.test(path)
              : to === '/workflows'
                ? path === '/workflows' || path.startsWith('/workflows/')
                : path.startsWith(to);
          const showBadge = badge && unreadCount > 0;

          const linkContent = (
            <NavLink
              to={to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 relative group',
                collapsed ? 'justify-center px-0 w-10 mx-auto' : '',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
              )}
            >
              <Icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
              {!collapsed && <span className="truncate">{label}</span>}
              {showBadge && (
                <span
                  className={cn(
                    'flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold leading-none',
                    collapsed
                      ? 'absolute -top-1 -right-1 h-4 w-4'
                      : 'ml-auto h-5 min-w-5 px-1'
                  )}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={to} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          }

          return <div key={to}>{linkContent}</div>;
        })}

        {/* ── Template management (admin / records roles) ── */}
        {showTemplateMgmt && (
          <>
            {!collapsed && (
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
                  Governance
                </p>
              </div>
            )}
            {collapsed && <div className="my-1 mx-2 h-px bg-sidebar-border" />}
            {(() => {
              const to = '/template-management';
              const Icon = Layers;
              const label = 'Template Builder';
              const path = location.pathname;
              const isActive = path.startsWith('/template-management');
              const linkContent = (
                <NavLink
                  to={to}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    collapsed ? 'justify-center px-0 w-10 mx-auto' : '',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              );
              if (collapsed) {
                return (
                  <Tooltip key={to} delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                );
              }
              return <div key={to}>{linkContent}</div>;
            })()}
          </>
        )}

        {/* ── Admin section ── */}
        {isAdmin && (
          <>
            {!collapsed && (
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">Admin</p>
              </div>
            )}
            {collapsed && <div className="my-1 mx-2 h-px bg-sidebar-border" />}
            {adminNavItems.map(({ to, icon: Icon, label }) => {
              const isActive = location.pathname.startsWith(to);
              const linkContent = (
                <NavLink
                  to={to}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    collapsed ? 'justify-center px-0 w-10 mx-auto' : '',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              );
              if (collapsed) {
                return (
                  <Tooltip key={to} delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                );
              }
              return <div key={to}>{linkContent}</div>;
            })}
          </>
        )}
      </nav>

      {/* ── Bottom section ── */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {/* Settings link */}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <NavLink
                to="/settings"
                className="flex items-center justify-center w-10 mx-auto rounded-lg py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-all"
              >
                <Settings className="h-5 w-5" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        ) : (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
              )
            }
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </NavLink>
        )}

        {/* User info — expanded only */}
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold uppercase">
              {(user.username ?? user.user_id).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {user.username ?? user.roles.join(', ')}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate capitalize">
                {user.roles.join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center rounded-lg py-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10 transition-all w-full',
            collapsed ? 'w-10 mx-auto' : ''
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
