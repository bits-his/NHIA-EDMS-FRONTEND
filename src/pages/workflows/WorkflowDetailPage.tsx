import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, GitBranch, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/shared/Skeleton';
import { WorkflowStepper } from '@/components/workflows/WorkflowStepper';
import { workflowsApi } from '@/api/workflows';
import { tasksApi } from '@/api/tasks';
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS, WORKFLOW_STATUS_CONFIG, SEEDED_USER_IDS } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { canAdvanceWorkflow } from '@/utils/permissions';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: instance, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.workflow(id!),
    queryFn: () => workflowsApi.getById(id!),
    enabled: !!id,
  });

  const { data: templates } = useQuery({
    queryKey: [QUERY_KEYS.workflowTemplates],
    queryFn: () => workflowsApi.getTemplates(),
    enabled: !!instance,
  });

  const template = templates?.find((t) => t.id === instance?.template_id);

  const advanceMutation = useMutation({
    mutationFn: async () => {
      const result = await workflowsApi.advance(id!);
      const advanced = result.workflow;
      if (advanced.status === 'active' && template) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nextStep = template.steps.find((s: any) =>
          s.step_number === advanced.current_step || s.step === advanced.current_step
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any;
        if (nextStep?.assignee_role) {
          try {
            const assigneeId = await resolveRoleToUserId(nextStep.assignee_role);
            if (assigneeId) {
              await tasksApi.create({
                workflow_instance_id: id!,
                step_number: advanced.current_step,
                assignee_id: assigneeId,
              });
            }
          } catch (e) { console.warn('[workflow-advance] Task creation failed:', e); }
        }
      }
      return result;
    },
    onSuccess: (data) => {
      const isComplete = data.workflow.status === 'completed';
      toast.success(isComplete ? 'Workflow completed — all steps done' : `Advanced to step ${data.workflow.current_step}`);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workflow(id!) });
      SEEDED_USER_IDS.forEach((uid) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks(uid) }));
      if (user?.user_id) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks(user.user_id) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  const statusConfig = instance ? WORKFLOW_STATUS_CONFIG[instance.status] : null;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> Workflows
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : instance ? (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">{template?.name ?? 'Workflow Instance'}</h1>
                <div className="flex items-center gap-3 mt-1.5">
                  {statusConfig && (
                    <span className={cn('text-sm font-semibold', statusConfig.color)}>{statusConfig.label}</span>
                  )}
                  <span className="text-xs text-muted-foreground">Updated {formatRelative(instance.updated_at)}</span>
                </div>
              </div>
            </div>

            {canAdvanceWorkflow(user?.roles ?? []) && instance.status === 'active' && (
              <Button onClick={() => advanceMutation.mutate()} loading={advanceMutation.isPending}>
                <ChevronRight className="h-4 w-4" /> Advance to Next Step
              </Button>
            )}
          </div>

          {!canAdvanceWorkflow(user?.roles ?? []) && instance.status === 'active' && (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Only admins and reviewers can advance this workflow. Sign in as alice (admin) or bob (reviewer) to proceed.
              </AlertDescription>
            </Alert>
          )}

          {/* Progress stepper */}
          {template && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <WorkflowStepper steps={template.steps} instance={instance} />
              </CardContent>
            </Card>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground font-medium">Instance Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Instance ID',  value: instance.id.slice(0, 8) + '…',                    mono: true },
                  { label: 'Template',     value: template?.name ?? instance.template_id.slice(0, 8) + '…' },
                  { label: 'Status',       value: instance.status,                                   capitalize: true },
                  { label: 'Current Step', value: `Step ${instance.current_step}` },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">{item.label}</span>
                    <span className={cn('text-xs text-right break-all', item.mono && 'font-mono', item.capitalize && 'capitalize')}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground font-medium">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Created',      value: formatDateTime(instance.created_at) },
                  { label: 'Last Updated', value: formatDateTime(instance.updated_at) },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">{item.label}</span>
                    <span className="text-xs text-right">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate(`/documents/${instance.document_id}`)}>
            <GitBranch className="h-4 w-4" /> View Document
          </Button>
        </>
      ) : null}
    </div>
  );
}

async function resolveRoleToUserId(role: string): Promise<string | null> {
  for (const userId of SEEDED_USER_IDS) {
    try {
      const data = await authApi.getUserRoles(userId);
      if (data.roles.some((r) => r.name === role)) return userId;
    } catch { /* skip */ }
  }
  return null;
}
