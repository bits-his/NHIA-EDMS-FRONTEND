import { authClient } from './client';
import type { LoginRequest, LoginResponse, ValidateResponse, UserRolesResponse, Role } from '@/types/auth';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  created_at: string;
  roles: Role[];
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const res = await authClient.post<LoginResponse>('/auth/login', data);
    return res.data;
  },

  validate: async (token: string): Promise<ValidateResponse> => {
    const res = await authClient.post<ValidateResponse>('/auth/validate', { token });
    return res.data;
  },

  getUserRoles: async (userId: string, token?: string): Promise<UserRolesResponse> => {
    const res = await authClient.get<UserRolesResponse>(`/auth/users/${userId}/roles`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },

  // ── User management ──────────────────────────────────────────────────────

  listUsers: async (): Promise<UserRecord[]> => {
    const res = await authClient.get<UserRecord[]>('/auth/users');
    return res.data;
  },

  createUser: async (data: { username: string; email: string; password: string }): Promise<UserRecord> => {
    const res = await authClient.post<UserRecord>('/auth/users', data);
    return res.data;
  },

  resetPassword: async (userId: string, password: string): Promise<{ message: string }> => {
    const res = await authClient.put<{ message: string }>(`/auth/users/${userId}/password`, { password });
    return res.data;
  },

  deactivateUser: async (userId: string): Promise<{ message: string }> => {
    const res = await authClient.delete<{ message: string }>(`/auth/users/${userId}`);
    return res.data;
  },

  assignRole: async (userId: string, roleId: string): Promise<UserRolesResponse> => {
    const res = await authClient.post<UserRolesResponse>(`/auth/users/${userId}/roles`, { role_id: roleId });
    return res.data;
  },

  removeRole: async (userId: string, roleId: string): Promise<UserRolesResponse> => {
    const res = await authClient.delete<UserRolesResponse>(`/auth/users/${userId}/roles/${roleId}`);
    return res.data;
  },

  // ── Role management ───────────────────────────────────────────────────────

  listRoles: async (): Promise<Role[]> => {
    const res = await authClient.get<Role[]>('/auth/roles');
    return res.data;
  },

  createRole: async (data: { name: string; permissions: string[] }): Promise<Role> => {
    const res = await authClient.post<Role>('/auth/roles', data);
    return res.data;
  },

  listPermissions: async (): Promise<{ id: string; name: string; description: string | null }[]> => {
    const res = await authClient.get('/auth/permissions');
    return res.data;
  },

  setRolePermissions: async (
    roleId: string,
    permissionNames: string[]
  ): Promise<{ id: string; permission_names: string[] }> => {
    const res = await authClient.post(`/auth/roles/${roleId}/permissions`, {
      permission_names: permissionNames,
    });
    return res.data;
  },

  listDelegations: async (params?: {
    from_user_id?: string;
    to_user_id?: string;
    status?: string;
  }): Promise<unknown[]> => {
    const res = await authClient.get('/auth/delegations', { params });
    return res.data;
  },

  createDelegation: async (data: {
    from_user_id: string;
    to_user_id: string;
    role_id: string;
    valid_from: string;
    valid_to: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown> => {
    const res = await authClient.post('/auth/delegations', data);
    return res.data;
  },
};
