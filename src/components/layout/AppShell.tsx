import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { JuniorStaffRouteGuard } from '@/router/guards';
import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { notificationsApi } from '@/api/notifications';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const setNotifications = useNotificationStore((s) => s.setNotifications);

  useEffect(() => {
    if (!user?.user_id) return;
    const fetch = async () => {
      try {
        const data = await notificationsApi.getAll(user.user_id);
        setNotifications(data);
      } catch { /* non-critical */ }
    };
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [user?.user_id, setNotifications]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="w-full min-w-0 px-5 py-6 sm:px-6 lg:px-8 page-enter">
              <JuniorStaffRouteGuard>
                <Outlet />
              </JuniorStaffRouteGuard>
            </div>
          </main>
        </div>
      </div>

      <Toaster
        position="top-right"
        richColors
        closeButton
        expand={false}
        toastOptions={{
          classNames: {
            toast: 'font-sans text-sm shadow-card-md',
            title: 'font-semibold',
          },
        }}
      />
    </TooltipProvider>
  );
}
