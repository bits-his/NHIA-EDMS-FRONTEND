import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  Search,
  SlidersHorizontal,
  X,
  Pencil,
  Inbox,
  CheckCircle2,
  MoreHorizontal,
  RotateCcw,
  UserCog,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { documentsApi } from '@/api/documents';
import { tasksApi } from '@/api/tasks';
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import { canCreateDocument } from '@/utils/permissions';
import { QUERY_KEYS } from '@/utils/constants';
import type { CorrespondenceDirection, Document, DocumentCategory, DocumentStatus } from '@/types/document';
import { correspondenceDirectionLabel, documentRegistryId } from '@/utils/correspondence';
import { formatRelative, isDocumentAssignmentOverdue } from '@/utils/formatters';
import { registerUsers, resolveUsername } from '@/utils/users';
import { documentTypeHeadline, shouldShowTemplateTitleAsSubtitle } from '@/utils/documentDisplay';
import { cn } from '@/utils/cn';

/**
 * Tab buckets for the documents list. The backend `listDocumentsForUser` already
 * narrows results to documents the user is involved in (owner, recipient, or has
 * an active workflow task) — so pending docs in the user's list represent work
 * that needs their attention. Leadership oversight roles see broader sets, which
 * is acceptable since their "Action required" view is intentionally inclusive.
 */
/** Active work queues only — filed/archived records live under Document archive. */
type DocumentBucket = 'all' | 'drafts' | 'action' | 'completed';

function bucketForStatus(status: DocumentStatus): Exclude<DocumentBucket, 'all'> {
  if (status === 'draft') return 'drafts';
  if (status === 'pending') return 'action';
  return 'completed';
}

function urgencyLabel(u: Document['urgency']): string {
  if (!u) return '—';
  if (u === 'very_urgent') return 'Critical';
  return u.charAt(0).toUpperCase() + u.slice(1);
}

/** Group document rows by calendar-style creation windows (similar to mail clients). */
type CreationTimeGroup = 'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'older';

const CREATION_GROUP_ORDER: CreationTimeGroup[] = ['today', 'yesterday', 'lastWeek', 'lastMonth', 'older'];

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getCreationTimeGroup(iso: string, now = new Date()): CreationTimeGroup {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'older';
  const s0 = startOfLocalDay(now).getTime();
  const dayMs = 86400000;
  const sYest = s0 - dayMs;
  const sWeek = s0 - 7 * dayMs;
  const sMonth = s0 - 30 * dayMs;
  if (t >= s0) return 'today';
  if (t >= sYest) return 'yesterday';
  if (t >= sWeek) return 'lastWeek';
  if (t >= sMonth) return 'lastMonth';
  return 'older';
}

function creationGroupHeading(g: CreationTimeGroup): string {
  if (g === 'today') return 'Today';
  if (g === 'yesterday') return 'Yesterday';
  if (g === 'lastWeek') return 'Last week';
  if (g === 'lastMonth') return 'Last month';
  return 'Older';
}

/** Unified time-bucket header — readable hierarchy without loud per-bucket colours. */
const GROUP_HEADER_ROW =
  'bg-muted/45 dark:bg-muted/20 text-foreground border-b border-border/80';

function ownerDisplayLabel(
  ownerId: string | null | undefined,
  directoryById: Map<string, string>
): string {
  if (!ownerId) return '—';
  const fromApi = directoryById.get(ownerId);
  if (fromApi) return fromApi;
  return resolveUsername(ownerId);
}

function isDocumentCreator(doc: Document, userId: string | undefined): boolean {
  return Boolean(userId && doc.owner_id && doc.owner_id === userId);
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [directionFilter, setDirectionFilter] = useState<CorrespondenceDirection | 'all'>('all');
  const [bucket, setBucket] = useState<DocumentBucket>('all');
  const [recallDoc, setRecallDoc] = useState<Document | null>(null);
  const [reassignDoc, setReassignDoc] = useState<Document | null>(null);
  const [reassignUserId, setReassignUserId] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<CreationTimeGroup, boolean>>(() => {
    const init = {} as Record<CreationTimeGroup, boolean>;
    for (const g of CREATION_GROUP_ORDER) init[g] = true;
    return init;
  });

  const useServerSearch = Boolean(
    search.trim() ||
      categoryFilter !== 'all' ||
      directionFilter !== 'all' ||
      dateFrom.trim() ||
      dateTo.trim()
  );

  const searchFilters = {
    ...(search.trim() ? { keyword: search.trim() } : {}),
    ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
    ...(directionFilter !== 'all' ? { correspondence_direction: directionFilter } : {}),
    ...(dateFrom.trim() ? { date_from: `${dateFrom.trim()}T00:00:00.000Z` } : {}),
    ...(dateTo.trim() ? { date_to: `${dateTo.trim()}T23:59:59.999Z` } : {}),
  };

  const { data: allDocuments, isLoading, error, refetch } = useQuery({
    queryKey: useServerSearch
      ? [...QUERY_KEYS.documentsSearch(searchFilters), user?.user_id ?? 'anon']
      : [QUERY_KEYS.allDocuments, user?.user_id ?? 'anon'],
    queryFn: () =>
      useServerSearch ? documentsApi.search(searchFilters) : documentsApi.listAll(),
    staleTime: 30_000,
  });

  const { data: directoryUsers = [], error: directoryError } = useQuery({
    queryKey: ['auth', 'users', 'directory'],
    queryFn: () => authApi.listUsers(),
    staleTime: 60_000,
    retry: false,
  });

  const { data: myTasks = [] } = useQuery({
    queryKey: QUERY_KEYS.tasks(user?.user_id ?? ''),
    queryFn: () => tasksApi.list(user!.user_id),
    enabled: !!user?.user_id,
    staleTime: 30_000,
  });

  const ownerDirectoryById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of directoryUsers) {
      const name =
        (u.full_name && u.full_name.trim()) || u.username?.trim() || u.email?.trim() || '';
      if (u.id && name) m.set(u.id, name);
    }
    return m;
  }, [directoryUsers]);

  useEffect(() => {
    if (directoryUsers.length) registerUsers(directoryUsers);
  }, [directoryUsers]);

  const docs = useMemo(
    () => (allDocuments ?? []).filter((d) => d.status !== 'archived'),
    [allDocuments]
  );

  const overdueByDocId = useMemo(() => {
    const m = new Map<string, boolean>();
    if (!user?.user_id) return m;
    for (const doc of docs) {
      const isDmRecipient =
        doc.delivery_mode === 'direct_message' &&
        doc.status === 'pending' &&
        doc.owner_id !== user.user_id;
      m.set(
        doc.id,
        isDocumentAssignmentOverdue(doc, {
          userId: user.user_id,
          tasks: myTasks,
          isDirectMessageRecipient: isDmRecipient,
          directMessageAssignedAt: doc.updated_at,
        })
      );
    }
    return m;
  }, [docs, myTasks, user?.user_id]);

  const bucketCounts = docs.reduce(
    (acc, d) => {
      acc.all += 1;
      acc[bucketForStatus(d.status)] += 1;
      return acc;
    },
    { all: 0, drafts: 0, action: 0, completed: 0 }
  );

  const filtered = docs.filter((doc) => {
    if (bucket === 'all') return true;
    if (bucket === 'drafts') return doc.status === 'draft';
    if (bucket === 'action') return doc.status === 'pending';
    if (bucket === 'completed') return doc.status === 'approved' || doc.status === 'rejected';
    return false;
  });

  const sortedByRecency = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [filtered]
  );

  const groupedDocs = useMemo(() => {
    const map = new Map<CreationTimeGroup, Document[]>();
    for (const g of CREATION_GROUP_ORDER) map.set(g, []);
    for (const doc of sortedByRecency) {
      map.get(getCreationTimeGroup(doc.created_at))!.push(doc);
    }
    return map;
  }, [sortedByRecency]);

  const invalidateDocuments = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.allDocuments] });
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        (q.queryKey[0] === QUERY_KEYS.allDocuments || q.queryKey[0] === 'documents-search'),
    });
    if (user?.user_id) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tasks(user.user_id) });
    }
  };

  const recallMutation = useMutation({
    mutationFn: (id: string) => documentsApi.recall(id),
    onSuccess: () => {
      toast.success('Document recalled to draft.');
      setRecallDoc(null);
      invalidateDocuments();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const reassignMutation = useMutation({
    mutationFn: ({ id, assigneeUserId }: { id: string; assigneeUserId: string }) =>
      documentsApi.reassign(id, assigneeUserId),
    onSuccess: () => {
      toast.success('Workflow step reassigned.');
      setReassignDoc(null);
      setReassignUserId('');
      invalidateDocuments();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const pendingCount = bucketCounts.action;
  const hasFilters =
    search ||
    dateFrom ||
    dateTo ||
    categoryFilter !== 'all' ||
    bucket !== 'all';

  // const pageDescription = !isLoading && !error
  //   ? `${docs.length} document${docs.length !== 1 ? 's' : ''} in your workspace${
  //       sortedByRecency.length !== docs.length ? ` · ${sortedByRecency.length} match this view` : ''
  //     }.`
  //   : 'Loading your document list…';

  return (
    <div className="w-full min-w-0 space-y-6 bg-gradient-to-b from-muted/25 via-background to-background">
      <PageHeader
        title=""
        // description={pageDescription}
        className="mb-2"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* {pendingCount > 0 && bucket !== 'action' && (
              <Button
                type="button"
                variant="outline"
                size="default"
                className="rounded-lg border-amber-200/80 bg-amber-50/90 text-amber-900 shadow-sm hover:bg-amber-100 hover:border-amber-300 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
                onClick={() => setBucket('action')}
              >
                <Inbox className="h-4 w-4" aria-hidden />
                {pendingCount} item{pendingCount !== 1 ? 's' : ''} need attention
                <Badge variant="warning" className="ml-1 tabular-nums">
                  View
                </Badge>
              </Button>
            )} */}
            {canCreateDocument(user?.roles ?? [], user?.permissions ?? []) ? (
              <Button size="default" className="rounded-lg shadow-sm" onClick={() => navigate('/documents/new')}>
                <Plus className="h-4 w-4" /> Start process
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-sm font-medium text-foreground">Search and refine</span>
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setSearch('');
                  setDateFrom('');
                  setDateTo('');
                  setCategoryFilter('all');
                  setBucket('all');
                }}
              >
                <X className="h-3.5 w-3.5" /> Reset filters
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-4">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Title, reference, or body…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 bg-background"
                />
              </div>
            </div>
            <div className="sm:col-span-1 lg:col-span-2">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Process status
              </label>
              <Select value={bucket} onValueChange={(v) => setBucket(v as DocumentBucket)}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Process status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({bucketCounts.all})</SelectItem>
                  <SelectItem value="drafts">Drafts ({bucketCounts.drafts})</SelectItem>
                  <SelectItem value="action">Action required ({bucketCounts.action})</SelectItem>
                  <SelectItem value="completed">Completed ({bucketCounts.completed})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  From
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10 bg-background"
                  title="Created from"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  To
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10 bg-background"
                  title="Created to"
                />
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Category
              </label>
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as DocumentCategory | 'all')}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="internal_memo">Internal memo</SelectItem>
                  <SelectItem value="external_correspondence">External correspondence</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Correspondence
              </label>
              <Select
                value={directionFilter}
                onValueChange={(v) => setDirectionFilter(v as CorrespondenceDirection | 'all')}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All directions</SelectItem>
                  <SelectItem value="incoming">Incoming</SelectItem>
                  <SelectItem value="outgoing">Outgoing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Process
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[112px] min-w-[112px]">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[150px] min-w-[150px]">
                    Process status
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[160px] min-w-[160px]">
                    Reference
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[200px] min-w-[200px]">
                    Department
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[110px] min-w-[110px]">
                    Urgency
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[220px] min-w-[220px]">
                    Owner
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[130px] min-w-[130px]">
                    Updated
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[108px] min-w-[108px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={9} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : sortedByRecency.length === 0 ? (
        <EmptyState
          icon={
            bucket === 'drafts'
              ? Pencil
              : bucket === 'action'
                ? Inbox
                : bucket === 'completed'
                  ? CheckCircle2
                  : FileText
          }
          title={
            hasFilters
              ? bucket === 'drafts'
                ? 'No drafts'
                : bucket === 'action'
                  ? 'Nothing needs your action'
                  : bucket === 'completed'
                    ? 'No completed processes yet'
                    : 'No matching processes'
              : 'No processes yet'
          }
          description={
            bucket === 'drafts'
              ? 'Draft processes you start or that are returned to you will appear here.'
              : bucket === 'action'
                ? 'You are all caught up. In-progress processes that need your input will land here.'
                : bucket === 'completed'
                  ? 'Completed and rejected processes you participated in will appear here. Filed records are in the archive.'
                  : hasFilters
                    ? 'Try adjusting your search or filters'
                    : 'Start your first process to see it in this list'
          }
          action={
            canCreateDocument(user?.roles ?? [], user?.permissions ?? []) &&
            (bucket === 'all' || bucket === 'drafts')
              ? { label: 'Start process', onClick: () => navigate('/documents/new') }
              : undefined
          }
        />
      ) : (
        <>
          {/* <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="font-normal">
              {docs.length} total
            </Badge>
            {sortedByRecency.length !== docs.length && (
              <Badge variant="outline" className="font-normal">
                {sortedByRecency.length} in this view
                {bucket !== 'all' && (
                  <span className="ml-1 capitalize">
                    ·{' '}
                    {bucket === 'drafts' ? 'drafts' : bucket === 'action' ? 'action' : 'completed'}
                  </span>
                )}
              </Badge>
            )}
            <span className="text-xs sm:ml-auto">Grouped by date created</span>
          </div> */}

        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Process
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[112px] min-w-[112px]">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[150px] min-w-[150px]">
                    Process status
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[160px] min-w-[160px]">
                    Reference
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[200px] min-w-[200px]">
                    Department
                  </th>
                  {/* <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[110px] min-w-[110px]">
                    Urgency
                  </th> */}
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[220px] min-w-[220px]">
                    Owner
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[130px] min-w-[130px]">
                    Updated
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[108px] min-w-[108px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {CREATION_GROUP_ORDER.map((group) => {
                  const rows = groupedDocs.get(group) ?? [];
                  if (!rows.length) return null;
                  const isOpen = expandedGroups[group] !== false;
                  return (
                    <Fragment key={group}>
                      {/* <tr className={cn('border-b border-border/60', GROUP_HEADER_ROW)}>
                        <td colSpan={9} className="p-0">
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none transition hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedGroups((prev) => ({
                                ...prev,
                                [group]: !(prev[group] ?? true),
                              }));
                            }}
                            aria-expanded={isOpen}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground">
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" aria-hidden />
                              ) : (
                                <ChevronRight className="h-4 w-4" aria-hidden />
                              )}
                            </span>
                            <span className="text-sm font-semibold text-foreground tracking-tight">
                              {creationGroupHeading(group)}
                            </span>
                            <span className="ml-auto rounded-full border border-border/60 bg-background px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                              {rows.length}
                            </span>
                          </button>
                        </td>
                      </tr> */}
                      {isOpen &&
                        rows.map((doc, rowIdx) => {
                          const pending = doc.status === 'pending';
                          const creator = isDocumentCreator(doc, user?.user_id);
                          const showRecall = creator && doc.status === 'pending';
                          const showReassign =
                            creator && doc.status === 'pending' && doc.delivery_mode === 'workflow';
                          const showActions = showRecall || showReassign;
                          const stripe = rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/15';

                          return (
                            <tr
                              key={doc.id}
                              role="button"
                              tabIndex={0}
                              className={cn(
                                'border-b border-border/50 cursor-pointer transition-colors',
                                'hover:bg-muted/50',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                                stripe,
                                pending &&
                                  'border-l-[3px] border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                              )}
                              onClick={() => navigate(`/documents/${doc.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(`/documents/${doc.id}`);
                                }
                              }}
                            >
                              <td className="px-4 py-3.5 align-top">
                                <div className="min-w-0 max-w-[320px] sm:max-w-[400px]">
                                  <p className="font-medium text-foreground leading-snug line-clamp-2">
                                    {documentTypeHeadline(doc)}
                                  </p>
                                  {shouldShowTemplateTitleAsSubtitle(doc) && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1" title={doc.title}>
                                      {doc.title}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 align-top whitespace-nowrap">
                                {doc.category === 'internal_memo' ? (
                                  <Badge variant="outline" className="font-normal text-xs">
                                    Internal
                                  </Badge>
                                ) : doc.category === 'external_correspondence' ? (
                                  <Badge variant="outline" className="font-normal text-xs">
                                    {correspondenceDirectionLabel(doc.correspondence_direction)}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 align-top">
                                <DocumentStatusBadge
                                  status={doc.status}
                                  statusLabel={doc.status_label}
                                  size="sm"
                                  overdue={overdueByDocId.get(doc.id) ?? false}
                                />
                              </td>
                              <td className="px-4 py-3.5 align-top">
                                {documentRegistryId(doc) ? (
                                  <span className="inline-block rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-mono text-[11px] text-foreground">
                                    {documentRegistryId(doc)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 align-top text-muted-foreground min-w-[200px] max-w-[240px]">
                                <span className="line-clamp-2 text-sm break-words">{doc.department?.trim() || '—'}</span>
                              </td>
                              {/* <td className="px-4 py-3.5 align-top whitespace-nowrap">
                                {doc.urgency === 'very_urgent' ? (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Critical
                                  </Badge>
                                ) : doc.urgency && doc.urgency !== 'normal' ? (
                                  <Badge variant="warning" className="text-[10px] font-normal capitalize">
                                    {urgencyLabel(doc.urgency)}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{urgencyLabel(doc.urgency)}</span>
                                )}
                              </td> */}
                              <td
                                className="px-4 py-3.5 align-top text-sm text-foreground min-w-[220px] max-w-[260px] break-words"
                                title={ownerDisplayLabel(doc.owner_id, ownerDirectoryById)}
                              >
                                {ownerDisplayLabel(doc.owner_id, ownerDirectoryById)}
                              </td>
                              <td className="px-4 py-3.5 align-top text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                                {formatRelative(doc.updated_at)}
                              </td>
                              <td
                                className="px-2 py-2 align-middle text-right"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                {showActions ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label="Document actions"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                      {showRecall && (
                                        <DropdownMenuItem onSelect={() => setRecallDoc(doc)}>
                                          <RotateCcw className="h-4 w-4 mr-2" />
                                          Recall to draft
                                        </DropdownMenuItem>
                                      )}
                                      {showReassign && (
                                        <DropdownMenuItem
                                          onSelect={() => {
                                            setReassignDoc(doc);
                                            setReassignUserId('');
                                          }}
                                        >
                                          <UserCog className="h-4 w-4 mr-2" />
                                          Reassign step
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <span className="text-muted-foreground text-xs pr-2">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}

      <ConfirmDialog
        open={Boolean(recallDoc)}
        onOpenChange={(open) => {
          if (!open) setRecallDoc(null);
        }}
        title="Recall this document?"
        description="This moves the document back to draft and pauses the active workflow (if any). Only you can do this because you created it."
        confirmLabel="Recall"
        variant="destructive"
        loading={recallMutation.isPending}
        onConfirm={() => {
          if (recallDoc) recallMutation.mutate(recallDoc.id);
        }}
      />

      <Dialog
        open={Boolean(reassignDoc)}
        onOpenChange={(open) => {
          if (!open) {
            setReassignDoc(null);
            setReassignUserId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Reassign workflow step</DialogTitle>
            <DialogDescription>
              Choose who should hold the current workflow task for this document. Only the creator can
              reassign.
            </DialogDescription>
          </DialogHeader>
          {directoryError ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                User directory could not be loaded. Enter the assignee&apos;s user ID (UUID) manually.
              </p>
              <Input
                placeholder="Assignee user UUID"
                value={reassignUserId}
                onChange={(e) => setReassignUserId(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="reassign-select" className="text-sm font-medium">
                New assignee
              </label>
              <Select value={reassignUserId} onValueChange={setReassignUserId}>
                <SelectTrigger id="reassign-select">
                  <SelectValue placeholder={directoryUsers.length ? 'Select a user' : 'Loading…'} />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {directoryUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name?.trim() || u.username} ({u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReassignDoc(null);
                setReassignUserId('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!reassignUserId.trim() || reassignMutation.isPending}
              loading={reassignMutation.isPending}
              onClick={() => {
                if (!reassignDoc || !reassignUserId.trim()) return;
                reassignMutation.mutate({ id: reassignDoc.id, assigneeUserId: reassignUserId.trim() });
              }}
            >
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
