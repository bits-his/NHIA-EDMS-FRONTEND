export type WorkflowInstanceStatus =
  | 'active'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'returned_for_correction'
  | string;

export interface WorkflowInstance {
  id: string;
  template_id: string;
  document_id: string;
  status: WorkflowInstanceStatus;
  current_step: number;
  engine_mode?: string;
  runtime_state?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface BpmnSemanticBadge {
  symbol: string;
  label: string;
  palette: string;
}

export interface BpmnWorkflowElement {
  id: string;
  kind: string;
  bpmnKind?: string;
  title: string;
  step_number?: number;
  assignee_role?: string;
  action_type?: string;
  phase?: string;
  badge?: BpmnSemanticBadge;
  decision_branches?: Array<{
    key: string;
    symbol: string;
    label: string;
    edge_kind?: string;
  }>;
}

export interface BpmnTerminalElement {
  id: string;
  kind: string;
  title: string;
  phase?: string;
  semantic?: string;
  symbol?: string;
  description?: string;
}

export interface BpmnConnection {
  id: string;
  from: string;
  to: string;
  kind: string;
  direction: string;
  label?: string;
}

export interface WorkflowBpmnView {
  schema: string;
  engine_mode?: string;
  swimlane_id?: string;
  legend: Record<string, string>;
  standardized_states?: string[];
  elements: BpmnWorkflowElement[];
  terminal: BpmnTerminalElement | null;
  connections: BpmnConnection[];
  annotations?: Array<{ id: string; text: string }>;
  instance_summary: {
    workflow_instance_id: string | null;
    document_id: string | null;
    template_id: string;
    template_name?: string;
    status: string;
    current_step: number | null;
    standardized_state?: string;
    revision_count?: number;
    resubmitted_at?: string | null;
    max_step?: number;
  };
}

export interface WorkflowInstanceStepRow {
  id: string;
  workflow_instance_id: string;
  node_key: string;
  step_number: number | null;
  status: string;
  assignee_role: string | null;
  sla_due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata?: Record<string, unknown>;
}

/** Row from GET /workflows/templates */
export interface WorkflowTemplateSummary {
  id: string;
  name: string;
  steps: Array<{
    step_number?: number;
    step?: number;
    name: string;
    assignee_role: string;
    action_type: string;
  }>;
  created_at?: string;
}

/** POST /workflows/templates — same shape as stored JSON steps */
export interface WorkflowStepDefinition {
  step_number: number;
  name: string;
  assignee_role: string;
  action_type: string;
}

export interface CreateWorkflowTemplatePayload {
  name: string;
  steps: WorkflowStepDefinition[];
}

export interface UpdateWorkflowTemplatePayload {
  name?: string;
  steps?: WorkflowStepDefinition[];
}
