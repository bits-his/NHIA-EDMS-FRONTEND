import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Layers, CheckSquare, Shield, Plus, Search,
  ArrowRight, Bell,   TrendingUp, Clock, AlertTriangle, Activity, Users,
  CheckCircle, XCircle, LayoutDashboard, User, Radar,
  BarChart3, Trophy,
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
  canAccessPerformanceTracking,
  canAccessPersonalPerformancePage,
  isDirectorGeneralRole,
} from '@/utils/permissions';
import { resolveUsername, registerUsers } from '@/utils/users';
import { buildUserDashboardActivityFeed } from '@/utils/userActivityFeed';
import { cn } from '@/utils/cn';
import { executiveDrill } from '@/utils/executiveDrillDown';
import { DashboardOversight360 } from '@/components/dashboard/DashboardOversight360';
import { PersonalOperationalSnapshot } from '@/components/dashboard/DashboardHomeWidgets';
import {
  DashboardAlertsBanner,
  DashboardExecutiveSummary,
  DashboardPriorityInbox,
  DashboardPeriodFilter,
  DashboardSectionLabel,
  DashboardStatCard,
  scrollToDashboardSection,
  DASHBOARD_SECTION,
} from '@/components/dashboard/dashboardPrimitives';
import { mapDashboardAlerts } from '@/components/dashboard/mapDashboardAlerts';
import {
  periodParamsFromPreset,
  useDashboardPeriod,
} from '@/components/dashboard/DashboardPeriodSelect';
import { dashboardApi } from '@/api/dashboard';
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
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Organisation overview</span>
              {' — '}organisation-wide monitoring for leadership roles.
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
            Organisation overview
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
  if (operational) return <DashboardOversight360 />;
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

type ExecutiveVariant = 'dgo' | 'director';

function HealthMetricRow({
  label,
  value,
  suffix,
  valueClassName,
  onClick,
}: {
  label: string;
  value: number;
  suffix?: string;
  valueClassName?: string;
  onClick?: () => void;
}) {
  const body = (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', valueClassName)}>
        {value}
        {suffix}
      </span>
    </div>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full text-left hover:opacity-90">
      {body}
    </button>
  ) : (
    body
  );
}

function OrgMetricBars({
  rows,
  empty,
  onRowClick,
}: {
  rows: Array<{ id: number | null; name: string; documents: number; pending: number }>;
  empty: string;
  onRowClick?: (row: { id: number | null; name: string; documents: number; pending: number }) => void;
}) {
  if (!rows.length) {
    return <p className="text-xs text-muted-foreground py-4 text-center">{empty}</p>;
  }
  const max = Math.max(...rows.map((r) => r.documents), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const interactive = !!onRowClick && row.documents > 0;
        return (
          <div
            key={`${row.id}-${row.name}`}
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
  const { preset, setPreset, params } = useDashboardPeriod('30');

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.executive360(variant, params),
    queryFn: () => executiveApi.get360(params),
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
  const mappedAlerts = data?.alerts ? mapDashboardAlerts(data.alerts) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={variant === 'dgo' ? 'National overview' : 'Directorate overview'}
        description="Prioritised view of approvals, delays, and organisational activity within your authority."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
              Reports
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/performance')}>
              Performance
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
              Documents
            </Button>
          </div>
        }
      />

      {isError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          Unable to load organisation metrics. Please refresh the page.
        </div>
      )}

      {!isLoading && mappedAlerts.length > 0 ? (
        <DashboardAlertsBanner alerts={mappedAlerts} onNavigate={navigate} />
      ) : null}

      <DashboardSectionLabel
        action={<DashboardPeriodFilter value={preset} onChange={setPreset} />}
      >
        Current status (live)
      </DashboardSectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))
        ) : (
          <>
            <DashboardStatCard
              icon={FileText}
              label="Awaiting approval"
              value={kpis?.documents.pending ?? 0}
              sub={`of ${kpis?.documents.total ?? 0} documents in scope`}
              color="text-amber-600 dark:text-amber-400"
              bg="bg-amber-50 dark:bg-amber-900/20"
              ring="ring-amber-100 dark:ring-amber-900/30"
              onClick={() => scrollToDashboardSection(DASHBOARD_SECTION.pendingApproval)}
            />
            <DashboardStatCard
              icon={AlertTriangle}
              label="Overdue tasks"
              value={kpis?.tasks.overdue ?? 0}
              sub="past due date"
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
              onClick={() => scrollToDashboardSection(DASHBOARD_SECTION.overdueTasks)}
            />
            <DashboardStatCard
              icon={CheckSquare}
              label="Active workflow tasks"
              value={kpis?.tasks.active ?? 0}
              sub="pending or in progress"
              color="text-blue-600 dark:text-blue-400"
              bg="bg-blue-50 dark:bg-blue-900/20"
              ring="ring-blue-100 dark:ring-blue-900/30"
              onClick={() => navigate(executiveDrill.activeTasks())}
            />
            <DashboardStatCard
              icon={Activity}
              label="Workflow delays"
              value={data?.workflowHealth.escalationSignals ?? 0}
              sub={`${kpis?.workflows.stalled ?? 0} stalled 7+ days`}
              color="text-primary"
              bg="bg-primary/10"
              ring="ring-primary/20"
              onClick={() => navigate('/reports?tab=escalations')}
            />
          </>
        )}
      </div>

      {!isLoading && kpis ? (
        <DashboardExecutiveSummary
          kpis={kpis}
          periodActivity={kpis.periodActivity}
          periodComparison={data?.periodComparison}
          onOpenReports={(tab) => navigate(tab ? `/reports?tab=${tab}` : '/reports')}
        />
      ) : null}

      <DashboardSectionLabel>Analysis</DashboardSectionLabel>
      <DashboardPriorityInbox
        pendingDocs={data?.topPending ?? []}
        overdueTasks={data?.topOverdueTasks ?? []}
        overdueTotal={kpis?.tasks.overdue}
        isLoading={isLoading}
        onOpenDocument={(id) => navigate(`/documents/${id}`)}
        onOpenTask={(id) => navigate(`/tasks/${id}`)}
        onViewAllPending={() => navigate(executiveDrill.documentsByStatus('pending'))}
        onViewAllOverdue={() => navigate(executiveDrill.overdueTasks())}
      />
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
              {variant === 'dgo' ? 'State office activity' : 'Audit activity (period)'}
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
              <p className="text-xs text-muted-foreground">No audit events in the selected period.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {variant === 'dgo' && trendChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">National activity trend (selected period)</CardTitle>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
  const showPersonalPerformance = canAccessPersonalPerformancePage(user?.roles ?? []);

  const { data: recentAudit, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-recent', user?.user_id],
    queryFn: () => auditApi.getLogs({ actor_id: user!.user_id }),
    enabled: !!user?.user_id,
  });

  const { data: myTasks, isLoading: tasksLoading } = useQuery({
    queryKey: QUERY_KEYS.tasks(user?.user_id ?? ''),
    queryFn: () => tasksApi.list(user!.user_id),
    enabled: !!user?.user_id,
  });

  const { data: myDocuments, isLoading: myDocsLoading } = useQuery({
    queryKey: [QUERY_KEYS.allDocuments, user?.user_id ?? 'anon'],
    queryFn: () => documentsApi.listAll(),
    enabled: !!user?.user_id,
    staleTime: 30_000,
  });

  const homePeriod = useMemo(() => periodParamsFromPreset('30'), []);
  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: QUERY_KEYS.dashboardHome(homePeriod),
    queryFn: () => dashboardApi.getHome(homePeriod),
    enabled: !!user?.user_id,
    staleTime: 45_000,
  });

  const docs = myDocuments ?? [];
  const tasks = myTasks ?? [];

  const activityFeed = useMemo(
    () =>
      user?.user_id
        ? buildUserDashboardActivityFeed({
            userId: user.user_id,
            auditLogs: recentAudit ?? [],
            myDocuments: docs,
            myTasks: tasks,
            limit: 48,
            viewerDisplay: { username: user.username, full_name: null },
          })
        : [],
    [user?.user_id, user?.username, recentAudit, docs, tasks]
  );

  const totalCreated = docs.length;
  const overdueTaskCount = tasks.filter((t) => isTaskOverdue(t)).length;
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

  const loading = auditLoading || myDocsLoading || tasksLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My workspace"
        description={`Welcome back, ${user?.username ?? 'there'}. Your documents, tasks, and activity in one place.`}
        actions={
          <div className="flex items-center gap-2">
            {showPersonalPerformance && (
              <Button variant="outline" size="sm" onClick={() => navigate('/performance')}>
                <Activity className="h-4 w-4" /> Performance
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
              <BarChart3 className="h-4 w-4" /> Reports
            </Button>
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

      {overdueTaskCount > 0 ? (
        <div className="rounded-lg border border-red-200/80 bg-red-50/50 dark:bg-red-950/20 px-4 py-2 text-sm text-red-800 dark:text-red-300">
          {overdueTaskCount} overdue task{overdueTaskCount !== 1 ? 's' : ''} —{' '}
          <button type="button" className="underline font-medium" onClick={() => navigate('/tasks')}>
            open tasks
          </button>
        </div>
      ) : null}

      <PersonalOperationalSnapshot
        data={home?.personalOperational}
        isLoading={homeLoading}
      />

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

  const homePeriod = useMemo(() => periodParamsFromPreset('30'), []);
  const { data: home, isLoading: homeLoading } = useQuery({
    queryKey: QUERY_KEYS.dashboardHome(homePeriod),
    queryFn: () => dashboardApi.getHome(homePeriod),
    enabled: !!user?.user_id,
    staleTime: 45_000,
  });

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const showPersonalPerformance = canAccessPersonalPerformancePage(roles);

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
            {showPersonalPerformance && (
              <Button variant="outline" size="sm" onClick={() => navigate('/performance')}>
                <Activity className="h-4 w-4" /> Performance
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
              <BarChart3 className="h-4 w-4" /> Reports
            </Button>
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

      <PersonalOperationalSnapshot
        data={home?.personalOperational}
        isLoading={homeLoading}
      />

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
