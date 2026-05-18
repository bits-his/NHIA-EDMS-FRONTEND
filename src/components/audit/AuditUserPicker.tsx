import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User, X } from 'lucide-react';
import { authApi } from '@/api/auth';
import type { UserRecord } from '@/api/auth';
import { registerUsers } from '@/utils/users';
import { staffOrgLine, staffRankLabel } from '@/utils/auditDisplay';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/shared/Skeleton';

const MAX_RESULTS = 10;
const MIN_QUERY = 1;

function userLabel(u: UserRecord): string {
  const name = u.full_name?.trim();
  if (name) return name;
  return u.username;
}

function matchesQuery(u: UserRecord, q: string): boolean {
  const haystack = [
    u.full_name,
    u.username,
    u.email,
    u.staff_id,
    u.department,
    u.unit,
    u.rank,
    ...(u.roles ?? []).map((r) => r.description ?? r.name),
    u.id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

interface AuditUserPickerProps {
  value: string;
  onChange: (userId: string, user?: UserRecord) => void;
  currentUserId?: string;
  enabled?: boolean;
  className?: string;
}

export function AuditUserPicker({
  value,
  onChange,
  currentUserId,
  enabled = true,
  className,
}: AuditUserPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['audit-user-picker-users'],
    queryFn: () => authApi.listUsers(),
    enabled,
    staleTime: 120_000,
  });

  useEffect(() => {
    if (users?.length) registerUsers(users.map((u) => ({ id: u.id, username: u.username })));
  }, [users]);

  const selected = useMemo(
    () => users?.find((u) => u.id === value) ?? null,
    [users, value]
  );

  const trimmed = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!users?.length || !trimmed) return [];
    const active = users.filter((u) => u.account_status !== 'inactive');
    return active.filter((u) => matchesQuery(u, trimmed)).slice(0, MAX_RESULTS);
  }, [users, trimmed]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (u: UserRecord) => {
    onChange(u.id, u);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn('space-y-2', className)}>
      {selected ? (
        <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold uppercase">
              {userLabel(selected).slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{userLabel(selected)}</p>
              {staffRankLabel(selected) && (
                <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
                  {staffRankLabel(selected)}
                </Badge>
              )}
              {staffOrgLine(selected) && (
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{staffOrgLine(selected)}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Clear selection"
              onClick={() => onChange('', undefined)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search staff by name, username, staff ID, department…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="pl-9"
            autoComplete="off"
          />
          {open && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
              {isLoading ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : trimmed.length < MIN_QUERY ? (
                <p className="px-3 py-3 text-xs text-muted-foreground leading-relaxed">
                  Type to search — matches name, username, staff ID, department, or rank.
                </p>
              ) : suggestions.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">No staff match “{query.trim()}”.</p>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {suggestions.map((u) => {
                    const rank = staffRankLabel(u);
                    const org = staffOrgLine(u);
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/80 transition-colors border-b border-border/40 last:border-0"
                          onClick={() => pick(u)}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase mt-0.5">
                            {userLabel(u).slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{userLabel(u)}</p>
                            {rank && (
                              <p className="text-[11px] font-medium text-primary/90 mt-0.5">{rank}</p>
                            )}
                            {org && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{org}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {currentUserId && !selected && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            const me = users?.find((u) => u.id === currentUserId);
            if (me) pick(me);
          }}
          disabled={isLoading}
        >
          <User className="h-3.5 w-3.5" />
          Select me
        </Button>
      )}
    </div>
  );
}
