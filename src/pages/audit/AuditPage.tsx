import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { auditApi } from '@/api/audit';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS, SEEDED_USER_IDS } from '@/utils/constants';
import { KNOWN_USERS } from '@/utils/users';
import { cn } from '@/utils/cn';

type QueryMode = 'actor' | 'entity';

// Build the known-users list for the picker
const KNOWN_USER_OPTIONS = SEEDED_USER_IDS.map((id) => ({
  id,
  name: KNOWN_USERS[id] ?? id.slice(0, 8) + '…',
}));

export default function AuditPage() {
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState<QueryMode>('actor');

  // Actor mode — store the UUID internally, show username in UI
  const [actorId, setActorId] = useState(user?.user_id ?? '');

  // Entity mode
  const [entityType, setEntityType] = useState('document');
  const [entityId, setEntityId] = useState('');

  const [submitted, setSubmitted] = useState(false);

  const query = mode === 'actor'
    ? { actor_id: actorId }
    : { entity_type: entityType, entity_id: entityId };

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.auditLogs(query),
    queryFn: () => auditApi.getLogs(query),
    enabled: submitted && (mode === 'actor' ? !!actorId : !!(entityType && entityId)),
  });

  const handleSearch = () => { setSubmitted(true); refetch(); };

  // Display name for the currently selected actor
  const selectedActorName = KNOWN_USERS[actorId] ?? (actorId ? actorId.slice(0, 8) + '…' : '');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        description="Immutable, append-only record of all system actions and events"
      />

      {/* Query builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" /> Query Audit Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
            {(['actor', 'entity'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setSubmitted(false); }}
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
          </div>

          {/* ── Actor mode ── */}
          {mode === 'actor' ? (
            <div className="space-y-3">
              <Label>Select User</Label>

              {/* User picker — shows names, stores UUIDs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {KNOWN_USER_OPTIONS.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setActorId(u.id); setSubmitted(false); }}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left',
                      actorId === u.id
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border hover:border-primary/30 hover:bg-muted/40 text-foreground'
                    )}
                  >
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase',
                      actorId === u.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      {u.name.slice(0, 2)}
                    </div>
                    <span className="capitalize">{u.name}</span>
                    {u.id === user?.user_id && (
                      <span className="ml-auto text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Also allow pasting a custom UUID for users not in the seed */}
              <details className="group">
                <summary className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none">
                  <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                  Enter a custom user ID
                </summary>
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Paste user UUID…"
                    value={actorId}
                    onChange={(e) => { setActorId(e.target.value); setSubmitted(false); }}
                    className="font-mono text-xs flex-1"
                  />
                </div>
              </details>

              <Button
                onClick={handleSearch}
                disabled={!actorId}
                className="w-full sm:w-auto"
              >
                <Search className="h-4 w-4" />
                Search logs for {selectedActorName || 'selected user'}
              </Button>
            </div>

          ) : (
            /* ── Entity mode ── */
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Find all audit events for a specific document, workflow, or task by pasting its ID.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Entity Type</Label>
                  <Select value={entityType} onValueChange={setEntityType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="workflow">Workflow</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Entity ID</Label>
                  <Input
                    placeholder={`Paste ${entityType} UUID…`}
                    value={entityId}
                    onChange={(e) => { setEntityId(e.target.value); setSubmitted(false); }}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tip: copy the ID from the {entityType} detail page
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSearch}
                disabled={!entityType || !entityId}
                className="w-full sm:w-auto"
              >
                <Search className="h-4 w-4" /> Search
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {!submitted ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border mb-4">
            <Shield className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-foreground">Query the audit log</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
            Select a user to see their activity, or search by entity to trace a specific document or workflow
          </p>
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {mode === 'actor'
                  ? `Activity for ${selectedActorName}`
                  : `${entityType} audit trail`
                }
                {logs ? ` (${logs.length} entries)` : ''}
              </CardTitle>
              {logs && logs.length > 0 && (
                <span className="text-xs text-muted-foreground">Oldest → newest</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {logs?.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No audit entries found"
                description="No audit logs match your query"
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
