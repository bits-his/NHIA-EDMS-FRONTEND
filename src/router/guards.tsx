import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { ReactNode } from 'react';
import { canCreateDocument } from '@/utils/permissions';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export function PublicRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  // Only redirect to dashboard if we have BOTH isAuthenticated flag AND a token.
  // This prevents a redirect loop when persisted state is stale (token expired
  // but isAuthenticated is still true from localStorage).
  if (isAuthenticated && token) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** Anyone who may create documents (same bar as /documents/new) may open user directory routes. */
export function CanCreateDocumentGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  if (!canCreateDocument(roles, permissions)) {
    return fallback ? <>{fallback}</> : null;
  }
  return <>{children}</>;
}

export function RoleGuard({
  children,
  roles,
  fallback,
}: {
  children: ReactNode;
  roles: string[];
  fallback?: ReactNode;
}) {
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const userRoleSet = new Set(userRoles.map((r) => String(r).toLowerCase()));
  const hasRole = roles.some((r) => userRoleSet.has(String(r).toLowerCase()));

  if (!hasRole) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
