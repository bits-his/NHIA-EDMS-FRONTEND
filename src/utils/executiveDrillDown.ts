/** Build `/dashboard/reports?…` paths for executive dashboard drill-down. */
export function executiveReportPath(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val == null || val === '') continue;
    q.set(key, String(val));
  }
  return `/dashboard/reports?${q.toString()}`;
}

export const executiveDrill = {
  allDocuments: () => executiveReportPath({ kind: 'documents' }),

  documentsByStatus: (status: string) =>
    executiveReportPath({ kind: 'documents', status }),

  reporting: () => executiveReportPath({ kind: 'documents', reporting: '1' }),

  reportingPending: () =>
    executiveReportPath({ kind: 'documents', reporting_pending: '1' }),

  activeTasks: () => executiveReportPath({ kind: 'tasks', active: '1' }),

  overdueTasks: () => executiveReportPath({ kind: 'tasks', overdue: '1' }),

  activeWorkflows: () => executiveReportPath({ kind: 'workflows' }),

  stalledWorkflows: () => executiveReportPath({ kind: 'workflows', stalled: '1' }),

  bottleneckStep: (stepNumber: number) =>
    executiveReportPath({
      kind: 'tasks',
      active: '1',
      step_number: stepNumber,
    }),

  assigneeTasks: (userId: string, displayName?: string) =>
    executiveReportPath({
      kind: 'tasks',
      active: '1',
      assignee_id: userId,
      ...(displayName ? { title: `Tasks — ${displayName}` } : {}),
    }),

  orgZone: (id: number | null, name: string) =>
    executiveReportPath({
      kind: 'documents',
      ...(id != null ? { zone_id: id } : {}),
      org_name: name,
      title: `Documents — ${name}`,
    }),

  orgDepartment: (id: number | null, name: string) =>
    executiveReportPath({
      kind: 'documents',
      ...(id != null ? { department_id: id } : {}),
      org_name: name,
      title: `Documents — ${name}`,
    }),

  orgStateOffice: (id: number | null, name: string) =>
    executiveReportPath({
      kind: 'documents',
      ...(id != null ? { state_office_id: id } : {}),
      org_name: name,
      title: `Documents — ${name}`,
    }),

  escalation: () => executiveReportPath({ kind: 'tasks', overdue: '1' }),
};
