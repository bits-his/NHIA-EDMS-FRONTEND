import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Users, Shield, Key, Plus, Trash2, RefreshCw,
  UserPlus, Edit, CheckSquare, Activity, X, Check, Eye, Search,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { authApi } from '@/api/auth';
import { documentsApi } from '@/api/documents';
import { QUERY_KEYS, SEEDED_USER_IDS } from '@/utils/constants';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/formatters';
import { getErrorMessage } from '@/api/client';
import type { Role } from '@/types/auth';
import type { UserRecord } from '@/api/auth';
import type { OrgScopeReferenceResponse } from '@/types/orgScope';
import { useAuthStore } from '@/stores/authStore';

const ROLE_COLORS: Record<string, string> = {
  admin:     'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:ring-violet-800',
  reviewer:  'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
  submitter: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
};

/** Human label: matches `roles.description` from auth API (same titles as Create User rank). */
function roleDisplayLabel(role: Pick<Role, 'name' | 'description'>): string {
  const d = role.description?.trim();
  if (d) return d;
  return role.name.replace(/_/g, ' ');
}

/** Grade ladder roles only — `level` set in migration 006; ordered high → low like the rank picker. */
function gradeRolesSorted(all: Role[] | undefined): Role[] {
  if (!all?.length) return [];
  return [...all]
    .filter((r) => r.level != null && typeof r.level === 'number')
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
}

/** Canonical permission keys (aligned with backend `permissions` table / JWT claims). */
const ALL_PERMISSIONS = [
  'view_document',
  'create_document',
  'edit_document',
  'submit_document',
  'approve_document',
  'reject_document',
  'sign_document',
  'archive_document',
  'delegate_approval',
  'view_audit_logs',
  'manage_users',
  'manage_roles',
] as const;

const LEGACY_TO_CANON: Record<string, string> = {
  read: 'view_document',
  write: 'edit_document',
  delete: 'archive_document',
  approve: 'approve_document',
  reject: 'reject_document',
};

function normalizePermissionNames(input: string[] | undefined): string[] {
  if (!input?.length) return [];
  const canon = input.map((p) => LEGACY_TO_CANON[p] ?? p);
  const valid = canon.filter((p) => (ALL_PERMISSIONS as readonly string[]).includes(p));
  return [...new Set(valid)];
}

function permissionHas(rolePerms: string[], key: string): boolean {
  if (rolePerms.includes(key)) return true;
  const legacyKey = Object.entries(LEGACY_TO_CANON).find(([, v]) => v === key)?.[0];
  return legacyKey ? rolePerms.includes(legacyKey) : false;
}

const PERM_COLORS: Record<string, string> = {
  view_document: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  create_document: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400',
  edit_document: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  submit_document: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400',
  approve_document: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  reject_document: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  sign_document: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400',
  archive_document: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  delegate_approval: 'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-400',
  view_audit_logs: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
  manage_users: 'bg-fuchsia-50 text-fuchsia-900 dark:bg-fuchsia-950/40 dark:text-fuchsia-400',
  manage_roles: 'bg-pink-50 text-pink-900 dark:bg-pink-950/40 dark:text-pink-400',
};

// ── Schemas ──────────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  username:   z.string().min(2, 'At least 2 characters').max(50),
  email:      z.string().email('Valid email required'),
  full_name:  z.string().max(255),
  phone:      z.string().max(50),
  rank:       z.string().max(100),
  department: z.string().max(255),
  unit:       z.string().max(255),
  zone:       z.string().max(100),
  state:      z.string().max(100),
  password:   z.string().min(6, 'At least 6 characters'),
});

const editProfileSchema = z.object({
  email:      z.string().email('Valid email required'),
  full_name:  z.string().max(255),
  phone:      z.string().max(50),
  rank:       z.string().max(100),
  department: z.string().max(255),
  unit:       z.string().max(255),
  zone:       z.string().max(100),
  state:      z.string().max(100),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'At least 6 characters'),
  confirm:  z.string().min(6),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

const createRoleSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(50).regex(/^[a-z_]+$/, 'Lowercase letters and underscores only'),
});

type CreateUserForm    = z.infer<typeof createUserSchema>;
type EditProfileForm   = z.infer<typeof editProfileSchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
type CreateRoleForm    = z.infer<typeof createRoleSchema>;

/** Fallback rank titles if grade roles are not returned from `/auth/roles` (offline / empty DB). */
const NHIA_RANK_FALLBACK_OPTIONS = [
  'Director General',
  'Director',
  'Deputy Director',
  'Assistant Director',
  'Principal Manager',
  'Senior Manager',
  'Manager',
  'Assistant Manager',
  'Senior Officer',
  'Officer',
] as const;

const SELECT_NONE = '__none__';

function unitsForDepartment(
  orgScope: OrgScopeReferenceResponse | undefined,
  departmentName: string | undefined
) {
  if (!orgScope?.units?.length || !departmentName?.trim()) return [];
  const dept = orgScope.departments?.find((d) => d.name === departmentName);
  if (!dept) return [];
  return orgScope.units.filter((u) => u.departmentId === dept.id);
}

function displayOrDash(value: string | number | boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value == null) return '—';
  const s = String(value).trim();
  return s.length > 0 ? s : '—';
}

function userPrimaryLabel(u: UserRecord): string {
  const name = u.full_name?.trim();
  return name || u.username;
}

function supervisorLabelFor(u: UserRecord, usersById: Map<string, UserRecord>): string {
  const supervisor = u.supervisor_id ? usersById.get(u.supervisor_id) : undefined;
  if (!supervisor) return '—';
  const label = userPrimaryLabel(supervisor);
  return supervisor.username !== label ? `${label} (@${supervisor.username})` : label;
}

function UserRolesBadges({ u, allRoles }: { u: UserRecord; allRoles: Role[] | undefined }) {
  if (!u.roles.length) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-0.5 min-w-0 max-w-full">
      {u.roles.map((r) => {
        const def = allRoles?.find((x) => x.id === r.id);
        const label = roleDisplayLabel(def ?? r);
        return (
          <span
            key={r.id}
            className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize whitespace-nowrap',
              ROLE_COLORS[r.name] ?? 'bg-muted text-muted-foreground'
            )}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

const TH =
  'text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap';
const TD = 'px-3 py-2.5 align-top text-xs overflow-hidden';
const STICKY_ACTIONS_BASE_TH = 'sticky right-0 z-20 text-right bg-white dark:bg-muted';
const STICKY_ACTIONS_BASE_TD = 'sticky right-0 z-20 text-right';
const STICKY_ACTIONS_OVERLAP =
  'border-l border-border shadow-[-8px_0_16px_-8px_rgba(15,23,42,0.12)] dark:shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.35)]';

function userTableRowBg(idx: number) {
  return idx % 2 !== 0 ? 'bg-slate-50 dark:bg-muted/40' : 'bg-white dark:bg-card';
}

function userMatchesSearch(u: UserRecord, query: string, allRoles: Role[] | undefined): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const roleLabels = (u.roles ?? []).map((r) => {
    const def = allRoles?.find((x) => x.id === r.id);
    return roleDisplayLabel(def ?? r);
  });
  const haystack = [
    u.full_name,
    u.username,
    u.email,
    u.phone,
    u.staff_id,
    u.department,
    u.unit,
    u.zone,
    u.state,
    u.rank,
    u.grade_level,
    u.account_status,
    ...roleLabels,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function accountStatusBadge(status: string | null | undefined) {
  const s = (status ?? 'unknown').toLowerCase();
  const styles =
    s === 'active'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800'
      : s === 'inactive' || s === 'deactivated'
        ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800'
        : 'bg-muted text-muted-foreground ring-border';
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ring-1', styles)}>
      {displayOrDash(status)}
    </span>
  );
}

function organisationSummary(u: UserRecord): string {
  const parts = [u.department, u.unit, u.zone, u.state].map((p) => p?.trim()).filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function organisationCellLines(u: UserRecord): { primary: string; secondary: string | null } {
  const primary = [u.department, u.unit].map((p) => p?.trim()).filter(Boolean).join(' · ');
  const secondary = [u.zone, u.state].map((p) => p?.trim()).filter(Boolean).join(' · ');
  return {
    primary: primary || '—',
    secondary: secondary || null,
  };
}

function isActiveUser(u: UserRecord): boolean {
  return (u.account_status ?? 'active').toLowerCase() === 'active';
}

function sortUsersActiveFirst(list: UserRecord[]): UserRecord[] {
  return [...list].sort((a, b) => {
    const aActive = isActiveUser(a);
    const bActive = isActiveUser(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    const aName = (a.full_name || a.username || '').toLowerCase();
    const bName = (b.full_name || b.username || '').toLowerCase();
    return aName.localeCompare(bName);
  });
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-1 sm:gap-4 py-2.5 border-b border-border/50 last:border-0">
      <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className={cn('text-sm text-foreground', mono && 'font-mono text-xs break-all')}>{value}</dd>
    </div>
  );
}

function UserDetailDialog({
  user,
  allRoles,
  usersById,
  open,
  onOpenChange,
}: {
  user: UserRecord | null;
  allRoles: Role[] | undefined;
  usersById: Map<string, UserRecord>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!user) return null;
  const primaryRole = user.primary_role_id ? allRoles?.find((r) => r.id === user.primary_role_id) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(90vh,42rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{userPrimaryLabel(user)}</DialogTitle>
          <DialogDescription>
            @{user.username}
            {user.staff_id ? ` · ${user.staff_id}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Contact</p>
          <DetailRow label="Email" value={displayOrDash(user.email)} />
          <DetailRow label="Phone" value={displayOrDash(user.phone)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Organisation</p>
          <DetailRow label="Rank" value={displayOrDash(user.rank)} />
          <DetailRow label="Grade" value={displayOrDash(user.grade_level)} />
          <DetailRow label="Department" value={displayOrDash(user.department)} />
          <DetailRow label="Unit" value={displayOrDash(user.unit)} />
          <DetailRow label="Zone" value={displayOrDash(user.zone)} />
          <DetailRow label="State office" value={displayOrDash(user.state)} />
          <DetailRow label="Supervisor" value={supervisorLabelFor(user, usersById)} />
          <DetailRow label="Employment" value={displayOrDash(user.employment_type)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Access & security</p>
          <DetailRow
            label="Roles"
            value={<UserRolesBadges u={user} allRoles={allRoles} />}
          />
          <DetailRow label="Primary role" value={primaryRole ? roleDisplayLabel(primaryRole) : '—'} />
          <DetailRow label="Account" value={accountStatusBadge(user.account_status)} />
          <DetailRow label="Clearance" value={displayOrDash(user.clearance_level)} />
          <DetailRow label="MFA" value={displayOrDash(user.mfa_enabled)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Activity</p>
          <DetailRow
            label="Member since"
            value={user.created_at ? formatDateTime(user.created_at) : '—'}
          />
          <DetailRow
            label="Last login"
            value={user.last_login_at ? formatDateTime(user.last_login_at) : '—'}
          />
          <DetailRow label="Profile photo" value={displayOrDash(user.photo_path?.trim() ? 'On file' : null)} />
          <DetailRow label="Signature" value={displayOrDash(user.signature_path?.trim() ? 'On file' : null)} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">System IDs</p>
          <DetailRow label="User ID" value={user.id} mono />
          <DetailRow label="Dept ID" value={displayOrDash(user.nhia_department_id)} mono />
          <DetailRow label="Unit ID" value={displayOrDash(user.nhia_unit_id)} mono />
          <DetailRow label="State office ID" value={displayOrDash(user.nhia_state_office_id)} mono />
          <DetailRow label="Zone ID" value={displayOrDash(user.nhia_zone_id)} mono />
          <DetailRow label="Directorate ID" value={displayOrDash(user.nhia_directorate_id)} mono />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsersTable({
  users,
  allRoles,
  canManageUsers,
  canViewAuditNav,
  onEditProfile,
  onManageRoles,
  onResetPassword,
  onDeactivate,
  onViewAudit,
  onViewDetails,
}: {
  users: UserRecord[];
  allRoles: Role[] | undefined;
  canManageUsers: boolean;
  canViewAuditNav: boolean;
  onEditProfile: (u: UserRecord) => void;
  onManageRoles: (u: UserRecord) => void;
  onResetPassword: (u: UserRecord) => void;
  onDeactivate: (u: UserRecord) => void;
  onViewAudit: () => void;
  onViewDetails: (u: UserRecord) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [actionsOverlap, setActionsOverlap] = useState(false);

  const updateActionsOverlap = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setActionsOverlap(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    updateActionsOverlap();
    const el = scrollRef.current;
    if (!el) return undefined;

    const ro = new ResizeObserver(() => updateActionsOverlap());
    ro.observe(el);
    window.addEventListener('resize', updateActionsOverlap);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateActionsOverlap);
    };
  }, [users.length, updateActionsOverlap]);

  const stickyTh = cn(STICKY_ACTIONS_BASE_TH, actionsOverlap && STICKY_ACTIONS_OVERLAP);
  const stickyTd = cn(STICKY_ACTIONS_BASE_TD, actionsOverlap && STICKY_ACTIONS_OVERLAP);

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <table className="w-full min-w-[68rem] table-fixed text-sm">
        <colgroup>
          <col style={{ width: '9rem' }} />
          <col style={{ width: '9.5rem' }} />
          <col style={{ width: '8.5rem' }} />
          <col style={{ width: '13rem' }} />
          <col style={{ width: '6.5rem' }} />
          <col style={{ width: '7.5rem' }} />
          <col style={{ width: '4.5rem' }} />
          <col style={{ width: '8rem' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className={TH}>Full name</th>
            <th className={TH}>Staff ID</th>
            <th className={TH}>Contact</th>
            <th className={TH}>Organisation</th>
            <th className={TH}>Rank</th>
            <th className={TH}>Roles</th>
            <th className={TH}>Status</th>
            <th className={cn(TH, stickyTh)}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, idx) => {
            const orgLines = organisationCellLines(u);
            const orgTitle = organisationSummary(u);
            const rankLabel = displayOrDash(u.rank ?? u.grade_level);
            const rowBg = userTableRowBg(idx);
            return (
              <tr
                key={u.id}
                className={cn(
                  'border-b border-border/50 last:border-0 hover:bg-muted/30',
                  rowBg
                )}
              >
                <td className={TD}>
                  <p className="font-medium text-foreground truncate" title={u.full_name ?? undefined}>
                    {displayOrDash(u.full_name)}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize mt-0.5 truncate" title={u.username}>
                    @{displayOrDash(u.username)}
                  </p>
                </td>
                <td className={cn(TD, 'font-mono text-[11px] leading-snug')}>
                  <span className="block truncate" title={u.staff_id ?? undefined}>
                    {displayOrDash(u.staff_id)}
                  </span>
                </td>
                <td className={TD}>
                  <p className="truncate text-[13px]" title={u.email ?? undefined}>{displayOrDash(u.email)}</p>
                  {u.phone?.trim() ? (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={u.phone}>{u.phone}</p>
                  ) : null}
                </td>
                <td className={cn(TD, 'text-[11px] leading-snug text-muted-foreground')}>
                  <p className="truncate font-medium text-foreground/90" title={orgTitle !== '—' ? orgTitle : undefined}>
                    {orgLines.primary}
                  </p>
                  {orgLines.secondary ? (
                    <p className="truncate mt-0.5" title={orgLines.secondary}>
                      {orgLines.secondary}
                    </p>
                  ) : null}
                </td>
                <td className={TD}>
                  <span
                    className="block truncate text-[13px]"
                    title={rankLabel !== '—' ? rankLabel : undefined}
                  >
                    {rankLabel}
                  </span>
                </td>
                <td className="px-3 py-3 align-top">
                  <UserRolesBadges u={u} allRoles={allRoles} />
                </td>
                <td className={TD}>{accountStatusBadge(u.account_status)}</td>
                <td className={cn('px-2 py-2.5 align-top overflow-visible', stickyTd, rowBg)}>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="icon-sm" title="View full profile" onClick={() => onViewDetails(u)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canManageUsers && (
                      <>
                        <Button variant="ghost" size="icon-sm" title="Edit profile" onClick={() => onEditProfile(u)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Manage roles" onClick={() => onManageRoles(u)}>
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Reset password" onClick={() => onResetPassword(u)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Deactivate user"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onDeactivate(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {canViewAuditNav && (
                      <Button variant="ghost" size="icon-sm" title="View audit logs" onClick={onViewAudit}>
                        <Activity className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const permissions = authUser?.permissions ?? [];
  const roleNames = authUser?.roles ?? [];
  const canManageUsers = permissions.includes('manage_users');
  const canManageRoles = permissions.includes('manage_roles');
  const canViewAuditNav = roleNames.some((r) => ['admin', 'director', 'general_manager'].includes(String(r).toLowerCase()));
  const [createUserOpen,    setCreateUserOpen]    = useState(false);
  const [createRoleOpen,    setCreateRoleOpen]     = useState(false);
  const [resetPwUser,       setResetPwUser]        = useState<UserRecord | null>(null);
  const [deactivateUser,    setDeactivateUser]     = useState<UserRecord | null>(null);
  const [manageRolesUser,   setManageRolesUser]    = useState<UserRecord | null>(null);
  const [editProfileUser,   setEditProfileUser]    = useState<UserRecord | null>(null);
  const [viewUser,          setViewUser]           = useState<UserRecord | null>(null);
  const [editPermRole,      setEditPermRole]       = useState<Role | null>(null);
  const [activeTab,         setActiveTab]          = useState<'users' | 'permissions'>('users');
  const [userSearch,        setUserSearch]         = useState('');
  const [statusFilter,      setStatusFilter]       = useState<'all' | 'active' | 'inactive'>('all');

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

  const gradeRoles = useMemo(() => gradeRolesSorted(allRoles), [allRoles]);

  const sortedUsers = useMemo(
    () => (users?.length ? sortUsersActiveFirst(users) : []),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim();
    return sortedUsers.filter((u) => {
      if (statusFilter === 'active' && !isActiveUser(u)) return false;
      if (statusFilter === 'inactive' && isActiveUser(u)) return false;
      return userMatchesSearch(u, q, allRoles);
    });
  }, [sortedUsers, userSearch, statusFilter, allRoles]);

  const usersById = useMemo(
    () => new Map((users ?? []).map((u) => [u.id, u])),
    [users]
  );

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
        description={
          canManageUsers
            ? 'Create and manage users, roles, and permissions'
            : 'Browse users and roles (same directory as document recipient selection)'
        }
        actions={
          activeTab === 'users' && canManageUsers ? (
            <Button size="sm" onClick={() => setCreateUserOpen(true)}>
              <UserPlus className="h-4 w-4" /> New User
            </Button>
          ) : activeTab === 'permissions' && canManageRoles ? (
            <Button variant="outline" size="sm" onClick={() => setCreateRoleOpen(true)}>
              <Shield className="h-4 w-4" /> New Role
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users',  value: users?.length ?? 0,    icon: Users,  color: 'text-primary',                         bg: 'bg-primary/10' },
          { label: 'Total Roles',  value: allRoles?.length ?? 0, icon: Shield, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
          { label: 'Permission types', value: ALL_PERMISSIONS.length, icon: Key, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
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

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'users' | 'permissions')}
        className="space-y-4"
      >
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="users" className="gap-1.5 px-4 py-2">
            <Users className="h-3.5 w-3.5" />
            Users
            <span className="tabular-nums opacity-80">({usersLoading ? '…' : (users?.length ?? 0)})</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5 px-4 py-2">
            <Key className="h-3.5 w-3.5" />
            Roles &amp; permissions
            <span className="tabular-nums opacity-80">({rolesLoading ? '…' : (allRoles?.length ?? 0)})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-0 space-y-3">
          <Card>
            <CardHeader className="pb-3 space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">User directory</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {usersLoading
                      ? 'Loading…'
                      : `Showing ${filteredUsers.length} of ${sortedUsers.length} users`}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:min-w-[28rem]">
                  <div className="relative flex-1 min-w-[12rem]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search name, username, email, staff ID, org…"
                      className="h-10 pl-9 pr-9"
                    />
                    {userSearch.trim() ? (
                      <button
                        type="button"
                        onClick={() => setUserSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}
                  >
                    <SelectTrigger className="h-10 w-full sm:w-[10.5rem]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active only</SelectItem>
                      <SelectItem value="inactive">Inactive only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto border-t border-border">
              {usersLoading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !users?.length ? (
                <EmptyState icon={Users} title="No users found" description="Create the first user to get started" />
              ) : filteredUsers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No matching users"
                  description="Try a different search term or change the status filter."
                />
              ) : (
                <UsersTable
                  users={filteredUsers}
                  allRoles={allRoles}
                  canManageUsers={canManageUsers}
                  canViewAuditNav={canViewAuditNav}
                  onEditProfile={setEditProfileUser}
                  onManageRoles={setManageRolesUser}
                  onResetPassword={setResetPwUser}
                  onDeactivate={setDeactivateUser}
                  onViewAudit={() => navigate('/audit')}
                  onViewDetails={setViewUser}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-0 space-y-3">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {rolesLoading ? (
                <div className="p-5 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Role
                      </th>
                      {ALL_PERMISSIONS.map((p) => (
                        <th
                          key={p}
                          className="text-center px-2 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide max-w-[5rem] leading-tight"
                        >
                          {p.replace(/_/g, ' ')}
                        </th>
                      ))}
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Assigned to
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {canManageRoles ? 'Actions' : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(allRoles ?? []).map((role, idx) => {
                      const assignedUsers = (users ?? []).filter((u) =>
                        u.roles.some((r) => r.id === role.id)
                      );
                      return (
                        <tr
                          key={role.id}
                          className={cn(
                            'border-b border-border/50 last:border-0',
                            idx % 2 !== 0 && 'bg-muted/20'
                          )}
                        >
                          <td className="px-5 py-3.5">
                            <span
                              className={cn(
                                'text-xs font-semibold px-2.5 py-1 rounded-full capitalize',
                                ROLE_COLORS[role.name] ?? 'bg-muted text-muted-foreground'
                              )}
                            >
                              {roleDisplayLabel(role)}
                            </span>
                          </td>
                          {ALL_PERMISSIONS.map((p) => (
                            <td key={p} className="text-center px-4 py-3.5">
                              {permissionHas(role.permissions ?? [], p) ? (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold mx-auto">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground/40 text-xs mx-auto">
                                  —
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="px-5 py-3.5">
                            <div className="flex gap-1.5 flex-wrap">
                              {assignedUsers.length > 0 ? (
                                assignedUsers.map((u) => (
                                  <span
                                    key={u.id}
                                    className="text-xs font-medium bg-muted px-2 py-0.5 rounded-full capitalize"
                                  >
                                    {u.username}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">Unassigned</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {canManageRoles ? (
                              <Button size="sm" variant="outline" onClick={() => setEditPermRole(role)}>
                                <Edit className="h-3.5 w-3.5" />
                                Edit permissions
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UserDetailDialog
        user={viewUser}
        allRoles={allRoles}
        usersById={usersById}
        open={!!viewUser}
        onOpenChange={(open) => {
          if (!open) setViewUser(null);
        }}
      />

      {/* ── Dialogs ── */}
      <CreateUserDialog
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
        gradeRoles={gradeRoles}
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
      {editProfileUser && (
        <EditProfileDialog
          user={editProfileUser}
          gradeRoles={gradeRoles}
          onClose={() => setEditProfileUser(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
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
      {editPermRole && (
        <RolePermissionsDialog
          role={editPermRole}
          onClose={() => setEditPermRole(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['admin-roles'] });
            qc.invalidateQueries({ queryKey: ['admin-users'] });
          }}
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
function CreateUserDialog({
  open,
  onClose,
  onSuccess,
  gradeRoles,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gradeRoles: Role[];
}) {
  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      rank: '',
      department: '',
      unit: '',
      zone: '',
      state: '',
    },
  });

  const watchedZone = useWatch({ control, name: 'zone' });
  const watchedDepartment = useWatch({ control, name: 'department' });
  const watchedUnit = useWatch({ control, name: 'unit' });

  const { data: orgScope, isLoading: orgScopeLoading } = useQuery({
    queryKey: QUERY_KEYS.orgScopeReference,
    queryFn: () => documentsApi.getOrgScopeReference(),
    enabled: open,
    staleTime: 60_000,
  });

  const filteredUnits = useMemo(
    () => unitsForDepartment(orgScope, watchedDepartment),
    [orgScope, watchedDepartment]
  );

  const unitLegacy = useMemo(
    () =>
      Boolean(
        watchedUnit?.trim() &&
          filteredUnits.length > 0 &&
          !filteredUnits.some((u) => u.name === watchedUnit)
      ),
    [watchedUnit, filteredUnits]
  );

  const filteredStateOffices = useMemo(() => {
    if (!orgScope?.stateOffices?.length) return [];
    const z = orgScope.zones?.find((x) => x.name === watchedZone);
    if (!watchedZone?.trim() || !z) return orgScope.stateOffices;
    return orgScope.stateOffices.filter((s) => s.zoneCode === z.code);
  }, [orgScope, watchedZone]);

  const mutation = useMutation({
    mutationFn: (data: CreateUserForm) => {
      const pick = (s: string) => {
        const v = s.trim();
        return v.length > 0 ? v : undefined;
      };
      return authApi.createUser({
        username: data.username.trim(),
        email: data.email.trim(),
        password: data.password,
        full_name: pick(data.full_name),
        phone: pick(data.phone),
        rank: pick(data.rank),
        department: pick(data.department),
        unit: pick(data.unit),
        zone: pick(data.zone),
        state: pick(data.state),
      });
    },
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
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Create New User</DialogTitle>
          <DialogDescription>Add a new user to the system. They can log in immediately with the provided credentials.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col min-h-0">
          <div className="space-y-4 px-6 overflow-y-auto pb-4">
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
              <Label htmlFor="cu-full_name">Full name</Label>
              <Input id="cu-full_name" placeholder="Legal name as on record" error={!!errors.full_name} {...register('full_name')} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-phone">Phone</Label>
              <Input id="cu-phone" type="tel" placeholder="+234 …" error={!!errors.phone} {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="cu-rank">Rank</Label>
                <Controller
                  name="rank"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => field.onChange(v === SELECT_NONE ? '' : v)}
                    >
                      <SelectTrigger
                        id="cu-rank"
                        className={cn(errors.rank && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue placeholder="Select rank…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {(gradeRoles.length > 0
                          ? gradeRoles.map((r) => {
                              const title = roleDisplayLabel(r);
                              return (
                                <SelectItem key={r.id} value={title}>
                                  {title}
                                </SelectItem>
                              );
                            })
                          : NHIA_RANK_FALLBACK_OPTIONS.map((title) => (
                              <SelectItem key={title} value={title}>
                                {title}
                              </SelectItem>
                            )))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.rank && <p className="text-xs text-destructive">{errors.rank.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cu-department">Department</Label>
                <Controller
                  name="department"
                  control={control}
                  render={({ field }) => (
                    <Select
                      disabled={orgScopeLoading || !orgScope}
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => {
                        field.onChange(v === SELECT_NONE ? '' : v);
                        setValue('unit', '');
                      }}
                    >
                      <SelectTrigger
                        id="cu-department"
                        className={cn(errors.department && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue placeholder={orgScope ? 'Select department…' : 'Loading…'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {(orgScope?.departments ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-unit">Unit</Label>
                <Controller
                  name="unit"
                  control={control}
                  render={({ field }) => (
                    <Select
                      disabled={orgScopeLoading || !orgScope || !watchedDepartment?.trim()}
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => field.onChange(v === SELECT_NONE ? '' : v)}
                    >
                      <SelectTrigger
                        id="cu-unit"
                        className={cn(errors.unit && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue
                          placeholder={
                            !orgScope
                              ? 'Loading…'
                              : !watchedDepartment?.trim()
                                ? 'Select department first…'
                                : 'Select unit…'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {unitLegacy && watchedUnit ? (
                          <SelectItem value={watchedUnit}>{watchedUnit} (saved)</SelectItem>
                        ) : null}
                        {filteredUnits.map((u) => (
                          <SelectItem key={u.id} value={u.name}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cu-zone">Zone</Label>
                <Controller
                  name="zone"
                  control={control}
                  render={({ field }) => (
                    <Select
                      disabled={orgScopeLoading || !orgScope}
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => {
                        field.onChange(v === SELECT_NONE ? '' : v);
                        setValue('state', '');
                      }}
                    >
                      <SelectTrigger
                        id="cu-zone"
                        className={cn(errors.zone && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue placeholder={orgScope ? 'Select zone…' : 'Loading…'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {(orgScope?.zones ?? []).map((z) => (
                          <SelectItem key={z.code} value={z.name}>
                            {z.code} — {z.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.zone && <p className="text-xs text-destructive">{errors.zone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-state">State</Label>
                <Controller
                  name="state"
                  control={control}
                  render={({ field }) => (
                    <Select
                      disabled={orgScopeLoading || !orgScope || !watchedZone?.trim()}
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => field.onChange(v === SELECT_NONE ? '' : v)}
                    >
                      <SelectTrigger
                        id="cu-state"
                        className={cn(errors.state && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue
                          placeholder={
                            !orgScope
                              ? 'Loading…'
                              : !watchedZone?.trim()
                                ? 'Select zone first…'
                                : 'Select state office…'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {filteredStateOffices.map((s) => (
                          <SelectItem key={`${s.zoneCode}-${s.name}`} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-password">Password</Label>
              <Input id="cu-password" type="password" placeholder="Min. 6 characters" error={!!errors.password} {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}><UserPlus className="h-4 w-4" /> Create User</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Profile Dialog ───────────────────────────────────────────────────────
function EditProfileDialog({
  user,
  gradeRoles,
  onClose,
  onSuccess,
}: {
  user: UserRecord;
  gradeRoles: Role[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<EditProfileForm>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      email: user.email ?? '',
      full_name: user.full_name ?? '',
      phone: user.phone ?? '',
      rank: user.rank ?? '',
      department: user.department ?? '',
      unit: user.unit ?? '',
      zone: user.zone ?? '',
      state: user.state ?? '',
    },
  });

  useEffect(() => {
    reset({
      email: user.email ?? '',
      full_name: user.full_name ?? '',
      phone: user.phone ?? '',
      rank: user.rank ?? '',
      department: user.department ?? '',
      unit: user.unit ?? '',
      zone: user.zone ?? '',
      state: user.state ?? '',
    });
  }, [user.id, user.email, user.full_name, user.phone, user.rank, user.department, user.unit, user.zone, user.state, reset]);

  const watchedZone = useWatch({ control, name: 'zone' });
  const watchedDepartment = useWatch({ control, name: 'department' });
  const watchedUnit = useWatch({ control, name: 'unit' });

  const { data: orgScope, isLoading: orgScopeLoading } = useQuery({
    queryKey: QUERY_KEYS.orgScopeReference,
    queryFn: () => documentsApi.getOrgScopeReference(),
    staleTime: 60_000,
  });

  const filteredUnits = useMemo(
    () => unitsForDepartment(orgScope, watchedDepartment),
    [orgScope, watchedDepartment]
  );

  const unitLegacy = useMemo(
    () =>
      Boolean(
        watchedUnit?.trim() &&
          filteredUnits.length > 0 &&
          !filteredUnits.some((u) => u.name === watchedUnit)
      ),
    [watchedUnit, filteredUnits]
  );

  const filteredStateOffices = useMemo(() => {
    if (!orgScope?.stateOffices?.length) return [];
    const z = orgScope.zones?.find((x) => x.name === watchedZone);
    if (!watchedZone?.trim() || !z) return orgScope.stateOffices;
    return orgScope.stateOffices.filter((s) => s.zoneCode === z.code);
  }, [orgScope, watchedZone]);

  const mutation = useMutation({
    mutationFn: (data: EditProfileForm) => {
      const pick = (s: string) => {
        const v = s.trim();
        return v.length > 0 ? v : undefined;
      };
      return authApi.updateUserAdmin(user.id, {
        email: data.email.trim().toLowerCase(),
        full_name: pick(data.full_name),
        phone: pick(data.phone),
        rank: pick(data.rank),
        department: pick(data.department),
        unit: pick(data.unit),
        zone: pick(data.zone),
        state: pick(data.state),
      });
    },
    onSuccess: () => {
      toast.success('Profile updated');
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" /> Edit profile</DialogTitle>
          <DialogDescription>
            Update contact details and organisation fields for <strong className="capitalize">{user.username}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col min-h-0">
          <div className="space-y-4 px-6 overflow-y-auto pb-4">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Username </span>
              <span className="font-medium capitalize">{user.username}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-email">Email</Label>
              <Input id="ep-email" type="email" placeholder="user@example.com" error={!!errors.email} {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-full_name">Full name</Label>
              <Input id="ep-full_name" placeholder="Legal name as on record" error={!!errors.full_name} {...register('full_name')} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-phone">Phone</Label>
              <Input id="ep-phone" type="tel" placeholder="+234 …" error={!!errors.phone} {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="ep-rank">Rank</Label>
                <Controller
                  name="rank"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => field.onChange(v === SELECT_NONE ? '' : v)}
                    >
                      <SelectTrigger
                        id="ep-rank"
                        className={cn(errors.rank && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue placeholder="Select rank…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {(gradeRoles.length > 0
                          ? gradeRoles.map((r) => {
                              const title = roleDisplayLabel(r);
                              return (
                                <SelectItem key={r.id} value={title}>
                                  {title}
                                </SelectItem>
                              );
                            })
                          : NHIA_RANK_FALLBACK_OPTIONS.map((title) => (
                              <SelectItem key={title} value={title}>
                                {title}
                              </SelectItem>
                            )))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.rank && <p className="text-xs text-destructive">{errors.rank.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ep-department">Department</Label>
                <Controller
                  name="department"
                  control={control}
                  render={({ field }) => (
                    <Select
                      disabled={orgScopeLoading || !orgScope}
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => {
                        field.onChange(v === SELECT_NONE ? '' : v);
                        setValue('unit', '');
                      }}
                    >
                      <SelectTrigger
                        id="ep-department"
                        className={cn(errors.department && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue placeholder={orgScope ? 'Select department…' : 'Loading…'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {(orgScope?.departments ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-unit">Unit</Label>
                <Controller
                  name="unit"
                  control={control}
                  render={({ field }) => (
                    <Select
                      disabled={orgScopeLoading || !orgScope || !watchedDepartment?.trim()}
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => field.onChange(v === SELECT_NONE ? '' : v)}
                    >
                      <SelectTrigger
                        id="ep-unit"
                        className={cn(errors.unit && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue
                          placeholder={
                            !orgScope
                              ? 'Loading…'
                              : !watchedDepartment?.trim()
                                ? 'Select department first…'
                                : 'Select unit…'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {unitLegacy && watchedUnit ? (
                          <SelectItem value={watchedUnit}>{watchedUnit} (saved)</SelectItem>
                        ) : null}
                        {filteredUnits.map((u) => (
                          <SelectItem key={u.id} value={u.name}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ep-zone">Zone</Label>
                <Controller
                  name="zone"
                  control={control}
                  render={({ field }) => (
                    <Select
                      disabled={orgScopeLoading || !orgScope}
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => {
                        field.onChange(v === SELECT_NONE ? '' : v);
                        setValue('state', '');
                      }}
                    >
                      <SelectTrigger
                        id="ep-zone"
                        className={cn(errors.zone && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue placeholder={orgScope ? 'Select zone…' : 'Loading…'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {(orgScope?.zones ?? []).map((z) => (
                          <SelectItem key={z.code} value={z.name}>
                            {z.code} — {z.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.zone && <p className="text-xs text-destructive">{errors.zone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-state">State</Label>
                <Controller
                  name="state"
                  control={control}
                  render={({ field }) => (
                    <Select
                      disabled={orgScopeLoading || !orgScope || !watchedZone?.trim()}
                      value={field.value ? field.value : SELECT_NONE}
                      onValueChange={(v) => field.onChange(v === SELECT_NONE ? '' : v)}
                    >
                      <SelectTrigger
                        id="ep-state"
                        className={cn(errors.state && 'border-destructive ring-1 ring-destructive')}
                      >
                        <SelectValue
                          placeholder={
                            !orgScope
                              ? 'Loading…'
                              : !watchedZone?.trim()
                                ? 'Select zone first…'
                                : 'Select state office…'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE} className="text-muted-foreground">None</SelectItem>
                        {filteredStateOffices.map((s) => (
                          <SelectItem key={`${s.zoneCode}-${s.name}`} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}><Edit className="h-4 w-4" /> Save changes</Button>
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
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Manage Roles</DialogTitle>
          <DialogDescription>Toggle roles for <strong className="capitalize">{user.username}</strong>. Changes take effect immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[55vh] overflow-y-auto pr-1">
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
                    <p className={cn('text-sm font-semibold', assigned && 'text-primary')}>{roleDisplayLabel(role)}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono text-[10px] uppercase tracking-wide">{role.name}</span>
                      {role.permissions.length > 0 ? (
                        <> · {role.permissions.join(', ')}</>
                      ) : (
                        <> · No permissions</>
                      )}
                    </p>
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

function RolePermissionsDialog({
  role,
  onClose,
  onSaved,
}: {
  role: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedPerms, setSelectedPerms] = useState<string[]>(
    normalizePermissionNames(role.permissions ?? [])
  );

  useEffect(() => {
    setSelectedPerms(normalizePermissionNames(role.permissions ?? []));
  }, [role.id, role.permissions]);

  const mutation = useMutation({
    mutationFn: (permissionNames: string[]) => authApi.setRolePermissions(role.id, permissionNames),
    onSuccess: () => {
      toast.success(`Updated permissions for ${roleDisplayLabel(role)}`);
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const togglePerm = (p: string) => {
    setSelectedPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" /> Edit Role Permissions
          </DialogTitle>
          <DialogDescription>
            Update permission grants for <strong>{roleDisplayLabel(role)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto pr-1">
          {ALL_PERMISSIONS.map((p) => {
            const active = selectedPerms.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePerm(p)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left',
                  active
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border hover:border-primary/30 text-muted-foreground'
                )}
              >
                <div
                  className={cn(
                    'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                    active ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                  )}
                >
                  {active && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                {p.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={mutation.isPending} onClick={() => mutation.mutate(selectedPerms)}>
            Save permissions
          </Button>
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
                    {p.replace(/_/g, ' ')}
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
