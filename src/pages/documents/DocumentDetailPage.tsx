import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, User, FileText, GitBranch, Shield, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { DocumentActions } from '@/components/documents/DocumentActions';
import { VersionHistory } from '@/components/documents/VersionHistory';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { WorkflowStepper } from '@/components/workflows/WorkflowStepper';
import { documentsApi } from '@/api/documents';
import { auditApi } from '@/api/audit';
import { orchestratorApi } from '@/api/orchestrator';
import { workflowsApi } from '@/api/workflows';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: document, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.document(id!),
    queryFn: () => documentsApi.getById(id!),
    enabled: !!id,
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: QUERY_KEYS.documentVersions(id!),
    queryFn: () => documentsApi.getVersions(id!),
    enabled: !!id,
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: QUERY_KEYS.auditLogs({ entity_type: 'document', entity_id: id }),
    queryFn: () => auditApi.getLogs({ entity_type: 'document', entity_id: id }),
    enabled: !!id,
  });

  const { data: orchestratorStatus } = useQuery({
    queryKey: QUERY_KEYS.orchestratorStatus(id!),
    queryFn: () => orchestratorApi.getStatus(id!),
    enabled: !!id,
  });

  const { data: workflowInstance } = useQuery({
    queryKey: QUERY_KEYS.workflow(orchestratorStatus?.workflow?.id ?? ''),
    queryFn: () => workflowsApi.getById(orchestratorStatus!.workflow!.id),
    enabled: !!orchestratorStatus?.workflow?.id,
  });

  const { data: workflowTemplates } = useQuery({
    queryKey: [QUERY_KEYS.workflowTemplates],
    queryFn: () => workflowsApi.getTemplates(),
    enabled: !!workflowInstance,
  });

  const template = workflowTemplates?.find((t) => t.id === workflowInstance?.template_id);

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4" /> Documents
        </Button>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="-ml-1">
        <ArrowLeft className="h-4 w-4" /> Documents
      </Button>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : document ? (
        <>
          {/* Page header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">{document.title}</h1>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <DocumentStatusBadge status={document.status} />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatRelative(document.updated_at)}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="capitalize">{resolveUsername(document.owner_id)}</span>
                  </span>
                </div>
              </div>
            </div>
            <DocumentActions document={document} roles={user?.roles ?? []} />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content"><FileText className="h-3.5 w-3.5" /> Content</TabsTrigger>
              <TabsTrigger value="versions">
                <Hash className="h-3.5 w-3.5" /> Versions {versions ? `(${versions.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value="workflow"><GitBranch className="h-3.5 w-3.5" /> Workflow</TabsTrigger>
              <TabsTrigger value="audit">
                <Shield className="h-3.5 w-3.5" /> Audit {auditLogs ? `(${auditLogs.length})` : ''}
              </TabsTrigger>
            </TabsList>

            {/* Content */}
            <TabsContent value="content">
              <Card>
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    {([
                      { label: 'Document ID', value: document.id.slice(0, 8) + '…', mono: true },
                      { label: 'Owner',       value: resolveUsername(document.owner_id), capitalize: true },
                      { label: 'Created',     value: formatDateTime(document.created_at) },
                      { label: 'Updated',     value: formatDateTime(document.updated_at) },
                    ] as { label: string; value: string; mono?: boolean; capitalize?: boolean }[]).map((item) => (
                      <div key={item.label}>
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        <p className={`text-sm ${item.mono ? 'font-mono' : ''} ${item.capitalize ? 'capitalize' : ''}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <Separator className="mb-5" />
                  {document.content ? (
                    <div
                      className="prose prose-sm max-w-none bg-muted/30 rounded-lg border border-border/50 p-4 text-foreground"
                      dangerouslySetInnerHTML={{ __html: document.content }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-8">No content</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Versions */}
            <TabsContent value="versions">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="h-4 w-4" /> Version History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <VersionHistory versions={versions ?? []} loading={versionsLoading} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Workflow */}
            <TabsContent value="workflow">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4" /> Workflow Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orchestratorStatus?.workflow ? (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Workflow ID</p>
                          <p className="text-sm font-mono text-muted-foreground">{orchestratorStatus.workflow.id.slice(0, 8)}…</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Status</p>
                          <span className={`text-sm font-semibold capitalize ${orchestratorStatus.workflow.status === 'completed' ? 'text-emerald-600' : 'text-blue-600'}`}>
                            {orchestratorStatus.workflow.status}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Current Step</p>
                          <p className="text-sm font-semibold">Step {orchestratorStatus.workflow.current_step}</p>
                        </div>
                      </div>
                      {template && workflowInstance && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-3">Template: <span className="font-medium text-foreground">{template.name}</span></p>
                          <WorkflowStepper steps={template.steps} instance={workflowInstance} />
                        </div>
                      )}
                      <Button variant="outline" size="sm" onClick={() => navigate(`/workflows/${orchestratorStatus.workflow!.id}`)}>
                        <GitBranch className="h-4 w-4" /> Open Workflow
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-10 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                        <GitBranch className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-medium text-foreground">No workflow started</p>
                      <p className="text-xs text-muted-foreground mt-1">Submit the document to start a workflow</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audit */}
            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Audit Trail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AuditTimeline logs={auditLogs ?? []} loading={auditLoading} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
