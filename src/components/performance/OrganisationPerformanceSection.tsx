import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Clock,
  TrendingUp,
  Users,
  AlertTriangle,
  Medal,
  Timer,
  CheckCircle,
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
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import { executiveApi } from '@/api/executive';
import { QUERY_KEYS } from '@/utils/constants';
import { resolveUsername } from '@/utils/users';
import { cn } from '@/utils/cn';
import type { PerformanceLeaderboardEntry } from '@/types/performance';

function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function contributionBreakdown(row: PerformanceLeaderboardEntry): string {
  const parts: string[] = [];
  if (row.tasks_completed > 0) {
    parts.push(`${row.tasks_completed} task${row.tasks_completed !== 1 ? 's' : ''}`);
  }
  if (row.documents_initiated > 0) {
    parts.push(`${row.documents_initiated} initiated`);
  }
  if (row.documents_approved > 0) {
    parts.push(`${row.documents_approved} approved`);
  }
  return parts.length ? parts.join(' · ') : String(row.total_contribution);
}

function staffDisplayName(row: PerformanceLeaderboardEntry): string {
  const full = row.full_name?.trim();
  if (full) return full;
  if (row.username?.trim()) return row.username.trim();
  return resolveUsername(row.user_id);
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 text-sm font-bold">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 text-sm font-bold">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
      {rank}
    </span>
  );
}

export function OrganisationPerformanceSection({
  queryParams,
  showFooterActions = true,
}: {
  queryParams: { from: string; to: string };
  showFooterActions?: boolean;
}) {
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.executivePerformance(queryParams),
    queryFn: () => executiveApi.getPerformance(queryParams),
    staleTime: 30_000,
  });

  const summary = data?.summary;
  const trendData = useMemo(
    () =>
      data?.trends.map((t) => ({
        ...t,
        label: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      })) ?? [],
    [data?.trends]
  );

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Staff tracked"
          value={isLoading ? '—' : String(summary?.staffTracked ?? 0)}
          loading={isLoading}
        />
        <StatCard
          icon={CheckCircle}
          label="Tasks completed"
          value={isLoading ? '—' : String(summary?.tasksCompleted ?? 0)}
          sub={
            isLoading
              ? undefined
              : `${summary?.documentsInitiated ?? 0} docs initiated · ${summary?.documentsApproved ?? 0} approved`
          }
          loading={isLoading}
        />
        <StatCard
          icon={Timer}
          label="Median time on task"
          value={isLoading ? '—' : formatHours(summary?.medianTaskHours ?? null)}
          sub={isLoading ? undefined : `Avg ${formatHours(summary?.avgTaskHours ?? null)}`}
          loading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Total contributions"
          value={isLoading ? '—' : String(summary?.totalContributions ?? 0)}
          sub={
            isLoading
              ? undefined
              : summary?.overdueActive
                ? `${summary.overdueActive} overdue active tasks`
                : 'Tasks + initiated + approved'
          }
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-600" />
              Workflow contribution leaderboard
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal mt-1">
              Ranked by completed tasks, documents initiated, and documents approved. Task time is
              measured from assignment to completion on each linked document.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </div>
            ) : !data?.leaderboard.length ? (
              <div className="p-8">
                <EmptyState
                  icon={Clock}
                  title="No performance data yet"
                  description="Data appears when staff complete workflow tasks, initiate documents, or approve documents in this period."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 w-12">#</th>
                      <th className="px-4 py-3">Staff</th>
                      <th className="px-4 py-3 hidden md:table-cell">Department</th>
                      <th className="px-4 py-3 text-right">Tasks</th>
                      <th className="px-4 py-3 text-right hidden lg:table-cell">Initiated</th>
                      <th className="px-4 py-3 text-right hidden lg:table-cell">Approved</th>
                      <th className="px-4 py-3 text-right">Avg task time</th>
                      <th className="px-4 py-3 text-right hidden sm:table-cell">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.leaderboard.map((row) => (
                      <tr
                        key={row.user_id}
                        className={cn(
                          'hover:bg-muted/30 transition-colors',
                          row.rank <= 3 && 'bg-primary/[0.03]'
                        )}
                      >
                        <td className="px-4 py-3">
                          <RankBadge rank={row.rank} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium capitalize text-foreground">
                            {staffDisplayName(row)}
                          </p>
                          {row.rank_label && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {row.rank_label}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground lg:hidden mt-0.5">
                            {contributionBreakdown(row)}
                          </p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {row.department_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {row.tasks_completed}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell tabular-nums text-muted-foreground">
                          {row.documents_initiated}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell tabular-nums text-muted-foreground">
                          {row.documents_approved}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono font-medium text-foreground">
                            {formatHours(row.avg_task_hours)}
                          </span>
                          {row.median_task_hours != null && (
                            <p className="text-[10px] text-muted-foreground">
                              med {formatHours(row.median_task_hours)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          {row.overdue_active > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              {row.overdue_active}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Task completion trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[240px] rounded-lg bg-muted/40 animate-pulse" />
            ) : trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No trend data for this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={28} allowDecimals={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    width={36}
                    label={{
                      value: 'hrs',
                      angle: -90,
                      position: 'insideRight',
                      style: { fontSize: 10 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      fontSize: 12,
                    }}
                    formatter={(value, name) => {
                      const n = typeof value === 'number' ? value : Number(value ?? 0);
                      if (name === 'avg_task_hours') return [formatHours(n), 'Avg task time'];
                      return [n, 'Tasks completed'];
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="tasks_completed"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="tasks_completed"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avg_task_hours"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="avg_task_hours"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            {data && trendData.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-3 text-center">
                Daily completed tasks and average hours from assignment to completion
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {showFooterActions ? (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
            View all tasks
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          {loading && <div className="h-4 w-12 rounded bg-muted animate-pulse" />}
        </div>
        <p className="text-xs text-muted-foreground mt-3">{label}</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
