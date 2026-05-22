import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Check, CheckCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { notificationsApi } from '@/api/notifications';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { QUERY_KEYS } from '@/utils/constants';
import { formatRelative } from '@/utils/formatters';
import { getErrorMessage } from '@/api/client';
import { cn } from '@/utils/cn';
import { notificationTypeLabel } from '@/utils/notificationDisplay';
import type { Notification } from '@/types/notification';

type FilterMode = 'all' | 'unread';

export default function NotificationsPage() {
  const user = useAuthStore((s) => s.user);
  const { markRead: markReadStore, markAllRead, setNotifications } = useNotificationStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>('all');

  const { data: notifications, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.notifications(user?.user_id ?? ''),
    queryFn: () => notificationsApi.getAll(user!.user_id),
    enabled: !!user?.user_id,
  });

  useEffect(() => {
    if (notifications) setNotifications(notifications);
  }, [notifications, setNotifications]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: (_: Notification, id: string) => {
      markReadStore(id);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications(user!.user_id) });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const notificationList: Notification[] = notifications ?? [];
  const filtered = notificationList.filter((n) => filter === 'all' ? true : !n.read);
  const unreadCount = notificationList.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    const unread = notificationList.filter((n) => !n.read);
    await Promise.allSettled(unread.map((n) => notificationsApi.markRead(n.id)));
    markAllRead();
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications(user!.user_id) });
    toast.success('All notifications marked as read');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Stay up to date with document activity"
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg w-fit">
        {([
          { value: 'all',    label: `All (${notificationList.length})` },
          { value: 'unread', label: `Unread (${unreadCount})` },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              filter === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? 'All caught up' : 'No notifications'}
          description={filter === 'unread' ? 'You have no unread notifications' : 'Notifications will appear here when documents are updated'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const typeLabel = notificationTypeLabel(n.type);
            return (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-4 p-4 rounded-xl border transition-all',
                !n.read
                  ? 'bg-primary/5 border-primary/15 hover:bg-primary/8'
                  : 'bg-card border-border hover:bg-muted/30'
              )}
            >
              {/* Icon */}
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5',
                !n.read ? 'bg-primary/10' : 'bg-muted'
              )}>
                <Bell className={cn('h-4 w-4', !n.read ? 'text-primary' : 'text-muted-foreground')} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm leading-relaxed', !n.read ? 'font-medium text-foreground' : 'text-foreground/80')}>
                  {n.message}
                </p>
                <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                  {typeLabel && (
                    <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {typeLabel}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {formatRelative(n.created_at)}
                  </span>
                </div>
              </div>

              {/* Mark read */}
              {!n.read && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => markReadMutation.mutate(n.id)}
                  disabled={markReadMutation.isPending}
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  title="Mark as read"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
