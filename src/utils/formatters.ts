import { addDays, format, formatDistanceToNow, isAfter, parseISO } from 'date-fns';

/** Staff must act on an assigned document within this many days (matches backend SLA). */
export const ASSIGNMENT_DUE_DAYS = 3;

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

export function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

/** Effective due date from persisted due_date or assignment time + SLA days. */
export function effectiveDueDate(
  dueDateStr?: string | null,
  assignedAtStr?: string | null
): string | null {
  if (dueDateStr?.trim()) return dueDateStr;
  if (!assignedAtStr?.trim()) return null;
  try {
    return addDays(parseISO(assignedAtStr), ASSIGNMENT_DUE_DAYS).toISOString();
  } catch {
    return null;
  }
}

export function isOverdue(dueDateStr?: string | null, assignedAtStr?: string | null): boolean {
  const due = effectiveDueDate(dueDateStr, assignedAtStr);
  if (!due) return false;
  try {
    return isAfter(new Date(), parseISO(due));
  } catch {
    return false;
  }
}

export function isTaskOverdue(task: {
  due_date?: string | null;
  created_at?: string;
  status?: string;
  is_overdue?: boolean;
}): boolean {
  if (task.is_overdue === true) return true;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  return isOverdue(task.due_date, task.created_at);
}

export function isDirectMessageAssignmentOverdue(assignedAtStr?: string | null): boolean {
  if (!assignedAtStr?.trim()) return false;
  return isOverdue(null, assignedAtStr);
}

/** Whether the current user's assignment on this document is past the SLA. */
export function isDocumentAssignmentOverdue(
  doc: { id: string; status: string; delivery_mode?: string | null; owner_id?: string | null; updated_at?: string },
  options: {
    userId?: string;
    tasks?: Array<{
      document_id?: string | null;
      assignee_id?: string;
      status?: string;
      due_date?: string | null;
      created_at?: string;
      is_overdue?: boolean;
    }>;
    isDirectMessageRecipient?: boolean;
    directMessageAssignedAt?: string | null;
  }
): boolean {
  if (doc.status !== 'pending' || !options.userId) return false;

  const task = options.tasks?.find(
    (t) =>
      t.document_id === doc.id &&
      t.assignee_id === options.userId &&
      (t.status === 'pending' || t.status === 'in_progress')
  );
  if (task) return isTaskOverdue(task);

  if (
    doc.delivery_mode === 'direct_message' &&
    options.isDirectMessageRecipient &&
    doc.owner_id !== options.userId
  ) {
    return isDirectMessageAssignmentOverdue(
      options.directMessageAssignedAt ?? doc.updated_at ?? null
    );
  }

  return false;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '…';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAction(action: string): string {
  return action.replace(/\./g, ' › ').replace(/_/g, ' ');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
