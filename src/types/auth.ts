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
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
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

export type Permission =
  | 'read'
  | 'write'
  | 'delete'
  | 'approve'
  | 'reject';
