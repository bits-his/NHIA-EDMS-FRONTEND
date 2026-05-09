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
import { getDocumentActions } from '@/utils/permissions';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import type { Document } from '@/types/document';

interface DocumentActionsProps {
  document: Document;
  roles: string[];
}

type ConfirmActionType = 'submit' | 'archive';

type CommentDialogKind =
  | 'reject'
  | 'requestInfo'
  | 'editForward'
  | 'approveForward'
  | 'finalApprove';

export function DocumentActions({ document, roles }: DocumentActionsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmActionType | null>(null);
  const [commentDialog, setCommentDialog] = useState<CommentDialogKind | null>(null);
  const [comment, setComment] = useState('');

  const actions = getDocumentActions(document.status, roles);

  const invalidateDoc = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(document.id) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentRecipients(document.id) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentAttachments(document.id) });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.allDocuments] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orchestratorStatus(document.id) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentWorkflowActions(document.id) });
  };

  const mutation = useMutation({
    mutationFn: async (payload: { fn: () => Promise<Document>; message: string }) => {
      await payload.fn();
      return payload.message;
    },
    onSuccess: (message) => {
      toast.success(message);
      invalidateDoc();
      setPendingConfirm(null);
      setCommentDialog(null);
      setComment('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
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
          fn: () => documentsApi.reject(document.id, c),
          message: 'Document rejected',
        });
        break;
      case 'requestInfo':
        mutation.mutate({
          fn: () => documentsApi.requestInfo(document.id, c),
          message: 'Information request recorded',
        });
        break;
      case 'editForward':
        mutation.mutate({
          fn: () => documentsApi.editForward(document.id, c || undefined),
          message: 'Edit-forward recorded',
        });
        break;
      case 'approveForward':
        mutation.mutate({
          fn: () => documentsApi.approveForward(document.id, c || undefined),
          message: 'Approve-forward recorded',
        });
        break;
      case 'finalApprove':
        mutation.mutate({
          fn: () => documentsApi.finalApprove(document.id, c || undefined),
          message: 'Document approved',
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
      description: 'Provide a reason for rejection. The document will move to rejected status.',
      placeholder: 'Rejection reason…',
    },
    requestInfo: {
      title: 'Request more information',
      description: 'Explain what additional information is needed. Status stays pending.',
      placeholder: 'What information is needed…',
    },
    editForward: {
      title: 'Edit forward',
      description: 'Record an edit-forward step (optional note). Status unchanged unless moving via workflow separately.',
      placeholder: 'Optional note…',
    },
    approveForward: {
      title: 'Approve forward',
      description: 'Record approval to forward along the chain (optional note). Status stays pending until final approval.',
      placeholder: 'Optional note…',
    },
    finalApprove: {
      title: 'Final approval',
      description:
        'Official approval with signature eligibility checked on the server (active signatory required). Optional note.',
      placeholder: 'Optional note…',
    },
  };

  const anyWorkflowButton =
    actions.canSubmit ||
    actions.canFinalApprove ||
    actions.canReject ||
    actions.canArchive ||
    actions.canEditForward ||
    actions.canApproveForward ||
    actions.canRequestInfo;

  if (!anyWorkflowButton && !actions.canEdit) return null;

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
        {actions.canEditForward && (
          <Button variant="outline" size="sm" onClick={() => openCommentDialog('editForward')}>
            <Forward className="h-4 w-4" />
            Edit forward
          </Button>
        )}
        {actions.canApproveForward && (
          <Button variant="outline" size="sm" onClick={() => openCommentDialog('approveForward')}>
            <Forward className="h-4 w-4 rotate-[-45deg]" />
            Approve forward
          </Button>
        )}
        {actions.canRequestInfo && (
          <Button variant="outline" size="sm" onClick={() => openCommentDialog('requestInfo')}>
            <Info className="h-4 w-4" />
            Request info
          </Button>
        )}
        {actions.canReject && (
          <Button variant="destructive" size="sm" onClick={() => openCommentDialog('reject')}>
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        )}
        {actions.canFinalApprove && (
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
          title="Submit document"
          description="This submits the document for review. You will not be able to edit content until it is rejected back to draft."
          confirmLabel="Submit"
          variant="default"
          onConfirm={() =>
            mutation.mutate({
              fn: () => documentsApi.submit(document.id),
              message: 'Document submitted for review',
            })
          }
          loading={mutation.isPending}
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
              loading={mutation.isPending}
              variant={commentDialog === 'reject' ? 'destructive' : 'default'}
              disabled={commentRequired && !comment.trim()}
            >
              {commentDialog === 'finalApprove' ? (
                <>
                  <CheckCircle className="h-4 w-4" /> Approve
                </>
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
