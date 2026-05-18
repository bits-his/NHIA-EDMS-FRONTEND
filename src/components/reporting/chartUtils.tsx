/** Shared chart styling for operational reporting. */
export const CHART_HEIGHT = 360;

export const CHART_COLORS = [
  'hsl(152 60% 38%)',
  'hsl(210 70% 48%)',
  'hsl(38 92% 50%)',
  'hsl(0 72% 51%)',
  'hsl(262 55% 52%)',
  'hsl(187 65% 42%)',
  'hsl(24 90% 48%)',
];

export function formatChartDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const chartTooltipStyle = {
  contentStyle: {
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
    fontSize: '13px',
  },
  labelStyle: { fontWeight: 600, marginBottom: 4 },
};

export const chartAxisTick = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };

export const chartMargin = { top: 12, right: 16, left: 8, bottom: 8 };
