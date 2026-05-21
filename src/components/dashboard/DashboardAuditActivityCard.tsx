import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import type { AuditLog } from '@/types/audit';
import { dedupeCommentAuditRows } from '@/utils/auditTable';
import { cn } from '@/utils/cn';

type DashboardAuditActivityCardProps = {
  title: string;
  description?: string;
  logs: AuditLog[];
  loading?: boolean;
  limit?: number;
  showFullAuditLink?: boolean;
  onOpenFullAudit?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Compact table rows for dashboard layouts */
  dense?: boolean;
  /** Whether the table is expanded on first render */
  defaultOpen?: boolean;
};

export function DashboardAuditActivityCard({
  title,
  description,
  logs,
  loading,
  limit = 12,
  showFullAuditLink,
  onOpenFullAudit,
  emptyTitle = 'No recent activity',
  emptyDescription = 'Actions on documents and tasks will appear here.',
  dense = true,
  defaultOpen = false,
}: DashboardAuditActivityCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const displayLogs = useMemo(
    () => dedupeCommentAuditRows(logs).slice(0, limit),
    [logs, limit]
  );

  const eventCount = displayLogs.length;

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader
        className={cn(
          'flex flex-row items-start justify-between gap-4 bg-muted/15 py-4',
          open && 'border-b border-border/60'
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-3 text-left rounded-md -m-1 p-1 hover:bg-muted/40 transition-colors"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/8"
            aria-hidden
          >
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
              {!open && !loading && eventCount > 0 ? (
                <Badge variant="secondary" className="text-[10px] font-medium tabular-nums">
                  {eventCount} {eventCount === 1 ? 'event' : 'events'}
                </Badge>
              ) : null}
              {loading && !open ? (
                <Badge variant="outline" className="text-[10px] font-normal">
                  Loading…
                </Badge>
              ) : null}
            </div>
            {description ? (
              <p className="text-xs text-muted-foreground font-normal mt-1 leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'h-5 w-5 shrink-0 text-muted-foreground transition-transform mt-0.5',
              open && 'rotate-180'
            )}
            aria-hidden
          />
        </button>
        {showFullAuditLink && onOpenFullAudit ? (
          <Button
            variant="outline"
            size="sm"
            className="text-xs shrink-0 h-8"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullAudit();
            }}
          >
            View full log
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        ) : null}
      </CardHeader>
      {open ? (
        <CardContent className="p-0">
          <AuditLogTable
            logs={displayLogs}
            loading={loading}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            dense={dense}
            embedded
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
