import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, FileBarChart, Mail, Minus, Zap } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ActivityLineChart,
  ChartCard,
  DonutChart,
  type DonutSlice,
} from '@/components/reporting/ReportingCharts';
import { CHART_COLORS } from '@/components/reporting/chartUtils';
import { cn } from '@/utils/cn';
import type {
  ReportingHubCorrespondence,
  ReportingHubEscalations,
  ReportingHubPeriodComparison,
  ReportingHubRegistry,
} from '@/types/reporting';

function ChangeBadge({ pct }: { pct: number }) {
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        up ? 'text-emerald-600' : 'text-rose-600'
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? '+' : ''}
      {pct}%
    </span>
  );
}

export function PeriodComparisonCompact({
  comparison,
}: {
  comparison: ReportingHubPeriodComparison | null | undefined;
}) {
  if (!comparison?.metrics?.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80 shrink-0">vs prior period</span>
      {comparison.metrics.map((m) => (
        <span key={m.key} className="inline-flex items-center gap-1.5 shrink-0">
          <span>{m.label}</span>
          <span className="font-semibold text-foreground tabular-nums">{m.current}</span>
          <ChangeBadge pct={m.change_pct} />
        </span>
      ))}
    </div>
  );
}

export function PeriodComparisonStrip({
  comparison,
}: {
  comparison: ReportingHubPeriodComparison | null | undefined;
}) {
  return <PeriodComparisonCompact comparison={comparison} />;
}

export function ReportingEscalationsTab({
  escalations,
}: {
  escalations: ReportingHubEscalations | null | undefined;
}) {
  if (!escalations) return null;

  const slices: DonutSlice[] = [
    { name: 'Reminders', value: escalations.by_kind.reminder, color: CHART_COLORS[0] },
    { name: 'Escalations', value: escalations.by_kind.escalation, color: CHART_COLORS[1] },
    { name: 'Breached', value: escalations.by_kind.breached, color: CHART_COLORS[2] },
    { name: 'Resumed', value: escalations.by_kind.resumed, color: CHART_COLORS[3] },
  ].filter((s) => s.value > 0);

  if (escalations.total === 0 && escalations.recent.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        title="No escalations in this period"
        description="Overdue workflow assignments and SLA breaches appear here. Active overdue tasks are included automatically."
      />
    );
  }

  return (
    <div className="space-y-6">
      {escalations.includes_overdue_tasks ? (
        <p className="text-xs text-muted-foreground">
          Includes overdue workflow assignments (SLA event log may be empty).
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total SLA events" value={escalations.total} />
        <StatCard label="Reminders" value={escalations.by_kind.reminder} />
        <StatCard label="Escalations" value={escalations.by_kind.escalation} />
        <StatCard label="Breached" value={escalations.by_kind.breached} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {slices.length > 0 ? (
          <ChartCard title="SLA events by type" description="Reminder, escalation, breach, resume">
            <DonutChart data={slices} centerLabel="Events" centerValue={escalations.total} />
          </ChartCard>
        ) : null}
        {escalations.trend.length > 0 ? (
          <ChartCard title="SLA events over time" description="Daily volume in selected period">
            <ActivityLineChart
              data={escalations.trend.map((t) => ({
                date: t.date,
                document_activity: t.count,
              }))}
            />
          </ChartCard>
        ) : null}
      </div>

      {escalations.recent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent SLA events</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Document</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {escalations.recent.map((e) => (
                  <EscalationRow key={e.id} event={e} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function EscalationRow({
  event,
}: {
  event: ReportingHubEscalations['recent'][number];
}) {
  const navigate = useNavigate();
  return (
    <tr className="border-b last:border-0">
      <td className="py-2">
        <Badge variant="outline" className="capitalize">
          {event.event_kind}
        </Badge>
      </td>
      <td className="py-2">
        <button
          type="button"
          className="text-left hover:underline text-primary"
          onClick={() => navigate(`/documents/${event.document_id}`)}
        >
          {event.ref_number || event.title || `Document #${event.document_id}`}
        </button>
      </td>
      <td className="py-2 text-muted-foreground text-xs">
        {new Date(event.created_at).toLocaleString()}
      </td>
    </tr>
  );
}

export function ReportingCorrespondenceTab({
  correspondence,
}: {
  correspondence: ReportingHubCorrespondence | null | undefined;
}) {
  if (!correspondence) return null;

  const { summary, by_zone } = correspondence;

  if (summary.total === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No correspondence in this period"
        description="External correspondence (incoming/outgoing) created or updated in the selected period appears here."
      />
    );
  }

  const slices: DonutSlice[] = [
    { name: 'Incoming', value: summary.incoming, color: CHART_COLORS[0] },
    { name: 'Outgoing', value: summary.outgoing, color: CHART_COLORS[1] },
    { name: 'Other', value: summary.other, color: CHART_COLORS[4] },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total correspondence" value={summary.total} icon={Mail} />
        <StatCard label="Incoming" value={summary.incoming} />
        <StatCard label="Outgoing" value={summary.outgoing} />
        <StatCard label="Pending review" value={summary.pending} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {slices.length > 0 ? (
          <ChartCard title="Direction mix" description="Incoming vs outgoing correspondence">
            <DonutChart data={slices} centerLabel="Total" centerValue={summary.total} />
          </ChartCard>
        ) : null}
        {by_zone.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movement by zone</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Zone</th>
                    <th className="pb-2 font-medium text-right">Incoming</th>
                    <th className="pb-2 font-medium text-right">Outgoing</th>
                  </tr>
                </thead>
                <tbody>
                  {by_zone.map((z) => (
                    <tr key={z.name} className="border-b last:border-0">
                      <td className="py-2">{z.name}</td>
                      <td className="py-2 text-right tabular-nums">{z.incoming}</td>
                      <td className="py-2 text-right tabular-nums">{z.outgoing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export function ReportingRegistryTab({
  registry,
}: {
  registry: ReportingHubRegistry | null | undefined;
}) {
  const navigate = useNavigate();
  if (!registry) return null;

  if (registry.total === 0) {
    return (
      <EmptyState
        icon={FileBarChart}
        title="No submitted documents in this period"
        description="Internal memos, external correspondence, and management reports created or updated in this period are listed here."
      />
    );
  }

  const statusSlices: DonutSlice[] = [
    { name: 'Draft', value: registry.by_status.draft, color: CHART_COLORS[5] },
    { name: 'Pending', value: registry.by_status.pending, color: CHART_COLORS[1] },
    { name: 'Approved', value: registry.by_status.approved, color: CHART_COLORS[0] },
    { name: 'Rejected', value: registry.by_status.rejected, color: CHART_COLORS[2] },
    { name: 'Archived', value: registry.by_status.archived, color: CHART_COLORS[3] },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{registry.scope.label}</Badge>
        <span>{registry.total} management report(s) in period</span>
      </div>

      {statusSlices.length > 0 ? (
        <ChartCard title="Report status mix" description="Management & operational report documents">
          <DonutChart data={statusSlices} centerLabel="Reports" centerValue={registry.total} />
        </ChartCard>
      ) : null}

      {registry.recent.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent submitted reports</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/documents?category=management_report')}
            >
              Browse documents
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Reference</th>
                  <th className="pb-2 font-medium">Title</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {registry.recent.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{d.ref_number || '—'}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="text-left hover:underline text-primary"
                        onClick={() => navigate(`/documents/${d.id}`)}
                      >
                        {d.title}
                      </button>
                    </td>
                    <td className="py-2 capitalize">{d.status}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(d.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No management reports in this period.</p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
        </div>
        <p className="text-2xl font-semibold tabular-nums mt-1">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
