import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, CheckCircle, XCircle, Archive, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { documentsApi } from '@/api/documents';
import { getDocumentActions } from '@/utils/permissions';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import type { Document } from '@/types/document';

interface DocumentActionsProps {
  document: Document;
  roles: string[];
}

type ActionType = 'submit' | 'approve' | 'reject' | 'archive';

const ACTION_CONFIG: Record<
  ActionType,
  { label: string; icon: React.ElementType; variant: 'default' | 'success' | 'destructive' | 'warning'; confirm: { title: string; description: string; confirmLabel: string; variant: 'default' | 'destructive' } }
> = {
  submit: {
    label: 'Submit for Review',
    icon: Send,
    variant: 'default',
    confirm: {
      title: 'Submit Document',
      description: 'This will submit the document for review. You will not be able to edit it until it is rejected.',
      confirmLabel: 'Submit',
      variant: 'default',
    },
  },
  approve: {
    label: 'Approve',
    icon: CheckCircle,
    variant: 'success',
    confirm: {
      title: 'Approve Document',
      description: 'This will approve the document and mark it as officially approved.',
      confirmLabel: 'Approve',
      variant: 'default',
    },
  },
  reject: {
    label: 'Reject',
    icon: XCircle,
    variant: 'destructive',
    confirm: {
      title: 'Reject Document',
      description: 'This will reject the document and return it to draft status.',
      confirmLabel: 'Reject',
      variant: 'destructive',
    },
  },
  archive: {
    label: 'Archive',
    icon: Archive,
    variant: 'warning',
    confirm: {
      title: 'Archive Document',
      description: 'This will archive the document. It will no longer be editable.',
      confirmLabel: 'Archive',
      variant: 'default',
    },
  },
};

export function DocumentActions({ document, roles }: DocumentActionsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);

  const actions = getDocumentActions(document.status, roles);

  const mutation = useMutation({
    mutationFn: async (action: ActionType) => {
      switch (action) {
        case 'submit': return documentsApi.submit(document.id);
        case 'approve': return documentsApi.approve(document.id);
        case 'reject': return documentsApi.reject(document.id);
        case 'archive': return documentsApi.archive(document.id);
      }
    },
    onSuccess: (_, action) => {
      toast.success(`Document ${action}ed successfully`);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(document.id) });
      setPendingAction(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      setPendingAction(null);
    },
  });

  const availableActions: ActionType[] = [];
  if (actions.canSubmit) availableActions.push('submit');
  if (actions.canApprove) availableActions.push('approve');
  if (actions.canReject) availableActions.push('reject');
  if (actions.canArchive) availableActions.push('archive');

  if (availableActions.length === 0 && !actions.canEdit) return null;

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
        {availableActions.map((action) => {
          const config = ACTION_CONFIG[action];
          const Icon = config.icon;
          return (
            <Button
              key={action}
              variant={config.variant as 'default' | 'destructive' | 'outline'}
              size="sm"
              onClick={() => setPendingAction(action)}
            >
              <Icon className="h-4 w-4" />
              {config.label}
            </Button>
          );
        })}
      </div>

      {pendingAction && (
        <ConfirmDialog
          open={!!pendingAction}
          onOpenChange={(open) => !open && setPendingAction(null)}
          title={ACTION_CONFIG[pendingAction].confirm.title}
          description={ACTION_CONFIG[pendingAction].confirm.description}
          confirmLabel={ACTION_CONFIG[pendingAction].confirm.confirmLabel}
          variant={ACTION_CONFIG[pendingAction].confirm.variant}
          onConfirm={() => mutation.mutate(pendingAction)}
          loading={mutation.isPending}
        />
      )}
    </>
  );
}
