import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Send,
  CheckCircle,
  XCircle,
  Archive,
  Edit,
  Forward,
  MessageSquareWarning,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { documentsApi } from '@/api/documents';
import { workflowApi } from '@/api/workflow';
import {
  getDocumentActions,
  normalizeWorkflowStepActionType,
  type DocumentActionContext,
} from '@/utils/permissions';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import { startWorkflowFromDocumentTemplate } from '@/utils/startWorkflowFromDocumentTemplate';
import type { Document } from '@/types/document';
import { useAuthStore } from '@/stores/authStore';

interface DocumentActionsProps {
  document: Document;
  roles: string[];
  actionContext?: DocumentActionContext;
  /** Workflow instance when the viewer may act on an active linear route. */
  workflowInstanceId?: string | null;
  /** Whether the workflow may advance from the current step (including completing at the last step). */
  canAdvanceWorkflow?: boolean;
  /** Current linear workflow step (1-based); used to step back after reject / request-info. */
  workflowCurrentStep?: number | null;
  workflowStepActionType?: string | null;
  /** Hide workflow submit controls when the inline comment composer owns that action. */
  suppressWorkflowStepActions?: boolean;
}

type ConfirmActionType = 'submit' | 'archive';

type CommentDialogKind =
  | 'reject'
  | 'requestInfo'
  | 'approveForward'
  | 'finalApprove'
  | 'reviewForward'
  | 'directMessageComment';

export function DocumentActions({
  document,
  roles,
  actionContext,
  workflowInstanceId,
  canAdvanceWorkflow = false,
  workflowCurrentStep,
  workflowStepActionType,
  suppressWorkflowStepActions = false,
}: DocumentActionsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.user_id);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmActionType | null>(null);
  const [commentDialog, setCommentDialog] = useState<CommentDialogKind | null>(null);
  const [comment, setComment] = useState('');
  const [submitForReviewLoading, setSubmitForReviewLoading] = useState(false);

  const actions = getDocumentActions(document.status, roles, actionContext, workflowStepActionType);
  const at = normalizeWorkflowStepActionType(workflowStepActionType);

  const isDirectMessage = document.delivery_mode === 'direct_message';

  const showApproveAndForward =
    !suppressWorkflowStepActions &&
    !isDirectMessage &&
    actions.canApproveForward &&
    at !== 'review' &&
    at !== 'final_approve';

  const showReviewForward =
    !suppressWorkflowStepActions &&
    at === 'review' &&
    Boolean(workflowInstanceId) &&
    canAdvanceWorkflow &&
    (actions.canReject || actions.canRequestInfo);

  const invalidateDoc = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(document.id) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentRecipients(document.id) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentAttachments(document.id) });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.allDocuments] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orchestratorStatus(document.id) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentWorkflowActions(document.id) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workflowInstanceByDocument(document.id) });
    if (currentUserId) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks(currentUserId) });
    }
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'tasks',
    });
  };

  const invalidateAfterWorkflow = (workflowId: string) => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === 'workflow-bpmn-view' &&
        q.queryKey[1] === workflowId,
    });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workflowSteps(workflowId) });
  };

  const mutation = useMutation({
    mutationFn: async (payload: { fn: () => Promise<Document>; message: string }) => {
      await payload.fn();
      return payload.message;
    },
    onSuccess: (message) => {
      toast.success(message);
      invalidateDoc();
      if (workflowInstanceId) {
        invalidateAfterWorkflow(workflowInstanceId);
      }
      setPendingConfirm(null);
      setCommentDialog(null);
      setComment('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const approveAndForwardMutation = useMutation({
    mutationFn: async (commentText: string) => {
      const note = commentText.trim() || undefined;
      await documentsApi.approveForward(document.id, note);
      if (workflowInstanceId && canAdvanceWorkflow) {
        return workflowApi.advance(workflowInstanceId);
      }
      return null;
    },
    onSuccess: (data) => {
      if (data?.workflow) {
        if (data.workflow.status === 'completed') {
          toast.success('Approved and forwarded — workflow completed.');
        } else {
          toast.success('Approved forward; workflow moved to the next step.');
        }
        if (data.warnings?.length) {
          toast.warning('Some notifications or tasks could not be updated.');
        }
        invalidateAfterWorkflow(data.workflow.id);
      } else {
        toast.success('Approved and sent — your e-signature was appended to the memo.');
      }
      invalidateDoc();
      setCommentDialog(null);
      setComment('');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const reviewForwardMutation = useMutation({
    mutationFn: (commentText: string) => {
      if (!workflowInstanceId) throw new Error('No workflow instance');
      const note = commentText.trim() || undefined;
      return workflowApi.advance(workflowInstanceId, note);
    },
    onSuccess: (data) => {
      if (data.workflow.status === 'completed') {
        toast.success('Forwarded — workflow completed.');
      } else {
        toast.success('Forwarded to the next step');
      }
      if (data.warnings?.length) {
        toast.warning('Workflow moved, but some notifications or tasks could not be updated.');
      }
      invalidateDoc();
      invalidateAfterWorkflow(data.workflow.id);
      setCommentDialog(null);
      setComment('');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const finalApproveAndAdvanceMutation = useMutation({
    mutationFn: async (commentText: string) => {
      const note = commentText.trim() || undefined;
      await documentsApi.finalApprove(document.id, note);
      if (workflowInstanceId && canAdvanceWorkflow) {
        return workflowApi.advance(workflowInstanceId);
      }
      return null;
    },
    onSuccess: (data) => {
      if (data?.workflow) {
        if (data.workflow.status === 'completed') {
          toast.success(
            'Final approval recorded — process archived (read-only) and workflow completed.'
          );
        } else {
          toast.success('Process archived (read-only); workflow advanced.');
        }
        if (data.warnings?.length) {
          toast.warning('Some notifications or tasks could not be updated.');
        }
        invalidateAfterWorkflow(data.workflow.id);
      } else {
        toast.success('Process archived and is now read-only.');
      }
      invalidateDoc();
      setCommentDialog(null);
      setComment('');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openCommentDialog = (kind: CommentDialogKind) => {
    setComment('');
    setCommentDialog(kind);
  };

  const handleCommentConfirm = () => {
    if (!commentDialog) return;
    const c = comment.trim();

    if (commentDialog === 'reject' || commentDialog === 'requestInfo') {
      if (!c) {
        toast.error('A comment is required');
        return;
      }
    }

    switch (commentDialog) {
      case 'reject':
        mutation.mutate({
          fn: async () => {
            const updated = await documentsApi.reject(document.id, c);
            if (workflowInstanceId && (workflowCurrentStep ?? 0) > 1) {
              try {
                const res = await workflowApi.stepBack(workflowInstanceId, c);
                if (res?.workflow?.id) invalidateAfterWorkflow(res.workflow.id);
              } catch (e) {
                toast.warning(
                  `Document rejected, but the workflow could not move to the previous step: ${getErrorMessage(e)}`
                );
              }
            }
            return updated;
          },
          message: isDirectMessage
            ? 'Document returned to the sender'
            : (workflowCurrentStep ?? 0) > 1 && workflowInstanceId
              ? 'Document rejected — workflow returned to the previous step'
              : 'Document rejected',
        });
        break;
      case 'requestInfo':
        mutation.mutate({
          fn: () => documentsApi.requestInfo(document.id, c),
          message: isDirectMessage
            ? 'Information request sent — document returned to the sender'
            : (workflowCurrentStep ?? 0) > 1
              ? 'Information request recorded — workflow returned to the previous step'
              : 'Information request recorded',
        });
        break;
      case 'approveForward':
        approveAndForwardMutation.mutate(c);
        break;
      case 'finalApprove':
        finalApproveAndAdvanceMutation.mutate(c);
        break;
      case 'reviewForward':
        reviewForwardMutation.mutate(c);
        break;
      case 'directMessageComment':
        mutation.mutate({
          fn: () => documentsApi.editForward(document.id, c.trim() || undefined),
          message: c.trim() ? 'Comment added' : 'Comment recorded',
        });
        break;
      default:
        break;
    }
  };

  const commentRequired = commentDialog === 'reject' || commentDialog === 'requestInfo';

  const dialogCopy: Record<
    CommentDialogKind,
    { title: string; description: string; placeholder: string }
  > = {
    reject: {
      title: 'Reject document',
      description: isDirectMessage
        ? 'Provide a reason. The document will be sent back to whoever forwarded it to you so they can revise and resend.'
        : 'Provide a reason for rejection. The document will move to rejected status. When this memo has an active workflow beyond step 1, the workflow also moves back one step so the previous participant is notified.',
      placeholder: 'Rejection reason…',
    },
    requestInfo: {
      title: 'Request more information',
      description: isDirectMessage
        ? 'Explain what you need. The document will be sent back to whoever forwarded it to you so they can respond.'
        : 'Explain what additional information is needed. The workflow returns to the previous step so that person can update the memo and send it forward again (Approve and send or Forward).',
      placeholder: 'What information is needed…',
    },
    approveForward: {
      title: 'Approve and send',
      description:
        'Records approval, appends your e-signature to the memo (set up under Settings → E-signature), and sends the process to the next step when a workflow applies. Optional note.',
      placeholder: 'Optional note…',
    },
    finalApprove: {
      title: 'Final approval',
      description:
        'Final approval closes this chain. The process will become read-only and archived, and no further recipients can act on it. Your e-signature is appended when configured in Settings. Optional note is stored on the action record.',
      placeholder: 'Optional note…',
    },
    reviewForward: {
      title: 'Forward',
      description:
        'Move this case to the next role in the workflow chain. Optional note is stored on the workflow advance record.',
      placeholder: 'Optional note…',
    },
    directMessageComment: {
      title: 'Add comment',
      description:
        'Adds an entry to the document activity timeline. Optional for short notes; use Request info when you need a formal response from the sender.',
      placeholder: 'Your comment…',
    },
  };

  const anyPrimaryButton =
    actions.canSubmit ||
    (!suppressWorkflowStepActions && actions.canFinalApprove) ||
    actions.canReject ||
    actions.canArchive ||
    showApproveAndForward ||
    showReviewForward ||
    (!isDirectMessage && actions.canRequestInfo) ||
    (!isDirectMessage && !suppressWorkflowStepActions && actions.canEditForward);

  if (!anyPrimaryButton && !actions.canEdit) return null;

  const dialogLoading =
    commentDialog === 'approveForward'
      ? approveAndForwardMutation.isPending
      : commentDialog === 'finalApprove'
        ? finalApproveAndAdvanceMutation.isPending
        : commentDialog === 'reviewForward'
          ? reviewForwardMutation.isPending
          : mutation.isPending;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {actions.canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/documents/${document.id}/edit`)}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        )}
        {actions.canSubmit && (
          <Button variant="default" size="sm" onClick={() => setPendingConfirm('submit')}>
            <Send className="h-4 w-4" />
            Submit for review
          </Button>
        )}
        {showReviewForward && (
          <Button variant="default" size="sm" onClick={() => openCommentDialog('reviewForward')}>
            <Forward className="h-4 w-4" />
            Forward
          </Button>
        )}
        {showApproveAndForward && (
          <Button variant="default" size="sm" onClick={() => openCommentDialog('approveForward')}>
            <Forward className="h-4 w-4 rotate-[-45deg]" />
            Approve and send
          </Button>
        )}
        {!isDirectMessage && actions.canRequestInfo && (
          <Button variant="outline" size="sm" onClick={() => openCommentDialog('requestInfo')}>
            <Info className="h-4 w-4" />
            Request info
          </Button>
        )}
        {!isDirectMessage && !suppressWorkflowStepActions && actions.canEditForward && (
          <Button variant="outline" size="sm" onClick={() => openCommentDialog('directMessageComment')}>
            <MessageSquareWarning className="h-4 w-4" />
            Add comment
          </Button>
        )}
        {actions.canReject && (
          <Button variant="destructive" size="sm" onClick={() => openCommentDialog('reject')}>
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        )}
        {!isDirectMessage && !suppressWorkflowStepActions && actions.canFinalApprove && (
          <Button variant="default" size="sm" onClick={() => openCommentDialog('finalApprove')}>
            <ShieldCheck className="h-4 w-4" />
            Final approve
          </Button>
        )}
        {actions.canArchive && (
          <Button variant="outline" size="sm" onClick={() => setPendingConfirm('archive')}>
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        )}
      </div>

      {pendingConfirm === 'submit' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingConfirm(null)}
          title="Submit for review"
          description="This starts the review process. If a workflow was chosen when the case was created, or if the catalogue template assigns one, that workflow runs now (once). You will not be able to edit content until it is returned to draft."
          confirmLabel="Submit"
          variant="default"
          onConfirm={async () => {
            setSubmitForReviewLoading(true);
            try {
              await documentsApi.submit(document.id);
              const wf = await startWorkflowFromDocumentTemplate(
                document.id,
                document.template_id,
                document.selected_workflow_template_id
              );
              if (wf.error) {
                toast.error(
                  `Document submitted for review, but the workflow did not start: ${wf.error}`
                );
              } else if (wf.started) {
                toast.success('Document submitted for review and workflow started');
              } else {
                toast.success('Document submitted for review');
              }
              invalidateDoc();
              setPendingConfirm(null);
            } catch (error) {
              toast.error(getErrorMessage(error));
            } finally {
              setSubmitForReviewLoading(false);
            }
          }}
          loading={submitForReviewLoading || mutation.isPending}
        />
      )}

      {pendingConfirm === 'archive' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingConfirm(null)}
          title="Archive document"
          description="Archive this approved document. It will no longer appear in active lists."
          confirmLabel="Archive"
          variant="default"
          onConfirm={() =>
            mutation.mutate({
              fn: () => documentsApi.archive(document.id),
              message: 'Document archived',
            })
          }
          loading={mutation.isPending}
        />
      )}

      <Dialog open={!!commentDialog} onOpenChange={(o) => !o && setCommentDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-muted-foreground" />
              {commentDialog ? dialogCopy[commentDialog].title : ''}
            </DialogTitle>
            <DialogDescription>{commentDialog ? dialogCopy[commentDialog].description : ''}</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={commentDialog ? dialogCopy[commentDialog].placeholder : ''}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCommentDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCommentConfirm}
              loading={dialogLoading}
              variant={commentDialog === 'reject' ? 'destructive' : 'default'}
              disabled={commentRequired && !comment.trim()}
            >
              {commentDialog === 'finalApprove' ? (
                <>
                  <CheckCircle className="h-4 w-4" /> Final approve
                </>
              ) : commentDialog === 'approveForward' ? (
                'Approve and send'
              ) : commentDialog === 'reviewForward' ? (
                'Forward'
              ) : commentDialog === 'directMessageComment' ? (
                'Post comment'
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
