import type { Document } from './document';

export interface DocumentSubmitRequest {
  title: string;
  content?: string;
  template_id: string;
}

export interface DocumentSubmitResponse {
  document: Document;
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
  workflow: null;
}
