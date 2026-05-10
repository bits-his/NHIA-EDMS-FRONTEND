import type { DocumentStatus } from '@/types/document';

/**
 * Determines which document actions are available based on current status and user roles.
 * Aligns with document agent routes: final-approve (signatory gate on server), reject (comment),
 * edit-forward / approve-forward / request-info, submit, archive.
 */
export function getDocumentActions(
  status: DocumentStatus,
  roles: string[]
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
  const isAdmin = roles.includes('admin');
  const isReviewer = roles.includes('reviewer');
  const isSubmitter = roles.includes('submitter');
  const isDirector = roles.includes('director');
  const reviewerLike = isAdmin || isReviewer || isDirector;

  return {
    canEdit: status === 'draft' && (isAdmin || isSubmitter),
    canSubmit: status === 'draft' && (isAdmin || isSubmitter),
    canFinalApprove: status === 'pending' && reviewerLike,
    canReject: status === 'pending' && reviewerLike,
    canArchive: status === 'approved' && isAdmin,
    canEditForward:
      (status === 'draft' || status === 'pending') &&
      (isAdmin || isSubmitter || isReviewer || isDirector),
    canApproveForward: status === 'pending' && reviewerLike,
    canRequestInfo: status === 'pending' && reviewerLike,
  };
}

export function canCreateDocument(roles: string[], permissions: string[] = []): boolean {
  if (roles.includes('admin') || roles.includes('submitter')) return true;
  if (permissions.includes('create_document')) return true;
  // Backward compatibility for any legacy permission payloads.
  return permissions.includes('write');
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
