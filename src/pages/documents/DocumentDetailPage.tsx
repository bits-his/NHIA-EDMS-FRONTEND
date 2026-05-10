import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  User,
  FileText,
  Shield,
  Hash,
  Eye,
  Users,
  Paperclip,
  Building2,
  Tag,
  Zap,
  Upload,
  Download,
  GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { DocumentActions } from '@/components/documents/DocumentActions';
import { DocumentActivitySidebar } from '@/components/documents/DocumentActivitySidebar';
import { WorkflowBpmnPanel } from '@/components/documents/WorkflowBpmnPanel';
import { VersionHistory } from '@/components/documents/VersionHistory';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { documentsApi } from '@/api/documents';
import { auditApi } from '@/api/audit';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { getErrorMessage } from '@/api/client';
import { isUuid } from '@/utils/uuid';
import type { RecipientType } from '@/types/document';

const CATEGORY_LABEL: Record<string, string> = {
  internal_memo: 'Internal memo',
  external_correspondence: 'External correspondence',
};

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipientOpen, setRecipientOpen] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('to');

  const documentIdValid = !!id && isUuid(id);

  const { data: doc, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.document(id!),
    queryFn: () => documentsApi.getById(id!),
    enabled: documentIdValid,
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: QUERY_KEYS.documentVersions(id!),
    queryFn: () => documentsApi.getVersions(id!),
    enabled: documentIdValid,
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: QUERY_KEYS.auditLogs({ entity_type: 'document', entity_id: id }),
    queryFn: () => auditApi.getLogs({ entity_type: 'document', entity_id: id }),
    enabled: documentIdValid,
  });

  const { data: recipients } = useQuery({
    queryKey: QUERY_KEYS.documentRecipients(id!),
    queryFn: () => documentsApi.listRecipients(id!),
    enabled: documentIdValid,
  });

  const { data: attachments } = useQuery({
    queryKey: QUERY_KEYS.documentAttachments(id!),
    queryFn: () => documentsApi.listAttachments(id!),
    enabled: documentIdValid,
  });

  const { data: workflowActions, isLoading: workflowActionsLoading } = useQuery({
    queryKey: QUERY_KEYS.documentWorkflowActions(id!),
    queryFn: () => documentsApi.listWorkflowActions(id!),
    enabled: documentIdValid,
  });

  const { data: users } = useQuery({
    queryKey: ['auth-users'],
    queryFn: () => authApi.listUsers(),
    enabled: recipientOpen,
  });

  const previewMutation = useMutation({
    mutationFn: () => documentsApi.getPreviewHtml(id!),
    onSuccess: (html) => {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addRecipientMutation = useMutation({
    mutationFn: () =>
      documentsApi.addRecipient(id!, { user_id: recipientUserId, recipient_type: recipientType }),
    onSuccess: () => {
      toast.success('Recipient added');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentRecipients(id!) });
      setRecipientOpen(false);
      setRecipientUserId('');
      setRecipientType('to');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.uploadAttachment(id!, file),
    onSuccess: () => {
      toast.success('Attachment uploaded');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documentAttachments(id!) });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const downloadAttachment = async (attachmentId: string, filename: string) => {
    try {
      const blob = await documentsApi.downloadAttachmentBlob(id!, attachmentId);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (!documentIdValid) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4" /> Documents
        </Button>
        <ErrorState
          title="Invalid document link"
          error={
            new Error(
              'This URL is not a valid document id. Open Documents from the sidebar and pick an item from the list.'
            )
          }
        />
      </div>
    );
  }

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
      ) : doc ? (
        <>
          <div className="lg:grid lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px] lg:gap-6 lg:items-start space-y-6 lg:space-y-0">
            <div className="min-w-0 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                  {doc.title}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <DocumentStatusBadge status={doc.status} />
                  {doc.category && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      <Tag className="h-3 w-3 mr-1" />
                      {CATEGORY_LABEL[doc.category] ?? doc.category}
                    </Badge>
                  )}
                  {doc.ref_number && (
                    <Badge variant="outline" className="text-xs font-mono font-normal">
                      {doc.ref_number}
                    </Badge>
                  )}
                  {doc.urgency && doc.urgency !== 'normal' && (
                    <Badge variant="outline" className="text-xs capitalize">
                      <Zap className="h-3 w-3 mr-1" />
                      {doc.urgency.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatRelative(doc.updated_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="capitalize">{resolveUsername(doc.owner_id)}</span>
                  </span>
                  {doc.department && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {doc.department}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {doc.category === 'internal_memo' && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                >
                  <Eye className="h-4 w-4" /> Official preview (letterhead)
                </Button>
              )}
              <DocumentActions document={doc} roles={user?.roles ?? []} />
            </div>
          </div>

          {/* Routing: recipients & attachments */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Recipients
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setRecipientOpen(true)}>
                  Add recipient
                </Button>
              </CardHeader>
              <CardContent>
                {!recipients?.length ? (
                  <p className="text-sm text-muted-foreground">No recipients tagged.</p>
                ) : (
                  <ul className="space-y-2">
                    {recipients.map((r) => (
                      <li
                        key={r.id}
                        className="flex justify-between text-sm border border-border/60 rounded-lg px-3 py-2"
                      >
                        <span className="font-medium capitalize">{resolveUsername(r.user_id)}</span>
                        <span className="text-muted-foreground uppercase text-xs">{r.recipient_type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Supporting attachments
                </CardTitle>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadMutation.mutate(f);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    loading={uploadMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Upload
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!attachments?.length ? (
                  <p className="text-sm text-muted-foreground">No attachments.</p>
                ) : (
                  <ul className="space-y-2">
                    {attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 text-sm border border-border/60 rounded-lg px-3 py-2"
                      >
                        <span className="truncate">{a.filename}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => downloadAttachment(a.id, a.filename)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">
                <FileText className="h-3.5 w-3.5" /> Content
              </TabsTrigger>
              <TabsTrigger value="versions">
                <Hash className="h-3.5 w-3.5" /> Versions {versions ? `(${versions.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value="audit">
                <Shield className="h-3.5 w-3.5" /> Audit {auditLogs ? `(${auditLogs.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value="workflow">
                <GitBranch className="h-3.5 w-3.5" /> Workflow
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              <Card>
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    {(
                      [
                        { label: 'Document ID', value: doc.id.slice(0, 8) + '…', mono: true },
                        {
                          label: 'Owner',
                          value: resolveUsername(doc.owner_id),
                          capitalize: true,
                        },
                        { label: 'Created', value: formatDateTime(doc.created_at) },
                        { label: 'Updated', value: formatDateTime(doc.updated_at) },
                      ] as { label: string; value: string; mono?: boolean; capitalize?: boolean }[]
                    ).map((item) => (
                      <div key={item.label}>
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        <p
                          className={`text-sm ${item.mono ? 'font-mono' : ''} ${item.capitalize ? 'capitalize' : ''}`}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  {doc.category === 'external_correspondence' && doc.original_filename && (
                    <Alert variant="info" className="mb-5 border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20">
                      <FileText className="h-4 w-4" />
                      <AlertDescription>
                        Primary file: <strong>{doc.original_filename}</strong> (stored on server).
                      </AlertDescription>
                    </Alert>
                  )}
                  <Separator className="mb-5" />
                  {doc.content ? (
                    <div
                      className="prose prose-sm max-w-none bg-muted/30 rounded-lg border border-border/50 p-4 text-foreground"
                      dangerouslySetInnerHTML={{ __html: doc.content }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-8">
                      {doc.category === 'external_correspondence'
                        ? 'Body content is stored as the uploaded file.'
                        : 'No content'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

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

            <TabsContent value="workflow">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4" /> BPMN routing & approvals
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">
                    Read-only view of the workflow engine path (linear orchestration). Approvals and transitions
                    continue to run through existing APIs.
                  </p>
                </CardHeader>
                <CardContent>
                  <WorkflowBpmnPanel documentId={doc.id} documentStatus={doc.status} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
            </div>

            <aside className="min-w-0 xl:sticky xl:top-4 space-y-4">
              <DocumentActivitySidebar
                createdAt={doc.created_at}
                actions={workflowActions}
                actionsLoading={workflowActionsLoading}
                versions={versions}
                versionsLoading={versionsLoading}
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                Official letterhead preview uses a standard layout. The signatory signature image is included after{' '}
                <strong>Final approval</strong> when the approver is registered as an active signatory.
              </p>
            </aside>
          </div>

          <Dialog open={recipientOpen} onOpenChange={setRecipientOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add recipient</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>User</Label>
                  <Select value={recipientUserId} onValueChange={setRecipientUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={recipientType}
                    onValueChange={(v) => setRecipientType(v as RecipientType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to">To</SelectItem>
                      <SelectItem value="cc">CC</SelectItem>
                      <SelectItem value="bcc">BCC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRecipientOpen(false)}>
                  Cancel
                </Button>
                <Button
                  loading={addRecipientMutation.isPending}
                  disabled={!recipientUserId}
                  onClick={() => addRecipientMutation.mutate()}
                >
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
