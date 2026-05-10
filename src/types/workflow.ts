export type WorkflowStatus =
  | 'active'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'returned_for_correction'
  | 'in_progress'
  | 'pending_approval'
  | 'pending_review';

export interface WorkflowStep {
  step_number: number;
  name: string;
  assignee_role: string;
  action_type: string;
}

export type WorkflowGraphNodeType =
  | 'approval'
  | 'review'
  | 'condition'
  | 'notification'
  | 'hq_escalation'
  | 'parallel'
  | 'archive'
  | 'auto_approval';

export interface WorkflowGraphNode {
  id: string;
  type: WorkflowGraphNodeType;
  label?: string;
  assignee_role?: string;
  assignee_scope?:
    | 'unit'
    | 'department'
    | 'directorate'
    | 'state_office'
    | 'zone'
    | 'hq'
    | 'executive'
    | 'inter_agency';
  sla_hours?: number;
  escalation_role?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowGraphEdge {
  id: string;
  from: string;
  to: string;
  condition?: string | null;
}

/** Canonical graph definition stored in workflow_template_versions.definition (JSONB). */
export interface WorkflowDefinition {
  schemaVersion: number;
  entry_node_id: string;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  variables?: Record<string, unknown>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  steps: WorkflowStep[];
  created_at: string;
  published_version_id?: string | null;
}

export interface WorkflowTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  status: 'draft' | 'published' | 'archived';
  definition: WorkflowDefinition;
  changelog?: string | null;
  created_at: string;
  published_at?: string | null;
}

export interface WorkflowInstance {
  id: string;
  template_id: string;
  document_id: string;
  status: WorkflowStatus;
  current_step: number;
  created_at: string;
  updated_at: string;
  engine_mode?: string;
  template_version_id?: string | null;
  runtime_state?: Record<string, unknown>;
}

export interface WorkflowInstanceStepRow {
  id: string;
  workflow_instance_id: string;
  node_key: string;
  step_number: number | null;
  status: string;
  assignee_role: string | null;
  assignee_user_id: string | null;
  sla_due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowActionRecord {
  id: string;
  workflow_instance_id: string;
  instance_step_id: string | null;
  actor_id: string | null;
  action_type: string;
  comment: string | null;
  client_ip: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface StartWorkflowRequest {
  template_id: string;
  document_id: string;
}

export interface AdvanceWorkflowResponse {
  workflow: WorkflowInstance;
  warnings?: { agent: string; error: string }[];
}

export interface WorkflowTransitionRequest {
  action:
    | 'approve'
    | 'reject'
    | 'return'
    | 'delegate'
    | 'escalate'
    | 'cancel'
    | 'pause'
    | 'resume'
    | 'comment';
  comment?: string;
  delegate_to_user_id?: string;
  payload?: Record<string, unknown>;
}
