import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserRecord } from '@/api/auth';
import type { Role } from '@/types/auth';
import type { CreateRecipientInput, RecipientType } from '@/types/document';
import {
  buildRankFilterOptions,
  recipientUserLabel,
  userMatchesRankFilter,
} from '@/utils/recipientPicker';

const TYPE_LABEL: Record<RecipientType, string> = {
  to: 'To',
  cc: 'CC',
  bcc: 'BCC',
};

interface DocumentRecipientTagsEditorProps {
  users: UserRecord[];
  roles?: Role[];
  currentUserId?: string;
  value: CreateRecipientInput[];
  onChange: (next: CreateRecipientInput[]) => void;
  disabled?: boolean;
}

export function DocumentRecipientTagsEditor({
  users,
  roles,
  currentUserId,
  value,
  onChange,
  disabled = false,
}: DocumentRecipientTagsEditorProps) {
  const [pickRank, setPickRank] = useState('');
  const [pickUserId, setPickUserId] = useState('');
  const [pickType, setPickType] = useState<RecipientType>('to');

  const candidateUsers = useMemo(
    () => users.filter((u) => u.id !== currentUserId),
    [users, currentUserId]
  );

  const rankFilterOptions = useMemo(
    () => buildRankFilterOptions(candidateUsers, roles),
    [candidateUsers, roles]
  );

  const filteredUsers = useMemo(() => {
    if (!pickRank.trim()) return candidateUsers;
    return candidateUsers.filter((u) => userMatchesRankFilter(u, pickRank, roles));
  }, [candidateUsers, pickRank, roles]);

  const taggedIds = useMemo(() => new Set(value.map((r) => r.user_id)), [value]);

  const addRecipient = () => {
    if (!pickUserId.trim() || taggedIds.has(pickUserId)) return;
    onChange([...value, { user_id: pickUserId.trim(), recipient_type: pickType }]);
    setPickUserId('');
  };

  const removeRecipient = (userId: string) => {
    onChange(value.filter((r) => r.user_id !== userId));
  };

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const grouped = useMemo(() => {
    const order: RecipientType[] = ['to', 'cc', 'bcc'];
    return order
      .map((type) => ({
        type,
        rows: value.filter((r) => r.recipient_type === type),
      }))
      .filter((g) => g.rows.length > 0);
  }, [value]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs text-muted-foreground">Rank / role (optional filter)</Label>
          <Select
            value={pickRank.trim() || '__none__'}
            onValueChange={(v) => {
              setPickRank(v === '__none__' ? '' : v);
              setPickUserId('');
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any rank" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Any rank / role</SelectItem>
              {rankFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">User</Label>
          <Select
            value={pickUserId || '__none__'}
            onValueChange={(v) => setPickUserId(v === '__none__' ? '' : v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select staff member" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__none__">Select user</SelectItem>
              {filteredUsers
                .filter((u) => !taggedIds.has(u.id))
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {recipientUserLabel(u, roles)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tag as</Label>
          <Select
            value={pickType}
            onValueChange={(v) => setPickType(v as RecipientType)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="to">To</SelectItem>
              <SelectItem value="cc">CC</SelectItem>
              <SelectItem value="bcc">BCC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            disabled={disabled || !pickUserId.trim()}
            onClick={addRecipient}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No recipients tagged yet.</p>
      ) : (
        <div className="space-y-3 rounded-lg border border-border/70 bg-background px-3 py-3">
          {grouped.map(({ type, rows }) => (
            <div key={type} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {TYPE_LABEL[type]}
              </p>
              <ul className="flex flex-wrap gap-2">
                {rows.map((r) => {
                  const profile = userById.get(r.user_id);
                  const label = profile
                    ? recipientUserLabel(profile, roles)
                    : r.user_id.slice(0, 8);
                  return (
                    <li key={`${type}-${r.user_id}`}>
                      <Badge
                        variant="secondary"
                        className="gap-1 pr-1 font-normal max-w-full"
                      >
                        <span className="truncate max-w-[240px] capitalize">{label}</span>
                        <button
                          type="button"
                          className="rounded-sm p-0.5 hover:bg-muted disabled:opacity-50"
                          disabled={disabled}
                          aria-label={`Remove ${label}`}
                          onClick={() => removeRecipient(r.user_id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
