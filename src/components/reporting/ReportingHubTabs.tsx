import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ChevronDown, FileBarChart, SlidersHorizontal, Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChartCard,
  DonutChart,
  OrgHorizontalBarChart,
  type DonutSlice,
} from '@/components/reporting/ReportingCharts';
import { CHART_COLORS } from '@/components/reporting/chartUtils';
import { cn } from '@/utils/cn';
import { resolveUsername } from '@/utils/users';
import type { ReportingHubCompliance, ReportingHubPayload } from '@/types/reporting';
import type { PersonalOperationalDashboard, TeamOperationalVisibility } from '@/types/operational';
import type { PerformanceAnalyticsResponse } from '@/types/performance';
import { executiveDrill } from '@/utils/executiveDrillDown';

export type ReportingFilterOptions = {
  zones: Array<{ id: number; code: string; name: string }>;
  stateOffices: Array<{ id: number; name: string; zone_code: string }>;
  departments: Array<{ id: number; name: string }>;
  directorates: Array<{ id: number; name: string }>;
};

function drillPath(base: string, path: string): string {
  if (path.startsWith('/reports?')) return path;
  if (path.startsWith('/dashboard/reports?')) return path.replace('/dashboard/reports', base);
  return path;
}

export function ReportingOrgFilters({
  zoneId,
  stateOfficeId,
  departmentId,
  directorateId,
  onZoneChange,
  onStateChange,
  onDepartmentChange,
  onDirectorateChange,
  filterOptions,
  showFilters,
}: {
  zoneId: string;
  stateOfficeId: string;
  departmentId: string;
  directorateId: string;
  onZoneChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onDirectorateChange: (v: string) => void;
  filterOptions?: ReportingFilterOptions | null;
  showFilters: boolean;
}) {
  const hasActive =
    zoneId !== 'all' ||
    stateOfficeId !== 'all' ||
    departmentId !== 'all' ||
    directorateId !== 'all';
  const [open, setOpen] = useState(hasActive);

  if (!showFilters || !filterOptions) return null;

  const selectedZone = filterOptions.zones.find((z) => String(z.id) === zoneId);
  const states =
    zoneId && zoneId !== 'all' && selectedZone
      ? filterOptions.stateOffices.filter((s) => s.zone_code === selectedZone.code)
      : filterOptions.stateOffices;

  return (
    <div className="rounded-md border border-dashed bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="inline-flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Organisation filters
          {hasActive ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Active
            </span>
          ) : null}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="grid gap-2 border-t px-3 pb-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Zone"
            value={zoneId}
            onChange={onZoneChange}
            options={[
              { value: 'all', label: 'All zones' },
              ...filterOptions.zones.map((z) => ({ value: String(z.id), label: z.name })),
            ]}
          />
          <FilterSelect
            label="State"
            value={stateOfficeId}
            onChange={onStateChange}
            options={[
              { value: 'all', label: 'All states' },
              ...states.map((s) => ({ value: String(s.id), label: s.name })),
            ]}
          />
          <FilterSelect
            label="Department"
            value={departmentId}
            onChange={onDepartmentChange}
            options={[
              { value: 'all', label: 'All departments' },
              ...filterOptions.departments.map((d) => ({ value: String(d.id), label: d.name })),
            ]}
          />
          <FilterSelect
            label="Directorate"
            value={directorateId}
            onChange={onDirectorateChange}
            options={[
              { value: 'all', label: 'All directorates' },
              ...filterOptions.directorates.map((d) => ({ value: String(d.id), label: d.name })),
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <select
        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ReportingPersonalTab({
  personal,
  navigate,
}: {
  personal: PersonalOperationalDashboard;
  navigate: (path: string) => void;
}) {
  const score = personal.efficiency_score.overall;
  const efficiencyDonut: DonutSlice[] = Object.entries(personal.efficiency_score.components)
    .filter(([, v]) => v > 0)
    .map(([key, value], i) => ({
      name: key.replace(/_/g, ' '),
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Efficiency" value={`${score}%`} />
        <StatCard label="Reporting owned" value={personal.reporting.total_owned} />
        <StatCard label="Overdue drafts" value={personal.reporting.overdue_drafts} alert />
        <StatCard label="Unresolved discussions" value={personal.communication.unresolved_discussions} />
      </div>

      {efficiencyDonut.length > 0 ? (
        <ChartCard title="Efficiency breakdown" description="Score components for this period">
          <DonutChart data={efficiencyDonut} centerLabel="Score" centerValue={`${score}%`} />
        </ChartCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <QueueCard
          title="Reporting obligations"
          empty="No reporting drafts pending."
          items={personal.queues.reporting_obligations.length}
        >
          {personal.queues.reporting_obligations.map((d) => (
            <button
              key={d.id}
              type="button"
              className="w-full text-left text-sm py-2 border-b last:border-0 hover:text-primary"
              onClick={() => navigate(`/documents/${d.id}`)}
            >
              {d.title ?? 'Untitled'} · {d.category?.replace(/_/g, ' ')}
            </button>
          ))}
        </QueueCard>
        <QueueCard title="Overdue tasks" empty="No overdue assignments." items={personal.queues.overdue_tasks.length}>
          {personal.queues.overdue_tasks.map((t) => (
            <button
              key={t.id}
              type="button"
              className="w-full text-left text-sm py-2 border-b last:border-0 hover:text-primary"
              onClick={() => navigate(`/tasks/${t.id}`)}
            >
              {t.document_title ?? 'Task'} · step {t.step_number}
            </button>
          ))}
        </QueueCard>
      </div>

      <Button variant="outline" size="sm" onClick={() => navigate('/performance')}>
        Open operational command centre <ArrowRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}

export function ReportingTeamTab({ team }: { team: TeamOperationalVisibility }) {
  const dist = team.workload_balancing.distribution.slice(0, 12);
  const chartData = dist.map((d) => ({
    name: (d.name ?? resolveUsername(d.user_id)).slice(0, 24),
    fullName: d.name ?? resolveUsername(d.user_id),
    documents: d.active,
    pending: d.overdue,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active assignments" value={team.summary.active_assignments} />
        <StatCard label="Overdue" value={team.summary.overdue_assignments} alert />
        <StatCard label="Staff with workload" value={team.summary.staff_with_workload} />
        <StatCard
          label="Team on-time rate"
          value={team.summary.team_on_time_rate != null ? `${team.summary.team_on_time_rate}%` : '—'}
        />
      </div>

      {chartData.length > 0 ? (
        <OrgHorizontalBarChart title="Workload by staff" data={chartData} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Overloaded staff
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {team.workload_balancing.overloaded.length === 0 ? (
              <p className="text-muted-foreground">No overloaded staff in scope.</p>
            ) : (
              team.workload_balancing.overloaded.map((s) => (
                <div key={s.user_id} className="flex justify-between border-b py-2 last:border-0">
                  <span>{s.name ?? resolveUsername(s.user_id)}</span>
                  <span className="tabular-nums text-amber-700">
                    {s.active} active · {s.overdue} overdue
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Workflow bottlenecks</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {team.bottlenecks.length === 0 ? (
              <p className="text-muted-foreground">No step congestion detected.</p>
            ) : (
              team.bottlenecks.map((b) => (
                <div key={b.step_number} className="flex justify-between border-b py-2 last:border-0">
                  <span>Step {b.step_number}</span>
                  <span className="font-medium tabular-nums">{b.pending_count} pending</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ReportingComplianceTab({
  compliance,
  drillBase,
}: {
  compliance: ReportingHubCompliance;
  drillBase: string;
}) {
  const navigate = useNavigate();
  const s = compliance.summary;
  const donut: DonutSlice[] = [
    { name: 'Pending review', value: s.pending, color: CHART_COLORS[2] },
    { name: 'Drafts', value: s.drafts, color: CHART_COLORS[1] },
    { name: 'Overdue drafts', value: s.overdue_drafts, color: CHART_COLORS[3] },
    { name: 'Approved', value: s.approved, color: CHART_COLORS[0] },
  ].filter((d) => d.value > 0);

  if (s.total === 0) {
    return (
      <EmptyState
        icon={FileBarChart}
        title="No submissions in this period"
        description="Internal memos, external correspondence, and formal management reports updated in the selected period are tracked here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total submissions" value={s.total} />
        <StatCard label="Pending" value={s.pending} />
        <StatCard label="Drafts" value={s.drafts} />
        <StatCard label="Overdue drafts" value={s.overdue_drafts} alert />
        <StatCard
          label="On-time submission"
          value={s.on_time_rate != null ? `${s.on_time_rate}%` : '—'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {donut.length > 0 ? (
          <ChartCard title="Submission status mix" description="Memos, correspondence, and management reports">
            <DonutChart data={donut} centerLabel="Total" centerValue={s.total} />
          </ChartCard>
        ) : null}
        {!compliance.personal && compliance.by_zone.length > 0 ? (
          <OrgHorizontalBarChart
            title="Reporting by zone"
            data={compliance.by_zone.map((z) => ({
              name: z.name,
              documents: z.total,
              pending: z.pending,
            }))}
          />
        ) : null}
      </div>

      {!compliance.personal ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(drillPath(drillBase, executiveDrill.reportingPending()))}
        >
          View pending management reports
        </Button>
      ) : null}
    </div>
  );
}

export function ReportingPerformanceTab({
  performance,
}: {
  performance: PerformanceAnalyticsResponse;
}) {
  const navigate = useNavigate();
  const summary = performance.summary;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Staff tracked" value={summary.staffTracked} />
        <StatCard label="Tasks completed" value={summary.tasksCompleted} />
        <StatCard label="Documents approved" value={summary.documentsApproved} />
        <StatCard label="Overdue (active)" value={summary.overdueActive} alert />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Staff performance leaderboard</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/performance')}>
            Full performance page
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-[11px] uppercase">
                <th className="pb-2 pr-4">Rank</th>
                <th className="pb-2 pr-4">Staff</th>
                <th className="pb-2 pr-4">Department</th>
                <th className="pb-2 text-right">Tasks</th>
                <th className="pb-2 text-right">Approved</th>
                <th className="pb-2 text-right">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {performance.leaderboard.slice(0, 15).map((row) => (
                <tr key={row.user_id} className="border-b last:border-0">
                  <td className="py-2.5 pr-4 font-medium">#{row.rank}</td>
                  <td className="py-2.5 pr-4">{row.full_name ?? row.username ?? row.user_id}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{row.department_name ?? '—'}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.tasks_completed}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.documents_approved}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.overdue_active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p
          className={cn(
            'text-2xl font-semibold mt-1 tabular-nums',
            alert && Number(value) > 0 && 'text-destructive'
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function QueueCard({
  title,
  empty,
  items,
  children,
}: {
  title: string;
  empty: string;
  items: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items > 0 ? children : <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}

export function resolveReportingDrillLink(link: string, drillBase: string): string {
  return drillPath(drillBase, link);
}
