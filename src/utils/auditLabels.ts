import type { AuditLog } from '@/types/audit';
import { resolveUsername } from '@/utils/users';

const ACTION_TITLES: Record<string, string> = {
  'document.create': 'Document created',
  'document.created': 'Document created',
  'document.viewed': 'Document viewed',
  'document.updated': 'Document updated (saved)',
  'document.submitted': 'Document submitted for workflow',
  'document.approve': 'Document approved',
  'document.reject': 'Document rejected',
  'document.edit_forward': 'Edit forwarded (workflow note)',
  'document.approve_forward': 'Approved forward (signature applied)',
  'document.request_info': 'More information requested',
  'document.final_approve': 'Final approval (filed / archived)',
  'document.archive': 'Document archived',
  'task.assigned': 'Workflow task assigned',
  'task.completed': 'Workflow task completed',
  'workflow.advanced': 'Workflow advanced',
  'workflow.started': 'Workflow started',
  'workflow.resumed': 'Workflow resumed',
  'user.login': 'User signed in',
};

function titleCaseAction(action: string): string {
  return action
    .replace(/\./g, ' · ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanizeAuditAction(action: string): string {
  return ACTION_TITLES[action] ?? titleCaseAction(action);
}

/** Short badge for list rows: what the user did (view / edit / approve / …). */
export function auditActivityBadge(action: string): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';
} {
  const a = action || '';
  if (a === 'document.viewed') return { label: 'View', variant: 'info' };
  if (a === 'document.updated' || a === 'document.edit_forward') return { label: 'Edit', variant: 'warning' };
  if (a === 'document.reject') return { label: 'Reject', variant: 'destructive' };
  if (a === 'document.approve' || a === 'document.approve_forward' || a === 'document.final_approve') {
    return { label: 'Approve', variant: 'success' };
  }
  if (a === 'document.submitted') return { label: 'Submit', variant: 'info' };
  if (a === 'document.archive') return { label: 'Archive', variant: 'muted' };
  if (a === 'document.create' || a === 'document.created') return { label: 'Create', variant: 'default' };
  if (a === 'document.request_info') return { label: 'Request info', variant: 'warning' };
  if (a.startsWith('workflow.')) return { label: 'Workflow', variant: 'secondary' };
  if (a.startsWith('task.')) return { label: 'Task', variant: 'secondary' };
  if (a.startsWith('user.')) return { label: 'Account', variant: 'outline' };
  return { label: 'Activity', variant: 'muted' };
}

/** Prefer server-provided profile fields, then known-user map, then shortened id. */
export function auditActorDisplayName(log: Pick<AuditLog, 'actor_id' | 'actor_full_name' | 'actor_username'>): string {
  const full = typeof log.actor_full_name === 'string' ? log.actor_full_name.trim() : '';
  if (full) return full;
  const un = typeof log.actor_username === 'string' ? log.actor_username.trim() : '';
  if (un) return un;
  return resolveUsername(log.actor_id);
}

/** One-line context from payload for list views (non-JSON). */
export function summarizeAuditPayload(log: AuditLog): string | null {
  const p = log.payload;
  if (!p || typeof p !== 'object') return null;
  const parts: string[] = [];

  if (typeof p.title === 'string' && p.title.trim()) {
    parts.push(`“${p.title.trim()}”`);
  }
  if (typeof p.ref_number === 'string' && p.ref_number.trim()) {
    parts.push(`Ref ${p.ref_number.trim()}`);
  }
  if (typeof p.department === 'string' && p.department.trim()) {
    parts.push(p.department.trim());
  }
  if (typeof p.category === 'string' && p.category.trim()) {
    parts.push(String(p.category).replace(/_/g, ' '));
  }
  if (typeof p.status === 'string' && p.status.trim()) {
    parts.push(`Status: ${p.status}`);
  }
  if (typeof p.source === 'string' && (p.source === 'create' || p.source === 'upload')) {
    parts.push(p.source === 'upload' ? 'Uploaded file' : 'Created in app');
  }
  if (typeof p.original_filename === 'string' && p.original_filename.trim()) {
    parts.push(`File: ${p.original_filename}`);
  }
  if (typeof p.step_number === 'number') {
    parts.push(`Step ${p.step_number}`);
  }
  if (typeof p.comment === 'string' && p.comment.trim() && p.comment.length < 200) {
    parts.push(`Note: ${p.comment.trim()}`);
  }
  if (Array.isArray(p.fields_changed) && p.fields_changed.length > 0) {
    parts.push(`Updated: ${p.fields_changed.map(String).join(', ')}`);
  }
  if (typeof p.new_version_number === 'number' && Number.isFinite(p.new_version_number)) {
    parts.push(`New version ${p.new_version_number}`);
  }

  if (parts.length === 0) return null;
  return parts.slice(0, 5).join(' · ');
}
