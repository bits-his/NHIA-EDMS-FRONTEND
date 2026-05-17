import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Award, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import type { NhiaDesignationDto } from '@/types/auth';

export default function DesignationsAdminPage() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<NhiaDesignationDto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-designations'],
    queryFn: () => authApi.getDesignations(),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!edit) return;
      return authApi.patchDesignation(String(edit.id), {
        hierarchy_order: Number(edit.hierarchy_order),
        approval_authority_level: Number(edit.approval_authority_level),
        workflow_signing_level: Number(edit.workflow_signing_level),
        escalation_level: Number(edit.escalation_level),
        delegation_allowed: edit.delegation_allowed,
        is_active: edit.is_active,
      });
    },
    onSuccess: () => {
      toast.success('Designation updated');
      qc.invalidateQueries({ queryKey: ['admin-designations'] });
      setEdit(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Designation hierarchy"
        description="Official NHIA ranks — authority levels for workflow routing. System permissions are managed separately via roles and direct grants."
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Title</th>
                  <th className="text-center px-2 py-3 font-semibold text-muted-foreground">Order</th>
                  <th className="text-center px-2 py-3 font-semibold text-muted-foreground">Approval</th>
                  <th className="text-center px-2 py-3 font-semibold text-muted-foreground">Signing</th>
                  <th className="text-center px-2 py-3 font-semibold text-muted-foreground">Delegation</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-600 shrink-0" />
                        <div>
                          <p className="font-medium">{d.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{d.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center tabular-nums">{d.hierarchy_order}</td>
                    <td className="text-center tabular-nums">{d.approval_authority_level}</td>
                    <td className="text-center tabular-nums">{d.workflow_signing_level}</td>
                    <td className="text-center">
                      <Badge variant={d.delegation_allowed ? 'default' : 'secondary'}>
                        {d.delegation_allowed ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                    <td className="text-right px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => setEdit({ ...d })}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit designation metadata</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="grid gap-3 py-2">
              <p className="text-sm font-medium">{edit.title}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hierarchy order</Label>
                  <Input
                    type="number"
                    value={edit.hierarchy_order}
                    onChange={(e) => setEdit({ ...edit, hierarchy_order: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Approval level</Label>
                  <Input
                    type="number"
                    value={edit.approval_authority_level}
                    onChange={(e) => setEdit({ ...edit, approval_authority_level: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Signing level</Label>
                  <Input
                    type="number"
                    value={edit.workflow_signing_level}
                    onChange={(e) => setEdit({ ...edit, workflow_signing_level: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Escalation level</Label>
                  <Input
                    type="number"
                    value={edit.escalation_level}
                    onChange={(e) => setEdit({ ...edit, escalation_level: Number(e.target.value) })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={edit.delegation_allowed}
                  onChange={(e) => setEdit({ ...edit, delegation_allowed: e.target.checked })}
                />
                Delegation allowed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={edit.is_active}
                  onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
