import type { DocumentDeliveryMode, DocumentStatus } from '@/types/document';

export type DocumentActionContext = {
  /** JWT permission names (e.g. `submit_document`, `edit_document`) */
  permissions?: string[];
  /** Current user id — matched to document `owner_id` for draft edit/submit */
  userId?: string | null;
  /** Document `owner_id` */
  ownerId?: string | null;
  /** True when the user has a pending/in_progress task on this document for the workflow instance's current step. */
  hasActiveWorkflowTask?: boolean;
  /** Document `delivery_mode` — used for direct-message vs workflow behaviour. */
  deliveryMode?: DocumentDeliveryMode | null;
  /** True when the current user is listed in document recipients (direct message path). */
  isDirectMessageRecipient?: boolean;
};

/** Normalize `workflow_templates.steps[].action_type` for comparisons. */
export function normalizeWorkflowStepActionType(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase().replace(/-/g, '_');
}

/**
 * Determines which document actions are available based on current status and user roles.
 * Aligns with document agent routes: final-approve, reject (comment),
 * approve-forward (signature stamp on server), request-info, submit, archive.
 *
 * When `workflowStepActionType` is set and the user is on the active workflow step (`pending` + task),
 * buttons are narrowed to match the template step’s `action_type` (review vs approve vs final approve).
 */
export function getDocumentActions(
  status: DocumentStatus,
  roles: string[],
  context: DocumentActionContext = {},
  workflowStepActionType?: string | null
): {
  canEdit: boolean;
  canSubmit: boolean;
  canFinalApprove: boolean;
  canReject: boolean;
  canArchive: boolean;
  canEditForward: boolean;
  canApproveForward: boolean;
  canRequestInfo: boolean;
  /** Pending direct-message: owner may approve (pending → approved) after recipient input. */
  canApproveDirectMessage: boolean;
} {
  const permissions = context.permissions ?? [];
  const isAdmin = roles.includes('admin');
  const isSubmitter = roles.includes('submitter');

  const uid = context.userId?.trim();
  const oid = context.ownerId?.trim();
  const isDraftOwner = Boolean(uid && oid && uid === oid);

  const dm = context.deliveryMode === 'direct_message';
  const isDmRecipient =
    status === 'pending' &&
    dm &&
    context.isDirectMessageRecipient === true &&
    Boolean(uid);
  const isDmOwner = status === 'pending' && dm && isDraftOwner;

  if (isDmRecipient) {
    return {
      canEdit: false,
      canSubmit: false,
      canFinalApprove: false,
      canReject: true,
      canArchive: false,
      canEditForward: true,
      canApproveForward: false,
      canRequestInfo: true,
      canApproveDirectMessage: isDraftOwner,
    };
  }

  if (isDmOwner) {
    // The original sender may mark the document reviewed. They can comment /
    // forward only when the baton is explicitly sent back to them, handled by
    // the active direct-message recipient branch above.
    return {
      canEdit: false,
      canSubmit: false,
      canFinalApprove: false,
      canReject: false,
      canArchive: false,
      canEditForward: false,
      canApproveForward: false,
      canRequestInfo: false,
      canApproveDirectMessage: true,
    };
  }

  const canEditDraftBody =
    isAdmin || isSubmitter || isDraftOwner || permissions.includes('edit_document');
  const canSubmitDraft =
    isAdmin || isSubmitter || isDraftOwner || permissions.includes('submit_document');

  const hasActiveWorkflowTask = context.hasActiveWorkflowTask === true;
  /** Pending memo: only the assignee for the current workflow step may act (matches server task gate). */
  const pendingMyStep = status === 'pending' && hasActiveWorkflowTask;
  const canEditPendingMemo = pendingMyStep;

  const base = {
    canEdit: (status === 'draft' && canEditDraftBody) || canEditPendingMemo,
    canSubmit: status === 'draft' && canSubmitDraft,
    canFinalApprove: pendingMyStep,
    canReject: pendingMyStep,
    canArchive: status === 'approved' && isAdmin,
    /** Active step assignees may post a free-form comment on the document (no status change). */
    canEditForward: pendingMyStep,
    canApproveForward: pendingMyStep,
    canRequestInfo: pendingMyStep,
    canApproveDirectMessage: false,
  };

  if (!pendingMyStep || workflowStepActionType == null || String(workflowStepActionType).trim() === '') {
    return base;
  }

  const at = normalizeWorkflowStepActionType(workflowStepActionType);

  switch (at) {
    case 'final_approve':
      // Final approval + reject + request more information (no edit or approve-forward chain).
      return {
        ...base,
        canEdit: false,
        canApproveForward: false,
        canApproveDirectMessage: false,
      };
    case 'review':
      // Forward-only step (no approve-forward / final approve here, but free-form comment is fine).
      return {
        ...base,
        canApproveForward: false,
        canFinalApprove: false,
        canApproveDirectMessage: false,
      };
    case 'approve':
    case 'approve_forward':
      return {
        ...base,
        canFinalApprove: false,
        canApproveDirectMessage: false,
      };
    default:
      return base;
  }
}

export function showOfficerHomeDashboard(roles: string[]): boolean {
  return roles.some((r) => r === 'officer' || r === 'senior_officer');
}

export function canCreateDocument(roles: string[], permissions: string[] = []): boolean {
  if (
    roles.includes('admin') ||
    roles.includes('submitter') ||
    roles.includes('officer') ||
    roles.includes('senior_officer')
  ) {
    return true;
  }
  if (permissions.includes('create_document')) return true;
  // Backward compatibility for any legacy permission payloads.
  return permissions.includes('write');
}

/**
 * Role names (JWT) that receive org-wide operational dashboard / document list visibility.
 * Must stay aligned with `shared/operationalOversightRoles.js` on the backend.
 */
const OPERATIONAL_OVERVIEW_ROLE_NAMES = new Set([
  'admin',
  'director',
  'reviewer',
  'sdo_director',
  'executive_secretary',
  'general_manager',
  'deputy_general_manager',
  'assistant_general_manager',
]);

/**
 * Leadership roles that may switch between **My dashboard** and **360 · Operations** on `/dashboard`.
 * Excludes `reviewer` (360 only) and `admin` (360 only unless they also carry a leadership role).
 * `sdo_director` is a synthetic JWT role for SDO department + Director designation (see backend auth).
 */
const DIRECTOR_DASHBOARD_TOGGLE_ROLE_NAMES = new Set([
  'director',
  'sdo_director',
  'executive_secretary',
  'general_manager',
  'deputy_general_manager',
  'assistant_general_manager',
]);

function hasRoleInSet(roles: string[], set: Set<string>): boolean {
  return roles.some((r) => set.has(String(r).toLowerCase()));
}

/**
 * Cross-user operational dashboard (matches document agent `canViewAllDocuments` /
 * task agent `canViewAllTasks`): org-wide document and task visibility for oversight roles.
 */
export function canViewOperationalOverview(roles: string[], permissions: string[] = []): boolean {
  if (hasRoleInSet(roles, OPERATIONAL_OVERVIEW_ROLE_NAMES)) return true;
  return permissions.includes('manage_documents') || permissions.includes('manage_users');
}

/** Leadership (NHIA director grades + legacy `director`) may switch personal vs 360 home dashboard. */
export function canDirectorToggleOperationalDashboard(roles: string[]): boolean {
  return hasRoleInSet(roles, DIRECTOR_DASHBOARD_TOGGLE_ROLE_NAMES);
}

/**
 * Full **Audit Log** app area (`/audit` sidebar + route). Restricted to legacy `director`,
 * NHIA **Director General** grade (`general_manager` JWT role), and `admin` only.
 */
const AUDIT_LOG_MODULE_ROLE_NAMES = new Set(['admin', 'director', 'general_manager']);

export function canAccessAuditLogModule(roles: string[] | undefined | null): boolean {
  if (!roles?.length) return false;
  return hasRoleInSet(roles, AUDIT_LOG_MODULE_ROLE_NAMES);
}

/** @deprecated Use {@link canAccessAuditLogModule} — same behaviour. */
export function canViewAuditLogs(roles: string[]): boolean {
  return canAccessAuditLogModule(roles);
}

export function canIndexSearch(roles: string[]): boolean {
  return roles.includes('admin');
}

/** Enterprise template builder — administrators & records / submission roles. */
export function canAccessTemplateManagement(roles: string[]): boolean {
  return roles.some((r) => ['admin', 'submitter', 'director'].includes(r));
}
