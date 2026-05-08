export type WorkflowStatus = 'active' | 'completed';

export interface WorkflowStep {
  step_number: number;
  name: string;
  assignee_role: string;
  action_type: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  steps: WorkflowStep[];
  created_at: string;
}

export interface WorkflowInstance {
  id: string;
  template_id: string;
  document_id: string;
  status: WorkflowStatus;
  current_step: number;
  created_at: string;
  updated_at: string;
}

export interface StartWorkflowRequest {
  template_id: string;
  document_id: string;
}

export interface AdvanceWorkflowResponse {
  workflow: WorkflowInstance;
  warnings?: string[];
}
