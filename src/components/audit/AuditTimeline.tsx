import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Shield,
  ChevronDown,
  ChevronRight,
  User,
  FileText,
  Eye,
  Pencil,
  CheckCircle,
  XCircle,
  Send,
  Archive,
  GitBranch,
  ListTodo,
  LogIn,
  Plus,
  Clock,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import {
  auditActorDisplayName,
  auditActivityBadge,
  humanizeAuditAction,
  summarizeAuditPayload,
} from '@/utils/auditLabels';
import type { AuditLog } from '@/types/audit';
import { Skeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

interface AuditTimelineProps {
  logs: AuditLog[];
  loading?: boolean;
  compact?: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  'document.create': 'bg-primary/10 text-primary border-primary/20',
  'document.created': 'bg-primary/10 text-primary border-primary/20',
  'document.viewed': 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
  'document.updated': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  'document.submitted': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  'document.approve': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  'document.reject': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  'document.edit_forward': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  'document.approve_forward': 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-900/25 dark:text-emerald-300',
  'document.request_info': 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
  'document.final_approve': 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-900/25 dark:text-emerald-300',
  'document.archive': 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700',
  'task.assigned': 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/25 dark:text-sky-300 dark:border-sky-800',
  'task.completed': 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-900/25 dark:text-teal-300 dark:border-teal-800',
  'workflow.advanced': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  'workflow.started': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
  'workflow.resumed': 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
  'user.login': 'bg-muted text-muted-foreground border-border',
};

function auditActionIcon(action: string): LucideIcon {
  const a = action || '';
  if (a === 'document.viewed') return Eye;
  if (a === 'document.updated' || a === 'document.edit_forward') return Pencil;
  if (a === 'document.reject') return XCircle;
  if (a === 'document.approve' || a === 'document.approve_forward' || a === 'document.final_approve') return CheckCircle;
  if (a === 'document.submitted') return Send;
  if (a === 'document.archive') return Archive;
  if (a === 'document.create' || a === 'document.created') return Plus;
  if (a.startsWith('workflow.')) return GitBranch;
  if (a.startsWith('task.')) return ListTodo;
  if (a.startsWith('user.')) return LogIn;
  return Shield;
}

function AuditEntry({ log, compact }: { log: AuditLog; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = log.payload && Object.keys(log.payload).length > 0;
  const colorClass = ACTION_COLORS[log.action] ?? 'bg-muted text-muted-foreground border-border';
  const title = humanizeAuditAction(log.action);
  const summaryLine = summarizeAuditPayload(log);
  const docLink =
    log.entity_type === 'document' && log.entity_id ? `/documents/${log.entity_id}` : null;
  const badge = auditActivityBadge(log.action);
  const Icon = auditActionIcon(log.action);
  const absTime = formatDateTime(log.created_at);
  const relTime = formatRelative(log.created_at);

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border z-10',
            colorClass
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </div>
        <div className="w-px flex-1 bg-border mt-1 group-last:hidden" />
      </div>

      <div className="flex-1 pb-5 min-w-0 border-b border-border/60 last:border-0">
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <Badge variant={badge.variant} className="shrink-0 font-semibold tracking-wide">
            {badge.label}
          </Badge>
          <span className="text-sm font-semibold text-foreground leading-snug">{title}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-foreground/85">
            <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            {absTime}
          </span>
          <span className="text-muted-foreground/70">·</span>
          <span>{relTime}</span>
        </div>

        {!compact && (
          <p className="text-[11px] text-muted-foreground/80 font-mono mt-0.5">{log.action}</p>
        )}

        {summaryLine && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{summaryLine}</p>
        )}

        {docLink && !compact && (
          <Link
            to={docLink}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5 font-medium"
          >
            <FileText className="h-3 w-3 shrink-0" />
            Open document
          </Link>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" aria-hidden />
            <span className="text-muted-foreground/80">By</span>
            <span className="font-medium text-foreground">{auditActorDisplayName(log)}</span>
          </div>
          {log.entity_type && (
            <>
              <span className="text-xs text-muted-foreground/60">·</span>
              <span className="text-xs text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">
                {log.entity_type.replace(/_/g, ' ')}
              </span>
            </>
          )}
          {log.entity_id && (
            <span className="text-xs text-muted-foreground/60 font-mono">
              #{log.entity_id.slice(0, 8)}
            </span>
          )}
        </div>

        {hasPayload && !compact && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? 'Hide' : 'Show'} technical details
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
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-3 w-40" />
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
    <div className="space-y-0">
      {logs.map((log) => (
        <AuditEntry key={log.id} log={log} compact={compact} />
      ))}
    </div>
  );
}
