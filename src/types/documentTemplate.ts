/** Row from GET/POST/PUT `/documents/templates` (document agent). */
export type DocumentTemplateStatus = 'draft' | 'published' | 'archived';

export interface DocumentTemplateMetadata {
  /** Default workflow template when creating documents from this catalogue template */
  workflow_template_id?: string;
  template_code?: string;
  version_label?: string;
  description?: string;
  scope_level?: string;
  hq?: string;
  state_office?: string;
  zone?: string;
  directorate?: string;
  department?: string;
  unit?: string;
  restricted?: boolean;
  esign?: {
    require_signature?: boolean;
    digital_stamp?: boolean;
    delegated_signing?: boolean;
    timestamping?: boolean;
    multi_signatory?: boolean;
    approval_expiry_days?: string;
  };
  records?: {
    retention_years?: string;
    archive_category?: string;
    metadata_tags?: string;
    classification?: string;
    compliance_policy?: string;
    auto_archive?: boolean;
    versioning_enabled?: boolean;
    immutable_audit?: boolean;
  };
  security?: {
    restrict_edit?: boolean;
    restrict_download?: boolean;
    encrypt_output?: boolean;
    watermark?: boolean;
    audit_tracking?: boolean;
    require_mfa?: boolean;
  };
}

export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  department: string;
  letterhead_html: string;
  body_template: string | null;
  status: DocumentTemplateStatus;
  metadata: DocumentTemplateMetadata | null;
  created_at: string;
  updated_at?: string | null;
}

export interface SaveDocumentTemplatePayload {
  name: string;
  category: string;
  department: string;
  letterhead_html?: string;
  body_template: string | null;
  status: DocumentTemplateStatus;
  metadata: DocumentTemplateMetadata;
}
