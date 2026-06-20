import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  User,
  FileText,
  FileDown,
  Paperclip,
  Building2,
  Tag,
  Zap,
  Upload,
  Download,
  Trash2,
  GitBranch,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { DocumentActions } from '@/components/documents/DocumentActions';
import { DocumentActivitySidebar } from '@/components/documents/DocumentActivitySidebar';
import { DocumentCommentsSection } from '@/components/documents/DocumentCommentsSection';
import { DocumentDiscussionsPanel } from '@/components/documents/DocumentDiscussionsPanel';
import { ExternalPrimaryFileViewer } from '@/components/documents/ExternalPrimaryFileViewer';
import { SupportingAttachmentPreviewDialog } from '@/components/documents/SupportingAttachmentPreviewDialog';
import { WorkflowBpmnPanel } from '@/components/documents/WorkflowBpmnPanel';
import { documentsApi } from '@/api/documents';
import { authApi, type UserRecord } from '@/api/auth';
import { tasksApi } from '@/api/tasks';
import { workflowApi } from '@/api/workflow';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDateTime, formatRelative, isDocumentAssignmentOverdue } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { getErrorMessage } from '@/api/client';
import type { DocumentAttachment } from '@/types/document';
import { isUuid } from '@/utils/uuid';
import { hasActiveTaskOnCurrentWorkflowStep } from '@/utils/hasActiveTaskOnCurrentWorkflowStep';
import { wasReturnedForMoreInfo } from '@/utils/wasReturnedForMoreInfo';
import {
  getPendingDocumentWorkflowStageLabel,
  getWorkflowStepDefinitionForInstance,
} from '@/utils/workflowStageLabel';
import { getDocumentActions, normalizeWorkflowStepActionType } from '@/utils/permissions';
import { NhiaMemoLetterhead } from '@/components/documents/NhiaMemoLetterhead';
import { documentTypeHeadline, stripFirstHtmlBlockMatchingTitle } from '@/utils/documentDisplay';
import { correspondenceDirectionLabel } from '@/utils/correspondence';
import { buildDocumentExportHtml, inlineExportImagesInHtml } from '@/utils/documentExport';
import {
  buildRankFilterOptions,
  groupDocumentRecipientsByType,
  isReadOnlyDocumentRecipient,
  RECIPIENT_TYPE_LABEL,
  RECIPIENT_TYPE_ORDER,
  recipientUserLabel,
  roleDisplayLabel,
  userMatchesRankFilter,
} from '@/utils/recipientPicker';
import { workflowAssigneeRoleLabel } from '@/utils/workflowEditor';
import type { DocumentRecipient, RecipientType } from '@/types/document';
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

function DocumentDetailToolbar({
  onBack,
  onOpenProfile,
  onOpenWorkflow,
  onExport,
  exportLoading = false,
  showWorkflow = false,
}: {
  onBack: () => void;
  onOpenProfile?: () => void;
  onOpenWorkflow?: () => void;
  onExport?: () => void;
  exportLoading?: boolean;
  showWorkflow?: boolean;
}) {
  return (
    <div
      className="inline-flex flex-wrap items-center rounded-lg border border-border/70 bg-muted/25 p-1 gap-0.5"
      role="toolbar"
      aria-label="Document navigation"
    >
      <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      {onExport && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0"
          onClick={onExport}
          loading={exportLoading}
        >
          <FileDown className="h-4 w-4" />
          Export document
        </Button>
      )}
      {onOpenProfile && (
        <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={onOpenProfile}>
          <FileText className="h-4 w-4" />
          Document profile
        </Button>
      )}
      {showWorkflow && onOpenWorkflow && (
        <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={onOpenWorkflow}>
          <GitBranch className="h-4 w-4" />
          View workflow
        </Button>
      )}
    </div>
  );
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipientOpen, setRecipientOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [recipientRank, setRecipientRank] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('to');
  const [attachmentToDelete, setAttachmentToDelete] = useState<{
    id: string;
    filename: string;
  } | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<DocumentAttachment | null>(null);

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

  const { data: myTasks } = useQuery({
    queryKey: QUERY_KEYS.tasks(user?.user_id ?? ''),
    queryFn: () => tasksApi.list(user!.user_id),
    enabled: !!user?.user_id && doc?.status === 'pending',
    refetchOnMount: 'always',
  });

  const { data: wfInstance } = useQuery({
    queryKey: QUERY_KEYS.workflowInstanceByDocument(id!),
    queryFn: () => workflowApi.getInstanceByDocumentId(id!),
    enabled: documentIdValid && doc?.delivery_mode === 'workflow',
    refetchOnMount: 'always',
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

  const { data: recipientsFromApi } = useQuery({
    queryKey: QUERY_KEYS.documentRecipients(id!),
    queryFn: () => documentsApi.listRecipients(id!),
    enabled: documentIdValid,
  });

  const recipients = useMemo((): DocumentRecipient[] | undefined => {
    if (recipientsFromApi?.length) return recipientsFromApi;
    if (doc?.recipients?.length) return doc.recipients;
    return recipientsFromApi ?? doc?.recipients;
  }, [recipientsFromApi, doc?.recipients]);

  const recipientsByType = useMemo(() => groupDocumentRecipientsByType(recipients), [recipients]);

  const workflowToFallback = useMemo(() => {
    if (doc?.delivery_mode !== 'workflow' || recipientsByType.to.length > 0) return null;
    if (!wfInstance || !currentWorkflowStepDef) {
      return 'Routed via workflow (no To tag at creation)';
    }
    const role = workflowAssigneeRoleLabel(currentWorkflowStepDef.assignee_role);
    const stepName = String(currentWorkflowStepDef.name ?? '').trim();
    if (stepName) {
      return `${role} — current step: ${stepName}`;
    }
    return role;
  }, [doc?.delivery_mode, recipientsByType.to.length, wfInstance, currentWorkflowStepDef]);

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

  const isCcOrBccTagged = useMemo(
    () => isReadOnlyDocumentRecipient(recipients, user?.user_id),
    [recipients, user?.user_id]
  );

  /** Read-only only while CC/BCC and not also the workflow assignee or current DM To holder. */
  const isReadOnlyRecipient = useMemo(
    () =>
      isCcOrBccTagged && !hasActiveWorkflowTaskForDoc && !isDirectMessageRecipient,
    [isCcOrBccTagged, hasActiveWorkflowTaskForDoc, isDirectMessageRecipient]
  );

  const directMessageAssignedAt = useMemo(() => {
    if (!recipients?.length || !user?.user_id) return null;
    const mine = recipients.filter((r) => r.user_id === user.user_id);
    if (!mine.length) return null;
    const latest = [...mine].sort(
      (a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime()
    )[0];
    return latest?.created_at ?? null;
  }, [recipients, user?.user_id]);

  const assignmentOverdue = useMemo(() => {
    if (!doc) return false;
    return isDocumentAssignmentOverdue(doc, {
      userId: user?.user_id,
      tasks: myTasks,
      isDirectMessageRecipient,
      directMessageAssignedAt,
    });
  }, [doc, user?.user_id, myTasks, isDirectMessageRecipient, directMessageAssignedAt]);

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

  const recipientCandidates = useMemo(() => {
    const tagged = new Set((recipients ?? []).map((r) => r.user_id));
    return (users ?? []).filter(
      (u) => u.id !== user?.user_id && u.id !== doc?.owner_id && !tagged.has(u.id)
    );
  }, [users, recipients, user?.user_id, doc?.owner_id]);

  const recipientRankOptions = useMemo(
    () => buildRankFilterOptions(recipientCandidates, roles),
    [recipientCandidates, roles]
  );

  const filteredRecipientCandidates = useMemo(() => {
    if (!recipientRank.trim()) return recipientCandidates;
    return recipientCandidates.filter((u) => userMatchesRankFilter(u, recipientRank, roles));
  }, [recipientCandidates, recipientRank, roles]);

  const resetRecipientPicker = () => {
    setRecipientRank('');
    setRecipientUserId('');
    setRecipientType('to');
  };

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
        isReadOnlyRecipient,
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
    isReadOnlyRecipient,
  ]);

  const canPostComment = !!docActionsAvailable?.canEditForward;
  const showReturnedForInfoHint = useMemo(
    () =>
      doc?.status === 'pending' &&
      hasActiveWorkflowTaskForDoc &&
      wasReturnedForMoreInfo({
        workflowActions,
        tasks: myTasks,
        documentId: doc?.id ?? '',
        currentUserId: user?.user_id,
        workflowInstance: wfInstance,
        isDirectMessageRecipient,
      }),
    [
      doc?.status,
      doc?.id,
      hasActiveWorkflowTaskForDoc,
      workflowActions,
      myTasks,
      user?.user_id,
      wfInstance,
      isDirectMessageRecipient,
    ]
  );
  const inlineWorkflowActionEnabled =
    canPostComment &&
    doc?.delivery_mode === 'workflow' &&
    !!workflowInstanceIdForActions &&
    canAdvanceWorkflow;

  const isOwner = !!user?.user_id && !!doc?.owner_id && user.user_id === doc.owner_id;
  const canAddRecipient = isOwner && (doc?.status === 'draft' || doc?.status === 'pending');
  const canUploadAttachment = isOwner && (doc?.status === 'draft' || doc?.status === 'pending');

  /**
   * Build a single printable HTML view: letterhead (internal memos when available),
   * body, recipients, supporting attachments, activity timeline, and versions.
   * External correspondence also shows the uploaded primary filename in the export header.
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
      onSuccess: async (letterheadHtml) => {
        try {
          const usernameFor = (uid: string | null | undefined) => resolveUsername(uid);
          let html = buildDocumentExportHtml({
            doc,
            letterheadHtml,
            recipients,
            attachments,
            actions: workflowActions,
            versions,
            ownerName: resolveUsername(doc.owner_id),
            usernameFor,
          });
          html = await inlineExportImagesInHtml(html);
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
      resetRecipientPicker();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await documentsApi.uploadAttachment(id!, file);
      }
    },
    onSuccess: (_data, files) => {
      toast.success(
        files.length === 1 ? 'Supporting document uploaded' : `${files.length} supporting documents uploaded`
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentAttachments(id!) });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => documentsApi.deleteAttachment(id!, attachmentId),
    onSuccess: () => {
      toast.success('Attachment removed');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentAttachments(id!) });
      setAttachmentToDelete(null);
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
        <DocumentDetailToolbar onBack={() => navigate('/documents')} />
        <ErrorState
          title="Invalid document link"
          error={
            new Error(
              'This URL is not a valid process id. Open Process from the sidebar and pick an item from the list.'
            )
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DocumentDetailToolbar onBack={() => navigate('/documents')} />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (isLoading || !doc) {
    return (
      <div className="space-y-5">
        <DocumentDetailToolbar onBack={() => navigate('/documents')} />
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
  const correspondenceLabel = correspondenceDirectionLabel(doc.correspondence_direction);

  /** "<p></p>" / "<p><br></p>" / "&nbsp;" should not look like real body text. */
  const bodyHtml = doc.content ?? '';
  const bodyPlainText = bodyHtml
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|\u00A0/g, ' ')
    .trim();
  const hasBodyText = bodyPlainText.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">       
        <DocumentDetailToolbar
          onBack={() => navigate('/documents')}
          onExport={openDocumentExport}
          exportLoading={exportMutation.isPending}
          onOpenProfile={() => setProfileOpen(true)}
          onOpenWorkflow={() => setWorkflowOpen(true)}
          showWorkflow={doc.delivery_mode === 'workflow'}
        />
        <div className="flex flex-col items-end gap-2 shrink-0">
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
              isReadOnlyRecipient,
            }}
            workflowInstanceId={workflowInstanceIdForActions}
            canAdvanceWorkflow={canAdvanceWorkflow}
            workflowCurrentStep={wfInstance?.current_step ?? null}
            workflowStepActionType={workflowStepActionType}
            suppressWorkflowStepActions={inlineWorkflowActionEnabled}
          />
        </div>
      </div>

      {isReadOnlyRecipient ? (
        <Alert className="border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-950/40">
          <AlertDescription className="text-sm text-slate-800 dark:text-slate-200">
            You are tagged as <strong>CC</strong> or <strong>BCC</strong> for awareness only. You can view the memo,
            recipients, attachments, and timeline, but you cannot act while you are only CC/BCC. If this process later
            assigns you a workflow step or sends the direct message <strong>To</strong> you, you will be able to act
            then.
          </AlertDescription>
        </Alert>
      ) : null}

      {showReturnedForInfoHint ? (
        <Alert className="border-amber-200 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertDescription className="text-sm text-amber-950 dark:text-amber-100">
            {doc?.delivery_mode === 'direct_message' ? (
              <>
                This direct message was returned or reversed to you. Use <strong>Edit</strong> to
                update the memo, then send it forward again when you are ready.
              </>
            ) : (
              <>
                This process was returned to you for more information. Use <strong>Edit</strong> to update the
                memo, then <strong>Approve and send</strong> or <strong>Forward</strong> to pass it to the next
                step.
              </>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

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
                {/* Sender & recipients */}
                <section className="px-4 py-5 sm:px-6" aria-labelledby="section-recipients">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    {/* <h3
                      id="section-recipients"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Sender &amp; recipients
                    </h3> */}
                    <h3></h3>
                    {canAddRecipient && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setRecipientOpen(true)}>
                        Add recipient
                      </Button>
                    )}
                  </div>
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex gap-4">
                      <dt className="w-12 shrink-0 text-muted-foreground">From</dt>
                      <dd className="min-w-0 text-foreground">
                        <span className="font-medium capitalize">{ownerName}</span>
                        {ownerContext ? (
                          <span className="text-muted-foreground"> · {ownerContext}</span>
                        ) : null}
                      </dd>
                    </div>
                    {RECIPIENT_TYPE_ORDER.map((type) => {
                      const group = recipientsByType[type];
                      const showWorkflowTo =
                        type === 'to' && !group.length && doc.delivery_mode === 'workflow' && workflowToFallback;
                      const showDmEmpty =
                        type === 'to' &&
                        !group.length &&
                        !showWorkflowTo &&
                        doc.delivery_mode === 'direct_message' &&
                        !recipients?.length;
                      const showTaggedEmpty =
                        !group.length &&
                        !showWorkflowTo &&
                        !showDmEmpty &&
                        (type === 'to'
                          ? false
                          : doc.delivery_mode === 'workflow' || (recipients?.length ?? 0) > 0);
                      if (!group.length && !showWorkflowTo && !showDmEmpty && !showTaggedEmpty) {
                        return null;
                      }
                      return (
                        <div key={type} className="flex gap-4">
                          <dt className="w-12 shrink-0 text-muted-foreground">
                            {RECIPIENT_TYPE_LABEL[type]}
                          </dt>
                          <dd className="min-w-0 text-foreground leading-relaxed">
                            {group.length > 0 ? (
                              group.map((r, idx) => {
                                const profile = userById.get(r.user_id);
                                const name = userDisplayName(profile, resolveUsername(r.user_id));
                                const context = userRoleContext(profile, roles);
                                return (
                                  <span key={r.id ?? `${type}-${r.user_id}-${idx}`}>
                                    {idx > 0 ? ', ' : null}
                                    <span className="capitalize">{name}</span>
                                    {context ? (
                                      <span className="text-muted-foreground"> ({context})</span>
                                    ) : null}
                                  </span>
                                );
                              })
                            ) : showWorkflowTo ? (
                              <span className="text-muted-foreground italic">{workflowToFallback}</span>
                            ) : showDmEmpty ? (
                              <span className="text-muted-foreground italic">No recipients tagged yet</span>
                            ) : showTaggedEmpty ? (
                              <span className="text-muted-foreground italic">—</span>
                            ) : null}
                          </dd>
                        </div>
                      );
                    })}
                    {!recipients?.length && doc.delivery_mode !== 'workflow' && doc.delivery_mode !== 'direct_message' && (
                      <div className="flex gap-4">
                        <dt className="w-12 shrink-0 text-muted-foreground">To</dt>
                        <dd className="text-muted-foreground italic">None</dd>
                      </div>
                    )}
                  </dl>
                </section>

                {/* Body */}
                <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-body">
                  {!doc.file_path && (
                    <h3
                      id="section-body"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {doc.category === 'external_correspondence' ? 'Body / notes' : 'Body'}
                    </h3>
                  )}
                  {doc.category === 'external_correspondence' ? (
                    <>
                      {hasBodyText ? (
                        <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
                          <div
                            className="prose prose-sm max-w-none px-5 py-4 text-foreground whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                              __html: bodyHtml,
                            }}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic py-2">
                          No cover notes were entered for this document.
                        </p>
                      )}
                      {doc.file_path ? (
                        <div className="space-y-2 pt-2">
                          <ExternalPrimaryFileViewer
                            documentId={doc.id}
                            filename={
                              doc.original_filename?.trim() ||
                              doc.intake_file_name?.trim() ||
                              'Uploaded document'
                            }
                          />
                        </div>
                      ) : null}
                    </>
                  ) : hasBodyText ? (
                    <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
                      <div
                        className="prose prose-sm max-w-none px-5 py-4 text-foreground [&_.nhia-approve-forward-stamp]:not-prose [&_.nhia-approve-forward-stamp]:flex [&_.nhia-approve-forward-stamp]:flex-col [&_.nhia-approve-forward-stamp]:gap-1.5 [&_.nhia-approve-forward-stamp_p]:my-0 [&_.nhia-approve-forward-name]:font-semibold [&_.nhia-approve-forward-name]:text-sm [&_.nhia-approve-forward-rank]:text-sm [&_.nhia-approve-forward-dept-zone]:text-sm [&_.nhia-approve-forward-sig]:max-h-[72px]"
                        dangerouslySetInnerHTML={{
                          __html: doc.title?.trim()
                            ? stripFirstHtmlBlockMatchingTitle(bodyHtml, doc.title)
                            : bodyHtml,
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic py-2">
                      No cover notes were entered for this document.
                    </p>
                  )}
                  {doc.file_path ? (
                    <div className="space-y-2 pt-2">
                      <ExternalPrimaryFileViewer
                        documentId={doc.id}
                        filename={
                          doc.original_filename?.trim() ||
                          doc.intake_file_name?.trim() ||
                          'Uploaded document'
                        }
                      />
                    </div>
                  ) : null}
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
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            if (files.length) uploadMutation.mutate(files);
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
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`View ${a.filename}`}
                              onClick={() => setPreviewAttachment(a)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Download ${a.filename}`}
                              onClick={() => downloadAttachment(a.id, a.filename)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {canUploadAttachment && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                aria-label={`Remove ${a.filename}`}
                                loading={
                                  deleteAttachmentMutation.isPending &&
                                  attachmentToDelete?.id === a.id
                                }
                                onClick={() =>
                                  setAttachmentToDelete({ id: a.id, filename: a.filename })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 space-y-4">
          <DocumentActivitySidebar
            documentStatus={doc.status}
            statusLabel={doc.status_label}
            pendingStageLabel={pendingStageLabel}
            assignmentOverdue={assignmentOverdue}
            refNumber={doc.ref_number}
            trackingId={doc.tracking_id}
            correspondenceDirection={doc.correspondence_direction}
            archivedAt={doc.archived_at}
            documentTitle={doc.title?.trim() || 'Untitled document'}
            ownerDisplayName={ownerName}
            ownerRoleContext={ownerContext}
            createdAt={doc.created_at}
            updatedAt={doc.updated_at}
            categoryLabel={categoryLabel}
            departmentDisplay={departmentName}
            actions={workflowActions}
            actionsLoading={workflowActionsLoading}
            versions={versions}
            versionsLoading={versionsLoading}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={openDocumentExport}
            loading={exportMutation.isPending}
          >
            <FileDown className="h-4 w-4" />
            Export document
          </Button>
          <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
            Opens a printable view with letterhead (internal memos), body, recipients, supporting
            attachments, and the full activity timeline. External correspondence includes the uploaded
            file name. Use your browser print dialog to save as PDF.
          </p>
        </aside>
      </div>

      <Dialog
        open={recipientOpen}
        onOpenChange={(open) => {
          setRecipientOpen(open);
          if (!open) resetRecipientPicker();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add recipient</DialogTitle>
            <DialogDescription>
              Pick a rank or role first, then choose the staff member. Each option shows name, rank, and
              department.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                Rank / role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={recipientRank.trim() || '__none__'}
                onValueChange={(v) => {
                  setRecipientRank(v === '__none__' ? '' : v);
                  setRecipientUserId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rank / role first" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select rank / role…</SelectItem>
                  {recipientRankOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!recipientRankOptions.length && recipientCandidates.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  No rank or role could be derived from the directory. Ask an admin to set rank or roles on user
                  profiles.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Staff member <span className="text-destructive">*</span>
              </Label>
              <Select
                value={recipientUserId || '__none__'}
                disabled={!recipientRank.trim()}
                onValueChange={(v) => setRecipientUserId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      recipientRank.trim()
                        ? 'Select user (name · rank · department)'
                        : 'Choose rank / role first'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__">Select user</SelectItem>
                  {filteredRecipientCandidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {recipientUserLabel(u, roles)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recipientRank.trim() && !filteredRecipientCandidates.length && (
                <p className="text-xs text-muted-foreground">No users with this rank in the directory.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tag as</Label>
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
              disabled={!recipientRank.trim() || !recipientUserId}
              onClick={() => addRecipientMutation.mutate()}
            >
              Add recipient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Document profile
            </DialogTitle>
            <DialogDescription>
              Metadata and routing details for this document.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 py-2">
            <ReadOnlyField label="Subject" value={doc.title?.trim() || '—'} />
            <ReadOnlyField label="Tracking ID" value={doc.tracking_id || '—'} mono />
            <ReadOnlyField label="Reference number" value={doc.ref_number || '—'} mono />
            <ReadOnlyField
              label="Correspondence"
              value={
                doc.correspondence_direction
                  ? correspondenceDirectionLabel(doc.correspondence_direction)
                  : '—'
              }
            />
            <ReadOnlyField
              label="Archive status"
              value={doc.archived_at ? formatDateTime(doc.archived_at) : doc.status === 'archived' ? 'Archived' : '—'}
            />
            <ReadOnlyField label="Document date" value={documentDateValue} />
            <ReadOnlyField label="Received" value={receivedDateValue} />
            <ReadOnlyField label="Category" value={categoryLabel} />
            <ReadOnlyField label="Urgency" value={urgencyLabel} />
            <ReadOnlyField label="Classification" value={classificationLabel} />
            <ReadOnlyField label="Department" value={departmentName} />
            <ReadOnlyField label="Delivery" value={deliveryLabel} />
            <ReadOnlyField label="Document input" value={inputModeLabel} />
            <ReadOnlyField label="Owner" value={ownerName} className="capitalize" />
            {doc.delivery_mode === 'workflow' && (
              <div className="sm:col-span-2">
                <ReadOnlyField
                  label="Workflow template"
                  value={
                    wfTemplate?.name?.trim()
                      ? wfTemplate.name
                      : workflowTemplateLookupId
                        ? 'Loading…'
                        : '—'
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {doc.delivery_mode === 'workflow' && (
        <Dialog open={workflowOpen} onOpenChange={setWorkflowOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" /> Workflow routing &amp; approvals
              </DialogTitle>
              <DialogDescription>
                Read-only view of the workflow path. Approvals and transitions continue through the action controls on this page.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-6 overflow-y-auto min-h-0">
              <WorkflowBpmnPanel documentId={doc.id} documentStatus={doc.status} />
            </div>
            <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
              <Button variant="outline" onClick={() => setWorkflowOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <SupportingAttachmentPreviewDialog
        documentId={doc.id}
        attachment={previewAttachment}
        open={!!previewAttachment}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      />

      <ConfirmDialog
        open={!!attachmentToDelete}
        onOpenChange={(open) => {
          if (!open) setAttachmentToDelete(null);
        }}
        title="Remove attachment?"
        description={
          attachmentToDelete
            ? `“${attachmentToDelete.filename}” will be removed from this document.`
            : ''
        }
        confirmLabel="Remove"
        variant="destructive"
        loading={deleteAttachmentMutation.isPending}
        onConfirm={() => {
          if (attachmentToDelete) deleteAttachmentMutation.mutate(attachmentToDelete.id);
        }}
      />

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
