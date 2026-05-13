import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MemoEditor from '@/components/documents/MemoEditor';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { documentsApi } from '@/api/documents';
import { workflowApi } from '@/api/workflow';
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import { cn } from '@/utils/cn';
import { NhiaMemoLetterhead } from '@/components/documents/NhiaMemoLetterhead';
import { useAuthStore } from '@/stores/authStore';
import type { DocumentUrgency } from '@/types/document';
import type { UserRecord } from '@/api/auth';
import {
  buildRankFilterOptions,
  recipientUserLabel,
  userMatchesRankFilter,
} from '@/utils/recipientPicker';

const documentTypeSchema = z.enum(['internal', 'external']);
const fileCategorySchema = z.enum(['secret', 'top_secret', 'important', 'normal']);
const prioritySchema = z.enum(['normal', 'important', 'urgent', 'critical']);
const actionSchema = z.enum(['send', 'draft']);
const deliveryModeSchema = z.enum(['workflow', 'direct_message']);
const documentSourceSchema = z.enum(['template', 'manual_entry']);

const formSchema = z
  .object({
    delivery_mode: deliveryModeSchema,
    document_source: documentSourceSchema,
    document_type: documentTypeSchema,
    document_date: z.string().min(1, 'Document date is required'),
    document_template_id: z.string().optional(),
    subject: z.string().min(1, 'Subject is required').max(500),
    body_html: z.string().optional(),
    body_text_external: z.string().optional(),
    file_category: fileCategorySchema,
    document_priority: prioritySchema,
    file_name: z.string().min(1, 'File name is required').max(500),
    ref_code: z.string().max(120).optional(),
    action: actionSchema,
    /** Filter users by profile rank (NHIA grade / title); required before recipient when sending direct message. */
    direct_recipient_rank: z.string().optional(),
    direct_recipient_user_id: z.string().optional(),
    /** Workflow engine template (GET /workflows/templates); used when delivery is workflow + submit. */
    workflow_template_id: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.delivery_mode === 'workflow' && !data.workflow_template_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a workflow',
        path: ['workflow_template_id'],
      });
    }
    if (data.document_type === 'internal' && data.document_source === 'template') {
      if (!data.document_template_id?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Document template is required',
          path: ['document_template_id'],
        });
      }
    }
    if (data.delivery_mode === 'direct_message' && data.action === 'send') {
      if (!data.direct_recipient_rank?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select a rank / role first',
          path: ['direct_recipient_rank'],
        });
      }
      if (!data.direct_recipient_user_id?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select a recipient',
          path: ['direct_recipient_user_id'],
        });
      }
    }
  });

type CreateFormValues = z.infer<typeof formSchema>;

function priorityToUrgency(p: CreateFormValues['document_priority']): DocumentUrgency {
  switch (p) {
    case 'normal':
      return 'normal';
    case 'important':
      return 'urgent';
    case 'urgent':
      return 'urgent';
    case 'critical':
      return 'very_urgent';
    default:
      return 'normal';
  }
}

function resolveWorkflowDepartment(
  profile: { department?: string | null } | undefined,
  orgDepartments: { id: number; name: string }[] | undefined
): string {
  const fromProfile = profile?.department?.trim();
  if (fromProfile && orgDepartments?.length) {
    const m = orgDepartments.find((d) => d.name.toLowerCase() === fromProfile.toLowerCase());
    if (m) return m.name;
  }
  return orgDepartments?.[0]?.name?.trim() ?? '';
}

function resolveDepartmentFromRecipient(
  userId: string | undefined,
  users: UserRecord[] | undefined,
  orgDepartments: { id: number; name: string }[] | undefined
): string {
  if (!userId?.trim() || !users?.length) return orgDepartments?.[0]?.name?.trim() ?? '';
  const u = users.find((x) => x.id === userId);
  const dept = u?.department?.trim();
  if (dept && orgDepartments?.length) {
    const m = orgDepartments.find((d) => d.name.toLowerCase() === dept.toLowerCase());
    if (m) return m.name;
    return dept;
  }
  return orgDepartments?.[0]?.name?.trim() ?? '';
}

export default function CreateDocumentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preDocumentTemplateId = searchParams.get('document_template_id') ?? undefined;
  const authUser = useAuthStore((s) => s.user);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const receiveDateLabel = useMemo(() => format(new Date(), 'MMMM d, yyyy'), []);

  const { data: orgScope } = useQuery({
    queryKey: QUERY_KEYS.orgScopeReference,
    queryFn: () => documentsApi.getOrgScopeReference(),
  });

  const { data: documentTemplates } = useQuery({
    queryKey: [QUERY_KEYS.documentTemplates],
    queryFn: () => documentsApi.listTemplates(),
  });

  const { data: profile } = useQuery({
    queryKey: ['auth-profile', authUser?.user_id],
    queryFn: () => authApi.getProfile(authUser!.user_id),
    enabled: !!authUser?.user_id,
  });

  const { data: users } = useQuery({
    queryKey: ['auth-users-create-doc'],
    queryFn: () => authApi.listUsers(),
  });

  const { data: roles } = useQuery({
    queryKey: ['auth-roles-create-doc'],
    queryFn: () => authApi.listRoles(),
  });

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      delivery_mode: 'workflow',
      document_source: 'template',
      document_type: 'internal',
      document_date: format(new Date(), 'yyyy-MM-dd'),
      document_template_id: preDocumentTemplateId ?? '',
      subject: '',
      body_html: '',
      body_text_external: '',
      file_category: 'normal',
      document_priority: 'normal',
      file_name: '',
      ref_code: '',
      action: 'send',
      direct_recipient_rank: '',
      direct_recipient_user_id: '',
      workflow_template_id: '',
    },
  });

  const { data: workflowTemplates } = useQuery({
    queryKey: [QUERY_KEYS.workflowTemplates],
    queryFn: () => workflowApi.getTemplates(),
  });

  const deliveryMode = form.watch('delivery_mode');
  const documentSource = form.watch('document_source');
  const documentType = form.watch('document_type');
  const documentTemplateId = form.watch('document_template_id');
  const workflowTemplateId = form.watch('workflow_template_id');
  const bodyHtml = form.watch('body_html');

  useEffect(() => {
    if (deliveryMode !== 'workflow' || !workflowTemplates?.length) return;
    const cur = form.getValues('workflow_template_id')?.trim();
    if (cur && workflowTemplates.some((t) => t.id === cur)) return;
    form.setValue('workflow_template_id', workflowTemplates[0].id, { shouldValidate: true });
  }, [deliveryMode, workflowTemplates, form]);

  useEffect(() => {
    if (deliveryMode === 'direct_message') return;
    form.setValue('direct_recipient_rank', '', { shouldValidate: true });
    form.setValue('direct_recipient_user_id', '', { shouldValidate: true });
  }, [deliveryMode, form]);

  const recipientUsers = useMemo(
    () => (users ?? []).filter((u) => u.id !== authUser?.user_id),
    [users, authUser?.user_id]
  );

  const rankFilterOptions = useMemo(
    () => buildRankFilterOptions(recipientUsers, roles),
    [recipientUsers, roles]
  );

  const selectedRecipientRank = form.watch('direct_recipient_rank');
  const selectedAction = form.watch('action');

  const filteredRecipientUsers = useMemo(() => {
    if (selectedAction === 'draft' && !selectedRecipientRank?.trim()) {
      return recipientUsers;
    }
    if (!selectedRecipientRank?.trim()) {
      return selectedAction === 'send' ? [] : recipientUsers;
    }
    return recipientUsers.filter((u) => userMatchesRankFilter(u, selectedRecipientRank, roles));
  }, [recipientUsers, selectedRecipientRank, selectedAction, roles]);

  const lastAppliedDocumentTemplateId = useRef<string | null>(null);
  const prevDocumentSource = useRef(documentSource);

  useEffect(() => {
    if (documentType === 'external') {
      form.setValue('document_source', 'manual_entry');
    }
  }, [documentType, form]);

  useEffect(() => {
    if (documentSource !== 'manual_entry' || documentType !== 'internal') return;
    lastAppliedDocumentTemplateId.current = null;
    form.setValue('document_template_id', '');
    form.setValue('body_html', '');
  }, [documentSource, documentType, form]);

  useEffect(() => {
    if (
      documentType === 'internal' &&
      prevDocumentSource.current === 'manual_entry' &&
      documentSource === 'template'
    ) {
      lastAppliedDocumentTemplateId.current = null;
    }
    prevDocumentSource.current = documentSource;
  }, [documentSource, documentType]);

  /** Apply catalogue template body when the selected template id changes (not on list refetch). */
  useEffect(() => {
    if (documentType !== 'internal' || documentSource !== 'template') return;
    const id = documentTemplateId?.trim();
    if (!id || !documentTemplates?.length) return;
    const tpl = documentTemplates.find((t) => t.id === id);
    if (!tpl) return;
    if (lastAppliedDocumentTemplateId.current === id) return;
    lastAppliedDocumentTemplateId.current = id;
    form.setValue('body_html', tpl.body_template ?? '');
  }, [documentType, documentSource, documentTemplateId, documentTemplates]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = (accepted: File[]) => {
    if (accepted[0]) {
      setUploadFile(accepted[0]);
      const base = accepted[0].name.replace(/\.[^/.]+$/, '');
      if (!form.getValues('file_name')?.trim()) {
        form.setValue('file_name', base, { shouldValidate: true });
      }
      toast.success(`Selected ${accepted[0].name}`);
    }
  };

  const maxUploadBytes = documentType === 'internal' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: maxUploadBytes,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: CreateFormValues) => {
      const urgency = priorityToUrgency(data.document_priority);
      const ref = data.ref_code?.trim() || undefined;
      const useWorkflow = data.delivery_mode === 'workflow';
      const orgDepts = orgScope?.departments;

      const department =
        data.delivery_mode === 'direct_message'
          ? resolveDepartmentFromRecipient(data.direct_recipient_user_id, users, orgDepts)
          : resolveWorkflowDepartment(profile, orgDepts);

      if (!department) throw new Error('Could not resolve a department. Check org data or recipient profile.');

      const recipients =
        data.delivery_mode === 'direct_message' && data.direct_recipient_user_id?.trim()
          ? [{ user_id: data.direct_recipient_user_id.trim(), recipient_type: 'to' as const }]
          : undefined;

      const creationProfile = {
        delivery_mode: data.delivery_mode,
        input_mode: data.document_source,
        file_classification: data.file_category,
        document_effective_date: data.document_date,
        intake_file_name: data.file_name.trim(),
        selected_workflow_template_id:
          data.delivery_mode === 'workflow' ? data.workflow_template_id?.trim() || undefined : undefined,
      };

      /** Send to pending for review: workflow path starts a template; direct message notifies recipient only (no workflow). */
      const shouldSubmitForReview = data.action === 'send' && (useWorkflow || data.delivery_mode === 'direct_message');

      const finalizeAfterCreate = async (docId: string) => {
        if (!shouldSubmitForReview) return;
        await documentsApi.submit(docId);
        if (!useWorkflow) return;
        const wfTpl = data.workflow_template_id?.trim();
        if (!wfTpl) throw new Error('Select a workflow.');
        const existing = await workflowApi.getInstanceByDocumentId(docId);
        if (!existing) {
          await workflowApi.start({ template_id: wfTpl, document_id: docId });
        }
      };

      if (data.document_type === 'internal') {
        if (data.document_source === 'manual_entry') {
          const innerBody = (data.body_html ?? '').trim() || '<p></p>';
          const created = await documentsApi.create({
            title: data.subject.trim(),
            content: innerBody,
            category: 'internal_memo',
            department,
            urgency,
            ref_number: ref,
            recipients,
            ...creationProfile,
          });
          const docId = created.document.id;
          if (uploadFile) {
            await documentsApi.uploadAttachment(docId, uploadFile);
          }
          await finalizeAfterCreate(docId);
          return docId;
        }

        const tplId = data.document_template_id?.trim();
        if (!tplId) throw new Error('Select a document template.');
        const innerBody = (data.body_html ?? '').trim() || '<p></p>';

        const created = await documentsApi.create({
          title: data.subject.trim(),
          content: innerBody,
          category: 'internal_memo',
          department,
          template_id: tplId,
          urgency,
          ref_number: ref,
          recipients,
          ...creationProfile,
        });

        const docId = created.document.id;
        if (uploadFile) {
          await documentsApi.uploadAttachment(docId, uploadFile);
        }
        await finalizeAfterCreate(docId);
        return docId;
      }

      if (!uploadFile) throw new Error('Please upload a document file');
      const notes = data.body_text_external?.trim();
      const title = data.subject.trim() || data.file_name.trim();
      const created = await documentsApi.uploadExternal(uploadFile, title, department, {
        ref_number: ref,
        urgency,
        ...creationProfile,
      });
      const docId = created.document.id;

      if (recipients?.length) {
        for (const r of recipients) {
          await documentsApi.addRecipient(docId, r);
        }
      }

      if (notes) {
        await documentsApi.update(docId, {
          content: `<p>${notes.replace(/\n/g, '<br/>')}</p>`,
        });
      }
      await finalizeAfterCreate(docId);
      return docId;
    },
    onSuccess: (docId) => {
      const data = form.getValues();
      if (data.delivery_mode === 'workflow' && data.action === 'send') {
        toast.success('Document sent into workflow');
      } else if (data.delivery_mode === 'workflow' && data.action === 'draft') {
        toast.success('Draft saved (workflow not started)');
      } else if (data.delivery_mode === 'direct_message' && data.action === 'send') {
        toast.success('Document sent to your recipient for comments (no workflow)');
      } else {
        toast.success('Draft saved');
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.allDocuments] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workflowInstanceByDocument(docId) });
      navigate(`/documents/${docId}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const senderLine =
    profile?.full_name?.trim() || profile?.username || authUser?.username || 'Signed-in user';
  const senderEmail = profile?.email?.trim() || '—';
  const letterheadLabel = documentType === 'internal' ? 'Internal document' : 'External document';
  const showActionSection = deliveryMode === 'direct_message';

  const submitDisabled =
    (documentType === 'internal' &&
      documentSource === 'template' &&
      (!documentTemplates?.length || !documentTemplateId?.trim())) ||
    (deliveryMode === 'workflow' &&
      (!workflowTemplates?.length || !workflowTemplateId?.trim())) ||
    false;

  return (
    <div className="w-full min-w-0 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> Documents
      </Button>

      <PageHeader
        title="Create document"
        description="Choose delivery mode and document input. With workflow, pick which workflow template runs after submit."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (deliveryMode === 'workflow') return;
          form.handleSubmit((d) => submitMutation.mutate(d))();
        }}
        className="space-y-6"
      >
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <NhiaMemoLetterhead
            documentTypeLabel={letterheadLabel}
            zoneCode={profile?.zone ?? undefined}
            stateOfficeName={profile?.state ?? undefined}
            zones={orgScope?.zones}
          />
          <CardContent className="px-0 pb-6 pt-0">
            <div className="divide-y divide-border">
              {/* Mode & routing */}
              <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-mode">
                <h3 id="section-mode" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mode &amp; routing
                </h3>
                <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                  <div className="space-y-2 min-w-0">
                    <Label id="delivery-mode-label">Delivery</Label>
                    <div
                      role="radiogroup"
                      aria-labelledby="delivery-mode-label"
                      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4"
                    >
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors',
                          deliveryMode === 'workflow'
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-background hover:bg-muted/40'
                        )}
                      >
                        <input
                          type="radio"
                          name="delivery_mode"
                          value="workflow"
                          className="h-4 w-4 shrink-0 accent-primary"
                          checked={deliveryMode === 'workflow'}
                          onChange={() =>
                            form.setValue('delivery_mode', 'workflow', { shouldValidate: true })
                          }
                        />
                        <span className="font-medium">Use workflow</span>
                      </label>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors',
                          deliveryMode === 'direct_message'
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-background hover:bg-muted/40'
                        )}
                      >
                        <input
                          type="radio"
                          name="delivery_mode"
                          value="direct_message"
                          className="h-4 w-4 shrink-0 accent-primary"
                          checked={deliveryMode === 'direct_message'}
                          onChange={() =>
                            form.setValue('delivery_mode', 'direct_message', { shouldValidate: true })
                          }
                        />
                        <span className="font-medium">Direct message</span>
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Workflow uses the standard approval path. Direct message targets a user and does not start
                      workflow.
                    </p>
                  </div>

                  <div className="space-y-2 min-w-0">
                    <Label id="document-source-label">Document input</Label>
                    {documentType === 'internal' ? (
                      <div
                        role="radiogroup"
                        aria-labelledby="document-source-label"
                        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4"
                      >
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors',
                            documentSource === 'template'
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border bg-background hover:bg-muted/40'
                          )}
                        >
                          <input
                            type="radio"
                            name="document_source"
                            value="template"
                            className="h-4 w-4 shrink-0 accent-primary"
                            checked={documentSource === 'template'}
                            onChange={() =>
                              form.setValue('document_source', 'template', { shouldValidate: true })
                            }
                          />
                          <span className="font-medium">Use template</span>
                        </label>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors',
                            documentSource === 'manual_entry'
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border bg-background hover:bg-muted/40'
                          )}
                        >
                          <input
                            type="radio"
                            name="document_source"
                            value="manual_entry"
                            className="h-4 w-4 shrink-0 accent-primary"
                            checked={documentSource === 'manual_entry'}
                            onChange={() =>
                              form.setValue('document_source', 'manual_entry', { shouldValidate: true })
                            }
                          />
                          <span className="font-medium">Manual entry</span>
                        </label>
                      </div>
                    ) : (
                      <div
                        role="radiogroup"
                        aria-labelledby="document-source-label"
                        className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground"
                      >
                        External documents use <span className="font-medium text-foreground">manual file upload</span>{' '}
                        only.
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Template loads body text from a catalogue entry. Manual entry starts with an empty editor; file
                      upload below is optional.
                    </p>
                  </div>
                </div>

                {deliveryMode === 'workflow' && (
                  <div className="space-y-2 max-w-2xl pt-1">
                    <Label>
                      Workflow <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={workflowTemplateId?.trim() ? workflowTemplateId : undefined}
                      onValueChange={(v) =>
                        form.setValue('workflow_template_id', v, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          'w-full max-w-2xl',
                          form.formState.errors.workflow_template_id ? 'border-destructive' : undefined
                        )}
                      >
                        <SelectValue placeholder="Select a workflow" />
                      </SelectTrigger>
                      <SelectContent>
                        {workflowTemplates?.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.workflow_template_id && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.workflow_template_id.message}
                      </p>
                    )}
                    {!workflowTemplates?.length && (
                      <p className="text-xs text-destructive">
                        No workflow templates found. Create one under Workflows before submitting into a workflow.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      This template is started after you submit the document into the workflow path.
                    </p>
                  </div>
                )}
              </section>

              {/* Document profile */}
              <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-profile">
                <h3
                  id="section-profile"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Document profile
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="document_date">Document date</Label>
                    <Input
                      id="document_date"
                      type="date"
                      error={!!form.formState.errors.document_date}
                      {...form.register('document_date')}
                    />
                    {form.formState.errors.document_date && (
                      <p className="text-xs text-destructive">{form.formState.errors.document_date.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Document receive date</Label>
                    <Input value={receiveDateLabel} readOnly disabled className="bg-muted/60" />
                    <p className="text-xs text-muted-foreground">Set automatically to today&apos;s date.</p>
                  </div>
                </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <div className="space-y-1.5 min-w-0">
                <Label>Type</Label>
                <Select
                  value={documentType}
                  onValueChange={(v) => form.setValue('document_type', v as CreateFormValues['document_type'])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 min-w-0">
                {documentType === 'internal' && documentSource === 'template' ? (
                  <>
                    <Label>
                      Document template <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={documentTemplateId?.trim() ? documentTemplateId : undefined}
                      onValueChange={(v) => {
                        lastAppliedDocumentTemplateId.current = null;
                        form.setValue('document_template_id', v, { shouldValidate: true });
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          'w-full',
                          form.formState.errors.document_template_id ? 'border-destructive' : undefined
                        )}
                      >
                        <SelectValue placeholder="Select a catalogue template" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTemplates?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.document_template_id && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.document_template_id.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Body updates when you change template (your edits are replaced).
                    </p>
                  </>
                ) : documentType === 'internal' ? (
                  <>
                    <Label className="text-muted-foreground">Document template</Label>
                    <div className="flex min-h-[36px] w-full items-center rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 px-3 text-sm text-muted-foreground">
                      Manual entry — empty editor, no catalogue template
                    </div>
                  </>
                ) : (
                  <>
                    <Label className="text-muted-foreground">Document template</Label>
                    <div className="flex min-h-[36px] w-full items-center rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 px-3 text-sm text-muted-foreground">
                      External documents only
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subject"
                placeholder="Brief subject line"
                error={!!form.formState.errors.subject}
                {...form.register('subject')}
              />
              {form.formState.errors.subject && (
                <p className="text-xs text-destructive">{form.formState.errors.subject.message}</p>
              )}
            </div>
              </section>

              <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-content">
                <h3
                  id="section-content"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Content
                </h3>
            <div className="space-y-2">
              <Label>Body</Label>
              {documentType === 'internal' ? (
                <MemoEditor
                  key={documentSource === 'manual_entry' ? 'body-manual' : `body-template-${documentTemplateId || 'none'}`}
                  hideLetterhead
                  startBlank={documentSource === 'manual_entry'}
                  value={bodyHtml ?? ''}
                  onChange={(val) => form.setValue('body_html', val)}
                />
              ) : (
                <textarea
                  className={cn(
                    'min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                  placeholder="Optional cover note or summary for this external document"
                  {...form.register('body_text_external')}
                />
              )}
            </div>
              </section>

              <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-parties">
                <h3
                  id="section-parties"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Parties
                </h3>
            <div className="space-y-2">
              <Label>Sender details</Label>
              <Button type="button" variant="outline" className="h-auto w-full justify-start gap-3 py-3 px-4" disabled>
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-left text-sm leading-snug">
                  <span className="font-medium text-foreground">{senderLine}</span>
                  <span className="block text-muted-foreground">{senderEmail}</span>
                </span>
              </Button>
            </div>
              </section>

              <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-files">
                <h3
                  id="section-files"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Classification &amp; attachments
                </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>File category</Label>
                <Select
                  value={form.watch('file_category')}
                  onValueChange={(v) =>
                    form.setValue('file_category', v as CreateFormValues['file_category'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="secret">Secret</SelectItem>
                    <SelectItem value="top_secret">Top secret</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Document priority</Label>
                <Select
                  value={form.watch('document_priority')}
                  onValueChange={(v) =>
                    form.setValue('document_priority', v as CreateFormValues['document_priority'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="file_name">
                  File name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="file_name"
                  placeholder="e.g. Board memo on capitation"
                  error={!!form.formState.errors.file_name}
                  {...form.register('file_name')}
                />
                {form.formState.errors.file_name && (
                  <p className="text-xs text-destructive">{form.formState.errors.file_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref_code">File reference code</Label>
                <Input id="ref_code" placeholder="Optional — auto if left blank" {...form.register('ref_code')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Document upload</Label>
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop a file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF or DOCX · max {documentType === 'internal' ? '5' : '10'} MB
                  {documentType === 'internal' ? ' (optional attachment)' : ''}
                </p>
                {uploadFile && (
                  <p className="text-sm text-primary mt-3 font-medium">{uploadFile.name}</p>
                )}
              </div>
              {documentType === 'external' && !uploadFile && (
                <p className="text-xs text-muted-foreground">External documents require an uploaded file.</p>
              )}
            </div>
              </section>

            {showActionSection && (
              <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-direct">
                <h3
                  id="section-direct"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Direct message
                </h3>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pick a rank or role first, then choose the user. Each option shows name, rank, and department.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Action</Label>
                    <Select
                      value={form.watch('action')}
                      onValueChange={(v) => form.setValue('action', v as CreateFormValues['action'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="send">Send</SelectItem>
                        <SelectItem value="draft">Save as draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Rank / role
                      {form.watch('action') === 'send' ? (
                        <span className="text-destructive"> *</span>
                      ) : null}
                      {form.watch('action') === 'draft' ? (
                        <span className="text-muted-foreground font-normal"> (optional — narrows recipients)</span>
                      ) : null}
                    </Label>
                    <Select
                      value={form.watch('direct_recipient_rank')?.trim() || '__none__'}
                      onValueChange={(v) => {
                        const next = v === '__none__' ? '' : v;
                        form.setValue('direct_recipient_rank', next, { shouldValidate: true });
                        form.setValue('direct_recipient_user_id', '', { shouldValidate: true });
                      }}
                    >
                      <SelectTrigger
                        className={
                          form.formState.errors.direct_recipient_rank ? 'border-destructive' : undefined
                        }
                      >
                        <SelectValue placeholder="Select rank / role first" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {form.watch('action') === 'draft' ? 'Any rank (show all)' : 'Select rank / role…'}
                        </SelectItem>
                        {rankFilterOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.direct_recipient_rank && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.direct_recipient_rank.message}
                      </p>
                    )}
                    {!rankFilterOptions.length && recipientUsers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        No rank or role could be derived for directory users (missing profile rank and role
                        assignments). Ask an admin to set rank or roles on user profiles, or save as draft and pick from
                        the full list.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Recipient
                    {form.watch('action') === 'send' ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                    {form.watch('action') === 'draft' ? (
                      <span className="text-muted-foreground font-normal"> (optional for draft)</span>
                    ) : null}
                  </Label>
                  <Select
                    value={form.watch('direct_recipient_user_id') || '__none__'}
                    disabled={
                      form.watch('action') === 'send' && !form.watch('direct_recipient_rank')?.trim()
                    }
                    onValueChange={(v) =>
                      form.setValue('direct_recipient_user_id', v === '__none__' ? '' : v, {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger
                      className={
                        form.formState.errors.direct_recipient_user_id ? 'border-destructive' : undefined
                      }
                    >
                      <SelectValue
                        placeholder={
                          form.watch('action') === 'send' && !form.watch('direct_recipient_rank')?.trim()
                            ? 'Choose rank / role first'
                            : 'Select user (rank & department)'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select user</SelectItem>
                      {filteredRecipientUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {recipientUserLabel(u, roles)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.watch('action') === 'send' &&
                    !!form.watch('direct_recipient_rank')?.trim() &&
                    !filteredRecipientUsers.length && (
                      <p className="text-xs text-muted-foreground">No users with this rank in the directory.</p>
                    )}
                  {form.formState.errors.direct_recipient_user_id && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.direct_recipient_user_id.message}
                    </p>
                  )}
                </div>
              </div>
              </section>
            )}

              <section
                className="flex flex-col gap-4 border-t border-border bg-muted/10 px-4 py-6 sm:px-6"
                aria-label="Submit"
              >
                {documentType === 'internal' && documentSource === 'template' && !documentTemplates?.length && (
                  <p className="text-sm text-destructive">
                    No document template is available. Add a template under Template management (or open this page
                    with ?document_template_id=…) before using template mode.
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => navigate('/documents')}>
                    Cancel
                  </Button>
                  {deliveryMode === 'workflow' ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        loading={submitMutation.isPending}
                        disabled={submitDisabled}
                        onClick={() => {
                          form.setValue('action', 'draft');
                          void form.handleSubmit((d) => submitMutation.mutate(d))();
                        }}
                      >
                        Save as draft
                      </Button>
                      <Button
                        type="button"
                        loading={submitMutation.isPending}
                        disabled={submitDisabled}
                        onClick={() => {
                          form.setValue('action', 'send');
                          void form.handleSubmit((d) => submitMutation.mutate(d))();
                        }}
                      >
                        Submit to workflow
                      </Button>
                    </>
                  ) : (
                    <Button type="submit" loading={submitMutation.isPending} disabled={submitDisabled}>
                      Submit
                    </Button>
                  )}
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}