import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AlertCircle, ArrowLeft, FileText, Paperclip, Upload, User, X } from 'lucide-react';
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
import type {
  CorrespondenceDirection,
  CreateRecipientInput,
  DocumentCreationProfile,
  DocumentUrgency,
} from '@/types/document';
import type { UserRecord } from '@/api/auth';

const recipientTagSchema = z.object({
  user_id: z.string().uuid('Choose a valid staff member for each recipient'),
  recipient_type: z.enum(['to', 'cc', 'bcc'], { message: 'Recipient type is required' }),
});

const enumField = <const T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, { message: `${label} is required` });

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
  tagged_recipients: z.array(recipientTagSchema),
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

type CreateFormInput = z.input<typeof formSchema>;
type CreateFormValues = z.output<typeof formSchema>;

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

  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
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

  const form = useForm<CreateFormInput, unknown, CreateFormValues>({
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

  const onPrimaryDrop = (accepted: File[]) => {
    if (accepted[0]) {
      setPrimaryFile(accepted[0]);
      const base = accepted[0].name.replace(/\.[^/.]+$/, '');
      if (!form.getValues('file_name')?.trim()) {
        form.setValue('file_name', base, { shouldValidate: true });
      }
      toast.success(`Main document: ${accepted[0].name}`);
    }
  };

  const onSupportingDrop = (accepted: File[]) => {
    if (!accepted.length) return;
    setSupportingFiles((prev) => {
      const names = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const next = [...prev];
      for (const file of accepted) {
        const key = `${file.name}-${file.size}`;
        if (!names.has(key)) {
          next.push(file);
          names.add(key);
        }
      }
      return next;
    });
    toast.success(
      accepted.length === 1
        ? `Supporting document: ${accepted[0].name}`
        : `${accepted.length} supporting documents added`
    );
  };

  const clearPrimaryFile = () => {
    setPrimaryFile(null);
    toast.info('Main document removed.');
  };

  const removeSupportingFile = (index: number) => {
    setSupportingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const maxPrimaryBytes = 10 * 1024 * 1024;
  const maxSupportingBytes = 5 * 1024 * 1024;

  const uploadAllSupporting = async (docId: string, files: File[]) => {
    for (const file of files) {
      await documentsApi.uploadAttachment(docId, file);
    }
  };

  const {
    getRootProps: getPrimaryRootProps,
    getInputProps: getPrimaryInputProps,
    isDragActive: isPrimaryDragActive,
    open: openPrimaryPicker,
  } = useDropzone({
    onDrop: onPrimaryDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: maxPrimaryBytes,
    noClick: !!primaryFile,
    noKeyboard: !!primaryFile,
  });

  const {
    getRootProps: getSupportingRootProps,
    getInputProps: getSupportingInputProps,
    isDragActive: isSupportingDragActive,
    open: openSupportingPicker,
  } = useDropzone({
    onDrop: onSupportingDrop,
    maxSize: maxSupportingBytes,
    multiple: true,
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

      const creationProfile: DocumentCreationProfile = {
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
        if (data.document_source === 'manual_entry' && !primaryFile) {
          throw new Error('Upload the main document file for manual entry.');
        }

        const manualNotes =
          data.document_source === 'manual_entry' ? data.body_text_external?.trim() : '';
        const innerBody =
          data.document_source === 'manual_entry'
            ? manualNotes
              ? externalNotesToHtml(manualNotes)
              : '<p></p>'
            : (data.body_html ?? '').trim() || '<p></p>';

        if (data.document_source === 'manual_entry') {
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
          if (primaryFile) {
            await documentsApi.uploadPrimaryFile(docId, primaryFile);
          }
          await uploadAllSupporting(docId, supportingFiles);
          await finalizeAfterCreate(docId);
          return docId;
        }

        const tplId = data.document_template_id?.trim();
        if (!tplId) throw new Error('Select a document template.');
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
        if (primaryFile) {
          await documentsApi.uploadPrimaryFile(docId, primaryFile);
        }
        await uploadAllSupporting(docId, supportingFiles);
        await finalizeAfterCreate(docId);
        return docId;
      }

      if (!primaryFile) throw new Error('Please upload the main document file');
      const notes = data.body_text_external?.trim();
      const notesHtml = notes ? externalNotesToHtml(notes) : undefined;
      const title = data.subject.trim() || data.file_name.trim();
      const created = await documentsApi.uploadExternal(primaryFile, title, department, {
        ref_number: ref,
        correspondence_direction: (data.correspondence_direction ?? 'incoming') as CorrespondenceDirection,
        urgency,
        content: notesHtml,
        ...creationProfile,
      });
      const docId = created.document.id;

      await uploadAllSupporting(docId, supportingFiles);

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

  const isInternal = documentType === 'internal';
  const isExternal = documentType === 'external';
  const catalogueTemplateEnabled = isInternal && documentSource === 'template';
  const workflowTemplateEnabled = deliveryMode === 'workflow';
  const documentInputEnabled = isInternal;
  const showTemplateRow = catalogueTemplateEnabled || workflowTemplateEnabled;

  const documentInputDisabledReason = isExternal
    ? 'External documents always use file upload; input mode is fixed.'
    : null;

  const correspondenceEnabled = isExternal;
  const correspondenceDisabledReason = isInternal
    ? 'Correspondence direction applies to external documents only.'
    : null;

  const validationAlert = useMemo(() => {
    if (form.formState.submitCount === 0) return null;
    const errs = { ...form.formState.errors };
    if (documentType === 'external') {
      delete errs.document_template_id;
      delete errs.body_html;
    }
    if (!Object.keys(errs).length) return null;
    return formValidationSummary(errs as FieldErrors<CreateFormValues>);
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
      if (!primaryFile) {
        toast.error('Upload the main document file before submitting.');
        return;
      }
      if (needsDepartmentPicker && !departmentOverride.trim()) {
        toast.error(
          'Select your department in the Document profile section (required for external upload).'
        );
        return;
      }
    }
    if (
      form.getValues('document_type') === 'internal' &&
      form.getValues('document_source') === 'manual_entry' &&
      !primaryFile
    ) {
      toast.error('Upload the main document file for manual entry.');
      return;
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 min-w-0">
                    <Label>Document type</Label>
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
                    <Label>
                      Correspondence{' '}
                      {correspondenceEnabled ? <span className="text-destructive">*</span> : null}
                    </Label>
                    <Select
                      disabled={!correspondenceEnabled}
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
                          !correspondenceEnabled && 'opacity-60',
                          form.formState.errors.correspondence_direction ? 'border-destructive' : undefined
                        )}
                      >
                        <SelectValue
                          placeholder={
                            correspondenceEnabled ? undefined : 'Not applicable for internal'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incoming">Incoming</SelectItem>
                        <SelectItem value="outgoing">Outgoing</SelectItem>
                      </SelectContent>
                    </Select>
                    {correspondenceDisabledReason && (
                      <p className="text-xs text-muted-foreground">{correspondenceDisabledReason}</p>
                    )}
                    {form.formState.errors.correspondence_direction && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.correspondence_direction.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="space-y-2 min-w-0 flex-1">
                    <Label id="delivery-mode-label">Delivery</Label>
                    <div
                      role="radiogroup"
                      aria-labelledby="delivery-mode-label"
                      className="flex flex-col gap-2 sm:flex-row sm:gap-3"
                    >
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors flex-1 min-w-0',
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
                          'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors flex-1 min-w-0',
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
                  </div>

                  <div className="space-y-2 min-w-0 flex-1">
                    <Label id="document-source-label">Document input</Label>
                    <div
                      role="radiogroup"
                      aria-labelledby="document-source-label"
                      className={cn(
                        'flex flex-col gap-2 sm:flex-row sm:gap-3',
                        !documentInputEnabled && 'opacity-60 pointer-events-none'
                      )}
                    >
                      <label
                        className={cn(
                          'flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors flex-1 min-w-0',
                          documentInputEnabled ? 'cursor-pointer' : 'cursor-not-allowed',
                          documentSource === 'template'
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-background',
                          documentInputEnabled && documentSource !== 'template' && 'hover:bg-muted/40'
                        )}
                      >
                        <input
                          type="radio"
                          name="document_source"
                          value="template"
                          className="h-4 w-4 shrink-0 accent-primary"
                          checked={documentSource === 'template'}
                          disabled={!documentInputEnabled}
                          onChange={() =>
                            form.setValue('document_source', 'template', { shouldValidate: true })
                          }
                        />
                        <span className="font-medium">Use template</span>
                      </label>
                      <label
                        className={cn(
                          'flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors flex-1 min-w-0',
                          documentInputEnabled ? 'cursor-pointer' : 'cursor-not-allowed',
                          documentSource === 'manual_entry'
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-background',
                          documentInputEnabled &&
                            documentSource !== 'manual_entry' &&
                            'hover:bg-muted/40'
                        )}
                      >
                        <input
                          type="radio"
                          name="document_source"
                          value="manual_entry"
                          className="h-4 w-4 shrink-0 accent-primary"
                          checked={documentSource === 'manual_entry'}
                          disabled={!documentInputEnabled}
                          onChange={() =>
                            form.setValue('document_source', 'manual_entry', { shouldValidate: true })
                          }
                        />
                        <span className="font-medium">Manual entry</span>
                      </label>
                    </div>
                    {documentInputDisabledReason && (
                      <p className="text-xs text-muted-foreground">{documentInputDisabledReason}</p>
                    )}
                  </div>
                </div>

                {showTemplateRow && (
                  <div
                    className={cn(
                      'grid gap-4',
                      catalogueTemplateEnabled && workflowTemplateEnabled
                        ? 'sm:grid-cols-2'
                        : 'max-w-xl'
                    )}
                  >
                    {workflowTemplateEnabled && (
                      <div className="space-y-1.5 min-w-0">
                        <Label>
                          Workflow template <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={workflowTemplateId?.trim() ? workflowTemplateId : undefined}
                          onValueChange={(v) =>
                            form.setValue('workflow_template_id', v, { shouldValidate: true })
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              'w-full',
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
                            No workflow templates found. Create one under Workflows first.
                          </p>
                        )}
                      </div>
                    )}

                    {catalogueTemplateEnabled && (
                      <div className="space-y-1.5 min-w-0">
                        <Label>
                          Catalogue template <span className="text-destructive">*</span>
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
                        {!documentTemplates?.length && (
                          <p className="text-xs text-destructive">
                            No catalogue templates found. Add one under Template management.
                          </p>
                        )}
                      </div>
                    )}
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
              <Label>
                {documentType === 'internal' && documentSource === 'template'
                  ? 'Memo body'
                  : documentType === 'internal'
                    ? 'Cover notes (optional)'
                    : 'Cover notes (optional)'}
              </Label>
              {documentType === 'internal' && documentSource === 'template' ? (
                <MemoEditor
                  key={`body-template-${documentTemplateId || 'none'}`}
                  hideLetterhead
                  startBlank={false}
                  editorMinHeight={400}
                  value={bodyHtml ?? ''}
                  onChange={(val) => form.setValue('body_html', val)}
                />
              ) : (
                <textarea
                  className={cn(
                    'min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                  placeholder={
                    documentType === 'internal'
                      ? 'Optional notes to accompany the uploaded main document'
                      : 'Optional cover note or summary for this external document'
                  }
                  {...form.register('body_text_external')}
                />
              )}
              {documentType === 'internal' && documentSource === 'manual_entry' && (
                <p className="text-xs text-muted-foreground">
                  Upload the main document in the Document files section below. Supporting documents are optional.
                </p>
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

              <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-classification">
                <h3
                  id="section-classification"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Classification
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
              </section>

              <section className="space-y-4 px-4 py-6 sm:px-6" aria-labelledby="section-files">
                <h3
                  id="section-files"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Document files
                </h3>

            <div className="space-y-2">
              <Label>
                Main document{' '}
                {documentType === 'external' ||
                (documentType === 'internal' && documentSource === 'manual_entry') ? (
                  <span className="text-destructive">*</span>
                ) : null}
              </Label>
              <input {...getPrimaryInputProps()} className="sr-only" />
              {primaryFile ? (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-background"
                      aria-hidden
                    >
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" title={primaryFile.name}>
                        {primaryFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {primaryFile.size >= 1024 * 1024
                          ? `${(primaryFile.size / (1024 * 1024)).toFixed(1)} MB`
                          : `${(primaryFile.size / 1024).toFixed(1)} KB`}
                        {' · '}
                        PDF or DOCX · shown on document view
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button type="button" variant="outline" size="sm" onClick={() => openPrimaryPicker()}>
                      Replace file
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={clearPrimaryFile}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  {...getPrimaryRootProps()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                    isPrimaryDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  )}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Drop the main document here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF or DOCX · max 10 MB</p>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Label>Supporting documents (optional)</Label>
              <input {...getSupportingInputProps()} className="sr-only" />
              <div
                {...getSupportingRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                  isSupportingDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}
              >
                <Paperclip className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Add supporting documents</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Any file type · max 5 MB each · you can add more than one
                </p>
              </div>
              {supportingFiles.length > 0 && (
                <ul className="space-y-2 pt-2">
                  {supportingFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                    >
                      <span className="truncate flex items-center gap-2 min-w-0">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate" title={file.name}>
                          {file.name}
                        </span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {file.size >= 1024 * 1024
                            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                            : `${(file.size / 1024).toFixed(1)} KB`}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeSupportingFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => openSupportingPicker()}
              >
                <Paperclip className="h-4 w-4" />
                Add another file
              </Button>
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