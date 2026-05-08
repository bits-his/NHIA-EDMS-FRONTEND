import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, GitBranch, CheckSquare, Shield, Plus, Search,
  ArrowRight, Bell, TrendingUp, Clock, AlertTriangle, Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/shared/Skeleton';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { DocumentStatusBadge } from '@/components/documents/StatusBadge';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { auditApi } from '@/api/audit';
import { tasksApi } from '@/api/tasks';
import { documentsApi } from '@/api/documents';
import { QUERY_KEYS, SEEDED_USER_IDS, SEEDED_DOCUMENT_IDS } from '@/utils/constants';
import { formatRelative, isOverdue } from '@/utils/formatters';
import { canCreateDocument } from '@/utils/permissions';
import { resolveUsername } from '@/utils/users';
import { cn } from '@/utils/cn';
import type { Document } from '@/types/document';
import type { Task } from '@/types/task';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roles.includes('admin') ?? false;
  return isAdmin ? <AdminDashboard /> : <UserDashboard />;
}

// ─── Shared components ────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, bg, ring, onClick }: {
  icon: React.ElementType; label: string; value: number | string;
  sub: string; color: string; bg: string; ring: string; onClick?: () => void;
}) {
  const body = (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-200 w-full">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl mb-4 ring-4', bg, ring)}>
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
  return onClick
    ? <button onClick={onClick} className="w-full text-left">{body}</button>
    : body;
}

function QuickAction({ icon: Icon, label, path, navigate }: {
  icon: React.ElementType; label: string; path: string; navigate: (p: string) => void;
}) {
  return (
    <button
      onClick={() => navigate(path)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted/60 transition-colors text-left group"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
        <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      {label}
      <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
    </button>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  // Fetch all documents across all users
  const allUserIds = [...new Set([user?.user_id ?? '', ...SEEDED_USER_IDS])];

  const { data: allDocuments, isLoading: docsLoading } = useQuery({
    queryKey: [QUERY_KEYS.allDocuments, 'admin'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        allUserIds.map((uid) => auditApi.getLogs({ actor_id: uid }))
      );
      const auditDocIds = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof auditApi.getLogs>>> => r.status === 'fulfilled')
        .flatMap((r) => r.value)
        .filter((l) => l.entity_type === 'document' && l.entity_id)
        .map((l) => l.entity_id!);
      const allIds = [...new Set([...SEEDED_DOCUMENT_IDS, ...auditDocIds])];
      const docResults = await Promise.allSettled(allIds.map((id) => documentsApi.getById(id)));
      return docResults
        .filter((r): r is PromiseFulfilledResult<Document> => r.status === 'fulfilled')
        .map((r) => r.value);
    },
    staleTime: 30_000,
  });

  // Fetch tasks for all known users
  const { data: allTasksRaw, isLoading: tasksLoading } = useQuery({
    queryKey: ['admin-all-tasks'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        SEEDED_USER_IDS.map((uid) => tasksApi.list(uid))
      );
      return results
        .filter((r): r is PromiseFulfilledResult<Task[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);
    },
    staleTime: 30_000,
  });

  // Fetch recent audit across all users
  const { data: allAudit, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit-all'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        SEEDED_USER_IDS.map((uid) => auditApi.getLogs({ actor_id: uid }))
      );
      const logs = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof auditApi.getLogs>>> => r.status === 'fulfilled')
        .flatMap((r) => r.value);
      return logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    staleTime: 30_000,
  });

  const docs = allDocuments ?? [];
  const tasks = allTasksRaw ?? [];

  // Document stats
  const docsByStatus = {
    draft:    docs.filter((d) => d.status === 'draft').length,
    pending:  docs.filter((d) => d.status === 'pending').length,
    approved: docs.filter((d) => d.status === 'approved').length,
    rejected: docs.filter((d) => d.status === 'rejected').length,
    archived: docs.filter((d) => d.status === 'archived').length,
  };

  // Task stats
  const activeTasks    = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const overdueTasks   = tasks.filter((t) => isOverdue(t.due_date) && t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Pending docs needing admin action
  const pendingDocs = docs.filter((d) => d.status === 'pending');

  const isLoading = docsLoading || tasksLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="System-wide overview — documents, workflows, tasks, and audit activity"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
              <Search className="h-4 w-4" /> Search
            </Button>
            <Button size="sm" onClick={() => navigate('/documents/new')}>
              <Plus className="h-4 w-4" /> New Document
            </Button>
          </div>
        }
      />

      {/* ── System health banner ── */}
      {!isLoading && (docsByStatus.pending > 0 || overdueTasks.length > 0) && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-900/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 mt-0.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Action required</p>
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                {docsByStatus.pending > 0 && (
                  <button
                    onClick={() => navigate('/documents')}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    {docsByStatus.pending} document{docsByStatus.pending !== 1 ? 's' : ''} pending review
                  </button>
                )}
                {overdueTasks.length > 0 && (
                  <button
                    onClick={() => navigate('/tasks')}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Top stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))
        ) : (
          <>
            <StatCard icon={FileText} label="Total Documents" value={docs.length} sub="across all users"
              color="text-primary" bg="bg-primary/10" ring="ring-primary/10" onClick={() => navigate('/documents')} />
            <StatCard icon={Clock} label="Pending Review" value={docsByStatus.pending} sub="awaiting approval"
              color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-900/20" ring="ring-amber-100 dark:ring-amber-900/30"
              onClick={() => navigate('/documents')} />
            <StatCard icon={CheckSquare} label="Active Tasks" value={activeTasks.length} sub="system-wide"
              color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-900/20" ring="ring-blue-100 dark:ring-blue-900/30"
              onClick={() => navigate('/tasks')} />
            <StatCard icon={AlertTriangle} label="Overdue Tasks" value={overdueTasks.length} sub="need attention"
              color={overdueTasks.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
              bg={overdueTasks.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}
              ring={overdueTasks.length > 0 ? 'ring-red-100 dark:ring-red-900/30' : 'ring-emerald-100 dark:ring-emerald-900/30'}
              onClick={() => navigate('/tasks')} />
          </>
        )}
      </div>

      {/* ── Document status breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Document Pipeline
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="text-xs">
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                {/* Status bars */}
                {([
                  { status: 'pending',  label: 'Pending Review', count: docsByStatus.pending,  color: 'bg-amber-500' },
                  { status: 'draft',    label: 'Draft',          count: docsByStatus.draft,    color: 'bg-slate-400' },
                  { status: 'approved', label: 'Approved',       count: docsByStatus.approved, color: 'bg-emerald-500' },
                  { status: 'rejected', label: 'Rejected',       count: docsByStatus.rejected, color: 'bg-red-500' },
                  { status: 'archived', label: 'Archived',       count: docsByStatus.archived, color: 'bg-slate-300' },
                ] as const).map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: docs.length > 0 ? `${(count / docs.length) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-6 text-right tabular-nums">{count}</span>
                  </div>
                ))}

                <Separator className="my-2" />

                {/* Pending documents list */}
                {pendingDocs.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending approval</p>
                    {pendingDocs.slice(0, 4).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer transition-colors group"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{doc.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">by {resolveUsername(doc.owner_id)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <DocumentStatusBadge status={doc.status} size="sm" />
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                        </div>
                      </div>
                    ))}
                    {pendingDocs.length > 4 && (
                      <button onClick={() => navigate('/documents')} className="text-xs text-primary hover:underline w-full text-center pt-1">
                        +{pendingDocs.length - 4} more pending documents
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckSquare className="h-4 w-4" />
                    All documents are up to date — no pending reviews
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-5">
          {/* User activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Users
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {SEEDED_USER_IDS.map((uid) => {
                const name = resolveUsername(uid);
                const userTasks = tasks.filter((t) => t.assignee_id === uid);
                const activeCnt = userTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
                return (
                  <div key={uid} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold uppercase">
                        {name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{name}</p>
                        <p className="text-xs text-muted-foreground">{activeCnt} active task{activeCnt !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/audit')}
                      className="text-xs text-primary hover:underline"
                    >
                      View logs
                    </button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <QuickAction icon={Plus}      label="Create Document"  path="/documents/new" navigate={navigate} />
              <QuickAction icon={FileText}  label="All Documents"    path="/documents"     navigate={navigate} />
              <QuickAction icon={GitBranch} label="Workflows"        path="/workflows"     navigate={navigate} />
              <QuickAction icon={Shield}    label="Audit Log"        path="/audit"         navigate={navigate} />
              <QuickAction icon={Search}    label="Search & OCR"     path="/search"        navigate={navigate} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Tasks overview ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" /> All Active Tasks
            {activeTasks.length > 0 && (
              <Badge variant="info" className="ml-1">{activeTasks.length}</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="text-xs">
            View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : activeTasks.length === 0 ? (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-emerald-600 dark:text-emerald-400">
              <CheckSquare className="h-4 w-4" /> No active tasks — all clear
            </div>
          ) : (
            <div className="space-y-2">
              {activeTasks.slice(0, 6).map((task) => {
                const overdue = isOverdue(task.due_date);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all group hover:shadow-sm',
                      overdue ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/5' : 'border-border hover:border-primary/25'
                    )}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', overdue ? 'bg-red-100 dark:bg-red-900/20' : 'bg-primary/8')}>
                        {overdue
                          ? <AlertTriangle className="h-4 w-4 text-red-500" />
                          : <CheckSquare className="h-4 w-4 text-primary" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          Step {task.step_number} — Review Task
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Assigned to {resolveUsername(task.assignee_id)}
                          {task.due_date && <span className={cn('ml-2', overdue && 'text-red-500 font-medium')}>· {formatRelative(task.due_date)}</span>}
                        </p>
                      </div>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── System-wide audit feed ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> System Activity
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/audit')} className="text-xs">
            Full audit log <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <AuditTimeline logs={(allAudit ?? []).slice(0, 8)} loading={auditLoading} compact />
        </CardContent>
      </Card>

      {/* ── Notifications ── */}
      {unreadCount > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Unread Notifications
              <Badge variant="default">{unreadCount}</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')} className="text-xs">
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notifications.filter((n) => !n.read).slice(0, 3).map((n) => (
                <div key={n.id} className="p-3 rounded-lg bg-background border border-primary/15 text-xs">
                  <p className="font-medium text-foreground line-clamp-2">{n.message}</p>
                  <p className="text-muted-foreground mt-1">{formatRelative(n.created_at)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── User Dashboard (reviewer / submitter) ────────────────────────────────────
function UserDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const { data: myTasks, isLoading: tasksLoading } = useQuery({
    queryKey: QUERY_KEYS.tasks(user?.user_id ?? ''),
    queryFn: () => tasksApi.list(user!.user_id),
    enabled: !!user?.user_id,
  });

  const { data: recentAudit, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-recent', user?.user_id],
    queryFn: () => auditApi.getLogs({ actor_id: user!.user_id }),
    enabled: !!user?.user_id,
  });

  const activeTasks    = myTasks?.filter((t) => t.status === 'pending' || t.status === 'in_progress') ?? [];
  const completedTasks = myTasks?.filter((t) => t.status === 'completed') ?? [];

  const stats = [
    { label: 'Active Tasks',          value: activeTasks.length,       sub: 'assigned to you',  icon: CheckSquare, color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20',   ring: 'ring-blue-100 dark:ring-blue-900/30',   onClick: () => navigate('/tasks') },
    { label: 'Completed Tasks',       value: completedTasks.length,    sub: 'all time',          icon: TrendingUp,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'ring-emerald-100 dark:ring-emerald-900/30', onClick: () => navigate('/tasks') },
    { label: 'Audit Events',          value: recentAudit?.length ?? 0, sub: 'by you',            icon: Shield,      color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20', ring: 'ring-violet-100 dark:ring-violet-900/30', onClick: () => navigate('/audit') },
    { label: 'Unread Notifications',  value: unreadCount,              sub: 'awaiting review',   icon: Bell,        color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20',  ring: 'ring-amber-100 dark:ring-amber-900/30',  onClick: () => navigate('/notifications') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.username ?? 'there'}. Here's your activity.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
              <Search className="h-4 w-4" /> Search
            </Button>
            {canCreateDocument(user?.roles ?? []) && (
              <Button size="sm" onClick={() => navigate('/documents/new')}>
                <Plus className="h-4 w-4" /> New Document
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tasksLoading || auditLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          : stats.map((s) => <StatCard key={s.label} {...s} />)
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">My Active Tasks</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="text-xs">
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : activeTasks.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                    <CheckSquare className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-foreground">No active tasks</p>
                  <p className="text-xs text-muted-foreground mt-1">Tasks assigned to you will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/25 hover:bg-muted/30 cursor-pointer transition-all group"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 group-hover:bg-primary/15 transition-colors">
                          <CheckSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">Step {task.step_number} — Review Task</p>
                          <p className="text-xs text-muted-foreground">Workflow task</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.due_date && <span className="text-xs text-muted-foreground hidden sm:block">{formatRelative(task.due_date)}</span>}
                        <TaskStatusBadge status={task.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {canCreateDocument(user?.roles ?? []) && <QuickAction icon={Plus} label="Create Document" path="/documents/new" navigate={navigate} />}
              <QuickAction icon={FileText}  label="Browse Documents" path="/documents"  navigate={navigate} />
              <QuickAction icon={GitBranch} label="View Workflows"   path="/workflows"  navigate={navigate} />
              <QuickAction icon={Search}    label="Search & OCR"     path="/search"     navigate={navigate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Notifications</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')} className="text-xs">
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {notifications.slice(0, 4).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 4).map((n) => (
                    <div key={n.id} className={cn('p-3 rounded-lg text-xs border', !n.read ? 'bg-primary/5 border-primary/15' : 'bg-muted/30 border-transparent')}>
                      <p className={cn('leading-relaxed line-clamp-2', !n.read ? 'font-medium text-foreground' : 'text-foreground/80')}>{n.message}</p>
                      <p className="text-muted-foreground mt-1">{formatRelative(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/audit')} className="text-xs">
            View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <AuditTimeline logs={(recentAudit ?? []).slice(0, 5)} loading={auditLoading} compact />
        </CardContent>
      </Card>
    </div>
  );
}
