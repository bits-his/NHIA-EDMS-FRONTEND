import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckSquare,
  Clock,
  AlertCircle,
  FileText,
  ExternalLink,
  GitBranch,
  Hash,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/shared/Skeleton';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { tasksApi } from '@/api/tasks';
import { documentsApi } from '@/api/documents';
import { workflowApi } from '@/api/workflow';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import { getPendingDocumentWorkflowStageLabel } from '@/utils/workflowStageLabel';
import { formatDateTime, formatRelative, isTaskOverdue } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { cn } from '@/utils/cn';
import { documentTypeHeadline, shouldShowTemplateTitleAsSubtitle } from '@/utils/documentDisplay';

function workflowStepLabel(
  stepNumber: number,
  steps: Array<{ step_number?: number; step?: number; name: string }> | undefined
): string | null {
  if (!steps?.length) return null;
  const def = steps.find((s) => (s.step_number ?? s.step) === stepNumber);
  return def?.name ?? null;
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: task, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.task(id!),
    queryFn: () => tasksApi.getById(id!),
    enabled: !!id,
    refetchOnWindowFocus: true,
  });

  const { data: document, error: documentError } = useQuery({
    queryKey: QUERY_KEYS.document(task?.document_id ?? ''),
    queryFn: () => documentsApi.getById(task!.document_id!),
    enabled: !!task?.document_id,
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });

  const documentId = document?.id;
  const { data: wfInstance } = useQuery({
    queryKey: QUERY_KEYS.workflowInstanceByDocument(documentId ?? ''),
    queryFn: () => workflowApi.getInstanceByDocumentId(documentId!),
    enabled: !!documentId,
  });

  const { data: wfTemplate } = useQuery({
    queryKey: QUERY_KEYS.workflowTemplate(wfInstance?.template_id ?? ''),
    queryFn: () => workflowApi.getTemplateById(wfInstance!.template_id),
    enabled: !!wfInstance?.template_id,
  });

  const stepTitle = useMemo(
    () => workflowStepLabel(task?.step_number ?? 0, wfTemplate?.steps),
    [task?.step_number, wfTemplate?.steps]
  );

  const pendingStageLabel = useMemo(
    () =>
      document?.status === 'pending'
        ? getPendingDocumentWorkflowStageLabel(wfInstance ?? undefined, wfTemplate ?? undefined)
        : null,
    [document?.status, wfInstance, wfTemplate]
  );

  const openDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!id || !task || !documentId) return;
      if (task.status === 'pending') {
        await tasksApi.update(id, { status: 'in_progress' });
      }
    },
    onSuccess: async () => {
      if (id) await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.task(id) });
      if (task?.assignee_id) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks(task.assignee_id) });
      }
      if (documentId) navigate(`/documents/${documentId}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  const overdue = task
    ? isTaskOverdue(task)
    : false;
  const taskOpen = task?.status === 'pending' || task?.status === 'in_progress';
  const isTerminal = task && (task.status === 'completed' || task.status === 'cancelled');

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> My Tasks
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : task ? (
        <>
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                overdue ? 'bg-red-50 dark:bg-red-900/20' : 'bg-primary/10'
              )}
            >
              {overdue ? (
                <AlertCircle className="h-6 w-6 text-red-500" />
              ) : (
                <CheckSquare className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {stepTitle ? `${stepTitle}` : `Step ${task.step_number}`}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Workflow review task</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <TaskStatusBadge status={task.status} />
                {overdue && (
                  <Badge variant="destructive" className="text-xs font-normal">
                    Overdue
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {wfInstance && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4" /> Workflow
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Template</p>
                    <p className="font-medium">{wfTemplate?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Instance status</p>
                    <p className="font-medium capitalize">{String(wfInstance.status).replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Current workflow step</p>
                    <p className="font-medium">
                      Step {wfInstance.current_step ?? '—'}
                      {stepTitle ? ` · ${stepTitle}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Your task step</p>
                    <p className="font-medium">Step {task.step_number}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card
            className={cn(
              'border-2',
              document?.status === 'pending'
                ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/20 dark:bg-amber-900/5'
                : 'border-border'
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Linked document
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!task.document_id ? (
                <p className="text-sm text-muted-foreground py-2">No document is linked to this task.</p>
              ) : documentError ? (
                <p className="text-sm text-destructive py-2">
                  Could not load the document ({getErrorMessage(documentError)}).
                </p>
              ) : !document ? (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-4">
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
                  Loading document…
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-lg font-semibold text-foreground leading-snug">
                        {documentTypeHeadline(document)}
                      </p>
                      {shouldShowTemplateTitleAsSubtitle(document) && (
                        <p className="text-sm text-muted-foreground truncate" title={document.title}>
                          {document.title}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="capitalize">Owner: {resolveUsername(document.owner_id)}</span>
                        </span>
                        {document.ref_number && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Hash className="h-3 w-3" />
                            {document.ref_number}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Updated {formatRelative(document.updated_at)}
                        </span>
                      </div>
                    </div>
                    <DocumentStatusBadge
                      status={document.status}
                      pendingStageLabel={pendingStageLabel}
                      statusLabel={document.status_label}
                    />
                  </div>

                  {document.content && (
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground bg-muted/40 rounded-lg p-4 leading-relaxed line-clamp-4 border border-border/60"
                      dangerouslySetInnerHTML={{ __html: document.content }}
                    />
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Button
                      className="w-full sm:w-auto"
                      size="lg"
                      onClick={() => openDocumentMutation.mutate()}
                      loading={openDocumentMutation.isPending}
                      disabled={!documentId}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {taskOpen ? 'Open document to review' : 'View document'}
                    </Button>
                    {taskOpen && task.status === 'pending' && (
                      <p className="text-xs text-muted-foreground">
                        Opens the document and sets this task to <strong>In progress</strong> automatically.
                      </p>
                    )}
                    {document.status === 'pending' && taskOpen && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        When you approve, forward, or advance the workflow on the document page, this task is
                        marked <strong>completed</strong> automatically once the workflow leaves your step.
                      </p>
                    )}
                    {taskOpen &&
                      wfInstance != null &&
                      typeof wfInstance.current_step === 'number' &&
                      wfInstance.current_step !== task.step_number && (
                        <p className="text-xs text-muted-foreground">
                          The workflow is past your step. If this task still looks open, refresh the page or return
                          to My Tasks.
                        </p>
                      )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Task metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {[
                  { label: 'Task ID', value: task.id.slice(0, 8) + '…', mono: true },
                  { label: 'Workflow instance', value: task.workflow_instance_id.slice(0, 8) + '…', mono: true },
                  { label: 'Step number', value: String(task.step_number) },
                  { label: 'Assignee', value: resolveUsername(task.assignee_id), capitalize: true },
                  { label: 'Created', value: formatDateTime(task.created_at) },
                  { label: 'Last updated', value: formatDateTime(task.updated_at) },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p
                      className={cn(
                        'text-sm',
                        item.mono && 'font-mono text-xs',
                        (item as { capitalize?: boolean }).capitalize && 'capitalize'
                      )}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Due date</p>
                  {task.due_date ? (
                    <div className={cn('flex items-center gap-1 text-sm', overdue && 'text-red-600 font-medium')}>
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {formatRelative(task.due_date)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No due date</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {isTerminal && (
            <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm text-muted-foreground">
              This task is <strong className="text-foreground capitalize">{task.status}</strong>. You can still open
              the linked document above if you have access.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
