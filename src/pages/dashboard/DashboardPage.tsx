import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Layers, CheckSquare, Shield, Plus, Search,
  ArrowRight, Bell,   TrendingUp, Clock, AlertTriangle, Activity, Users,
  CheckCircle, XCircle, LayoutDashboard, User, Radar,
  BarChart3,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { auditApi } from '@/api/audit';
import { executiveApi } from '@/api/executive';
import { tasksApi } from '@/api/tasks';
import { documentsApi } from '@/api/documents';
import { authApi } from '@/api/auth';
import { QUERY_KEYS } from '@/utils/constants';
import { formatRelative, isTaskOverdue } from '@/utils/formatters';
import {
  canCreateDocument,
  canViewOperationalOverview,
  canAccessTemplateManagement,
  showOfficerHomeDashboard,
  canDirectorToggleOperationalDashboard,
  canAccessAuditLogModule,
  isDirectorGeneralRole,
} from '@/utils/permissions';
import { resolveUsername, registerUsers } from '@/utils/users';
import { buildUserDashboardActivityFeed } from '@/utils/userActivityFeed';
import { cn } from '@/utils/cn';
import { executiveDrill } from '@/utils/executiveDrillDown';
import type { Task } from '@/types/task';

const DIRECTOR_DASHBOARD_VIEW_KEY = 'nhia-edms-director-dashboard-view';

type DirectorDashboardView = '360' | 'personal';

function readStoredDirectorView(): DirectorDashboardView {
  try {
    const v = localStorage.getItem(DIRECTOR_DASHBOARD_VIEW_KEY);
    return v === 'personal' ? 'personal' : '360';
  } catch {
    return '360';
  }
}

/** Directors: switch between org 360 operations and personal workspace (persisted). */
function DirectorDashboardShell() {
  const user = useAuthStore((s) => s.user);
  const isDgo = isDirectorGeneralRole(user?.roles ?? []);
  const [view, setView] = useState<DirectorDashboardView>(readStoredDirectorView);

  useEffect(() => {
    try {
      localStorage.setItem(DIRECTOR_DASHBOARD_VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-2xl border px-4 py-3 sm:py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4',
          'border-emerald-200/50 dark:border-emerald-900/40',
          'bg-gradient-to-br from-emerald-50/80 via-background to-emerald-50/50',
          'dark:from-emerald-950/35 dark:via-background dark:to-emerald-950/25',
          'shadow-sm shadow-emerald-500/5 dark:shadow-emerald-500/10'
        )}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md transition-all duration-300',
              view === 'personal'
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Leadership workspace</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">My dashboard</span>
              {' — '}your tasks and documents you own.
              {' '}
              <span className="font-medium text-emerald-700 dark:text-emerald-400">360 · Operations</span>
              {' — '}organisation-wide oversight (Director / GM grades and legacy director role).
            </p>
          </div>
        </div>
        <div className="flex w-full sm:w-auto items-stretch sm:items-center gap-2 sm:gap-2.5 shrink-0 p-1 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/60">
          <button
            type="button"
            onClick={() => setView('personal')}
            className={cn(
              'flex flex-1 sm:flex-none min-h-[2.75rem] sm:min-h-0 items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              view === 'personal'
                ? cn(
                    'text-white shadow-lg shadow-emerald-500/30',
                    'bg-gradient-to-br from-emerald-500 to-teal-600',
                    'ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-background scale-[1.02]'
                  )
                : cn(
                    'text-emerald-800 dark:text-emerald-300',
                    'bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60',
                    'hover:bg-emerald-200/80 dark:hover:bg-emerald-900/45 hover:border-emerald-300 dark:hover:border-emerald-700'
                  )
            )}
          >
            <User
              className={cn(
                'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0',
                view === 'personal' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
              )}
            />
            My dashboard
          </button>
          <button
            type="button"
            onClick={() => setView('360')}
            className={cn(
              'flex flex-1 sm:flex-none min-h-[2.75rem] sm:min-h-0 items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              view === '360'
                ? cn(
                    'text-white shadow-lg shadow-emerald-500/30',
                    'bg-gradient-to-br from-emerald-500 to-teal-600',
                    'ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-background scale-[1.02]'
                  )
                : cn(
                    'text-emerald-800 dark:text-emerald-300',
                    'bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60',
                    'hover:bg-emerald-200/80 dark:hover:bg-emerald-900/45 hover:border-emerald-300 dark:hover:border-emerald-700'
                  )
            )}
          >
            <Radar
              className={cn(
                'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0',
                view === '360' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
              )}
            />
            360 · Operations
          </button>
        </div>
      </div>

      {view === '360' ? (
        <ExecutiveIntelligenceDashboard variant={isDgo ? 'dgo' : 'director'} />
      ) : (
        <UserDashboard documentScope="mine" />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const operational = canViewOperationalOverview(roles, user?.permissions ?? []);
  const directorToggle = canDirectorToggleOperationalDashboard(roles);

  if (operational && directorToggle) {
    return <DirectorDashboardShell />;
  }
  if (operational) return <Operational360Dashboard />;
  if (showOfficerHomeDashboard(roles)) return <OfficerDashboard />;
  return <UserDashboard />;
}

// ─── Shared components ────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, bg, ring, onClick }: {
  icon: React.ElementType; label: string; value: number | string;
  sub: string; color: string; bg: string; ring: string; onClick?: () => void;
}) {
  const body = (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-200 w-full">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl mb-4 ring-4', bg, ring)}>
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
  return onClick
    ? <button onClick={onClick} className="w-full text-left">{body}</button>
    : body;
}

function QuickAction({ icon: Icon, label, path, navigate }: {
  icon: React.ElementType; label: string; path: string; navigate: (p: string) => void;
}) {
  return (
    <button
      onClick={() => navigate(path)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted/60 transition-colors text-left group"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
        <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      {label}
      <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
    </button>
  );
}

// ─── 360 Operations (admin / director / reviewer / manage_* — matches document & task agent visibility) ──
function Operational360Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const isAdmin = user?.roles.includes('admin') ?? false;
  const canRecentAudit = isAdmin || hasPermission('view_audit_logs');
  const showAuditLogPage = canAccessAuditLogModule(user?.roles);

  useQuery({
    queryKey: ['dashboard-register-users'],
    queryFn: async () => {
      const rows = await authApi.listUsers();
      registerUsers(rows.map((r) => ({ id: r.id, username: r.username })));
      return rows;
    },
    enabled: isAdmin,
    staleTime: 120_000,
  });

  const { data: profile } = useQuery({
    queryKey: QUERY_KEYS.userProfile(user?.user_id ?? ''),
    queryFn: () => authApi.getProfile(user!.user_id),
    enabled: !!user?.user_id,
    staleTime: 120_000,
  });

  const { data: allDocuments, isLoading: docsLoading } = useQuery({
    queryKey: [QUERY_KEYS.allDocuments, 'operational-360', user?.user_id ?? ''],
    queryFn: () => documentsApi.listAll(),
    staleTime: 30_000,
    enabled: !!user?.user_id,
  });

  const { data: allTasksRaw, isLoading: tasksLoading } = useQuery({
    queryKey: QUERY_KEYS.tasksOperationalAll(),
    queryFn: () => tasksApi.listOperationalAll(),
    staleTime: 30_000,
    enabled: !!user?.user_id,
  });

  const { data: recentAuditFeed, isLoading: auditLoadingRecent } = useQuery({
    queryKey: QUERY_KEYS.auditLogsRecent(60),
    queryFn: () => auditApi.getRecentLogs(60),
    staleTime: 15_000,
    enabled: !!user?.user_id && canRecentAudit,
  });

  const { data: fallbackAudit, isLoading: auditLoadingFallback } = useQuery({
    queryKey: ['audit-operational-fallback', user?.user_id ?? ''],
    queryFn: () => auditApi.getLogs({ actor_id: user!.user_id }),
    staleTime: 30_000,
    enabled: !!user?.user_id && !canRecentAudit,
  });

  const auditLoading = canRecentAudit ? auditLoadingRecent : auditLoadingFallback;
  const allAudit = canRecentAudit ? (recentAuditFeed ?? []) : (fallbackAudit ?? []);

  const docs = allDocuments ?? [];
  const tasks = allTasksRaw ?? [];

  const assigneeWorkload = useMemo(() => {
    const m = new Map<string, { total: number; active: number }>();
    for (const t of tasks) {
      const aid = t.assignee_id;
      if (!aid) continue;
      const cur = m.get(aid) ?? { total: 0, active: 0 };
      cur.total += 1;
      if (t.status === 'pending' || t.status === 'in_progress') cur.active += 1;
      m.set(aid, cur);
    }
    return [...m.entries()].sort(
      (a, b) => b[1].active - a[1].active || b[1].total - a[1].total
    ).slice(0, 8);
  }, [tasks]);

  const orgHint = [profile?.zone, profile?.state, profile?.department].filter(Boolean).join(' · ');

  // Document stats
  const docsByStatus = {
    draft:    docs.filter((d) => d.status === 'draft').length,
    pending:  docs.filter((d) => d.status === 'pending').length,
    approved: docs.filter((d) => d.status === 'approved').length,
    rejected: docs.filter((d) => d.status === 'rejected').length,
    archived: docs.filter((d) => d.status === 'archived').length,
  };

  // Task stats
  const activeTasks    = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const overdueTasks   = tasks.filter((t) => isTaskOverdue(t));
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Pending docs needing admin action
  const pendingDocs = docs.filter((d) => d.status === 'pending');

  const isLoading = docsLoading || tasksLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="360 · Operations"
        description={`Unified view of the document lifecycle, workflow tasks, and signals you are allowed to see — aligned with NHIA EDMS visibility rules.${orgHint ? ` Your profile context: ${orgHint}.` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
              <Search className="h-4 w-4" /> Search
            </Button>
            <Button size="sm" onClick={() => navigate('/documents/new')}>
              <Plus className="h-4 w-4" /> Start process
            </Button>
          </div>
        }
      />

      {/* ── System health banner ── */}
      {!isLoading && (docsByStatus.pending > 0 || overdueTasks.length > 0) && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-900/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 mt-0.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Action required</p>
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                {docsByStatus.pending > 0 && (
                  <button
                    onClick={() => navigate('/documents')}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    {docsByStatus.pending} document{docsByStatus.pending !== 1 ? 's' : ''} pending review
                  </button>
                )}
                {overdueTasks.length > 0 && (
                  <button
                    onClick={() => navigate('/tasks')}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Top stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))
        ) : (
          <>
            <StatCard icon={FileText} label="Total Documents" value={docs.length} sub="within your visibility"
              color="text-primary" bg="bg-primary/10" ring="ring-primary/10" onClick={() => navigate(executiveDrill.allDocuments())} />
            <StatCard icon={Clock} label="Pending Review" value={docsByStatus.pending} sub="awaiting approval"
              color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-900/20" ring="ring-amber-100 dark:ring-amber-900/30"
              onClick={() => navigate(executiveDrill.documentsByStatus('pending'))} />
            <StatCard icon={CheckSquare} label="Active Tasks" value={activeTasks.length} sub="org-wide queue"
              color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-900/20" ring="ring-blue-100 dark:ring-blue-900/30"
              onClick={() => navigate(executiveDrill.activeTasks())} />
            <StatCard icon={AlertTriangle} label="Overdue Tasks" value={overdueTasks.length} sub="need attention"
              color={overdueTasks.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
              bg={overdueTasks.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}
              ring={overdueTasks.length > 0 ? 'ring-red-100 dark:ring-red-900/30' : 'ring-emerald-100 dark:ring-emerald-900/30'}
              onClick={() => navigate(executiveDrill.overdueTasks())} />
          </>
        )}
      </div>

      {/* ── Document status breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Document Pipeline
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="text-xs">
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                {/* Status bars */}
                {([
                  { status: 'pending',  label: 'Pending Review', count: docsByStatus.pending,  color: 'bg-amber-500' },
                  { status: 'draft',    label: 'Draft',          count: docsByStatus.draft,    color: 'bg-slate-400' },
                  { status: 'approved', label: 'Approved',       count: docsByStatus.approved, color: 'bg-emerald-500' },
                  { status: 'rejected', label: 'Rejected',       count: docsByStatus.rejected, color: 'bg-red-500' },
                  { status: 'archived', label: 'Archived',       count: docsByStatus.archived, color: 'bg-slate-300' },
                ] as const).map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: docs.length > 0 ? `${(count / docs.length) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-6 text-right tabular-nums">{count}</span>
                  </div>
                ))}

                <Separator className="my-2" />

                {/* Pending documents list */}
                {pendingDocs.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending approval</p>
                    {pendingDocs.slice(0, 4).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer transition-colors group"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{doc.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">by {resolveUsername(doc.owner_id)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <DocumentStatusBadge status={doc.status} statusLabel={doc.status_label} size="sm" />
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                        </div>
                      </div>
                    ))}
                    {pendingDocs.length > 4 && (
                      <button onClick={() => navigate(executiveDrill.documentsByStatus('pending'))} className="text-xs text-primary hover:underline w-full text-center pt-1">
                        +{pendingDocs.length - 4} more pending documents
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckSquare className="h-4 w-4" />
                    All documents are up to date — no pending reviews
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-5">
          {/* Assignee workload (derived from live task queue) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Assignee workload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {assigneeWorkload.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No assignee data yet — tasks will appear as workflows run.</p>
              ) : (
                assigneeWorkload.map(([uid, { active: activeCnt, total }]) => {
                  const name = resolveUsername(uid);
                  return (
                    <div key={uid} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold uppercase">
                          {name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize truncate">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {activeCnt} active · {total} total
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/tasks')}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Tasks
                      </button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <QuickAction icon={Plus}      label="Create Document"  path="/documents/new" navigate={navigate} />
              <QuickAction icon={FileText}  label="All Documents"    path="/documents"     navigate={navigate} />
              {canAccessTemplateManagement(user?.roles ?? []) && (
                <QuickAction icon={Layers} label="Template catalogue" path="/template-management" navigate={navigate} />
              )}
              {showAuditLogPage && (
                <QuickAction icon={Shield}    label="Audit Log"        path="/audit"         navigate={navigate} />
              )}
              <QuickAction icon={Search}    label="Search & OCR"     path="/search"        navigate={navigate} />
              {isAdmin && (
                <QuickAction icon={Users} label="User management" path="/admin/users" navigate={navigate} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Tasks overview ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" /> Active tasks (org-wide)
            {activeTasks.length > 0 && (
              <Badge variant="info" className="ml-1">{activeTasks.length}</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="text-xs">
            View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : activeTasks.length === 0 ? (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-emerald-600 dark:text-emerald-400">
              <CheckSquare className="h-4 w-4" /> No active tasks — all clear
            </div>
          ) : (
            <div className="space-y-2">
              {activeTasks.slice(0, 6).map((task) => {
                const overdue = isTaskOverdue(task);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all group hover:shadow-sm',
                      overdue ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/5' : 'border-border hover:border-primary/25'
                    )}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', overdue ? 'bg-red-100 dark:bg-red-900/20' : 'bg-primary/8')}>
                        {overdue
                          ? <AlertTriangle className="h-4 w-4 text-red-500" />
                          : <CheckSquare className="h-4 w-4 text-primary" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          Step {task.step_number} — Review Task
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Assigned to {resolveUsername(task.assignee_id)}
                          {task.due_date && <span className={cn('ml-2', overdue && 'text-red-500 font-medium')}>· {formatRelative(task.due_date)}</span>}
                        </p>
                      </div>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── System-wide audit feed ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {canRecentAudit ? 'System activity' : 'Your recent audit'}
          </CardTitle>
          {showAuditLogPage && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/audit')} className="text-xs">
              Full audit log <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <AuditTimeline logs={(allAudit ?? []).slice(0, 8)} loading={auditLoading} compact />
        </CardContent>
      </Card>

      {/* ── Notifications ── */}
      {unreadCount > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Unread Notifications
              <Badge variant="default">{unreadCount}</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')} className="text-xs">
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notifications.filter((n) => !n.read).slice(0, 3).map((n) => (
                <div key={n.id} className="p-3 rounded-lg bg-background border border-primary/15 text-xs">
                  <p className="font-medium text-foreground line-clamp-2">{n.message}</p>
                  <p className="text-muted-foreground mt-1">{formatRelative(n.created_at)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Executive 360 (Director / Director General) ─────────────────────────────
type ExecutiveVariant = 'director' | 'dgo';

function HealthMetricRow({
  label,
  value,
  onClick,
  valueClassName,
  suffix,
}: {
  label: string;
  value: number;
  onClick: () => void;
  valueClassName?: string;
  suffix?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={value === 0 && !suffix}
      className={cn(
        'w-full text-left text-sm py-0.5 rounded hover:text-primary transition-colors',
        value > 0 && 'cursor-pointer'
      )}
    >
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className={cn('font-semibold', valueClassName)}>{value}</span>
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
    </button>
  );
}

function OrgMetricBars({
  rows,
  empty,
  onRowClick,
}: {
  rows: Array<{ id?: number | null; name: string; documents: number; pending: number }>;
  empty: string;
  onRowClick?: (row: { id?: number | null; name: string; documents: number; pending: number }) => void;
}) {
  if (!rows.length) return <p className="text-xs text-muted-foreground py-2">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.documents), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const interactive = Boolean(onRowClick && row.documents > 0);
        return (
          <div
            key={row.name}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? () => onRowClick!(row) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick!(row);
                    }
                  }
                : undefined
            }
            className={cn(
              'space-y-1 rounded-lg',
              interactive && 'cursor-pointer hover:bg-muted/50 px-2 py-1.5 -mx-2 transition-colors'
            )}
          >
            <div className="flex justify-between gap-2 text-xs">
              <span className="font-medium truncate">{row.name}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {row.documents}
                {row.pending > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 ml-1">· {row.pending} pending</span>
                ) : null}
                {interactive && <ArrowRight className="inline h-3 w-3 ml-1 opacity-50" />}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${(row.documents / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExecutiveIntelligenceDashboard({ variant }: { variant: ExecutiveVariant }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isAdmin = user?.roles.includes('admin') ?? false;
  const canRecentAudit = isAdmin || hasPermission('view_audit_logs');
  const showAuditLogPage = canAccessAuditLogModule(user?.roles);

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.executive360(variant),
    queryFn: () => executiveApi.get360(),
    staleTime: 30_000,
    enabled: !!user?.user_id,
  });

  const { data: recentAudit, isLoading: auditLoading } = useQuery({
    queryKey: QUERY_KEYS.auditLogsRecent(40),
    queryFn: () => auditApi.getRecentLogs(40),
    staleTime: 15_000,
    enabled: !!user?.user_id && canRecentAudit,
  });

  const trendChart = useMemo(
    () =>
      (data?.activityTrend ?? []).map((p) => ({
        label: String(p.date).slice(5),
        events: p.count,
      })),
    [data?.activityTrend]
  );

  const orgPrimary =
    variant === 'dgo'
      ? (data?.orgBreakdown.zones ?? []).map((z) => ({
          id: z.id,
          name: z.name,
          documents: z.documents,
          pending: z.pending,
        }))
      : (data?.orgBreakdown.departments ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          documents: d.documents,
          pending: d.pending,
        }));

  const orgSecondary =
    variant === 'dgo'
      ? (data?.orgBreakdown.stateOffices ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          documents: s.documents,
          pending: s.pending,
        }))
      : [];

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title="360 · Executive intelligence"
        description="Live metrics from documents, workflows, tasks, and audit activity — scoped to your authority."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
              <CheckSquare className="h-4 w-4" /> Tasks
            </Button>
            <Button size="sm" onClick={() => navigate('/documents')}>
              <FileText className="h-4 w-4" /> Documents
            </Button>
          </div>
        }
      />

      {isError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          Unable to load executive analytics. Showing standard operational view below.
        </div>
      )}

      {!isLoading && data?.alerts && data.alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Executive monitoring — action required
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            {data.alerts.map((a) => {
              const drill =
                a.type === 'pending_approvals'
                  ? executiveDrill.documentsByStatus('pending')
                  : a.type === 'overdue_tasks'
                    ? executiveDrill.overdueTasks()
                    : a.type === 'stalled_workflows'
                      ? executiveDrill.stalledWorkflows()
                      : a.type === 'reporting_pending'
                        ? executiveDrill.reportingPending()
                        : a.link;
              return (
                <button
                  key={a.type}
                  type="button"
                  onClick={() => navigate(drill)}
                  className="text-xs text-amber-800 dark:text-amber-300 hover:underline"
                >
                  {a.message}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              icon={FileText}
              label="Documents"
              value={kpis?.documents.total ?? 0}
              sub={`${kpis?.documents.pending ?? 0} pending review`}
              color="text-primary"
              bg="bg-primary/10"
              ring="ring-primary/10"
              onClick={() => navigate(executiveDrill.allDocuments())}
            />
            <StatCard
              icon={CheckSquare}
              label="Active tasks"
              value={kpis?.tasks.active ?? 0}
              sub="workflow queue"
              color="text-blue-600 dark:text-blue-400"
              bg="bg-blue-50 dark:bg-blue-900/20"
              ring="ring-blue-100 dark:ring-blue-900/30"
              onClick={() => navigate(executiveDrill.activeTasks())}
            />
            <StatCard
              icon={AlertTriangle}
              label="Overdue"
              value={kpis?.tasks.overdue ?? 0}
              sub="tasks past due"
              color={
                (kpis?.tasks.overdue ?? 0) > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }
              bg={
                (kpis?.tasks.overdue ?? 0) > 0
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : 'bg-emerald-50 dark:bg-emerald-900/20'
              }
              ring={
                (kpis?.tasks.overdue ?? 0) > 0
                  ? 'ring-red-100 dark:ring-red-900/30'
                  : 'ring-emerald-100 dark:ring-emerald-900/30'
              }
              onClick={() => navigate(executiveDrill.overdueTasks())}
            />
            <StatCard
              icon={Radar}
              label="Escalation signals"
              value={data?.workflowHealth.escalationSignals ?? 0}
              sub={`${kpis?.workflows.stalled ?? 0} stalled workflows`}
              color="text-primary"
              bg="bg-primary/10"
              ring="ring-primary/20"
              onClick={() => navigate(executiveDrill.escalation())}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Document pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.pipeline ?? []).map((row) => (
              <button
                key={row.status}
                type="button"
                disabled={row.count === 0}
                onClick={() => navigate(executiveDrill.documentsByStatus(row.status))}
                className={cn(
                  'flex items-center gap-3 w-full text-left rounded-lg px-1 py-1 -mx-1 transition-colors',
                  row.count > 0 && 'hover:bg-muted/50 cursor-pointer'
                )}
              >
                <span className="text-xs text-muted-foreground w-28 shrink-0">{row.label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{
                      width: `${
                        (kpis?.documents.total ?? 0) > 0
                          ? (row.count / (kpis?.documents.total ?? 1)) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold w-8 text-right tabular-nums flex items-center justify-end gap-0.5">
                  {row.count}
                  {row.count > 0 && <ArrowRight className="h-3 w-3 opacity-40" />}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Workflow health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <HealthMetricRow
              label="Active workflows"
              value={kpis?.workflows.active ?? 0}
              onClick={() => navigate(executiveDrill.activeWorkflows())}
            />
            <HealthMetricRow
              label="Stalled (7+ days)"
              value={kpis?.workflows.stalled ?? 0}
              valueClassName="text-amber-600"
              onClick={() => navigate(executiveDrill.stalledWorkflows())}
            />
            <HealthMetricRow
              label="Reports pending"
              value={kpis?.reporting.pending ?? 0}
              suffix={` / ${kpis?.reporting.total ?? 0}`}
              onClick={() => navigate(executiveDrill.reportingPending())}
            />
            <button
              type="button"
              onClick={() => navigate(executiveDrill.reporting())}
              className="text-left w-full text-sm hover:text-primary transition-colors"
            >
              <span className="text-muted-foreground">All operational reports:</span>{' '}
              <span className="font-semibold">{kpis?.reporting.total ?? 0}</span>
            </button>
            <Separator className="my-2" />
            <p className="text-xs font-semibold text-muted-foreground uppercase">Step bottlenecks</p>
            {(data?.workflowHealth.bottleneckSteps ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No congestion detected</p>
            ) : (
              (data?.workflowHealth.bottleneckSteps ?? []).map((s) => (
                <button
                  key={s.step_number}
                  type="button"
                  onClick={() => navigate(executiveDrill.bottleneckStep(s.step_number))}
                  className="text-xs w-full text-left hover:text-primary py-0.5"
                >
                  Step {s.step_number}: <span className="font-medium">{s.active_count} active</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {variant === 'dgo' ? 'Zonal activity' : 'Departmental activity'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrgMetricBars
              rows={orgPrimary}
              empty={variant === 'dgo' ? 'No zonal document data yet.' : 'No departmental data in scope.'}
              onRowClick={(row) =>
                navigate(
                  variant === 'dgo'
                    ? executiveDrill.orgZone(row.id ?? null, row.name)
                    : executiveDrill.orgDepartment(row.id ?? null, row.name)
                )
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {variant === 'dgo' ? 'State office activity' : 'Audit activity (7 days)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {variant === 'dgo' ? (
              <OrgMetricBars
                rows={orgSecondary}
                empty="No state office data yet."
                onRowClick={(row) => navigate(executiveDrill.orgStateOffice(row.id ?? null, row.name))}
              />
            ) : trendChart.length > 0 ? (
              <button
                type="button"
                className="w-full text-left"
                onClick={() => showAuditLogPage && navigate('/audit')}
              >
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={trendChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="events" fill="hsl(127 100% 27%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">No audit events in the last 7 days.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {variant === 'dgo' && trendChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">National activity trend (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="events" fill="hsl(262 83% 58%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pending approvals</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => navigate(executiveDrill.documentsByStatus('pending'))}
            >
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.topPending ?? []).length === 0 ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 py-4 text-center">
                No pending documents in scope
              </p>
            ) : (
              data!.topPending.map((doc) => (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/documents/${doc.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-900/10 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {resolveUsername(doc.owner_id)} · {formatRelative(doc.updated_at)}
                    </p>
                  </div>
                  <DocumentStatusBadge status="pending" statusLabel={doc.status_label} size="sm" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Staff workload
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 shrink-0"
              onClick={() => navigate('/performance')}
            >
              Performance leaderboard
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.assigneeWorkload ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No assignee workload data.</p>
            ) : (
              data!.assigneeWorkload.map((row) => {
                const name = resolveUsername(row.user_id);
                return (
                  <button
                    key={row.user_id}
                    type="button"
                    onClick={() => navigate(executiveDrill.assigneeTasks(row.user_id, name))}
                    className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 w-full text-left hover:bg-muted/40 rounded px-1 -mx-1 transition-colors"
                  >
                    <span className="text-sm capitalize truncate">{name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {row.active} active / {row.total}
                      <ArrowRight className="inline h-3 w-3 ml-1 opacity-40" />
                    </span>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {canRecentAudit ? 'System activity' : 'Your audit trail'}
          </CardTitle>
          {showAuditLogPage && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/audit')}>
              Full audit <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <AuditTimeline logs={(recentAudit ?? []).slice(0, 8)} loading={auditLoading} compact />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Officer dashboard (officer / senior_officer — documents, no task queue) ─
function OfficerDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const showAuditLogPage = canAccessAuditLogModule(user?.roles);

  const { data: recentAudit, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-recent', user?.user_id],
    queryFn: () => auditApi.getLogs({ actor_id: user!.user_id }),
    enabled: !!user?.user_id,
  });

  const { data: myDocuments, isLoading: myDocsLoading } = useQuery({
    queryKey: [QUERY_KEYS.allDocuments, user?.user_id ?? 'anon'],
    queryFn: () => documentsApi.listAll(),
    enabled: !!user?.user_id,
    staleTime: 30_000,
  });

  const docs = myDocuments ?? [];

  const activityFeed = useMemo(
    () =>
      user?.user_id
        ? buildUserDashboardActivityFeed({
            userId: user.user_id,
            auditLogs: recentAudit ?? [],
            myDocuments: docs,
            myTasks: [],
            limit: 48,
            viewerDisplay: { username: user.username, full_name: null },
          })
        : [],
    [user?.user_id, user?.username, recentAudit, docs]
  );

  const totalCreated = docs.length;
  const approvedCount = docs.filter((d) => d.status === 'approved' || d.status === 'archived').length;
  const rejectedCount = docs.filter((d) => d.status === 'rejected').length;
  const pendingCount = docs.filter((d) => d.status === 'pending').length;

  const stats = [
    {
      label: 'Documents created',
      value: totalCreated,
      sub: 'you own',
      icon: FileText,
      color: 'text-primary',
      bg: 'bg-primary/10',
      ring: 'ring-primary/10',
      onClick: () => navigate('/documents'),
    },
    {
      label: 'Approved / filed',
      value: approvedCount,
      sub: 'approved or archived',
      icon: CheckCircle,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      ring: 'ring-emerald-100 dark:ring-emerald-900/30',
      onClick: () => navigate('/documents'),
    },
    {
      label: 'Rejected',
      value: rejectedCount,
      sub: 'returned to rejected',
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      ring: 'ring-red-100 dark:ring-red-900/30',
      onClick: () => navigate('/documents'),
    },
    {
      label: 'Unread notifications',
      value: unreadCount,
      sub: pendingCount > 0 ? `${pendingCount} memo(s) in workflow` : 'none waiting',
      icon: Bell,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      ring: 'ring-amber-100 dark:ring-amber-900/30',
      onClick: () => navigate('/notifications'),
    },
  ];

  const loading = auditLoading || myDocsLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Officer dashboard"
        description={`Welcome back, ${user?.username ?? 'there'}. Your memos and system activity — submissions and workflow steps are tracked on each document.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
              <Search className="h-4 w-4" /> Search
            </Button>
            {canCreateDocument(user?.roles ?? [], user?.permissions ?? []) && (
              <Button size="sm" onClick={() => navigate('/documents/new')}>
                <Plus className="h-4 w-4" /> Start process
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          : stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Activity
              </CardTitle>
              {showAuditLogPage && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/audit')} className="text-xs">
                  Full audit log <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <AuditTimeline logs={activityFeed.slice(0, 16)} loading={loading} compact />
            </CardContent>
          </Card>

          {docs.filter((d) => d.status === 'draft' || d.status === 'pending').length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">In progress</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="text-xs">
                  Open list <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {docs
                  .filter((d) => d.status === 'draft' || d.status === 'pending')
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                  .slice(0, 6)
                  .map((doc) => (
                    <div
                      key={doc.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') navigate(`/documents/${doc.id}`);
                      }}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/25 hover:bg-muted/30 cursor-pointer transition-all"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{formatRelative(doc.updated_at)}</p>
                      </div>
                      <DocumentStatusBadge status={doc.status} statusLabel={doc.status_label} size="sm" />
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {canCreateDocument(user?.roles ?? [], user?.permissions ?? []) && (
                <QuickAction icon={Plus} label="Create document" path="/documents/new" navigate={navigate} />
              )}
              <QuickAction icon={FileText} label="My documents" path="/documents" navigate={navigate} />
              <QuickAction icon={Layers} label="Template catalogue" path="/template-management" navigate={navigate} />
              <QuickAction icon={Search} label="Search & OCR" path="/search" navigate={navigate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notifications
                {unreadCount > 0 ? <Badge variant="default">{unreadCount}</Badge> : null}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')} className="text-xs">
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No notifications yet</p>
              ) : (
                <div className="space-y-2 max-h-[min(360px,50vh)] overflow-y-auto pr-1">
                  {notifications.slice(0, 12).map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'p-3 rounded-lg text-xs border',
                        !n.read ? 'bg-primary/5 border-primary/15' : 'bg-muted/30 border-transparent'
                      )}
                    >
                      <p
                        className={cn(
                          'leading-relaxed line-clamp-3',
                          !n.read ? 'font-medium text-foreground' : 'text-foreground/80'
                        )}
                      >
                        {n.message}
                      </p>
                      <p className="text-muted-foreground mt-1">{formatRelative(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── User Dashboard (submitter / reviewer / director personal view) ─────────
function UserDashboard({ documentScope = 'all' }: { documentScope?: 'mine' | 'all' }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const showAuditLogPage = canAccessAuditLogModule(user?.roles);

  const { data: myTasks, isLoading: tasksLoading } = useQuery({
    queryKey: QUERY_KEYS.tasks(user?.user_id ?? ''),
    queryFn: () => tasksApi.list(user!.user_id),
    enabled: !!user?.user_id,
  });

  const { data: recentAudit, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-recent', user?.user_id],
    queryFn: () => auditApi.getLogs({ actor_id: user!.user_id }),
    enabled: !!user?.user_id,
  });

  const { data: myDocuments, isLoading: myDocsLoading } = useQuery({
    queryKey: [QUERY_KEYS.allDocuments, user?.user_id ?? 'anon'],
    queryFn: () => documentsApi.listAll(),
    enabled: !!user?.user_id,
    staleTime: 30_000,
  });

  const scopedDocuments = useMemo(() => {
    const raw = myDocuments ?? [];
    if (documentScope !== 'mine' || !user?.user_id) return raw;
    return raw.filter((d) => d.owner_id === user.user_id);
  }, [myDocuments, documentScope, user?.user_id]);

  const activityFeed = useMemo(
    () =>
      user?.user_id
        ? buildUserDashboardActivityFeed({
            userId: user.user_id,
            auditLogs: recentAudit ?? [],
            myDocuments: scopedDocuments,
            myTasks: myTasks ?? [],
            limit: 48,
            viewerDisplay: { username: user.username, full_name: null },
          })
        : [],
    [user?.user_id, user?.username, recentAudit, scopedDocuments, myTasks]
  );

  const activeTasks    = myTasks?.filter((t) => t.status === 'pending' || t.status === 'in_progress') ?? [];
  const completedTasks = myTasks?.filter((t) => t.status === 'completed') ?? [];

  const stats = useMemo(
    () => [
      { label: 'Active Tasks',          value: activeTasks.length,       sub: 'assigned to you',  icon: CheckSquare, color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20',   ring: 'ring-blue-100 dark:ring-blue-900/30',   onClick: () => navigate('/tasks') },
      { label: 'Completed Tasks',       value: completedTasks.length,    sub: 'all time',          icon: TrendingUp,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'ring-emerald-100 dark:ring-emerald-900/30', onClick: () => navigate('/tasks') },
      {
        label: 'Activity',
        value: activityFeed.length,
        sub: 'audit + docs + tasks',
        icon: Shield,
        color: 'text-primary',
        bg: 'bg-primary/10',
        ring: 'ring-primary/20',
        onClick: showAuditLogPage ? () => navigate('/audit') : undefined,
      },
      { label: 'Unread Notifications',  value: unreadCount,              sub: 'awaiting review',   icon: Bell,        color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20',  ring: 'ring-amber-100 dark:ring-amber-900/30',  onClick: () => navigate('/notifications') },
    ],
    [activeTasks.length, completedTasks.length, activityFeed.length, unreadCount, navigate, showAuditLogPage]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={documentScope === 'mine' ? 'My dashboard' : 'Dashboard'}
        description={
          documentScope === 'mine'
            ? `Welcome back, ${user?.username ?? 'there'}. Your tasks, documents you own, and your audit trail — organisation-wide lists are hidden here.`
            : `Welcome back, ${user?.username ?? 'there'}. Tasks, documents you created, and audit events you performed appear below.`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
              <Search className="h-4 w-4" /> Search
            </Button>
            {canCreateDocument(user?.roles ?? [], user?.permissions ?? []) && (
              <Button size="sm" onClick={() => navigate('/documents/new')}>
                <Plus className="h-4 w-4" /> Start process
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tasksLoading || auditLoading || myDocsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          : stats.map((s) => <StatCard key={s.label} {...s} />)
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">My Active Tasks</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="text-xs">
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : activeTasks.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                    <CheckSquare className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-foreground">No active tasks</p>
                  <p className="text-xs text-muted-foreground mt-1">Tasks assigned to you will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/25 hover:bg-muted/30 cursor-pointer transition-all group"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 group-hover:bg-primary/15 transition-colors">
                          <CheckSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">Step {task.step_number} — Review Task</p>
                          <p className="text-xs text-muted-foreground">Review task</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.due_date && <span className="text-xs text-muted-foreground hidden sm:block">{formatRelative(task.due_date)}</span>}
                        <TaskStatusBadge status={task.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {canCreateDocument(user?.roles ?? [], user?.permissions ?? []) && <QuickAction icon={Plus} label="Create Document" path="/documents/new" navigate={navigate} />}
              <QuickAction icon={FileText}  label="Browse Documents" path="/documents"  navigate={navigate} />
              <QuickAction icon={Layers} label="Template catalogue" path="/template-management" navigate={navigate} />
              <QuickAction icon={Search}    label="Search & OCR"     path="/search"     navigate={navigate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Notifications</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')} className="text-xs">
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {notifications.slice(0, 4).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 4).map((n) => (
                    <div key={n.id} className={cn('p-3 rounded-lg text-xs border', !n.read ? 'bg-primary/5 border-primary/15' : 'bg-muted/30 border-transparent')}>
                      <p className={cn('leading-relaxed line-clamp-2', !n.read ? 'font-medium text-foreground' : 'text-foreground/80')}>{n.message}</p>
                      <p className="text-muted-foreground mt-1">{formatRelative(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent activity</CardTitle>
          {showAuditLogPage && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/audit')} className="text-xs">
              Full audit log <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <AuditTimeline
            logs={activityFeed.slice(0, 12)}
            loading={auditLoading || myDocsLoading || tasksLoading}
            compact
          />
        </CardContent>
      </Card>
    </div>
  );
}
