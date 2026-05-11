import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarRange, Ban } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';

type DelegationRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  role_id: string;
  valid_from: string;
  valid_to: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

export default function DelegationsAdminPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-delegations'],
    queryFn: () => authApi.listDelegations() as Promise<DelegationRow[]>,
    staleTime: 30_000,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => authApi.revokeDelegation(id),
    onSuccess: () => {
      toast.success('Delegation revoked');
      qc.invalidateQueries({ queryKey: ['admin-delegations'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delegations"
        description="Temporary approval authority transfers. Revoked delegations remain in the history with status revoked."
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !(data ?? []).length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No delegations found.</p>
          ) : (
            <div className="divide-y divide-border">
              {(data ?? []).map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <CalendarRange className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium font-mono text-xs">#{d.id.slice(0, 8)}…</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        From <span className="font-mono">{d.from_user_id.slice(0, 8)}</span>
                        {' → '}
                        <span className="font-mono">{d.to_user_id.slice(0, 8)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(d.valid_from).toLocaleDateString()} — {new Date(d.valid_to).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={d.status === 'active' ? 'default' : 'secondary'}>{d.status}</Badge>
                    {d.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        loading={revoke.isPending}
                        onClick={() => revoke.mutate(d.id)}
                      >
                        <Ban className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
