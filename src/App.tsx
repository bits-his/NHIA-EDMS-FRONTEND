import { useEffect, useState } from 'react';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AppRouter } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/api/auth';
import { PageLoader } from '@/components/shared/PageLoader';

/**
 * On startup, validate any persisted JWT before rendering routes.
 * This prevents a redirect loop where stale persisted state (isAuthenticated=true
 * but token expired) causes PublicRoute ↔ ProtectedRoute to bounce indefinitely.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated, clearAuth } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      // Not logged in — nothing to validate
      setReady(true);
      return;
    }

    // Validate the persisted token against the auth agent
    authApi
      .validate(token)
      .then(() => {
        // Token is still valid
        setReady(true);
      })
      .catch(() => {
        // Token expired or invalid — clear state so guards redirect to /login
        clearAuth();
        setReady(true);
      });
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <PageLoader />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthGate>
          <AppRouter />
        </AuthGate>
      </QueryProvider>
    </ThemeProvider>
  );
}
