import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FileText,
  Search,
  SlidersHorizontal,
  X,
  ChevronRight,
  Pencil,
  Inbox,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { documentsApi } from '@/api/documents';
import { canCreateDocument } from '@/utils/permissions';
import { QUERY_KEYS } from '@/utils/constants';
import type { Document, DocumentCategory, DocumentStatus } from '@/types/document';
import { formatRelative } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { documentTypeHeadline, shouldShowTemplateTitleAsSubtitle } from '@/utils/documentDisplay';
import { cn } from '@/utils/cn';

const STATUS_ORDER: Record<DocumentStatus, number> = {
  pending: 0, draft: 1, rejected: 2, approved: 3, archived: 4,
};

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

export default function DocumentsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [refFilter, setRefFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [bucket, setBucket] = useState<DocumentBucket>('all');

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

  const sorted = [...filtered].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  );

  const pendingCount = bucketCounts.action;
  const hasFilters =
    search ||
    refFilter ||
    dateFrom ||
    dateTo ||
    categoryFilter !== 'all' ||
    bucket !== 'all';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="Documents visible to your role (and your own created documents)"
        actions={
          canCreateDocument(user?.roles ?? [], user?.permissions ?? []) ? (
            <Button size="sm" onClick={() => navigate('/documents/new')}>
              <Plus className="h-4 w-4" /> New Document
            </Button>
          ) : undefined
        }
      />

      {/* Pending callout */}
      {pendingCount > 0 && bucket !== 'action' && (
        <button
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
        <p className="text-xs text-muted-foreground">
          {sorted.length} document{sorted.length !== 1 ? 's' : ''}
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

      {/* Content */}
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left font-semibold px-4 py-3">Document</th>
                  <th className="text-left font-semibold px-4 py-3 w-[100px]">Category</th>
                  <th className="text-left font-semibold px-4 py-3 w-[140px]">Status</th>
                  <th className="text-left font-semibold px-4 py-3 w-[140px]">Reference</th>
                  <th className="text-left font-semibold px-4 py-3 w-[140px]">Department</th>
                  <th className="text-left font-semibold px-4 py-3 w-[100px]">Urgency</th>
                  <th className="text-left font-semibold px-4 py-3 w-[120px]">Owner</th>
                  <th className="text-left font-semibold px-4 py-3 w-[120px]">Updated</th>
                  <th className="w-12 px-2 py-3" aria-hidden />
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
      ) : sorted.length === 0 ? (
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
                    : 'Create your first document to get started'
          }
          action={
            canCreateDocument(user?.roles ?? [], user?.permissions ?? []) &&
            (bucket === 'all' || bucket === 'drafts')
              ? { label: 'Create Document', onClick: () => navigate('/documents/new') }
              : undefined
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left font-semibold px-4 py-3">Document</th>
                  <th className="text-left font-semibold px-4 py-3 w-[100px]">Category</th>
                  <th className="text-left font-semibold px-4 py-3 w-[140px]">Status</th>
                  <th className="text-left font-semibold px-4 py-3 w-[140px]">Reference</th>
                  <th className="text-left font-semibold px-4 py-3 w-[140px]">Department</th>
                  <th className="text-left font-semibold px-4 py-3 w-[100px]">Urgency</th>
                  <th className="text-left font-semibold px-4 py-3 w-[120px]">Owner</th>
                  <th className="text-left font-semibold px-4 py-3 w-[120px]">Updated</th>
                  <th className="w-12 px-2 py-3" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {sorted.map((doc) => {
                  const pending = doc.status === 'pending';
                  return (
                    <tr
                      key={doc.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'border-b border-border/80 last:border-0 cursor-pointer transition-colors',
                        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        pending && 'bg-amber-50/50 dark:bg-amber-950/15'
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
                        <div className="min-w-0 max-w-[280px] sm:max-w-[360px]">
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
                      <td className="px-4 py-3 align-top text-muted-foreground max-w-[160px]">
                        <span className="line-clamp-2">{doc.department?.trim() || '—'}</span>
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                        {urgencyLabel(doc.urgency)}
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground text-xs capitalize max-w-[120px] truncate" title={resolveUsername(doc.owner_id)}>
                        {resolveUsername(doc.owner_id)}
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground text-xs whitespace-nowrap">
                        {formatRelative(doc.updated_at)}
                      </td>
                      <td className="px-2 py-3 align-middle text-muted-foreground">
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
