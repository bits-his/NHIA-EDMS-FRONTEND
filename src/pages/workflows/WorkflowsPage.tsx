import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Layers, ArrowRight, Info, Plus, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { CardSkeleton } from '@/components/shared/Skeleton';
import { WorkflowStepper } from '@/components/workflows/WorkflowStepper';
import { WorkflowChainVisual } from '@/components/template-builder/WorkflowChainVisual';
import { workflowsApi } from '@/api/workflows';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const { data: templates, isLoading, error, refetch } = useQuery({
    queryKey: [QUERY_KEYS.workflowTemplates],
    queryFn: () => workflowsApi.getTemplates(),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workflow Templates"
        description="Approval process templates — select one when submitting a document"
      />

      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> You don't create a workflow directly. When submitting a document, pick a template and a workflow instance starts automatically. Each step assigns a task to the relevant role.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow template configuration</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Reusable approval chains and routing concepts — these patterns integrate with the workflow engine when
            templates are defined or extended.
          </p>
        </CardHeader>
        <CardContent>
          <WorkflowChainVisual />
        </CardContent>
      </Card>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : !templates?.length ? (
        <EmptyState icon={GitBranch} title="No workflow templates" description="No workflow templates have been configured yet" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates.map((template) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const steps = template.steps.map((s: any) => ({ ...s, step_number: s.step_number ?? s.step }))
              .sort((a: { step_number: number }, b: { step_number: number }) => a.step_number - b.step_number);

            return (
              <Card key={template.id} className="hover:shadow-card-md transition-all duration-200 hover:-translate-y-0.5">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <GitBranch className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Created {formatDate(template.created_at)}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/8 text-primary px-2.5 py-1 rounded-full shrink-0">
                      <Layers className="h-3 w-3" />
                      {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <WorkflowStepper steps={template.steps} />

                  {/* Step breakdown */}
                  <div className="space-y-1.5">
                    {steps.map((step: { step_number: number; name: string; assignee_role: string; action_type?: string }) => (
                      <div
                        key={step.step_number}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40 border border-border/50"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                            {step.step_number}
                          </span>
                          <span className="text-sm font-medium">{step.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span className="capitalize">{step.assignee_role}</span>
                          {step.action_type && (
                            <>
                              <ArrowRight className="h-3 w-3" />
                              <span className="capitalize">{step.action_type}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <p className="text-[10px] font-mono text-muted-foreground/60">{template.id}</p>
                    <Button
                      size="sm"
                      variant="soft-primary"
                      onClick={() => navigate(`/documents/new?template_id=${template.id}`)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Use template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
