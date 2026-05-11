import type {
  DocumentTemplate,
  DocumentTemplateMetadata,
  SaveDocumentTemplatePayload,
  DocumentTemplateStatus,
} from '@/types/documentTemplate';

export type TemplateFormFields = {
  name: string;
  code: string;
  version: string;
  description: string;
  docType: string;
  workflowTemplateId: string;
  scopeLevel: string;
  hq: string;
  stateOffice: string;
  zone: string;
  directorate: string;
  department: string;
  unit: string;
  restricted: boolean;
  content: string;
  requireSignature: boolean;
  digitalStamp: boolean;
  delegatedSigning: boolean;
  timestamping: boolean;
  multiSignatory: boolean;
  approvalExpiryDays: string;
  retentionYears: string;
  archiveCategory: string;
  metadataTags: string;
  classification: string;
  compliancePolicy: string;
  autoArchive: boolean;
  versioningEnabled: boolean;
  immutableAudit: boolean;
  restrictEdit: boolean;
  restrictDownload: boolean;
  encryptOutput: boolean;
  watermark: boolean;
  auditTracking: boolean;
  requireMfa: boolean;
};

export function buildDocumentTemplatePayload(
  fields: TemplateFormFields,
  status: DocumentTemplateStatus
): SaveDocumentTemplatePayload {
  const departmentPrimary = fields.department.trim() || 'NHIA';

  const metadata: DocumentTemplateMetadata = {
    workflow_template_id: fields.workflowTemplateId.trim() || undefined,
    template_code: fields.code.trim(),
    version_label: fields.version.trim(),
    description: fields.description.trim(),
    scope_level: fields.scopeLevel,
    hq: fields.hq.trim(),
    state_office: fields.stateOffice.trim(),
    zone: fields.zone.trim(),
    directorate: fields.directorate.trim(),
    department: fields.department.trim(),
    unit: fields.unit.trim(),
    restricted: fields.restricted,
    esign: {
      require_signature: fields.requireSignature,
      digital_stamp: fields.digitalStamp,
      delegated_signing: fields.delegatedSigning,
      timestamping: fields.timestamping,
      multi_signatory: fields.multiSignatory,
      approval_expiry_days: fields.approvalExpiryDays,
    },
    records: {
      retention_years: fields.retentionYears,
      archive_category: fields.archiveCategory,
      metadata_tags: fields.metadataTags,
      classification: fields.classification,
      compliance_policy: fields.compliancePolicy,
      auto_archive: fields.autoArchive,
      versioning_enabled: fields.versioningEnabled,
      immutable_audit: fields.immutableAudit,
    },
    security: {
      restrict_edit: fields.restrictEdit,
      restrict_download: fields.restrictDownload,
      encrypt_output: fields.encryptOutput,
      watermark: fields.watermark,
      audit_tracking: fields.auditTracking,
      require_mfa: fields.requireMfa,
    },
  };

  return {
    name: fields.name.trim() || 'Untitled template',
    category: fields.docType,
    department: departmentPrimary,
    body_template: fields.content,
    status,
    metadata,
  };
}

/** Maps persisted template row → local form field updates (for edit / hydrate). */
export function templateRowToFormFields(t: DocumentTemplate): TemplateFormFields {
  const m = t.metadata ?? {};
  const es = m.esign ?? {};
  const rec = m.records ?? {};
  const sec = m.security ?? {};
  const scopeLevel = m.scope_level ?? 'all';
  const scopeAll = scopeLevel === 'all';

  return {
    name: t.name,
    code: m.template_code ?? '',
    version: m.version_label ?? '1.0.0',
    description: m.description ?? '',
    docType: t.category,
    workflowTemplateId: m.workflow_template_id ?? '',
    scopeLevel,
    hq: m.hq ?? '',
    stateOffice: scopeAll ? 'all' : (m.state_office ?? ''),
    zone: scopeAll ? 'all' : (m.zone ?? ''),
    directorate: m.directorate ?? '',
    department: scopeAll ? 'all' : (m.department ?? t.department ?? '').trim() || '',
    unit: scopeAll ? 'all' : (m.unit ?? ''),
    restricted: m.restricted ?? false,
    content: t.body_template ?? '',
    requireSignature: es.require_signature ?? true,
    digitalStamp: es.digital_stamp ?? false,
    delegatedSigning: es.delegated_signing ?? true,
    timestamping: es.timestamping ?? true,
    multiSignatory: es.multi_signatory ?? true,
    approvalExpiryDays: es.approval_expiry_days ?? '14',
    retentionYears: rec.retention_years ?? '7',
    archiveCategory: rec.archive_category ?? 'official_record',
    metadataTags: rec.metadata_tags ?? '',
    classification: rec.classification ?? 'official',
    compliancePolicy: rec.compliance_policy ?? '',
    autoArchive: rec.auto_archive ?? false,
    versioningEnabled: rec.versioning_enabled ?? true,
    immutableAudit: rec.immutable_audit ?? true,
    restrictEdit: sec.restrict_edit ?? false,
    restrictDownload: sec.restrict_download ?? false,
    encryptOutput: sec.encrypt_output ?? false,
    watermark: sec.watermark ?? true,
    auditTracking: sec.audit_tracking ?? true,
    requireMfa: sec.require_mfa ?? false,
  };
}
