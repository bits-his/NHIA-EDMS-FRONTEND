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
  { value: 'assistant_general_manager', label: 'Assistant Director' },
  { value: 'deputy_general_manager', label: 'Deputy Director' },
  { value: 'general_manager', label: 'Director' },
  { value: 'executive_secretary', label: 'Director General' },
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

/** Sentinel for “no specific user” in workflow step editor selects. */
export const WORKFLOW_USER_NONE = '__none__';

/** Sentinel for organisation-wide role match (no routing filter). */
export const WORKFLOW_ROUTING_ORG_WIDE = '__org_wide__';

/** Restrict assignee resolution to the document submitter’s org context (owner profile + document.department). */
export const WORKFLOW_ROUTING_SCOPES = [
  { value: WORKFLOW_ROUTING_ORG_WIDE, label: 'Organisation-wide (first matching role)' },
  { value: 'department', label: 'Same department as submitter' },
  { value: 'zone', label: 'Same zone as submitter' },
  { value: 'state_office', label: 'Same state office as submitter' },
  { value: 'unit', label: 'Same unit as submitter' },
  { value: 'directorate', label: 'Same directorate as submitter' },
  { value: 'hq', label: 'HQ / national (no location filter)' },
  { value: 'executive', label: 'Executive (no location filter)' },
  { value: 'inter_agency', label: 'Inter-agency (no location filter)' },
] as const;

export function defaultCustomWorkflowSteps(): Array<{
  step_number: number;
  name: string;
  assignee_role: string;
  action_type: string;
  routing_scope?: string;
  assignee_user_id?: string;
}> {
  return [
    {
      step_number: 1,
      name: 'Department review',
      assignee_role: 'senior_officer',
      action_type: 'review',
      routing_scope: 'department',
    },
    {
      step_number: 2,
      name: 'Director approval',
      assignee_role: 'manager',
      action_type: 'final_approve',
      routing_scope: WORKFLOW_ROUTING_ORG_WIDE,
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
    routing_scope?: string | null;
    assignee_scope?: string | null;
    assignee_user_id?: string | null;
  }>
): Array<{
  name: string;
  assignee_role: string;
  action_type: string;
  routing_scope: string;
  assignee_user_id: string;
}> {
  if (!Array.isArray(steps) || steps.length === 0) {
    return defaultCustomWorkflowSteps().map(
      ({ name, assignee_role, action_type, routing_scope, assignee_user_id }) => ({
        name,
        assignee_role,
        action_type,
        routing_scope: routing_scope === WORKFLOW_ROUTING_ORG_WIDE ? WORKFLOW_ROUTING_ORG_WIDE : routing_scope || WORKFLOW_ROUTING_ORG_WIDE,
        assignee_user_id: assignee_user_id || '',
      })
    );
  }
  const withOrder = steps.map((s, idx) => ({
    name: s.name,
    assignee_role: s.assignee_role,
    action_type: s.action_type || 'approve',
    routing_scope: (s.routing_scope || s.assignee_scope || WORKFLOW_ROUTING_ORG_WIDE) as string,
    assignee_user_id: s.assignee_user_id || '',
    order: Number(s.step_number ?? s.step ?? idx + 1),
  }));
  withOrder.sort((a, b) => a.order - b.order);
  return withOrder.map(({ name, assignee_role, action_type, routing_scope, assignee_user_id }) => ({
    name,
    assignee_role,
    action_type,
    routing_scope: routing_scope || WORKFLOW_ROUTING_ORG_WIDE,
    assignee_user_id,
  }));
}

const JWT_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
  submitter: 'Submitter',
  director: 'Director',
};

/** Maps workflow `assignee_role` / JWT role slug to NHIA display title (aligned with backend `roleDisplayLabel.js`). */
export function workflowAssigneeRoleLabel(slug: string | null | undefined): string {
  if (!slug) return '';
  const row = WORKFLOW_ASSIGNEE_ROLES.find((r) => r.value === slug);
  if (row) return row.label;
  const jwt = JWT_ROLE_LABELS[slug];
  if (jwt) return jwt;
  return slug.replace(/_/g, ' ');
}

export function formatAuthRolesForDisplay(roles: string[]): string {
  if (!roles?.length) return '';
  return roles.map((r) => workflowAssigneeRoleLabel(r)).join(', ');
}
