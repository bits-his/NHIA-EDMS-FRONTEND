import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, GitBranch, Shield, User } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { authApi } from '@/api/auth';
import type { Role } from '@/types/auth';
import { cn } from '@/utils/cn';

export default function UserAdminProfilePage() {
  const { userId } = useParams<{ userId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: () => authApi.getUserAdminDetail(userId!),
    enabled: !!userId,
  });

  const { data: chain } = useQuery({
    queryKey: ['admin-workflow-authority', userId],
    queryFn: () => authApi.getWorkflowAuthority(userId!),
    enabled: !!userId,
  });

  const roles = (data?.roles as Role[] | undefined) ?? [];
  const grants = (data?.permission_grants as string[] | undefined) ?? [];
  const assignments = (data?.assignments as Array<Record<string, unknown>> | undefined) ?? [];
  const authority = (chain?.supervisor_chain ?? []) as Array<{
    id: string;
    full_name?: string;
    username?: string;
    designation_title?: string;
  }>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/users" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      <PageHeader
        title={isLoading ? 'Loading…' : (data?.full_name as string) || (data?.username as string) || 'User profile'}
        description="Organizational placement, access overlays, and workflow authority chain."
      />

      {error && <p className="text-sm text-destructive">Failed to load user.</p>}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Account
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge>{String(data.account_status ?? 'unknown')}</Badge>
                {data.designation_id != null && String(data.designation_id).length > 0 ? (
                  <Badge variant="outline">Designation assigned</Badge>
                ) : null}
                {data.mfa_enabled ? <Badge variant="secondary">MFA on</Badge> : <Badge variant="outline">MFA off</Badge>}
              </div>
              <p><span className="text-muted-foreground">Email:</span> {String(data.email)}</p>
              <p><span className="text-muted-foreground">Staff ID:</span> {data.staff_id ? String(data.staff_id) : '—'}</p>
              <p><span className="text-muted-foreground">Dept / unit IDs:</span> {String(data.nhia_department_id ?? '—')} / {String(data.nhia_unit_id ?? '—')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Roles & direct grants
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex flex-wrap gap-1">
                {roles.map((r) => (
                  <Badge key={r.id} variant="secondary" className="capitalize">{r.name}</Badge>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Permission grants</p>
                <div className="flex flex-wrap gap-1">
                  {grants.length ? grants.map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                  )) : <span className="text-muted-foreground">None</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Assignments history</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2 max-h-48 overflow-y-auto">
              {assignments.length ? assignments.map((a) => (
                <div key={String(a.id)} className="border-b border-border/50 pb-2">
                  <p className="font-mono">{String(a.assignment_type)} · primary: {String(a.is_primary)}</p>
                  <p>zone {String(a.nhia_zone_id ?? '—')} · state {String(a.nhia_state_office_id ?? '—')} · dept {String(a.nhia_department_id ?? '—')}</p>
                </div>
              )) : 'No assignment rows.'}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4" /> Workflow authority (supervisor chain)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {authority.length ? authority.map((s) => (
                <div key={s.id} className="rounded-md border border-border px-2 py-1.5">
                  <p className="font-medium">{s.full_name || s.username}</p>
                  {s.designation_title && <p className="text-xs text-muted-foreground">{s.designation_title}</p>}
                </div>
              )) : <p className="text-muted-foreground">No supervisors linked.</p>}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
