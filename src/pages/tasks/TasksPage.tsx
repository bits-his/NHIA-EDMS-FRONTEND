import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Clock, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { tasksApi } from '@/api/tasks';
import { documentsApi } from '@/api/documents';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/utils/constants';
import { formatRelative, isOverdue } from '@/utils/formatters';
import type { TaskStatus, Task } from '@/types/task';
import { cn } from '@/utils/cn';

const FILTER_TABS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
];

export default function TasksPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');

  const { data: tasks, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.tasks(user?.user_id ?? ''),
    queryFn: () => tasksApi.list(user!.user_id),
    enabled: !!user?.user_id,
  });

  const filtered = (tasks ?? []).filter((t) => statusFilter === 'all' || t.status === statusFilter);

  const counts = {
    all:         tasks?.length ?? 0,
    pending:     tasks?.filter((t) => t.status === 'pending').length ?? 0,
    in_progress: tasks?.filter((t) => t.status === 'in_progress').length ?? 0,
    completed:   tasks?.filter((t) => t.status === 'completed').length ?? 0,
    cancelled:   tasks?.filter((t) => t.status === 'cancelled').length ?? 0,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="My Tasks" description="Tasks assigned to you" />

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap p-1 bg-muted rounded-lg w-fit">
        {FILTER_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              statusFilter === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
            <span className={cn('ml-1.5 text-xs', statusFilter === value ? 'text-muted-foreground' : 'text-muted-foreground/60')}>
              ({counts[value]})
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[72px] rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description={statusFilter === 'all' ? 'No tasks have been assigned to you yet' : `No ${statusFilter.replace('_', ' ')} tasks`}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} onClick={() => navigate(`/tasks/${task.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task.due_date) && task.status !== 'completed' && task.status !== 'cancelled';

  const { data: document } = useQuery({
    queryKey: QUERY_KEYS.document(task.document_id ?? ''),
    queryFn: () => documentsApi.getById(task.document_id!),
    enabled: !!task.document_id,
  });

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 rounded-xl border bg-card cursor-pointer transition-all duration-150 group',
        overdue
          ? 'border-red-200 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-800'
          : 'border-border hover:border-primary/25 hover:shadow-card'
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          overdue ? 'bg-red-50 dark:bg-red-900/20' : 'bg-primary/8 group-hover:bg-primary/15 transition-colors'
        )}>
          {overdue
            ? <AlertCircle className="h-4 w-4 text-red-500" />
            : <CheckSquare className="h-4 w-4 text-primary" />
          }
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {document ? document.title : `Step ${task.step_number} — Review Task`}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">Step {task.step_number}</span>
            {document && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className={cn(
                  'text-xs capitalize flex items-center gap-0.5',
                  document.status === 'pending' ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'
                )}>
                  <FileText className="h-3 w-3" /> {document.status}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {task.due_date && (
          <div className={cn('flex items-center gap-1 text-xs hidden sm:flex', overdue ? 'text-red-500' : 'text-muted-foreground')}>
            <Clock className="h-3 w-3" />
            {overdue ? 'Overdue · ' : ''}{formatRelative(task.due_date)}
          </div>
        )}
        <TaskStatusBadge status={task.status} />
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
      </div>
    </div>
  );
}
