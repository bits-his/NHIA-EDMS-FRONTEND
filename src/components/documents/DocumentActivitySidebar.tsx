import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/shared/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { DOCUMENT_STATUS_CONFIG } from '@/utils/constants';
import { cn } from '@/utils/cn';
import type { DocumentStatus, DocumentVersion, DocumentWorkflowAction } from '@/types/document';

const ACTION_LABELS: Record<string, string> = {
  reject: 'Rejected',
  edit_forward: 'Note',
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

function resolveStatusHeadline(
  status: DocumentStatus,
  statusLabel: string | null | undefined,
  pendingStageLabel: string | null | undefined
): string {
  if (status === 'pending') {
    const dynamic = pendingStageLabel?.trim() || statusLabel?.trim();
    if (dynamic) return dynamic;
  }
  return DOCUMENT_STATUS_CONFIG[status]?.label ?? status;
}

function buildUppercaseRecordLine(
  refNumber: string | null | undefined,
  documentTitle: string,
  ownerDisplayName: string,
  ownerRoleContext: string | null | undefined
): string {
  const ref = refNumber?.trim() ?? '';
  const title = documentTitle?.trim() || 'Untitled document';
  const head = [ref, title].filter(Boolean).join(' ').trim().toUpperCase();
  const owner = ownerDisplayName?.trim();
  if (!owner) return head;
  const role = ownerRoleContext?.trim();
  const tail = role ? `${owner.toUpperCase()} (${role.toUpperCase()})` : owner.toUpperCase();
  return `${head} BY ${tail}`;
}

interface DocumentActivitySidebarProps {
  documentStatus: DocumentStatus;
  statusLabel?: string | null;
  pendingStageLabel?: string | null;
  assignmentOverdue?: boolean;
  refNumber?: string | null;
  documentTitle: string;
  ownerDisplayName: string;
  ownerRoleContext?: string | null;
  createdAt: string;
  updatedAt: string;
  categoryLabel: string;
  departmentDisplay: string;
  actions: DocumentWorkflowAction[] | undefined;
  actionsLoading: boolean;
  versions: DocumentVersion[] | undefined;
  versionsLoading: boolean;
}

export function DocumentActivitySidebar({
  documentStatus,
  statusLabel,
  pendingStageLabel,
  assignmentOverdue = false,
  refNumber,
  documentTitle,
  ownerDisplayName,
  ownerRoleContext,
  createdAt,
  updatedAt,
  categoryLabel,
  departmentDisplay,
  actions,
  actionsLoading,
  versions,
  versionsLoading,
}: DocumentActivitySidebarProps) {
  const [headerExpanded, setHeaderExpanded] = useState(true);

  const statusHeadline = useMemo(() => {
    const base = resolveStatusHeadline(documentStatus, statusLabel, pendingStageLabel);
    return assignmentOverdue ? `${base} · Overdue` : base;
  }, [documentStatus, statusLabel, pendingStageLabel, assignmentOverdue]);

  const recordLine = useMemo(
    () => buildUppercaseRecordLine(refNumber, documentTitle, ownerDisplayName, ownerRoleContext),
    [refNumber, documentTitle, ownerDisplayName, ownerRoleContext]
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/80 overflow-hidden">
        <div className="border-b border-border/60">
          <button
            type="button"
            onClick={() => setHeaderExpanded((e) => !e)}
            className="flex w-full items-start gap-2 px-3 py-3 text-left hover:bg-muted/30 transition-colors"
            aria-expanded={headerExpanded}
          >
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {headerExpanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 text-base font-semibold leading-snug line-clamp-2',
                assignmentOverdue && 'text-red-700 dark:text-red-400'
              )}
              title={statusHeadline}
            >
              {statusHeadline}
            </span>
          </button>

          {headerExpanded && (
            <>
              <p
                className="px-3 pb-3 text-[11px] font-medium leading-relaxed tracking-wide text-muted-foreground uppercase border-b border-border/60"
                title={recordLine}
              >
                {recordLine}
              </p>

              <Tabs defaultValue="action" className="w-full">
                <TabsList
                  className={cn(
                    'w-full h-auto justify-start gap-0 rounded-none border-0 bg-transparent p-0',
                    'border-b border-border/60'
                  )}
                >
                   <TabsTrigger
                    value="action"
                    className={cn(
                      'rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium',
                      'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none'
                    )}
                  >
                    Action History
                  </TabsTrigger>
                  <TabsTrigger
                    value="summary"
                    className={cn(
                      'rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium',
                      'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none'
                    )}
                  >
                    Summary
                  </TabsTrigger>
                 
                </TabsList>

                <TabsContent value="summary" className="m-0 px-3 py-3 space-y-3 focus-visible:outline-none">
                  <div>
                    <p className="text-xs text-muted-foreground">Created (auto timestamp)</p>
                    <p className="text-sm font-medium tabular-nums mt-0.5">{formatDateTime(createdAt)}</p>
                  </div>
                  <dl className="grid gap-2 text-sm border-t border-border/60 pt-3">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Last updated</dt>
                      <dd className="font-medium tabular-nums text-right">{formatDateTime(updatedAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Reference</dt>
                      <dd className="font-mono text-xs text-right truncate max-w-[55%]" title={refNumber ?? ''}>
                        {refNumber?.trim() || '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Category</dt>
                      <dd className="text-right truncate max-w-[55%]">{categoryLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Department</dt>
                      <dd className="text-right truncate max-w-[55%]">{departmentDisplay}</dd>
                    </div>
                  </dl>
                </TabsContent>

                <TabsContent value="action" className="m-0 px-3 pb-3 pt-1 focus-visible:outline-none">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Timestamp, actor (rank, department, zone or state), action type, comments.
                  </p>
                  {actionsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : !actions?.length ? (
                    <p className="text-sm text-muted-foreground py-2">No recorded actions yet.</p>
                  ) : (
                    <ScrollArea className="h-[min(420px,52vh)] pr-2">
                      <ul className="relative space-y-0 text-sm">
                        {[...actions]
                          .sort(
                            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                          )
                          .map((a, index, arr) => {
                            const ctx = formatActorContext(a);
                            const comment = a.comment?.trim();
                            return (
                              <li
                                key={a.id}
                                className="relative grid grid-cols-[22px_1fr] gap-3 pb-7 last:pb-0"
                              >
                                <div className="relative flex justify-center">
                                  {index < arr.length - 1 && (
                                    <span
                                      className="absolute top-6 bottom-[-28px] w-px bg-border"
                                      aria-hidden
                                    />
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
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
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
