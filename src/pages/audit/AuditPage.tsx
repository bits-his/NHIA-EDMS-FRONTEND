import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { auditApi } from '@/api/audit';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { KNOWN_USERS } from '@/utils/users';
import { cn } from '@/utils/cn';

type QueryMode = 'actor' | 'entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MY_TRAIL_LIMIT = 500;

export default function AuditPage() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasRole = useAuthStore((s) => s.hasRole);
  const canViewGlobalAudit = hasPermission('view_audit_logs') || hasRole('admin');

  const [mode, setMode] = useState<QueryMode>('entity');
  const [actorId, setActorId] = useState('');
  const [entityType, setEntityType] = useState('document');
  const [entityId, setEntityId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (user?.user_id) setActorId((prev) => (prev.trim() === '' ? user.user_id : prev));
  }, [user?.user_id]);

  const trimmedEntityId = entityId.trim();
  const trimmedActorId = actorId.trim();
  const entityIdValid = UUID_RE.test(trimmedEntityId);
  const actorIdValid = UUID_RE.test(trimmedActorId);

  const searchQuery = useMemo(() => {
    if (mode === 'actor') return { actor_id: trimmedActorId, limit: MY_TRAIL_LIMIT };
    return { entity_type: entityType, entity_id: trimmedEntityId };
  }, [mode, entityType, trimmedActorId, trimmedEntityId]);

  const searchEnabled =
    submitted &&
    (mode === 'actor' ? actorIdValid : !!(entityType && entityIdValid));

  const { data: recentLogs, isLoading: recentLoading } = useQuery({
    queryKey: QUERY_KEYS.auditLogsRecent(80),
    queryFn: () => auditApi.getRecentLogs(80),
    enabled: canViewGlobalAudit,
    staleTime: 30_000,
  });

  const { data: myTrail, isLoading: myTrailLoading, error: myTrailError, refetch: refetchMyTrail } = useQuery({
    queryKey: QUERY_KEYS.auditLogsMyTrail(user?.user_id ?? '', MY_TRAIL_LIMIT),
    queryFn: () =>
      auditApi.getLogs({
        actor_id: user!.user_id,
        limit: MY_TRAIL_LIMIT,
      }),
    enabled: Boolean(user?.user_id),
    staleTime: 30_000,
  });

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.auditLogs(searchQuery),
    queryFn: () => auditApi.getLogs(searchQuery),
    enabled: searchEnabled,
  });

  const handleSearch = () => {
    setSubmitted(true);
  };

  const selectedActorName = KNOWN_USERS[trimmedActorId] ?? (trimmedActorId ? trimmedActorId.slice(0, 8) + '…' : '');

  const KNOWN_USER_OPTIONS = useMemo(() => {
    const ids = Object.keys(KNOWN_USERS);
    return ids.map((id) => ({ id, name: KNOWN_USERS[id] ?? id.slice(0, 8) + '…' }));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        description="Chronological record of who did what and when: opening documents (view), saving changes (edit), workflow steps (submit, approve, reject, archive), tasks, and sign-ins — with exact timestamps."
      />

      {canViewGlobalAudit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Recent system activity
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Newest first · up to 80 events across all users (requires admin or view audit logs permission)
            </p>
          </CardHeader>
          <CardContent>
            <AuditTimeline logs={recentLogs ?? []} loading={recentLoading} compact />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Your audit trail
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Actions recorded under your account, newest first (up to {MY_TRAIL_LIMIT} entries).
          </p>
        </CardHeader>
        <CardContent>
          {myTrailError ? (
            <ErrorState error={myTrailError} onRetry={() => void refetchMyTrail()} title="Could not load your trail" />
          ) : (
            <AuditTimeline logs={myTrail ?? []} loading={myTrailLoading} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" /> Search audit logs
          </CardTitle>
          {!canViewGlobalAudit && (
            <p className="text-xs text-muted-foreground font-normal pt-1">
              You can search by document, workflow instance, or workflow task you are allowed to see. Searching
              another user&apos;s activity is restricted to administrators and audit officers.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
            {canViewGlobalAudit &&
              (['actor', 'entity'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setSubmitted(false);
                  }}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize',
                    mode === m
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  By {m}
                </button>
              ))}
            {!canViewGlobalAudit && (
              <span className="px-4 py-1.5 text-sm font-medium text-foreground">By entity</span>
            )}
          </div>

          {mode === 'actor' && canViewGlobalAudit ? (
            <div className="space-y-3">
              <Label>Select user</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {KNOWN_USER_OPTIONS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setActorId(u.id);
                      setSubmitted(false);
                    }}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left',
                      trimmedActorId === u.id
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border hover:border-primary/30 hover:bg-muted/40 text-foreground'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase',
                        trimmedActorId === u.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {u.name.slice(0, 2)}
                    </div>
                    <span className="capitalize">{u.name}</span>
                    {u.id === user?.user_id && (
                      <span className="ml-auto text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </button>
                ))}
              </div>

              <details className="group">
                <summary className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none">
                  <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                  Enter a custom user ID
                </summary>
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Paste user UUID…"
                    value={actorId}
                    onChange={(e) => {
                      setActorId(e.target.value);
                      setSubmitted(false);
                    }}
                    className="font-mono text-xs flex-1"
                  />
                </div>
              </details>

              <Button onClick={handleSearch} disabled={!trimmedActorId} className="w-full sm:w-auto">
                <Search className="h-4 w-4" />
                Search logs for {selectedActorName || 'selected user'}
              </Button>
              {submitted && mode === 'actor' && !actorIdValid && (
                <p className="text-xs text-destructive">Enter a valid user UUID to search.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Find events linked to a document, workflow instance, or workflow task you can access.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Entity type</Label>
                  <Select value={entityType} onValueChange={setEntityType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="workflow_task">Workflow task</SelectItem>
                      <SelectItem value="workflow_instance">Workflow instance</SelectItem>
                      <SelectItem value="user">User (your account only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Entity ID</Label>
                  <Input
                    placeholder={`Paste ${entityType} UUID…`}
                    value={entityId}
                    onChange={(e) => {
                      setEntityId(e.target.value);
                      setSubmitted(false);
                    }}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tip: copy the ID from the document or task screen.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSearch}
                disabled={!entityType || !trimmedEntityId}
                className="w-full sm:w-auto"
              >
                <Search className="h-4 w-4" /> Search
              </Button>
              {submitted && mode === 'entity' && trimmedEntityId && !entityIdValid && (
                <p className="text-xs text-destructive">Enter a valid UUID for the entity ID.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {submitted && !searchEnabled && (
        <div className="flex flex-col items-center py-10 text-center text-muted-foreground text-sm">
          Fix the fields above, then search again.
        </div>
      )}

      {submitted && searchEnabled && error && (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load audit results" />
      )}

      {submitted && searchEnabled && !error && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">
                {mode === 'actor'
                  ? `Activity for ${selectedActorName}`
                  : `${entityType} audit trail`}
                {logs ? ` (${logs.length} entries)` : ''}
              </CardTitle>
              {logs && logs.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {mode === 'actor' ? 'Newest first' : 'Oldest → newest'}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {logs?.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No audit entries found"
                description="No audit logs match this query."
              />
            ) : (
              <AuditTimeline logs={logs ?? []} loading={isLoading} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
