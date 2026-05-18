import type { ElementType, ReactNode } from 'react';
import { Building2, Calendar, Gauge, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/shared/Skeleton';
import {
  DashboardPeriodSelect,
  type DashboardPeriodPreset,
} from '@/components/dashboard/DashboardPeriodSelect';
import { cn } from '@/utils/cn';

export type PerformanceTab = 'personal' | 'organization' | 'staff';

export function formatPeriodRangeLabel(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${from.toLocaleDateString(undefined, opts)} – ${to.toLocaleDateString(undefined, opts)}`;
}

export function PerformanceToolbar({
  period,
  onPeriodChange,
  periodFrom,
  periodTo,
  scopeLabel,
}: {
  period: DashboardPeriodPreset;
  onPeriodChange: (p: DashboardPeriodPreset) => void;
  periodFrom: string;
  periodTo: string;
  scopeLabel?: string | null;
}) {
  const rangeLabel = formatPeriodRangeLabel(periodFrom, periodTo);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border bg-muted/25 px-3 py-2.5">
      <div className="flex items-start gap-2 min-w-0">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Reporting period</p>
          {rangeLabel ? (
            <p className="text-[11px] text-muted-foreground truncate">{rangeLabel}</p>
          ) : null}
        </div>
        {scopeLabel ? (
          <Badge variant="secondary" className="text-[10px] shrink-0 hidden sm:inline-flex">
            {scopeLabel}
          </Badge>
        ) : null}
      </div>
      <DashboardPeriodSelect
        value={period}
        onChange={onPeriodChange}
        className="h-9 w-[140px] text-xs shrink-0"
      />
    </div>
  );
}

export function buildPerformanceTabs(opts: {
  showPersonal: boolean;
  showOrganisation: boolean;
}): { id: PerformanceTab; label: string; icon: ElementType }[] {
  const tabs: { id: PerformanceTab; label: string; icon: ElementType }[] = [];
  if (opts.showPersonal) {
    tabs.push({ id: 'personal', label: 'My performance', icon: Gauge });
  }
  if (opts.showOrganisation) {
    tabs.push({ id: 'organization', label: 'Organization performance', icon: Building2 });
    tabs.push({ id: 'staff', label: 'Staff performance', icon: Users });
  }
  return tabs;
}

export function PerformanceTabSwitcher({
  tabs,
  tab,
  onTabChange,
  ariaLabel = 'Performance views',
}: {
  tabs: { id: PerformanceTab; label: string; icon: ElementType }[];
  tab: PerformanceTab;
  onTabChange: (tab: PerformanceTab) => void;
  ariaLabel?: string;
}) {
  if (tabs.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 p-1 rounded-xl bg-muted/50 border border-border/60 w-full sm:w-auto"
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const selected = tab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onTabChange(id)}
            className={cn(
              'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              selected
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PerformanceSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-primary shrink-0" /> : null}
          {title}
        </h2>
        {description ? (
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function PerformancePersonalSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

export function PerformanceOrganizationSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function PerformanceStaffSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
