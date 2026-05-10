import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, GitBranch, Loader2, Save, Send } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { WorkflowGraphEditor, type WorkflowGraphEditorHandle } from '@/components/workflow-designer/WorkflowGraphEditor';
import { workflowsApi } from '@/api/workflows';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import { linearStepsToDefinition } from '@/utils/workflowDefinition';
import type { WorkflowDefinition, WorkflowStep } from '@/types/workflow';
import { toast } from 'sonner';

function normalizeSteps(raw: unknown): WorkflowStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: Record<string, unknown>, idx: number) => ({
    step_number: Number(s.step_number ?? s.step ?? idx + 1),
    name: String(s.name ?? `Step ${idx + 1}`),
    assignee_role: String(s.assignee_role ?? 'reviewer'),
    action_type: String(s.action_type ?? 'approve'),
  }));
}

export default function WorkflowDesignerPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editorRef = useRef<WorkflowGraphEditorHandle>(null);

  const [seedDefinition, setSeedDefinition] = useState<WorkflowDefinition | null>(null);
  const [changelog, setChangelog] = useState('');

  const templatesQuery = useQuery({
    queryKey: [QUERY_KEYS.workflowTemplates],
    queryFn: () => workflowsApi.getTemplates(),
  });

  const versionsQuery = useQuery({
    queryKey: templateId ? QUERY_KEYS.workflowTemplateVersions(templateId) : ['noop'],
    queryFn: () => workflowsApi.listTemplateVersions(templateId!),
    enabled: Boolean(templateId),
  });

  const template = useMemo(
    () => templatesQuery.data?.find((t) => t.id === templateId),
    [templatesQuery.data, templateId]
  );

  useEffect(() => {
    if (!template || seedDefinition) return;
    if (versionsQuery.isLoading) return;

    const versions = versionsQuery.data;
    if (versions?.length) {
      const latest = [...versions].sort((a, b) => b.version_number - a.version_number)[0];
      setSeedDefinition(latest.definition);
      return;
    }

    const steps = normalizeSteps(template.steps);
    setSeedDefinition(linearStepsToDefinition(steps));
  }, [template, versionsQuery.isLoading, versionsQuery.data, seedDefinition]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!templateId) throw new Error('Missing template');
      const def = editorRef.current?.getDefinition();
      if (!def) throw new Error('Designer not ready');
      return workflowsApi.createTemplateVersion(templateId, {
        definition: def,
        changelog: changelog || undefined,
      });
    },
    onSuccess: async () => {
      toast.success('Draft workflow version saved');
      await qc.invalidateQueries({ queryKey: QUERY_KEYS.workflowTemplateVersions(templateId!) });
      setChangelog('');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const publishMutation = useMutation({
    mutationFn: async (versionId: string) => workflowsApi.publishTemplateVersion(versionId),
    onSuccess: async () => {
      toast.success('Workflow definition published');
      await qc.invalidateQueries({ queryKey: [QUERY_KEYS.workflowTemplates] });
      await qc.invalidateQueries({ queryKey: QUERY_KEYS.workflowTemplateVersions(templateId!) });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (!templateId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Workflow designer" description="Missing template id" />
        <Button variant="outline" onClick={() => navigate('/workflows')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  if (templatesQuery.error) {
    return <ErrorState error={templatesQuery.error} onRetry={() => templatesQuery.refetch()} />;
  }

  if (templatesQuery.isLoading || versionsQuery.isLoading || !seedDefinition) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading workflow designer…
      </div>
    );
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <PageHeader title="Workflow designer" description="Template not found" />
        <Button variant="outline" onClick={() => navigate('/workflows')}>
          <ArrowLeft className="h-4 w-4" /> Back to workflows
        </Button>
      </div>
    );
  }

  const sortedVersions = [...(versionsQuery.data ?? [])].sort((a, b) => b.version_number - a.version_number);
  const latestDraft = sortedVersions.find((v) => v.status === 'draft');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title="Enterprise workflow designer"
          description={`Visual routing for “${template.name}”. Draft versions support NHIA-style hierarchies, conditional branches, and archive stages. Linear runtime execution remains backward-compatible until graph execution is enabled server-side.`}
        />
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" type="button" onClick={() => navigate('/workflows')}>
            <ArrowLeft className="h-4 w-4" /> Workflows
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saveDraftMutation.isPending}
            onClick={() => saveDraftMutation.mutate()}
          >
            {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft version
          </Button>
          {latestDraft ? (
            <Button
              type="button"
              disabled={publishMutation.isPending}
              onClick={() => publishMutation.mutate(latestDraft.id)}
            >
              {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish latest draft
            </Button>
          ) : null}
        </div>
      </div>

      <Alert variant="info">
        <GitBranch className="h-4 w-4" />
        <AlertDescription>
          Drag nodes, connect edges, and optionally label edges with condition expressions (e.g.{' '}
          <code className="text-xs bg-muted px-1 rounded">document.amount &gt; 10000000</code>). Published definitions are
          stored immutably per version; the document module continues to use linear steps for execution unless the backend
          graph engine is enabled for that template.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version notes (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-w-lg">
          <Label htmlFor="changelog">Changelog</Label>
          <Input
            id="changelog"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="e.g. Added Finance gate for high-value memos"
          />
        </CardContent>
      </Card>

      <WorkflowGraphEditor ref={editorRef} key={templateId} defaultDefinition={seedDefinition} />

      {sortedVersions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent versions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sortedVersions.slice(0, 6).map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-border/60 rounded-lg px-3 py-2"
              >
                <span className="font-mono text-xs text-muted-foreground">{v.id.slice(0, 8)}…</span>
                <span>
                  v{v.version_number} ·{' '}
                  <span className="capitalize">{v.status}</span>
                </span>
                <span className="text-muted-foreground text-xs">{new Date(v.created_at).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
