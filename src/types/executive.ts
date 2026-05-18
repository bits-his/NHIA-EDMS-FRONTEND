export type ExecutiveScopeType =
  | 'national'
  | 'directorate'
  | 'department'
  | 'zone'
  | 'state_office';

export type ExecutiveViewType = 'dgo' | 'director' | 'operational';

export interface Executive360Response {
  scope: {
    type: ExecutiveScopeType;
    label: string;
    view: ExecutiveViewType;
  };
  period?: { from: string; to: string };
  periodComparison?: {
    previousPeriod: { from: string; to: string };
    deltas: {
      auditEvents: { percent: number; direction: 'up' | 'down' | 'flat' };
      documentsCreated: { percent: number; direction: 'up' | 'down' | 'flat' };
      tasksCompleted: { percent: number; direction: 'up' | 'down' | 'flat' };
      reportingSubmissions: { percent: number; direction: 'up' | 'down' | 'flat' };
    };
  };
  generatedAt: string;
  kpis: {
    documents: {
      total: number;
      draft: number;
      pending: number;
      approved: number;
      rejected: number;
      archived: number;
    };
    tasks: {
      active: number;
      overdue: number;
      completed: number;
      total: number;
    };
    workflows: {
      active: number;
      stalled: number;
    };
    reporting: {
      total: number;
      pending: number;
    };
    correspondence: {
      incoming: number;
      outgoing: number;
      total: number;
      pending: number;
    };
    audit: {
      eventsInPeriod: number;
      /** @deprecated use eventsInPeriod */
      eventsLast7Days?: number;
    };
    periodActivity?: {
      auditEvents: number;
      documentsCreated: number;
      tasksCompleted: number;
      reportingSubmissions: number;
      revisionLoops: number;
    };
  };
  pipeline: Array<{ status: string; label: string; count: number }>;
  orgBreakdown: {
    zones: Array<{ id: number | null; name: string; documents: number; pending: number }>;
    departments: Array<{ id: number | null; name: string; documents: number; pending: number }>;
    stateOffices: Array<{ id: number | null; name: string; documents: number; pending: number }>;
  };
  workflowHealth: {
    bottleneckSteps: Array<{ step_number: number; active_count: number }>;
    revisionLoops: number;
    escalationSignals: number;
  };
  activityTrend: Array<{ date: string; count: number }>;
  alerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    count: number;
    link: string;
  }>;
  topPending: Array<{
    id: string;
    title: string;
    owner_id: string;
    updated_at: string;
    ref_number?: string | null;
    status_label?: string | null;
  }>;
  topOverdueTasks: Array<{
    id: string;
    step_number: number;
    assignee_id: string;
    document_id: string;
    due_date: string | null;
    created_at?: string | null;
  }>;
  assigneeWorkload: Array<{ user_id: string; active: number; total: number }>;
}

export type ExecutiveReportKind = 'documents' | 'tasks' | 'workflows';

export interface ExecutiveReportDocumentItem {
  id: string;
  title: string;
  status: string;
  owner_id: string;
  updated_at: string;
  created_at?: string;
  ref_number?: string | null;
  department?: string | null;
  category?: string | null;
  urgency?: string | null;
}

export interface ExecutiveReportTaskItem {
  id: string;
  status: string;
  step_number: number;
  assignee_id: string;
  due_date?: string | null;
  document_id?: string | null;
  document_title?: string | null;
  document_status?: string | null;
  document_ref?: string | null;
  updated_at?: string;
}

export interface ExecutiveReportWorkflowItem {
  id: string;
  status: string;
  current_step: number;
  updated_at: string;
  created_at?: string;
  document_id: string;
  document_title?: string | null;
  document_status?: string | null;
  document_ref?: string | null;
}

export interface ExecutiveReportResponse {
  kind: ExecutiveReportKind;
  title: string;
  subtitle?: string | null;
  scope: { type: string; label: string };
  items: ExecutiveReportDocumentItem[] | ExecutiveReportTaskItem[] | ExecutiveReportWorkflowItem[];
  total: number;
}
