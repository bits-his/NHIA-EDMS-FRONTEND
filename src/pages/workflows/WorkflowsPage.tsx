import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Layers,
  ArrowRight,
  Info,
  Plus,
  Users,
  PenTool,
  Search,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { CardSkeleton } from '@/components/shared/Skeleton';
import { WorkflowStepper } from '@/components/workflows/WorkflowStepper';
import { workflowsApi } from '@/api/workflows';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';

type ViewMode = 'grid' | 'list';

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.roles.includes('admin')) ?? false;
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('grid');

  const { data: templates, isLoading, error, refetch } = useQuery({
    queryKey: [QUERY_KEYS.workflowTemplates],
    queryFn: () => workflowsApi.getTemplates(),
  });

  const filtered = useMemo(() => {
    if (!templates?.length) return [];
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const id = (t.id || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [templates, query]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workflow Templates"
        description="Approval process templates — select one when submitting a document"
      />

      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> You don't create a workflow directly. When submitting a document, pick a
          template and a workflow instance starts automatically. Each step assigns a task to the relevant role.
        </AlertDescription>
      </Alert>

      {!error && !isLoading && templates?.length ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search by name or template ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label="Search workflow templates"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 shrink-0">
            <Button
              type="button"
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setView('grid')}
              aria-pressed={view === 'grid'}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              type="button"
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : !templates?.length ? (
        <EmptyState icon={GitBranch} title="No workflow templates" description="No workflow templates have been configured yet" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching templates"
          description={query.trim() ? `Nothing matches “${query.trim()}”. Try another search.` : 'No templates to show.'}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((template) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const steps = template.steps
              .map((s: any) => ({ ...s, step_number: s.step_number ?? s.step }))
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

                  <div className="space-y-1.5">
                    {steps.map(
                      (step: {
                        step_number: number;
                        name: string;
                        assignee_role: string;
                        action_type?: string;
                      }) => (
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
                      )
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
                    <p className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[min(100%,240px)]">
                      {template.id}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {isAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/template-management/workflow-designer/${template.id}`)}
                        >
                          <PenTool className="h-3.5 w-3.5" /> Design
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="soft-primary"
                        onClick={() => navigate(`/documents/new?template_id=${template.id}`)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Use template
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_1fr] gap-3 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40 border-b border-border">
            <span>Template</span>
            <span className="text-center">Steps</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((template) => (
              <li key={template.id}>
                <div className="flex flex-col gap-3 px-4 py-4 sm:grid sm:grid-cols-[1fr_100px_120px_1fr] sm:items-center sm:gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <GitBranch className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-snug truncate">{template.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground/70 truncate mt-0.5">{template.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-center gap-2">
                    <span className="sm:hidden text-xs text-muted-foreground">Steps</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/8 text-primary px-2 py-0.5 rounded-full">
                      <Layers className="h-3 w-3" />
                      {template.steps.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="sm:hidden text-xs text-muted-foreground">Created</span>
                    <span className="text-xs text-muted-foreground">{formatDate(template.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {isAdmin ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/template-management/workflow-designer/${template.id}`)}
                      >
                        <PenTool className="h-3.5 w-3.5" /> Design
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="soft-primary"
                      onClick={() => navigate(`/documents/new?template_id=${template.id}`)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Use
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
