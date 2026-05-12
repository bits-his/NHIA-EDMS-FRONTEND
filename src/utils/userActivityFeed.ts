import { parseISO } from 'date-fns';
import type { AuditLog } from '@/types/audit';
import type { Document } from '@/types/document';
import type { Task } from '@/types/task';

function timeMs(iso: string): number {
  try {
    return parseISO(iso).getTime();
  } catch {
    return 0;
  }
}

/** True if audit already records document creation for this id. */
function auditHasDocumentCreate(auditLogs: AuditLog[], documentId: string): boolean {
  return auditLogs.some(
    (l) =>
      l.entity_type === 'document' &&
      l.entity_id === documentId &&
      (l.action === 'document.create' || l.action === 'document.created')
  );
}

/**
 * Merges audit rows for the user with derived events from their documents and tasks
 * (document creation is often not written to audit when POST /documents is used directly).
 */
export function buildUserDashboardActivityFeed(params: {
  userId: string;
  auditLogs: AuditLog[];
  myDocuments: Document[];
  myTasks: Task[];
  limit?: number;
  /** Shown on synthetic feed rows (same user as `userId`) so the timeline shows a name, not a UUID fragment. */
  viewerDisplay?: { username?: string | null; full_name?: string | null };
}): AuditLog[] {
  const { userId, auditLogs, myDocuments, myTasks, limit = 40, viewerDisplay } = params;

  const syntheticActor: Pick<AuditLog, 'actor_username' | 'actor_full_name'> = {};
  if (viewerDisplay?.username?.trim()) {
    syntheticActor.actor_username = viewerDisplay.username.trim();
  }
  const fn = viewerDisplay?.full_name?.trim();
  if (fn) syntheticActor.actor_full_name = fn;

  const synthetic: AuditLog[] = [];

  for (const d of myDocuments) {
    if (!d.id || d.owner_id !== userId) continue;
    if (auditHasDocumentCreate(auditLogs, d.id)) continue;
    synthetic.push({
      id: `dashboard-feed-doc-create-${d.id}`,
      actor_id: userId,
      ...syntheticActor,
      action: 'document.create',
      entity_type: 'document',
      entity_id: d.id,
      payload: { title: d.title, status: d.status },
      created_at: d.created_at,
    });
  }

  for (const t of myTasks) {
    if (t.assignee_id !== userId) continue;
    synthetic.push({
      id: `dashboard-feed-task-assigned-${t.id}`,
      actor_id: userId,
      ...syntheticActor,
      action: 'task.assigned',
      entity_type: 'task',
      entity_id: t.id,
      payload: {
        step_number: t.step_number,
        document_id: t.document_id ?? undefined,
        status: t.status,
      },
      created_at: t.created_at,
    });
    if (t.status === 'completed') {
      synthetic.push({
        id: `dashboard-feed-task-completed-${t.id}`,
        actor_id: userId,
        ...syntheticActor,
        action: 'task.completed',
        entity_type: 'task',
        entity_id: t.id,
        payload: { step_number: t.step_number, document_id: t.document_id ?? undefined },
        created_at: t.updated_at,
      });
    }
  }

  const merged = [...auditLogs, ...synthetic];
  merged.sort((a, b) => timeMs(b.created_at) - timeMs(a.created_at));

  const seen = new Set<string>();
  const out: AuditLog[] = [];
  for (const row of merged) {
    const key = `${row.action}:${row.entity_type ?? ''}:${row.entity_id ?? ''}:${row.created_at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}
