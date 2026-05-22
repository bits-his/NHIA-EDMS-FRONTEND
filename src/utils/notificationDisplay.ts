/** Human-readable labels for notification `type` values shown in the UI. */
const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  'workflow.step_assigned': 'Workflow step',
  'workflow.step_returned': 'Workflow returned',
  'workflow.resumed': 'Workflow resumed',
};

/**
 * Prefer a friendly category label over raw dotted type codes (e.g. workflow › step_assigned).
 */
export function notificationTypeLabel(type: string | undefined): string | null {
  if (!type?.trim()) return null;
  const key = type.trim();
  if (NOTIFICATION_TYPE_LABELS[key]) return NOTIFICATION_TYPE_LABELS[key];
  return key.replace(/\./g, ' · ').replace(/_/g, ' ');
}
