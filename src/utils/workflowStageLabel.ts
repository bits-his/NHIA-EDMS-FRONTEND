import type { WorkflowInstance, WorkflowTemplateSummary } from '@/types/workflow';

const ACTIVE_INSTANCE = new Set(['active', 'in_progress', 'pending_approval', 'pending_review']);

function stepNumberAtIndex(s: WorkflowTemplateSummary['steps'][0], index: number): number {
  const raw = s.step_number ?? ('step' in s ? (s as { step?: number }).step : undefined);
  const n = Number(raw ?? index + 1);
  return Number.isFinite(n) && n > 0 ? n : index + 1;
}

/** Label for a **pending** document: `Awaiting {current step name}` (or `Awaiting final approval` after the workflow completes). */
export function getPendingDocumentWorkflowStageLabel(
  wf: WorkflowInstance | null | undefined,
  template: WorkflowTemplateSummary | null | undefined
): string | null {
  if (!wf || !template?.steps?.length) return null;

  if (wf.status === 'completed') {
    return 'Awaiting final approval';
  }

  if (!ACTIVE_INSTANCE.has(String(wf.status))) return null;

  const normalized = template.steps.map((s, idx) => ({
    step_number: stepNumberAtIndex(s, idx),
    name: String(s.name ?? `Step ${idx + 1}`).trim(),
  }));
  const cur = wf.current_step ?? 1;
  const def = normalized.find((s) => s.step_number === cur);
  const stepName = def?.name || `Step ${cur}`;
  return `Awaiting ${stepName}`;
}
