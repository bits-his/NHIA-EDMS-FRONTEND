import { cn } from '@/utils/cn';
import { DOCUMENT_STATUS_CONFIG } from '@/utils/constants';
import type { DocumentStatus } from '@/types/document';

interface StatusBadgeProps {
  status: DocumentStatus;
  size?: 'sm' | 'md';
}

export function DocumentStatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = DOCUMENT_STATUS_CONFIG[status] ?? {
    label: status,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    dot: 'bg-muted-foreground',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        config.bg,
        config.color,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span className={cn('rounded-full shrink-0 animate-pulse', config.dot, size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
      {config.label}
    </span>
  );
}
