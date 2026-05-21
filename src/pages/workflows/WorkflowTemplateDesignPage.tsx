import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye, GitBranch, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/shared/Skeleton';
import { WorkflowFlowchartView } from '@/components/workflows/WorkflowFlowchartView';
import { WorkflowEditorDialog } from '@/components/workflows/WorkflowEditorDialog';
import { workflowApi } from '@/api/workflow';
import { QUERY_KEYS } from '@/utils/constants';
import { isUuid } from '@/utils/uuid';
import { useAuthStore } from '@/stores/authStore';
import { canCreateWorkflowTemplate } from '@/utils/permissions';

export default function WorkflowTemplateDesignPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.user?.roles) ?? [];
  const permissions = useAuthStore((s) => s.user?.permissions) ?? [];
  const canEditWorkflow = canCreateWorkflowTemplate(roles, permissions);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const valid = !!templateId && isUuid(templateId);

  const {
    data: template,
    isLoading: tplLoading,
    error: tplError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.workflowTemplate(templateId ?? ''),
    queryFn: () => workflowApi.getTemplateById(templateId!),
    enabled: valid,
  });

  const {
    data: view,
    isLoading: viewLoading,
    error: viewError,
    refetch: refetchView,
  } = useQuery({
    queryKey: QUERY_KEYS.workflowTemplateBpmnPreview(templateId ?? ''),
    queryFn: () => workflowApi.getTemplateBpmnPreview(templateId!),
    enabled: valid,
  });

  if (!valid) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')} className="-ml-1">
          <ArrowLeft className="h-4 w-4" /> Workflows
        </Button>
        <ErrorState error={new Error('Invalid workflow template id')} />
      </div>
    );
  }

  const loading = tplLoading || viewLoading;
  const error = tplError || viewError;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/workflows')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> Workflows
      </Button>

      <PageHeader
        title="Workflow flow chart"
        description="Read-only visualization of the linear approval path for this template."
      />

      <WorkflowEditorDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        templateId={templateId}
        onSaved={() => {
          refetch();
          refetchView();
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1 font-normal">
          <Eye className="h-3 w-3" />
          View only
        </Badge>
        {template?.name && (
          <Badge variant="outline" className="font-normal max-w-[min(100%,320px)] truncate">
            <GitBranch className="h-3 w-3 mr-1 shrink-0" />
            {template.name}
          </Badge>
        )}
        {view?.engine_mode && (
          <span className="text-[11px] text-muted-foreground capitalize">engine {view.engine_mode}</span>
        )}
        {canEditWorkflow ? (
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setEditDialogOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit workflow
          </Button>
        ) : null}
      </div>

      <Alert>
        <AlertDescription className="text-sm">
          This diagram shows the <strong>definition</strong> of the workflow (tasks, decision gateway, and finalize
          node). It does not reflect live assignments or document status.
        </AlertDescription>
      </Alert>

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            refetch();
            refetchView();
          }}
        />
      ) : loading || !view ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <WorkflowFlowchartView view={view} showRevisionLoopNote />
      )}
    </div>
  );
}
