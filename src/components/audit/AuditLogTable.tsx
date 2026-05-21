import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import type { AuditLog } from '@/types/audit';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/shared/Skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Shield } from 'lucide-react';
import { cn } from '@/utils/cn';
import { auditDocumentCell, auditStaffCell, auditSummaryCell } from '@/utils/auditTable';
import { effectiveAuditBadge } from '@/utils/auditDisplay';
import { AuditLogDetailDialog } from '@/components/audit/AuditLogDetailDialog';

function AuditTableTextCell({
  primary,
  secondary,
  secondaryMono,
}: {
  primary: string;
  secondary?: string | null;
  secondaryMono?: boolean;
}) {
  return (
    <div className="min-w-0 overflow-hidden">
      <p className="font-medium text-foreground truncate" title={primary}>
        {primary}
      </p>
      {secondary ? (
        <p
          className={cn(
            'text-[11px] text-muted-foreground truncate mt-0.5',
            secondaryMono && 'font-mono'
          )}
          title={secondary}
        >
          {secondary}
        </p>
      ) : null}
    </div>
  );
}

interface AuditLogTableProps {
  logs: AuditLog[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Tighter rows for dashboard embeds */
  dense?: boolean;
  /** Omit outer border when nested inside a card */
  embedded?: boolean;
}

export function AuditLogTable({
  logs,
  loading,
  emptyTitle = 'No activity',
  emptyDescription = 'Nothing matches your filters yet.',
  dense = false,
  embedded = false,
}: AuditLogTableProps) {
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (log: AuditLog) => {
    setSelected(log);
    setDetailOpen(true);
  };

  const sorted = useMemo(
    () =>
      [...logs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [logs]
  );

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <EmptyState icon={Shield} title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <>
      <div
        className={cn(
          'overflow-x-auto',
          !embedded && 'rounded-lg border border-border',
          embedded && 'border-t border-border/60'
        )}
      >
        <table
          className={cn('w-full text-sm table-fixed', dense ? 'min-w-[44rem]' : 'min-w-[48rem]')}
        >
          <colgroup>
            <col className="w-[9.5rem]" />
            <col className="w-[6.25rem]" />
            <col className="w-[12rem]" />
            <col className="w-[13rem]" />
            <col />
            <col className="w-[3.25rem]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th
                className={cn(
                  'px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                  dense ? 'py-2' : 'py-2.5'
                )}
              >
                When
              </th>
              <th
                className={cn(
                  'px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                  dense ? 'py-2' : 'py-2.5'
                )}
              >
                Action
              </th>
              <th
                className={cn(
                  'px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                  dense ? 'py-2' : 'py-2.5'
                )}
              >
                Staff
              </th>
              <th
                className={cn(
                  'px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                  dense ? 'py-2' : 'py-2.5'
                )}
              >
                Document
              </th>
              <th
                className={cn(
                  'px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                  dense ? 'py-2' : 'py-2.5'
                )}
              >
                What happened
              </th>
              <th
                className={cn(
                  'px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right',
                  dense ? 'py-2' : 'py-2.5'
                )}
              >
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((log, idx) => {
              const badge = effectiveAuditBadge(log);
              const staff = auditStaffCell(log);
              const doc = auditDocumentCell(log);
              const summary = auditSummaryCell(log);
              return (
                <tr
                  key={log.id}
                  className={cn(
                    'border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors',
                    idx % 2 === 1 && 'bg-slate-50/50 dark:bg-muted/20'
                  )}
                  onClick={() => openDetail(log)}
                >
                  <td
                    className={cn(
                      'px-3 align-middle text-xs text-muted-foreground whitespace-nowrap max-w-0',
                      dense ? 'py-2' : 'py-2.5'
                    )}
                  >
                    <p
                      className="font-medium text-foreground/90 truncate"
                      title={formatDateTime(log.created_at)}
                    >
                      {formatRelative(log.created_at)}
                    </p>
                    {!dense ? (
                      <p
                        className="text-[10px] mt-0.5 truncate"
                        title={formatDateTime(log.created_at)}
                      >
                        {formatDateTime(log.created_at)}
                      </p>
                    ) : null}
                  </td>
                  <td className={cn('px-3 align-middle max-w-0', dense ? 'py-2' : 'py-2.5')}>
                    <Badge
                      variant={badge.variant}
                      className="text-[10px] font-semibold uppercase max-w-full truncate"
                      title={badge.label}
                    >
                      {badge.label}
                    </Badge>
                  </td>
                  <td className={cn('px-3 align-middle max-w-0', dense ? 'py-2' : 'py-2.5')}>
                    <AuditTableTextCell primary={staff.primary} secondary={staff.secondary} />
                  </td>
                  <td className={cn('px-3 align-middle max-w-0', dense ? 'py-2' : 'py-2.5')}>
                    <AuditTableTextCell
                      primary={doc.primary}
                      secondary={doc.secondary}
                      secondaryMono
                    />
                  </td>
                  <td className={cn('px-3 align-middle max-w-0', dense ? 'py-2' : 'py-2.5')}>
                    <p
                      className={cn(
                        'text-muted-foreground leading-snug line-clamp-2 break-words',
                        dense ? 'text-[11px]' : 'text-xs'
                      )}
                      title={summary}
                    >
                      {summary}
                    </p>
                  </td>
                  <td className={cn('px-3 align-middle text-right', dense ? 'py-2' : 'py-2.5')}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="View details"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(log);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AuditLogDetailDialog
        log={selected}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setSelected(null);
        }}
      />
    </>
  );
}
