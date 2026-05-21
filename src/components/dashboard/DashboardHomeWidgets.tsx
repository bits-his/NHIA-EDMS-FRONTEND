import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, FileBarChart, Gauge, Mail, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PersonalOperationalPanel } from '@/components/operational/OperationalCommandCenter';
import { operationalApi } from '@/api/operational';
import { periodParamsFromPreset } from '@/components/dashboard/DashboardPeriodSelect';
import { useAuthStore } from '@/stores/authStore';
import { canViewReportsNav } from '@/utils/permissions';
import { QUERY_KEYS } from '@/utils/constants';
import { cn } from '@/utils/cn';
import type { PersonalOperationalDashboard } from '@/types/operational';

type PersonalOperationalSnapshotProps = {
  /** When provided (e.g. from dashboard home API), skips a separate fetch. */
  data?: PersonalOperationalDashboard | null;
  isLoading?: boolean;
};

export function PersonalOperationalSnapshot({
  data: dataProp,
  isLoading: loadingProp,
}: PersonalOperationalSnapshotProps = {}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showReportsNav = canViewReportsNav(user?.roles);
  const params = useMemo(() => periodParamsFromPreset('30'), []);

  const { data: fetched, isLoading: fetching } = useQuery({
    queryKey: QUERY_KEYS.operationalPersonal(params),
    queryFn: () => operationalApi.getPersonal(params),
    enabled: !!user?.user_id && dataProp === undefined,
    staleTime: 45_000,
  });

  const data = dataProp !== undefined ? dataProp : fetched;
  const isLoading = loadingProp ?? (dataProp === undefined ? fetching : false);

  if (!user?.user_id) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Your operational performance</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate('/performance')}>
            <Gauge className="h-3.5 w-3.5 mr-1" />
            My performance
          </Button>
          {showReportsNav ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate('/reports')}>
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              Full reports
            </Button>
          ) : null}
        </div>
      </div>
      {data ? (
        <PersonalOperationalPanel data={data} compact loading={isLoading} />
      ) : isLoading ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Loading your operational metrics…
        </div>
      ) : null}
    </div>
  );
}

type ReportingSnapshotProps = {
  reportingPending: number;
  reportingTotal: number;
  overdueTasks: number;
  stalledWorkflows?: number;
  correspondence?: {
    incoming: number;
    outgoing: number;
    total: number;
    pending?: number;
  };
};

type PeriodActivityProps = {
  activity?: {
    auditEvents: number;
    documentsCreated: number;
    tasksCompleted: number;
    reportingSubmissions: number;
    revisionLoops: number;
  };
  periodLabel?: string;
};

/** Compact period-scoped activity row (executive / oversight dashboards). */
export function ExecutivePeriodActivityStrip({ activity, periodLabel }: PeriodActivityProps) {
  if (!activity) return null;
  const items = [
    { label: 'Audit events', value: activity.auditEvents },
    { label: 'Documents created', value: activity.documentsCreated },
    { label: 'Tasks completed', value: activity.tasksCompleted },
    { label: 'Submissions', value: activity.reportingSubmissions },
    { label: 'Revision loops', value: activity.revisionLoops },
  ];
  return (
    <Card className="border-dashed bg-muted/10">
      <CardContent className="py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Period activity{periodLabel ? ` · ${periodLabel}` : ''}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {items.map((item) => (
            <div key={item.label} className="rounded-md border bg-card px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
              <p className="text-lg font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportingSnapshotStrip({
  reportingPending,
  reportingTotal,
  overdueTasks,
  stalledWorkflows = 0,
  correspondence,
}: ReportingSnapshotProps) {
  const navigate = useNavigate();

  const chips = [
    {
      label: 'Pending submissions',
      value: reportingPending,
      tab: 'reporting',
      icon: FileBarChart,
      warn: reportingPending > 0,
    },
    {
      label: 'Overdue tasks',
      value: overdueTasks,
      tab: 'escalations',
      icon: Zap,
      warn: overdueTasks > 0,
    },
    {
      label: 'Correspondence',
      value: correspondence?.total ?? 0,
      tab: 'correspondence',
      icon: Mail,
      warn: (correspondence?.pending ?? 0) > 0,
      sub:
        correspondence && correspondence.total > 0
          ? `${correspondence.incoming} in · ${correspondence.outgoing} out`
          : undefined,
    },
    {
      label: 'Submissions tracked',
      value: reportingTotal,
      tab: 'registry',
      icon: BarChart3,
      warn: false,
    },
  ];

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Analytics snapshot</CardTitle>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate('/reports')}>
            Open reports hub
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => navigate(`/reports?tab=${c.tab}`)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40',
                c.warn ? 'border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20' : 'bg-muted/20'
              )}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <c.icon className="h-3 w-3" />
                {c.label}
              </div>
              <p className="text-xl font-semibold tabular-nums mt-1">{c.value}</p>
              {c.sub ? <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p> : null}
            </button>
          ))}
        </div>
        {stalledWorkflows > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
            {stalledWorkflows} stalled workflow(s) — review in{' '}
            <button type="button" className="underline font-medium" onClick={() => navigate('/reports')}>
              Reports
            </button>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
