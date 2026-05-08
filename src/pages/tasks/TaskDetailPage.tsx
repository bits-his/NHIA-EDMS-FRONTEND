import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, CheckSquare, Play, X, Check, Clock,
  AlertCircle, FileText, GitBranch, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/shared/Skeleton';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { tasksApi } from '@/api/tasks';
import { workflowsApi } from '@/api/workflows';
import { documentsApi } from '@/api/documents';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDateTime, formatRelative, isOverdue } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { cn } from '@/utils/cn';
import type { TaskStatus } from '@/types/task';

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending:     ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: task, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.task(id!),
    queryFn: () => tasksApi.getById(id!),
    enabled: !!id,
  });

  const { data: workflowInstance } = useQuery({
    queryKey: QUERY_KEYS.workflow(task?.workflow_instance_id ?? ''),
    queryFn: () => workflowsApi.getById(task!.workflow_instance_id),
    enabled: !!task?.workflow_instance_id,
  });

  const { data: document } = useQuery({
    queryKey: QUERY_KEYS.document(workflowInstance?.document_id ?? ''),
    queryFn: () => documentsApi.getById(workflowInstance!.document_id),
    enabled: !!workflowInstance?.document_id,
  });

  const updateMutation = useMutation({
    mutationFn: (status: TaskStatus) => {
      if (status === 'completed') return tasksApi.complete(id!);
      return tasksApi.update(id!, { status });
    },
    onSuccess: (updated) => {
      toast.success(`Task marked as ${updated.status.replace('_', ' ')}`);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.task(id!) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks(updated.assignee_id) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
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
    ? isOverdue(task.due_date) && task.status !== 'completed' && task.status !== 'cancelled'
    : false;
  const availableTransitions = task ? TRANSITIONS[task.status] : [];

  return (
    <div className="space-y-5 max-w-2xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> My Tasks
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : task ? (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl',
                overdue ? 'bg-red-50 dark:bg-red-900/20' : 'bg-primary/10'
              )}>
                {overdue
                  ? <AlertCircle className="h-5 w-5 text-red-500" />
                  : <CheckSquare className="h-5 w-5 text-primary" />
                }
              </div>
              <div>
                <h1 className="text-xl font-bold">Step {task.step_number} — Review Task</h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <TaskStatusBadge status={task.status} />
                  {overdue && <span className="text-xs font-medium text-red-500">Overdue</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {availableTransitions.includes('in_progress') && (
                <Button size="sm" variant="outline" onClick={() => updateMutation.mutate('in_progress')} loading={updateMutation.isPending}>
                  <Play className="h-4 w-4" /> Start
                </Button>
              )}
              {availableTransitions.includes('completed') && (
                <Button size="sm" variant="success" onClick={() => updateMutation.mutate('completed')} loading={updateMutation.isPending}>
                  <Check className="h-4 w-4" /> Complete
                </Button>
              )}
              {availableTransitions.includes('cancelled') && (
                <Button size="sm" variant="destructive" onClick={() => updateMutation.mutate('cancelled')} loading={updateMutation.isPending}>
                  <X className="h-4 w-4" /> Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Document context */}
          <Card className={cn(
            'border-2',
            document?.status === 'pending'
              ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-900/5'
              : 'border-border'
          )}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Document to Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!workflowInstance || !document ? (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-2">
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
                  Resolving document…
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{document.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        Owner: {resolveUsername(document.owner_id)}
                      </p>
                    </div>
                    <DocumentStatusBadge status={document.status} />
                  </div>
                  {document.content && (
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: document.content }}
                    />
                  )}
                  <Button className="w-full" onClick={() => navigate(`/documents/${document.id}`)}>
                    <ExternalLink className="h-4 w-4" /> Open Document to Review
                  </Button>
                  {document.status === 'pending' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                      Awaiting your review — approve or reject from the document page
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {[
                  { label: 'Task ID',    value: task.id.slice(0, 8) + '…',        mono: true },
                  { label: 'Step',       value: String(task.step_number) },
                  { label: 'Assignee',   value: resolveUsername(task.assignee_id), capitalize: true },
                  { label: 'Created',    value: formatDateTime(task.created_at) },
                  { label: 'Updated',    value: formatDateTime(task.updated_at) },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className={cn('text-sm', item.mono && 'font-mono', (item as { capitalize?: boolean }).capitalize && 'capitalize')}>{item.value}</p>
                  </div>
                ))}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                  {task.due_date ? (
                    <div className={cn('flex items-center gap-1 text-sm', overdue && 'text-red-500')}>
                      <Clock className="h-3.5 w-3.5" /> {formatRelative(task.due_date)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No due date</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Workflow</p>
                  <button
                    className="text-sm font-mono text-primary hover:underline flex items-center gap-1"
                    onClick={() => navigate(`/workflows/${task.workflow_instance_id}`)}
                  >
                    <GitBranch className="h-3.5 w-3.5" /> {task.workflow_instance_id.slice(0, 8)}…
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {availableTransitions.length === 0 && (
            <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm text-muted-foreground text-center">
              This task is in a terminal state (<strong>{task.status}</strong>) and cannot be transitioned further.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
