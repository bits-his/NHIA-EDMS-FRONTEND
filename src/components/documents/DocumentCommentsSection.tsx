import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, Paperclip, Send, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/shared/Skeleton';
import { documentsApi } from '@/api/documents';
import { workflowApi } from '@/api/workflow';
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { normalizeWorkflowStepActionType } from '@/utils/permissions';
import {
  buildRankFilterOptions,
  recipientUserLabel,
  userMatchesRankFilter,
} from '@/utils/recipientPicker';
import type { DocumentWorkflowAction } from '@/types/document';

const ACTION_LABELS: Record<string, string> = {
  reject: 'Rejected',
  edit_forward: 'Note',
  approve_forward: 'Approved & forwarded',
  request_info: 'Requested more info',
  final_approve: 'Final approval',
  final_approval: 'Final approval',
  attach_send: 'Attached & sent',
  review_send: 'Reviewed & sent',
  approve_send: 'Approved & sent',
};

/** Shown in the thread even when `comment` is empty (workflow milestones). */
const ACTIONS_VISIBLE_WITHOUT_COMMENT = new Set(['final_approve', 'final_approval']);

const ACTION_TONE: Record<string, string> = {
  reject: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  request_info:
    'bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  approve_forward:
    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  final_approve:
    'bg-violet-50 text-violet-800 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:ring-violet-800',
  final_approval:
    'bg-violet-50 text-violet-800 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:ring-violet-800',
  edit_forward:
    'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
  attach_send:
    'bg-sky-50 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:ring-sky-800',
  review_send:
    'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-800',
  approve_send:
    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
};

/**
 * Direct-message action types — one must always be chosen before posting.
 * The backend whitelist (`ALLOWED_DM_FORWARD_ACTIONS` + `ALLOWED_DM_TERMINAL_ACTIONS`)
 * must stay in sync.
 *
 * `final_approval` is terminal: it closes the chain by flipping the document to
 * `approved`, so it does NOT require a next recipient.
 */
type DmForwardActionType =
  | 'attach_send'
  | 'review_send'
  | 'approve_send'
  | 'final_approval';

const FORWARD_ACTION_OPTIONS: { value: DmForwardActionType; label: string }[] = [
  { value: 'attach_send', label: 'Attach and send' },
  { value: 'review_send', label: 'Review and send' },
  { value: 'approve_send', label: 'Approve and send' },
  { value: 'final_approval', label: 'Final approval (close & approve)' },
];

const DM_TERMINAL_ACTIONS: ReadonlySet<DmForwardActionType> = new Set(['final_approval']);

function actorDisplay(a: DocumentWorkflowAction): string {
  return a.actor_full_name?.trim() || a.actor_username?.trim() || resolveUsername(a.actor_id);
}

function resolveActorTitle(a: DocumentWorkflowAction): string {
  const rank = a.actor_rank?.trim();
  if (rank) return rank;
  const roleDesc = a.actor_role_description?.trim();
  if (roleDesc) return roleDesc;
  const roleName = a.actor_role_name?.trim();
  if (roleName) return roleName.replace(/_/g, ' ');
  return '';
}

function actorContext(a: DocumentWorkflowAction): string {
  const parts: string[] = [];
  const title = resolveActorTitle(a);
  if (title) parts.push(title);
  if (a.actor_department?.trim()) parts.push(a.actor_department.trim());
  if (a.actor_zone?.trim()) parts.push(a.actor_zone.trim());
  else if (a.actor_state?.trim()) parts.push(a.actor_state.trim());
  return parts.join(' · ');
}

interface Props {
  documentId: string;
  /**
   * @deprecated Forwarding intentionally allows re-sending the doc to existing
   * recipients (so the chain can cycle). This prop is no longer used by the
   * picker but is kept for backward-compatible callers.
   */
  currentUserIds?: string[];
  actions: DocumentWorkflowAction[] | undefined;
  actionsLoading: boolean;
  canComment: boolean;
  isDirectMessage?: boolean;
  isWorkflow?: boolean;
  workflowInstanceId?: string | null;
  canAdvanceWorkflow?: boolean;
  workflowStepActionType?: string | null;
  /** Excludes the current user from the next-recipient picker. */
  ownUserId?: string | null;
}

export function DocumentCommentsSection({
  documentId,
  actions,
  actionsLoading,
  canComment,
  isDirectMessage = false,
  isWorkflow = false,
  workflowInstanceId = null,
  canAdvanceWorkflow = false,
  workflowStepActionType = null,
  ownUserId = null,
}: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [actionType, setActionType] = useState<DmForwardActionType | ''>('');
  const [nextUserRank, setNextUserRank] = useState('');
  const [nextUserId, setNextUserId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isTerminalAction =
    isDirectMessage && actionType !== '' && DM_TERMINAL_ACTIONS.has(actionType);
  const isForward = isDirectMessage && actionType !== '' && !isTerminalAction;
  const normalizedWorkflowAction = normalizeWorkflowStepActionType(workflowStepActionType);
  const canSubmitWorkflowAction =
    isWorkflow && !!workflowInstanceId && canAdvanceWorkflow && !isDirectMessage;
  const workflowSubmitLabel =
    normalizedWorkflowAction === 'final_approve'
      ? 'Comment & final approve'
      : normalizedWorkflowAction === 'approve' || normalizedWorkflowAction === 'approve_forward'
        ? 'Comment & approve'
        : normalizedWorkflowAction === 'review'
          ? 'Comment & forward'
          : 'Comment & workflow action';
  const workflowComposerTitle =
    normalizedWorkflowAction === 'final_approve'
      ? 'Your comment will be saved and the document will receive final workflow approval.'
      : normalizedWorkflowAction === 'approve' || normalizedWorkflowAction === 'approve_forward'
        ? 'Your comment will be saved and this workflow step will be approved.'
        : normalizedWorkflowAction === 'review'
          ? 'Your comment will be saved and the workflow will move to the next step.'
          : 'Your comment will be saved and the current workflow step will be completed.';

  const comments = useMemo(
    () =>
      (actions ?? []).filter((a) => {
        const hasComment = (a.comment ?? '').trim().length > 0;
        if (hasComment) return true;
        return ACTIONS_VISIBLE_WITHOUT_COMMENT.has(a.action);
      }),
    [actions]
  );

  const sortedComments = useMemo(
    () =>
      [...comments].sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        return tb - ta;
      }),
    [comments]
  );

  /**
   * Same auth queries the create-document page uses — keeps the directory and
   * role catalogue consistent across both flows (so admins see the same users
   * and rank options here as they do when composing a brand-new document).
   */
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['auth-users-create-doc'],
    queryFn: () => authApi.listUsers(),
    enabled: canComment && isDirectMessage,
  });
  const { data: roles } = useQuery({
    queryKey: ['auth-roles-create-doc'],
    queryFn: () => authApi.listRoles(),
    enabled: canComment && isDirectMessage,
  });

  /**
   * Only exclude the current user (you can't forward to yourself). Previous
   * recipients remain selectable so the chain can cycle — e.g. the original
   * sender can be sent the doc again, or a prior reviewer can be looped in
   * for a second comment.
   */
  const nextUserCandidates = useMemo(() => {
    if (!users?.length) return [];
    if (!ownUserId) return users;
    return users.filter((u) => u.id !== ownUserId);
    // currentUserIds is intentionally not used here: a user can be sent the
    // doc twice and post multiple comments across the chain.
  }, [users, ownUserId]);

  /** Rank / role options derived from the available candidates (same rules as create page). */
  const rankFilterOptions = useMemo(
    () => buildRankFilterOptions(nextUserCandidates, roles),
    [nextUserCandidates, roles]
  );

  /**
   * Mirror the create page: when forwarding, a rank/role must be chosen before the
   * recipient list is unlocked.
   */
  const filteredNextUserCandidates = useMemo(() => {
    if (!nextUserRank.trim()) return [];
    return nextUserCandidates
      .filter((u) => userMatchesRankFilter(u, nextUserRank, roles))
      .sort((a, b) =>
        recipientUserLabel(a, roles).localeCompare(recipientUserLabel(b, roles), undefined, {
          sensitivity: 'base',
        })
      );
  }, [nextUserCandidates, nextUserRank, roles]);

  const resetComposer = () => {
    setDraft('');
    setActionType('');
    setNextUserRank('');
    setNextUserId('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitMutation = useMutation({
    mutationFn: async (input: {
      text: string;
      actionType: DmForwardActionType | '';
      nextUserId: string;
      file: File | null;
    }) => {
      if (input.file) {
        await documentsApi.uploadAttachment(documentId, input.file);
      }
      if (canSubmitWorkflowAction) {
        const note = input.text || undefined;
        if (normalizedWorkflowAction === 'final_approve') {
          await documentsApi.finalApprove(documentId, note);
          return workflowApi.advance(workflowInstanceId, undefined);
        }
        if (normalizedWorkflowAction === 'approve' || normalizedWorkflowAction === 'approve_forward') {
          await documentsApi.approveForward(documentId, note);
          return workflowApi.advance(workflowInstanceId, undefined);
        }
        await documentsApi.editForward(documentId, note);
        return workflowApi.advance(workflowInstanceId, note);
      }
      const dmForward =
        input.actionType === 'attach_send' ||
        input.actionType === 'review_send' ||
        input.actionType === 'approve_send';
      return documentsApi.editForward(
        documentId,
        input.text || undefined,
        input.actionType || undefined,
        dmForward ? input.nextUserId : undefined
      );
    },
    onSuccess: () => {
      toast.success(
        canSubmitWorkflowAction
          ? 'Comment saved and workflow advanced'
          : isTerminalAction
            ? 'Document approved'
            : isForward
              ? 'Sent to next recipient'
              : 'Comment posted'
      );
      resetComposer();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentWorkflowActions(documentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentAttachments(documentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentRecipients(documentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(documentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workflowInstanceByDocument(documentId) });
      if (workflowInstanceId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workflowSteps(workflowInstanceId) });
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === 'workflow-bpmn-view' &&
            q.queryKey[1] === workflowInstanceId,
        });
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const trimmed = draft.trim();
  /** Non-DM / workflow: need a comment or attachment. DM: forward may be comment/file-less; terminal never requires body. */
  const hasSubstance = trimmed.length > 0 || !!selectedFile;
  const dmActionChosen = !isDirectMessage || actionType !== '';
  const dmForwardReady =
    !isDirectMessage || !isForward || nextUserId.trim().length > 0;
  const dmSubstanceOrForwardOk =
    !isDirectMessage || isTerminalAction || hasSubstance || isForward;

  const allowSubmitContent = (() => {
    if (isDirectMessage) {
      return (
        dmActionChosen &&
        dmForwardReady &&
        (isTerminalAction || hasSubstance || isForward)
      );
    }
    if (canSubmitWorkflowAction) {
      if (normalizedWorkflowAction === 'final_approve') return true;
      return hasSubstance;
    }
    return hasSubstance;
  })();

  const canPost = canComment && allowSubmitContent && !submitMutation.isPending;

  return (
    <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-comments">
      <div className="flex items-center justify-between gap-3">
          <h3
          id="section-comments"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comments and activity {sortedComments.length > 0 ? `(${sortedComments.length})` : ''}
        </h3>
      </div>

      {canComment && (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
          {canSubmitWorkflowAction && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-xs font-medium text-primary">{workflowSubmitLabel}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{workflowComposerTitle}</p>
            </div>
          )}

          {isDirectMessage && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Action type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={actionType || undefined}
                  onValueChange={(v) => {
                    setActionType(v as DmForwardActionType);
                  }}
                  disabled={submitMutation.isPending}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select action type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORWARD_ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isTerminalAction && (
                <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-800/60 dark:bg-violet-900/20">
                  <p className="text-xs font-medium text-violet-800 dark:text-violet-300">
                    Final approval closes this chain
                  </p>
                  <p className="mt-1 text-[11px] text-violet-700/80 dark:text-violet-300/80">
                    The document will be marked <span className="font-medium">approved</span> and no
                    further recipients can act on it. No next recipient is needed.
                  </p>
                </div>
              )}

              {isForward && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Rank / role <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={nextUserRank?.trim() || '__none__'}
                      onValueChange={(v) => {
                        const next = v === '__none__' ? '' : v;
                        setNextUserRank(next);
                        setNextUserId('');
                      }}
                      disabled={submitMutation.isPending || usersLoading}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select rank / role first" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select rank / role…</SelectItem>
                        {rankFilterOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!rankFilterOptions.length && nextUserCandidates.length > 0 && !usersLoading && (
                      <p className="text-[11px] text-muted-foreground">
                        No rank or role could be derived for directory users. Ask an admin to set rank
                        or roles on user profiles.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Recipient <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={nextUserId || '__none__'}
                      onValueChange={(v) => setNextUserId(v === '__none__' ? '' : v)}
                      disabled={submitMutation.isPending || usersLoading || !nextUserRank.trim()}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue
                          placeholder={
                            usersLoading
                              ? 'Loading users…'
                              : !nextUserRank.trim()
                                ? 'Choose rank / role first'
                                : 'Select user (rank & department)'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__none__">Select user</SelectItem>
                        {filteredNextUserCandidates.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {recipientUserLabel(u, roles)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!!nextUserRank.trim() && !filteredNextUserCandidates.length && !usersLoading && (
                      <p className="text-[11px] text-muted-foreground">
                        No users with this rank in the directory.
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      They'll be added as a recipient and can comment or forward again.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <Textarea
            placeholder={
              isTerminalAction
                ? 'Add a closing note (optional)…'
                : isForward
                  ? 'Add a note for the next recipient (optional)…'
                  : isDirectMessage
                    ? 'Choose an action type above, then add a note or attachment if you wish…'
                    : canSubmitWorkflowAction
                      ? 'Write your comment before completing this workflow step…'
                      : 'Add a comment for the next approver / sender…'
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[80px] bg-background"
            disabled={submitMutation.isPending}
          />

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                disabled={submitMutation.isPending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitMutation.isPending}
              >
                <Upload className="h-3.5 w-3.5" />
                Attach file
              </Button>
              {selectedFile && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[220px]" title={selectedFile.name}>
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>

            <Button
              size="sm"
              disabled={!canPost}
              loading={submitMutation.isPending}
              onClick={() => {
                if (!canPost) return;
                submitMutation.mutate({
                  text: trimmed,
                  actionType,
                  nextUserId,
                  file: selectedFile,
                });
              }}
            >
              <Send className="h-3.5 w-3.5" />
              {canSubmitWorkflowAction
                ? workflowSubmitLabel
                : isDirectMessage && !actionType
                  ? 'Select action type'
                  : isTerminalAction
                    ? 'Final approve'
                    : isForward
                      ? 'Send'
                      : 'Post comment'}
            </Button>
          </div>

          {isDirectMessage && !actionType && (
            <p className="text-xs text-destructive">Select an action type to continue.</p>
          )}
          {isForward && nextUserId === '' && (
            <p className="text-xs text-destructive">Pick the next user to forward to.</p>
          )}
        </div>
      )}

      {actionsLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : sortedComments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-2">
          No comments yet.
          {canComment ? ' Be the first to add one.' : ''}
        </p>
      ) : (
        <ul className="space-y-3">
          {sortedComments.map((c) => {
            const initials = (actorDisplay(c) || '?').slice(0, 2).toUpperCase();
            const label = ACTION_LABELS[c.action] ?? c.action.replace(/_/g, ' ');
            const tone = ACTION_TONE[c.action] ?? 'bg-muted text-muted-foreground';
            return (
              <li
                key={c.id}
                className="flex gap-3 rounded-lg border border-border/60 bg-background p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {initials}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-semibold text-foreground capitalize">{actorDisplay(c)}</span>
                    {actorContext(c) && (
                      <span className="text-muted-foreground">· {actorContext(c)}</span>
                    )}
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${tone}`}>
                      {label}
                    </span>
                    <span
                      className="ml-auto text-muted-foreground tabular-nums"
                      title={formatDateTime(c.created_at)}
                    >
                      {formatRelative(c.created_at)}
                    </span>
                  </div>
                  {(c.comment ?? '').trim() ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {c.comment}
                    </p>
                  ) : ACTIONS_VISIBLE_WITHOUT_COMMENT.has(c.action) ? (
                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                      No written comment — signature and filing are on the document.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
