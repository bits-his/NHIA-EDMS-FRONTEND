import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import ExecutiveReportPage from '@/pages/dashboard/ExecutiveReportPage';
import { Archive, FileBarChart, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { documentsApi } from '@/api/documents';
import { authApi } from '@/api/auth';
import { QUERY_KEYS } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { registerUsers, resolveUsername } from '@/utils/users';
import { documentTypeHeadline } from '@/utils/documentDisplay';
import type { Document, DocumentStatus } from '@/types/document';
import type { RegistrySearchFilters } from '@/types/registry';
import { canViewOperationalOverview, canViewReportsNav } from '@/utils/permissions';
import { useAuthStore } from '@/stores/authStore';
import { OperationalReportingHubPanel } from '@/components/reporting/OperationalReportingHubPanel';

export type RegistryMode = 'archive' | 'reports';

const REPORT_CATEGORY_LABELS: Record<string, string> = {
  management_report: 'Management report',
  performance_dashboard: 'Performance dashboard',
  audit_report: 'Audit report',
  compliance_report: 'Compliance report',
  operational_report: 'Operational report',
};

function categoryLabel(category: string | null | undefined): string {
  if (!category) return '—';
  return REPORT_CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ');
}

type RegistryDocumentsPageProps = {
  mode: RegistryMode;
  /** When true, omit page title (used inside Reports tabbed layout). */
  embedded?: boolean;
};

export function RegistryDocumentsPage({ mode, embedded = false }: RegistryDocumentsPageProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters = useMemo((): RegistrySearchFilters => {
    const f: RegistrySearchFilters = {};
    if (search.trim()) f.keyword = search.trim();
    if (dateFrom.trim()) f.date_from = `${dateFrom.trim()}T00:00:00.000Z`;
    if (dateTo.trim()) f.date_to = `${dateTo.trim()}T23:59:59.999Z`;
    return f;
  }, [search, dateFrom, dateTo]);

  const queryKey =
    mode === 'archive'
      ? QUERY_KEYS.archiveRegistry(filters)
      : QUERY_KEYS.reportsRegistry(filters);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      mode === 'archive'
        ? documentsApi.listArchiveRegistry(filters)
        : documentsApi.listReportsRegistry(filters),
    staleTime: 30_000,
  });

  const { data: directoryUsers = [] } = useQuery({
    queryKey: ['auth', 'users', 'directory'],
    queryFn: () => authApi.listUsers(),
    staleTime: 60_000,
    retry: false,
  });

  const ownerById = useMemo(() => {
    registerUsers(directoryUsers);
    const m = new Map<string, string>();
    for (const u of directoryUsers) {
      const label = u.full_name?.trim() || u.username;
      if (label) m.set(u.id, label);
    }
    return m;
  }, [directoryUsers]);

  const documents = data?.documents ?? [];
  const orgWide = canViewOperationalOverview(user?.roles ?? [], user?.permissions ?? []);
  const isArchive = mode === 'archive';

  const title = isArchive ? 'Document archive' : 'Reports';
  const description = isArchive
    ? orgWide
      ? 'Organisation-wide registry of filed and archived documents.'
      : 'Documents you initiated that have been filed to the organisation archive.'
    : orgWide
      ? 'Management and operational reports across the organisation.'
      : 'Management and operational reports you submitted.';

  const Icon = isArchive ? Archive : FileBarChart;
  const hasFilters = Boolean(search.trim() || dateFrom || dateTo);

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-6 max-w-[1400px]'}>
      {!embedded && <PageHeader title={title} description={description} />}

      {data?.label && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            {data.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {documents.length} document{documents.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">Search registry</span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setSearch('');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                <X className="h-3.5 w-3.5" /> Reset
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Keyword
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Title or reference…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                From
              </label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                To
              </label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Card className="overflow-hidden border-border/70">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={orgWide ? 6 : 5} />
              ))}
            </tbody>
          </table>
        </Card>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={hasFilters ? 'No matching records' : isArchive ? 'No archived documents' : 'No reports yet'}
          description={
            hasFilters
              ? 'Try different search terms or dates.'
              : isArchive
                ? orgWide
                  ? 'Archived documents will appear here once staff file approved memos.'
                  : 'Documents you archive after approval will appear here.'
                : orgWide
                  ? 'Submitted management and operational reports will appear here.'
                  : 'Reports you create and submit will appear here.'
          }
        />
      ) : (
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Document
                  </th>
                  {!isArchive && (
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[160px]">
                      Report type
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[120px]">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[140px]">
                    Reference
                  </th>
                  {orgWide && (
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[160px]">
                      Owner
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[140px]">
                    {isArchive ? 'Archived' : 'Updated'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <RegistryRow
                    key={doc.id}
                    doc={doc}
                    mode={mode}
                    orgWide={orgWide}
                    ownerLabel={
                      doc.owner_id
                        ? ownerById.get(doc.owner_id) ?? resolveUsername(doc.owner_id)
                        : '—'
                    }
                    onOpen={() => navigate(`/documents/${doc.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function RegistryRow({
  doc,
  mode,
  orgWide,
  ownerLabel,
  onOpen,
}: {
  doc: Document;
  mode: RegistryMode;
  orgWide: boolean;
  ownerLabel: string;
  onOpen: () => void;
}) {
  const dateLabel = mode === 'archive' && doc.archived_at
    ? formatDateTime(doc.archived_at)
    : formatRelative(doc.updated_at);

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="border-b border-border/60 hover:bg-muted/30 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <p className="font-medium truncate max-w-md">{doc.title || 'Untitled'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{documentTypeHeadline(doc)}</p>
      </td>
      {mode === 'reports' && (
        <td className="px-4 py-3 text-muted-foreground text-xs">{categoryLabel(doc.category)}</td>
      )}
      <td className="px-4 py-3">
        <DocumentStatusBadge status={doc.status as DocumentStatus} statusLabel={doc.status_label} size="sm" />
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{doc.ref_number ?? '—'}</td>
      {orgWide && <td className="px-4 py-3 text-sm text-muted-foreground">{ownerLabel}</td>}
      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{dateLabel}</td>
    </tr>
  );
}

export default function ArchivePage() {
  return <RegistryDocumentsPage mode="archive" />;
}

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  if (!canViewReportsNav(user?.roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  const orgWide = canViewOperationalOverview(user?.roles ?? [], user?.permissions ?? []);

  if (searchParams.get('kind')) {
    return <ExecutiveReportPage backHref="/reports" backLabel="Back to reports" />;
  }

  return (
    <div className="space-y-4 max-w-[1600px]">
      <PageHeader
        title="Reports"
        description={
          orgWide
            ? 'Operational intelligence and analytics for your scope.'
            : 'Your workflow and reporting insights for the selected period.'
        }
      />
      <OperationalReportingHubPanel />
    </div>
  );
}
