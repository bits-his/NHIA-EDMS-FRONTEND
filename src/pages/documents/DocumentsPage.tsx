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
  Layers,
  MoreHorizontal,
  RotateCcw,
  UserCog,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import { canCreateDocument } from '@/utils/permissions';
import { QUERY_KEYS } from '@/utils/constants';
import type { Document, DocumentCategory, DocumentStatus } from '@/types/document';
import { formatRelative } from '@/utils/formatters';
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
type DocumentBucket = 'all' | 'drafts' | 'action' | 'completed';

const FINISHED_STATUSES: ReadonlySet<DocumentStatus> = new Set([
  'approved',
  'archived',
  'rejected',
]);

function bucketForStatus(status: DocumentStatus): Exclude<DocumentBucket, 'all'> {
  if (status === 'draft') return 'drafts';
  if (status === 'pending') return 'action';
  return 'completed';
}

function categoryLabel(c: DocumentCategory | null | undefined): string {
  if (c === 'internal_memo') return 'Internal';
  if (c === 'external_correspondence') return 'External';
  return '—';
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

/** Distinct strip for each time bucket (section header row). */
const GROUP_HEADER_SURFACE: Record<CreationTimeGroup, string> = {
  today:
    'bg-emerald-100/95 text-emerald-950 border-l-[6px] border-emerald-600 dark:bg-emerald-950/55 dark:text-emerald-50 dark:border-emerald-400',
  yesterday:
    'bg-teal-100/90 text-teal-950 border-l-[6px] border-teal-600 dark:bg-teal-950/50 dark:text-teal-50 dark:border-teal-400',
  lastWeek:
    'bg-sky-100/90 text-sky-950 border-l-[6px] border-sky-600 dark:bg-sky-950/50 dark:text-sky-50 dark:border-sky-400',
  lastMonth:
    'bg-indigo-100/85 text-indigo-950 border-l-[6px] border-indigo-600 dark:bg-indigo-950/45 dark:text-indigo-50 dark:border-indigo-400',
  older:
    'bg-slate-200/90 text-slate-900 border-l-[6px] border-slate-500 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-400',
};

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
  const [refFilter, setRefFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
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
      refFilter.trim() ||
      categoryFilter !== 'all' ||
      dateFrom.trim() ||
      dateTo.trim()
  );

  const searchFilters = {
    ...(search.trim() ? { keyword: search.trim() } : {}),
    ...(refFilter.trim() ? { ref_number: refFilter.trim() } : {}),
    ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
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

  const docs = allDocuments ?? [];

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
    return FINISHED_STATUSES.has(doc.status);
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
    refFilter ||
    dateFrom ||
    dateTo ||
    categoryFilter !== 'all' ||
    bucket !== 'all';

  const pageDescription = !isLoading && !error
    ? `${docs.length} document${docs.length !== 1 ? 's' : ''} loaded${
        sortedByRecency.length !== docs.length
          ? ` · ${sortedByRecency.length} in this tab/filters`
          : ''
      }. Grouped by creation date.`
    : 'Documents visible to your role (and your own created documents)';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description={pageDescription}
        actions={
          canCreateDocument(user?.roles ?? [], user?.permissions ?? []) ? (
            <Button size="sm" onClick={() => navigate('/documents/new')}>
              <Plus className="h-4 w-4" /> Start process
            </Button>
          ) : undefined
        }
      />

      {/* Pending callout */}
      {pendingCount > 0 && bucket !== 'action' && (
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left"
          onClick={() => setBucket('action')}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {pendingCount} document{pendingCount !== 1 ? 's' : ''} awaiting review
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                Click to filter pending documents
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded-lg">
            Review now →
          </span>
        </button>
      )}

      {/* Tabs */}
      <Tabs value={bucket} onValueChange={(v) => setBucket(v as DocumentBucket)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">
            <Layers className="h-3.5 w-3.5" />
            All
            <span className="ml-1 rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {bucketCounts.all}
            </span>
          </TabsTrigger>
          <TabsTrigger value="drafts">
            <Pencil className="h-3.5 w-3.5" />
            Drafts
            <span className="ml-1 rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {bucketCounts.drafts}
            </span>
          </TabsTrigger>
          <TabsTrigger value="action">
            <Inbox className="h-3.5 w-3.5" />
            Action required
            <span
              className={cn(
                'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                bucketCounts.action > 0
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-foreground/5 text-muted-foreground'
              )}
            >
              {bucketCounts.action}
            </span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
            <span className="ml-1 rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {bucketCounts.completed}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Reference #"
            value={refFilter}
            onChange={(e) => setRefFilter(e.target.value)}
            className="w-40"
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[140px]"
            title="Created from"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[140px]"
            title="Created to"
          />
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as DocumentCategory | 'all')}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="internal_memo">Internal memo</SelectItem>
              <SelectItem value="external_correspondence">External</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setRefFilter('');
              setDateFrom('');
              setDateTo('');
              setCategoryFilter('all');
              setBucket('all');
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Count */}
      {!isLoading && !error && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">{docs.length}</span> total document
            {docs.length !== 1 ? 's' : ''} in this page
          </p>
          {sortedByRecency.length !== docs.length && (
            <p>
              <span className="font-semibold text-foreground">{sortedByRecency.length}</span> shown
              {bucket !== 'all' && (
                <span className="ml-1 capitalize">
                  ·{' '}
                  {bucket === 'drafts'
                    ? 'drafts'
                    : bucket === 'action'
                      ? 'action required'
                      : 'completed'}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Content */}
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-b from-card via-card to-muted/30 overflow-hidden shadow-md ring-1 ring-primary/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1240px]">
              <thead>
                <tr className="border-b-2 border-primary/30 bg-primary/15 dark:bg-primary/25">
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap text-foreground">
                    Document
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[112px] min-w-[112px]">
                    Category
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[150px] min-w-[150px]">
                    Status
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[160px] min-w-[160px]">
                    Reference
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[200px] min-w-[200px]">
                    Department
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[110px] min-w-[110px]">
                    Urgency
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[220px] min-w-[220px]">
                    Created by
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[130px] min-w-[130px]">
                    Updated
                  </th>
                  <th className="text-right font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[108px] min-w-[108px]">
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
        </div>
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
                    ? 'No completed documents yet'
                    : 'No matching documents'
              : 'No documents yet'
          }
          description={
            bucket === 'drafts'
              ? 'Drafts you create or have been returned to you will appear here.'
              : bucket === 'action'
                ? 'You are all caught up. Pending documents that need your input will land here.'
                : bucket === 'completed'
                  ? 'Approved, archived and rejected documents you participated in will appear here.'
                  : hasFilters
                    ? 'Try adjusting your search or filters'
                    : 'Start your first process to get a document in the list'
          }
          action={
            canCreateDocument(user?.roles ?? [], user?.permissions ?? []) &&
            (bucket === 'all' || bucket === 'drafts')
              ? { label: 'Start process', onClick: () => navigate('/documents/new') }
              : undefined
          }
        />
      ) : (
        <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-b from-card via-card to-violet-50/30 dark:to-violet-950/20 overflow-hidden shadow-md ring-1 ring-primary/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1240px]">
              <thead>
                <tr className="border-b-2 border-primary/35 bg-primary/15 dark:bg-primary/30">
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap text-foreground">
                    Document
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[112px] min-w-[112px]">
                    Category
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[150px] min-w-[150px]">
                    Status
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[160px] min-w-[160px]">
                    Reference
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[200px] min-w-[200px]">
                    Department
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[110px] min-w-[110px]">
                    Urgency
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[220px] min-w-[220px]">
                    Created by
                  </th>
                  <th className="text-left font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[130px] min-w-[130px]">
                    Updated
                  </th>
                  <th className="text-right font-bold px-4 py-3.5 text-xs uppercase tracking-wide whitespace-nowrap w-[108px] min-w-[108px]">
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
                      <tr
                        className={cn(
                          'border-b-2 border-border/80 shadow-sm',
                          GROUP_HEADER_SURFACE[group]
                        )}
                      >
                        <td colSpan={9} className="p-0">
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none transition hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedGroups((prev) => ({
                                ...prev,
                                [group]: !(prev[group] ?? true),
                              }));
                            }}
                            aria-expanded={isOpen}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black/10 dark:bg-white/10">
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" aria-hidden />
                              ) : (
                                <ChevronRight className="h-4 w-4" aria-hidden />
                              )}
                            </span>
                            <span className="text-sm font-bold tracking-wide">
                              {creationGroupHeading(group)}
                            </span>
                            <span className="ml-auto rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-bold tabular-nums dark:bg-white/15">
                              {rows.length}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {isOpen &&
                        rows.map((doc, rowIdx) => {
                          const pending = doc.status === 'pending';
                          const creator = isDocumentCreator(doc, user?.user_id);
                          const showRecall = creator && doc.status === 'pending';
                          const showReassign =
                            creator && doc.status === 'pending' && doc.delivery_mode === 'workflow';
                          const showActions = showRecall || showReassign;
                          const zebra =
                            rowIdx % 2 === 0
                              ? 'bg-white/90 dark:bg-slate-950/40'
                              : 'bg-violet-50/70 dark:bg-violet-950/25';

                          return (
                            <tr
                              key={doc.id}
                              role="button"
                              tabIndex={0}
                              className={cn(
                                'border-b border-border/70 cursor-pointer transition-colors',
                                'hover:bg-violet-100/80 dark:hover:bg-violet-950/35',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                                zebra,
                                pending && 'bg-amber-50/90 dark:bg-amber-950/25 ring-1 ring-inset ring-amber-300/60 dark:ring-amber-700/50'
                              )}
                              onClick={() => navigate(`/documents/${doc.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(`/documents/${doc.id}`);
                                }
                              }}
                            >
                              <td className="px-4 py-3 align-top">
                                <div className="min-w-0 max-w-[320px] sm:max-w-[400px]">
                                  <p className="font-medium text-foreground truncate">
                                    {documentTypeHeadline(doc)}
                                  </p>
                                  {shouldShowTemplateTitleAsSubtitle(doc) && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5" title={doc.title}>
                                      {doc.title}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                                {categoryLabel(doc.category)}
                              </td>
                              <td className="px-4 py-3 align-top">
                                <DocumentStatusBadge status={doc.status} statusLabel={doc.status_label} size="sm" />
                              </td>
                              <td className="px-4 py-3 align-top">
                                {doc.ref_number ? (
                                  <span className="font-mono text-xs text-muted-foreground">{doc.ref_number}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 align-top text-muted-foreground min-w-[200px] max-w-[240px]">
                                <span className="line-clamp-2 break-words">{doc.department?.trim() || '—'}</span>
                              </td>
                              <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                                {urgencyLabel(doc.urgency)}
                              </td>
                              <td
                                className="px-4 py-3 align-top text-foreground text-sm min-w-[220px] max-w-[260px] break-words"
                                title={ownerDisplayLabel(doc.owner_id, ownerDirectoryById)}
                              >
                                {ownerDisplayLabel(doc.owner_id, ownerDirectoryById)}
                              </td>
                              <td className="px-4 py-3 align-top text-muted-foreground text-xs whitespace-nowrap">
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
                                        variant="secondary"
                                        size="icon"
                                        className="h-8 w-8 shadow-sm"
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
        </div>
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
