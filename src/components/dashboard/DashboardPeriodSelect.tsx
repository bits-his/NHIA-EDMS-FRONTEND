import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DashboardPeriodParams } from '@/api/dashboard';

export type DashboardPeriodPreset = '7' | '30' | '90';

const LABELS: Record<DashboardPeriodPreset, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
};

export function periodParamsFromPreset(preset: DashboardPeriodPreset): DashboardPeriodParams {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - Number(preset));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function useDashboardPeriod(defaultPreset: DashboardPeriodPreset = '30') {
  const [preset, setPreset] = useState<DashboardPeriodPreset>(defaultPreset);
  const params = useMemo(() => periodParamsFromPreset(preset), [preset]);
  return { preset, setPreset, params };
}

type DashboardPeriodSelectProps = {
  value: DashboardPeriodPreset;
  onChange: (preset: DashboardPeriodPreset) => void;
  className?: string;
};

export function DashboardPeriodSelect({ value, onChange, className }: DashboardPeriodSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DashboardPeriodPreset)}>
      <SelectTrigger className={className ?? 'h-8 w-[132px] text-xs'}>
        <SelectValue>{LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(LABELS) as DashboardPeriodPreset[]).map((key) => (
          <SelectItem key={key} value={key}>
            {LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
