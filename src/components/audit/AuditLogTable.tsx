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

interface AuditLogTableProps {
  logs: AuditLog[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AuditLogTable({
  logs,
  loading,
  emptyTitle = 'No activity',
  emptyDescription = 'Nothing matches your filters yet.',
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
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm min-w-[56rem]">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[10rem]">
                When
              </th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[6.5rem]">
                Action
              </th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[11rem]">
                Staff
              </th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[12rem]">
                Document
              </th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                What happened
              </th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[4.5rem] text-right">
                
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
                  <td className="px-3 py-2.5 align-top text-xs text-muted-foreground whitespace-nowrap">
                    <p className="font-medium text-foreground/90">{formatRelative(log.created_at)}</p>
                    <p className="text-[10px] mt-0.5">{formatDateTime(log.created_at)}</p>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Badge variant={badge.variant} className="text-[10px] font-semibold uppercase">
                      {badge.label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 align-top min-w-0">
                    <p className="font-medium text-foreground truncate" title={staff.primary}>
                      {staff.primary}
                    </p>
                    {staff.secondary && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={staff.secondary}>
                        {staff.secondary}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top min-w-0">
                    <p className="font-medium text-foreground truncate" title={doc.primary}>
                      {doc.primary}
                    </p>
                    {doc.secondary && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono" title={doc.secondary}>
                        {doc.secondary}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top text-xs text-muted-foreground leading-snug max-w-md">
                    <p className="line-clamp-2" title={summary}>
                      {summary}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 align-top text-right">
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
