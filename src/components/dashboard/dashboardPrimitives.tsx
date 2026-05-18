import type { ElementType, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckSquare,
  Clock,
  FileBarChart,
  FileText,
  Mail,
  Minus,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { DashboardPeriodSelect, type DashboardPeriodPreset } from '@/components/dashboard/DashboardPeriodSelect';
import { resolveUsername } from '@/utils/users';
import { effectiveDueDate, formatRelative } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { DASHBOARD_SECTION } from '@/components/dashboard/dashboardSections';
import type { Executive360Response } from '@/types/executive';

export { DASHBOARD_SECTION, scrollToDashboardSection } from '@/components/dashboard/dashboardSections';

type Delta = { percent: number; direction: 'up' | 'down' | 'flat' };

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
  ring,
  onClick,
  delta,
  deltaLabel = 'vs prior period',
}: {
  icon: ElementType;
  label: string;
  value: number | string;
  sub: string;
  color: string;
  bg: string;
  ring: string;
  onClick?: () => void;
  delta?: Delta;
  deltaLabel?: string;
}) {
  const body = (
    <div className="rounded-xl border border-border bg-card p-4 w-full">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg ring-2', bg, ring)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        {delta && delta.direction !== 'flat' ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded',
              delta.direction === 'up'
                ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40'
                : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/40'
            )}
            title={deltaLabel}
          >
            {delta.direction === 'up' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {delta.percent}%
          </span>
        ) : delta ? (
          <span className="inline-flex items-center text-[10px] text-muted-foreground" title={deltaLabel}>
            <Minus className="h-3 w-3" />
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full text-left hover:opacity-95 transition-opacity">
      {body}
    </button>
  ) : (
    body
  );
}

export function DashboardAlertsBanner({
  alerts,
  onNavigate,
}: {
  alerts: Array<
    Executive360Response['alerts'][number] & { link: string; scrollTarget?: string }
  >;
  onNavigate: (path: string) => void;
}) {
  if (!alerts?.length) return null;
  return (
    <div className="rounded-lg border border-amber-300/70 dark:border-amber-800/60 bg-amber-50/90 dark:bg-amber-950/25 px-4 py-3">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Items requiring attention
      </p>
      <ul className="mt-2 space-y-1">
        {alerts.map((a) => (
          <li key={a.type}>
            <button
              type="button"
              onClick={() => {
                if (a.scrollTarget) {
                  const el = document.getElementById(a.scrollTarget);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  onNavigate(a.link);
                }
              }}
              className="text-sm text-amber-900 dark:text-amber-100 hover:underline text-left"
            >
              {a.message}
              <ArrowRight className="inline h-3.5 w-3.5 ml-1 opacity-60" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardPriorityInbox({
  pendingDocs,
  overdueTasks,
  overdueTotal,
  isLoading,
  onOpenDocument,
  onOpenTask,
  onViewAllPending,
  onViewAllOverdue,
}: {
  pendingDocs: Executive360Response['topPending'];
  overdueTasks: Executive360Response['topOverdueTasks'];
  /** KPI total — may exceed inbox preview length */
  overdueTotal?: number;
  isLoading?: boolean;
  onOpenDocument: (id: string) => void;
  onOpenTask: (id: string) => void;
  onViewAllPending: () => void;
  onViewAllOverdue: () => void;
}) {
  const hasPending = pendingDocs.length > 0;
  const overdueCount = overdueTotal ?? overdueTasks.length;
  const hasOverdue = overdueCount > 0;
  const hasOverduePreview = overdueTasks.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card
        id={DASHBOARD_SECTION.pendingApproval}
        className="border-amber-200/60 dark:border-amber-900/40 scroll-mt-24"
      >
        <CardHeader className="py-3 pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            Pending approval
            {hasPending ? (
              <Badge variant="secondary" className="text-xs">
                {pendingDocs.length}
                {pendingDocs.length >= 8 ? '+' : ''}
              </Badge>
            ) : null}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onViewAllPending}>
            View all
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
          ) : !hasPending ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 py-3 text-center">None awaiting approval</p>
          ) : (
            pendingDocs.slice(0, 5).map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onOpenDocument(doc.id)}
                className="flex w-full items-center justify-between gap-2 p-2.5 rounded-lg border bg-card hover:border-amber-300/60 text-left transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {resolveUsername(doc.owner_id)} · {formatRelative(doc.updated_at)}
                  </p>
                </div>
                <DocumentStatusBadge status="pending" statusLabel={doc.status_label} size="sm" />
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card
        id={DASHBOARD_SECTION.overdueTasks}
        className="border-red-200/60 dark:border-red-900/40 scroll-mt-24"
      >
        <CardHeader className="py-3 pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-600" />
            Overdue tasks
            {hasOverdue ? (
              <Badge variant="destructive" className="text-xs">
                {overdueCount}
                {overdueCount >= 12 ? '+' : ''}
              </Badge>
            ) : null}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onViewAllOverdue}>
            View all
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
          ) : !hasOverdue ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 py-3 text-center">No overdue tasks</p>
          ) : !hasOverduePreview ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              {overdueCount} overdue task{overdueCount !== 1 ? 's' : ''} in scope — use View all to open the list.
            </p>
          ) : (
            overdueTasks.slice(0, 5).map((task) => {
              const due = effectiveDueDate(task.due_date, task.created_at);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTask(task.id)}
                  className="flex w-full items-center justify-between gap-2 p-2.5 rounded-lg border border-red-200/50 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10 hover:bg-red-50/40 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Workflow step {task.step_number}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {resolveUsername(task.assignee_id)}
                      {due ? ` · due ${formatRelative(due)}` : ''}
                    </p>
                  </div>
                  <TaskStatusBadge status="pending" />
                </button>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardExecutiveSummary({
  kpis,
  periodActivity,
  periodComparison,
  onOpenReports,
}: {
  kpis: Executive360Response['kpis'];
  periodActivity?: Executive360Response['kpis']['periodActivity'];
  periodComparison?: Executive360Response['periodComparison'];
  onOpenReports: (tab?: string) => void;
}) {
  const navigate = useNavigate();

  const attention = [
    {
      label: 'Submissions pending review',
      value: kpis.reporting.pending,
      tab: 'reporting',
      icon: FileBarChart,
      warn: kpis.reporting.pending > 0,
    },
    {
      label: 'Overdue workflow tasks',
      value: kpis.tasks.overdue,
      tab: 'escalations',
      icon: Zap,
      warn: kpis.tasks.overdue > 0,
    },
    {
      label: 'Correspondence tracked',
      value: kpis.correspondence.total,
      tab: 'correspondence',
      icon: Mail,
      warn: (kpis.correspondence.pending ?? 0) > 0,
      sub:
        kpis.correspondence.total > 0
          ? `${kpis.correspondence.incoming} incoming · ${kpis.correspondence.outgoing} outgoing`
          : undefined,
    },
    {
      label: 'Stalled workflows',
      value: kpis.workflows.stalled,
      tab: 'escalations',
      icon: AlertTriangle,
      warn: kpis.workflows.stalled > 0,
    },
  ];

  const activityItems = periodActivity
    ? [
        { key: 'documentsCreated', label: 'Documents registered', value: periodActivity.documentsCreated },
        { key: 'tasksCompleted', label: 'Tasks completed', value: periodActivity.tasksCompleted },
        { key: 'auditEvents', label: 'Audit events', value: periodActivity.auditEvents },
        { key: 'reportingSubmissions', label: 'Report submissions', value: periodActivity.reportingSubmissions },
      ]
    : [];

  return (
    <Card>
      <CardHeader className="py-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">Organisation summary</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Attention items and activity in the selected period
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenReports()}>
            Full reports
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {attention.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onOpenReports(c.tab)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40',
                c.warn
                  ? 'border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20'
                  : 'bg-muted/20'
              )}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <c.icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{c.label}</span>
              </div>
              <p className="text-xl font-semibold tabular-nums mt-1">{c.value}</p>
              {c.sub ? <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.sub}</p> : null}
            </button>
          ))}
        </div>
        {activityItems.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Period activity
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {activityItems.map((item) => {
                const delta = periodComparison?.deltas?.[
                  item.key as keyof typeof periodComparison.deltas
                ];
                return (
                  <div key={item.key} className="rounded-md border bg-muted/10 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <p className="text-lg font-semibold tabular-nums">{item.value}</p>
                      {delta && delta.direction !== 'flat' ? (
                        <span
                          className={cn(
                            'text-[10px] font-medium tabular-nums',
                            delta.direction === 'up' ? 'text-emerald-600' : 'text-red-600'
                          )}
                        >
                          {delta.direction === 'up' ? '↑' : '↓'}
                          {delta.percent}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DashboardSectionLabel({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  if (!action) {
    return (
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
        {children}
      </p>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </p>
      {action}
    </div>
  );
}

export function DashboardPeriodFilter({
  value,
  onChange,
}: {
  value: DashboardPeriodPreset;
  onChange: (p: DashboardPeriodPreset) => void;
}) {
  return (
    <DashboardPeriodSelect
      value={value}
      onChange={onChange}
      className="h-8 w-[128px] text-xs shrink-0"
    />
  );
}
