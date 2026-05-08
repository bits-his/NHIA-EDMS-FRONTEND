import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Zap, Info, CheckCircle2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MemoEditor from '@/components/documents/MemoEditor';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { documentsApi } from '@/api/documents';
import { orchestratorApi } from '@/api/orchestrator';
import { workflowsApi } from '@/api/workflows';
import { tasksApi } from '@/api/tasks';
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS, SEEDED_USER_IDS } from '@/utils/constants';
import type { WorkflowTemplate } from '@/types/workflow';
import { cn } from '@/utils/cn';

const createSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Max 500 characters'),
  content: z.string().optional(),
  template_id: z.string().optional(),
  submit_immediately: z.boolean(),
});
type CreateForm = z.infer<typeof createSchema>;

async function resolveRoleToUserId(role: string): Promise<string | null> {
  for (const userId of SEEDED_USER_IDS) {
    try {
      const data = await authApi.getUserRoles(userId);
      if (data.roles.some((r) => r.name === role)) return userId;
    } catch { /* skip */ }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStep1Role(template: WorkflowTemplate): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const step1 = template.steps.find((s: any) => s.step_number === 1 || s.step === 1) as any;
  return step1?.assignee_role ?? null;
}

export default function CreateDocumentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedTemplateId = searchParams.get('template_id') ?? undefined;

  const { data: templates } = useQuery({
    queryKey: [QUERY_KEYS.workflowTemplates],
    queryFn: () => workflowsApi.getTemplates(),
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      submit_immediately: (preselectedTemplateId ? true : false) as boolean,
      template_id: preselectedTemplateId,
    },
  });

  const selectedTemplateId = watch('template_id');
  const submitImmediately = watch('submit_immediately');
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);
  const step1Role = selectedTemplate ? getStep1Role(selectedTemplate) : null;

  const mutation = useMutation({
    mutationFn: async (data: CreateForm) => {
      if (data.submit_immediately && data.template_id) {
        const template = templates?.find((t) => t.id === data.template_id);
        const result = await orchestratorApi.submitDocument({
          title: data.title,
          content: data.content,
          template_id: data.template_id,
        });
        const workflowId = result.workflow.id;
        if (template) {
          const role = getStep1Role(template);
          if (role) {
            try {
              const assigneeId = await resolveRoleToUserId(role);
              if (assigneeId) {
                await tasksApi.create({ workflow_instance_id: workflowId, step_number: 1, assignee_id: assigneeId });
              }
            } catch (e) { console.warn('[create-doc] Task creation failed:', e); }
          }
        }
        return { docId: result.document.id };
      } else {
        const result = await documentsApi.create({ title: data.title, content: data.content });
        return { docId: result.document.id };
      }
    },
    onSuccess: ({ docId }) => {
      toast.success(submitImmediately ? 'Document created and task assigned to reviewer' : 'Document created successfully');
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.allDocuments] });
      SEEDED_USER_IDS.forEach((uid) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks(uid) }));
      navigate(`/documents/${docId}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const [preview, setPreview] = useState(false);
  const title = watch('title');
  const content = watch('content');

  return (
    <div className="space-y-5 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> Documents
      </Button>

      <PageHeader title="Create Document" description="Add a new document to the system" />

      {/* Preview Dialog */}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg bg-white">
            {/* Letterhead */}
            <div className="bg-white border-b px-8 py-6 text-center">
              <div className="flex items-center justify-center gap-4 mb-3">
                <img src="/logo.png" alt="NHIA Logo" className="h-16 w-16 object-contain" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Federal Republic of Nigeria</p>
                  <h2 className="text-lg font-bold text-green-800 leading-tight">National Health Insurance Authority</h2>
                  <p className="text-xs text-gray-600">Plot 297, Herbert Macaulay Way, Central Business District, Abuja</p>
                </div>
              </div>
              <div className="border-t-4 border-green-700 mt-2 pt-2">
                <p className="text-sm font-bold uppercase tracking-widest text-gray-700">Internal Memorandum</p>
                {title && <p className="text-xs text-gray-500 mt-0.5">{title}</p>}
              </div>
            </div>
            {/* Content */}
            <div
              className="prose prose-sm max-w-none px-8 py-6 text-gray-900"
              dangerouslySetInnerHTML={{ __html: content || '<p class="text-gray-400 italic">No content yet.</p>' }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        {/* Document details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Document Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="Enter document title"
                error={!!errors.title}
                autoFocus
                {...register('title')}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <MemoEditor
                title={title}
                value={content ?? ''}
                onChange={(val) => setValue('content', val)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Workflow options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" /> Workflow Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className={cn(
              'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
              submitImmediately ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
            )}>
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary"
                checked={submitImmediately}
                onChange={(e) => setValue('submit_immediately', e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium text-foreground">Submit for review immediately</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Creates the document, starts a workflow, and assigns a review task automatically
                </p>
              </div>
            </label>

            {submitImmediately && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Workflow Template <span className="text-destructive">*</span></Label>
                  <Select value={selectedTemplateId} onValueChange={(v) => setValue('template_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a workflow template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.steps.length} step{t.steps.length !== 1 ? 's' : ''})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedTemplateId && (
                    <p className="text-xs text-destructive">Please select a workflow template</p>
                  )}
                </div>

                {step1Role && (
                  <Alert variant="info">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      A review task will be assigned to a <strong className="capitalize">{step1Role}</strong> immediately after submission. They will see it in <strong>My Tasks</strong>.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/documents')}>Cancel</Button>
          <Button type="button" variant="outline" onClick={() => setPreview(true)}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={submitImmediately && !selectedTemplateId}>
            {submitImmediately ? 'Create & Submit' : 'Create Document'}
          </Button>
        </div>
      </form>
    </div>
  );
}
