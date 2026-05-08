export type DocumentStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'archived';

export interface Document {
  id: string;
  title: string;
  content?: string;
  status: DocumentStatus;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  content?: string;
  created_at: string;
}

export interface CreateDocumentRequest {
  title: string;
  content?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
}

export interface CreateDocumentResponse {
  document: Document;
  version: DocumentVersion;
}

export interface UpdateDocumentResponse {
  document: Document;
  version: DocumentVersion | null;
}
