import { useState } from 'react';
import { Shield, ChevronDown, ChevronRight, User } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative, formatAction } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import type { AuditLog } from '@/types/audit';
import { Skeleton } from '@/components/shared/Skeleton';

interface AuditTimelineProps {
  logs: AuditLog[];
  loading?: boolean;
  compact?: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  'document.create': 'bg-primary/10 text-primary border-primary/20',
  'document.submitted': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  'document.approve': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  'document.reject': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  'document.final_approve': 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-900/25 dark:text-emerald-300',
  'workflow.advanced': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  'workflow.started': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
  'workflow.resumed': 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
};

function AuditEntry({ log, compact }: { log: AuditLog; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = log.payload && Object.keys(log.payload).length > 0;
  const colorClass = ACTION_COLORS[log.action] ?? 'bg-muted text-muted-foreground border-border';

  return (
    <div className="flex gap-3 group">
      {/* Timeline node */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full border z-10',
          colorClass
        )}>
          <Shield className="h-3 w-3" />
        </div>
        <div className="w-px flex-1 bg-border mt-1 group-last:hidden" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground leading-snug">
              {formatAction(log.action)}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="capitalize">{resolveUsername(log.actor_id)}</span>
              </div>
              {log.entity_type && (
                <span className="text-xs text-muted-foreground/60">·</span>
              )}
              {log.entity_type && (
                <span className="text-xs text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">
                  {log.entity_type}
                </span>
              )}
              {log.entity_id && (
                <span className="text-xs text-muted-foreground/60 font-mono">
                  #{log.entity_id.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">{formatRelative(log.created_at)}</p>
            {!compact && (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{formatDateTime(log.created_at)}</p>
            )}
          </div>
        </div>

        {hasPayload && !compact && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? 'Hide' : 'Show'} payload
            </button>
            {expanded && (
              <pre className="mt-2 text-xs bg-muted/60 border border-border/50 rounded-lg p-3 overflow-x-auto font-mono text-muted-foreground leading-relaxed">
                {JSON.stringify(log.payload, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AuditTimeline({ logs, loading, compact }: AuditTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Shield className="h-8 w-8 text-muted-foreground mb-2" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">No audit entries found</p>
      </div>
    );
  }

  return (
    <div>
      {logs.map((log) => (
        <AuditEntry key={log.id} log={log} compact={compact} />
      ))}
    </div>
  );
}
