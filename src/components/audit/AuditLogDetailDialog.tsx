import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { AuditLog } from '@/types/audit';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import {
  auditActorBlock,
  documentContextFromLog,
  effectiveAuditActionPhrase,
  effectiveAuditBadge,
  effectiveHumanizeAuditAction,
  payloadCommentPreview,
} from '@/utils/auditDisplay';

interface AuditLogDetailDialogProps {
  log: AuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDetailDialog({ log, open, onOpenChange }: AuditLogDetailDialogProps) {
  if (!log) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" />
      </Dialog>
    );
  }

  const badge = effectiveAuditBadge(log);
  const actor = auditActorBlock(log);
  const doc = documentContextFromLog(log);
  const comment = payloadCommentPreview(log);
  const docLink =
    log.entity_type === 'document' && log.entity_id ? `/documents/${log.entity_id}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base pr-6">
            <Badge variant={badge.variant} className="shrink-0">
              {badge.label}
            </Badge>
            <span className="break-words">{effectiveHumanizeAuditAction(log)}</span>
          </DialogTitle>
          <DialogDescription>
            {formatDateTime(log.created_at)} · {formatRelative(log.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm min-w-0">
          <section className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Summary
            </p>
            <p className="text-foreground leading-relaxed break-words">
              {effectiveAuditActionPhrase(log)}
            </p>
          </section>

          <Separator />

          <section className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Staff member
            </p>
            <p className="font-medium break-words">{actor.name}</p>
            {actor.rank && (
              <p className="text-muted-foreground text-xs mt-0.5 break-words">{actor.rank}</p>
            )}
            {actor.orgLine && (
              <p className="text-muted-foreground text-xs mt-0.5 break-words">{actor.orgLine}</p>
            )}
          </section>

          {doc && (
            <>
              <Separator />
              <section className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Document
                </p>
                {doc.title && <p className="font-medium break-words">{doc.title}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {doc.refNumber && (
                    <Badge variant="secondary" className="font-mono text-[10px] font-normal">
                      {doc.refNumber}
                    </Badge>
                  )}
                  {doc.department && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {doc.department}
                    </Badge>
                  )}
                  {doc.status && (
                    <Badge variant="outline" className="text-[10px] font-normal capitalize">
                      {doc.status.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
                {docLink && (
                  <Link
                    to={docLink}
                    className="inline-flex items-center gap-1 text-primary text-xs font-medium mt-2 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Open document
                  </Link>
                )}
              </section>
            </>
          )}

          {comment && (
            <>
              <Separator />
              <section className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Comment
                </p>
                <p className="text-foreground whitespace-pre-wrap break-words rounded-md bg-muted/50 border border-border/60 p-3 text-xs leading-relaxed">
                  {typeof log.payload?.comment === 'string' ? log.payload.comment : comment}
                </p>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
