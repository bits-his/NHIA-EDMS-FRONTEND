import { useQuery } from '@tanstack/react-query';
import { GitBranch, Clock, AlertTriangle } from 'lucide-react';
import { workflowApi } from '@/api/workflow';
import { QUERY_KEYS } from '@/utils/constants';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/shared/Skeleton';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { workflowAssigneeRoleLabel } from '@/utils/workflowEditor';
import type { DocumentStatus } from '@/types/document';
import { WorkflowFlowchartView } from '@/components/workflows/WorkflowFlowchartView';

interface WorkflowBpmnPanelProps {
  documentId: string;
  documentStatus: DocumentStatus;
}

export function WorkflowBpmnPanel({ documentId, documentStatus }: WorkflowBpmnPanelProps) {
  const {
    data: instance,
    isLoading: instLoading,
    isError: instError,
  } = useQuery({
    queryKey: QUERY_KEYS.workflowInstanceByDocument(documentId),
    queryFn: () => workflowApi.getInstanceByDocumentId(documentId),
    retry: false,
  });

  const wfId = instance?.id ?? undefined;

  const { data: view, isLoading: viewLoading } = useQuery({
    queryKey: QUERY_KEYS.workflowBpmnView(wfId ?? '', documentStatus),
    queryFn: () => workflowApi.getBpmnView(wfId!, { document_status: documentStatus }),
    enabled: !!wfId,
  });

  const { data: steps, isLoading: stepsLoading } = useQuery({
    queryKey: QUERY_KEYS.workflowSteps(wfId ?? ''),
    queryFn: () => workflowApi.listSteps(wfId!),
    enabled: !!wfId,
  });

  if (instLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!instError && instance === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 px-4 py-8 text-center text-sm text-muted-foreground">
        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No workflow instance is linked to this document yet. Submit the memo for review (when it is in draft) to
        start the workflow assigned on its template, if any.
      </div>
    );
  }

  if (instError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/80 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
        Could not load workflow information.
      </div>
    );
  }

  if (!instance || !view) {
    return viewLoading ? (
      <Skeleton className="h-40 w-full" />
    ) : (
      <p className="text-sm text-muted-foreground">Workflow visualization unavailable.</p>
    );
  }

  const summary = view.instance_summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {summary.standardized_state && (
          <Badge variant="secondary" className="font-normal bg-slate-100 dark:bg-slate-800">
            {summary.standardized_state}
          </Badge>
        )}
        {summary.current_step != null && (
          <Badge variant="outline" className="font-mono text-[11px] font-normal">
            Step {summary.current_step}
            {summary.max_step != null ? ` / ${summary.max_step}` : ''}
          </Badge>
        )}
        {typeof summary.revision_count === 'number' && summary.revision_count > 0 && (
          <Badge variant="outline" className="gap-1 text-amber-800 dark:text-amber-200 border-amber-200">
            <AlertTriangle className="h-3 w-3" />
            Revisions: {summary.revision_count}
          </Badge>
        )}
        <span className="text-[11px] text-muted-foreground capitalize">engine {view.engine_mode ?? 'linear'}</span>
      </div>

      <WorkflowFlowchartView view={view} />

      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 opacity-70" />
          Step timeline & SLA
        </p>
        {stepsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : steps && steps.length > 0 ? (
          <ul className="space-y-2">
            {steps.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Step {s.step_number ?? '—'}
                  </span>
                  <span className="text-muted-foreground capitalize ml-2">{s.status}</span>
                  {s.assignee_role && (
                    <span className="text-muted-foreground ml-2">{workflowAssigneeRoleLabel(s.assignee_role)}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {s.sla_due_at && (
                    <Badge variant="outline" className="font-normal gap-1">
                      SLA {formatRelative(s.sla_due_at)}
                      <span className="opacity-70">({formatDateTime(s.sla_due_at)})</span>
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No step rows recorded.</p>
        )}
      </div>
    </div>
  );
}
