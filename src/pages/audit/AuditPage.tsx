import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Search, Filter, UserRound, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { AuditUserPicker } from '@/components/audit/AuditUserPicker';
import { AuditDocumentPicker } from '@/components/audit/AuditDocumentPicker';
import { auditApi } from '@/api/audit';
import type { UserRecord } from '@/api/auth';
import type { Document } from '@/types/document';
import type { AuditLog } from '@/types/audit';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { Badge } from '@/components/ui/badge';
import {
  AUDIT_ACTION_FILTER_OPTIONS,
  dedupeCommentAuditRows,
  filterAuditLogs,
  type AuditActionFilter,
} from '@/utils/auditTable';

const FEED_LIMIT = 200;
type DataSource = 'organisation' | 'mine' | 'staff' | 'document';

export default function AuditPage() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasRole = useAuthStore((s) => s.hasRole);
  const canViewGlobalAudit = hasPermission('view_audit_logs') || hasRole('admin');

  const [source, setSource] = useState<DataSource>(canViewGlobalAudit ? 'organisation' : 'mine');
  const [actorId, setActorId] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<UserRecord | null>(null);
  const [documentId, setDocumentId] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const [textFilter, setTextFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditActionFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const trimmedActorId = actorId.trim();
  const trimmedDocumentId = documentId.trim();

  const {
    data: orgLogs,
    isLoading: orgLoading,
    error: orgError,
    refetch: refetchOrg,
  } = useQuery({
    queryKey: QUERY_KEYS.auditLogsRecent(FEED_LIMIT),
    queryFn: () => auditApi.getRecentLogs(FEED_LIMIT),
    enabled: canViewGlobalAudit,
    staleTime: 30_000,
  });

  const {
    data: myTrail,
    isLoading: myLoading,
    error: myError,
    refetch: refetchMine,
  } = useQuery({
    queryKey: QUERY_KEYS.auditLogsMyTrail(user?.user_id ?? '', FEED_LIMIT),
    queryFn: () =>
      auditApi.getLogs({
        actor_id: user!.user_id,
        limit: FEED_LIMIT,
      }),
    enabled: Boolean(user?.user_id),
    staleTime: 30_000,
  });

  const {
    data: staffLogs,
    isLoading: staffLoading,
    error: staffError,
    refetch: refetchStaff,
  } = useQuery({
    queryKey: QUERY_KEYS.auditLogs({ actor_id: trimmedActorId, limit: FEED_LIMIT }),
    queryFn: () => auditApi.getLogs({ actor_id: trimmedActorId, limit: FEED_LIMIT }),
    enabled: source === 'staff' && Boolean(trimmedActorId) && canViewGlobalAudit,
  });

  const {
    data: documentLogs,
    isLoading: documentLoading,
    error: documentError,
    refetch: refetchDocument,
  } = useQuery({
    queryKey: QUERY_KEYS.auditLogsForDocument(trimmedDocumentId),
    queryFn: () => auditApi.getLogsForDocument(trimmedDocumentId),
    enabled: source === 'document' && Boolean(trimmedDocumentId),
  });

  const activeLogs: AuditLog[] = useMemo(() => {
    if (source === 'organisation') return orgLogs ?? [];
    if (source === 'mine') return myTrail ?? [];
    if (source === 'staff') return staffLogs ?? [];
    return documentLogs ?? [];
  }, [source, orgLogs, myTrail, staffLogs, documentLogs]);

  const displayLogs = useMemo(() => dedupeCommentAuditRows(activeLogs), [activeLogs]);

  const filteredLogs = useMemo(
    () =>
      filterAuditLogs(displayLogs, {
        text: textFilter,
        actionFilter,
        dateFrom,
        dateTo,
      }),
    [displayLogs, textFilter, actionFilter, dateFrom, dateTo]
  );

  const loading =
    (source === 'organisation' && orgLoading) ||
    (source === 'mine' && myLoading) ||
    (source === 'staff' && staffLoading) ||
    (source === 'document' && documentLoading);

  const error =
    (source === 'organisation' && orgError) ||
    (source === 'mine' && myError) ||
    (source === 'staff' && staffError) ||
    (source === 'document' && documentError);

  const refetchActive = () => {
    if (source === 'organisation') void refetchOrg();
    else if (source === 'mine') void refetchMine();
    else if (source === 'staff') void refetchStaff();
    else void refetchDocument();
  };

  const sourceLabel =
    source === 'organisation'
      ? 'Organisation feed'
      : source === 'mine'
        ? 'Your activity'
        : source === 'staff'
          ? selectedStaff?.full_name?.trim() || selectedStaff?.username || 'Staff member'
          : selectedDoc?.title || 'Document';

  const needsStaffPick = source === 'staff' && !trimmedActorId;
  const needsDocPick = source === 'document' && !trimmedDocumentId;

  return (
    <div className="space-y-6">
      <PageHeader
        title=""
        actions={
          <Button variant="outline" size="sm" onClick={refetchActive} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search & filters
            </CardTitle>
            <Badge variant="outline" className="font-normal">
              {filteredLogs.length} of {displayLogs.length} shown
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-0.5">
            <div className="min-w-[12rem] ml-1 flex-[2] space-y-1.5">
              <Label htmlFor="audit-text">Search</Label>
              <Input
                id="audit-text"
                placeholder="Name, department, document title, reference, comment text…"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
              />
            </div>
            <div className="w-[9.5rem] shrink-0 space-y-1.5">
              <Label>Action type</Label>
              <Select
                value={actionFilter}
                onValueChange={(v) => setActionFilter(v as AuditActionFilter)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_ACTION_FILTER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[9.5rem] shrink-0 space-y-1.5">
              <Label htmlFor="date-from">From date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="w-[9.5rem] shrink-0 space-y-1.5">
              <Label htmlFor="date-to">To date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          {(textFilter || actionFilter !== 'all' || dateFrom || dateTo) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setTextFilter('');
                setActionFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 border-b border-border/60">
          <CardTitle className="text-base">{sourceLabel}</CardTitle>
          <p className="text-xs text-muted-foreground font-normal mt-1">
            Click a row or the eye icon to view full details.
          </p>
        </CardHeader>
        <CardContent className="p-0 sm:p-0 pt-0">
          {error ? (
            <div className="p-6">
              <ErrorState error={error} onRetry={refetchActive} title="Could not load audit log" />
            </div>
          ) : needsStaffPick ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Select a staff member above to load their activity.
            </p>
          ) : needsDocPick ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Search and select a document above to load its history.
            </p>
          ) : (
            <AuditLogTable
              logs={filteredLogs}
              loading={loading}
              emptyTitle="No matching activity"
              emptyDescription="Try clearing filters or choosing another data source."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
