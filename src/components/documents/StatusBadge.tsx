import { cn } from '@/utils/cn';
import { DOCUMENT_STATUS_CONFIG } from '@/utils/constants';
import type { DocumentStatus } from '@/types/document';

interface StatusBadgeProps {
  status: DocumentStatus;
  size?: 'sm' | 'md';
  /** For `pending` documents: e.g. `Awaiting Director review` or `Awaiting final approval`. */
  pendingStageLabel?: string | null;
  /** Backend-computed location label for pending docs across list/detail/dashboard views. */
  statusLabel?: string | null;
  /** Highlight when the assignment is past the SLA (3 days). */
  overdue?: boolean;
}

export function DocumentStatusBadge({
  status,
  size = 'md',
  pendingStageLabel,
  statusLabel,
  overdue = false,
}: StatusBadgeProps) {
  const config = DOCUMENT_STATUS_CONFIG[status] ?? {
    label: status,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    dot: 'bg-muted-foreground',
  };

  const pendingLabel = pendingStageLabel?.trim() || statusLabel?.trim();
  const baseLabel = status === 'pending' && pendingLabel ? pendingLabel : config.label;
  const label = overdue ? `${baseLabel} · Overdue` : baseLabel;
  const truncate = Boolean(status === 'pending' && pendingLabel);

  const overdueStyles = overdue
    ? {
        bg: 'bg-red-50 dark:bg-red-950/40',
        color: 'text-red-700 dark:text-red-400',
        dot: 'bg-red-500',
      }
    : null;

  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium max-w-[min(340px,92vw)] min-w-0',
        overdueStyles?.bg ?? config.bg,
        overdueStyles?.color ?? config.color,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span
        className={cn(
          'rounded-full shrink-0',
          overdue ? '' : 'animate-pulse',
          overdueStyles?.dot ?? config.dot,
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
        )}
      />
      <span className={cn(truncate ? 'truncate min-w-0' : 'whitespace-nowrap')}>{label}</span>
    </span>
  );
}
