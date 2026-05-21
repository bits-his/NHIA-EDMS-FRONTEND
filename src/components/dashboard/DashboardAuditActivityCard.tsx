import { useMemo } from 'react';
import { ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import type { AuditLog } from '@/types/audit';
import { dedupeCommentAuditRows } from '@/utils/auditTable';

type DashboardAuditActivityCardProps = {
  title: string;
  logs: AuditLog[];
  loading?: boolean;
  limit?: number;
  showFullAuditLink?: boolean;
  onOpenFullAudit?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DashboardAuditActivityCard({
  title,
  logs,
  loading,
  limit = 12,
  showFullAuditLink,
  onOpenFullAudit,
  emptyTitle = 'No recent activity',
  emptyDescription = 'Actions on documents and tasks will appear here.',
}: DashboardAuditActivityCardProps) {
  const displayLogs = useMemo(
    () => dedupeCommentAuditRows(logs).slice(0, limit),
    [logs, limit]
  );

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3 border-b border-border/60 bg-muted/20">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary shrink-0" />
            {title}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal mt-1">
            Click a row or the eye icon to view full details.
          </p>
        </div>
        {showFullAuditLink && onOpenFullAudit ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs shrink-0"
            onClick={onOpenFullAudit}
          >
            Full audit log
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        <AuditLogTable
          logs={displayLogs}
          loading={loading}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      </CardContent>
    </Card>
  );
}
