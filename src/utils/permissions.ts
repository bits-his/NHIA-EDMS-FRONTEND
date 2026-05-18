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
    };
  }

  if (isDmOwner) {
    // Pending direct-message owner: no actions until the baton returns via recipient branch.
    return {
      canEdit: false,
      canSubmit: false,
      canFinalApprove: false,
      canReject: false,
      canArchive: false,
      canEditForward: false,
      canApproveForward: false,
      canRequestInfo: false,
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
    canArchive:
      status === 'approved' &&
      (isAdmin || permissions.includes('archive_document')),
    /** Active step assignees may post a free-form comment on the document (no status change). */
    canEditForward: pendingMyStep,
    canApproveForward: pendingMyStep,
    canRequestInfo: pendingMyStep,
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
      };
    case 'review':
      // Forward-only step (no approve-forward / final approve here, but free-form comment is fine).
      return {
        ...base,
        canApproveForward: false,
        canFinalApprove: false,
      };
    case 'approve':
    case 'approve_forward':
      return {
        ...base,
        canFinalApprove: false,
      };
    default:
      return base;
  }
}

/** Bottom of NHIA grade ladder — limited sidebar (dashboard, documents, notifications). */
const JUNIOR_STAFF_ROLE_NAMES = new Set(['officer', 'senior_officer']);

/**
 * True when the user has **only** junior staff roles (no admin, manager grades, legacy roles, etc.).
 */
export function isJuniorStaffOnly(roles: string[]): boolean {
  const normalized = roles.map((r) => String(r).toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return false;
  return normalized.every((r) => JUNIOR_STAFF_ROLE_NAMES.has(r));
}

/** Routes junior staff may open (direct URL or sidebar). */
export function isRouteAllowedForJuniorStaff(pathname: string): boolean {
  if (pathname === '/dashboard') return true;
  if (pathname === '/notifications' || pathname.startsWith('/notifications/')) return true;
  if (pathname === '/documents' || pathname.startsWith('/documents/')) return true;
  if (pathname === '/operational' || pathname.startsWith('/operational')) return true;
  if (pathname === '/archive' || pathname.startsWith('/archive')) return true;
  if (pathname === '/reports' || pathname.startsWith('/reports')) return true;
  return false;
}

/** Junior staff personal workflow performance (operational page, not org leaderboard). */
export function canAccessPersonalPerformancePage(roles: string[] | undefined | null): boolean {
  return isJuniorStaffOnly(roles ?? []);
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

/** Staff performance leaderboard and response-time analytics (director / DGO / oversight). */
export function canAccessPerformanceTracking(
  roles: string[] | undefined | null,
  permissions: string[] = []
): boolean {
  return canViewOperationalOverview(roles ?? [], permissions);
}

/** Leadership (NHIA director grades + legacy `director`) may switch personal vs 360 home dashboard. */
export function canDirectorToggleOperationalDashboard(roles: string[]): boolean {
  return hasRoleInSet(roles, DIRECTOR_DASHBOARD_TOGGLE_ROLE_NAMES);
}

/** Director General (DGO) — JWT role `executive_secretary`. */
export function isDirectorGeneralRole(roles: string[]): boolean {
  return hasRoleInSet(roles, DIRECTOR_GENERAL_ROLE_NAMES);
}

/** NHIA director grade roles (excludes DGO unless also `executive_secretary`). */
export function isDirectorGradeRole(roles: string[]): boolean {
  return hasRoleInSet(roles, DIRECTOR_GRADE_ROLE_NAMES);
}

/**
 * Full **Audit Log** app area (`/audit` sidebar + route). Restricted to legacy `director`,
 * NHIA **Director General** grade (`general_manager` JWT role), and `admin` only.
 */
const AUDIT_LOG_MODULE_ROLE_NAMES = new Set([
  'admin',
  'director',
  'general_manager',
  'executive_secretary',
]);

const DIRECTOR_GENERAL_ROLE_NAMES = new Set(['executive_secretary']);

const DIRECTOR_GRADE_ROLE_NAMES = new Set([
  'director',
  'sdo_director',
  'general_manager',
  'deputy_general_manager',
  'assistant_general_manager',
]);

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

/** User Management (`/admin/users`) — administrators only. */
export function canManageUsers(roles: string[]): boolean {
  return roles.some((r) => String(r).toLowerCase() === 'admin');
}
