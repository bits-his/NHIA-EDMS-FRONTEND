import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Users, Shield, Key, Plus, Trash2, RefreshCw,
  UserPlus, Edit, CheckSquare, Activity, X, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { authApi } from '@/api/auth';
import { tasksApi } from '@/api/tasks';
import { QUERY_KEYS, SEEDED_USER_IDS } from '@/utils/constants';
import { cn } from '@/utils/cn';
import { getErrorMessage } from '@/api/client';
import type { Role } from '@/types/auth';
import type { UserRecord } from '@/api/auth';

const ROLE_COLORS: Record<string, string> = {
  admin:     'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:ring-violet-800',
  reviewer:  'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
  submitter: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
};

const PERM_COLORS: Record<string, string> = {
  read:    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  write:   'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  approve: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  reject:  'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  delete:  'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
};

const ALL_PERMISSIONS = ['read', 'write', 'approve', 'reject', 'delete'];

// ── Schemas ──────────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  username: z.string().min(2, 'At least 2 characters').max(50),
  email:    z.string().email('Valid email required'),
  password: z.string().min(6, 'At least 6 characters'),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'At least 6 characters'),
  confirm:  z.string().min(6),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

const createRoleSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(50).regex(/^[a-z_]+$/, 'Lowercase letters and underscores only'),
});

type CreateUserForm    = z.infer<typeof createUserSchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
type CreateRoleForm    = z.infer<typeof createRoleSchema>;

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [createUserOpen,    setCreateUserOpen]    = useState(false);
  const [createRoleOpen,    setCreateRoleOpen]     = useState(false);
  const [resetPwUser,       setResetPwUser]        = useState<UserRecord | null>(null);
  const [deactivateUser,    setDeactivateUser]     = useState<UserRecord | null>(null);
  const [manageRolesUser,   setManageRolesUser]    = useState<UserRecord | null>(null);

  // ── Queries ──
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authApi.listUsers(),
    staleTime: 30_000,
  });

  // Sync newly fetched users into the runtime username cache
  useEffect(() => {
    if (users?.length) {
      import('@/utils/users').then(({ registerUsers }) => {
        registerUsers(users.map((u) => ({ id: u.id, username: u.username })));
      });
    }
  }, [users]);

  const { data: allRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => authApi.listRoles(),
    staleTime: 60_000,
  });

  // Task counts per user
  const { data: taskMap } = useQuery({
    queryKey: ['admin-task-counts'],
    queryFn: async () => {
      const ids = (users ?? []).map((u) => u.id);
      const results = await Promise.allSettled(ids.map((id) => tasksApi.list(id)));
      const map: Record<string, number> = {};
      ids.forEach((id, i) => {
        const r = results[i];
        map[id] = r.status === 'fulfilled' ? r.value.filter((t) => t.status === 'pending' || t.status === 'in_progress').length : 0;
      });
      return map;
    },
    enabled: !!users?.length,
    staleTime: 30_000,
  });

  // ── Mutations ──
  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => authApi.deactivateUser(userId),
    onSuccess: (_, userId) => {
      toast.success('User deactivated');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setDeactivateUser(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const isLoading = usersLoading || rolesLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Create and manage users, roles, and permissions"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateRoleOpen(true)}>
              <Shield className="h-4 w-4" /> New Role
            </Button>
            <Button size="sm" onClick={() => setCreateUserOpen(true)}>
              <UserPlus className="h-4 w-4" /> New User
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users',  value: users?.length ?? 0,    icon: Users,  color: 'text-primary',                         bg: 'bg-primary/10' },
          { label: 'Total Roles',  value: allRoles?.length ?? 0, icon: Shield, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
          { label: 'Permissions',  value: ALL_PERMISSIONS.length, icon: Key,   color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg mb-3', s.bg)}>
              <s.icon className={cn('h-4 w-4', s.color)} />
            </div>
            <p className="text-2xl font-bold tabular-nums">{isLoading ? '—' : s.value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Users</h2>
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !users?.length ? (
              <EmptyState icon={Users} title="No users found" description="Create the first user to get started" />
            ) : (
              <div className="divide-y divide-border">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold uppercase">
                        {u.username.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold capitalize">{u.username}</p>
                          {u.roles.map((r) => (
                            <span key={r.id} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize', ROLE_COLORS[r.name] ?? 'bg-muted text-muted-foreground')}>
                              {r.name}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(taskMap?.[u.id] ?? 0) > 0 && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                          {taskMap![u.id]} active tasks
                        </span>
                      )}
                      <Button variant="ghost" size="icon-sm" title="Manage roles" onClick={() => setManageRolesUser(u)}>
                        <Shield className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Reset password" onClick={() => setResetPwUser(u)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="View audit logs" onClick={() => navigate('/audit')}>
                        <Activity className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Deactivate user"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeactivateUser(u)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Roles table */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Roles & Permissions</h2>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {rolesLoading ? (
              <div className="p-5 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
                    {ALL_PERMISSIONS.map((p) => (
                      <th key={p} className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide capitalize">{p}</th>
                    ))}
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned to</th>
                  </tr>
                </thead>
                <tbody>
                  {(allRoles ?? []).map((role, idx) => {
                    const assignedUsers = (users ?? []).filter((u) => u.roles.some((r) => r.id === role.id));
                    return (
                      <tr key={role.id} className={cn('border-b border-border/50 last:border-0', idx % 2 !== 0 && 'bg-muted/20')}>
                        <td className="px-5 py-3.5">
                          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', ROLE_COLORS[role.name] ?? 'bg-muted text-muted-foreground')}>
                            {role.name}
                          </span>
                        </td>
                        {ALL_PERMISSIONS.map((p) => (
                          <td key={p} className="text-center px-4 py-3.5">
                            {role.permissions.includes(p) ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold mx-auto">✓</span>
                            ) : (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground/40 text-xs mx-auto">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-5 py-3.5">
                          <div className="flex gap-1.5 flex-wrap">
                            {assignedUsers.length > 0
                              ? assignedUsers.map((u) => (
                                  <span key={u.id} className="text-xs font-medium bg-muted px-2 py-0.5 rounded-full capitalize">{u.username}</span>
                                ))
                              : <span className="text-xs text-muted-foreground">Unassigned</span>
                            }
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialogs ── */}
      <CreateUserDialog
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
      />
      <CreateRoleDialog
        open={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-roles'] })}
      />
      {resetPwUser && (
        <ResetPasswordDialog
          user={resetPwUser}
          onClose={() => setResetPwUser(null)}
        />
      )}
      {manageRolesUser && (
        <ManageRolesDialog
          user={manageRolesUser}
          allRoles={allRoles ?? []}
          onClose={() => setManageRolesUser(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
        />
      )}
      <ConfirmDialog
        open={!!deactivateUser}
        onOpenChange={(o) => !o && setDeactivateUser(null)}
        title={`Deactivate ${deactivateUser?.username}?`}
        description="This will permanently remove the user and all their role assignments. This action cannot be undone."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={() => deactivateUser && deactivateMutation.mutate(deactivateUser.id)}
        loading={deactivateMutation.isPending}
      />
    </div>
  );
}

// ── Create User Dialog ────────────────────────────────────────────────────────
function CreateUserDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateUserForm) => authApi.createUser(data),
    onSuccess: () => {
      toast.success('User created successfully');
      onSuccess();
      onClose();
      reset();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Create New User</DialogTitle>
          <DialogDescription>Add a new user to the system. They can log in immediately with the provided credentials.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cu-username">Username</Label>
            <Input id="cu-username" placeholder="e.g. john" error={!!errors.username} {...register('username')} />
            {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-email">Email</Label>
            <Input id="cu-email" type="email" placeholder="john@example.com" error={!!errors.email} {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Password</Label>
            <Input id="cu-password" type="password" placeholder="Min. 6 characters" error={!!errors.password} {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}><UserPlus className="h-4 w-4" /> Create User</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset Password Dialog ─────────────────────────────────────────────────────
function ResetPasswordDialog({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ResetPasswordForm) => authApi.resetPassword(user.id, data.password),
    onSuccess: () => {
      toast.success(`Password reset for ${user.username}`);
      onClose();
      reset();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Reset Password</DialogTitle>
          <DialogDescription>Set a new password for <strong className="capitalize">{user.username}</strong>.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-password">New Password</Label>
            <Input id="rp-password" type="password" placeholder="Min. 6 characters" error={!!errors.password} {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm">Confirm Password</Label>
            <Input id="rp-confirm" type="password" placeholder="Repeat password" error={!!errors.confirm} {...register('confirm')} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}><RefreshCw className="h-4 w-4" /> Reset Password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Manage Roles Dialog ───────────────────────────────────────────────────────
function ManageRolesDialog({ user, allRoles, onClose, onSuccess }: {
  user: UserRecord; allRoles: Role[]; onClose: () => void; onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const currentRoleIds = new Set(user.roles.map((r) => r.id));

  const assignMutation = useMutation({
    mutationFn: (roleId: string) => authApi.assignRole(user.id, roleId),
    onSuccess: () => { toast.success('Role assigned'); onSuccess(); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const removeMutation = useMutation({
    mutationFn: (roleId: string) => authApi.removeRole(user.id, roleId),
    onSuccess: () => { toast.success('Role removed'); onSuccess(); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const isPending = assignMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Manage Roles</DialogTitle>
          <DialogDescription>Toggle roles for <strong className="capitalize">{user.username}</strong>. Changes take effect immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {allRoles.map((role) => {
            const assigned = currentRoleIds.has(role.id);
            return (
              <div key={role.id} className={cn(
                'flex items-center justify-between p-3.5 rounded-xl border transition-all',
                assigned ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-muted/30'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    assigned ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <Shield className={cn('h-4 w-4', assigned ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className={cn('text-sm font-semibold capitalize', assigned && 'text-primary')}>{role.name}</p>
                    <p className="text-xs text-muted-foreground">{role.permissions.join(', ') || 'No permissions'}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={assigned ? 'destructive' : 'default'}
                  loading={isPending}
                  onClick={() => assigned ? removeMutation.mutate(role.id) : assignMutation.mutate(role.id)}
                >
                  {assigned ? <><X className="h-3.5 w-3.5" /> Remove</> : <><Check className="h-3.5 w-3.5" /> Assign</>}
                </Button>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Role Dialog ────────────────────────────────────────────────────────
function CreateRoleDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateRoleForm>({
    resolver: zodResolver(createRoleSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateRoleForm) => authApi.createRole({ name: data.name, permissions: selectedPerms }),
    onSuccess: () => {
      toast.success('Role created successfully');
      onSuccess();
      onClose();
      reset();
      setSelectedPerms([]);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const togglePerm = (p: string) =>
    setSelectedPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Create New Role</DialogTitle>
          <DialogDescription>Define a new role with a name and set of permissions.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cr-name">Role Name</Label>
            <Input id="cr-name" placeholder="e.g. auditor" error={!!errors.name} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            <p className="text-xs text-muted-foreground">Lowercase letters and underscores only</p>
          </div>
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map((p) => {
                const active = selectedPerms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePerm(p)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all capitalize',
                      active ? 'border-primary bg-primary/8 text-primary' : 'border-border hover:border-primary/30 text-muted-foreground'
                    )}
                  >
                    <div className={cn('h-4 w-4 rounded border-2 flex items-center justify-center shrink-0', active ? 'border-primary bg-primary' : 'border-muted-foreground/40')}>
                      {active && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}><Plus className="h-4 w-4" /> Create Role</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
