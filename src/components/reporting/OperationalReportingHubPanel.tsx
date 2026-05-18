import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Download,
  FileBarChart,
  Gauge,
  GitBranch,
  Shield,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ActivityLineChart,
  ChartCard,
  DonutChart,
  OrgHorizontalBarChart,
  WorkflowBarChart,
  type DonutSlice,
} from '@/components/reporting/ReportingCharts';
import { CHART_COLORS } from '@/components/reporting/chartUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/shared/ErrorState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { reportingApi } from '@/api/reporting';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { canViewOperationalOverview } from '@/utils/permissions';
import { cn } from '@/utils/cn';
import { canAccessPerformanceTracking } from '@/utils/permissions';
import { executiveDrill } from '@/utils/executiveDrillDown';
import type { ReportingHubInsight, ReportingHubPayload } from '@/types/reporting';
import type { ReportingHubQuery } from '@/types/reporting';
import {
  ReportingComplianceTab,
  ReportingOrgFilters,
  ReportingPerformanceTab,
  ReportingPersonalTab,
  ReportingTeamTab,
  resolveReportingDrillLink,
} from '@/components/reporting/ReportingHubTabs';
import {
  PeriodComparisonCompact,
  ReportingCorrespondenceTab,
  ReportingEscalationsTab,
  ReportingRegistryTab,
} from '@/components/reporting/ReportingPhase2Tabs';

type PeriodPreset = '7' | '30' | '90';

const REPORTING_HUB_TABS = new Set([
  'overview',
  'personal',
  'workflow',
  'team',
  'performance',
  'organization',
  'compliance',
  'escalations',
  'correspondence',
  'registry',
  'reporting',
]);

function defaultReportingTab(oversight: boolean) {
  return oversight ? 'overview' : 'personal';
}

function resolveReportingHubTab(
  requested: string | null,
  opts: {
    oversight: boolean;
    showPerformance: boolean;
    hasPersonal: boolean;
    hasTeam: boolean;
    hasPerformance: boolean;
    hasEscalations: boolean;
    hasCorrespondence: boolean;
    hasRegistry: boolean;
    hasReporting: boolean;
  }
): string {
  const fallback = defaultReportingTab(opts.oversight);
  if (!requested || !REPORTING_HUB_TABS.has(requested)) return fallback;

  const allowed = new Set<string>(['workflow']);
  if (opts.oversight) {
    allowed.add('overview');
    allowed.add('organization');
    allowed.add('compliance');
  }
  if (!opts.oversight && opts.hasPersonal) allowed.add('personal');
  if (opts.oversight && opts.hasTeam) allowed.add('team');
  if (opts.oversight && opts.showPerformance && opts.hasPerformance) allowed.add('performance');
  if (opts.hasEscalations) allowed.add('escalations');
  if (opts.hasCorrespondence) allowed.add('correspondence');
  if (opts.hasRegistry) allowed.add('registry');
  if (opts.hasReporting) allowed.add('reporting');

  return allowed.has(requested) ? requested : fallback;
}

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
  return `${(hours / 24).toFixed(1)}d`;
}

function severityBadge(severity: ReportingHubInsight['severity']) {
  const map = {
    high: 'destructive',
    medium: 'secondary',
    low: 'outline',
  } as const;
  return map[severity] ?? 'outline';
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  onDrill,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Activity;
  onDrill?: () => void;
}) {
  return (
    <Card
      className={cn(
        'shadow-none',
        onDrill ? 'cursor-pointer hover:border-primary/40 transition-colors' : undefined
      )}
      onClick={onDrill}
    >
      <CardContent className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
              {label}
            </p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{value}</p>
            {sub ? <p className="text-[10px] text-muted-foreground truncate">{sub}</p> : null}
          </div>
          <Icon className="h-4 w-4 shrink-0 text-primary/70" />
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsPanel({
  insights,
  navigate,
  drillBase,
}: {
  insights: ReportingHubInsight[];
  navigate: (path: string) => void;
  drillBase: string;
}) {
  if (!insights.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No operational alerts for this period.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {insights.map((item) => (
        <li
          key={item.id}
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg border p-3"
        >
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AlertTriangle
              className={cn(
                'h-4 w-4 shrink-0 mt-0.5',
                item.severity === 'high' && 'text-destructive',
                item.severity === 'medium' && 'text-amber-600',
                item.severity === 'low' && 'text-muted-foreground'
              )}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">{item.title}</span>
                <Badge variant={severityBadge(item.severity)} className="text-[10px]">
                  {item.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{item.message}</p>
            </div>
          </div>
          {item.link ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => navigate(resolveReportingDrillLink(item.link, drillBase))}
            >
              View
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function OrgRollupTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: number | null; name: string; documents: number; pending: number }>;
}) {
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Unit</th>
                <th className="pb-2 font-medium text-right">Documents</th>
                <th className="pb-2 font-medium text-right">Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${title}-${r.id ?? r.name}`} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 text-right tabular-nums">{r.documents}</td>
                  <td className="py-2 text-right tabular-nums">{r.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function buildDocumentPipelineDonut(hub: ReportingHubPayload): DonutSlice[] {
  const pipeline = hub.executive?.snapshot?.pipeline;
  if (pipeline?.length) {
    return pipeline
      .filter((p) => p.count > 0)
      .map((p, i) => ({
        name: p.label,
        value: p.count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }
  const docs = hub.executive?.snapshot?.kpis.documents;
  if (!docs) return [];
  return [
    { name: 'Pending', value: docs.pending, color: CHART_COLORS[2] },
    { name: 'Approved', value: docs.approved, color: CHART_COLORS[0] },
    { name: 'Draft', value: docs.draft, color: CHART_COLORS[1] },
    { name: 'Rejected', value: docs.rejected, color: CHART_COLORS[3] },
    { name: 'Archived', value: docs.archived, color: CHART_COLORS[4] },
  ].filter((d) => d.value > 0);
}

function buildTaskHealthDonut(hub: ReportingHubPayload): DonutSlice[] {
  const rt = hub.operational.real_time;
  const kpis = hub.executive?.snapshot?.kpis.tasks;
  const active = rt?.active_tasks ?? kpis?.active ?? 0;
  const overdue = rt?.overdue_tasks ?? kpis?.overdue ?? 0;
  const completed = kpis?.completed ?? 0;
  return [
    { name: 'Active in queue', value: Math.max(0, active - overdue), color: CHART_COLORS[1] },
    { name: 'Overdue', value: overdue, color: CHART_COLORS[3] },
    { name: 'Completed', value: completed, color: CHART_COLORS[0] },
  ].filter((d) => d.value > 0);
}

function buildEfficiencyDonut(hub: ReportingHubPayload): DonutSlice[] {
  const personal = hub.operational.personal_summary;
  const comp = personal?.efficiency_score as { components?: Record<string, number> } | undefined;
  if (!comp?.components) return [];
  const labels: Record<string, string> = {
    tasks_completed: 'Tasks completed',
    documents_approved: 'Approvals',
    task_responsiveness: 'Responsiveness',
    documents_initiated: 'Initiated',
    queue_management: 'Queue management',
    workflow_quality: 'Workflow quality',
    communication: 'Communication',
  };
  return Object.entries(comp.components)
    .filter(([, v]) => v > 0)
    .map(([key, value], i) => ({
      name: labels[key] ?? key.replace(/_/g, ' '),
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
}

function OverviewTab({
  hub,
  navigate,
}: {
  hub: ReportingHubPayload;
  navigate: (path: string) => void;
}) {
  const rt = hub.operational.real_time;
  const personal = hub.operational.personal_summary;
  const oversight = hub.scope.oversight;
  const wi = hub.workflow_intelligence;
  const pipelineDonut = buildDocumentPipelineDonut(hub);
  const taskDonut = buildTaskHealthDonut(hub);
  const efficiencyDonut = buildEfficiencyDonut(hub);
  const efficiencyOverall =
    personal?.efficiency_score &&
    typeof personal.efficiency_score === 'object' &&
    'overall' in personal.efficiency_score
      ? (personal.efficiency_score as { overall: number }).overall
      : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {oversight && rt ? (
          <>
            <KpiCard
              label="Active tasks"
              value={rt.active_tasks}
              icon={Activity}
              onDrill={() => navigate(executiveDrill.activeTasks())}
            />
            <KpiCard
              label="Overdue tasks"
              value={rt.overdue_tasks}
              icon={Timer}
              onDrill={() => navigate(executiveDrill.overdueTasks())}
            />
            <KpiCard
              label="Active workflows"
              value={rt.active_workflows}
              icon={GitBranch}
            />
            <KpiCard
              label="Pending documents"
              value={rt.pending_documents}
              sub={
                rt.reporting_pending > 0
                  ? `${rt.reporting_pending} management reports pending`
                  : undefined
              }
              icon={FileBarChart}
            />
          </>
        ) : personal ? (
          <>
            <KpiCard
              label="Efficiency score"
              value={`${personal.efficiency_score?.overall ?? 0}%`}
              icon={Gauge}
            />
            <KpiCard
              label="Tasks completed"
              value={personal.workflow_productivity?.tasks_completed ?? 0}
              icon={Activity}
            />
            <KpiCard
              label="Documents approved"
              value={personal.workflow_productivity?.documents_approved ?? 0}
              icon={TrendingUp}
            />
            <KpiCard
              label="Active queue"
              value={personal.workload?.active_tasks ?? 0}
              icon={Timer}
            />
          </>
        ) : null}
        </div>
        <PeriodComparisonCompact comparison={hub.period_comparison} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {oversight && pipelineDonut.length > 0 ? (
          <ChartCard
            title="Document status mix"
            description="Share of documents by approval state in your scope"
          >
            <DonutChart
              data={pipelineDonut}
              centerLabel="Total"
              centerValue={hub.executive?.snapshot?.kpis.documents.total ?? '—'}
            />
          </ChartCard>
        ) : null}

        {!oversight && efficiencyDonut.length > 0 ? (
          <ChartCard
            title="Efficiency breakdown"
            description="How your operational score is composed"
          >
            <DonutChart
              data={efficiencyDonut}
              centerLabel="Score"
              centerValue={`${efficiencyOverall}%`}
            />
          </ChartCard>
        ) : null}

        {(taskDonut.length > 0 || oversight) && taskDonut.length > 0 ? (
          <ChartCard title="Task queue health" description="Active, overdue, and completed workflow tasks">
            <DonutChart data={taskDonut} centerLabel="Active" centerValue={rt?.active_tasks ?? '—'} />
          </ChartCard>
        ) : null}

        {wi.tasks_in_period > 0 ? (
          <ChartCard title="Workflow completion" description="Tasks closed vs still open in this period">
            <DonutChart
              data={[
                { name: 'Completed', value: wi.completed, color: CHART_COLORS[0] },
                {
                  name: 'Still open',
                  value: Math.max(0, wi.tasks_in_period - wi.completed),
                  color: CHART_COLORS[1],
                },
                { name: 'Overdue now', value: wi.overdue_active, color: CHART_COLORS[3] },
              ].filter((d) => d.value > 0)}
              centerLabel="Completion"
              centerValue={wi.completion_rate != null ? `${wi.completion_rate}%` : '—'}
            />
          </ChartCard>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {hub.operational.trend.length > 0 ? (
          <ChartCard
            title="Document activity over time"
            description="Daily count of documents updated in the selected period"
          >
            <ActivityLineChart data={hub.operational.trend} />
          </ChartCard>
        ) : null}
        {hub.operational.task_trend?.length > 0 ? (
          <ChartCard
            title="Tasks completed over time"
            description="Workflow tasks closed per day in the selected period"
          >
            <ActivityLineChart
              data={hub.operational.task_trend.map((t) => ({
                date: t.date,
                document_activity: t.tasks_completed,
              }))}
            />
          </ChartCard>
        ) : null}
      </div>

      {hub.executive?.snapshot ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Executive snapshot</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Open 360 dashboard
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground">Documents (total)</p>
                <p className="text-xl font-semibold tabular-nums">
                  {hub.executive.snapshot.kpis.documents.total}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Stalled workflows</p>
                <p className="text-xl font-semibold tabular-nums">
                  {hub.executive.snapshot.kpis.workflows.stalled}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Audit events (7d)</p>
                <p className="text-xl font-semibold tabular-nums">
                  {hub.executive.snapshot.kpis.audit.eventsLast7Days}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          <InsightsPanel insights={hub.insights} navigate={navigate} drillBase={hub.drill_down_base ?? '/reports'} />
        </CardContent>
      </Card>
    </div>
  );
}

function WorkflowTab({ hub }: { hub: ReportingHubPayload }) {
  const wi = hub.workflow_intelligence;
  const chartData = wi.bottleneck_steps.map((s) => ({
    step: `Step ${s.step_number}`,
    active_tasks: s.active_count,
  }));

  const turnaroundDonut: DonutSlice[] = [
    { name: 'Completed', value: wi.completed, color: CHART_COLORS[0] },
    { name: 'Revision loops', value: wi.revision_loops, color: CHART_COLORS[2] },
    { name: 'Rejected docs', value: wi.rejected_documents, color: CHART_COLORS[3] },
    { name: 'Overdue active', value: wi.overdue_active, color: CHART_COLORS[4] },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Tasks in period" value={wi.tasks_in_period} icon={Activity} />
        <KpiCard label="Completed" value={wi.completed} icon={TrendingUp} />
        <KpiCard
          label="Completion rate"
          value={wi.completion_rate != null ? `${wi.completion_rate}%` : '—'}
          icon={Gauge}
        />
        <KpiCard label="Overdue (active)" value={wi.overdue_active} icon={Timer} />
        <KpiCard label="Revision loops" value={wi.revision_loops} icon={GitBranch} />
        <KpiCard label="Rejected documents" value={wi.rejected_documents} icon={AlertTriangle} />
        <KpiCard
          label="Avg turnaround"
          value={formatHours(wi.avg_turnaround_hours)}
          icon={Timer}
        />
        <KpiCard
          label="Median turnaround"
          value={formatHours(wi.median_turnaround_hours)}
          icon={Timer}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {turnaroundDonut.length > 0 ? (
          <ChartCard title="Workflow outcomes" description="Completions, returns, rejections, and overdue work">
            <DonutChart data={turnaroundDonut} centerLabel="In period" centerValue={wi.tasks_in_period} />
          </ChartCard>
        ) : null}

        {wi.completion_rate != null && wi.tasks_in_period > 0 ? (
          <ChartCard title="Completion rate" description="Share of tasks finished in the selected period">
            <DonutChart
              data={[
                { name: 'Completed', value: wi.completed, color: CHART_COLORS[0] },
                {
                  name: 'Incomplete',
                  value: Math.max(0, wi.tasks_in_period - wi.completed),
                  color: CHART_COLORS[5],
                },
              ]}
              centerLabel="Rate"
              centerValue={`${wi.completion_rate}%`}
            />
          </ChartCard>
        ) : null}
      </div>

      {chartData.length > 0 ? (
        <ChartCard
          title="Workflow congestion by step"
          description="Number of active assignments waiting at each workflow step"
        >
          <WorkflowBarChart data={chartData} />
        </ChartCard>
      ) : null}
    </div>
  );
}

function OrganizationTab({ hub }: { hub: ReportingHubPayload }) {
  const org = hub.executive?.org_aggregation;
  if (!org) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <OrgHorizontalBarChart title="Zones" data={org.zones} />
        <OrgHorizontalBarChart title="State offices" data={org.state_offices} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <OrgHorizontalBarChart title="Departments" data={org.departments} />
        {org.directorates?.length > 0 ? (
          <OrgHorizontalBarChart title="Directorates" data={org.directorates} />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OrgRollupTable title="Zones (detail)" rows={org.zones} />
        <OrgRollupTable title="State offices (detail)" rows={org.state_offices} />
      </div>
      <OrgRollupTable title="Departments (detail)" rows={org.departments} />

      {org.reporting_by_category.length > 0 ? (
        <>
          <ChartCard
            title="Report categories"
            description="Distribution of management and operational reports by type"
          >
            <DonutChart
              data={org.reporting_by_category.map((r, i) => ({
                name: r.category.replace(/_/g, ' '),
                value: r.total,
                color: CHART_COLORS[i % CHART_COLORS.length],
              }))}
              centerLabel="Reports"
              centerValue={org.reporting_by_category.reduce((s, r) => s + r.total, 0)}
            />
          </ChartCard>
          <Card>
          <CardHeader>
            <CardTitle className="text-base">Management & compliance reporting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {org.reporting_by_category.map((r) => (
                    <tr key={r.category} className="border-b last:border-0">
                      <td className="py-2 capitalize">{r.category.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right tabular-nums">{r.total}</td>
                      <td className="py-2 text-right tabular-nums">{r.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </>
      ) : null}
    </div>
  );
}

function ComplianceTab({
  hub,
  navigate,
}: {
  hub: ReportingHubPayload;
  navigate: (path: string) => void;
}) {
  const sla = hub.sla;
  const audit = hub.audit_compliance;

  const slaDonut: DonutSlice[] =
    sla && sla.completed_in_period > 0
      ? [
          { name: 'Closed on time', value: sla.on_time_count, color: CHART_COLORS[0] },
          {
            name: 'Closed late',
            value: Math.max(0, sla.completed_in_period - sla.on_time_count),
            color: CHART_COLORS[2],
          },
          { name: 'Still overdue', value: sla.overdue_active, color: CHART_COLORS[3] },
        ].filter((d) => d.value > 0)
      : [];

  const auditDonut: DonutSlice[] =
    audit?.top_actions?.slice(0, 6).map((a, i) => ({
      name: a.action.replace(/_/g, ' '),
      value: a.count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    })) ?? [];

  return (
    <div className="space-y-6">
      {sla ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="SLA on-time rate"
              value={sla.on_time_rate != null ? `${sla.on_time_rate}%` : '—'}
              sub={`${sla.sla_days}-day assignment SLA`}
              icon={Shield}
            />
            <KpiCard label="Completed (period)" value={sla.completed_in_period} icon={Activity} />
            <KpiCard label="On time" value={sla.on_time_count} icon={TrendingUp} />
            <KpiCard label="Overdue active" value={sla.overdue_active} icon={Timer} />
          </div>

          {slaDonut.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <ChartCard
                title="SLA compliance"
                description={`Tasks completed within the ${sla.sla_days}-day assignment window`}
              >
                <DonutChart
                  data={slaDonut}
                  centerLabel="On-time"
                  centerValue={sla.on_time_rate != null ? `${sla.on_time_rate}%` : '—'}
                />
              </ChartCard>
              <ChartCard title="Active overdue load" description="Assignments currently past due date">
                <DonutChart
                  data={[
                    { name: 'Overdue active', value: sla.overdue_active, color: CHART_COLORS[3] },
                    {
                      name: 'Completed on time',
                      value: sla.on_time_count,
                      color: CHART_COLORS[0],
                    },
                  ].filter((d) => d.value > 0)}
                  centerLabel="Overdue"
                  centerValue={sla.overdue_active}
                />
              </ChartCard>
            </div>
          ) : null}
        </>
      ) : null}

      {audit && auditDonut.length > 0 ? (
        <ChartCard title="Audit activity mix" description="Top recorded actions in the selected period">
          <DonutChart data={auditDonut} centerLabel="Events" centerValue={audit.total_events} />
        </ChartCard>
      ) : null}

      {audit?.activity_trend && audit.activity_trend.length > 0 ? (
        <ChartCard title="Audit events over time" description="Daily audit log volume in scope">
          <ActivityLineChart
            data={audit.activity_trend.map((t) => ({
              date: t.date,
              document_activity: t.count,
            }))}
          />
        </ChartCard>
      ) : null}

      {audit ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Audit & compliance signals</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/audit')}>
              Full audit log
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {audit.total_events.toLocaleString()} events in period ·{' '}
              {audit.compliance_signals} approval/compliance-related action types
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.top_actions.map((r) => (
                    <tr key={r.action} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{r.action}</td>
                      <td className="py-2 text-right tabular-nums">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function OperationalReportingHubPanel() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const oversight = canViewOperationalOverview(roles, permissions);

  const [period, setPeriod] = useState<PeriodPreset>('30');
  const [exporting, setExporting] = useState(false);
  const [zoneId, setZoneId] = useState('all');
  const [stateOfficeId, setStateOfficeId] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [directorateId, setDirectorateId] = useState('all');

  const queryParams = useMemo((): ReportingHubQuery => {
    const base = periodRange(period);
    const q: ReportingHubQuery = { ...base };
    if (zoneId !== 'all') q.zone_id = zoneId;
    if (stateOfficeId !== 'all') q.state_office_id = stateOfficeId;
    if (departmentId !== 'all') q.department_id = departmentId;
    if (directorateId !== 'all') q.directorate_id = directorateId;
    return q;
  }, [period, zoneId, stateOfficeId, departmentId, directorateId]);

  const showPerformance = canAccessPerformanceTracking(roles, permissions);

  const hubQuery = useQuery({
    queryKey: QUERY_KEYS.reportingHub(queryParams),
    queryFn: () => reportingApi.getHub(queryParams),
    enabled: !!user?.user_id,
    staleTime: 45_000,
  });

  const hub = hubQuery.data;

  const activeTab = useMemo(() => {
    if (!hub) return defaultReportingTab(oversight);
    return resolveReportingHubTab(searchParams.get('tab'), {
      oversight,
      showPerformance,
      hasPersonal: !!hub.operational.personal,
      hasTeam: !!hub.team,
      hasPerformance: !!hub.executive?.performance,
      hasEscalations: !!hub.escalations,
      hasCorrespondence: !!hub.correspondence,
      hasRegistry: !!hub.registry_documents,
      hasReporting: !!hub.reporting_compliance,
    });
  }, [hub, oversight, showPerformance, searchParams]);

  function handleTabChange(value: string) {
    const fallback = defaultReportingTab(oversight);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete('tab');
        else next.set('tab', value);
        return next;
      },
      { replace: true }
    );
  }

  async function handleExport() {
    setExporting(true);
    try {
      await reportingApi.exportCsv(queryParams);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hub?.scope ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground min-w-0">
            <Badge variant="secondary" className="text-xs">
              {hub.scope.label}
            </Badge>
            <span className="truncate">
              {new Date(hub.period.from).toLocaleDateString()} –{' '}
              {new Date(hub.period.to).toLocaleDateString()}
            </span>
            {hub.generatedAt ? (
              <span className="hidden sm:inline">· {new Date(hub.generatedAt).toLocaleTimeString()}</span>
            ) : null}
          </div>
        ) : (
          <div />
        )}
        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={exporting || !hub}
            onClick={() => void handleExport()}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
          {oversight ? (
            <>
              <Button variant="ghost" size="sm" className="h-8 hidden md:inline-flex" onClick={() => navigate('/operational')}>
                Command centre
              </Button>
              <Button variant="ghost" size="sm" className="h-8 hidden md:inline-flex" onClick={() => navigate('/performance')}>
                Performance
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => navigate('/operational')}>
              My operations
            </Button>
          )}
        </div>
      </div>

      {hubQuery.isError ? (
        <ErrorState
          title="Could not load reporting hub"
          error={hubQuery.error}
          onRetry={() => void hubQuery.refetch()}
        />
      ) : hubQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-5">
                  <TableRowSkeleton />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : hub ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-2">
          <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-background/95 px-1 pb-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <TabsList className="inline-flex h-9 w-full max-w-full flex-nowrap justify-start gap-0.5 overflow-x-auto rounded-lg p-0.5">
            {oversight ? (
              <TabsTrigger value="overview" className="shrink-0 px-2.5 text-xs">
                Overview
              </TabsTrigger>
            ) : null}
            {!oversight && hub.operational.personal ? (
              <TabsTrigger value="personal" className="shrink-0 px-2.5 text-xs">
                My work
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="workflow" className="shrink-0 px-2.5 text-xs">
              Workflow
            </TabsTrigger>
            {oversight && hub.team ? (
              <TabsTrigger value="team" className="shrink-0 px-2.5 text-xs">
                Team
              </TabsTrigger>
            ) : null}
            {oversight && showPerformance && hub.executive?.performance ? (
              <TabsTrigger value="performance" className="shrink-0 px-2.5 text-xs">
                Performance
              </TabsTrigger>
            ) : null}
            {oversight ? (
              <>
                <TabsTrigger value="organization" className="shrink-0 px-2.5 text-xs">
                  Organization
                </TabsTrigger>
                <TabsTrigger value="compliance" className="shrink-0 px-2.5 text-xs">
                  SLA & audit
                </TabsTrigger>
              </>
            ) : null}
            {hub.escalations ? (
              <TabsTrigger value="escalations" className="shrink-0 px-2.5 text-xs">
                Escalations
              </TabsTrigger>
            ) : null}
            {hub.correspondence ? (
              <TabsTrigger value="correspondence" className="shrink-0 px-2.5 text-xs">
                Correspondence
              </TabsTrigger>
            ) : null}
            {hub.registry_documents ? (
              <TabsTrigger value="registry" className="shrink-0 px-2.5 text-xs">
                Reports
              </TabsTrigger>
            ) : null}
            {hub.reporting_compliance ? (
              <TabsTrigger value="reporting" className="shrink-0 px-2.5 text-xs">
                Compliance
              </TabsTrigger>
            ) : null}
          </TabsList>
          <ReportingOrgFilters
            showFilters={oversight}
            filterOptions={hub.filters.options ?? null}
            zoneId={zoneId}
            stateOfficeId={stateOfficeId}
            departmentId={departmentId}
            directorateId={directorateId}
            onZoneChange={(v) => {
              setZoneId(v);
              setStateOfficeId('all');
            }}
            onStateChange={setStateOfficeId}
            onDepartmentChange={setDepartmentId}
            onDirectorateChange={setDirectorateId}
          />
          </div>
          {oversight ? (
            <TabsContent value="overview">
              <OverviewTab hub={hub} navigate={navigate} />
            </TabsContent>
          ) : null}
          {!oversight && hub.operational.personal ? (
            <TabsContent value="personal">
              <ReportingPersonalTab personal={hub.operational.personal} navigate={navigate} />
            </TabsContent>
          ) : null}
          <TabsContent value="workflow">
            <WorkflowTab hub={hub} />
          </TabsContent>
          {oversight && hub.team ? (
            <TabsContent value="team">
              <ReportingTeamTab team={hub.team} />
            </TabsContent>
          ) : null}
          {oversight && hub.executive?.performance ? (
            <TabsContent value="performance">
              <ReportingPerformanceTab performance={hub.executive.performance} />
            </TabsContent>
          ) : null}
          {oversight ? (
            <>
              <TabsContent value="organization">
                <OrganizationTab hub={hub} />
              </TabsContent>
              <TabsContent value="compliance">
                <ComplianceTab hub={hub} navigate={navigate} />
              </TabsContent>
            </>
          ) : null}
          {hub.escalations ? (
            <TabsContent value="escalations">
              <ReportingEscalationsTab escalations={hub.escalations} />
            </TabsContent>
          ) : null}
          {hub.correspondence ? (
            <TabsContent value="correspondence">
              <ReportingCorrespondenceTab correspondence={hub.correspondence} />
            </TabsContent>
          ) : null}
          {hub.registry_documents ? (
            <TabsContent value="registry">
              <ReportingRegistryTab registry={hub.registry_documents} />
            </TabsContent>
          ) : null}
          {hub.reporting_compliance ? (
            <TabsContent value="reporting">
              <ReportingComplianceTab
                compliance={hub.reporting_compliance}
                drillBase={hub.drill_down_base ?? '/reports'}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      ) : null}
    </div>
  );
}
