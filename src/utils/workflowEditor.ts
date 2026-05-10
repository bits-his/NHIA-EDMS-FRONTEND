/**
 * NHIA grade ladder role keys — must match workflow_templates.steps.assignee_role values seeded on the backend.
 */
export const WORKFLOW_ASSIGNEE_ROLES = [
  { value: 'officer', label: 'Officer' },
  { value: 'senior_officer', label: 'Senior Officer' },
  { value: 'assistant_manager', label: 'Assistant Manager' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior_manager', label: 'Senior Manager' },
  { value: 'principal_manager', label: 'Principal Manager' },
  { value: 'assistant_general_manager', label: 'Assistant General Manager' },
  { value: 'deputy_general_manager', label: 'Deputy General Manager' },
  { value: 'general_manager', label: 'General Manager' },
  { value: 'executive_secretary', label: 'Executive Secretary' },
] as const;

/** Common linear workflow action_type values (stored as free string on backend). */
export const WORKFLOW_ACTION_TYPES = [
  { value: 'review', label: 'Review' },
  { value: 'approve', label: 'Approve' },
  { value: 'approve_forward', label: 'Approve forward' },
  { value: 'final_approve', label: 'Final approve' },
  { value: 'prepare', label: 'Prepare' },
  { value: 'notify', label: 'Notify' },
] as const;

export function defaultCustomWorkflowSteps(): Array<{
  step_number: number;
  name: string;
  assignee_role: string;
  action_type: string;
}> {
  return [
    {
      step_number: 1,
      name: 'Department review',
      assignee_role: 'senior_officer',
      action_type: 'review',
    },
    {
      step_number: 2,
      name: 'Director approval',
      assignee_role: 'manager',
      action_type: 'final_approve',
    },
  ];
}

/** Normalize API template steps into editor drafts (sorted by step_number). */
export function templateStepsToDraft(
  steps: Array<{
    step_number?: number;
    step?: number;
    name: string;
    assignee_role: string;
    action_type?: string;
  }>
): Array<{ name: string; assignee_role: string; action_type: string }> {
  if (!Array.isArray(steps) || steps.length === 0) {
    return defaultCustomWorkflowSteps().map(({ name, assignee_role, action_type }) => ({
      name,
      assignee_role,
      action_type,
    }));
  }
  const withOrder = steps.map((s, idx) => ({
    name: s.name,
    assignee_role: s.assignee_role,
    action_type: s.action_type || 'approve',
    order: Number(s.step_number ?? s.step ?? idx + 1),
  }));
  withOrder.sort((a, b) => a.order - b.order);
  return withOrder.map(({ name, assignee_role, action_type }) => ({
    name,
    assignee_role,
    action_type,
  }));
}
