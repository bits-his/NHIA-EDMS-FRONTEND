import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, SlidersHorizontal, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');

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

  const filtered = (allDocuments ?? []).filter((doc) => {
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesStatus;
  });

  const sorted = [...filtered].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  );

  const pendingCount = (allDocuments ?? []).filter((d) => d.status === 'pending').length;
  const hasFilters =
    search ||
    refFilter ||
    dateFrom ||
    dateTo ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all';

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
      {pendingCount > 0 && (
        <button
          className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left"
          onClick={() => setStatusFilter('pending')}
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
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DocumentStatus | 'all')}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setRefFilter(''); setDateFrom(''); setDateTo(''); setCategoryFilter('all'); setStatusFilter('all'); }}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Count */}
      {!isLoading && !error && (
        <p className="text-xs text-muted-foreground">
          {sorted.length} document{sorted.length !== 1 ? 's' : ''}
          {statusFilter !== 'all' && <span className="ml-1 capitalize">· {statusFilter}</span>}
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
          icon={FileText}
          title={hasFilters ? 'No matching documents' : 'No documents yet'}
          description={hasFilters ? 'Try adjusting your search or filters' : 'Create your first document to get started'}
          action={canCreateDocument(user?.roles ?? [], user?.permissions ?? []) ? { label: 'Create Document', onClick: () => navigate('/documents/new') } : undefined}
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
                        <DocumentStatusBadge status={doc.status} size="sm" />
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
