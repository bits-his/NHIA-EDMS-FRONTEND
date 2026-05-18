import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CHART_COLORS,
  CHART_HEIGHT,
  chartAxisTick,
  chartMargin,
  chartTooltipStyle,
  formatChartDate,
} from '@/components/reporting/chartUtils';

export type DonutSlice = { name: string; value: number; color?: string };

export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description ? <CardDescription className="text-sm">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent style={{ minHeight: CHART_HEIGHT }} className="pb-6">
        {children}
      </CardContent>
    </Card>
  );
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: DonutSlice[];
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height: CHART_HEIGHT }}
      >
        No data for this period
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="48%"
            innerRadius="58%"
            outerRadius="78%"
            paddingAngle={2}
            label={({ name, percent }) => {
              const p = percent ?? 0;
              return p >= 0.08 ? `${name} ${(p * 100).toFixed(0)}%` : '';
            }}
            labelLine={{ strokeWidth: 1 }}
          >
            {filtered.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            {...chartTooltipStyle}
            formatter={(value, name) => {
              const n = Number(value) || 0;
              return [
                `${n.toLocaleString()} (${total > 0 ? Math.round((n / total) * 100) : 0}%)`,
                String(name),
              ];
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={48}
            formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel != null && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-10">
          {centerValue != null ? (
            <span className="text-2xl font-bold tabular-nums text-foreground">{centerValue}</span>
          ) : null}
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">
            {centerLabel}
          </span>
        </div>
      )}
    </div>
  );
}

export function ActivityLineChart({
  data,
}: {
  data: Array<{ date: string; document_activity: number }>;
}) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatChartDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={formatted} margin={{ ...chartMargin, left: 4, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={chartAxisTick}
          interval="preserveStartEnd"
          label={{ value: 'Date', position: 'insideBottom', offset: -12, fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          tick={chartAxisTick}
          width={48}
          label={{
            value: 'Documents updated',
            angle: -90,
            position: 'insideLeft',
            offset: 12,
            fontSize: 12,
            style: { textAnchor: 'middle' },
          }}
        />
        <Tooltip
          {...chartTooltipStyle}
          labelFormatter={(_, payload) => {
            const row = payload?.[0]?.payload as { date?: string } | undefined;
            return row?.date ? formatChartDate(row.date) : '';
          }}
          formatter={(value) => [Number(value).toLocaleString(), 'Document updates']}
        />
        <Legend formatter={() => 'Daily document activity'} />
        <Line
          type="monotone"
          dataKey="document_activity"
          name="Document updates"
          stroke={CHART_COLORS[1]}
          strokeWidth={2.5}
          dot={{ r: 3, fill: CHART_COLORS[1] }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WorkflowBarChart({
  data,
}: {
  data: Array<{ step: string; active_tasks: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ ...chartMargin, left: 4, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="step"
          tick={chartAxisTick}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={56}
          label={{ value: 'Workflow step', position: 'insideBottom', offset: -4, fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          tick={chartAxisTick}
          width={48}
          label={{
            value: 'Active assignments',
            angle: -90,
            position: 'insideLeft',
            offset: 8,
            fontSize: 12,
            style: { textAnchor: 'middle' },
          }}
        />
        <Tooltip
          {...chartTooltipStyle}
          formatter={(value) => [Number(value).toLocaleString(), 'Active tasks at step']}
        />
        <Legend formatter={() => 'Queue congestion by workflow step'} />
        <Bar
          dataKey="active_tasks"
          name="Active tasks"
          fill={CHART_COLORS[1]}
          radius={[6, 6, 0, 0]}
          maxBarSize={56}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OrgHorizontalBarChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; documents: number; pending: number }>;
}) {
  const chartData = data.slice(0, 10).map((r) => ({
    name: r.name.length > 28 ? `${r.name.slice(0, 26)}…` : r.name,
    fullName: r.name,
    documents: r.documents,
    pending: r.pending,
  }));

  if (!chartData.length) return null;

  return (
    <ChartCard title={title} description="Document volume and pending items by unit">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={chartAxisTick} />
          <YAxis type="category" dataKey="name" tick={chartAxisTick} width={120} />
          <Tooltip
            {...chartTooltipStyle}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { fullName?: string } | undefined;
              return row?.fullName ?? '';
            }}
          />
          <Legend />
          <Bar dataKey="documents" name="Total documents" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
          <Bar dataKey="pending" name="Pending" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
