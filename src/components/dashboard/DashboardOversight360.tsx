import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  FileText,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
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
import { useDashboardPeriod } from '@/components/dashboard/DashboardPeriodSelect';
import { dashboardApi } from '@/api/dashboard';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { auditApi } from '@/api/audit';
import { QUERY_KEYS } from '@/utils/constants';
import { formatRelative } from '@/utils/formatters';
import {
  canAccessAuditLogModule,
  canAccessTemplateManagement,
} from '@/utils/permissions';
import { resolveUsername } from '@/utils/users';
import { executiveDrill } from '@/utils/executiveDrillDown';
import { cn } from '@/utils/cn';
function QuickAction({
  icon: Icon,
  label,
  path,
  navigate,
}: {
  icon: typeof FileText;
  label: string;
  path: string;
  navigate: (p: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => navigate(path)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted/60 transition-colors text-left"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {label}
      <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-40" />
    </button>
  );
}

/** Oversight home — decision-first layout for organisation-wide monitoring. */
export function DashboardOversight360() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { preset, setPreset, params } = useDashboardPeriod('30');

  const isAdmin = user?.roles.includes('admin') ?? false;
  const canRecentAudit = isAdmin || hasPermission('view_audit_logs');
  const showAuditLogPage = canAccessAuditLogModule(user?.roles);

  const { data: home, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.dashboardHome(params),
    queryFn: () => dashboardApi.getHome(params),
    staleTime: 30_000,
    enabled: !!user?.user_id,
  });

  const { data: recentAudit, isLoading: auditLoading } = useQuery({
    queryKey: QUERY_KEYS.auditLogsRecent(40),
    queryFn: () => auditApi.getRecentLogs(40),
    staleTime: 15_000,
    enabled: !!user?.user_id && canRecentAudit,
  });

  const data = home?.executive360;
  const kpis = data?.kpis;
  const pendingDocs = data?.topPending ?? [];
  const overdueTasks = data?.topOverdueTasks ?? [];
  const workload = data?.assigneeWorkload ?? [];
  const pipeline = data?.pipeline ?? [];
  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500',
    draft: 'bg-slate-400',
    approved: 'bg-emerald-500',
    rejected: 'bg-red-500',
    archived: 'bg-slate-300',
  };

  const mappedAlerts = data?.alerts ? mapDashboardAlerts(data.alerts) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organisation overview"
        description="Monitor approvals, workflow delays, and activity across your authorised scope."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
              Reports
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/operational')}>
              My performance
            </Button>
          </div>
        }
      />

      {isError ? (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          Unable to load organisation metrics. Please refresh or try again shortly.
        </div>
      ) : null}

      {!isLoading && mappedAlerts.length > 0 ? (
        <DashboardAlertsBanner alerts={mappedAlerts} onNavigate={navigate} />
      ) : null}

      <DashboardSectionLabel
        action={<DashboardPeriodFilter value={preset} onChange={setPreset} />}
      >
        Current status (live)
      </DashboardSectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))
          : (
            <>
              <DashboardStatCard
                icon={FileText}
                label="Awaiting approval"
                value={kpis?.documents.pending ?? 0}
                sub="documents pending review"
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
                sub="in progress or pending"
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
        pendingDocs={pendingDocs}
        overdueTasks={overdueTasks}
        overdueTotal={kpis?.tasks.overdue}
        isLoading={isLoading}
        onOpenDocument={(id) => navigate(`/documents/${id}`)}
        onOpenTask={(id) => navigate(`/tasks/${id}`)}
        onViewAllPending={() => navigate(executiveDrill.documentsByStatus('pending'))}
        onViewAllOverdue={() => navigate(executiveDrill.overdueTasks())}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm font-semibold">Document status breakdown</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/documents')}>
              All documents
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              pipeline.map((row) => (
                <div key={row.status} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">{row.label}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        statusColors[row.status] ?? 'bg-primary'
                      )}
                      style={{
                        width:
                          (kpis?.documents.total ?? 0) > 0
                            ? `${(row.count / (kpis?.documents.total ?? 1)) * 100}%`
                            : '0%',
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-6 text-right">{row.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Staff workload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {workload.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active assignees in scope.</p>
            ) : (
              workload.slice(0, 8).map((w) => (
                <div
                  key={w.user_id}
                  className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 text-sm"
                >
                  <span className="truncate capitalize">{resolveUsername(w.user_id)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{w.active} active</span>
                </div>
              ))
            )}
            <Separator className="my-2" />
            <QuickAction icon={Search} label="Search documents" path="/search" navigate={navigate} />
            {showAuditLogPage ? (
              <QuickAction icon={Shield} label="Audit log" path="/audit" navigate={navigate} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {canRecentAudit ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm font-semibold">Recent system activity</CardTitle>
            {showAuditLogPage ? (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/audit')}>
                Full log
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <AuditTimeline
              logs={(recentAudit ?? []).slice(0, 8)}
              loading={auditLoading}
              compact
            />
          </CardContent>
        </Card>
      ) : null}

      {unreadCount > 0 ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 flex items-center justify-between">
            <p className="text-sm font-medium">{unreadCount} unread notification(s)</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/notifications')}>
              Open
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}