import { History, ListOrdered, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/shared/Skeleton';
import { formatDateTime } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import type { DocumentVersion, DocumentWorkflowAction } from '@/types/document';

const ACTION_LABELS: Record<string, string> = {
  reject: 'Rejected',
  edit_forward: 'Edit & forward',
  approve_forward: 'Approve & forward',
  request_info: 'Request for more information',
  final_approve: 'Final approval',
};

interface DocumentActivitySidebarProps {
  createdAt: string;
  actions: DocumentWorkflowAction[] | undefined;
  actionsLoading: boolean;
  versions: DocumentVersion[] | undefined;
  versionsLoading: boolean;
}

export function DocumentActivitySidebar({
  createdAt,
  actions,
  actionsLoading,
  versions,
  versionsLoading,
}: DocumentActivitySidebarProps) {
  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recorded in system
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Created (auto timestamp)</p>
          <p className="text-sm font-medium tabular-nums">{formatDateTime(createdAt)}</p>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
            Actions taken
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal pt-1">
            Reject, edit/approve forward, requests, final approval — with timestamp.
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {actionsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !actions?.length ? (
            <p className="text-sm text-muted-foreground">No workflow actions yet.</p>
          ) : (
            <ScrollArea className="h-[min(280px,40vh)] pr-2">
              <ul className="space-y-3 text-sm">
                {actions.map((a) => (
                  <li
                    key={a.id}
                    className="border-l-2 border-primary/30 pl-3 py-0.5"
                  >
                    <p className="font-medium text-foreground">
                      {ACTION_LABELS[a.action] ?? a.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(a.created_at)} · {resolveUsername(a.actor_id)}
                    </p>
                    {a.comment ? (
                      <p className="text-xs mt-1 text-foreground/90 bg-muted/50 rounded-md px-2 py-1.5">
                        {a.comment}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Document history
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal pt-1">Content versions over time.</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {versionsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !versions?.length ? (
            <p className="text-sm text-muted-foreground">No versions.</p>
          ) : (
            <ScrollArea className="h-[min(220px,32vh)] pr-2">
              <ul className="space-y-2 text-sm">
                {[...versions]
                  .sort((a, b) => b.version_number - a.version_number)
                  .map((v) => (
                    <li
                      key={v.id}
                      className="flex justify-between gap-2 border border-border/60 rounded-lg px-2 py-1.5"
                    >
                      <span className="font-medium">v{v.version_number}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(v.created_at)}
                      </span>
                    </li>
                  ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
