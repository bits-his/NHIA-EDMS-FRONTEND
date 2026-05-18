import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckSquare, FileText, GitBranch, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { executiveApi } from '@/api/executive';
import { QUERY_KEYS } from '@/utils/constants';
import { formatRelative, isOverdue } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import type {
  ExecutiveReportDocumentItem,
  ExecutiveReportKind,
  ExecutiveReportTaskItem,
  ExecutiveReportWorkflowItem,
} from '@/types/executive';
import type { DocumentStatus } from '@/types/document';
import type { TaskStatus } from '@/types/task';

function useReportQueryParams(): Record<string, string> {
  const [searchParams] = useSearchParams();
  return useMemo(() => {
    const p: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      p[key] = value;
    });
    if (!p.kind) p.kind = 'documents';
    return p;
  }, [searchParams]);
}

type ExecutiveReportPageProps = {
  backHref?: string;
  backLabel?: string;
};

export default function ExecutiveReportPage({
  backHref = '/dashboard',
  backLabel = 'Back to dashboard',
}: ExecutiveReportPageProps = {}) {
  const navigate = useNavigate();
  const params = useReportQueryParams();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.executiveReport(params),
    queryFn: () => executiveApi.getReport(params),
    staleTime: 20_000,
  });

  const kind = (data?.kind ?? params.kind ?? 'documents') as ExecutiveReportKind;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => navigate(backHref)}
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Button>

      <PageHeader
        title={data?.title ?? 'Executive report'}
        description={
          [
            data?.subtitle,
            data?.scope?.label ? `Scope: ${data.scope.label}` : null,
            data != null ? `${data.total} record${data.total !== 1 ? 's' : ''}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Loading report…'
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !data?.items?.length ? (
        <EmptyState
          icon={kind === 'tasks' ? CheckSquare : kind === 'workflows' ? GitBranch : FileText}
          title="No records in this category"
          description="Nothing matches your current scope and filters."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {kind === 'documents' && (
              <DocumentReportList items={data.items as ExecutiveReportDocumentItem[]} />
            )}
            {kind === 'tasks' && (
              <TaskReportList items={data.items as ExecutiveReportTaskItem[]} />
            )}
            {kind === 'workflows' && (
              <WorkflowReportList items={data.items as ExecutiveReportWorkflowItem[]} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocumentReportList({ items }: { items: ExecutiveReportDocumentItem[] }) {
  const navigate = useNavigate();
  return (
    <ul className="divide-y divide-border">
      {items.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            onClick={() => navigate(`/documents/${doc.id}`)}
            className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-muted/50 transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate group-hover:text-primary">{doc.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {doc.ref_number && <span className="font-mono mr-2">{doc.ref_number}</span>}
                {resolveUsername(doc.owner_id)}
                {doc.department ? ` · ${doc.department}` : ''}
                {' · '}
                {formatRelative(doc.updated_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <DocumentStatusBadge status={doc.status as DocumentStatus} size="sm" />
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60" />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TaskReportList({ items }: { items: ExecutiveReportTaskItem[] }) {
  const navigate = useNavigate();
  return (
    <ul className="divide-y divide-border">
      {items.map((task) => {
        const overdue = isOverdue(task.due_date ?? undefined);
        return (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-muted/50 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate group-hover:text-primary">
                  Step {task.step_number}
                  {task.document_title ? ` — ${task.document_title}` : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assignee: {resolveUsername(task.assignee_id)}
                  {task.due_date && (
                    <span className={overdue ? ' text-red-600 dark:text-red-400 font-medium' : ''}>
                      {' '}
                      · due {formatRelative(task.due_date)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <TaskStatusBadge status={task.status as TaskStatus} />
                {task.document_id && (
                  <Link
                    to={`/documents/${task.document_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-primary hover:underline"
                  >
                    Doc
                  </Link>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function WorkflowReportList({ items }: { items: ExecutiveReportWorkflowItem[] }) {
  const navigate = useNavigate();
  return (
    <ul className="divide-y divide-border">
      {items.map((wi) => (
        <li key={wi.id}>
          <button
            type="button"
            onClick={() => wi.document_id && navigate(`/documents/${wi.document_id}`)}
            className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-muted/50 transition-colors group disabled:opacity-60"
            disabled={!wi.document_id}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate group-hover:text-primary">
                {wi.document_title ?? 'Workflow instance'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Step {wi.current_step} · updated {formatRelative(wi.updated_at)}
                {wi.document_ref && (
                  <span className="font-mono ml-2">{wi.document_ref}</span>
                )}
              </p>
            </div>
            {wi.document_status && (
              <DocumentStatusBadge status={wi.document_status as DocumentStatus} size="sm" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
