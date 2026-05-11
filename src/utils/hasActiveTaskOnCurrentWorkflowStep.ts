import type { Task } from '@/types/task';
import type { WorkflowInstance } from '@/types/workflow';

/**
 * True when the user has a pending or in-progress task on this document for the
 * given workflow instance's current step (it is their turn in the chain).
 */
export function hasActiveTaskOnCurrentWorkflowStep(
  tasks: Task[] | undefined,
  documentId: string,
  instance: Pick<WorkflowInstance, 'id' | 'current_step'> | null | undefined
): boolean {
  if (!tasks?.length || !instance?.id) return false;
  const step = Number(instance.current_step ?? 0);
  if (!Number.isFinite(step)) return false;

  return tasks.some((t) => {
    if (t.document_id !== documentId) return false;
    if (t.workflow_instance_id !== instance.id) return false;
    if (Number(t.step_number) !== step) return false;
    return t.status === 'pending' || t.status === 'in_progress';
  });
}
