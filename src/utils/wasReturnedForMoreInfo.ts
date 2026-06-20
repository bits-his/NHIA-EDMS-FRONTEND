import type { DocumentWorkflowAction } from '@/types/document';
import type { Task } from '@/types/task';
import type { WorkflowInstance } from '@/types/workflow';

/** Actions that mean the chain moved forward again after a request-info return. */
const FORWARD_PROGRESS_AFTER_RETURN = new Set([
  'approve_forward',
  'approve_send',
  'final_approve',
  'final_approval',
  'approve',
  'edit_forward',
  'review_forward',
  'attach_send',
  'review_send',
]);

/** Actions that mean someone sent the document back to the prior holder. */
const RETURN_TO_SENDER_ACTIONS = new Set(['request_info', 'reverse']);

/**
 * True when this user was sent back after someone requested more information or reversed the baton:
 * a recent return action by another actor, and no forward progress since then.
 */
export function wasReturnedForMoreInfo(params: {
  workflowActions: DocumentWorkflowAction[] | undefined;
  tasks: Task[] | undefined;
  documentId: string;
  currentUserId: string | undefined;
  workflowInstance: Pick<WorkflowInstance, 'id' | 'current_step'> | null | undefined;
  /** Direct message: true when the viewer is the current (latest) recipient. */
  isDirectMessageRecipient?: boolean;
}): boolean {
  const {
    workflowActions,
    tasks,
    documentId,
    currentUserId,
    workflowInstance,
    isDirectMessageRecipient,
  } = params;
  if (!documentId || !currentUserId) return false;

  const latestReturnToSender = [...(workflowActions ?? [])]
    .filter((a) => RETURN_TO_SENDER_ACTIONS.has(a.action))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  if (!latestReturnToSender) return false;
  if (latestReturnToSender.actor_id === currentUserId) return false;

  const returnAt = new Date(latestReturnToSender.created_at).getTime();
  if (!Number.isFinite(returnAt)) return false;

  const progressedAfterReturn = (workflowActions ?? []).some(
    (a) =>
      new Date(a.created_at).getTime() > returnAt &&
      FORWARD_PROGRESS_AFTER_RETURN.has(String(a.action))
  );
  if (progressedAfterReturn) return false;

  if (isDirectMessageRecipient) {
    return true;
  }

  if (!workflowInstance?.id) return false;

  const step = Number(workflowInstance.current_step ?? 0);
  const myCurrentTask = (tasks ?? []).find(
    (t) =>
      t.document_id === documentId &&
      t.workflow_instance_id === workflowInstance.id &&
      t.assignee_id === currentUserId &&
      Number(t.step_number) === step &&
      (t.status === 'pending' || t.status === 'in_progress')
  );
  if (!myCurrentTask) return false;

  const taskAt = new Date(myCurrentTask.created_at).getTime();
  if (!Number.isFinite(taskAt)) return false;

  return taskAt >= returnAt - 2000;
}
