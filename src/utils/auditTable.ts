import { parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import type { AuditLog } from '@/types/audit';
import { auditActorDisplayName, auditActivityBadge, humanizeAuditAction } from '@/utils/auditLabels';
import {
  auditActionPhrase,
  auditActorBlock,
  documentContextFromLog,
  effectiveAuditActionPhrase,
  effectiveAuditBadge,
  effectiveHumanizeAuditAction,
  isCommentLedAuditLog,
  payloadCommentPreview,
  staffOrgLine,
} from '@/utils/auditDisplay';

export type AuditActionFilter =
  | 'all'
  | 'view'
  | 'comment'
  | 'edit'
  | 'approve'
  | 'reject'
  | 'workflow'
  | 'account'
  | 'other';

export const AUDIT_ACTION_FILTER_OPTIONS: { value: AuditActionFilter; label: string }[] = [
  { value: 'all', label: 'All actions' },
  { value: 'comment', label: 'Comments' },
  { value: 'view', label: 'Views' },
  { value: 'edit', label: 'Edits' },
  { value: 'approve', label: 'Approvals' },
  { value: 'reject', label: 'Rejections' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'account', label: 'Sign-in' },
  { value: 'other', label: 'Other' },
];

export function auditActionCategory(log: AuditLog): AuditActionFilter {
  if (isCommentLedAuditLog(log)) return 'comment';
  const a = log.action || '';
  if (a === 'document.viewed') return 'view';
  if (
    a === 'document.comment' ||
    a === 'document.discussion.message' ||
    a === 'document.discussion.created'
  ) {
    return 'comment';
  }
  if (
    a === 'document.updated' ||
    a === 'document.edit_forward' ||
    a === 'document.create' ||
    a === 'document.created' ||
    a === 'document.submitted'
  ) {
    return 'edit';
  }
  if (
    a === 'document.approve' ||
    a === 'document.approve_forward' ||
    a === 'document.final_approve' ||
    a === 'document.archive'
  ) {
    return 'approve';
  }
  if (a === 'document.reject' || a === 'document.request_info') return 'reject';
  if (a.startsWith('workflow.') || a.startsWith('task.')) return 'workflow';
  if (a.startsWith('user.')) return 'account';
  return 'other';
}

export interface AuditTableFilters {
  text: string;
  actionFilter: AuditActionFilter;
  dateFrom: string;
  dateTo: string;
}

/** Drop legacy edit_forward rows when a matching document.comment exists. */
export function dedupeCommentAuditRows(logs: AuditLog[]): AuditLog[] {
  const commentKeys = new Set<string>();
  for (const log of logs) {
    if (log.action !== 'document.comment') continue;
    const preview = payloadCommentPreview(log);
    if (!preview) continue;
    commentKeys.add(`${log.actor_id}|${log.entity_id}|${preview.toLowerCase()}`);
  }
  return logs.filter((log) => {
    if (log.action !== 'document.edit_forward') return true;
    const preview = payloadCommentPreview(log);
    if (!preview) return true;
    const p = log.payload;
    if (p && typeof p === 'object' && p.next_user_id) return true;
    const key = `${log.actor_id}|${log.entity_id}|${preview.toLowerCase()}`;
    return !commentKeys.has(key);
  });
}

export function filterAuditLogs(logs: AuditLog[], filters: AuditTableFilters): AuditLog[] {
  const q = filters.text.trim().toLowerCase();
  const from = filters.dateFrom ? startOfDay(parseISO(filters.dateFrom)) : null;
  const to = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : null;

  return logs.filter((log) => {
    if (filters.actionFilter !== 'all') {
      const category = auditActionCategory(log);
      if (category !== filters.actionFilter) {
        return false;
      }
    }

    if (from || to) {
      try {
        const at = parseISO(log.created_at);
        if (from && isBefore(at, from)) return false;
        if (to && isAfter(at, to)) return false;
      } catch {
        /* keep row */
      }
    }

    if (!q) return true;

    const ctx = documentContextFromLog(log);
    const actor = auditActorBlock(log);
    const comment = payloadCommentPreview(log);
    const haystack = [
      effectiveHumanizeAuditAction(log),
      effectiveAuditActionPhrase(log),
      actor.name,
      actor.orgLine,
      actor.rank,
      ctx?.title,
      ctx?.refNumber,
      ctx?.department,
      comment,
      log.action,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function auditDocumentCell(log: AuditLog): { primary: string; secondary: string | null } {
  const ctx = documentContextFromLog(log);
  if (!ctx) {
    return { primary: '—', secondary: null };
  }
  return {
    primary: ctx.title ?? ctx.refNumber ?? 'Document',
    secondary: [ctx.refNumber, ctx.department].filter(Boolean).join(' · ') || null,
  };
}

export function auditStaffCell(log: AuditLog): { primary: string; secondary: string | null } {
  const actor = auditActorBlock(log);
  return {
    primary: actor.name,
    secondary: [actor.rank, actor.orgLine].filter(Boolean).join(' · ') || null,
  };
}

export function auditSummaryCell(log: AuditLog): string {
  const comment = payloadCommentPreview(log);
  if (isCommentLedAuditLog(log)) {
    return comment ?? effectiveAuditActionPhrase(log);
  }
  if (comment && auditActionCategory(log) !== 'comment') {
    return `${auditActionPhrase(log)} — “${comment}”`;
  }
  return effectiveAuditActionPhrase(log);
}

export { auditActivityBadge, humanizeAuditAction, auditActorDisplayName };
