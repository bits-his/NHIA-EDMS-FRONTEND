import type { AuditLog } from '@/types/audit';
import type { UserRecord } from '@/api/auth';
import type { Role } from '@/types/auth';
import { auditActorDisplayName, auditActivityBadge, humanizeAuditAction } from '@/utils/auditLabels';

export function roleDisplayLabel(role: Pick<Role, 'name' | 'description'>): string {
  const d = role.description?.trim();
  if (d) return d;
  return role.name.replace(/_/g, ' ');
}

/** Primary rank/role label for a staff record. */
export function staffRankLabel(user: Pick<UserRecord, 'rank' | 'roles'>): string | null {
  const rank = user.rank?.trim();
  if (rank) return rank;
  const first = user.roles?.[0];
  if (first) return roleDisplayLabel(first);
  return null;
}

type StaffOrgSource = {
  department?: string | null;
  unit?: string | null;
  staff_id?: string | null;
  username?: string | null;
  actor_department?: string | null;
  actor_unit?: string | null;
  actor_staff_id?: string | null;
  actor_username?: string | null;
};

/** Org context line: department · unit · staff ID · username */
export function staffOrgLine(source: StaffOrgSource): string {
  const department = source.department?.trim() || source.actor_department?.trim() || '';
  const unit = source.unit?.trim() || source.actor_unit?.trim() || '';
  const staffId = source.staff_id?.trim() || source.actor_staff_id?.trim() || '';
  const username = source.username?.trim() || source.actor_username?.trim() || '';

  return [
    department || null,
    unit && unit !== department ? unit : null,
    staffId ? `ID ${staffId}` : null,
    username ? `@${username}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function auditActorRank(log: AuditLog): string | null {
  const rank = log.actor_rank?.trim();
  if (rank) return rank;
  return null;
}

export interface AuditDocumentContext {
  title: string | null;
  refNumber: string | null;
  department: string | null;
  category: string | null;
  status: string | null;
}

export function documentContextFromLog(log: AuditLog): AuditDocumentContext | null {
  const p = log.payload;
  if (!p || typeof p !== 'object') return null;

  const title = typeof p.title === 'string' && p.title.trim() ? p.title.trim() : null;
  const refNumber = typeof p.ref_number === 'string' && p.ref_number.trim() ? p.ref_number.trim() : null;
  const department = typeof p.department === 'string' && p.department.trim() ? p.department.trim() : null;
  const category =
    typeof p.category === 'string' && p.category.trim()
      ? String(p.category).replace(/_/g, ' ')
      : null;
  const status = typeof p.status === 'string' && p.status.trim() ? p.status.trim() : null;

  if (!title && !refNumber && !department && !category && !status) return null;
  return { title, refNumber, department, category, status };
}

/** Short action phrase without actor name (for card headline). */
export function payloadCommentPreview(log: AuditLog): string | null {
  const p = log.payload;
  if (!p || typeof p !== 'object') return null;
  if (typeof p.comment_preview === 'string' && p.comment_preview.trim()) {
    return p.comment_preview.trim();
  }
  if (typeof p.comment === 'string' && p.comment.trim()) {
    const c = p.comment.trim();
    return c.length > 160 ? `${c.slice(0, 160)}…` : c;
  }
  return null;
}

/** True when the row is primarily someone leaving a note (not forwarding the file). */
export function isCommentLedAuditLog(log: AuditLog): boolean {
  if (log.action === 'document.comment' || log.action === 'document.discussion.message') {
    return true;
  }
  if (log.action === 'document.edit_forward' && payloadCommentPreview(log)) {
    const p = log.payload;
    if (p && typeof p === 'object' && p.next_user_id) return false;
    return true;
  }
  return false;
}

export function effectiveAuditBadge(log: AuditLog): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';
} {
  if (isCommentLedAuditLog(log)) {
    return { label: 'Comment', variant: 'info' };
  }
  return auditActivityBadge(log.action);
}

export function effectiveHumanizeAuditAction(log: AuditLog): string {
  if (isCommentLedAuditLog(log)) return 'Comment on document';
  return humanizeAuditAction(log.action);
}

export function effectiveAuditActionPhrase(log: AuditLog): string {
  if (isCommentLedAuditLog(log)) {
    const ctx = documentContextFromLog(log);
    const docLabel = ctx?.title ? `“${ctx.title}”` : 'a document';
    const commentPreview = payloadCommentPreview(log);
    return commentPreview
      ? `Commented on ${docLabel}: ${commentPreview}`
      : `Commented on ${docLabel}`;
  }
  return auditActionPhrase(log);
}

export function auditActionPhrase(log: AuditLog): string {
  const ctx = documentContextFromLog(log);
  const docLabel = ctx?.title ? `“${ctx.title}”` : 'a document';
  const commentPreview = payloadCommentPreview(log);

  if (log.action === 'document.comment') {
    return commentPreview
      ? `Commented on ${docLabel}: ${commentPreview}`
      : `Commented on ${docLabel}`;
  }

  switch (log.action) {
    case 'document.viewed':
      return `Opened ${docLabel}`;
    case 'document.updated':
      return `Saved changes to ${docLabel}`;
    case 'document.submitted':
      return `Submitted ${docLabel} for review`;
    case 'document.approve':
    case 'document.approve_forward':
      return `Approved ${docLabel}`;
    case 'document.reject':
      return `Returned ${docLabel}`;
    case 'document.archive':
    case 'document.final_approve':
      return `Filed / archived ${docLabel}`;
    case 'user.login':
      return 'Signed in';
    default:
      return humanizeAuditAction(log.action);
  }
}

export function auditActorBlock(log: AuditLog): { name: string; orgLine: string; rank: string | null } {
  return {
    name: auditActorDisplayName(log),
    orgLine: staffOrgLine(log),
    rank: auditActorRank(log),
  };
}
