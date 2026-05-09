import { Card, CardContent } from '@/components/ui/card';

const METRICS = [
  { key: 'total', label: 'Total Templates' },
  { key: 'hq', label: 'Headquarters' },
  { key: 'state', label: 'State Office' },
  { key: 'dept', label: 'Department' },
  { key: 'unit', label: 'Unit' },
  { key: 'zonal', label: 'Zonal' },
  { key: 'executive', label: 'Executive' },
  { key: 'archived', label: 'Archived' },
] as const;

export type MetricCounts = Record<(typeof METRICS)[number]['key'], number>;

const DEFAULT_COUNTS: MetricCounts = {
  total: 0,
  hq: 0,
  state: 0,
  dept: 0,
  unit: 0,
  zonal: 0,
  executive: 0,
  archived: 0,
};

interface TemplateMetricsStripProps {
  counts?: Partial<MetricCounts>;
}

export function TemplateMetricsStrip({ counts }: TemplateMetricsStripProps) {
  const data = { ...DEFAULT_COUNTS, ...counts };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {METRICS.map(({ key, label }) => (
        <Card key={key} className="border-border/80 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-foreground leading-none">{data[key]}</p>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
