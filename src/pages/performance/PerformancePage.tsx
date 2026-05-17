import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { executiveApi } from '@/api/executive';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { canAccessPerformanceTracking } from '@/utils/permissions';
import { resolveUsername } from '@/utils/users';
import { cn } from '@/utils/cn';
import type { PerformanceLeaderboardEntry } from '@/types/performance';

type PeriodPreset = '7' | '30' | '90';

function periodRange(preset: PeriodPreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - Number(preset));
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function completedBreakdown(row: PerformanceLeaderboardEntry): string {
  const parts: string[] = [];
  if (row.workflow_completions > 0) {
    parts.push(`${row.workflow_completions} review${row.workflow_completions !== 1 ? 's' : ''}`);
  }
  if (row.document_submissions > 0) {
    parts.push(`${row.document_submissions} sent`);
  }
  if (row.owner_actions > 0) {
    parts.push(`${row.owner_actions} owner action${row.owner_actions !== 1 ? 's' : ''}`);
  }
  return parts.length ? parts.join(' · ') : String(row.completed_count);
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

export default function PerformancePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const allowed = canAccessPerformanceTracking(roles, permissions);

  const [period, setPeriod] = useState<PeriodPreset>('30');
  const queryParams = useMemo(() => periodRange(period), [period]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.executivePerformance(queryParams),
    queryFn: () => executiveApi.getPerformance(queryParams),
    enabled: allowed,
    staleTime: 30_000,
  });

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  const summary = data?.summary;
  const trendData =
    data?.trends.map((t) => ({
      ...t,
      label: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance tracking"
        description={
          data
            ? `${data.scope.label} · Workflow reviews, document submissions (create → send), and owner follow-up actions (${data.slaDays}-day SLA).`
            : 'Staff response times on workflow tasks and document creation.'
        }
        actions={
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Staff tracked"
              value={isLoading ? '—' : String(summary?.staffTracked ?? 0)}
              loading={isLoading}
            />
            <StatCard
              icon={CheckCircle}
              label="Total actions"
              value={isLoading ? '—' : String(summary?.totalActions ?? 0)}
              sub={
                isLoading
                  ? undefined
                  : `${summary?.tasksCompleted ?? 0} reviews · ${summary?.submissionsCompleted ?? 0} sent`
              }
              loading={isLoading}
            />
            <StatCard
              icon={Timer}
              label="Median time to act"
              value={isLoading ? '—' : formatHours(summary?.medianHoursToAct ?? null)}
              sub={isLoading ? undefined : `Avg ${formatHours(summary?.avgHoursToAct ?? null)}`}
              loading={isLoading}
            />
            <StatCard
              icon={TrendingUp}
              label="On-time completion"
              value={isLoading ? '—' : `${summary?.onTimeRate ?? 0}%`}
              sub={
                isLoading
                  ? undefined
                  : summary?.overdueActive
                    ? `${summary.overdueActive} overdue active`
                    : `Within ${data?.slaDays ?? 3}-day SLA`
              }
              loading={isLoading}
              accent={summary && summary.onTimeRate >= 80 ? 'positive' : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Card className="border-border/80 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-600" />
                  Leaderboard — fastest responders
                </CardTitle>
                <p className="text-xs text-muted-foreground font-normal mt-1">
                  Includes workflow reviewers and document creators. Ranked by average hours from
                  assignment or draft creation to action.
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
                      description="Data appears when staff complete workflow tasks, submit documents they created, or act on returned correspondence in this period."
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
                          <th className="px-4 py-3 text-right">Actions</th>
                          <th className="px-4 py-3 text-right">Avg time</th>
                          <th className="px-4 py-3 text-right">On time</th>
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
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                              {row.department_name || '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-medium tabular-nums">{row.completed_count}</span>
                              <p className="text-[10px] text-muted-foreground max-w-[140px] ml-auto">
                                {completedBreakdown(row)}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono font-medium text-foreground">
                                {formatHours(row.avg_hours_to_act)}
                              </span>
                              {row.median_hours_to_act != null && (
                                <p className="text-[10px] text-muted-foreground">
                                  med {formatHours(row.median_hours_to_act)}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Badge
                                variant={row.on_time_rate >= 80 ? 'default' : 'secondary'}
                                className="text-xs font-normal"
                              >
                                {row.on_time_rate}%
                              </Badge>
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
                  Response time trend
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
                      <YAxis
                        tick={{ fontSize: 10 }}
                        width={36}
                        label={{
                          value: 'hrs',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 10 },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: '1px solid hsl(var(--border))',
                          fontSize: 12,
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'avg_hours') return [formatHours(value), 'Avg response'];
                          return [value, 'Completed'];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg_hours"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="avg_hours"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                {data && trendData.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-3 text-center">
                    Daily average hours from assignment or document creation to action
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
              View all tasks
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
  accent,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
  accent?: 'positive';
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              accent === 'positive'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-primary/10 text-primary'
            )}
          >
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
