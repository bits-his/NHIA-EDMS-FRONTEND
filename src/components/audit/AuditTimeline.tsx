import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Shield,
  ChevronDown,
  ChevronRight,
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
  UserRound,
  Building2,
} from 'lucide-react';
import { parseISO, format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { auditActivityBadge, humanizeAuditAction } from '@/utils/auditLabels';
import {
  auditActionPhrase,
  auditActorBlock,
  documentContextFromLog,
} from '@/utils/auditDisplay';
import type { AuditLog } from '@/types/audit';
import { Skeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

interface AuditTimelineProps {
  logs: AuditLog[];
  loading?: boolean;
  compact?: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  'document.create': 'bg-primary/10 text-primary border-primary/25',
  'document.created': 'bg-primary/10 text-primary border-primary/25',
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
  if (a === 'document.approve' || a === 'document.approve_forward' || a === 'document.final_approve')
    return CheckCircle;
  if (a === 'document.submitted') return Send;
  if (a === 'document.archive') return Archive;
  if (a === 'document.create' || a === 'document.created') return Plus;
  if (a.startsWith('workflow.')) return GitBranch;
  if (a.startsWith('task.')) return ListTodo;
  if (a.startsWith('user.')) return LogIn;
  return Shield;
}

function dateGroupLabel(iso: string): string {
  try {
    const d = parseISO(iso);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, MMM d, yyyy');
  } catch {
    return 'Earlier';
  }
}

function groupLogsByDay(logs: AuditLog[]): { label: string; logs: AuditLog[] }[] {
  const map = new Map<string, AuditLog[]>();
  for (const log of logs) {
    const label = dateGroupLabel(log.created_at);
    const bucket = map.get(label) ?? [];
    bucket.push(log);
    map.set(label, bucket);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, logs: items }));
}

function AuditEntry({ log, compact }: { log: AuditLog; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = log.payload && Object.keys(log.payload).length > 0;
  const colorClass = ACTION_COLORS[log.action] ?? 'bg-muted text-muted-foreground border-border';
  const headline = auditActionPhrase(log);
  const actor = auditActorBlock(log);
  const docCtx = documentContextFromLog(log);
  const docLink =
    log.entity_type === 'document' && log.entity_id ? `/documents/${log.entity_id}` : null;
  const badge = auditActivityBadge(log.action);
  const Icon = auditActionIcon(log.action);
  const absTime = formatDateTime(log.created_at);
  const relTime = formatRelative(log.created_at);

  return (
    <article
      className={cn(
        'rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-colors hover:border-border',
        compact && 'p-3'
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
            colorClass
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={badge.variant}
                  className="shrink-0 text-[10px] font-semibold uppercase tracking-wide"
                >
                  {badge.label}
                </Badge>
                <span className="text-sm font-semibold text-foreground leading-snug">{headline}</span>
              </div>
              {!compact && (
                <p className="text-[11px] text-muted-foreground">{humanizeAuditAction(log.action)}</p>
              )}
            </div>
            <div className="text-right text-[11px] text-muted-foreground shrink-0">
              <p className="font-medium text-foreground/90">{relTime}</p>
              <p>{absTime}</p>
            </div>
          </div>

          <div className="rounded-md bg-muted/40 border border-border/50 px-2.5 py-2 space-y-1">
            <p className="text-xs font-semibold text-foreground flex flex-wrap items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {actor.name}
              {actor.rank && (
                <Badge variant="outline" className="text-[9px] font-normal py-0 h-4">
                  {actor.rank}
                </Badge>
              )}
            </p>
            {actor.orgLine && (
              <p className="text-[11px] text-muted-foreground pl-5 flex items-start gap-1.5">
                <Building2 className="h-3 w-3 shrink-0 mt-0.5 opacity-70" />
                <span>{actor.orgLine}</span>
              </p>
            )}
          </div>

          {docCtx && (
            <div className="rounded-md border border-dashed border-border/70 px-2.5 py-2 space-y-1.5">
              {docCtx.title && (
                <p className="text-xs font-medium text-foreground leading-snug">{docCtx.title}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {docCtx.refNumber && (
                  <Badge variant="secondary" className="font-mono text-[10px] font-normal">
                    {docCtx.refNumber}
                  </Badge>
                )}
                {docCtx.department && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {docCtx.department}
                  </Badge>
                )}
                {docCtx.category && (
                  <Badge variant="outline" className="text-[10px] font-normal capitalize">
                    {docCtx.category}
                  </Badge>
                )}
                {docCtx.status && (
                  <Badge variant="outline" className="text-[10px] font-normal capitalize">
                    {docCtx.status.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {docLink && (
            <Link
              to={docLink}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <FileText className="h-3 w-3 shrink-0" />
              Open document
            </Link>
          )}

          {hasPayload && (
            <div>
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {expanded ? 'Hide' : 'Show'} technical details
              </button>
              {expanded && (
                <pre className="mt-2 text-[11px] bg-muted/60 border border-border/50 rounded-md p-2.5 overflow-x-auto font-mono text-muted-foreground leading-relaxed">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function AuditTimeline({ logs, loading, compact }: AuditTimelineProps) {
  const grouped = useMemo(() => groupLogsByDay(logs), [logs]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Shield className="h-8 w-8 text-muted-foreground mb-2" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <section key={group.label}>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5 px-0.5">
            {group.label}
          </h3>
          <div className="space-y-2.5">
            {group.logs.map((log) => (
              <AuditEntry key={log.id} log={log} compact={compact} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
