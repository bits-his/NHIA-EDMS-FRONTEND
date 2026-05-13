import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  User,
  FileText,
  Shield,
  Hash,
  FileDown,
  Users,
  Paperclip,
  Building2,
  Tag,
  Zap,
  Upload,
  Download,
  GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { DocumentActions } from '@/components/documents/DocumentActions';
import { DocumentActivitySidebar } from '@/components/documents/DocumentActivitySidebar';
import { DocumentCommentsSection } from '@/components/documents/DocumentCommentsSection';
import { DocumentDiscussionsPanel } from '@/components/documents/DocumentDiscussionsPanel';
import { WorkflowBpmnPanel } from '@/components/documents/WorkflowBpmnPanel';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { documentsApi } from '@/api/documents';
import { auditApi } from '@/api/audit';
import { authApi, type UserRecord } from '@/api/auth';
import { tasksApi } from '@/api/tasks';
import { workflowApi } from '@/api/workflow';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { getErrorMessage } from '@/api/client';
import { isUuid } from '@/utils/uuid';
import { hasActiveTaskOnCurrentWorkflowStep } from '@/utils/hasActiveTaskOnCurrentWorkflowStep';
import {
  getPendingDocumentWorkflowStageLabel,
  getWorkflowStepDefinitionForInstance,
} from '@/utils/workflowStageLabel';
import { getDocumentActions } from '@/utils/permissions';
import { NhiaMemoLetterhead } from '@/components/documents/NhiaMemoLetterhead';
import { documentTypeHeadline, stripFirstHtmlBlockMatchingTitle } from '@/utils/documentDisplay';
import { buildDocumentExportHtml } from '@/utils/documentExport';
import { roleDisplayLabel } from '@/utils/recipientPicker';
import type { RecipientType } from '@/types/document';
import type { Role } from '@/types/auth';

const CATEGORY_LABEL: Record<string, string> = {
  internal_memo: 'Internal memo',
  external_correspondence: 'External correspondence',
};

const URGENCY_LABEL: Record<string, string> = {
  normal: 'Normal',
  urgent: 'Urgent',
  very_urgent: 'Very urgent',
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  normal: 'Normal',
  important: 'Important',
  secret: 'Secret',
  top_secret: 'Top secret',
};

const DELIVERY_LABEL: Record<string, string> = {
  workflow: 'Workflow',
  direct_message: 'Direct message',
};

const RECIPIENT_TYPE_TONE: Record<string, string> = {
  to: 'bg-primary/10 text-primary',
  cc: 'bg-muted text-muted-foreground',
  bcc: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
};

function userDisplayName(profile: UserRecord | undefined, fallback: string): string {
  return profile?.full_name?.trim() || profile?.username?.trim() || fallback;
}

function userRoleContext(profile: UserRecord | undefined, roles: Role[] | undefined): string {
  if (!profile) return '';
  const rank =
    profile.rank?.trim() ||
    profile.roles
      ?.map((r) => roleDisplayLabel(roles?.find((x) => x.id === r.id) ?? r))
      .filter(Boolean)
      .join(', ');
  const parts = [rank, profile.department?.trim()].filter(Boolean);
  return parts.join(', ');
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipientOpen, setRecipientOpen] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('to');

  const documentIdValid = !!id && isUuid(id);

  const { data: doc, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.document(id!),
    queryFn: () => documentsApi.getById(id!),
    enabled: documentIdValid,
  });

  const isInternalMemo = doc?.category === 'internal_memo';

  const { data: orgScope } = useQuery({
    queryKey: QUERY_KEYS.orgScopeReference,
    queryFn: () => documentsApi.getOrgScopeReference(),
    enabled: documentIdValid && isInternalMemo,
  });

  const templateId = doc?.template_id;
  const { data: docTemplate } = useQuery({
    queryKey: QUERY_KEYS.documentTemplate(templateId ?? '__none__'),
    queryFn: () => documentsApi.getTemplate(templateId!),
    enabled: documentIdValid && isInternalMemo && !!templateId,
  });

  const { data: signatorySignatureObjectUrl } = useQuery({
    queryKey: QUERY_KEYS.documentSignatorySignature(id!),
    queryFn: async () => {
      const blob = await documentsApi.getDocumentSignatorySignatureBlob(id!);
      return URL.createObjectURL(blob);
    },
    enabled: documentIdValid && isInternalMemo && !!doc?.signatory_id,
    retry: false,
    throwOnError: false,
  });

  useEffect(() => {
    return () => {
      if (signatorySignatureObjectUrl) URL.revokeObjectURL(signatorySignatureObjectUrl);
    };
  }, [signatorySignatureObjectUrl]);

  const { data: myTasks } = useQuery({
    queryKey: QUERY_KEYS.tasks(user?.user_id ?? ''),
    queryFn: () => tasksApi.list(user!.user_id),
    enabled: !!user?.user_id && doc?.status === 'pending',
  });

  const { data: wfInstance } = useQuery({
    queryKey: QUERY_KEYS.workflowInstanceByDocument(id!),
    queryFn: () => workflowApi.getInstanceByDocumentId(id!),
    enabled: documentIdValid && doc?.status === 'pending',
  });

  /** Workflow template name — fetched whenever the doc carries a workflow selection, regardless of status. */
  const workflowTemplateLookupId =
    wfInstance?.template_id || doc?.selected_workflow_template_id || null;

  const { data: wfTemplate } = useQuery({
    queryKey: QUERY_KEYS.workflowTemplate(workflowTemplateLookupId ?? ''),
    queryFn: () => workflowApi.getTemplateById(workflowTemplateLookupId!),
    enabled: !!workflowTemplateLookupId,
  });

  const hasActiveWorkflowTaskForDoc = useMemo(
    () => hasActiveTaskOnCurrentWorkflowStep(myTasks, doc?.id ?? '', wfInstance),
    [myTasks, doc?.id, wfInstance]
  );

  const wfMaxStep = useMemo(() => {
    if (!wfTemplate?.steps?.length) return 0;
    const nums = wfTemplate.steps.map((s) => {
      const raw = s.step_number ?? ('step' in s ? (s as { step?: number }).step : undefined);
      const n = Number(raw ?? 0);
      return Number.isFinite(n) && n > 0 ? n : 0;
    });
    return Math.max(...nums, 0);
  }, [wfTemplate]);

  const currentWorkflowStepDef = useMemo(
    () => getWorkflowStepDefinitionForInstance(wfInstance ?? undefined, wfTemplate ?? undefined),
    [wfInstance, wfTemplate]
  );

  const workflowStepActionType = currentWorkflowStepDef?.action_type ?? null;

  const workflowInstanceIdForActions = useMemo(() => {
    if (!doc || doc.status !== 'pending' || !wfInstance) return null;
    const active = new Set(['active', 'in_progress', 'pending_approval', 'pending_review']);
    if (!active.has(String(wfInstance.status))) return null;
    if (!hasActiveWorkflowTaskForDoc) return null;
    return wfInstance.id;
  }, [doc, wfInstance, hasActiveWorkflowTaskForDoc]);

  /** Includes the last template step so advance can complete the workflow (next step > max). */
  const canAdvanceWorkflow = useMemo(() => {
    if (!wfInstance || wfMaxStep < 1) return false;
    const active = new Set(['active', 'in_progress', 'pending_approval', 'pending_review']);
    if (!active.has(String(wfInstance.status))) return false;
    const cur = wfInstance.current_step ?? 0;
    return cur >= 1 && cur <= wfMaxStep;
  }, [wfInstance, wfMaxStep]);

  const pendingStageLabel = useMemo(
    () =>
      doc?.status === 'pending'
        ? getPendingDocumentWorkflowStageLabel(wfInstance ?? undefined, wfTemplate ?? undefined)
        : null,
    [doc?.status, wfInstance, wfTemplate]
  );

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: QUERY_KEYS.documentVersions(id!),
    queryFn: () => documentsApi.getVersions(id!),
    enabled: documentIdValid,
  });

  const {
    data: auditLogs,
    isLoading: auditLoading,
    isError: auditIsError,
    error: auditError,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: QUERY_KEYS.auditLogsForDocument(id!),
    queryFn: () => auditApi.getLogsForDocument(id!),
    enabled: documentIdValid,
    retry: 1,
  });

  const { data: recipients } = useQuery({
    queryKey: QUERY_KEYS.documentRecipients(id!),
    queryFn: () => documentsApi.listRecipients(id!),
    enabled: documentIdValid,
  });

  const currentDirectMessageRecipientId = useMemo(() => {
    if (doc?.delivery_mode !== 'direct_message' || !recipients?.length) return null;
    const sorted = [...recipients].sort((a, b) => {
      const ta = new Date(a.created_at ?? '').getTime();
      const tb = new Date(b.created_at ?? '').getTime();
      return tb - ta;
    });
    return sorted[0]?.user_id ?? null;
  }, [doc?.delivery_mode, recipients]);

  const isDirectMessageRecipient =
    !!user?.user_id &&
    !!currentDirectMessageRecipientId &&
    doc?.delivery_mode === 'direct_message' &&
    currentDirectMessageRecipientId === user.user_id;

  const { data: attachments } = useQuery({
    queryKey: QUERY_KEYS.documentAttachments(id!),
    queryFn: () => documentsApi.listAttachments(id!),
    enabled: documentIdValid,
  });

  const { data: workflowActions, isLoading: workflowActionsLoading } = useQuery({
    queryKey: QUERY_KEYS.documentWorkflowActions(id!),
    queryFn: () => documentsApi.listWorkflowActions(id!),
    enabled: documentIdValid,
  });

  const { data: users } = useQuery({
    queryKey: ['auth-users'],
    queryFn: () => authApi.listUsers(),
    enabled: documentIdValid,
  });

  const { data: roles } = useQuery({
    queryKey: ['auth-roles'],
    queryFn: () => authApi.listRoles(),
    enabled: documentIdValid,
  });

  const userById = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  /** Permissions context — mirror what the action toolbar uses so we can show the composer. */
  const docActionsAvailable = useMemo(() => {
    if (!doc) return null;
    return getDocumentActions(
      doc.status,
      user?.roles ?? [],
      {
        permissions: user?.permissions ?? [],
        userId: user?.user_id,
        ownerId: doc.owner_id,
        hasActiveWorkflowTask: hasActiveWorkflowTaskForDoc,
        deliveryMode: doc.delivery_mode ?? null,
        isDirectMessageRecipient,
      },
      workflowStepActionType
    );
  }, [
    doc,
    user?.roles,
    user?.permissions,
    user?.user_id,
    hasActiveWorkflowTaskForDoc,
    workflowStepActionType,
    isDirectMessageRecipient,
  ]);

  const canPostComment = !!docActionsAvailable?.canEditForward;
  const inlineWorkflowActionEnabled =
    canPostComment &&
    doc?.delivery_mode === 'workflow' &&
    !!workflowInstanceIdForActions &&
    canAdvanceWorkflow;

  const isOwner = !!user?.user_id && !!doc?.owner_id && user.user_id === doc.owner_id;
  const canAddRecipient = isOwner && (doc?.status === 'draft' || doc?.status === 'pending');
  const canUploadAttachment = isOwner && (doc?.status === 'draft' || doc?.status === 'pending');

  /**
   * Build a single printable HTML view that captures EVERYTHING on the page:
   * NHIA letterhead (when available), document body, profile metadata,
   * recipients, attachments, comments / activity timeline, and versions.
   * The user can print or save as PDF from the new tab's toolbar.
   *
   * For internal memos we fetch the server letterhead so the export keeps the
   * official banner; otherwise we render a standalone shell that still includes
   * the title and body, plus all of the additional sections.
   */
  const exportMutation = useMutation({
    mutationFn: async (): Promise<string | null> => {
      if (!isInternalMemo) return null;
      try {
        return await documentsApi.getPreviewHtml(id!);
      } catch {
        // Letterhead is optional — fall back to the standalone export shell.
        return null;
      }
    },
  });

  /** Open a tab synchronously on click (user gesture), then stream HTML — avoids pop-up blockers. */
  const openDocumentExport = () => {
    if (!id || !doc) return;
    const w = window.open('about:blank', '_blank');
    if (!w) {
      toast.error('Could not open the export. Allow pop-ups for this site and try again.');
      return;
    }
    exportMutation.mutate(undefined, {
      onSuccess: (letterheadHtml) => {
        try {
          const usernameFor = (uid: string | null | undefined) => resolveUsername(uid);
          const html = buildDocumentExportHtml({
            doc,
            letterheadHtml,
            recipients,
            attachments,
            actions: workflowActions,
            versions,
            ownerName: resolveUsername(doc.owner_id),
            usernameFor,
          });
          w.document.open();
          w.document.write(html);
          w.document.close();
        } catch {
          w.close();
          toast.error('Export could not be displayed. Try again or check browser restrictions.');
          return;
        }
        try {
          w.opener = null;
        } catch {
          /* ignore */
        }
      },
      onError: (e) => {
        w.close();
        toast.error(getErrorMessage(e));
      },
    });
  };

  const addRecipientMutation = useMutation({
    mutationFn: () =>
      documentsApi.addRecipient(id!, { user_id: recipientUserId, recipient_type: recipientType }),
    onSuccess: () => {
      toast.success('Recipient added');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentRecipients(id!) });
      setRecipientOpen(false);
      setRecipientUserId('');
      setRecipientType('to');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.uploadAttachment(id!, file),
    onSuccess: () => {
      toast.success('Attachment uploaded');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentAttachments(id!) });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const downloadAttachment = async (attachmentId: string, filename: string) => {
    try {
      const blob = await documentsApi.downloadAttachmentBlob(id!, attachmentId);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (!documentIdValid) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4" /> Documents
        </Button>
        <ErrorState
          title="Invalid document link"
          error={
            new Error(
              'This URL is not a valid document id. Open Documents from the sidebar and pick an item from the list.'
            )
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4" /> Documents
        </Button>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (isLoading || !doc) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="-ml-1">
          <ArrowLeft className="h-4 w-4" /> Documents
        </Button>
        <div className="space-y-3">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const ownerProfile = doc.owner_id ? userById.get(doc.owner_id) : undefined;
  const ownerName = userDisplayName(ownerProfile, resolveUsername(doc.owner_id));
  const ownerContext =
    userRoleContext(ownerProfile, roles) || (doc.department ? doc.department.trim() : '');
  const departmentName = doc.department || '—';
  const urgencyLabel = URGENCY_LABEL[doc.urgency ?? 'normal'] ?? doc.urgency ?? 'Normal';
  const deliveryLabel = doc.delivery_mode ? DELIVERY_LABEL[doc.delivery_mode] ?? doc.delivery_mode : '—';
  const categoryLabel = doc.category ? CATEGORY_LABEL[doc.category] ?? doc.category : '—';
  const classificationLabel = doc.file_classification
    ? CLASSIFICATION_LABEL[doc.file_classification] ?? doc.file_classification
    : '—';
  const inputModeLabel = doc.input_mode
    ? doc.input_mode === 'template'
      ? 'Template'
      : 'Manual entry'
    : '—';
  const documentDateValue = doc.document_effective_date
    ? formatDateTime(doc.document_effective_date)
    : '—';
  const receivedDateValue = doc.receive_recorded_at
    ? formatDateTime(doc.receive_recorded_at)
    : formatDateTime(doc.created_at);

  /** "<p></p>" / "<p><br></p>" / "&nbsp;" should not look like real body text. */
  const bodyHtml = doc.content ?? '';
  const bodyPlainText = bodyHtml
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|\u00A0/g, ' ')
    .trim();
  const hasBodyText = bodyPlainText.length > 0;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> Documents
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {documentTypeHeadline(doc)}
            </p>
            <h1
              className="text-xl font-bold tracking-tight text-foreground leading-tight mt-0.5"
              title={doc.title || undefined}
            >
              {doc.title?.trim() || 'Untitled document'}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <DocumentStatusBadge
                status={doc.status}
                pendingStageLabel={pendingStageLabel}
                statusLabel={doc.status_label}
              />
              {doc.category && (
                <Badge variant="secondary" className="text-xs font-normal">
                  <Tag className="h-3 w-3 mr-1" />
                  {categoryLabel}
                </Badge>
              )}
              {doc.ref_number && (
                <Badge variant="outline" className="text-xs font-mono font-normal">
                  {doc.ref_number}
                </Badge>
              )}
              {doc.urgency && doc.urgency !== 'normal' && (
                <Badge variant="outline" className="text-xs capitalize">
                  <Zap className="h-3 w-3 mr-1" />
                  {doc.urgency.replace('_', ' ')}
                </Badge>
              )}
              {doc.delivery_mode && (
                <Badge variant="outline" className="text-xs">
                  {DELIVERY_LABEL[doc.delivery_mode] ?? doc.delivery_mode}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatRelative(doc.updated_at)}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="capitalize">{ownerName}</span>
              </span>
              {doc.department && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {doc.department}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={exportMutation.isPending}
            onClick={openDocumentExport}
          >
            <FileDown className="h-4 w-4" /> Export document
          </Button>
          <DocumentActions
            document={doc}
            roles={user?.roles ?? []}
            actionContext={{
              permissions: user?.permissions ?? [],
              userId: user?.user_id,
              ownerId: doc.owner_id,
              hasActiveWorkflowTask: hasActiveWorkflowTaskForDoc,
              deliveryMode: doc.delivery_mode ?? null,
              isDirectMessageRecipient,
            }}
            workflowInstanceId={workflowInstanceIdForActions}
            canAdvanceWorkflow={canAdvanceWorkflow}
            workflowCurrentStep={wfInstance?.current_step ?? null}
            workflowStepActionType={workflowStepActionType}
            suppressWorkflowStepActions={inlineWorkflowActionEnabled}
          />
        </div>
      </div>

      {/* Main grid: memo card (left) + activity sidebar (right) */}
      <div className="lg:grid lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start space-y-6 xl:space-y-0">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden border-border/80 shadow-sm">
            {isInternalMemo && (
              <NhiaMemoLetterhead
                documentTypeLabel={documentTypeHeadline(doc)}
                zoneCode={docTemplate?.metadata?.zone}
                stateOfficeName={docTemplate?.metadata?.state_office}
                zones={orgScope?.zones}
              />
            )}

            <CardContent className="px-0 pb-6 pt-0">
              <div className="divide-y divide-border">
                {/* Mode & routing (mirrors the create page) */}
                <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-mode">
                  <h3
                    id="section-mode"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Mode &amp; routing
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReadOnlyField label="Delivery" value={deliveryLabel} />
                    <ReadOnlyField label="Document input" value={inputModeLabel} />
                  </div>
                  {doc.delivery_mode === 'workflow' && (
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5 text-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Workflow
                      </p>
                      <p className="text-foreground">
                        {wfTemplate?.name?.trim()
                          ? wfTemplate.name
                          : workflowTemplateLookupId
                            ? 'Loading workflow template…'
                            : 'No workflow template recorded.'}
                      </p>
                    </div>
                  )}
                  {doc.delivery_mode === 'direct_message' && (
                    <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                      Direct message: tagged recipients can comment, request info or reject. The owner reviews and marks as
                      reviewed — no workflow is started.
                    </div>
                  )}
                </section>

                {/* Document source — conditional on internal vs external + template vs manual */}
                <section className="space-y-3 px-4 py-6 sm:px-6" aria-labelledby="section-source">
                  <h3
                    id="section-source"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Document source
                  </h3>
                  {isInternalMemo ? (
                    doc.input_mode === 'template' ? (
                      <div className="rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          Document template
                        </p>
                        <p className="text-foreground">
                          {docTemplate?.name?.trim()
                            ? `${docTemplate.name}${docTemplate.status ? ` (${docTemplate.status})` : ''}`
                            : templateId
                              ? 'Loading template…'
                              : 'No template selected.'}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
                        Manual entry — no catalogue template was applied to the body.
                      </div>
                    )
                  ) : (
                    <div className="rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        External upload
                      </p>
                      <p className="text-foreground flex items-center gap-2 break-all">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {doc.original_filename || doc.intake_file_name || '—'}
                      </p>
                      {doc.intake_file_name && doc.intake_file_name !== doc.original_filename && (
                        <p className="text-xs text-muted-foreground">
                          Display name: <span className="font-medium text-foreground">{doc.intake_file_name}</span>
                        </p>
                      )}
                    </div>
                  )}
                </section>

                {/* Document profile (read-only mirror of the create-page section) */}
                <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-profile">
                  <h3
                    id="section-profile"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Document profile
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReadOnlyField label="Subject" value={doc.title?.trim() || '—'} />
                    <ReadOnlyField label="Reference number" value={doc.ref_number || '—'} mono />
                    <ReadOnlyField label="Document date" value={documentDateValue} />
                    <ReadOnlyField label="Received" value={receivedDateValue} />
                    <ReadOnlyField label="Category" value={categoryLabel} />
                    <ReadOnlyField label="Urgency" value={urgencyLabel} />
                    <ReadOnlyField label="Classification" value={classificationLabel} />
                    <ReadOnlyField label="Department" value={departmentName} />
                    <ReadOnlyField label="Owner" value={ownerName} className="capitalize" />
                  </div>
                </section>

                {/* Sender & recipients */}
                <section className="space-y-3 px-4 py-6 sm:px-6" aria-labelledby="section-recipients">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3
                      id="section-recipients"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"
                    >
                      <Users className="h-3.5 w-3.5" /> Sender &amp; recipients
                    </h3>
                    {canAddRecipient && (
                      <Button variant="outline" size="sm" onClick={() => setRecipientOpen(true)}>
                        Add recipient
                      </Button>
                    )}
                  </div>
                  <div className="rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Sender
                      </span>
                      <span className="font-medium capitalize">{ownerName}</span>
                    </div>
                    {ownerContext && (
                      <p className="mt-1 text-xs text-muted-foreground">{ownerContext}</p>
                    )}
                  </div>
                  {!recipients?.length ? (
                    <p className="text-sm text-muted-foreground italic">
                      {doc.delivery_mode === 'direct_message'
                        ? 'Direct message: no recipients tagged yet.'
                        : 'No recipients tagged.'}
                    </p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {recipients.map((r) => {
                        const typeKey = (r.recipient_type ?? 'to').toLowerCase();
                        const tone = RECIPIENT_TYPE_TONE[typeKey] ?? 'bg-muted text-muted-foreground';
                        const recipientProfile = userById.get(r.user_id);
                        const recipientName = userDisplayName(
                          recipientProfile,
                          resolveUsername(r.user_id)
                        );
                        const recipientContext = userRoleContext(recipientProfile, roles);
                        return (
                          <li
                            key={r.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm"
                          >
                            <span className="min-w-0">
                              <span className="block font-medium capitalize truncate">
                                {recipientName}
                              </span>
                              {recipientContext && (
                                <span className="block text-xs text-muted-foreground truncate">
                                  {recipientContext}
                                </span>
                              )}
                            </span>
                            <span
                              className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${tone}`}
                            >
                              {r.recipient_type}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {/* Body */}
                <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-body">
                  <h3
                    id="section-body"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {doc.category === 'external_correspondence' ? 'Body / notes' : 'Body'}
                  </h3>
                  {doc.category === 'external_correspondence' && doc.original_filename && (
                    <Alert variant="info" className="border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20">
                      <FileText className="h-4 w-4" />
                      <AlertDescription>
                        Primary file: <strong>{doc.original_filename}</strong> (stored on server).
                      </AlertDescription>
                    </Alert>
                  )}
                  {hasBodyText ? (
                    <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
                      <div
                        className="prose prose-sm max-w-none px-5 py-4 text-foreground"
                        dangerouslySetInnerHTML={{
                          __html: doc.title?.trim()
                            ? stripFirstHtmlBlockMatchingTitle(bodyHtml, doc.title)
                            : bodyHtml,
                        }}
                      />
                      {doc.signatory_id && signatorySignatureObjectUrl ? (
                        <div className="border-t border-border/60 bg-background px-5 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Authorised signatory
                          </p>
                          <img
                            src={signatorySignatureObjectUrl}
                            alt="Signature"
                            className="max-h-24 max-w-[280px] object-contain"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : doc.category === 'external_correspondence' ? (
                    <p className="text-sm text-muted-foreground italic py-2">
                      No notes were entered. The uploaded file above is the primary content.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic py-2">
                      No body text was entered. Edit the document to add memo content.
                    </p>
                  )}
                </section>

                {/* Attachments */}
                <section className="space-y-3 px-4 py-6 sm:px-6" aria-labelledby="section-attachments">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3
                      id="section-attachments"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"
                    >
                      <Paperclip className="h-3.5 w-3.5" /> Supporting attachments
                    </h3>
                    {canUploadAttachment && (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadMutation.mutate(f);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          loading={uploadMutation.isPending}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4" /> Upload
                        </Button>
                      </div>
                    )}
                  </div>
                  {!attachments?.length ? (
                    <p className="text-sm text-muted-foreground italic">No attachments.</p>
                  ) : (
                    <ul className="space-y-2">
                      {attachments.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-2 text-sm border border-border/60 rounded-lg px-3 py-2 bg-background"
                        >
                          <span className="truncate flex items-center gap-2">
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {a.filename}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => downloadAttachment(a.id, a.filename)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Comments */}
                <DocumentCommentsSection
                  documentId={doc.id}
                  actions={workflowActions}
                  actionsLoading={workflowActionsLoading}
                  canComment={canPostComment}
                  isDirectMessage={doc.delivery_mode === 'direct_message'}
                  isWorkflow={doc.delivery_mode === 'workflow'}
                  workflowInstanceId={workflowInstanceIdForActions}
                  canAdvanceWorkflow={canAdvanceWorkflow}
                  workflowStepActionType={workflowStepActionType}
                  ownUserId={user?.user_id ?? null}
                  currentUserIds={recipients?.map((r) => r.user_id) ?? []}
                />
              </div>
            </CardContent>
          </Card>

          {/* Secondary inspectors — audit + BPMN — kept as tabs to avoid stretching the page. */}
          <Tabs defaultValue="audit">
            <TabsList>
              <TabsTrigger value="audit">
                <Shield className="h-3.5 w-3.5" /> Audit {auditLogs ? `(${auditLogs.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value="workflow">
                <GitBranch className="h-3.5 w-3.5" /> Workflow
              </TabsTrigger>
              <TabsTrigger value="versions">
                <Hash className="h-3.5 w-3.5" /> Versions {versions ? `(${versions.length})` : ''}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Audit Trail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditIsError ? (
                    <ErrorState
                      error={auditError}
                      title="Could not load audit trail"
                      onRetry={() => void refetchAudit()}
                    />
                  ) : (
                    <AuditTimeline logs={auditLogs ?? []} loading={auditLoading} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workflow">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4" /> BPMN routing &amp; approvals
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">
                    Read-only view of the workflow engine path (linear orchestration). Approvals and transitions
                    continue to run through existing APIs.
                  </p>
                </CardHeader>
                <CardContent>
                  <WorkflowBpmnPanel documentId={doc.id} documentStatus={doc.status} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="versions">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="h-4 w-4" /> Version History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {versionsLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : !versions?.length ? (
                    <p className="text-sm text-muted-foreground">No versions.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {[...versions]
                        .sort((a, b) => b.version_number - a.version_number)
                        .map((v) => (
                          <li
                            key={v.id}
                            className="flex justify-between gap-2 border border-border/60 rounded-lg px-3 py-2"
                          >
                            <span className="font-medium">v{v.version_number}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatDateTime(v.created_at)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 space-y-4">
          <DocumentActivitySidebar
            createdAt={doc.created_at}
            actions={workflowActions}
            actionsLoading={workflowActionsLoading}
            versions={versions}
            versionsLoading={versionsLoading}
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
            <strong>Export document</strong> opens a printable view with the full case file:
            NHIA letterhead (for internal memos), document body, profile, recipients,
            attachments and the complete comments &amp; activity timeline. Use your
            browser's print dialog to save it as a PDF.
          </p>
        </aside>
      </div>

      <Dialog open={recipientOpen} onOpenChange={setRecipientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add recipient</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>User</Label>
              <Select value={recipientUserId} onValueChange={setRecipientUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={recipientType}
                onValueChange={(v) => setRecipientType(v as RecipientType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to">To</SelectItem>
                  <SelectItem value="cc">CC</SelectItem>
                  <SelectItem value="bcc">BCC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipientOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={addRecipientMutation.isPending}
              disabled={!recipientUserId}
              onClick={() => addRecipientMutation.mutate()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/**
       * Floating discussions widget — anchored to the viewport so users can pop
       * private side-chats open without navigating away from the document.
       */}
      <DocumentDiscussionsPanel documentId={doc.id} currentUserId={user?.user_id ?? null} />
    </div>
  );
}

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}

function ReadOnlyField({ label, value, mono, className }: ReadOnlyFieldProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-sm ${mono ? 'font-mono' : ''} ${className ?? ''} text-foreground`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
