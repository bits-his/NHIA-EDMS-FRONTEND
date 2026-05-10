import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FileStack,
  GitBranch,
  Layers,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Archive,
  Pencil,
} from 'lucide-react';
import {
  Root as DialogRoot,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  Description as DialogDescription,
  Close as DialogClose,
} from '@radix-ui/react-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Skeleton } from '@/components/shared/Skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TemplatePreviewPanel } from '@/components/template-builder/TemplatePreviewPanel';
import { documentsApi } from '@/api/documents';
import { workflowsApi } from '@/api/workflows';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDateTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { TEMPLATE_DOCUMENT_GROUPS, SCOPE_LEVELS } from '@/components/template-builder/constants';
import { templateRowToFormFields } from '@/utils/documentTemplatePayload';
import type {
  DocumentTemplate,
  DocumentTemplateMetadata,
  DocumentTemplateStatus,
} from '@/types/documentTemplate';
import { toast } from 'sonner';

function categoryLabel(value: string): string {
  for (const g of TEMPLATE_DOCUMENT_GROUPS) {
    const f = g.items.find((i) => i.value === value);
    if (f) return f.label;
  }
  return value || '—';
}

function scopeLabel(value: string | undefined): string {
  if (!value) return '—';
  return SCOPE_LEVELS.find((s) => s.value === value)?.label ?? value;
}

const STATUS_OPTIONS: { value: 'all' | DocumentTemplateStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  published: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
  archived: 'bg-muted text-muted-foreground',
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

export default function TemplateListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentTemplateStatus>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);
  const [assignFor, setAssignFor] = useState<DocumentTemplate | null>(null);
  const [workflowPickId, setWorkflowPickId] = useState('');
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

  const { data: templates, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [QUERY_KEYS.documentTemplates],
    queryFn: () => documentsApi.listTemplates(),
  });

  const { data: workflowTemplates } = useQuery({
    queryKey: [QUERY_KEYS.workflowTemplates],
    queryFn: () => workflowsApi.getTemplates(),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => documentsApi.updateTemplate(id, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.documentTemplates] });
      toast.success('Template archived.');
      setArchiveConfirmId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const assignWorkflowMutation = useMutation({
    mutationFn: ({
      id,
      metadata,
    }: {
      id: string;
      metadata: DocumentTemplateMetadata | null;
    }) => documentsApi.updateTemplate(id, { metadata: metadata ?? {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.documentTemplates] });
      toast.success('Workflow assignment saved.');
      setAssignFor(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  useEffect(() => {
    if (assignFor) {
      setWorkflowPickId(assignFor.metadata?.workflow_template_id ?? '');
    } else {
      setWorkflowPickId('');
    }
  }, [assignFor]);

  const filtered = useMemo(() => {
    if (!templates?.length) return [];
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      const name = t.name.toLowerCase();
      const cat = t.category.toLowerCase();
      const dept = (t.department || '').toLowerCase();
      const code = (t.metadata?.template_code || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || dept.includes(q) || code.includes(q);
    });
  }, [templates, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = filtered.length === 0 ? 0 : Math.min(safePage * pageSize, filtered.length);

  const workflowNameById = useMemo(() => {
    const m = new Map<string, string>();
    workflowTemplates?.forEach((w) => m.set(w.id, w.name));
    return m;
  }, [workflowTemplates]);

  async function handleDuplicate(t: DocumentTemplate) {
    try {
      const full = await documentsApi.getTemplate(t.id);
      const fields = templateRowToFormFields(full);
      navigate('/template-management/create', {
        state: {
          duplicateSnapshot: {
            ...fields,
            name: `${fields.name.trim() || 'Untitled template'} (copy)`,
            code: '',
          },
        },
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function handleSaveWorkflowAssignment() {
    if (!assignFor) return;
    const nextMeta: DocumentTemplateMetadata = {
      ...(assignFor.metadata ?? {}),
      ...(workflowPickId ? { workflow_template_id: workflowPickId } : {}),
    };
    if (!workflowPickId) {
      delete nextMeta.workflow_template_id;
    }
    assignWorkflowMutation.mutate({ id: assignFor.id, metadata: nextMeta });
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="text-foreground font-medium">Templates</span>
      </nav>

      <PageHeader
        title="Template catalogue"
        description="Browse, filter, and manage document templates. Assign a default workflow for submissions created from each template."
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/template-management/create')}>
              <Plus className="h-4 w-4 mr-1.5" />
              New template
            </Button>
          </div>
        }
      />

      <Card className="p-4 border-border/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, type, department, or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
              aria-label="Search templates"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as 'all' | DocumentTemplateStatus)}
            >
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : !templates?.length ? (
        <EmptyState
          icon={FileStack}
          title="No templates yet"
          description="Create your first template to standardise memos and correspondence."
          action={{
            label: 'Create template',
            onClick: () => navigate('/template-management/create'),
          }}
        />
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-60" />
          <p className="text-sm font-medium text-foreground">No templates match your filters</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting search or status.</p>
          <Button
            variant="link"
            size="sm"
            className="mt-2"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
          >
            Clear filters
          </Button>
        </Card>
      ) : (
        <>
          <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left font-semibold px-4 py-3">Template</th>
                  <th className="text-left font-semibold px-4 py-3 w-[160px]">Workflow</th>
                  <th className="text-left font-semibold px-4 py-3 w-[160px]">Document type</th>
                  <th className="text-left font-semibold px-4 py-3 w-[120px]">Department</th>
                  <th className="text-left font-semibold px-4 py-3 w-[100px]">Status</th>
                  <th className="text-left font-semibold px-4 py-3 w-[140px]">Updated</th>
                  <th className="text-right font-semibold px-4 py-3 w-[72px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((t) => (
                  <TemplateTableRow
                    key={t.id}
                    t={t}
                    workflowLabel={
                      t.metadata?.workflow_template_id
                        ? workflowNameById.get(t.metadata.workflow_template_id) ?? '—'
                        : '—'
                    }
                    onPreview={() => setPreviewTemplate(t)}
                    onDuplicate={() => handleDuplicate(t)}
                    onAssignWorkflow={() => setAssignFor(t)}
                    onArchive={() => setArchiveConfirmId(t.id)}
                    archiving={archiveMutation.isPending && archiveMutation.variables === t.id}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {paginated.map((t) => (
              <MobileTemplateCard
                key={t.id}
                t={t}
                workflowLabel={
                  t.metadata?.workflow_template_id
                    ? workflowNameById.get(t.metadata.workflow_template_id) ?? '—'
                    : '—'
                }
                onPreview={() => setPreviewTemplate(t)}
                onDuplicate={() => handleDuplicate(t)}
                onAssignWorkflow={() => setAssignFor(t)}
                onArchive={() => setArchiveConfirmId(t.id)}
                archiving={archiveMutation.isPending && archiveMutation.variables === t.id}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-border/80 rounded-lg bg-muted/20 px-3 py-3">
            <p className="text-xs text-muted-foreground order-2 sm:order-1">
              {filtered.length === 0 ? (
                <>No rows</>
              ) : (
                <>
                  Showing{' '}
                  <span className="tabular-nums text-foreground font-medium">
                    {rangeStart}–{rangeEnd}
                  </span>{' '}
                  of{' '}
                  <span className="tabular-nums text-foreground font-medium">{filtered.length}</span>
                  {templates && filtered.length !== templates.length ? (
                    <>
                      {' '}
                      matching ({templates.length} in catalogue)
                    </>
                  ) : (
                    <> template{filtered.length !== 1 ? 's' : ''}</>
                  )}
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end order-1 sm:order-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="tpl-page-size" className="text-xs text-muted-foreground whitespace-nowrap">
                  Per page
                </Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger id="tpl-page-size" className="h-8 w-[72px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums px-2 min-w-[5.5rem] text-center">
                  Page {safePage} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage >= pageCount}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Preview */}
      <DialogRoot open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogContent className="fixed left-[50%] top-[50%] z-50 max-h-[92vh] w-[min(100vw-2rem,56rem)] max-w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border bg-background p-4 shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex items-start justify-between gap-2 mb-2">
              <DialogTitle className="text-lg font-semibold text-left">Preview</DialogTitle>
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="shrink-0">
                  Close
                </Button>
              </DialogClose>
            </div>
            <DialogDescription className="sr-only">
              Rendered template body HTML as it will appear when generating documents.
            </DialogDescription>
            {previewTemplate ? (
              <div className="overflow-y-auto max-h-[calc(92vh-5rem)] pr-1">
                <TemplatePreviewPanel
                  variant="embedded"
                  templateName={previewTemplate.name}
                  templateCode={previewTemplate.metadata?.template_code ?? ''}
                  docTypeLabel={categoryLabel(previewTemplate.category)}
                  scopeLabel={scopeLabel(previewTemplate.metadata?.scope_level)}
                  html={previewTemplate.body_template ?? ''}
                  zoneCode={
                    previewTemplate.metadata?.scope_level === 'all'
                      ? undefined
                      : previewTemplate.metadata?.zone
                  }
                  stateOfficeName={
                    previewTemplate.metadata?.scope_level === 'all'
                      ? undefined
                      : previewTemplate.metadata?.state_office
                  }
                  className="lg:static lg:top-auto shadow-none border-border"
                />
              </div>
            ) : null}
          </DialogContent>
        </DialogPortal>
      </DialogRoot>

      {/* Assign workflow */}
      <DialogRoot open={!!assignFor} onOpenChange={(open) => !open && setAssignFor(null)}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogContent className="fixed left-[50%] top-[50%] z-50 w-[min(100vw-2rem,28rem)] max-w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border bg-background p-6 shadow-xl focus:outline-none">
            <DialogTitle className="text-lg font-semibold">Assign workflow template</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1 mb-4">
              Used as the default workflow when staff submit documents created from this catalogue
              template (e.g. “Submit immediately” on new document).
            </DialogDescription>
            <div className="space-y-2">
              <Label htmlFor="wf-pick">Workflow template</Label>
              <Select value={workflowPickId || '__none__'} onValueChange={(v) => setWorkflowPickId(v === '__none__' ? '' : v)}>
                <SelectTrigger id="wf-pick">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {workflowTemplates?.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.steps.length} step{w.steps.length !== 1 ? 's' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" type="button" onClick={() => setAssignFor(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveWorkflowAssignment}
                disabled={assignWorkflowMutation.isPending}
              >
                {assignWorkflowMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : null}
                Save
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>

      <ConfirmDialog
        open={!!archiveConfirmId}
        onOpenChange={(open) => !open && setArchiveConfirmId(null)}
        title="Archive this template?"
        description="Archived templates remain in the catalogue but are marked inactive. You can change status again from the editor."
        confirmLabel="Archive"
        variant="destructive"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveConfirmId && archiveMutation.mutate(archiveConfirmId)}
      />
    </div>
  );
}

function TemplateActionsDropdown({
  onPreview,
  onDuplicate,
  onAssignWorkflow,
  onArchive,
  onEditTo,
  disabledArchive,
  archiving,
}: {
  onPreview: () => void;
  onDuplicate: () => void;
  onAssignWorkflow: () => void;
  onArchive: () => void;
  onEditTo: string;
  disabledArchive: boolean;
  archiving: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Template actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onPreview}>
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAssignWorkflow}>
          <GitBranch className="h-4 w-4 mr-2" />
          Assign workflow
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onArchive} disabled={disabledArchive || archiving}>
          <Archive className="h-4 w-4 mr-2" />
          {archiving ? 'Archiving…' : 'Archive'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={onEditTo} className="cursor-pointer flex items-center">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TemplateTableRow({
  t,
  workflowLabel,
  onPreview,
  onDuplicate,
  onAssignWorkflow,
  onArchive,
  archiving,
}: {
  t: DocumentTemplate;
  workflowLabel: string;
  onPreview: () => void;
  onDuplicate: () => void;
  onAssignWorkflow: () => void;
  onArchive: () => void;
  archiving: boolean;
}) {
  const updated = t.updated_at ? formatDateTime(t.updated_at) : formatDateTime(t.created_at);

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-foreground">{t.name}</div>
        {t.metadata?.template_code ? (
          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{t.metadata.template_code}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground text-xs">{workflowLabel}</td>
      <td className="px-4 py-3 align-top text-muted-foreground">{categoryLabel(t.category)}</td>
      <td className="px-4 py-3 align-top text-muted-foreground">{t.department || '—'}</td>
      <td className="px-4 py-3 align-top">
        <Badge variant="outline" className={STATUS_STYLE[t.status] ?? STATUS_STYLE.draft}>
          {t.status}
        </Badge>
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground tabular-nums text-xs">{updated}</td>
      <td className="px-4 py-3 align-top text-right">
        <TemplateActionsDropdown
          onPreview={onPreview}
          onDuplicate={onDuplicate}
          onAssignWorkflow={onAssignWorkflow}
          onArchive={onArchive}
          onEditTo={`/template-management/edit/${t.id}`}
          disabledArchive={t.status === 'archived'}
          archiving={archiving}
        />
      </td>
    </tr>
  );
}

function MobileTemplateCard({
  t,
  workflowLabel,
  onPreview,
  onDuplicate,
  onAssignWorkflow,
  onArchive,
  archiving,
}: {
  t: DocumentTemplate;
  workflowLabel: string;
  onPreview: () => void;
  onDuplicate: () => void;
  onAssignWorkflow: () => void;
  onArchive: () => void;
  archiving: boolean;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground leading-snug">{t.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{categoryLabel(t.category)}</p>
        </div>
        <TemplateActionsDropdown
          onPreview={onPreview}
          onDuplicate={onDuplicate}
          onAssignWorkflow={onAssignWorkflow}
          onArchive={onArchive}
          onEditTo={`/template-management/edit/${t.id}`}
          disabledArchive={t.status === 'archived'}
          archiving={archiving}
        />
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <span className="text-muted-foreground/80">Workflow:</span> {workflowLabel}
        </p>
        <p>
          <span className="text-muted-foreground/80">Department:</span> {t.department || '—'}
        </p>
        <p>
          <span className="text-muted-foreground/80">Updated:</span>{' '}
          {t.updated_at ? formatDateTime(t.updated_at) : formatDateTime(t.created_at)}
        </p>
      </div>
      <Badge variant="outline" className={STATUS_STYLE[t.status] ?? STATUS_STYLE.draft}>
        {t.status}
      </Badge>
    </Card>
  );
}
