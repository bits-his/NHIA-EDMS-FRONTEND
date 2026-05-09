import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Root as DialogRoot,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  Description as DialogDescription,
  Close as DialogClose,
} from '@radix-ui/react-dialog';
import {
  Archive,
  Copy,
  Download,
  FileUp,
  Loader2,
  Save,
  Send,
  Eye,
  ChevronRight,
  History,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import MemoEditor from '@/components/documents/MemoEditor';
import { EnterprisePageBanner } from '@/components/template-builder/EnterprisePageBanner';
import { CollapsibleSection } from '@/components/template-builder/CollapsibleSection';
import { TemplateMetricsStrip } from '@/components/template-builder/TemplateMetricsStrip';
import { TemplateDocumentTypeSelect } from '@/components/template-builder/TemplateDocumentTypeSelect';
import { TemplatePreviewPanel } from '@/components/template-builder/TemplatePreviewPanel';
import {
  TEMPLATE_DOCUMENT_GROUPS,
  SCOPE_LEVELS,
  PLACEHOLDER_VARIABLES,
  APPROVAL_ENTITY_LABELS,
} from '@/components/template-builder/constants';
import { cn } from '@/utils/cn';
import { documentsApi } from '@/api/documents';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import type { DocumentTemplateStatus } from '@/types/documentTemplate';
import {
  buildDocumentTemplatePayload,
  templateRowToFormFields,
  type TemplateFormFields,
} from '@/utils/documentTemplatePayload';
import { ErrorState } from '@/components/shared/ErrorState';
import { formatDateTime } from '@/utils/formatters';

function findDocTypeLabel(value: string): string {
  for (const g of TEMPLATE_DOCUMENT_GROUPS) {
    const f = g.items.find((i) => i.value === value);
    if (f) return f.label;
  }
  return value || '—';
}

function findScopeLabel(value: string): string {
  if (!value) return '—';
  return SCOPE_LEVELS.find((s) => s.value === value)?.label ?? value;
}

/** Stored in template metadata when organisational scope applies everywhere. */
const ORG_SCOPE_ALL = 'all';

const INITIAL_HTML = `<p><strong>FEDERAL GOVERNMENT OF NIGERIA</strong></p>
<p><strong>NATIONAL HEALTH INSURANCE AUTHORITY</strong></p>
<p>&nbsp;</p>
<p><strong>REFERENCE:</strong> {{reference_number}}</p>
<p><strong>DATE:</strong> {{approval_date}}</p>
<p><strong>TO:</strong> {{department}} · {{unit}}</p>
<p><strong>FROM:</strong> {{staff_name}}</p>
<p><strong>SUBJECT:</strong> &nbsp;</p>
<hr />
<p>{{workflow_status}}</p>
<p>&nbsp;</p>
<p><em>Zonal / State routing: {{zone}} · {{state_office}} · {{headquarters}}</em></p>
<p>&nbsp;</p>
<p><strong>CLASSIFICATION:</strong> {{classification}}</p>
<p>&nbsp;</p>
<p><strong>SIGNATORY:</strong> {{name}}</p>
<p>{{e-signature}}</p>`;

export default function CreateDocumentTemplatePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [docType, setDocType] = useState('internal_memo');
  const [scopeLevel, setScopeLevel] = useState('all');
  const [hq, setHq] = useState('');
  const [stateOffice, setStateOffice] = useState(ORG_SCOPE_ALL);
  const [zone, setZone] = useState(ORG_SCOPE_ALL);
  const [directorate, setDirectorate] = useState('');
  const [department, setDepartment] = useState(ORG_SCOPE_ALL);
  const [unit, setUnit] = useState(ORG_SCOPE_ALL);
  const [restricted, setRestricted] = useState(false);
  const [content, setContent] = useState(INITIAL_HTML);

  const [requireSignature, setRequireSignature] = useState(true);
  const [digitalStamp, setDigitalStamp] = useState(false);
  const [delegatedSigning, setDelegatedSigning] = useState(true);
  const [timestamping, setTimestamping] = useState(true);
  const [multiSignatory, setMultiSignatory] = useState(true);
  const [approvalExpiryDays, setApprovalExpiryDays] = useState('14');

  const [retentionYears, setRetentionYears] = useState('7');
  const [archiveCategory, setArchiveCategory] = useState('official_record');
  const [metadataTags, setMetadataTags] = useState('NHIA, operational, confidential');
  const [classification, setClassification] = useState('official');
  const [compliancePolicy, setCompliancePolicy] = useState('NHIA Records Policy 2026');
  const [autoArchive, setAutoArchive] = useState(false);
  const [versioningEnabled, setVersioningEnabled] = useState(true);
  const [immutableAudit, setImmutableAudit] = useState(true);

  const [restrictEdit, setRestrictEdit] = useState(false);
  const [restrictDownload, setRestrictDownload] = useState(false);
  const [encryptOutput, setEncryptOutput] = useState(false);
  const [watermark, setWatermark] = useState(true);
  const [auditTracking, setAuditTracking] = useState(true);
  const [requireMfa, setRequireMfa] = useState(false);

  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId?: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const previewAsideRef = useRef<HTMLDivElement>(null);
  const duplicateHydrated = useRef(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const docTypeLabel = useMemo(() => findDocTypeLabel(docType), [docType]);
  const scopeLabel = useMemo(() => findScopeLabel(scopeLevel), [scopeLevel]);

  const environment = import.meta.env.PROD ? 'production' : 'internal';

  const { data: orgScope } = useQuery({
    queryKey: QUERY_KEYS.orgScopeReference,
    queryFn: () => documentsApi.getOrgScopeReference(),
    staleTime: 60 * 60 * 1000,
  });

  const scopeLockedToAll = scopeLevel === ORG_SCOPE_ALL;

  const letterheadZoneCode = useMemo(() => {
    if (scopeLockedToAll || zone === ORG_SCOPE_ALL) return undefined;
    return zone.trim() || undefined;
  }, [scopeLockedToAll, zone]);

  const letterheadStateOfficeName = useMemo(() => {
    if (scopeLockedToAll || stateOffice === ORG_SCOPE_ALL) return undefined;
    return stateOffice.trim() || undefined;
  }, [scopeLockedToAll, stateOffice]);

  const filteredStateOffices = useMemo(() => {
    if (!orgScope?.stateOffices) return [];
    if (scopeLockedToAll || zone === ORG_SCOPE_ALL) return orgScope.stateOffices;
    if (!zone) return orgScope.stateOffices;
    return orgScope.stateOffices.filter((s) => s.zoneCode === zone);
  }, [orgScope?.stateOffices, zone, scopeLockedToAll]);

  const filteredUnits = useMemo(() => {
    if (!orgScope?.units) return [];
    if (scopeLockedToAll || department === ORG_SCOPE_ALL) return orgScope.units;
    if (!department) return orgScope.units;
    const dept = orgScope.departments?.find((d) => d.name === department);
    if (!dept) return orgScope.units;
    return orgScope.units.filter((u) => u.departmentId === dept.id);
  }, [orgScope?.units, orgScope?.departments, department, scopeLockedToAll]);

  const zoneHasLegacy =
    Boolean(zone && zone !== ORG_SCOPE_ALL && orgScope?.zones && !orgScope.zones.some((z) => z.code === zone));

  const stateLegacy =
    Boolean(
      !scopeLockedToAll &&
        stateOffice &&
        stateOffice !== ORG_SCOPE_ALL &&
        filteredStateOffices.length > 0 &&
        !filteredStateOffices.some((s) => s.name === stateOffice)
    );

  const deptLegacy =
    Boolean(
      !scopeLockedToAll &&
        department &&
        department !== ORG_SCOPE_ALL &&
        orgScope?.departments &&
        !orgScope.departments.some((d) => d.name === department)
    );

  const unitLegacy =
    Boolean(
      !scopeLockedToAll &&
        unit &&
        unit !== ORG_SCOPE_ALL &&
        filteredUnits.length > 0 &&
        !filteredUnits.some((u) => u.name === unit)
    );

  function handleScopeLevelChange(v: string) {
    if (v === ORG_SCOPE_ALL) {
      setZone(ORG_SCOPE_ALL);
      setStateOffice(ORG_SCOPE_ALL);
      setDepartment(ORG_SCOPE_ALL);
      setUnit(ORG_SCOPE_ALL);
    } else if (scopeLevel === ORG_SCOPE_ALL) {
      setZone('');
      setStateOffice('');
      setDepartment('');
      setUnit('');
    }
    setScopeLevel(v);
  }

  const {
    data: loadedTemplate,
    isLoading: loadingTemplate,
    error: templateLoadError,
    refetch: refetchTemplate,
  } = useQuery({
    queryKey: QUERY_KEYS.documentTemplate(templateId ?? ''),
    queryFn: () => documentsApi.getTemplate(templateId!),
    enabled: !!templateId,
  });

  function collectFields(): TemplateFormFields {
    return {
      name,
      code,
      version,
      description,
      docType,
      scopeLevel,
      hq,
      stateOffice,
      zone,
      directorate,
      department,
      unit,
      restricted,
      content,
      requireSignature,
      digitalStamp,
      delegatedSigning,
      timestamping,
      multiSignatory,
      approvalExpiryDays,
      retentionYears,
      archiveCategory,
      metadataTags,
      classification,
      compliancePolicy,
      autoArchive,
      versioningEnabled,
      immutableAudit,
      restrictEdit,
      restrictDownload,
      encryptOutput,
      watermark,
      auditTracking,
      requireMfa,
    };
  }

  function applyFields(f: TemplateFormFields) {
    setName(f.name);
    setCode(f.code);
    setVersion(f.version);
    setDescription(f.description);
    setDocType(f.docType);
    setScopeLevel(f.scopeLevel);
    setHq(f.hq);
    setStateOffice(f.stateOffice);
    setZone(f.zone);
    setDirectorate(f.directorate);
    setDepartment(f.department);
    setUnit(f.unit);
    setRestricted(f.restricted);
    setContent(f.content || INITIAL_HTML);
    setRequireSignature(f.requireSignature);
    setDigitalStamp(f.digitalStamp);
    setDelegatedSigning(f.delegatedSigning);
    setTimestamping(f.timestamping);
    setMultiSignatory(f.multiSignatory);
    setApprovalExpiryDays(f.approvalExpiryDays);
    setRetentionYears(f.retentionYears);
    setArchiveCategory(f.archiveCategory);
    setMetadataTags(f.metadataTags);
    setClassification(f.classification);
    setCompliancePolicy(f.compliancePolicy);
    setAutoArchive(f.autoArchive);
    setVersioningEnabled(f.versioningEnabled);
    setImmutableAudit(f.immutableAudit);
    setRestrictEdit(f.restrictEdit);
    setRestrictDownload(f.restrictDownload);
    setEncryptOutput(f.encryptOutput);
    setWatermark(f.watermark);
    setAuditTracking(f.auditTracking);
    setRequireMfa(f.requireMfa);
  }

  useEffect(() => {
    if (!loadedTemplate) return;
    applyFields(templateRowToFormFields(loadedTemplate));
  }, [loadedTemplate?.id]);

  useEffect(() => {
    if (duplicateHydrated.current) return;
    const snap = (location.state as { duplicateSnapshot?: TemplateFormFields } | null)
      ?.duplicateSnapshot;
    if (!snap || templateId) return;
    duplicateHydrated.current = true;
    applyFields(snap);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hydrate from router state (duplicate flow)
  }, []);

  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: DocumentTemplateStatus }) => {
      const payload = buildDocumentTemplatePayload(collectFields(), status);
      if (templateId) {
        return documentsApi.updateTemplate(templateId, payload);
      }
      return documentsApi.createTemplate(payload);
    },
    onSuccess: (row, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.documentTemplates] });
      queryClient.setQueryData(QUERY_KEYS.documentTemplate(row.id), row);
      if (!templateId) {
        navigate(`/template-management/edit/${row.id}`, { replace: true });
      }
      toast.success(
        variables.status === 'published' ? 'Template published to catalogue.' : 'Draft saved.'
      );
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const archiveMutation = useMutation({
    mutationFn: () => documentsApi.updateTemplate(templateId!, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.documentTemplates] });
      toast.success('Template archived.');
      navigate('/template-management');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const appendPlaceholder = (token: string) => {
    setContent((c) => `${c}<p>${token}</p>`);
    toast.message(`Inserted ${token}`);
  };

  const validateName = () => {
    if (!name.trim()) {
      toast.error('Template name is required.');
      return false;
    }
    return true;
  };

  const handleSaveDraft = () => {
    if (!validateName()) return;
    saveMutation.mutate({ status: 'draft' });
  };

  const handlePublish = () => {
    if (!validateName()) return;
    saveMutation.mutate({ status: 'published' });
  };

  const handleExport = () => {
    const payload = buildDocumentTemplatePayload(collectFields(), 'draft');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(code || name || 'template').replace(/\s+/g, '-')}-definition.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template definition exported.');
  };

  const handleDuplicate = () => {
    const snap = collectFields();
    navigate('/template-management/create', {
      state: {
        duplicateSnapshot: {
          ...snap,
          name: `${snap.name.trim() || 'Untitled template'} (copy)`,
          code: '',
        },
      },
    });
  };

  const scrollToPreview = () => {
    previewAsideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const saving = saveMutation.isPending || archiveMutation.isPending;

  if (templateId && templateLoadError) {
    return (
      <div className="space-y-4 pb-28">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <Link to="/template-management" className="hover:text-foreground transition-colors">
            Templates
          </Link>
        </nav>
        <ErrorState error={templateLoadError} onRetry={() => refetchTemplate()} />
      </div>
    );
  }

  if (templateId && loadingTemplate) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 pb-28">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading template…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <Link to="/template-management" className="hover:text-foreground transition-colors">
          Templates
        </Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="text-foreground font-medium">
          {templateId ? 'Edit template' : 'Create template'}
        </span>
      </nav>

      <EnterprisePageBanner environment={environment} />

      <PageHeader
        title={templateId ? 'Edit document template' : 'Create document template'}
        description="Configure reusable letterhead and body content. Save drafts or publish to the catalogue — data is stored on the document service."
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Badge variant="outline" className="text-[10px] font-normal">
              API-ready schema
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              Records management
            </Badge>
          </div>
        }
      />

      <TemplateMetricsStrip />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <CollapsibleSection
            id="overview"
            title="Template overview"
            subtitle="Identity, versioning, document type, and catalogue metadata."
            badge={<Badge variant="outline">Section 1</Badge>}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tpl-name">Template name</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. NHIA National Internal Memo — Executive Routing"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-code">Template code / reference</Label>
                <Input
                  id="tpl-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="NHIA-TPL-MEMO-001"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-version">Template version</Label>
                <Input
                  id="tpl-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <TemplateDocumentTypeSelect value={docType} onValueChange={setDocType} id="doc-type" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tpl-desc">Description</Label>
                <Textarea
                  id="tpl-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Purpose, audience, and compliance context for this reusable template."
                />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="scope"
            title="Organizational scope configuration"
            subtitle="Headquarters → Zone → State → Directorate → Department → Unit visibility."
            badge={<Badge variant="outline">Section 2</Badge>}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Scope level</Label>
                <Select value={scopeLevel} onValueChange={handleScopeLevelChange}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Where can this template be invoked?" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_LEVELS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hq">Headquarters</Label>
                <Input id="hq" value={hq} onChange={(e) => setHq(e.target.value)} placeholder="Abuja HQ" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone">Zone</Label>
                <Select
                  disabled={scopeLockedToAll || !orgScope}
                  value={
                    scopeLockedToAll
                      ? ORG_SCOPE_ALL
                      : zone === ''
                        ? undefined
                        : zone || undefined
                  }
                  onValueChange={(v) => {
                    setZone(v);
                    setStateOffice('');
                  }}
                >
                  <SelectTrigger id="zone" className="h-11">
                    <SelectValue placeholder={orgScope ? 'Select zone…' : 'Loading reference data…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeLockedToAll ? (
                      <SelectItem value={ORG_SCOPE_ALL}>All</SelectItem>
                    ) : (
                      <>
                        {zoneHasLegacy ? (
                          <SelectItem value={zone}>{zone} (saved)</SelectItem>
                        ) : null}
                        {orgScope?.zones.map((z) => (
                          <SelectItem key={z.code} value={z.code}>
                            {z.code} — {z.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State office</Label>
                <Select
                  disabled={scopeLockedToAll || !orgScope}
                  value={
                    scopeLockedToAll
                      ? ORG_SCOPE_ALL
                      : stateOffice === ''
                        ? undefined
                        : stateOffice || undefined
                  }
                  onValueChange={setStateOffice}
                >
                  <SelectTrigger id="state" className="h-11">
                    <SelectValue placeholder={orgScope ? 'Select state office…' : 'Loading…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeLockedToAll ? (
                      <SelectItem value={ORG_SCOPE_ALL}>All</SelectItem>
                    ) : (
                      <>
                        {stateLegacy ? (
                          <SelectItem value={stateOffice}>{stateOffice} (saved)</SelectItem>
                        ) : null}
                        {filteredStateOffices.map((s) => (
                          <SelectItem key={`${s.zoneCode}-${s.name}`} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dir">Directorate</Label>
                <Input id="dir" value={directorate} onChange={(e) => setDirectorate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept">Department</Label>
                <Select
                  disabled={scopeLockedToAll || !orgScope}
                  value={
                    scopeLockedToAll
                      ? ORG_SCOPE_ALL
                      : department === ''
                        ? undefined
                        : department || undefined
                  }
                  onValueChange={(v) => {
                    setDepartment(v);
                    setUnit('');
                  }}
                >
                  <SelectTrigger id="dept" className="h-11">
                    <SelectValue placeholder={orgScope ? 'Select department…' : 'Loading…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeLockedToAll ? (
                      <SelectItem value={ORG_SCOPE_ALL}>All</SelectItem>
                    ) : (
                      <>
                        {deptLegacy ? (
                          <SelectItem value={department}>{department} (saved)</SelectItem>
                        ) : null}
                        {orgScope?.departments.map((d) => (
                          <SelectItem key={d.id} value={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  disabled={scopeLockedToAll || !orgScope}
                  value={
                    scopeLockedToAll
                      ? ORG_SCOPE_ALL
                      : unit === ''
                        ? undefined
                        : unit || undefined
                  }
                  onValueChange={setUnit}
                >
                  <SelectTrigger id="unit" className="h-11">
                    <SelectValue placeholder={orgScope ? 'Select unit…' : 'Loading…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeLockedToAll ? (
                      <SelectItem value={ORG_SCOPE_ALL}>All</SelectItem>
                    ) : (
                      <>
                        {unitLegacy ? (
                          <SelectItem value={unit}>{unit} (saved)</SelectItem>
                        ) : null}
                        {filteredUnits.map((u) => (
                          <SelectItem key={u.id} value={u.name}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={restricted}
                  onChange={(e) => setRestricted(e.target.checked)}
                />
                Restrict template visibility to selected organizational nodes only
              </label>
            </div>

            <Separator className="my-2" />
            <p className="text-[11px] text-muted-foreground">
              Zones, state offices, departments, and units are loaded from NHIA reference data. When scope level is{' '}
              <span className="font-medium text-foreground">All</span>, zone/state/department/unit are stored as “all”.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            id="content"
            title="Template content builder"
            subtitle="Rich editor, placeholders, letterhead structure — DOCX import prepares migration path."
            badge={<Badge variant="outline">Section 3</Badge>}
            defaultOpen
          >
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PLACEHOLDER_VARIABLES.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] font-mono px-2"
                  onClick={() => appendPlaceholder(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) toast.success(`Queued “${f.name}” for ingestion pipeline (stub).`);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-4 w-4 mr-1.5" />
                Import DOCX / PDF (staging)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={scrollToPreview}>
                <Eye className="h-4 w-4 mr-1.5" />
                Preview panel
              </Button>
              <span className="text-[11px] text-muted-foreground self-center">
                Drag-and-drop blocks & reusable clauses — extend with block palette service.
              </span>
            </div>
            <MemoEditor
              documentTypeLabel={docTypeLabel}
              value={content}
              onChange={setContent}
              letterheadZoneCode={letterheadZoneCode}
              letterheadStateOfficeName={letterheadStateOfficeName}
              letterheadZones={orgScope?.zones}
            />

          </CollapsibleSection>

          <CollapsibleSection
            id="esign"
            title="E-signature & approval settings"
            subtitle="Maps to signatory registry and final-approve gates on the document agent."
            badge={<Badge variant="outline">Section 4</Badge>}
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={requireSignature}
                  onChange={(e) => setRequireSignature(e.target.checked)}
                />
                Require e-signature
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={digitalStamp}
                  onChange={(e) => setDigitalStamp(e.target.checked)}
                />
                Require digital stamp
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={delegatedSigning}
                  onChange={(e) => setDelegatedSigning(e.target.checked)}
                />
                Allow delegated signing
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={timestamping}
                  onChange={(e) => setTimestamping(e.target.checked)}
                />
                Enable timestamping
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={multiSignatory}
                  onChange={(e) => setMultiSignatory(e.target.checked)}
                />
                Multi-signatory approval
              </label>
              <div className="space-y-2 sm:col-span-2">
                <Label>Approval expiration window (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={approvalExpiryDays}
                  onChange={(e) => setApprovalExpiryDays(e.target.value)}
                />
              </div>
            </div>
            <Separator className="my-4" />
            <p className="text-xs font-medium text-foreground mb-2">Approval entities (catalog)</p>
            <div className="flex flex-wrap gap-1.5">
              {APPROVAL_ENTITY_LABELS.map((e) => (
                <Badge key={e} variant="secondary" className="text-[10px] font-normal">
                  {e}
                </Badge>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="records"
            title="Records management settings"
            subtitle="Retention, classification, versioning — enterprise archives alignment."
            badge={<Badge variant="outline">Section 5</Badge>}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Retention period (years)</Label>
                <Input type="number" min={1} value={retentionYears} onChange={(e) => setRetentionYears(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Archive category</Label>
                <Select value={archiveCategory} onValueChange={setArchiveCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="official_record">Official record</SelectItem>
                    <SelectItem value="policy">Policy instrument</SelectItem>
                    <SelectItem value="operational">Operational file</SelectItem>
                    <SelectItem value="legal_hold">Legal hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Metadata tags</Label>
                <Input value={metadataTags} onChange={(e) => setMetadataTags(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Classification code</Label>
                <Select value={classification} onValueChange={setClassification}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="official">Official</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Compliance policy</Label>
                <Input value={compliancePolicy} onChange={(e) => setCompliancePolicy(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={autoArchive}
                  onChange={(e) => setAutoArchive(e.target.checked)}
                />
                Auto-archive rule (lifecycle)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={versioningEnabled}
                  onChange={(e) => setVersioningEnabled(e.target.checked)}
                />
                Versioning enabled
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={immutableAudit}
                  onChange={(e) => setImmutableAudit(e.target.checked)}
                />
                Immutable audit trail on template mutations
              </label>
            </div>
            <CardMiniHistory />
          </CollapsibleSection>

          <CollapsibleSection
            id="security"
            title="Security & access control"
            subtitle="Align with agency IAM, encryption, and watermarking policies."
            badge={<Badge variant="outline">Section 6</Badge>}
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={restrictEdit}
                  onChange={(e) => setRestrictEdit(e.target.checked)}
                />
                Restrict editing
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={restrictDownload}
                  onChange={(e) => setRestrictDownload(e.target.checked)}
                />
                Restrict downloads
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={encryptOutput}
                  onChange={(e) => setEncryptOutput(e.target.checked)}
                />
                Encrypt generated documents
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={watermark}
                  onChange={(e) => setWatermark(e.target.checked)}
                />
                Watermark generated documents
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={auditTracking}
                  onChange={(e) => setAuditTracking(e.target.checked)}
                />
                Enable audit tracking
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={requireMfa}
                  onChange={(e) => setRequireMfa(e.target.checked)}
                />
                Require MFA for publishing
              </label>
            </div>
          </CollapsibleSection>
        </div>

        <aside ref={previewAsideRef} className="xl:col-span-4 space-y-4">
          <TemplatePreviewPanel
            templateName={name}
            templateCode={code}
            docTypeLabel={docTypeLabel}
            scopeLabel={scopeLabel}
            html={content}
            zoneCode={letterheadZoneCode}
            stateOfficeName={letterheadStateOfficeName}
          />
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground flex items-center gap-2">
              <History className="h-3.5 w-3.5" />
              Persistence
            </p>
            {templateId && loadedTemplate ? (
              <>
                <p className="font-mono text-[10px] break-all">{loadedTemplate.id}</p>
                <p>
                  Last saved{' '}
                  {loadedTemplate.updated_at
                    ? formatDateTime(loadedTemplate.updated_at)
                    : formatDateTime(loadedTemplate.created_at)}
                </p>
                <p className="capitalize">Status: {loadedTemplate.status}</p>
              </>
            ) : (
              <p>Save a draft to persist this template to the server.</p>
            )}
          </div>
        </aside>
      </div>

      <DialogRoot open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogContent className="fixed left-[50%] top-[50%] z-50 max-h-[92vh] w-[min(100vw-2rem,56rem)] max-w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border bg-background p-4 shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex items-start justify-between gap-2 mb-2">
              <DialogTitle className="text-lg font-semibold text-left">Template preview</DialogTitle>
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="shrink-0">
                  Close
                </Button>
              </DialogClose>
            </div>
            <DialogDescription className="sr-only">
              Letterhead preview with sample placeholder values for the template body.
            </DialogDescription>
            <div className="overflow-y-auto max-h-[calc(92vh-5rem)] pr-1">
              <TemplatePreviewPanel
                variant="embedded"
                templateName={name}
                templateCode={code}
                docTypeLabel={docTypeLabel}
                scopeLabel={scopeLabel}
                html={content}
                zoneCode={letterheadZoneCode}
                stateOfficeName={letterheadStateOfficeName}
                className="shadow-none border-border lg:static lg:top-auto"
              />
            </div>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md py-3 px-4 md:px-8">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSaveDraft} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save as draft
            </Button>
            <Button size="sm" variant="default" onClick={handlePublish} disabled={saving}>
              <Send className="h-4 w-4 mr-1.5" />
              Publish template
            </Button>
            <Button size="sm" variant="outline" onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-1.5" />
              Duplicate
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPreviewModalOpen(true)}>
              <Eye className="h-4 w-4 mr-1.5" />
              Preview
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!templateId || archiveMutation.isPending}
              onClick={() => templateId && archiveMutation.mutate()}
            >
              <Archive className="h-4 w-4 mr-1.5" />
              Archive
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </Button>
          </div>
          <Link to="/template-management" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Back to list
          </Link>
        </div>
      </div>
    </div>
  );
}

function CardMiniHistory() {
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/15 p-4 mt-4">
      <p className="text-xs font-medium text-foreground mb-2">Template activity log (preview)</p>
      <ul className="text-[11px] text-muted-foreground space-y-1.5">
        <li>— Draft created · awaiting catalogue binding</li>
        <li>— Change history & revision tracking enabled when connected to audit service</li>
      </ul>
    </div>
  );
}
