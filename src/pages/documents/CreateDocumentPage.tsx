import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AlertCircle, ArrowLeft, Upload, User } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MemoEditor from '@/components/documents/MemoEditor';
import { DocumentRecipientTagsEditor } from '@/components/documents/DocumentRecipientTagsEditor';
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
import { externalNotesToHtml } from '@/utils/documentDisplay';
import { formValidationSummary } from '@/utils/formValidationErrors';
import { NhiaMemoLetterhead } from '@/components/documents/NhiaMemoLetterhead';
import { useAuthStore } from '@/stores/authStore';
import type { CreateRecipientInput, DocumentUrgency } from '@/types/document';
import type { UserRecord } from '@/api/auth';

const recipientTagSchema = z.object({
  user_id: z.string().uuid('Choose a valid staff member for each recipient'),
  recipient_type: z.enum(['to', 'cc', 'bcc'], {
    required_error: 'Recipient type is required',
    invalid_type_error: 'Recipient type is required',
  }),
});

const enumField = <T extends [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, {
    required_error: `${label} is required`,
    invalid_type_error: `${label} is required`,
  });

const correspondenceDirectionSchema = enumField(['incoming', 'outgoing'], 'Correspondence');
const fileCategorySchema = enumField(['secret', 'top_secret', 'important', 'normal'], 'File category');
const prioritySchema = enumField(['normal', 'important', 'urgent', 'critical'], 'Priority');
const actionSchema = enumField(['send', 'draft'], 'Action');
const deliveryModeSchema = enumField(['workflow', 'direct_message'], 'Delivery mode');
const documentSourceSchema = enumField(['template', 'manual_entry'], 'Document source');

const sharedCreateFields = {
  delivery_mode: deliveryModeSchema,
  document_date: z.string().min(1, 'Document date is required'),
  subject: z.string().min(1, 'Subject is required').max(500),
  file_category: fileCategorySchema,
  document_priority: prioritySchema,
  file_name: z.string().min(1, 'File name is required').max(500),
  ref_code: z.string().max(120).optional(),
  action: actionSchema,
  tagged_recipients: z.array(recipientTagSchema).default([]),
  /** Workflow engine template — only validated when delivery is workflow + submit. */
  workflow_template_id: z.string().optional(),
};

/** Internal memos: optional catalogue template or manual HTML body. */
const internalDocumentSchema = z.object({
  ...sharedCreateFields,
  document_type: z.literal('internal'),
  document_source: documentSourceSchema,
  document_template_id: z.string().optional(),
  body_html: z.string().optional(),
  body_text_external: z.string().optional(),
  correspondence_direction: correspondenceDirectionSchema.optional(),
});

/** External correspondence: file upload + cover notes — no catalogue document template. */
const externalDocumentSchema = z.object({
  ...sharedCreateFields,
  document_type: z.literal('external'),
  document_source: z.literal('manual_entry'),
  document_template_id: z.string().optional(),
  body_html: z.string().optional(),
  body_text_external: z.string().optional(),
  correspondence_direction: correspondenceDirectionSchema.default('incoming'),
});

const formSchema = z
  .discriminatedUnion('document_type', [internalDocumentSchema, externalDocumentSchema])
  .superRefine((data, ctx) => {
    if (
      data.delivery_mode === 'workflow' &&
      data.action === 'send' &&
      !data.workflow_template_id?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a workflow template',
        path: ['workflow_template_id'],
      });
    }
    if (data.document_type === 'internal' && data.document_source === 'template') {
      if (!data.document_template_id?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Document template is required for internal template mode',
          path: ['document_template_id'],
        });
      }
    }
    if (data.delivery_mode === 'direct_message' && data.action === 'send') {
      const hasTo = (data.tagged_recipients ?? []).some((r) => r.recipient_type === 'to');
      if (!hasTo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Add at least one recipient tagged as To',
          path: ['tagged_recipients'],
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

/** Canonical department name from profile text, or empty when unset (no org-catalog fallback). */
function resolveWorkflowDepartment(
  profile: { department?: string | null } | undefined,
  orgDepartments: { id: number; name: string }[] | undefined
): string {
  const fromProfile = profile?.department?.trim();
  if (!fromProfile) return '';
  if (orgDepartments?.length) {
    const m = orgDepartments.find((d) => d.name.toLowerCase() === fromProfile.toLowerCase());
    if (m) return m.name;
  }
  return fromProfile;
}

/** Recipient department only; never default to the first org department. */
function resolveDepartmentFromRecipient(
  userId: string | undefined,
  users: UserRecord[] | undefined,
  orgDepartments: { id: number; name: string }[] | undefined
): string {
  if (!userId?.trim() || !users?.length) return '';
  const u = users.find((x) => x.id === userId);
  const dept = u?.department?.trim();
  if (!dept) return '';
  if (orgDepartments?.length) {
    const m = orgDepartments.find((d) => d.name.toLowerCase() === dept.toLowerCase());
    if (m) return m.name;
  }
  return dept;
}

export default function CreateDocumentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preDocumentTemplateId = searchParams.get('document_template_id') ?? undefined;
  const authUser = useAuthStore((s) => s.user);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [departmentOverride, setDepartmentOverride] = useState('');
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
      correspondence_direction: 'incoming',
      action: 'send',
      tagged_recipients: [],
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

  const recipientUsers = useMemo(
    () => (users ?? []).filter((u) => u.id !== authUser?.user_id),
    [users, authUser?.user_id]
  );

  const taggedRecipients = form.watch('tagged_recipients') ?? [];

  const profileDepartment = useMemo(
    () => resolveWorkflowDepartment(profile, orgScope?.departments),
    [profile, orgScope?.departments]
  );

  const needsDepartmentPicker = documentType === 'external' && !profileDepartment;

  const lastAppliedDocumentTemplateId = useRef<string | null>(null);
  const prevDocumentSource = useRef(documentSource);

  const applyExternalDocumentMode = () => {
    form.setValue('document_source', 'manual_entry', { shouldValidate: false });
    form.setValue('document_template_id', '', { shouldValidate: false });
    form.setValue('body_html', '', { shouldValidate: false });
    form.setValue('correspondence_direction', 'incoming', { shouldValidate: false });
    form.clearErrors(['document_template_id', 'body_html', 'document_source']);
  };

  useEffect(() => {
    if (documentType === 'external') {
      applyExternalDocumentMode();
    }
  }, [documentType, form]); // eslint-disable-line react-hooks/exhaustive-deps

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

      const firstToRecipient = (data.tagged_recipients ?? []).find((r) => r.recipient_type === 'to');
      let department =
        data.document_type === 'external'
          ? departmentOverride.trim() || resolveWorkflowDepartment(profile, orgDepts)
          : data.delivery_mode === 'direct_message' && firstToRecipient
            ? resolveDepartmentFromRecipient(firstToRecipient.user_id, users, orgDepts)
            : resolveWorkflowDepartment(profile, orgDepts);

      if (data.document_type === 'external' && !department.trim()) {
        throw new Error(
          'Department is required for external documents. Select your department below, or ask an administrator to set the department on your user profile.'
        );
      }

      const recipients: CreateRecipientInput[] | undefined =
        (data.tagged_recipients ?? []).length > 0 ? data.tagged_recipients : undefined;

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
      const notesHtml = notes ? externalNotesToHtml(notes) : undefined;
      const title = data.subject.trim() || data.file_name.trim();
      const created = await documentsApi.uploadExternal(uploadFile, title, department, {
        ref_number: ref,
        correspondence_direction: data.correspondence_direction ?? 'incoming',
        urgency,
        content: notesHtml,
        ...creationProfile,
      });
      const docId = created.document.id;

      if (recipients?.length) {
        for (const r of recipients) {
          await documentsApi.addRecipient(docId, r);
        }
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.document(docId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentRecipients(docId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workflowInstanceByDocument(docId) });
      navigate(`/documents/${docId}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const senderLine =
    profile?.full_name?.trim() || profile?.username || authUser?.username || 'Signed-in user';
  const senderEmail = profile?.email?.trim() || '—';
  const letterheadLabel = documentType === 'internal' ? 'Internal document' : 'External document';
  const submitDisabled =
    (documentType === 'internal' &&
      documentSource === 'template' &&
      (!documentTemplates?.length || !documentTemplateId?.trim())) ||
    (deliveryMode === 'workflow' &&
      (!workflowTemplates?.length || !workflowTemplateId?.trim())) ||
    false;

  const validationAlert = useMemo(() => {
    if (form.formState.submitCount === 0) return null;
    const errs = { ...form.formState.errors };
    if (documentType === 'external') {
      delete errs.document_template_id;
      delete errs.body_html;
    }
    if (!Object.keys(errs).length) return null;
    return formValidationSummary(errs);
  }, [form.formState.submitCount, form.formState.errors, documentType]);

  const onFormInvalid = (errors: FieldErrors<CreateFormValues>) => {
    toast.error(formValidationSummary(errors));
  };

  const attemptSubmit = (nextAction?: CreateFormValues['action']) => {
    if (nextAction) {
      form.setValue('action', nextAction, { shouldValidate: false });
    }
    if (form.getValues('document_type') === 'external') {
      form.clearErrors(['document_template_id', 'body_html']);
      if (!uploadFile) {
        toast.error('Upload a PDF or Word file in the Document upload section before submitting.');
        return;
      }
      if (needsDepartmentPicker && !departmentOverride.trim()) {
        toast.error(
          'Select your department in the Document profile section (required for external upload).'
        );
        return;
      }
    }
    void form.handleSubmit((d) => submitMutation.mutate(d), onFormInvalid)();
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> Process
      </Button>

      <PageHeader
        title="Create document"
        description="Choose delivery mode and document input. With workflow, pick which workflow template runs after submit."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (deliveryMode === 'workflow') return;
          attemptSubmit();
        }}
        className="space-y-6"
      >
        {validationAlert ? (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not submit — fix the following</AlertTitle>
            <AlertDescription className="text-sm">{validationAlert}</AlertDescription>
          </Alert>
        ) : null}

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
                {needsDepartmentPicker && (
                  <div className="space-y-1.5 max-w-md">
                    <Label>
                      Your department <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={departmentOverride.trim() || undefined}
                      onValueChange={(v) => setDepartmentOverride(v)}
                    >
                      <SelectTrigger
                        className={cn(
                          'w-full',
                          !departmentOverride.trim() ? 'border-destructive/70' : undefined
                        )}
                      >
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgScope?.departments?.map((d) => (
                          <SelectItem key={d.id} value={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Your user profile has no department. External upload requires one for registry
                      tracking (NHIA/IN|OUT/…).
                    </p>
                  </div>
                )}

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
                  onValueChange={(v) => {
                    const next = v as CreateFormValues['document_type'];
                    form.setValue('document_type', next, { shouldValidate: false });
                    if (next === 'external') {
                      applyExternalDocumentMode();
                    } else {
                      form.clearErrors(['correspondence_direction']);
                    }
                  }}
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
                    <Label>
                      Correspondence <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.watch('correspondence_direction') || 'incoming'}
                      onValueChange={(v) =>
                        form.setValue('correspondence_direction', v as 'incoming' | 'outgoing', {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          'w-full',
                          form.formState.errors.correspondence_direction ? 'border-destructive' : undefined
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incoming">Incoming</SelectItem>
                        <SelectItem value="outgoing">Outgoing</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.correspondence_direction && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.correspondence_direction.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Registry tracking ID (NHIA/IN/… or NHIA/OUT/…) is assigned automatically.
                    </p>
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
                  editorMinHeight={documentSource === 'manual_entry' ? 560 : 400}
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

              <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-recipients">
                <h3
                  id="section-recipients"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"
                >
                  <User className="h-3.5 w-3.5" />
                  Recipients
                </h3>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Tag staff as <span className="font-medium text-foreground">To</span>,{' '}
                    <span className="font-medium text-foreground">CC</span>, or{' '}
                    <span className="font-medium text-foreground">BCC</span>. Optional for workflow drafts; direct
                    message send requires at least one To recipient.
                  </p>
                  <DocumentRecipientTagsEditor
                    users={recipientUsers}
                    roles={roles}
                    currentUserId={authUser?.user_id}
                    value={taggedRecipients}
                    onChange={(next) =>
                      form.setValue('tagged_recipients', next, { shouldValidate: true })
                    }
                  />
                  {form.formState.errors.tagged_recipients && (
                    <p className="text-xs text-destructive">
                      {typeof form.formState.errors.tagged_recipients.message === 'string'
                        ? form.formState.errors.tagged_recipients.message
                        : 'Check recipient tags'}
                    </p>
                  )}
                  {deliveryMode === 'direct_message' && (
                    <div className="space-y-1.5 max-w-xs pt-1 border-t border-border/60">
                      <Label>Direct message action</Label>
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
                  )}
                </div>
              </section>

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
                        onClick={() => attemptSubmit('draft')}
                      >
                        Save as draft
                      </Button>
                      <Button
                        type="button"
                        loading={submitMutation.isPending}
                        disabled={submitDisabled}
                        onClick={() => attemptSubmit('send')}
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