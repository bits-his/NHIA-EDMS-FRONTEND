import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types/auth';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) => {
        localStorage.setItem('nhia_token', token);
        set({ token, user, isAuthenticated: true });
      },

      clearAuth: () => {
        localStorage.removeItem('nhia_token');
        localStorage.removeItem('nhia_user');
        set({ token: null, user: null, isAuthenticated: false });
      },

      hasRole: (role) => {
        const { user } = get();
        return user?.roles.includes(role) ?? false;
      },

      hasPermission: (permission) => {
        const { user } = get();
        const list = user?.permissions ?? [];
        if (list.includes(permission)) return true;
        const canonByLegacy: Record<string, string> = {
          read: 'view_document',
          write: 'edit_document',
          delete: 'archive_document',
          approve: 'approve_document',
          reject: 'reject_document',
        };
        if (canonByLegacy[permission] && list.includes(canonByLegacy[permission])) return true;
        const legacyKey = Object.entries(canonByLegacy).find(([, v]) => v === permission)?.[0];
        return !!(legacyKey && list.includes(legacyKey));
      },
    }),
    {
      name: 'nhia_auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
