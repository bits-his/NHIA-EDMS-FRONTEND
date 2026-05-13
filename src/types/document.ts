export type DocumentStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'archived';

export type DocumentCategory = 'internal_memo' | 'external_correspondence';

export type DocumentUrgency = 'normal' | 'urgent' | 'very_urgent';

export type DocumentDeliveryMode = 'workflow' | 'direct_message';

export type DocumentInputMode = 'template' | 'manual_entry';

export type DocumentFileClassification = 'normal' | 'important' | 'secret' | 'top_secret';

/** Optional fields persisted with POST /documents and POST /documents/upload */
export type DocumentCreationProfile = {
  delivery_mode?: DocumentDeliveryMode;
  input_mode?: DocumentInputMode;
  file_classification?: DocumentFileClassification;
  document_effective_date?: string;
  intake_file_name?: string;
  selected_workflow_template_id?: string;
};

export type RecipientType = 'to' | 'cc' | 'bcc';

export interface Document {
  id: string;
  title: string;
  content?: string | null;
  status: DocumentStatus;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  category?: DocumentCategory | null;
  ref_number?: string | null;
  department?: string | null;
  urgency?: DocumentUrgency | null;
  template_id?: string | null;
  file_path?: string | null;
  original_filename?: string | null;
  signatory_id?: string | null;
  delivery_mode?: DocumentDeliveryMode | null;
  input_mode?: DocumentInputMode | null;
  file_classification?: DocumentFileClassification | null;
  document_effective_date?: string | null;
  intake_file_name?: string | null;
  selected_workflow_template_id?: string | null;
  receive_recorded_at?: string | null;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  content?: string | null;
  created_at: string;
}

export interface DocumentRecipient {
  id: string;
  document_id: string;
  user_id: string;
  recipient_type: RecipientType;
  created_at?: string;
}

export interface DocumentAttachment {
  id: string;
  document_id: string;
  filename: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at?: string;
}

export interface CreateRecipientInput {
  user_id: string;
  recipient_type: RecipientType;
}

/** Workflow steps logged in document_actions (server). Includes actor profile when joined. */
export interface DocumentWorkflowAction {
  id: string;
  document_id: string;
  actor_id: string | null;
  action: string;
  comment: string | null;
  created_at: string;
  actor_full_name?: string | null;
  actor_username?: string | null;
  actor_rank?: string | null;
  actor_department?: string | null;
  actor_zone?: string | null;
  actor_state?: string | null;
}

export interface CreateDocumentRequest extends Partial<DocumentCreationProfile> {
  title: string;
  content?: string;
  category: DocumentCategory;
  department: string;
  urgency?: DocumentUrgency;
  template_id?: string;
  /** Omit for auto-generated ref; must be unique when set. */
  ref_number?: string;
  recipients?: CreateRecipientInput[];
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
}

export interface CreateDocumentResponse {
  document: Document;
  version: DocumentVersion;
  recipients?: DocumentRecipient[];
}

export interface UpdateDocumentResponse {
  document: Document;
  version: DocumentVersion | null;
}

export interface DocumentSearchFilters {
  ref_number?: string;
  date_from?: string;
  date_to?: string;
  keyword?: string;
  category?: DocumentCategory;
}
