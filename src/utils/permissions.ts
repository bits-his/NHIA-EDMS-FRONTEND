import type { DocumentStatus } from '@/types/document';

/**
 * Determines which document actions are available based on current status and user roles.
 */
export function getDocumentActions(
  status: DocumentStatus,
  roles: string[]
): {
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canArchive: boolean;
} {
  const isAdmin = roles.includes('admin');
  const isReviewer = roles.includes('reviewer');
  const isSubmitter = roles.includes('submitter');

  return {
    canEdit: status === 'draft' && (isAdmin || isSubmitter),
    canSubmit: status === 'draft' && (isAdmin || isSubmitter),
    canApprove: status === 'pending' && (isAdmin || isReviewer),
    canReject: status === 'pending' && (isAdmin || isReviewer),
    canArchive: status === 'approved' && isAdmin,
  };
}

export function canCreateDocument(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('submitter');
}

export function canViewAuditLogs(_roles: string[]): boolean {
  return true; // All authenticated users
}

export function canIndexSearch(roles: string[]): boolean {
  return roles.includes('admin');
}

export function canAdvanceWorkflow(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('reviewer');
}
