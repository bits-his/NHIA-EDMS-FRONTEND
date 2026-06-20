import { documentClient } from './client';
import type {
  Document,
  DocumentVersion,
  DocumentRecipient,
  DocumentAttachment,
  DocumentWorkflowAction,
  CreateDocumentRequest,
  CreateDocumentResponse,
  UpdateDocumentRequest,
  UpdateDocumentResponse,
  DocumentSearchFilters,
  CreateRecipientInput,
  DocumentCreationProfile,
  DocumentUrgency,
  CorrespondenceDirection,
} from '@/types/document';
import type { DocumentTemplate, SaveDocumentTemplatePayload } from '@/types/documentTemplate';
import type { OrgScopeReferenceResponse } from '@/types/orgScope';
import type { RegistryListResponse, RegistrySearchFilters } from '@/types/registry';

export const documentsApi = {
  listAll: async (): Promise<Document[]> => {
    const res = await documentClient.get<Document[]>('/documents');
    return res.data;
  },

  search: async (filters: DocumentSearchFilters): Promise<Document[]> => {
    const res = await documentClient.get<Document[]>('/documents/search', { params: filters });
    return res.data;
  },

  listArchiveRegistry: async (filters?: RegistrySearchFilters): Promise<RegistryListResponse> => {
    const res = await documentClient.get<RegistryListResponse>('/documents/registry/archive', {
      params: filters,
    });
    return res.data;
  },

  listReportsRegistry: async (filters?: RegistrySearchFilters): Promise<RegistryListResponse> => {
    const res = await documentClient.get<RegistryListResponse>('/documents/registry/reports', {
      params: filters,
    });
    return res.data;
  },

  create: async (data: CreateDocumentRequest): Promise<CreateDocumentResponse> => {
    const res = await documentClient.post<CreateDocumentResponse>('/documents', data);
    return res.data;
  },

  uploadExternal: async (
    file: File,
    title: string,
    department: string,
    options?: {
      ref_number?: string;
      correspondence_direction: CorrespondenceDirection;
      tracking_id?: string;
      urgency?: DocumentUrgency;
      /** Cover note / summary (plain text or HTML). */
      content?: string;
    } & Partial<DocumentCreationProfile>
  ): Promise<CreateDocumentResponse> => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('department', department);
    form.append('correspondence_direction', options?.correspondence_direction ?? 'incoming');
    if (options?.content?.trim()) {
      form.append('content', options.content.trim());
    }
    if (options?.ref_number?.trim()) {
      form.append('ref_number', options.ref_number.trim());
    }
    if (options?.tracking_id?.trim()) {
      form.append('tracking_id', options.tracking_id.trim());
    }
    if (options?.urgency) {
      form.append('urgency', options.urgency);
    }
    if (options?.delivery_mode) {
      form.append('delivery_mode', options.delivery_mode);
    }
    if (options?.input_mode) {
      form.append('input_mode', options.input_mode);
    }
    if (options?.file_classification) {
      form.append('file_classification', options.file_classification);
    }
    if (options?.document_effective_date?.trim()) {
      form.append('document_effective_date', options.document_effective_date.trim());
    }
    if (options?.intake_file_name?.trim()) {
      form.append('intake_file_name', options.intake_file_name.trim());
    }
    const wfTpl = options?.selected_workflow_template_id?.trim();
    if (wfTpl && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wfTpl)) {
      form.append('selected_workflow_template_id', wfTpl);
    }
    const res = await documentClient.post<CreateDocumentResponse>('/documents/upload', form);
    return res.data;
  },

  listWorkflowActions: async (documentId: string): Promise<DocumentWorkflowAction[]> => {
    const res = await documentClient.get<DocumentWorkflowAction[]>(
      `/documents/${documentId}/actions`
    );
    return res.data;
  },

  getById: async (id: string): Promise<Document> => {
    const res = await documentClient.get<Document>(`/documents/${id}`);
    return res.data;
  },

  update: async (id: string, data: UpdateDocumentRequest): Promise<UpdateDocumentResponse> => {
    const res = await documentClient.put<UpdateDocumentResponse>(`/documents/${id}`, data);
    return res.data;
  },

  getVersions: async (id: string): Promise<DocumentVersion[]> => {
    const res = await documentClient.get<DocumentVersion[]>(`/documents/${id}/versions`);
    return res.data;
  },

  listRecipients: async (documentId: string): Promise<DocumentRecipient[]> => {
    const res = await documentClient.get<DocumentRecipient[]>(`/documents/${documentId}/recipients`);
    return res.data;
  },

  addRecipient: async (documentId: string, body: CreateRecipientInput): Promise<DocumentRecipient> => {
    const res = await documentClient.post<DocumentRecipient>(`/documents/${documentId}/recipients`, body);
    return res.data;
  },

  listAttachments: async (documentId: string): Promise<DocumentAttachment[]> => {
    const res = await documentClient.get<DocumentAttachment[]>(`/documents/${documentId}/attachments`);
    return res.data;
  },

  uploadAttachment: async (documentId: string, file: File): Promise<DocumentAttachment> => {
    const form = new FormData();
    form.append('file', file);
    const res = await documentClient.post<DocumentAttachment>(
      `/documents/${documentId}/attachments`,
      form
    );
    return res.data;
  },

  /** Upload or replace the primary document file (PDF/DOCX). Owner only while draft/pending. */
  uploadPrimaryFile: async (documentId: string, file: File): Promise<Document> => {
    const form = new FormData();
    form.append('file', file);
    const res = await documentClient.post<Document>(`/documents/${documentId}/primary-file`, form);
    return res.data;
  },

  /** Save e-signature image for the signed-in user (PNG/JPEG/WebP/GIF, max ~1 MB). */
  uploadProfileSignature: async (file: File): Promise<{ signature_path: string | null; message: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await documentClient.post<{ signature_path: string | null; message: string }>(
      '/documents/profile/signature',
      form
    );
    return res.data;
  },

  /** Stream current user's saved signature file (for Settings preview). */
  getMySignatureBlob: async (): Promise<Blob> => {
    const res = await documentClient.get<Blob>('/documents/profile/signature', {
      responseType: 'blob',
    });
    return res.data;
  },

  /** Fetch preview HTML (authenticated). Caller should open via blob URL. */
  getPreviewHtml: async (documentId: string): Promise<string> => {
    const res = await documentClient.get<string>(`/documents/${documentId}/preview`, {
      responseType: 'text',
    });
    return res.data;
  },

  /** Signatory signature image for a document (after final approval). 404 if none. */
  getDocumentSignatorySignatureBlob: async (documentId: string): Promise<Blob> => {
    const res = await documentClient.get<Blob>(`/documents/${documentId}/signatory-signature`, {
      responseType: 'blob',
    });
    return res.data;
  },

  /** E-signature image for a user who final-approved (comments thread). */
  getActorSignatureBlob: async (documentId: string, actorUserId: string): Promise<Blob> => {
    const res = await documentClient.get<Blob>(
      `/documents/${documentId}/actors/${actorUserId}/signature`,
      { responseType: 'blob' }
    );
    return res.data;
  },

  downloadAttachmentBlob: async (documentId: string, attachmentId: string): Promise<Blob> => {
    const res = await documentClient.get<Blob>(`/documents/${documentId}/attachments/${attachmentId}`, {
      responseType: 'blob',
    });
    return res.data;
  },

  deleteAttachment: async (documentId: string, attachmentId: string): Promise<void> => {
    await documentClient.delete(`/documents/${documentId}/attachments/${attachmentId}`);
  },

  /** Uploaded PDF/DOCX for external correspondence (primary file). */
  downloadPrimaryFileBlob: async (documentId: string): Promise<Blob> => {
    const res = await documentClient.get<Blob>(`/documents/${documentId}/primary-file`, {
      responseType: 'blob',
    });
    return res.data;
  },

  submit: async (id: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/submit`);
    return res.data;
  },

  /** Owner only: pending → draft; pauses active workflow when present. */
  recall: async (id: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/recall`);
    return res.data;
  },

  /** Owner only: workflow-backed pending doc — moves current-step task to another user. */
  reassign: async (id: string, assigneeUserId: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/reassign`, {
      assignee_user_id: assigneeUserId,
    });
    return res.data;
  },

  /** Pending → approved (generic transition). Does not append an e-signature to document HTML. */
  approve: async (id: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/approve`);
    return res.data;
  },

  /** Workflow final step: pending → archived (organisation registry) + audit row. Signature append is optional. */
  finalApprove: async (
    id: string,
    comment?: string,
    options?: { appendSignature?: boolean }
  ): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/final-approve`, {
      ...(comment !== undefined && comment !== '' ? { comment } : {}),
      ...(options?.appendSignature ? { append_signature: true } : {}),
    });
    return res.data;
  },

  reject: async (id: string, comment: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/reject`, { comment });
    return res.data;
  },

  editForward: async (
    id: string,
    comment?: string,
    actionType?: string,
    nextUserId?: string,
    options?: { appendSignature?: boolean }
  ): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/edit-forward`, {
      ...(comment !== undefined && comment !== '' ? { comment } : {}),
      ...(actionType !== undefined && actionType !== '' ? { action_type: actionType } : {}),
      ...(nextUserId !== undefined && nextUserId !== '' ? { next_user_id: nextUserId } : {}),
      ...(options?.appendSignature ? { append_signature: true } : {}),
    });
    return res.data;
  },

  /** Workflow approve-forward step. E-signature stamp is optional (`appendSignature`). */
  approveForward: async (
    id: string,
    comment?: string,
    nextUserId?: string,
    options?: { appendSignature?: boolean }
  ): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/approve-forward`, {
      ...(comment !== undefined && comment !== '' ? { comment } : {}),
      ...(nextUserId?.trim() ? { next_user_id: nextUserId.trim() } : {}),
      ...(options?.appendSignature ? { append_signature: true } : {}),
    });
    return res.data;
  },

  requestInfo: async (id: string, comment: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/request-info`, { comment });
    return res.data;
  },

  archive: async (id: string): Promise<Document> => {
    const res = await documentClient.post<Document>(`/documents/${id}/archive`);
    return res.data;
  },

  getOrgScopeReference: async (): Promise<OrgScopeReferenceResponse> => {
    const res = await documentClient.get<OrgScopeReferenceResponse>(
      '/documents/reference/org-scope'
    );
    return res.data;
  },

  listTemplates: async (): Promise<DocumentTemplate[]> => {
    const res = await documentClient.get<DocumentTemplate[]>('/documents/templates');
    return res.data;
  },

  getTemplate: async (id: string): Promise<DocumentTemplate> => {
    const res = await documentClient.get<DocumentTemplate>(`/documents/templates/${id}`);
    return res.data;
  },

  createTemplate: async (data: SaveDocumentTemplatePayload): Promise<DocumentTemplate> => {
    const res = await documentClient.post<DocumentTemplate>('/documents/templates', data);
    return res.data;
  },

  updateTemplate: async (
    id: string,
    data: Partial<SaveDocumentTemplatePayload>
  ): Promise<DocumentTemplate> => {
    const res = await documentClient.put<DocumentTemplate>(`/documents/templates/${id}`, data);
    return res.data;
  },

  deleteTemplate: async (id: string): Promise<void> => {
    await documentClient.delete(`/documents/templates/${id}`);
  },
};
