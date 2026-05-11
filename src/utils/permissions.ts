import type { DocumentStatus } from '@/types/document';

export type DocumentActionContext = {
  /** JWT permission names (e.g. `submit_document`, `edit_document`) */
  permissions?: string[];
  /** Current user id — matched to document `owner_id` for draft edit/submit */
  userId?: string | null;
  /** Document `owner_id` */
  ownerId?: string | null;
  /** True when the user has a pending/in_progress task on this document for the workflow instance's current step. */
  hasActiveWorkflowTask?: boolean;
};

/**
 * Determines which document actions are available based on current status and user roles.
 * Aligns with document agent routes: final-approve (signatory gate on server), reject (comment),
 * edit-forward / approve-forward / request-info, submit, archive.
 */
export function getDocumentActions(
  status: DocumentStatus,
  roles: string[],
  context: DocumentActionContext = {}
): {
  canEdit: boolean;
  canSubmit: boolean;
  canFinalApprove: boolean;
  canReject: boolean;
  canArchive: boolean;
  canEditForward: boolean;
  canApproveForward: boolean;
  canRequestInfo: boolean;
} {
  const permissions = context.permissions ?? [];
  const isAdmin = roles.includes('admin');
  const isReviewer = roles.includes('reviewer');
  const isSubmitter = roles.includes('submitter');
  const isDirector = roles.includes('director');

  const uid = context.userId?.trim();
  const oid = context.ownerId?.trim();
  const isDraftOwner = Boolean(uid && oid && uid === oid);

  const canEditDraftBody =
    isAdmin || isSubmitter || isDraftOwner || permissions.includes('edit_document');
  const canSubmitDraft =
    isAdmin || isSubmitter || isDraftOwner || permissions.includes('submit_document');

  const hasActiveWorkflowTask = context.hasActiveWorkflowTask === true;
  /** Pending memo: only the assignee for the current workflow step may act (matches server task gate). */
  const pendingMyStep = status === 'pending' && hasActiveWorkflowTask;
  const canEditPendingMemo = pendingMyStep;

  return {
    canEdit: (status === 'draft' && canEditDraftBody) || canEditPendingMemo,
    canSubmit: status === 'draft' && canSubmitDraft,
    canFinalApprove: pendingMyStep,
    canReject: pendingMyStep,
    canArchive: status === 'approved' && isAdmin,
    canEditForward:
      (status === 'draft' && (isAdmin || isSubmitter || isReviewer || isDirector)) ||
      pendingMyStep,
    canApproveForward: pendingMyStep,
    canRequestInfo: pendingMyStep,
  };
}

export function canCreateDocument(roles: string[], permissions: string[] = []): boolean {
  if (roles.includes('admin') || roles.includes('submitter')) return true;
  if (permissions.includes('create_document')) return true;
  // Backward compatibility for any legacy permission payloads.
  return permissions.includes('write');
}

/**
 * Cross-user operational dashboard (matches document agent `canViewAllDocuments` /
 * task agent `canViewAllTasks`): org-wide document and task visibility for oversight roles.
 */
export function canViewOperationalOverview(roles: string[], permissions: string[] = []): boolean {
  if (roles.some((r) => ['admin', 'director', 'reviewer'].includes(r))) return true;
  return permissions.includes('manage_documents') || permissions.includes('manage_users');
}

export function canViewAuditLogs(_roles: string[]): boolean {
  return true;
}

export function canIndexSearch(roles: string[]): boolean {
  return roles.includes('admin');
}

/** Enterprise template builder — administrators & records / submission roles. */
export function canAccessTemplateManagement(roles: string[]): boolean {
  return roles.some((r) => ['admin', 'submitter', 'director'].includes(r));
}
