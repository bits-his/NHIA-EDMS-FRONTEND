import type { Document } from './document';
import type { WorkflowInstance } from './workflow';

export interface DocumentSubmitRequest {
  title: string;
  content?: string;
  template_id: string;
}

export interface DocumentSubmitResponse {
  document: Document;
  workflow: WorkflowInstance;
}

export interface WorkflowStartRequest {
  template_id: string;
  document_id: string;
}

export interface WorkflowStartResponse {
  workflow: WorkflowInstance;
}

export interface OrchestratorStatusResponse {
  document_id: string;
  document: {
    id: string;
    title: string;
    status: string;
    owner_id: string;
    updated_at: string;
  };
  workflow: {
    id: string;
    status: string;
    current_step: number;
    template_id: string;
    updated_at: string;
  } | null;
}
