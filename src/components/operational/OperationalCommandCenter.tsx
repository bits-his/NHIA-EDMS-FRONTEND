import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Clock,
  FileBarChart,
  FileText,
  Lightbulb,
  MessageSquare,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import type { DocumentStatus } from '@/types/document';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/formatters';
import type {
  OperationalInsight,
  PersonalOperationalDashboard,
  TeamOperationalVisibility,
} from '@/types/operational';

function insightSeverityClass(severity: OperationalInsight['severity']) {
  switch (severity) {
    case 'high':
      return 'border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30';
    case 'medium':
      return 'border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30';
    default:
      return 'border-border bg-muted/30';
  }
}

function ScoreRing({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'h-28 w-28' : 'h-16 w-16';
  const text = size === 'lg' ? 'text-3xl' : 'text-lg';
  const color =
    score >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
  return (
    <div className={cn('relative flex items-center justify-center', dim)}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-muted" strokeWidth="2.5" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          className={cn('stroke-current', color)}
          strokeWidth="2.5"
          strokeDasharray={`${score} 100`}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn('font-bold tabular-nums', text, color)}>{score}</span>
    </div>
  );
}

function InsightsList({ insights, compact }: { insights: OperationalInsight[]; compact?: boolean }) {
  const navigate = useNavigate();
  if (!insights.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No operational alerts — workflow health looks good.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {insights.slice(0, compact ? 3 : 8).map((insight) => (
        <div
          key={insight.id}
          className={cn('rounded-lg border p-3', insightSeverityClass(insight.severity))}
        >
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{insight.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.message}</p>
              {insight.action && !compact && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-1 text-xs"
                  onClick={() => navigate(insight.action!.path)}
                >
                  {insight.action.label}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type PersonalProps = {
  data: PersonalOperationalDashboard;
  compact?: boolean;
  loading?: boolean;
};

export function PersonalOperationalPanel({ data, compact = false, loading }: PersonalProps) {
  const navigate = useNavigate();
  const trendData = useMemo(
    () =>
      data.trends.map((t) => ({
        ...t,
        label: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      })),
    [data.trends]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const score = data.efficiency_score.overall;
  const components = data.efficiency_score.components;

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'rounded-2xl border p-4 sm:p-5',
          'border-emerald-200/60 dark:border-emerald-900/40',
          'bg-gradient-to-br from-emerald-50/90 via-background to-teal-50/50',
          'dark:from-emerald-950/30 dark:via-background dark:to-teal-950/20'
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-center gap-4">
            <ScoreRing score={score} size={compact ? 'sm' : 'lg'} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Operational efficiency
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Based on time on workflow tasks (linked to documents), documents you initiated,
                documents you approved, and completed tasks in this period.
              </p>
              {!compact && (
                <p className="text-xs text-muted-foreground mt-2">
                  {data.workflow_productivity.tasks_completed} tasks completed
                  {data.workflow_productivity.median_task_hours != null &&
                    ` · median ${data.workflow_productivity.median_task_hours}h per task`}
                </p>
              )}
            </div>
          </div>
          {!compact && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
              {[
                { label: 'Tasks', value: components.tasks_completed, icon: CheckCircle },
                { label: 'Approved', value: components.documents_approved, icon: FileBarChart },
                { label: 'Response', value: components.task_responsiveness, icon: Timer },
                { label: 'Queue', value: components.queue_management, icon: Activity },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 text-center"
                >
                  <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold tabular-nums">{value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Tasks completed',
            value: data.workflow_productivity.tasks_completed,
            sub: `${data.workload.active_tasks} active · ${data.workload.overdue_tasks} overdue`,
            icon: CheckCircle,
            path: '/tasks',
            warn: data.workload.overdue_tasks > 0,
          },
          {
            label: 'Docs initiated',
            value: data.workflow_productivity.documents_initiated,
            sub: `${data.workload.owned_drafts} drafts`,
            icon: FileBarChart,
            path: '/documents',
            warn: false,
          },
          {
            label: 'Approvals given',
            value: data.workflow_productivity.documents_approved,
            sub: (() => {
              const owned =
                data.workload.owned_approved_documents ??
                data.workflow_productivity.owned_documents_approved;
              if (owned != null && owned > 0) {
                return `${owned} of your documents approved`;
              }
              return 'distinct documents in period';
            })(),
            icon: Clock,
            path: '/documents',
            warn: false,
          },
          {
            label: 'Communications',
            value: data.communication.unresolved_discussions,
            sub: `${data.communication.pending_direct_messages} DM pending`,
            icon: MessageSquare,
            path: '/documents',
            warn: data.communication.overdue_direct_messages > 0,
          },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => navigate(s.path)}
            className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <s.icon
              className={cn('h-4 w-4 mb-2', s.warn ? 'text-amber-600' : 'text-muted-foreground')}
            />
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          </button>
        ))}
      </div>

      <div className={cn('grid gap-5', compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3')}>
        <Card className={compact ? '' : 'lg:col-span-2'}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Documents worked on
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/documents')}>
              All documents <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {(data.queues.documents_worked?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No document activity in this period
              </p>
            ) : (
              <div className="space-y-2">
                {(data.queues.documents_worked ?? []).slice(0, compact ? 4 : 8).map((doc) => (
                  <div
                    key={doc.document_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/documents/${doc.document_id}`)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && navigate(`/documents/${doc.document_id}`)
                    }
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:border-primary/25 hover:bg-muted/30 cursor-pointer transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {doc.title || doc.ref_number || 'Untitled document'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.involvement_label}
                        {doc.step_number != null && ` · step ${doc.step_number}`}
                        {doc.last_activity_at &&
                          ` · ${formatRelative(doc.last_activity_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.ref_number && (
                        <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                          {doc.ref_number}
                        </span>
                      )}
                      {doc.status && (
                        <DocumentStatusBadge
                          status={doc.status as DocumentStatus}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Operational insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InsightsList insights={data.insights} compact={compact} />
          </CardContent>
        </Card>
      </div>

      {!compact && trendData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Completion trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="tasks_completed"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name="Tasks completed"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type TeamProps = {
  data: TeamOperationalVisibility;
  loading?: boolean;
};

export function TeamOperationalPanel({ data, loading }: TeamProps) {
  if (loading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active assignments', value: data.summary.active_assignments, icon: Users },
          { label: 'Overdue', value: data.summary.overdue_assignments, icon: AlertTriangle },
          { label: 'Team on-time', value: `${data.summary.team_on_time_rate}%`, icon: CheckCircle },
          {
            label: 'Median response',
            value:
              data.summary.median_response_hours != null
                ? `${data.summary.median_response_hours}h`
                : '—',
            icon: Timer,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <s.icon className="h-4 w-4 text-muted-foreground mb-2" />
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workload distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.workload_balancing.distribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No active team workload</p>
            ) : (
              <div className="space-y-2">
                {data.workload_balancing.distribution.slice(0, 10).map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-2 text-sm py-2 border-b border-border/50 last:border-0"
                  >
                    <span className="font-medium truncate">{member.name || member.user_id}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline">{member.active} active</Badge>
                      {member.overdue > 0 && (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40">
                          {member.overdue} overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {data.workload_balancing.overloaded.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
                {data.workload_balancing.overloaded.length} staff member(s) above average load (
                {data.workload_balancing.average_active} avg).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow bottlenecks</CardTitle>
          </CardHeader>
          <CardContent>
            {data.bottlenecks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No congestion detected</p>
            ) : (
              <div className="space-y-2">
                {data.bottlenecks.map((b) => (
                  <div key={b.step_number} className="flex items-center justify-between text-sm py-2">
                    <span>Workflow step {b.step_number}</span>
                    <Badge>{b.pending_count} pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team operational insights</CardTitle>
        </CardHeader>
        <CardContent>
          <InsightsList insights={data.insights} />
        </CardContent>
      </Card>
    </div>
  );
}
