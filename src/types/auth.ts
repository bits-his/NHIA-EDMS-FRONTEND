export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface ValidateResponse {
  user_id: string;
  roles: string[];
  /** Effective RBAC permission names (JWT); mirrors login payload after NHIA RBAC migration */
  permissions?: string[];
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  /** NHIA grade ladder (1 = Officer … 10 = Director General), when defined */
  level?: number | null;
  description?: string | null;
}

export interface UserRolesResponse {
  user_id: string;
  roles: Role[];
}

export interface AuthUser {
  user_id: string;
  username: string;
  roles: string[];
  permissions: string[];
}

/** GET /auth/users/:id/profile — extended fields from auth agent */
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  zone?: string | null;
  state?: string | null;
  department?: string | null;
  unit?: string | null;
  rank?: string | null;
  photo_path?: string | null;
  signature_path?: string | null;
  created_at: string;
}

/** Legacy shortcuts still accepted by some checks */
export type LegacyPermission = 'read' | 'write' | 'delete' | 'approve' | 'reject';

/** Canonical NHIA DMS permission keys (see migration `permissions` catalogue) */
export type NHPermission =
  | 'create_document'
  | 'edit_document'
  | 'submit_document'
  | 'view_document'
  | 'approve_document'
  | 'reject_document'
  | 'sign_document'
  | 'archive_document'
  | 'delegate_approval'
  | 'view_audit_logs'
  | 'manage_users'
  | 'manage_roles';

export type Permission = LegacyPermission | NHPermission | string;

/** Official NHIA rank ladder (GET /auth/designations). */
export interface NhiaDesignationDto {
  id: string | number;
  slug: string;
  title: string;
  hierarchy_order: number;
  approval_authority_level: number;
  workflow_signing_level: number;
  escalation_level: number;
  delegation_allowed: boolean;
  is_active: boolean;
}

export interface OrgHierarchyHeadquarters {
  id: number;
  name: string;
  code?: string;
  is_active: boolean;
}

export interface OrgHierarchyStateOffice {
  id: number;
  name: string;
  zone_id?: number | null;
  zone_code?: string;
}

export interface OrgHierarchyZone {
  id: number;
  code: string;
  name: string;
  stateOffices?: OrgHierarchyStateOffice[];
}

export interface OrgHierarchyResponse {
  headquarters: OrgHierarchyHeadquarters[];
  zones: OrgHierarchyZone[];
  directorates?: Array<Record<string, unknown>>;
  departmentsWithoutDirectorate?: Array<{ id: number; name: string }>;
}

export interface UserAdminDetail extends UserProfile {
  roles: Role[];
  permission_grants?: string[];
  assignments?: Array<Record<string, unknown>>;
  account_status?: string | null;
  designation_id?: string | number | null;
  staff_id?: string | null;
  mfa_enabled?: boolean | null;
  nhia_department_id?: string | number | null;
  nhia_unit_id?: string | number | null;
}

export interface WorkflowAuthoritySupervisor {
  id: string;
  username?: string;
  full_name?: string | null;
  designation_title?: string | null;
}

export interface WorkflowAuthorityResponse {
  supervisor_chain: WorkflowAuthoritySupervisor[];
}
