import { format, parseISO } from 'date-fns';
import { Check, CheckCircle2, ChevronDown, Clock, History, ListOrdered, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/shared/Skeleton';
import { formatDateTime } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import type { DocumentVersion, DocumentWorkflowAction } from '@/types/document';

const ACTION_LABELS: Record<string, string> = {
  reject: 'Rejected',
  edit_forward: 'Submitted',
  approve_forward: 'Approved & forwarded',
  request_info: 'Requested information',
  final_approve: 'Final approval',
  final_approval: 'Final approval',
  attach_send: 'Attach and send',
  review_send: 'Review and send',
  approve_send: 'Approve and send',
};

const AWAITING_LABELS: Record<string, string> = {
  edit_forward: 'Awaiting response',
  attach_send: 'Awaiting attachment response',
  review_send: 'Awaiting review response',
  approve_send: 'Awaiting approval response',
  approve_forward: 'Awaiting approval response',
  request_info: 'Awaiting information response',
};

/** Profile rank, or assigned RBAC role description / name when rank is missing. */
function resolveActorTitle(a: DocumentWorkflowAction): string {
  const rank = a.actor_rank?.trim();
  if (rank) return rank;
  const roleDesc = a.actor_role_description?.trim();
  if (roleDesc) return roleDesc;
  const roleName = a.actor_role_name?.trim();
  if (roleName) return roleName.replace(/_/g, ' ');
  return '';
}

/** Rank/role, department, zone or state — omit missing parts. */
function formatActorContext(a: DocumentWorkflowAction): string {
  const parts: string[] = [];
  const title = resolveActorTitle(a);
  const dept = a.actor_department?.trim();
  const zone = a.actor_zone?.trim();
  const state = a.actor_state?.trim();
  if (title) parts.push(title);
  if (dept) parts.push(dept);
  if (zone) parts.push(zone);
  else if (state) parts.push(state);
  return parts.join(', ');
}

function actorDisplayName(a: DocumentWorkflowAction): string {
  const full = a.actor_full_name?.trim();
  if (full) return full;
  const user = a.actor_username?.trim();
  if (user) return user;
  return resolveUsername(a.actor_id);
}

function formatTimelineDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'M/d/yyyy h:mm a');
  } catch {
    return formatDateTime(dateStr);
  }
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ');
}

function awaitingLabel(action: string): string | null {
  if (action === 'reject') return 'Document rejected';
  if (action === 'final_approve' || action === 'final_approval') return 'Final approval completed';
  return AWAITING_LABELS[action] ?? 'Awaiting response';
}

function pillLabel(action: string): string {
  if (action === 'reject') return 'Reject';
  if (action === 'request_info') return 'Request info';
  if (action === 'final_approve' || action === 'final_approval') return 'Final approve';
  return 'Submit';
}

interface DocumentActivitySidebarProps {
  createdAt: string;
  actions: DocumentWorkflowAction[] | undefined;
  actionsLoading: boolean;
  versions: DocumentVersion[] | undefined;
  versionsLoading: boolean;
}

export function DocumentActivitySidebar({
  createdAt,
  actions,
  actionsLoading,
  versions,
  versionsLoading,
}: DocumentActivitySidebarProps) {
  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recorded in system
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Created (auto timestamp)</p>
          <p className="text-sm font-medium tabular-nums">{formatDateTime(createdAt)}</p>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
            Actions taken
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal pt-1">
            Timestamp, actor (rank, department, zone or state), action type, comments.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {actionsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !actions?.length ? (
            <p className="text-sm text-muted-foreground">No recorded actions yet.</p>
          ) : (
            <ScrollArea className="h-[min(420px,52vh)] pr-2">
              <ul className="relative space-y-0 text-sm">
                {[...actions]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((a, index, arr) => {
                    const ctx = formatActorContext(a);
                    const comment = a.comment?.trim();
                    return (
                      <li key={a.id} className="relative grid grid-cols-[22px_1fr] gap-3 pb-7 last:pb-0">
                        <div className="relative flex justify-center">
                          {index < arr.length - 1 && (
                            <span className="absolute top-6 bottom-[-28px] w-px bg-border" aria-hidden />
                          )}
                          <span className="relative z-10 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                        </div>

                        <article className="min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {formatTimelineDate(a.created_at)}
                            </p>
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                          </div>

                          <div className="leading-snug">
                            <p className="font-bold uppercase tracking-tight text-foreground">
                              {actorDisplayName(a)}
                              {ctx ? <span> ({ctx})</span> : null}
                            </p>
                            <p className="text-sm text-muted-foreground">completed task</p>
                          </div>

                          <button
                            type="button"
                            className="block text-left text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                          >
                            {awaitingLabel(a.action)}
                          </button>

                          <div className="pt-0.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                              <Check className="h-4 w-4" />
                              {pillLabel(a.action)}
                            </span>
                          </div>

                          {comment ? (
                            <div className="flex gap-2 pt-1 text-sm italic leading-relaxed text-muted-foreground">
                              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                              <p className="whitespace-pre-wrap break-words">{comment}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">{actionLabel(a.action)}</p>
                          )}
                        </article>
                      </li>
                    );
                  })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Document history
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal pt-1">Content versions over time.</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {versionsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !versions?.length ? (
            <p className="text-sm text-muted-foreground">No versions.</p>
          ) : (
            <ScrollArea className="h-[min(220px,32vh)] pr-2">
              <ul className="space-y-2 text-sm">
                {[...versions]
                  .sort((a, b) => b.version_number - a.version_number)
                  .map((v) => (
                    <li
                      key={v.id}
                      className="flex justify-between gap-2 border border-border/60 rounded-lg px-2 py-1.5"
                    >
                      <span className="font-medium">v{v.version_number}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(v.created_at)}
                      </span>
                    </li>
                  ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
