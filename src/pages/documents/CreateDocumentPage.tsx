import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Zap, Eye, Upload, Plus, Trash2, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MemoEditor from '@/components/documents/MemoEditor';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { documentsApi } from '@/api/documents';
import { searchApi } from '@/api/search';
import { orchestratorApi } from '@/api/orchestrator';
import { workflowsApi } from '@/api/workflows';
import { tasksApi } from '@/api/tasks';
import { authApi } from '@/api/auth';
import { registerUsers } from '@/utils/users';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS, SEEDED_USER_IDS } from '@/utils/constants';
import type { WorkflowTemplate } from '@/types/workflow';
import type { RecipientType } from '@/types/document';
import { cn } from '@/utils/cn';

const internalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Max 500 characters'),
  content: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  urgency: z.enum(['normal', 'urgent', 'very_urgent']),
  /** Leave blank for NHIA/DEPT/YEAR/SEQ auto-generation */
  ref_number: z.string().max(120).optional(),
  submit_immediately: z.boolean(),
  workflow_template_id: z.string().optional(),
  recipients: z.array(
    z.object({
      user_id: z.union([z.string().uuid(), z.literal('')]),
      recipient_type: z.enum(['to', 'cc', 'bcc']),
    })
  ),
});

type InternalForm = z.infer<typeof internalSchema>;

const externalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  department: z.string().min(1, 'Department is required'),
  ref_number: z.string().max(120).optional(),
  submit_immediately: z.boolean(),
  workflow_template_id: z.string().optional(),
  recipients: z.array(
    z.object({
      user_id: z.union([z.string().uuid(), z.literal('')]),
      recipient_type: z.enum(['to', 'cc', 'bcc']),
    })
  ),
});

type ExternalForm = z.infer<typeof externalSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStep1Role(template: WorkflowTemplate): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const step1 = template.steps.find((s: any) => s.step_number === 1 || s.step === 1) as any;
  return step1?.assignee_role ?? null;
}

async function resolveRoleToUserId(role: string): Promise<string | null> {
  for (const userId of SEEDED_USER_IDS) {
    try {
      const data = await authApi.getUserRoles(userId);
      if (data.roles.some((r) => r.name === role)) return userId;
    } catch {
      /* skip */
    }
  }
  return null;
}

export default function CreateDocumentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preWorkflowTemplateId = searchParams.get('template_id') ?? undefined;

  const [creationMode, setCreationMode] = useState<'internal' | 'external'>('internal');
  const [preview, setPreview] = useState(false);
  const [externalFile, setExternalFile] = useState<File | null>(null);

  const { data: workflowTemplates } = useQuery({
    queryKey: [QUERY_KEYS.workflowTemplates],
    queryFn: () => workflowsApi.getTemplates(),
  });

  const { data: users } = useQuery({
    queryKey: ['auth-users'],
    queryFn: async () => {
      const list = await authApi.listUsers();
      registerUsers(list.map((u) => ({ id: u.id, username: u.username })));
      return list;
    },
  });

  const internalForm = useForm<InternalForm>({
    resolver: zodResolver(internalSchema),
    defaultValues: {
      urgency: 'normal',
      submit_immediately: !!preWorkflowTemplateId,
      workflow_template_id: preWorkflowTemplateId,
      recipients: [] as InternalForm['recipients'],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: internalForm.control,
    name: 'recipients',
  });

  const externalForm = useForm<ExternalForm>({
    resolver: zodResolver(externalSchema),
    defaultValues: {
      submit_immediately: false,
      recipients: [],
    },
  });

  const extRecipients = useFieldArray({
    control: externalForm.control,
    name: 'recipients',
  });

  const watchTitle = internalForm.watch('title');
  const watchContent = internalForm.watch('content');
  const submitImmediately = internalForm.watch('submit_immediately');
  const workflowTemplateId = internalForm.watch('workflow_template_id');

  const [ocrOpen, setOcrOpen] = useState(false);

  const ocrMutation = useMutation({
    mutationFn: (file: File) => searchApi.ocr(file),
    onSuccess: (data) => {
      const parts = data.text.split(/\n\n/).filter(Boolean);
      const html =
        parts.length > 0
          ? parts.map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')
          : `<p>${data.text.replace(/\n/g, '<br/>')}</p>`;
      const cur = internalForm.getValues('content') ?? '';
      internalForm.setValue('content', cur ? `${cur}${html}` : html);
      toast.success('OCR text inserted into the editor');
      setOcrOpen(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const selectedWorkflowTemplate = workflowTemplates?.find((t) => t.id === workflowTemplateId);
  const step1Role = selectedWorkflowTemplate ? getStep1Role(selectedWorkflowTemplate) : null;

  const onDrop = (accepted: File[]) => {
    if (accepted[0]) {
      setExternalFile(accepted[0]);
      toast.success(`Selected ${accepted[0].name}`);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const internalMutation = useMutation({
    mutationFn: async (data: InternalForm) => {
      const recipientRows = (data.recipients ?? []).filter(
        (r): r is { user_id: string; recipient_type: RecipientType } =>
          typeof r.user_id === 'string' && r.user_id.length > 0
      );
      const recipients = recipientRows.length
        ? recipientRows.map((r) => ({
            user_id: r.user_id,
            recipient_type: r.recipient_type,
          }))
        : undefined;

      const result = await documentsApi.create({
        title: data.title,
        content: data.content,
        category: 'internal_memo',
        department: data.department.trim(),
        urgency: data.urgency,
        ref_number: data.ref_number?.trim() || undefined,
        recipients,
      });

      if (data.submit_immediately && data.workflow_template_id) {
        const wf = await orchestratorApi.startWorkflow({
          template_id: data.workflow_template_id,
          document_id: result.document.id,
        });
        const template = workflowTemplates?.find((t) => t.id === data.workflow_template_id);
        if (template) {
          const role = getStep1Role(template);
          if (role) {
            try {
              const assigneeId = await resolveRoleToUserId(role);
              if (assigneeId) {
                await tasksApi.create({
                  workflow_instance_id: wf.workflow.id,
                  step_number: 1,
                  assignee_id: assigneeId,
                });
              }
            } catch (e) {
              console.warn('[create-doc] Task creation failed:', e);
            }
          }
        }
      }

      return result.document.id;
    },
    onSuccess: (docId) => {
      toast.success(
        submitImmediately && workflowTemplateId
          ? 'Document created and workflow started'
          : 'Document created successfully'
      );
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.allDocuments] });
      SEEDED_USER_IDS.forEach((uid) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks(uid) }));
      navigate(`/documents/${docId}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const externalSubmitImmediate = externalForm.watch('submit_immediately');
  const externalWorkflowId = externalForm.watch('workflow_template_id');

  const externalMutation = useMutation({
    mutationFn: async (data: ExternalForm) => {
      if (!externalFile) throw new Error('Please attach a PDF or DOCX file');
      const result = await documentsApi.uploadExternal(
        externalFile,
        data.title.trim(),
        data.department.trim(),
        { ref_number: data.ref_number?.trim() }
      );
      const docId = result.document.id;

      const recRows = (data.recipients ?? []).filter(
        (r): r is { user_id: string; recipient_type: RecipientType } =>
          typeof r.user_id === 'string' && r.user_id.length > 0
      );
      for (const r of recRows) {
        await documentsApi.addRecipient(docId, {
          user_id: r.user_id,
          recipient_type: r.recipient_type,
        });
      }

      if (data.submit_immediately && data.workflow_template_id) {
        const wf = await orchestratorApi.startWorkflow({
          template_id: data.workflow_template_id,
          document_id: docId,
        });
        const wfTpl = workflowTemplates?.find((t) => t.id === data.workflow_template_id);
        if (wfTpl) {
          const role = getStep1Role(wfTpl);
          if (role) {
            try {
              const assigneeId = await resolveRoleToUserId(role);
              if (assigneeId) {
                await tasksApi.create({
                  workflow_instance_id: wf.workflow.id,
                  step_number: 1,
                  assignee_id: assigneeId,
                });
              }
            } catch (e) {
              console.warn('[external-doc] Task creation failed:', e);
            }
          }
        }
      }

      return docId;
    },
    onSuccess: (docId) => {
      toast.success('External correspondence saved');
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.allDocuments] });
      SEEDED_USER_IDS.forEach((uid) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks(uid) }));
      navigate(`/documents/${docId}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="space-y-5 max-w-6xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> Documents
      </Button>

      <PageHeader
        title="Create Document"
        description="Add metadata and write the body in the editor, or upload external correspondence. OCR can insert text from a scan."
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant={creationMode === 'internal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCreationMode('internal')}
        >
          <FileText className="h-4 w-4" /> Internal memo
        </Button>
        <Button
          type="button"
          variant={creationMode === 'external' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCreationMode('external')}
        >
          <Upload className="h-4 w-4" /> External correspondence
        </Button>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document preview (draft)</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg bg-white">
            <div className="bg-white border-b px-8 py-6 text-center">
              <div className="flex items-center justify-center gap-4 mb-3">
                <img src="/logo.png" alt="NHIA Logo" className="h-16 w-16 object-contain" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Federal Republic of Nigeria
                  </p>
                  <h2 className="text-lg font-bold text-green-800 leading-tight">
                    National Health Insurance Authority
                  </h2>
                  <p className="text-xs text-gray-600">
                    Plot 297, Herbert Macaulay Way, Central Business District, Abuja
                  </p>
                </div>
              </div>
              <div className="border-t-4 border-green-700 mt-2 pt-2">
                <p className="text-sm font-bold uppercase tracking-widest text-gray-700">Internal Memorandum</p>
                {watchTitle && <p className="text-xs text-gray-500 mt-0.5">{watchTitle}</p>}
              </div>
            </div>
            <div
              className="prose prose-sm max-w-none px-8 py-6 text-gray-900"
              dangerouslySetInnerHTML={{
                __html: watchContent || '<p class="text-gray-400 italic">No content yet.</p>',
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ocrOpen} onOpenChange={setOcrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extract text with OCR</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Same pipeline as Search → OCR. Text is appended to the memo body as HTML.
          </p>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="text-sm w-full"
            disabled={ocrMutation.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) ocrMutation.mutate(f);
              e.target.value = '';
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOcrOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {creationMode === 'internal' ? (
        <form
          onSubmit={internalForm.handleSubmit((d) => internalMutation.mutate(d))}
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Classification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="department">
                    Department <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="department"
                    placeholder="e.g. Finance, HR"
                    error={!!internalForm.formState.errors.department}
                    {...internalForm.register('department')}
                  />
                  {internalForm.formState.errors.department && (
                    <p className="text-xs text-destructive">{internalForm.formState.errors.department.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Urgency</Label>
                  <Select
                    value={internalForm.watch('urgency')}
                    onValueChange={(v) =>
                      internalForm.setValue('urgency', v as InternalForm['urgency'])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="very_urgent">Very urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref_number">Reference number (optional)</Label>
                <Input
                  id="ref_number"
                  placeholder="Leave blank for auto-generated NHIA/DEPT/YEAR/sequence"
                  {...internalForm.register('ref_number')}
                />
                <p className="text-xs text-muted-foreground">
                  Unique reference; leave empty for automatic numbering.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Body
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Enter document title"
                  error={!!internalForm.formState.errors.title}
                  autoFocus
                  {...internalForm.register('title')}
                />
                {internalForm.formState.errors.title && (
                  <p className="text-xs text-destructive">{internalForm.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="mb-0">Body (CKEditor)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setOcrOpen(true)}>
                    <Scan className="h-4 w-4" /> OCR into editor
                  </Button>
                </div>
                <MemoEditor
                  value={watchContent ?? ''}
                  onChange={(val) => internalForm.setValue('content', val)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recipients (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[180px] space-y-1">
                    <Label className="text-xs">User</Label>
                    <Select
                      value={internalForm.watch(`recipients.${index}.user_id`) || '__none__'}
                      onValueChange={(v) =>
                        internalForm.setValue(`recipients.${index}.user_id`, v === '__none__' ? '' : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select user</SelectItem>
                        {users?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={internalForm.watch(`recipients.${index}.recipient_type`)}
                      onValueChange={(v) =>
                        internalForm.setValue(`recipients.${index}.recipient_type`, v as RecipientType)
                      }
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
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ user_id: '', recipient_type: 'to' })}
              >
                <Plus className="h-4 w-4" /> Add recipient
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" /> Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  submitImmediately ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={submitImmediately}
                  onChange={(e) => internalForm.setValue('submit_immediately', e.target.checked)}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Start workflow after create</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Runs workflow engine on this document (same as orchestrator workflow-start).
                  </p>
                </div>
              </label>

              {submitImmediately && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>
                      Workflow template <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={workflowTemplateId ?? ''}
                      onValueChange={(v) => internalForm.setValue('workflow_template_id', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select workflow template" />
                      </SelectTrigger>
                      <SelectContent>
                        {workflowTemplates?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.steps.length} step{t.steps.length !== 1 ? 's' : ''})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {step1Role && (
                    <Alert variant="info">
                      <AlertDescription>
                        A task may be assigned to a <strong className="capitalize">{step1Role}</strong> for step 1
                        when possible (seed users resolved by role).
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/documents')}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={() => setPreview(true)}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button
              type="submit"
              loading={internalMutation.isPending}
              disabled={submitImmediately && !workflowTemplateId}
            >
              {submitImmediately && workflowTemplateId ? 'Create & start workflow' : 'Create document'}
            </Button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={externalForm.handleSubmit((d) => externalMutation.mutate(d))}
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload PDF or DOCX</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF or DOCX · max 10 MB</p>
                {externalFile && (
                  <p className="text-sm text-primary mt-3 font-medium">{externalFile.name}</p>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input {...externalForm.register('title')} error={!!externalForm.formState.errors.title} />
                  {externalForm.formState.errors.title && (
                    <p className="text-xs text-destructive">{externalForm.formState.errors.title.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Department <span className="text-destructive">*</span>
                  </Label>
                  <Input {...externalForm.register('department')} error={!!externalForm.formState.errors.department} />
                  {externalForm.formState.errors.department && (
                    <p className="text-xs text-destructive">{externalForm.formState.errors.department.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ext-ref">Reference number (optional)</Label>
                <Input
                  id="ext-ref"
                  placeholder="Auto-generated if empty"
                  {...externalForm.register('ref_number')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recipients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {extRecipients.fields.map((field, index) => (
                <div key={field.id} className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[180px] space-y-1">
                    <Label className="text-xs">User</Label>
                    <Select
                      value={externalForm.watch(`recipients.${index}.user_id`) || '__none__'}
                      onValueChange={(v) =>
                        externalForm.setValue(`recipients.${index}.user_id`, v === '__none__' ? '' : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select user</SelectItem>
                        {users?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={externalForm.watch(`recipients.${index}.recipient_type`)}
                      onValueChange={(v) =>
                        externalForm.setValue(`recipients.${index}.recipient_type`, v as RecipientType)
                      }
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
                  <Button type="button" variant="ghost" size="icon" onClick={() => extRecipients.remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => extRecipients.append({ user_id: '', recipient_type: 'to' })}
              >
                <Plus className="h-4 w-4" /> Add recipient
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" /> Workflow after upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  externalSubmitImmediate ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary"
                  checked={externalSubmitImmediate}
                  onChange={(e) => externalForm.setValue('submit_immediately', e.target.checked)}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Start workflow after upload</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Submit triggers routing workflow once the file and metadata are saved.
                  </p>
                </div>
              </label>

              {externalSubmitImmediate && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>
                      Workflow template <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={externalWorkflowId ?? ''}
                      onValueChange={(v) => externalForm.setValue('workflow_template_id', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select workflow template" />
                      </SelectTrigger>
                      <SelectContent>
                        {workflowTemplates?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 flex-wrap">
            <Button type="button" variant="outline" onClick={() => navigate('/documents')}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={externalMutation.isPending}
              disabled={!externalFile || (externalSubmitImmediate && !externalWorkflowId)}
            >
              {externalSubmitImmediate && externalWorkflowId
                ? 'Upload, tag recipients & start workflow'
                : 'Upload document'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
